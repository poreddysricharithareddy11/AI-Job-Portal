"""
Lightweight shortlist using TF-IDF similarity (NO SBERT).
"""
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

vectorizer = TfidfVectorizer(max_features=3000)


def shortlist_by_similarity(job_title, job_description, candidates):
    if not candidates:
        return []

    job_text = ((job_title or "") + " " + (job_description or "")).strip() or " "
    profile_texts = [c.get("profile_text") or " " for c in candidates]

    texts = [job_text] + profile_texts

    try:
        tfidf_matrix = vectorizer.fit_transform(texts)
        scores = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:])[0]
    except Exception:
        scores = [0] * len(profile_texts)

    results = []
    for i, c in enumerate(candidates):
        results.append({
            "application_id": c.get("application_id"),
            "score": round(float(scores[i]) * 100, 2)
        })

    results.sort(key=lambda x: x["score"], reverse=True)
    return results
