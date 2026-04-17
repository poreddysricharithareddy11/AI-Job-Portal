"""
Skill Gap & Resume Improvement Engine.
Compares resume vs job description semantically; identifies missing skills/tools;
suggests keywords and phrasing improvements; generates downloadable report payload.
"""
import re
from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from preprocessing import preprocess_for_similarity
from rule_extraction import extract_all, extract_required_skills_from_jd, filter_skill_candidates
from config import MODEL_NAME, DEVICE

# Normalize close skill synonyms so "data analysis" and "data science"
# (and similar phrases) are treated as equivalent for match/gap reporting.
def _canonical_skill(skill: str) -> str:
    t = (skill or "").strip().lower()
    if not t:
        return ""

    # Data domain: many resumes/JDs use these interchangeably.
    if t in {"data analysis", "data analytics", "data analyst"}:
        return "data science"
    if t == "data science":
        return "data science"

    # Keep everything else as-is (lowercased).
    return t

# Lazy-load model to avoid loading on import if only parsing
_model = None


def _get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer(MODEL_NAME, device=DEVICE)
    return _model


def _semantic_similar_terms(term, candidate_terms, model, top_k=5):
    """Return candidate_terms most similar to `term` by embedding (for suggestions)."""
    if not term or not candidate_terms:
        return []
    try:
        embs = model.encode([term] + candidate_terms)
        sims = cosine_similarity(embs[0:1], embs[1:])[0]
        idx = sims.argsort()[::-1][:top_k]
        return [candidate_terms[i] for i in idx]
    except Exception:
        return candidate_terms[:top_k]


def compute_skill_gap_report(resume_text, job_desc, job_title=""):
    """
    Returns:
    - matched_skills: list of skills present in both
    - missing_skills: list of skills in JD not in resume
    - missing_tools_frameworks: subset of missing that look like tools/frameworks
    - suggested_keywords: keywords to add (from JD, prioritized by TF-IDF)
    - phrasing_suggestions: short improvement tips
    - report_text: full text for downloadable report
    """
    if not resume_text or not job_desc:
        return {
            "matched_skills": [],
            "missing_skills": [],
            "missing_tools_frameworks": [],
            "suggested_keywords": [],
            "phrasing_suggestions": [],
            "report_text": "Insufficient input.",
        }

    resume_clean = preprocess_for_similarity(resume_text)
    jd_clean = preprocess_for_similarity(job_desc)
    resume_ext = extract_all(resume_text)
    jd_ext = extract_all(job_desc)
    jd_required = extract_required_skills_from_jd(job_desc)
    jd_skills = set(_canonical_skill(s) for s in (jd_ext.get("skills") or []) + jd_required)
    resume_skills = set(_canonical_skill(s) for s in resume_ext.get("skills", []))
    jd_skills.discard("")
    resume_skills.discard("")
    matched = list(resume_skills & jd_skills)
    missing = list(jd_skills - resume_skills)

    # Tools/frameworks: typically single words or known tech terms
    tech_like = re.compile(r"^[a-z0-9#+.]+$|python|java|react|node|aws|docker|sql|mongodb|kubernetes|azure|gcp|figma|jira|agile|scrum", re.I)
    missing_tools = [s for s in missing if tech_like.search(s) or len(s.split()) <= 2][:20]

    # Suggested keywords: missing skills + important JD terms (TF-IDF)
    try:
        vectorizer = TfidfVectorizer(max_features=100, ngram_range=(1, 2))
        matrix = vectorizer.fit_transform([jd_clean, resume_clean])
        jd_vec = matrix[0]
        feature_names = vectorizer.get_feature_names_out()
        scores = zip(feature_names, jd_vec.toarray()[0])
        top_jd_terms = [t for t, _ in sorted(scores, key=lambda x: -x[1]) if x[1] > 0][:25]
        suggested = list(missing)[:15]
        resume_skill_set = set(resume_skills)
        valid_top_terms = filter_skill_candidates(top_jd_terms)
        for t in valid_top_terms:
            ct = _canonical_skill(t)
            if ct and ct not in resume_skill_set and ct not in suggested:
                suggested.append(ct)
            if len(suggested) >= 20:
                break
    except Exception:
        suggested = list(missing)[:20]

    # Phrasing suggestions (rule-based tips)
    phrasing = []
    if not resume_ext.get("education") and jd_ext.get("education"):
        phrasing.append("Add an Education section with degree and institution.")
    if not resume_ext.get("certifications") and jd_ext.get("certifications"):
        phrasing.append("Consider adding relevant certifications to strengthen your profile.")
    jd_years = jd_ext.get("years_of_experience") or 0
    res_years = resume_ext.get("years_of_experience") or 0
    if jd_years > 0 and res_years < jd_years:
        phrasing.append(f"Highlight projects and responsibilities that demonstrate experience; JD suggests {jd_years}+ years.")
    if missing_tools:
        phrasing.append("Add specific tools and frameworks from the job description (e.g. " + ", ".join(missing_tools[:5]) + ").")
    if not phrasing:
        phrasing.append("Emphasize quantifiable achievements and keywords from the job description.")

    # Semantic suggestions: for first few missing skills, suggest similar terms from resume
    try:
        model = _get_model()
        for m in missing[:5]:
            similar = _semantic_similar_terms(m, list(resume_skills)[:30], model, top_k=3)
            if similar:
                phrasing.append(f"For '{m}', consider highlighting related experience: {', '.join(similar)}.")
    except Exception:
        pass

    # Report text (plain text for download)
    lines = [
        "=== Resume vs Job: Skill Gap Report ===",
        f"Job Title: {job_title or 'N/A'}",
        "",
        "Matched skills:",
        "\n".join(f"  - {s}" for s in matched) or "  (none)",
        "",
        "Missing skills:",
        "\n".join(f"  - {s}" for s in missing) or "  (none)",
        "",
        "Suggested keywords to add:",
        "\n".join(f"  - {s}" for s in suggested[:20]) or "  (none)",
        "",
        "Phrasing suggestions:",
        "\n".join(f"  - {p}" for p in phrasing) or "  (none)",
    ]
    report_text = "\n".join(lines)

    return {
        "matched_skills": matched,
        "missing_skills": missing,
        "missing_tools_frameworks": missing_tools,
        "suggested_keywords": suggested[:20],
        "phrasing_suggestions": phrasing,
        "report_text": report_text,
        "years_resume": res_years,
        "years_jd": jd_years,
    }
