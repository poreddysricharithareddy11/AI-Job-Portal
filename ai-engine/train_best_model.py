"""
Train best model (Logistic / Random Forest / SBERT) on CSV data.
Saves TF-IDF + best classifier + SBERT choice for use in matching.
Run once: python train_best_model.py
"""
import os
import pandas as pd
import numpy as np
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
from sklearn.metrics.pairwise import cosine_similarity

from config import DATA_DIR, MODELS_DIR, MODEL_NAME

os.makedirs(MODELS_DIR, exist_ok=True)

CANDIDATES_CSV = os.path.join(DATA_DIR, "candidate_template_final.csv")
JOBS_CSV = os.path.join(DATA_DIR, "job_descriptions_final_india.csv")


def detect_column(df, keywords):
    for col in df.columns:
        for key in keywords:
            if key in col.lower():
                return col
    return None


def load_and_merge():
    if not os.path.exists(CANDIDATES_CSV) or not os.path.exists(JOBS_CSV):
        print("CSV files not found. Skipping training.")
        return None, None, None
    candidates = pd.read_csv(CANDIDATES_CSV)
    jobs = pd.read_csv(JOBS_CSV, encoding="latin1")
    candidates.columns = candidates.columns.str.strip()
    jobs.columns = jobs.columns.str.strip()

    job_skill_col = detect_column(jobs, ["skill"])
    job_desc_col = detect_column(jobs, ["description"])
    job_title_col = detect_column(jobs, ["title"])
    cand_skill_col = detect_column(candidates, ["skill"])
    cand_exp_col = detect_column(candidates, ["experience"])

    if not all([job_skill_col, job_desc_col, job_title_col, cand_skill_col]):
        print("Required columns not found in CSVs.")
        return None, None, None

    jobs[job_skill_col] = jobs[job_skill_col].astype(str)
    jobs[job_desc_col] = jobs[job_desc_col].astype(str)
    jobs[job_title_col] = jobs[job_title_col].astype(str)
    candidates[cand_skill_col] = candidates[cand_skill_col].astype(str)
    candidates[cand_exp_col] = candidates[cand_exp_col].astype(str)

    jobs["text"] = jobs[job_skill_col] + " " + jobs[job_desc_col]
    candidates["text"] = candidates[cand_skill_col] + " " + candidates[cand_exp_col].fillna("")

    X = jobs["text"]
    y = jobs[job_title_col]
    return X, y, (jobs, candidates, job_title_col, cand_skill_col)


def train_and_save():
    X, y, meta = load_and_merge()
    if X is None:
        return

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    tfidf = TfidfVectorizer(stop_words="english", max_features=5000, ngram_range=(1, 2))
    X_train_tfidf = tfidf.fit_transform(X_train)
    X_test_tfidf = tfidf.transform(X_test)

    lr = LogisticRegression(max_iter=1000)
    lr.fit(X_train_tfidf, y_train)
    lr_acc = accuracy_score(y_test, lr.predict(X_test_tfidf))

    rf = RandomForestClassifier(n_estimators=200, random_state=42)
    rf.fit(X_train_tfidf, y_train)
    rf_acc = accuracy_score(y_test, rf.predict(X_test_tfidf))

    # SBERT: encode and nearest-neighbor
    try:
        from sentence_transformers import SentenceTransformer
        sbert = SentenceTransformer(MODEL_NAME)
        train_emb = sbert.encode(X_train.tolist())
        test_emb = sbert.encode(X_test.tolist())
        correct = 0
        for i in range(len(test_emb)):
            sims = cosine_similarity([test_emb[i]], train_emb)[0]
            best_idx = np.argmax(sims)
            if y_train.iloc[best_idx] == y_test.iloc[i]:
                correct += 1
        sbert_acc = correct / len(test_emb)
    except Exception as e:
        print("SBERT eval failed:", e)
        sbert_acc = 0.0

    accuracies = {"Logistic": lr_acc, "RandomForest": rf_acc, "SBERT": sbert_acc}
    best_name = max(accuracies, key=accuracies.get)
    print("Accuracies:", accuracies)
    print("Best model:", best_name, round(accuracies[best_name], 4))

    joblib.dump(tfidf, os.path.join(MODELS_DIR, "tfidf.joblib"))
    joblib.dump(best_name, os.path.join(MODELS_DIR, "best_model_name.joblib"))
    if best_name == "Logistic":
        joblib.dump(lr, os.path.join(MODELS_DIR, "classifier.joblib"))
    else:
        joblib.dump(rf, os.path.join(MODELS_DIR, "classifier.joblib"))
    print("Saved to", MODELS_DIR)


if __name__ == "__main__":
    train_and_save()
