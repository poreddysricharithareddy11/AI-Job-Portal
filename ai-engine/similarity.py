"""
Lightweight matching: TF-IDF + rule-based only (NO SBERT).
"""

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from preprocessing import preprocess_for_similarity
from rule_extraction import extract_all, extract_required_skills_from_jd

tfidf_vectorizer = TfidfVectorizer(
    max_features=3000,
    analyzer="char_wb",
    ngram_range=(3, 5),
)


def detect_experience_level(text):
    text = (text or "").lower()
    if any(x in text for x in ["intern", "student", "fresher", "junior"]):
        return "Junior"
    return "Senior"


def compute_skill_gap(resume_skills, jd_skills):
    if not jd_skills:
        return 0.5, [], []

    resume_set = set(s.lower().strip() for s in (resume_skills or []) if s)
    jd_set = set(s.lower().strip() for s in (jd_skills or []) if s)

    matched = list(resume_set & jd_set)
    missing = list(jd_set - resume_set)

    ratio = len(matched) / len(jd_set) if jd_set else 0
    return ratio, matched, missing


def rule_based_match_score(resume_extracted, jd_extracted):
    skill_score, matched_skills, missing_skills = compute_skill_gap(
        resume_extracted.get("skills", []),
        jd_extracted.get("skills", [])
    )

    years_resume = resume_extracted.get("years_of_experience") or 0
    years_jd = jd_extracted.get("years_of_experience") or 0

    years_score = min(1.0, (years_resume / years_jd)) if years_jd > 0 else 1.0
    education_score = 0.1 if resume_extracted.get("education") else 0.0
    cert_score = 0.1 if resume_extracted.get("certifications") else 0.0

    rule = 0.5 * skill_score + 0.3 * years_score + education_score + cert_score
    return rule, missing_skills, matched_skills


def calculate_similarity(resume_text, job_desc, job_title="", job_id=None):
    if not resume_text or not job_desc:
        return 0.0, [], "Junior", {
            "tfidf_score": 0.0,
            "rule_score": 0.0,
            "final_percentage": 0.0,
        }, {}

    resume_clean = preprocess_for_similarity(resume_text) or " "
    jd_clean = preprocess_for_similarity(job_desc) or " "

    # TF-IDF
    try:
        tfidf_matrix = tfidf_vectorizer.fit_transform([resume_clean, jd_clean])
        tfidf_score = float(cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0])
    except Exception:
        tfidf_score = 0.0

    tfidf_norm = max(0, min(1, tfidf_score))

    # Rule-based
    resume_extracted = extract_all(resume_text)
    jd_extracted = extract_all(job_desc)

    jd_required = extract_required_skills_from_jd(job_desc)
    jd_extracted["skills"] = list(dict.fromkeys((jd_extracted.get("skills") or []) + jd_required))[:80]

    rule_score, missing_skills, matched_skills = rule_based_match_score(resume_extracted, jd_extracted)
    rule_norm = max(0, min(1, rule_score))

    final_raw = 0.6 * tfidf_norm + 0.4 * rule_norm

    experience_level = detect_experience_level(resume_text)

    if experience_level == "Junior":
        if any(role in (job_title or "").lower() for role in ["senior", "lead", "manager"]):
            final_raw -= 0.15

    final_percentage = round(max(0, min(100, final_raw * 100)), 2)

    breakdown = {
        "tfidf_score": round(tfidf_norm * 100, 2),
        "rule_score": round(rule_norm * 100, 2),
        "final_percentage": final_percentage,
    }

    missing_keywords = list(missing_skills)[:15]

    return final_percentage, missing_keywords, experience_level, breakdown, resume_extracted


def extract_missing_keywords(resume_text, jd_text):
    _, missing, _, _, _ = calculate_similarity(resume_text, jd_text)
    return missing[:10]


def infer_top_roles(score):
    if score >= 80:
        return ["Top Match", "Highly Qualified"]
    if score >= 50:
        return ["Potential Match"]
    return ["Low Match"]
