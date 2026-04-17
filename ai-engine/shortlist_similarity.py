"""
Recruiter shortlist: sort candidates by SBERT similarity between job (title+desc) and candidate profile text.
"""
import torch
from sentence_transformers import SentenceTransformer, util
from config import MODEL_NAME, DEVICE

_model = None


def _get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer(MODEL_NAME, device=DEVICE)
    return _model


def shortlist_by_similarity(job_title, job_description, candidates):
    """
    candidates: list of dicts with "application_id" and "profile_text".
    Returns list of dicts { application_id, score } sorted by score descending.
    """
    if not candidates:
        return []
    job_text = (job_title or "") + " " + (job_description or "")
    job_text = job_text.strip() or " "
    model = _get_model()
    job_emb = model.encode([job_text], convert_to_tensor=True)
    profile_texts = [c.get("profile_text") or " " for c in candidates]
    profile_embs = model.encode(profile_texts, convert_to_tensor=True)
    scores = util.cos_sim(job_emb, profile_embs)[0]
    out = []
    for i, c in enumerate(candidates):
        sc = float(scores[i].cpu().numpy())
        out.append({"application_id": c.get("application_id"), "score": round(sc * 100, 2)})
    out.sort(key=lambda x: x["score"], reverse=True)
    return out
