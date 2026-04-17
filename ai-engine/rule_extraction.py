"""
Rule-based extraction: skills, years of experience, education, certifications.
Improved skill extraction with expanded vocabulary and JD required-skills parsing.
"""
import re
from preprocessing import preprocess_for_extraction

# Expanded common skills (tech + soft) for accurate extraction
COMMON_SKILLS = {
    "python", "java", "javascript", "typescript", "react", "next.js", "node", "node.js",
    "sql", "mongodb", "mysql", "postgresql", "redis", "aws", "docker", "kubernetes",
    "git", "linux", "machine learning", "ml", "nlp", "deep learning", "tensorflow",
    "pytorch", "scikit-learn", "sklearn", "pandas", "numpy", "excel", "tableau",
    "power bi", "agile", "scrum", "rest", "api", "rest api", "graphql", "html", "css",
    "angular", "vue", "flask", "django", "express", "fastapi", "spring boot",
    "c++", "c#", ".net", "php", "ruby", "go", "golang", "r", "spark", "hadoop",
    "azure", "gcp", "ci/cd", "jenkins", "github actions", "figma", "ui", "ux",
    "data analysis", "data science", "data engineering", "etl", "communication",
    "leadership", "problem solving", "project management", "jira", "confluence",
    "pwa", "service workers", "performance optimization", "seo", "bootstrap",
    "tailwind", "redux", "webpack", "jest", "testing", "tdd", "oop", "microservices",
    "kafka", "rabbitmq", "elasticsearch", "nosql", "orm", "hibernate", "jpa",
    "computer vision", "nlp", "natural language processing", "statistical modeling",
    "a/b testing", "data visualization", "power bi", "looker", "snowflake",
    "databricks", "airflow", "dbt", "terraform", "ansible", "helm",
    # Common domain phrasing variants
    "data analytics",
}

# Terms that are commonly present in JD text but are not skills.
# These are used as a defensive filter to prevent generic phrases like
# "requirements", "responsibilities", or "JD" from leaking into "missing keywords".
_NON_SKILL_BLACKLIST_EXACT = {
    # Generic hiring language
    "requirement", "requirements", "responsibility", "responsibilities",
    "qualification", "qualifications",
    "preferred", "nice", "must", "responsible",
    "role", "job", "position", "candidate", "applicant",
    "experience", "years", "year",
    "education", "graduate", "bachelor", "bachelors", "master", "masters",
    "phd", "doctorate", "degree",
    # Document/header terms
    "jd", "job description", "job-description", "description",
    "about", "summary",
}

# Also skip any candidate that "looks like" education/document text.
_EDUCATION_OR_DOC_REGEX = re.compile(
    r"\b("
    r"jd|job\s*description|description|role|responsibilit(?:y|ies)|requirements?|"
    r"qualifications?|candidate|applicant|graduate|bachelor(?:'?s)?|master(?:'?s)?|"
    r"ph\.?\s*d|doctorate|degree|education"
    r")\b",
    re.I,
)


def _normalize_skill_term(term: str) -> str:
    """Normalize extracted terms for stable matching."""
    if not term or not isinstance(term, str):
        return ""
    t = term.strip().lower()
    # Remove surrounding punctuation while keeping inner operators (c#, c++, .net)
    # Note: keep leading '.' so ".net" can still match the whitelist.
    t = re.sub(r"^[\s\-\(\[\{,]+|[\s\-\)\]\},\.]+$", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    # Normalize a few common separators
    t = t.replace(" / ", "/").replace(" /", "/").replace("/ ", "/")
    # Normalize hyphenated phrases to spaces (e.g., "machine-learning" -> "machine learning")
    t = t.replace("-", " ")
    return t


def _is_non_skill_term(term: str) -> bool:
    t = _normalize_skill_term(term)
    if not t:
        return True
    if t in _NON_SKILL_BLACKLIST_EXACT:
        return True
    if _EDUCATION_OR_DOC_REGEX.search(t):
        return True
    # Defensive: reject very short generic tokens unless they are known skills.
    if len(t) <= 2 and t not in COMMON_SKILLS:
        return True
    return False


def filter_skill_candidates(candidates):
    """
    Whitelist-based filter: keep only terms that match known skills
    (COMMON_SKILLS) and are not generic/document/education terms.
    """
    out = []
    seen = set()
    for c in candidates or []:
        t = _normalize_skill_term(c)
        if not t or t in seen:
            continue
        if _is_non_skill_term(t):
            continue
        if t in COMMON_SKILLS:
            out.append(t)
            seen.add(t)
    return out


# JD patterns for required skills / must have / qualifications
JD_SKILL_PATTERNS = [
    r"(?:required\s+skills?|skills?\s+required|key\s+skills?)\s*[:\-]\s*([^\n]+)",
    r"(?:must\s+have|requirements?|qualifications?)\s*[:\-]\s*([^\n]+)",
    r"(?:technical\s+skills?|competencies)\s*[:\-]\s*([^\n]+)",
    r"(?:preferred\s+skills?|nice\s+to\s+have)\s*[:\-]\s*([^\n]+)",
    r"(\b(?:react|python|java|sql|aws|docker|machine\s+learning)[^.\n]*)",
]
JD_SKILL_REGEX = re.compile("|".join(JD_SKILL_PATTERNS), re.I)


def _split_skills_text(text):
    """Split skill-like text by comma, semicolon, pipe, or newline; normalize."""
    if not text or not isinstance(text, str):
        return []
    parts = re.split(r"[,;|\n]|\band\b", text)
    out = []
    for p in parts:
        s = p.strip().lower()
        if 1 <= len(s) <= 80 and not s.isdigit():
            # Strip trailing punctuation to improve whitelist matching.
            s = re.sub(r"[,\.;:\s]+$", "", s).strip()
            out.append(s)
    return list(dict.fromkeys(out))


def extract_required_skills_from_jd(job_desc):
    """
    Extract required/preferred skills from job description text.
    Handles 'required_skills: X; Y; Z' and 'must have: A, B, C' style.
    """
    if not job_desc:
        return []
    text = job_desc
    collected = []
    for m in JD_SKILL_REGEX.finditer(text):
        g = m.lastindex and m.group(m.lastindex)
        if g:
            # 1) Split comma/semicolon lists.
            collected.extend(_split_skills_text(g))
            # 2) Also scan the matched chunk for any known skills directly.
            # This prevents cases like "SQL. This JD ..." from becoming
            # an unmatchable combined string.
            chunk_lower = g.lower()
            for skill in COMMON_SKILLS:
                if any(ch in skill for ch in [".", "#", "+", "/"]):
                    if skill in chunk_lower:
                        collected.append(skill)
                else:
                    if re.search(r"\b" + re.escape(skill) + r"\b", chunk_lower, flags=re.I):
                        collected.append(skill)
    # Also split whole description for obvious skill-like tokens (2–50 chars, no spaces or one space)
    words = re.findall(r"\b[a-z][a-z0-9\s\-\.\+]{1,48}[a-z0-9]?\b", text.lower())
    for w in words:
        w = w.strip()
        if 2 <= len(w) <= 50 and w in COMMON_SKILLS:
            collected.append(w)
    # Important: only return valid skills; avoid generic words from "requirements/must have".
    filtered = filter_skill_candidates(collected)
    return list(dict.fromkeys(filtered))[:80]


# Education degree patterns (regex)
DEGREE_PATTERNS = [
    r"\b(b\.?s\.?c\.?|b\.?e\.?|b\.?tech|bachelor|b\.?a\.?|b\.?com)\b",
    r"\b(m\.?s\.?c\.?|m\.?e\.?|m\.?tech|master|m\.?a\.?|m\.?b\.?a\.?|m\.?com)\b",
    r"\b(ph\.?d\.?|doctorate|pgdm|pgd)\b",
    r"\b(diploma|b\.?ca|m\.?ca|b\.?sc)\b",
]
EDUCATION_SECTION_PATTERN = re.compile(
    r"(?:education|academic|qualification)s?\s*[:\-]\s*(.*?)(?=\n\s*(?:experience|work|skills|projects|certification|summary|$))",
    re.I | re.S
)
DEGREE_REGEX = re.compile("|".join(DEGREE_PATTERNS), re.I)

# Years of experience
YEARS_PATTERNS = [
    r"(?:(\d+)\+?\s*years?\s*(?:of\s*)?(?:experience|exp\.?))",
    r"(?:experience\s*[:\-]\s*(\d+)\+?\s*years?)",
    r"(?:(\d+)\s*-\s*(\d+)\s*years?\s*experience)",
    r"(?:(\d+)\s*years?\s*(?:in\s*)?(?:industry|field))",
    r"(?:(\d+)\+?\s*yrs?\s*(?:exp\.?|experience))",
]
YEARS_REGEX = re.compile("|".join(YEARS_PATTERNS), re.I)

# Certifications
CERT_PATTERNS = [
    r"\b(certified|certification|certificate)\s*[:\-]?\s*([^\n,]+)",
    r"\b(aws\s*certified|google\s*certified|microsoft\s*certified|azure\s*certified)[^\n,]*",
    r"\b(pmp|cisp|cissp|comptia|scrum\s*master|splunk)[^\n,]*",
]
CERT_REGEX = re.compile("|".join(CERT_PATTERNS), re.I)

# Resume skills section – multiple header variants
SKILLS_SECTION_PATTERNS = [
    r"(?:skills|technical\s*skills|key\s*skills|competencies|core\s*competencies)\s*[:\-]\s*(.*?)(?=\n\s*(?:experience|education|projects|certification|work\s+history|summary|$))",
    r"(?:expertise|technologies|tools)\s*[:\-]\s*(.*?)(?=\n\s*(?:experience|education|projects|$))",
]
SKILLS_SECTION_REGEX = re.compile("|".join(SKILLS_SECTION_PATTERNS), re.I | re.S)


def extract_years_of_experience(text):
    """Extract years of experience. Returns a number (float) or 0."""
    text = preprocess_for_extraction(text)
    best = 0.0
    for m in YEARS_REGEX.finditer(text):
        g = m.groups()
        if len(g) == 1 and g[0]:
            best = max(best, float(g[0]))
        elif len(g) == 2 and g[0] and g[1]:
            best = max(best, (float(g[0]) + float(g[1])) / 2)
    return round(best, 1)


def extract_education(text):
    """Extract education mentions (degree names). Returns list of strings."""
    text_raw = text
    text = preprocess_for_extraction(text)
    results = []
    for m in EDUCATION_SECTION_PATTERN.finditer(text_raw):
        block = m.group(1)
        if DEGREE_REGEX.search(block):
            results.append(block.strip()[:200])
    for m in DEGREE_REGEX.finditer(text):
        results.append(m.group(0).strip())
    return list(dict.fromkeys(results))[:10]


def extract_certifications(text):
    """Extract certification mentions. Returns list of strings."""
    text = preprocess_for_extraction(text)
    results = []
    for m in CERT_REGEX.finditer(text):
        if m.lastindex and m.group(m.lastindex):
            results.append(m.group(m.lastindex).strip()[:150])
        else:
            results.append(m.group(0).strip()[:150])
    return list(dict.fromkeys(results))[:15]


def extract_skills_from_section(text):
    """Extract skills from Skills/Key skills/Technical skills sections."""
    skills = set()
    for m in SKILLS_SECTION_REGEX.finditer(text):
        block = m.group(1)
        for part in _split_skills_text(block):
            if 2 <= len(part) <= 80:
                skills.add(part)
    return list(skills)


def extract_skills_keywords(text):
    """Extract skills by matching COMMON_SKILLS in text (word boundaries where possible)."""
    text = preprocess_for_extraction(text).lower()
    found = set()
    for skill in COMMON_SKILLS:
        # Prefer whole-word match
        if re.search(r"\b" + re.escape(skill) + r"\b", text, flags=re.I):
            found.add(skill)
    return list(found)


def extract_skills_from_resume(text):
    """
    All resume skill sources combined: section + keyword match.
    Returns list of unique skills (max 80).
    """
    from_section = extract_skills_from_section(text)
    from_keywords = extract_skills_keywords(text)
    combined = list(dict.fromkeys(from_section + from_keywords))[:80]
    # Whitelist filter to prevent generic/non-skill words from entering skill lists.
    return filter_skill_candidates(combined)


def extract_all(text):
    """Run all rule-based extractions from resume/text. Returns a dict."""
    return {
        "skills": extract_skills_from_resume(text),
        "years_of_experience": extract_years_of_experience(text),
        "education": extract_education(text),
        "certifications": extract_certifications(text),
    }


def extract_job_required_skills(job_desc):
    """Extract required/preferred skills from job description for gap analysis."""
    return extract_required_skills_from_jd(job_desc)
