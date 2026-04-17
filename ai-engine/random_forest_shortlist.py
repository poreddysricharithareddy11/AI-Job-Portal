"""
Recruiter-side Random Forest shortlisting.
Feature vector: sbert_score, tfidf_score, rule_score, years_of_experience, education_score, certification_count.
Output: shortlist (1) or reject (0).
"""
import os
import numpy as np
from sklearn.ensemble import RandomForestClassifier
import joblib
from config import BASE_DIR

MODEL_PATH = os.path.join(BASE_DIR, "models", "rf_shortlist.joblib")
os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)

# Default threshold-based "synthetic" training if no model exists
DEFAULT_THRESHOLD = 0.55  # score (0-1) above which we shortlist


def _default_model():
    """Train a simple RF on synthetic data so we have a working model out of the box."""
    np.random.seed(42)
    n = 200
    # Synthetic: high sbert/tfidf/rule -> shortlist
    X = np.random.rand(n, 6)
    X[:, 0] = np.random.rand(n) * 0.5 + 0.3   # sbert
    X[:, 1] = np.random.rand(n) * 0.5 + 0.2   # tfidf
    X[:, 2] = np.random.rand(n) * 0.5 + 0.2   # rule
    X[:, 3] = np.random.rand(n) * 15           # years
    X[:, 4] = np.random.rand(n)                 # education 0/1
    X[:, 5] = np.random.randint(0, 5, n)        # cert count
    # Label: shortlist if weighted score > threshold
    score = 0.5 * X[:, 0] + 0.3 * X[:, 1] + 0.2 * X[:, 2] + 0.05 * np.clip(X[:, 3] / 10, 0, 1)
    y = (score >= DEFAULT_THRESHOLD).astype(int)
    clf = RandomForestClassifier(n_estimators=50, max_depth=6, random_state=42)
    clf.fit(X, y)
    return clf


def load_model():
    if os.path.exists(MODEL_PATH):
        try:
            return joblib.load(MODEL_PATH)
        except Exception:
            pass
    return _default_model()


def get_feature_vector(breakdown, extracted):
    """
    Build 6-d feature vector from analysis result.
    breakdown: { sbert_score, tfidf_score, rule_score } (0-100)
    extracted: { years_of_experience, education, certifications }
    """
    sbert = (breakdown.get("sbert_score") or 0) / 100.0
    tfidf = (breakdown.get("tfidf_score") or 0) / 100.0
    rule = (breakdown.get("rule_score") or 0) / 100.0
    years = float(extracted.get("years_of_experience") or 0)
    education_score = 1.0 if (extracted.get("education")) else 0.0
    cert_count = min(10, len(extracted.get("certifications") or []))
    return np.array([[sbert, tfidf, rule, years, education_score, cert_count]])


def predict_shortlist(feature_vector):
    """Single candidate: feature_vector shape (1, 6). Returns 1 (shortlist) or 0 (reject)."""
    clf = load_model()
    return int(clf.predict(feature_vector)[0])


def predict_shortlist_batch(feature_vectors):
    """Batch: feature_vectors shape (n, 6). Returns list of 0/1."""
    if not len(feature_vectors):
        return []
    clf = load_model()
    X = np.array(feature_vectors)
    return clf.predict(X).astype(int).tolist()


def retrain_from_feedback(features_list, labels_list):
    """
    Retrain RF from recruiter feedback.
    features_list: list of 6-d lists
    labels_list: list of 0/1 (reject/shortlist)
    """
    X = np.array(features_list)
    y = np.array(labels_list)
    if len(X) < 10:
        return False
    clf = RandomForestClassifier(n_estimators=50, max_depth=6, random_state=42)
    clf.fit(X, y)
    joblib.dump(clf, MODEL_PATH)
    return True
