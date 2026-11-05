"""
app.py — Sentiment + Content Scoring Microservice
Apple Scholar 2026 — Correspondence Evaluation Module

Two endpoints:
  POST /predict        -> sentiment (-1/0/1) using sentiment_model.pkl
  POST /predict-score   -> content-based scores (Paragraph, Academic,
                            Self-Improvement, Family, Difficulty) using
                            letter_score_model.pkl

TWO rule-based gates run BEFORE the ML models (no training needed for
either of these — they are plain keyword/length checks):

  GATE 1 — Minimum word count: catches blank/one-word junk ("." or
           "asdf asdf") that the ML model was never trained on and
           would otherwise score too high.

  GATE 2 — Relevance check: catches letters that are long enough to
           pass Gate 1, but don't actually talk about academics,
           family, or school life (e.g. off-topic content, or text
           copy-pasted from somewhere unrelated). The ML model only
           learned writing STYLE, not MEANING, so it can be fooled by
           well-structured but irrelevant text — this keyword check
           catches that.

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

SCORE_COMPONENTS = [
    ("paragraph", 7),
    ("academic", 21),
    ("self_improvement", 14),
    ("family", 7),
    ("difficulty", 21),
]
MAX_CONTENT_TOTAL = sum(max_pts for _, max_pts in SCORE_COMPONENTS)  # 70
SCALE_FACTOR = 100 / MAX_CONTENT_TOTAL

# ── GATE 1 settings ──
MIN_WORD_COUNT = 50

# ── GATE 2 settings — relevance keywords, rule-based, no training needed ──
RELEVANT_KEYWORDS = [
    "grade", "grades", "school", "subject", "subjects", "exam", "exams",
    "quiz", "quizzes", "study", "studies", "studying", "teacher", "professor",
    "class", "classes", "academic", "academics", "scholarship", "college",
    "course", "requirement", "requirements", "assignment", "assignments",
    "project", "thesis", "parent", "parents", "mother", "father", "sibling",
    "siblings", "family", "kalinga", "difficulty", "difficulties", "struggle",
    "struggling", "challenge", "challenges", "semester", "quarter", "lesson",
    "lessons", "review", "reviewing",
]

# Require relevant keyword DENSITY relative to letter length, not just a flat
# count — a long letter needs proportionally more relevant words, so an
# off-topic wall of text with a couple of incidental matches won't slip
# through just because it's long.
MIN_KEYWORD_DENSITY = 0.015  # at least 1 relevant word per ~65 words
MIN_RELEVANT_KEYWORD_HITS = 3  # absolute floor, still applies to short text

# Patterns/words that suggest the text is NOT a real letter at all — code,
# technical discussion, formatting artifacts, pasted chat/documentation —
# regardless of topic. If several of these show up, flag it even if it
# happens to also contain a few relevant keywords.
SUSPICIOUS_MARKERS = [
    "```", "def ", "function", "import ", "console.log", ".py", ".js",
    "app.py", "endpoint", "api/", "http://", "https://", "json", "config",
    "training", "retrain", "dataset", "algorithm", "model", "score_",
    "  |  ", "| ---", "**", "###", "readme", "copilot", "chatgpt",
]
SUSPICIOUS_MARKER_THRESHOLD = 3


def word_count(text):
    return len(text.strip().split())


def check_relevance(text):
    """Rule-based checks — no ML/training involved.

    Returns (is_relevant: bool, details: dict) so the caller can build a
    clear flag_reason from whichever check failed.
    """
    text_lower = text.lower()
    wc = max(word_count(text), 1)

    keyword_hits = sum(1 for kw in RELEVANT_KEYWORDS if kw in text_lower)
    density = keyword_hits / wc

    suspicious_hits = sum(1 for marker in SUSPICIOUS_MARKERS if marker in text_lower)

    details = {
        "keyword_hits": keyword_hits,
        "keyword_density": round(density, 4),
        "suspicious_hits": suspicious_hits,
    }

    # Fails if too few relevant keywords for the length AND below the floor
    density_ok = keyword_hits >= MIN_RELEVANT_KEYWORD_HITS and density >= MIN_KEYWORD_DENSITY
    # Fails if it looks like code/technical/pasted-chat content, regardless
    # of incidental relevant keyword matches
    too_suspicious = suspicious_hits >= SUSPICIOUS_MARKER_THRESHOLD

    if too_suspicious:
        return False, details
    if not density_ok:
        return False, details
    return True, details


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
    data = request.get_json(silent=True) or {}
    letter_text = data.get("letter_text", "").strip()

    if not letter_text:
        return jsonify({"error": "letter_text is required"}), 400

    wc = word_count(letter_text)
    if wc < MIN_WORD_COUNT:
        return jsonify({
            "sentiment": 0,
            "sentiment_label": "Neutral",
            "confidence": None,
            "flagged": True,
            "flag_reason": f"Letter is too short ({wc} words, minimum {MIN_WORD_COUNT}) for reliable sentiment analysis.",
        })

    is_relevant, details = check_relevance(letter_text)
    if not is_relevant:
        if details["suspicious_hits"] >= SUSPICIOUS_MARKER_THRESHOLD:
            reason = "Content looks like code, technical text, or pasted chat/documentation rather than a personal letter."
        else:
            reason = f"Content does not appear to be a genuine academic/personal update (only {details['keyword_hits']} relevant keyword(s) found)."
        return jsonify({
            "sentiment": 0,
            "sentiment_label": "Neutral",
            "confidence": None,
            "flagged": True,
            "flag_reason": reason,
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
    data = request.get_json(silent=True) or {}
    letter_text = data.get("letter_text", "").strip()

    if not letter_text:
        return jsonify({"error": "letter_text is required"}), 400

    wc = word_count(letter_text)
    zero_breakdown = {label: 0 for label, _ in SCORE_COMPONENTS}

    # ── GATE 1: too short ──
    if wc < MIN_WORD_COUNT:
        return jsonify({
            "score": 0,
            "breakdown": zero_breakdown,
            "quality_label": "Non-Compliant",
            "flagged": True,
            "flag_reason": f"Letter is too short ({wc} words, minimum {MIN_WORD_COUNT}) to be evaluated. Please write a complete monthly report.",
            "note": "Information/Document/Caption scores not included — add separately from database + file-upload checks",
        })

    # ── GATE 2: not relevant to an academic/personal update, or looks
    # like code/technical/pasted content ──
    is_relevant, details = check_relevance(letter_text)
    if not is_relevant:
        if details["suspicious_hits"] >= SUSPICIOUS_MARKER_THRESHOLD:
            reason = "Content looks like code, technical text, or pasted chat/documentation rather than a personal letter. Please submit your own monthly report."
        else:
            reason = f"Content does not appear to be a genuine academic/personal update (only {details['keyword_hits']} relevant keyword(s) found, minimum {MIN_RELEVANT_KEYWORD_HITS} required). Please write about your academic progress, family, or challenges this month."
        return jsonify({
            "score": 0,
            "breakdown": zero_breakdown,
            "quality_label": "Non-Compliant",
            "flagged": True,
            "flag_reason": reason,
            "note": "Information/Document/Caption scores not included — add separately from database + file-upload checks",
        })

    # ── Passed both gates — safe to use the ML model ──
    vec = score_vectorizer.transform([letter_text])
    raw_pred = np.clip(score_model.predict(vec)[0], 0, None)

    breakdown = {}
    for i, (label, max_pts) in enumerate(SCORE_COMPONENTS):
        bounded_score = min(float(raw_pred[i]), max_pts)
        breakdown[label] = int(np.floor(bounded_score + 0.5))

    content_total = sum(breakdown.values())
    scaled_score = int(np.floor(content_total * SCALE_FACTOR + 0.5))

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
    return jsonify({
        "status": "ok",
        "sentiment_model_loaded": sentiment_model is not None,
        "score_model_loaded": score_model is not None,
        "min_word_count": MIN_WORD_COUNT,
        "min_relevant_keyword_hits": MIN_RELEVANT_KEYWORD_HITS,
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
