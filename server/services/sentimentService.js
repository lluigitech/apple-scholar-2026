const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:5001';

const mapSentimentValueToLabel = (value) => {
    const normalized = Number(value);
    if (normalized === -1) return 'Negative';
    if (normalized === 1) return 'Positive';
    return 'Neutral';
};

const normalizeSentimentResponse = (payload) => {
    if (!payload || typeof payload !== 'object') return null;

    const sentiment = Number.parseInt(payload.sentiment ?? payload.sentiment_score ?? payload.score ?? 0, 10);
    if (Number.isNaN(sentiment)) return null;

    const label = String(payload.sentiment_label || mapSentimentValueToLabel(sentiment));
    const confidence = typeof payload.confidence === 'number' ? payload.confidence : null;

    return {
        sentiment,
        sentiment_label: label,
        confidence,
    };
};

const normalizeContentScoreResponse = (payload) => {
    if (!payload || typeof payload !== 'object') return null;

    const score = Number(payload.score ?? 0);
    if (Number.isNaN(score)) return null;

    const rawBreakdown = payload.breakdown && typeof payload.breakdown === 'object' ? payload.breakdown : {};
    const breakdown = {
        paragraph: Number(rawBreakdown.paragraph ?? 0),
        academic: Number(rawBreakdown.academic ?? 0),
        self_improvement: Number(rawBreakdown.self_improvement ?? 0),
        family: Number(rawBreakdown.family ?? 0),
        difficulty: Number(rawBreakdown.difficulty ?? 0),
    };

    const qualityLabel = String(payload.quality_label || 'Unknown');

    return {
        score,
        breakdown,
        quality_label: qualityLabel,
        ...(Object.prototype.hasOwnProperty.call(payload, 'flagged')
            ? { flagged: payload.flagged === true }
            : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'flag_reason')
            ? { flag_reason: payload.flag_reason ? String(payload.flag_reason) : null }
            : {}),
    };
};

const predictSentimentForLetter = async (letterText) => {
    if (!letterText || !String(letterText).trim()) return null;

    try {
        const response = await axios.post(`${ML_SERVICE_URL}/predict`, {
            letter_text: String(letterText),
        }, {
            timeout: 2500,
            headers: { 'Content-Type': 'application/json' },
        });

        const prediction = normalizeSentimentResponse(response?.data);
        if (!prediction) {
            console.warn('Sentiment service returned an unreadable payload; continuing submission without sentiment.');
            return null;
        }

        return prediction;
    } catch (err) {
        console.warn('Warning: sentiment prediction service unavailable; continuing submission without sentiment.', err?.message || err);
        return null;
    }
};

const predictContentScoreForLetter = async (letterText) => {
    if (!letterText || !String(letterText).trim()) return null;

    try {
        const response = await axios.post(`${ML_SERVICE_URL}/predict-score`, {
            letter_text: String(letterText),
        }, {
            timeout: 2500,
            headers: { 'Content-Type': 'application/json' },
        });

        console.log('[letter-score-debug] Flask /predict-score call succeeded:', response?.data);

        const prediction = normalizeContentScoreResponse(response?.data);
        if (!prediction) {
            console.warn('Content scoring service returned an unreadable payload; continuing submission without content score fields.');
            return null;
        }

        return {
            ...prediction,
            raw_response: response.data,
        };
    } catch (err) {
        console.warn('[letter-score-debug] Flask /predict-score call failed:', err?.message || err);
        console.warn('Warning: content score prediction service unavailable; continuing submission without content score fields.', err?.message || err);
        return null;
    }
};

module.exports = {
    ML_SERVICE_URL,
    mapSentimentValueToLabel,
    normalizeSentimentResponse,
    normalizeContentScoreResponse,
    predictSentimentForLetter,
    predictContentScoreForLetter,
};
