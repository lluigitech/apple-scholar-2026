#!/usr/bin/env python
import sys
import json
import os
import re
import joblib

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(MODEL_DIR, 'letter_score_regressor.pkl')
VECTORIZER_PATH = os.path.join(MODEL_DIR, 'letter_score_tfidf.pkl')


def clean_text(text):
    text = str(text or '')
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    text = text.replace('\u00a0', ' ')

    lines = []
    for line in text.split('\n'):
        s = re.sub(r'\s+', ' ', line.strip())
        if not s:
            continue
        if re.match(r'^(Name|Age|Year Level|Year Level & Section|Strand|School|Course|Date)\s*:', s, flags=re.I):
            continue
        if re.match(r'^(Dear Kalinga|A pleasant day!|Good day!|Respectfully|Sincerely|Yours truly|Warmly|With gratitude|Thank you)', s, flags=re.I):
            continue
        if re.match(r'^(May God bless you|May you.*|This letter.*|Thank you.*)', s, flags=re.I):
            continue
        lines.append(s)

    text = '\n'.join(lines)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def load_probe():
    return os.path.exists(MODEL_PATH) and os.path.exists(VECTORIZER_PATH)


def main():
    if len(sys.argv) > 1 and sys.argv[1] == '--load':
        try:
            print(json.dumps({'loaded': load_probe()}))
            return
        except Exception as exc:
            print(json.dumps({'loaded': False, 'error': str(exc)}))
            return

    raw = sys.stdin.read() or ''
    if not raw:
        raw = ' '.join(sys.argv[1:]) if len(sys.argv) > 1 else ''

    text = clean_text(raw)
    if not text:
        print(json.dumps({
            'score': None,
            'quality_status': 'high_risk',
            'quality_label': 'Model Offline',
            'fallback': True,
            'breakdown': {'date': 5, 'body': 0, 'attachments': 0, 'caption': 0},
        }))
        return

    if not load_probe():
        print(json.dumps({
            'score': None,
            'quality_status': 'high_risk',
            'quality_label': 'Model Offline',
            'fallback': True,
            'breakdown': {'date': 5, 'body': 0, 'attachments': 0, 'caption': 0},
        }))
        return

    model = joblib.load(MODEL_PATH)
    vectorizer = joblib.load(VECTORIZER_PATH)
    vec = vectorizer.transform([text])
    score = float(model.predict(vec)[0])
    score = max(0, min(100, round(score, 2)))

    breakdown = {
        'date': 5,
        'body': 49,
        'attachments': 20,
        'caption': 13,
    }

    if score >= 90:
        quality_label = 'Excellent Quality'
        quality_status = 'low_risk'
    elif score >= 75:
        quality_label = 'Good Quality'
        quality_status = 'low_risk'
    elif score >= 50:
        quality_label = 'Needs Improvement'
        quality_status = 'medium_risk'
    else:
        quality_label = 'Non-Compliant'
        quality_status = 'high_risk'

    print(json.dumps({
        'score': score,
        'quality_status': quality_status,
        'quality_label': quality_label,
        'breakdown': breakdown,
    }))

if __name__ == '__main__':
    main()
