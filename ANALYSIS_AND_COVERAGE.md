# AI Job Portal – Analysis & Coverage Report

## 0. Implementation Summary (Done)

- **AI Engine**: Preprocessing (clean, lemmatize, stopwords), rule-based extraction (skills, years, education, certs), hybrid score (0.5 SBERT + 0.3 TF-IDF + 0.2 rule), match breakdown, embedding cache, skill-gap engine and report, Random Forest shortlisting and `/shortlist-rf` endpoint.
- **Backend**: Application model extended with `matchBreakdown`, `yearsExperience`, `educationScore`, `certificationCount`, `shortlistRF`; `analyzeResumeWithAI` passes `job_id` and stores breakdown; new endpoints `POST /api/applications/skill-gap` and `POST /api/applications/shortlist-rf/:jobId` (recruiter only).
- **Frontend**: Tailwind added; Applicant: drag-and-drop resume, preview link, last result with breakdown and extracted skills, Skill Gap modal with matched/missing skills, suggestions, download report; Recruiter: match breakdown per applicant, Run RF Shortlist button, color-coded match %.

---

## 1. What Is Already Implemented

### Resume parsing (`ai-engine/resume_parser.py`)
- **PDF**: PyPDF2 extraction.
- **DOCX**: python-docx extraction.
- **Missing**: No text preprocessing (cleaning, lemmatization, stopwords). No rule-based extraction of skills, years of experience, education, or certifications.

### Skill extraction
- **Current**: In `similarity.py`, `compute_skill_gap()` uses the job description as a comma-separated “required skills” list and does simple token overlap. There is no dedicated skill extraction from the resume text.
- **Missing**: Rule-based extraction (regex + patterns) for skills, years of experience, education, and certifications from the resume.

### Job matching (`ai-engine/similarity.py`)
- **SBERT**: Used for semantic similarity (sentence_transformers).
- **TfidfVectorizer**: Imported but **not used** in the final score (bug).
- **Formula**: Currently `0.5*semantic + 0.3*semantic*0.9 + 0.2*skill_score` — TF-IDF is never applied; the intended hybrid is 0.5 SBERT + 0.3 TF-IDF + 0.2 rule-based.
- **Missing**: Real TF-IDF overlap in the score, proper rule-based match score (years, education, certs), and normalized percentage breakdown.

### UI components
- **Applicant**: Job list, file input (no drag-and-drop), no resume preview, no extracted skills visualization, no color-coded match %, no skill-gap analytics/charts/radar, basic application tracking (list with score).
- **Recruiter**: Post job, list jobs, close job, view applicants sorted by score, hire/reject. No match breakdown, no skill overlap visualization, no analytics dashboard, no bulk/single candidate upload beyond apply flow.

### Recruiter features
- Post job, list jobs, close job, view applicants by score, update status (selected/rejected).
- **Missing**: Random Forest–based shortlisting (currently purely score-based). No match breakdown or skill overlap view.

### Database models
- **Job**: recruiter, title, description, salary, openings, status. No embedding or skills stored.
- **Application**: job, applicant, score, missingKeywords, status. No match breakdown (sbert/tfidf/rule), no ML shortlist flag.
- **User**: role, name, email, password, resume.

### ML logic
- SBERT for semantic similarity.
- TfidfVectorizer present but not used in the final score.
- Simple keyword-based skill gap and junior/senior experience detection with penalty for senior roles.
- **Missing**: TF-IDF in hybrid score, rule-based extraction and rule-based match score, Random Forest shortlisting, embedding cache, and Skill Gap / Resume Improvement engine.

---

## 2. What Is Missing or Incomplete

| Area | Missing / Incomplete |
|------|----------------------|
| **Resume pipeline** | Text preprocessing (clean, lemmatize, stopwords). Rule-based extraction: skills, years of experience, education, certifications. |
| **Hybrid score** | Use TF-IDF overlap (0.5 SBERT + 0.3 TF-IDF + 0.2 rule-based). Return normalized percentage and breakdown. |
| **Skill Gap Engine** | Semantic resume vs JD comparison, missing skills/tools, keyword suggestions, phrasing improvements, matched vs missing skills, downloadable report. |
| **Recruiter ML** | Random Forest shortlisting using features: SBERT, TF-IDF, rule score, years, education, cert count. Shortlist (1) / Reject (0). |
| **Performance** | Embedding cache; store job embeddings; avoid recomputing. |
| **Applicant UI** | Drag-and-drop resume, resume preview, extracted skills, color-coded match %, skill-gap analytics (charts/radar), download report. |
| **Recruiter UI** | Match breakdown per candidate, skill overlap visualization, RF shortlist indicator, analytics dashboard. |
| **Backend** | Application schema extended with match breakdown and RF shortlist; APIs for skill-gap and shortlist-by-RF. |

---

## 3. Implementation Plan (Only Missing / Weak Parts)

1. **AI Engine**: Preprocessing module, rule-based extraction, fix hybrid score (SBERT + TF-IDF + rule), return breakdown; skill-gap endpoint and report; RF shortlist module and endpoint; embedding cache.
2. **Backend**: Extend Application model; aiEngineService for parse, skill-gap, shortlist-RF; new routes.
3. **Frontend**: Applicant – drag-drop, preview, skills viz, color-coded match, skill-gap page and report download. Recruiter – match breakdown, RF shortlist, skill overlap. Add Tailwind (and optionally TypeScript) without breaking existing structure.

This document will be kept in sync as implementations are completed.
