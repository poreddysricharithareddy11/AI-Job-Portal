from flask import Flask, request, jsonify
try:
    # Optional: Node calls this service server-to-server, so CORS is not required
    # for the core functionality. Make it optional so the server can still start.
    from flask_cors import CORS
except ModuleNotFoundError:
    CORS = None
import os
import uuid
from config import UPLOAD_FOLDER
from utils import ensure_dir, safe_delete
from resume_parser import extract_resume_text
from similarity import calculate_similarity, infer_top_roles
from rule_extraction import extract_all
from skill_gap_engine import compute_skill_gap_report
from random_forest_shortlist import get_feature_vector, predict_shortlist_batch
from shortlist_similarity import shortlist_by_similarity

app = Flask(__name__)
if CORS:
    CORS(app)
ensure_dir(UPLOAD_FOLDER)


def _save_upload(files_key="resume"):
    file = request.files.get(files_key)
    if not file:
        return None, None
    filename = f"{uuid.uuid4()}_{file.filename}"
    temp_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(temp_path)
    return temp_path, filename


@app.route("/analyze", methods=["POST"])
def analyze():
    temp_path = None
    try:
        resume_file = request.files.get("resume")
        job_desc = request.form.get("job_description", "")
        job_title = request.form.get("job_title", "")
        job_id = request.form.get("job_id", "").strip() or None

        if not resume_file:
            return jsonify({"error": "No resume provided"}), 400

        filename = f"{uuid.uuid4()}_{resume_file.filename}"
        temp_path = os.path.join(UPLOAD_FOLDER, filename)
        resume_file.save(temp_path)

        text = extract_resume_text(temp_path)
        if not text:
            return jsonify({
                "match_percentage": 0,
                "missing_keywords": [],
                "experience_level": "Unknown",
                "match_breakdown": {},
                "extracted": {},
                "top_roles": [],
            })

        score, missing, exp, breakdown, extracted = calculate_similarity(
            text, job_desc, job_title, job_id=job_id
        )
        top_roles = infer_top_roles(score)

        return jsonify({
            "match_percentage": score,
            "missing_keywords": missing,
            "experience_level": exp,
            "top_roles": top_roles,
            "match_breakdown": breakdown,
            "extracted": {
                "skills": extracted.get("skills", []),
                "years_of_experience": extracted.get("years_of_experience", 0),
                "education": extracted.get("education", []),
                "certifications": extracted.get("certifications", []),
            },
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if temp_path:
            safe_delete(temp_path)


@app.route("/parse", methods=["POST"])
def parse_resume():
    """Resume-only parsing: returns extracted fields (skills, years, education, certifications)."""
    temp_path = None
    try:
        resume_file = request.files.get("resume")
        if not resume_file:
            return jsonify({"error": "No resume provided"}), 400

        filename = f"{uuid.uuid4()}_{resume_file.filename}"
        temp_path = os.path.join(UPLOAD_FOLDER, filename)
        resume_file.save(temp_path)

        text = extract_resume_text(temp_path)
        if not text:
            return jsonify({"extracted": {"skills": [], "years_of_experience": 0, "education": [], "certifications": []}})

        extracted = extract_all(text)
        return jsonify({
            "extracted": {
                "skills": extracted.get("skills", []),
                "years_of_experience": extracted.get("years_of_experience", 0),
                "education": extracted.get("education", []),
                "certifications": extracted.get("certifications", []),
            },
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if temp_path:
            safe_delete(temp_path)


@app.route("/skill-gap", methods=["POST"])
def skill_gap():
    """Resume vs job description: skill gap report and improvement suggestions."""
    temp_path = None
    try:
        resume_file = request.files.get("resume")
        job_desc = request.form.get("job_description", "")
        job_title = request.form.get("job_title", "")

        if not resume_file:
            return jsonify({"error": "No resume provided"}), 400

        filename = f"{uuid.uuid4()}_{resume_file.filename}"
        temp_path = os.path.join(UPLOAD_FOLDER, filename)
        resume_file.save(temp_path)

        text = extract_resume_text(temp_path)
        if not text:
            return jsonify({
                "matched_skills": [],
                "missing_skills": [],
                "missing_tools_frameworks": [],
                "suggested_keywords": [],
                "phrasing_suggestions": [],
                "report_text": "Could not extract text from resume.",
            })

        report = compute_skill_gap_report(text, job_desc or "", job_title or "")
        return jsonify(report)

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if temp_path:
            safe_delete(temp_path)


@app.route("/shortlist-by-similarity", methods=["POST"])
def shortlist_by_sim():
    """
    Sort candidates by SBERT similarity (job vs profile text).
    POST JSON: { "job_title": "", "job_description": "", "candidates": [ { "application_id": "...", "profile_text": "..." }, ... ] }
    Returns: { "order": [ { application_id, score }, ... ] sorted by score desc }
    """
    try:
        data = request.get_json() or {}
        job_title = data.get("job_title", "")
        job_description = data.get("job_description", "")
        candidates = data.get("candidates", [])
        result = shortlist_by_similarity(job_title, job_description, candidates)
        return jsonify({"order": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/shortlist-rf", methods=["POST"])
def shortlist_rf():
    """
    POST JSON: { "candidates": [ { "breakdown": { sbert_score, tfidf_score, rule_score }, "extracted": { years_of_experience, education, certifications } }, ... ] }
    Returns: { "shortlist": [ 0|1, ... ] }
    """
    try:
        data = request.get_json() or {}
        candidates = data.get("candidates", [])
        if not candidates:
            return jsonify({"shortlist": []})

        vectors = []
        for c in candidates:
            breakdown = c.get("breakdown") or {}
            extracted = c.get("extracted") or {}
            vec = get_feature_vector(breakdown, extracted)
            vectors.append(vec[0].tolist())

        shortlist = predict_shortlist_batch(vectors)
        return jsonify({"shortlist": shortlist})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(port=8000)
