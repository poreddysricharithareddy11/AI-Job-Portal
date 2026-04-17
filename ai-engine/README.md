# AI Engine Service

Flask service for resume parsing, hybrid matching (SBERT + TF-IDF + rule-based), skill-gap analysis, and Random Forest shortlisting.

## Run

1. `cd ai-engine`
2. `venv\Scripts\activate` (Windows) or `source venv/bin/activate` (Linux/Mac)
3. `pip install -r requirements.txt`
4. `python app.py`

Service: **http://localhost:8000**

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/analyze` | Analyze resume vs job. Form: `resume` (file), `job_description`, `job_title`, optional `job_id`. Returns match %, breakdown (SBERT/TF-IDF/rule), extracted skills/years/education/certs. |
| POST | `/parse` | Parse resume only. Form: `resume` (file). Returns extracted fields. |
| POST | `/skill-gap` | Skill gap report. Form: `resume` (file), `job_description`, `job_title`. Returns matched/missing skills, suggestions, `report_text` for download. |
| POST | `/shortlist-rf` | Random Forest shortlist. JSON: `{ "candidates": [ { "breakdown": { sbert_score, tfidf_score, rule_score }, "extracted": { years_of_experience, education, certifications } }, ... ] }`. Returns `{ "shortlist": [ 0|1, ... ] }`. |

## Pipeline

- **Resume parsing**: PDF (PyPDF2), DOCX (python-docx).
- **Preprocessing**: Clean, tokenize, stopwords, lemmatization (NLTK optional).
- **Rule extraction**: Skills, years of experience, education, certifications (regex + patterns).
- **Hybrid score**: `0.5 × SBERT + 0.3 × TF-IDF + 0.2 × rule`, normalized to 0–100%.
- **Embeddings**: Cached by job_id or job description hash.
- **RF shortlist**: 6 features (sbert, tfidf, rule, years, education, cert_count); outputs shortlist (1) or reject (0).
