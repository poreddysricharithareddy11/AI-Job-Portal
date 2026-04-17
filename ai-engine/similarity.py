"""
Hybrid matching: 50% SBERT + 30% TF-IDF + 20% rule-based.
Returns normalized percentage and full breakdown.
"""
import hashlib
import torch
from sentence_transformers import SentenceTransformer, util
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import re
import numpy as np
from config import MODEL_NAME, DEVICE
from preprocessing import preprocess_for_similarity
from rule_extraction import extract_all, extract_years_of_experience, extract_required_skills_from_jd

# Load SBERT lazily so this service still works if the model cannot be downloaded
# (offline, slow network, timeouts). If SBERT is unavailable, we fall back to
# TF-IDF + rule-based scoring and still return numeric breakdown values.
_sbert_model = None  # None => not loaded; False => load failed


def _get_sbert_model():
    global _sbert_model
    if _sbert_model is False:
        return None
    if _sbert_model is not None:
        return _sbert_model
    try:
        # Avoid non-ASCII emoji output on Windows terminals.
        print(f"Loading SBERT ({MODEL_NAME}) on {DEVICE}...")
        # Fail fast if the model isn't already cached locally.
        # This prevents request timeouts during the first run.
        _sbert_model = SentenceTransformer(MODEL_NAME, device=DEVICE, local_files_only=True)
        return _sbert_model
    except Exception:
        _sbert_model = False
        return None
# TF-IDF is computed on a preprocessed string; to make the overlap robust to tokenization
# differences (e.g., punctuation in "node.js", "c++", "+/-"), use character n-grams.
tfidf_vectorizer = TfidfVectorizer(
    max_features=5000,
    analyzer="char_wb",
    ngram_range=(3, 5),
)

# In-memory embedding cache: key = hash(job_desc) or job_id
_embedding_cache = {}


def _cache_key(job_desc, job_id=None):
    if job_id:
        return f"job_{job_id}"
    return f"jd_{hashlib.md5((job_desc or '').encode()).hexdigest()}"


def get_job_embedding(job_desc, job_id=None):
    """Return cached or compute job description embedding."""
    key = _cache_key(job_desc, job_id)
    if key not in _embedding_cache:
        text = preprocess_for_similarity(job_desc or "")
        if not text:
            text = " "
        model = _get_sbert_model()
        if model is None:
            return None
        _embedding_cache[key] = model.encode([text], convert_to_tensor=True)[0]
    return _embedding_cache[key]


def detect_experience_level(text):
    text = (text or "").lower()
    if any(x in text for x in ["intern", "student", "fresher", "junior"]):
        return "Junior"
    return "Senior"


def compute_skill_gap(resume_skills, jd_skills):
    """resume_skills and jd_skills are lists. Returns (overlap_ratio, matched, missing)."""
    if not jd_skills:
        return 0.5, [], []

    # Resume/JD skills are already whitelisted-filtered upstream.
    # We still want to handle a few common abbreviations safely, but we must
    # avoid generic substring matching (e.g., "sql" wrongly matching "nosql").
    alias_equivalents = {
        "ml": {"machine learning"},
        "machine learning": {"ml"},
        "nlp": {"natural language processing"},
        "natural language processing": {"nlp"},
        "sklearn": {"scikit-learn"},
        "scikit-learn": {"sklearn"},
        "node.js": {"node"},
        "node": {"node.js"},
        # Data domain synonyms (common in analytics vs science job descriptions)
        "data analysis": {"data science", "data analytics"},
        "data analytics": {"data science", "data analysis"},
        "data science": {"data analysis", "data analytics"},
    }

    def equivalents(skill: str):
        s = (skill or "").lower().strip()
        out = {s} if s else set()
        out |= alias_equivalents.get(s, set())
        return out

    resume_set = set(s.lower().strip() for s in (resume_skills or []) if s)
    jd_set = set(s.lower().strip() for s in (jd_skills or []) if s)

    matched_set = set()
    for jd_skill in jd_set:
        eq = equivalents(jd_skill)
        if eq & resume_set:
            matched_set.add(jd_skill)

    missing = list(jd_set - matched_set)
    ratio = len(matched_set) / len(jd_set) if jd_set else 0
    return ratio, list(matched_set), missing


def rule_based_match_score(resume_extracted, jd_extracted):
    """
    Compute rule-based match score from extracted fields.
    Weights: skill overlap 0.5, years 0.3, education 0.1, certs 0.1.
    """
    skill_score, matched_skills, missing_skills = compute_skill_gap(
        resume_extracted.get("skills", []),
        jd_extracted.get("skills", [])
    )
    years_resume = resume_extracted.get("years_of_experience") or 0
    years_jd = jd_extracted.get("years_of_experience") or 0
    if years_jd <= 0:
        years_score = 1.0
    else:
        years_score = min(1.0, (years_resume / years_jd))

    education_score = 0.1 if (resume_extracted.get("education")) else 0.0
    cert_score = 0.1 if (resume_extracted.get("certifications")) else 0.0
    rule = 0.5 * skill_score + 0.3 * years_score + education_score + cert_score
    return rule, missing_skills, matched_skills


def calculate_similarity(resume_text, job_desc, job_title="", job_id=None):
    """
    Hybrid: 0.5 * SBERT + 0.3 * TF-IDF + 0.2 * rule-based.
    Returns (final_percentage, missing_keywords, experience_level, breakdown_dict, extracted_resume).
    """
    if not resume_text or not job_desc:
        return 0.0, [], "Junior", {
            "sbert_score": 0.0,
            "tfidf_score": 0.0,
            "rule_score": 0.0,
            "final_percentage": 0.0,
        }, {}

    resume_clean = preprocess_for_similarity(resume_text)
    jd_clean = preprocess_for_similarity(job_desc)
    if not resume_clean:
        resume_clean = " "
    if not jd_clean:
        jd_clean = " "

    # 1. SBERT (lazy-load; if unavailable, use 0.0 so TF-IDF + rule still matter)
    sbert_norm = 0.0
    try:
        model = _get_sbert_model()
        if model is not None:
            job_emb = get_job_embedding(job_desc, job_id)
            if job_emb is not None:
                resume_emb = model.encode([resume_clean], convert_to_tensor=True)[0]
                semantic_score = float(util.cos_sim(resume_emb, job_emb.unsqueeze(0))[0][0])
                # Normalize from [-1,1] to [0,1]
                sbert_norm = (semantic_score + 1) / 2
    except Exception:
        sbert_norm = 0.0

    # 2. TF-IDF overlap
    try:
        tfidf_matrix = tfidf_vectorizer.fit_transform([resume_clean, jd_clean])
        tfidf_score = float(cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0])
    except Exception:
        tfidf_score = 0.0
    tfidf_norm = max(0, min(1, tfidf_score))

    # 3. Rule-based (use JD required-skills for accurate gap)
    resume_extracted = extract_all(resume_text)
    jd_extracted = extract_all(job_desc)
    jd_required = extract_required_skills_from_jd(job_desc)
    jd_extracted["skills"] = list(dict.fromkeys((jd_extracted.get("skills") or []) + jd_required))[:80]
    rule_score, missing_skills, matched_skills = rule_based_match_score(resume_extracted, jd_extracted)
    rule_norm = max(0, min(1, rule_score))

    # Hybrid formula
    final_raw = 0.5 * sbert_norm + 0.3 * tfidf_norm + 0.2 * rule_norm
    experience_level = detect_experience_level(resume_text)
    if experience_level == "Junior":
        senior_roles = ["senior", "lead", "manager", "director", "head"]
        if any(role in (job_title or "").lower() for role in senior_roles):
            final_raw -= 0.15
    final_percentage = round(max(0, min(100, final_raw * 100)), 2)

    breakdown = {
        "sbert_score": round(sbert_norm * 100, 2),
        "tfidf_score": round(tfidf_norm * 100, 2),
        "rule_score": round(rule_norm * 100, 2),
        "final_percentage": final_percentage,
    }
    # Missing keywords: use skill gap missing list (limit 15)
    missing_keywords = list(missing_skills)[:15]
    # Important: never use token-diff fallback for "missing keywords".
    # Generic words (e.g., "requirements", "graduate", "JD") can leak in and
    # will look like "missing skills", so we only rely on extracted skills.

    return final_percentage, missing_keywords, experience_level, breakdown, resume_extracted


def extract_missing_keywords(resume_text, jd_text):
    """Return list of missing keywords (for backward compatibility)."""
    _, missing, _, _, _ = calculate_similarity(resume_text, jd_text)
    return missing[:10]


def infer_top_roles(score):
    if score >= 80:
        return ["Top Match", "Highly Qualified"]
    if score >= 50:
        return ["Potential Match", "Skills Alignment"]
    return ["Low Match", "Learning Path"]
