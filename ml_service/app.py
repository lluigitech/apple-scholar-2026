"""
app.py — Sentiment + Content Scoring Microservice
Apple Scholar 2026 — Correspondence Evaluation Module

Two endpoints:
  POST /predict        -> sentiment (-1/0/1) using sentiment_model.pkl
  POST /predict-score   -> content-based scores (Paragraph, Academic,
                            Self-Improvement, Family, Difficulty) using
                            letter_score_model.pkl

HOW TO RUN:
1. Put this file in the same folder as ALL FOUR of these:
     - sentiment_model.pkl
     - tfidf_vectorizer.pkl
     - letter_score_model.pkl
     - tfidf_vectorizer_regression.pkl
2. Install dependencies:  pip install -r requirements.txt
3. Run:  python app.py
4. It will start on http://localhost:5001
"""

from flask import Flask, request, jsonify
import joblib
import os
import numpy as np

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ── Load sentiment model ──
sentiment_model = joblib.load(os.path.join(BASE_DIR, "sentiment_model.pkl"))
sentiment_vectorizer = joblib.load(os.path.join(BASE_DIR, "tfidf_vectorizer.pkl"))

# ── Load regression (content scoring) model ──
score_model = joblib.load(os.path.join(BASE_DIR, "letter_score_model.pkl"))
score_vectorizer = joblib.load(os.path.join(BASE_DIR, "tfidf_vectorizer_regression.pkl"))

SENTIMENT_LABELS = {1: "Positive", 0: "Neutral", -1: "Negative"}

# Score component order must match how the regression model was trained
SCORE_COMPONENTS = [
    ("paragraph", 7),
    ("academic", 21),
    ("self_improvement", 14),
    ("family", 7),
    ("difficulty", 21),
]
MAX_CONTENT_TOTAL = sum(max_pts for _, max_pts in SCORE_COMPONENTS)  # 70
SCALE_FACTOR = 100 / MAX_CONTENT_TOTAL


def quality_label(score_100):
    if score_100 >= 90:
        return "Excellent"
    elif score_100 >= 75:
        return "Good"
    elif score_100 >= 50:
        return "Needs Improvement"
    else:
        return "Non-Compliant"


@app.route("/predict", methods=["POST"])
def predict_sentiment():
    """
    Expects JSON body: { "letter_text": "..." }
    Returns: { "sentiment": -1|0|1, "sentiment_label": "...", "confidence": 0.0-1.0 }
    """
    data = request.get_json(silent=True) or {}
    letter_text = data.get("letter_text", "").strip()

    if not letter_text:
        return jsonify({"error": "letter_text is required"}), 400

    vec = sentiment_vectorizer.transform([letter_text])
    prediction = int(sentiment_model.predict(vec)[0])

    confidence = None
    if hasattr(sentiment_model, "predict_proba"):
        proba = sentiment_model.predict_proba(vec)[0]
        classes = list(sentiment_model.classes_)
        confidence = float(proba[classes.index(prediction)])

    return jsonify({
        "sentiment": prediction,
        "sentiment_label": SENTIMENT_LABELS.get(prediction, "Unknown"),
        "confidence": confidence,
    })


@app.route("/predict-score", methods=["POST"])
def predict_score():
    """
    Expects JSON body: { "letter_text": "..." }
    Returns:
    {
      "score": 88,
      "breakdown": {
        "paragraph": 6,
        "academic": 20,
        "self_improvement": 12,
        "family": 6,
        "difficulty": 18
      },
      "quality_label": "Good",
      "note": "Information/Document/Caption scores not included..."
    }
    """
    data = request.get_json(silent=True) or {}
    letter_text = data.get("letter_text", "").strip()

    if not letter_text:
        return jsonify({"error": "letter_text is required"}), 400

    vec = score_vectorizer.transform([letter_text])
    raw_pred = np.clip(score_model.predict(vec)[0], 0, None)

    breakdown = {}
    for i, (label, max_pts) in enumerate(SCORE_COMPONENTS):
        breakdown[label] = round(min(float(raw_pred[i]), max_pts), 1)

    content_total = sum(breakdown.values())
    scaled_score = round(content_total * SCALE_FACTOR)

    return jsonify({
        "score": scaled_score,
        "breakdown": breakdown,
        "quality_label": quality_label(scaled_score),
        "note": "Information/Document/Caption scores not included — add separately from database + file-upload checks",
    })


@app.route("/health", methods=["GET"])
def health():
    """Confirms the service is running and both models loaded fine."""
    return jsonify({
        "status": "ok",
        "sentiment_model_loaded": sentiment_model is not None,
        "score_model_loaded": score_model is not None,
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
