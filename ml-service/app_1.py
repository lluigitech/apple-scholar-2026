"""
app.py — Sentiment + Content Scoring Microservice
Apple Scholar 2026 — Correspondence Evaluation Module

Two endpoints:
  POST /predict        -> sentiment (-1/0/1) using sentiment_model.pkl
  POST /predict-score   -> content-based scores (Paragraph, Academic,
                            Self-Improvement, Family, Difficulty) using
                            letter_score_model.pkl

NEW: Both endpoints now run a minimum word-count check FIRST. If the
letter is too short (below MIN_WORD_COUNT), the models are not called
at all — a low/zero score is returned immediately. This prevents junk
input ("." or "asdf asdf") from getting an inflated score, which
happens because the ML models were never trained on near-empty text
and fall back to an "average" prediction when given one.

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

# ── NEW: minimum word count before we trust the ML model at all ──
# Below this, the letter is too thin for the regression/sentiment models
# to have learned anything meaningful (they were trained on much longer
# real letters), so we short-circuit with a flat low score instead of
# letting the model guess.
MIN_WORD_COUNT = 50


def quality_label(score_100):
    if score_100 >= 90:
        return "Excellent"
    elif score_100 >= 75:
        return "Good"
    elif score_100 >= 50:
        return "Needs Improvement"
    else:
        return "Non-Compliant"


def word_count(text):
    return len(text.strip().split())


@app.route("/predict", methods=["POST"])
def predict_sentiment():
    """
    Expects JSON body: { "letter_text": "..." }
    Returns: { "sentiment": -1|0|1, "sentiment_label": "...", "confidence": 0.0-1.0, "flagged": bool, "flag_reason": str|null }
    """
    data = request.get_json(silent=True) or {}
    letter_text = data.get("letter_text", "").strip()

    if not letter_text:
        return jsonify({"error": "letter_text is required"}), 400

    wc = word_count(letter_text)
    if wc < MIN_WORD_COUNT:
        # Too short to trust the sentiment model — return Neutral with a flag
        # rather than letting the model guess on near-empty input.
        return jsonify({
            "sentiment": 0,
            "sentiment_label": "Neutral",
            "confidence": None,
            "flagged": True,
            "flag_reason": f"Letter is too short ({wc} words, minimum {MIN_WORD_COUNT}) for reliable sentiment analysis.",
        })

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
        "flagged": False,
        "flag_reason": None,
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
      "flagged": false,
      "flag_reason": null,
      "note": "Information/Document/Caption scores not included..."
    }
    """
    data = request.get_json(silent=True) or {}
    letter_text = data.get("letter_text", "").strip()

    if not letter_text:
        return jsonify({"error": "letter_text is required"}), 400

    wc = word_count(letter_text)

    # ── HARD GATE: too short → skip the ML model entirely ──
    if wc < MIN_WORD_COUNT:
        zero_breakdown = {label: 0 for label, _ in SCORE_COMPONENTS}
        return jsonify({
            "score": 0,
            "breakdown": zero_breakdown,
            "quality_label": "Non-Compliant",
            "flagged": True,
            "flag_reason": f"Letter is too short ({wc} words, minimum {MIN_WORD_COUNT}) to be evaluated. Please write a complete monthly report.",
            "note": "Information/Document/Caption scores not included — add separately from database + file-upload checks",
        })

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
        "flagged": False,
        "flag_reason": None,
        "note": "Information/Document/Caption scores not included — add separately from database + file-upload checks",
    })


@app.route("/health", methods=["GET"])
def health():
    """Confirms the service is running and both models loaded fine."""
    return jsonify({
        "status": "ok",
        "sentiment_model_loaded": sentiment_model is not None,
        "score_model_loaded": score_model is not None,
        "min_word_count": MIN_WORD_COUNT,
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
