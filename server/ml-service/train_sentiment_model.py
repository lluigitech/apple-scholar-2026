"""
train_sentiment_model.py
Apple Scholar 2026 — Correspondence Sentiment Classifier
Trains on DATASETS_1_-_FINAL_DATASETS.csv (Letter_Text -> Sentiment_Label)
"""

import csv
import re
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

# ── 1. Load the raw CSV (skip the 3 merged header rows) ──
RAW_PATH = "DATASETS_1_-_FINAL_DATASETS__1_.csv"

with open(RAW_PATH, newline="", encoding="utf-8-sig") as fh:
    reader = csv.reader(fh)
    rows = list(reader)

header = rows[2]
data = [r for r in rows[3:] if any(c.strip() for c in r)]

df = pd.DataFrame(data, columns=header)
print(f"Loaded {len(df)} rows.")

# ── 2. Basic cleaning ──
def clean_text(text):
    text = text.replace("\n", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()

df["Letter_Text"] = df["Letter_Text"].apply(clean_text)
df["Sentiment_Label"] = df["Sentiment_Label"].astype(str).str.strip().astype(int)

# Drop any rows that still have blank text (safety net)
df = df[df["Letter_Text"].str.len() > 0].reset_index(drop=True)
print(f"After cleaning: {len(df)} rows.")
print("Sentiment distribution:\n", df["Sentiment_Label"].value_counts())

X = df["Letter_Text"]
y = df["Sentiment_Label"]

# ── 3. Stratified train/test split ──
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
print(f"\nTrain size: {len(X_train)}, Test size: {len(X_test)}")

# ── 4. TF-IDF vectorization ──
vectorizer = TfidfVectorizer(
    max_features=3000,
    ngram_range=(1, 2),
    min_df=2,
)
X_train_vec = vectorizer.fit_transform(X_train)
X_test_vec = vectorizer.transform(X_test)

# ── 5. Train two candidate models ──
print("\n" + "=" * 60)
print("MODEL 1: Logistic Regression (class_weight='balanced')")
print("=" * 60)
logreg = LogisticRegression(max_iter=1000, class_weight="balanced")
logreg.fit(X_train_vec, y_train)
y_pred_lr = logreg.predict(X_test_vec)

print(f"Accuracy: {accuracy_score(y_test, y_pred_lr):.3f}")
print(classification_report(y_test, y_pred_lr, target_names=["Negative(-1)", "Neutral(0)", "Positive(1)"]))
print("Confusion Matrix (rows=actual, cols=predicted, order -1,0,1):")
print(confusion_matrix(y_test, y_pred_lr, labels=[-1, 0, 1]))

print("\n" + "=" * 60)
print("MODEL 2: Multinomial Naive Bayes")
print("=" * 60)
# Naive Bayes needs non-negative counts; TF-IDF output works fine with MultinomialNB
nb = MultinomialNB()
nb.fit(X_train_vec, y_train)
y_pred_nb = nb.predict(X_test_vec)

print(f"Accuracy: {accuracy_score(y_test, y_pred_nb):.3f}")
print(classification_report(y_test, y_pred_nb, target_names=["Negative(-1)", "Neutral(0)", "Positive(1)"]))
print("Confusion Matrix (rows=actual, cols=predicted, order -1,0,1):")
print(confusion_matrix(y_test, y_pred_nb, labels=[-1, 0, 1]))

# ── 6. Pick the better model (by macro F1, fairer under imbalance) ──
from sklearn.metrics import f1_score
f1_lr = f1_score(y_test, y_pred_lr, average="macro")
f1_nb = f1_score(y_test, y_pred_nb, average="macro")
print(f"\nMacro F1 — Logistic Regression: {f1_lr:.3f} | Naive Bayes: {f1_nb:.3f}")

best_model, best_name = (logreg, "logistic_regression") if f1_lr >= f1_nb else (nb, "naive_bayes")
print(f"Selected best model: {best_name}")

# ── 7. Save model + vectorizer ──
joblib.dump(best_model, "sentiment_model.pkl")
joblib.dump(vectorizer, "tfidf_vectorizer.pkl")
print("\nSaved sentiment_model.pkl and tfidf_vectorizer.pkl")

# ── 8. Quick sanity check with a sample prediction ──
sample_letters = [
    "I am doing well this month, my grades improved and my family is proud of me.",
    "I did not submit anything this month, nothing happened.",
    "Things have been very difficult, I am struggling with my finances and my studies.",
]
sample_vec = vectorizer.transform(sample_letters)
preds = best_model.predict(sample_vec)
print("\nSample predictions:")
for text, pred in zip(sample_letters, preds):
    label = {1: "Positive", 0: "Neutral", -1: "Negative"}[pred]
    print(f"  [{label}] {text[:60]}...")
