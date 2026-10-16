const { spawnSync } = require('child_process');
const path = require('path');

const MODEL_DIR = path.resolve(__dirname, '..', 'ml-service');
const PYTHON_BIN = process.env.PYTHON_BIN || 'python';
const PREDICTOR_SCRIPT = path.resolve(MODEL_DIR, 'predict_letter_score.py');
const MODEL_PATH = path.resolve(MODEL_DIR, 'letter_score_regressor.pkl');
const VECTORIZER_PATH = path.resolve(MODEL_DIR, 'letter_score_tfidf.pkl');

let modelLoaded = false;

const clampScore = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.max(0, Math.min(100, parsed));
};

const loadModelAtStartup = () => {
    if (!MODEL_PATH || !VECTORIZER_PATH) return false;
    try {
        const result = spawnSync(PYTHON_BIN, [PREDICTOR_SCRIPT, '--load'], {
            cwd: MODEL_DIR,
            encoding: 'utf8',
            timeout: 5000,
        });
        if (result?.status === 0) {
            modelLoaded = true;
            console.log('[score-model] model artifacts loaded from startup');
            return true;
        }
        console.warn('[score-model] model preload failed:', result?.stderr || result?.stdout || result?.error || 'unknown');
        return false;
    } catch (err) {
        console.warn('[score-model] model preload error:', err?.message || err);
        return false;
    }
};

const stripTemplateText = (letterText) => {
    return String(letterText || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\u00a0/g, ' ')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .filter((line) => !/^Name\s*:/i.test(line))
        .filter((line) => !/^Year\s*:/i.test(line))
        .filter((line) => !/^Course\s*:/i.test(line))
        .filter((line) => !/^School\s*:/i.test(line))
        .filter((line) => !/^Date\s*:/i.test(line))
        .filter((line) => !/^Dear\s+Kalingan\s+Foundation\s*$/i.test(line))
        .filter((line) => !/^Dear\s+Kalinga\s*$/i.test(line))
        .filter((line) => !/^Respectfully\s+yours\s*$/i.test(line))
        .join('\n')
        .trim();
};

const extractScholarLetterBody = (letterText) => {
    const raw = stripTemplateText(letterText || '');
    if (!raw) return '';

    const lines = raw
        .replace(/\n{2,}/g, '\n')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    const dearIndex = lines.findIndex((line) => /^Dear\b/i.test(line));
    if (dearIndex === -1) return raw;

    const endIndex = lines.findIndex((line) => /^Respectfully\s+yours\b/i.test(line));
    const bodyLines = endIndex === -1 ? lines.slice(dearIndex) : lines.slice(dearIndex, endIndex);

    return bodyLines
        .filter((line, index, arr) => !(index > 0 && /^Dear\s+Kalingan\s+Foundation\b/i.test(line)))
        .filter((line, index, arr) => !(line.match(/^\d{1,2}\s+[A-Za-z]+\s+\d{4}$/i) && arr[index + 1] && /^Dear\s+/i.test(arr[index + 1])))
        .join('\n')
        .replace(/\n{2,}/g, '\n')
        .trim();
};

const predictAcademicTone = (letterText) => {
    const body = extractScholarLetterBody(letterText || '').toLowerCase();
    if (!body) return 'Formal';

    const informalMarkers = ['hi', 'hello', 'thanks a lot', 'so', 'gonna', 'wanna', 'super', 'very good', 'i hope'];
    const moderateMarkers = ['kindly', 'please', 'sincerely', 'wish'];
    const formalMarkers = ['respectfully', 'sincerely', 'scholarship', 'dear', 'foundation', 'enrolled', 'dear foundation'];

    const informalHit = informalMarkers.filter((word) => body.includes(word)).length;
    const formalHit = formalMarkers.filter((word) => body.includes(word)).length;
    const moderateHit = moderateMarkers.filter((word) => body.includes(word)).length;

    if (informalHit > formalHit && informalHit >= 1) return 'Informal';
    if (formalHit >= 1 || moderateHit >= 1) return 'Formal';
    return 'Moderate';
};

const mapQualityStatus = (score) => {
    if (score >= 75) return 'accepted';
    if (score >= 50) return 'medium_risk';
    return 'high_risk';
};

const mapQualityLabel = (score) => {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 50) return 'Needs Improvement';
    return 'Non-Compliant';
};

const normalizeLetterScoreResponse = (payload) => {
    if (!payload || typeof payload !== 'object') return null;

    const score = clampScore(payload.score ?? payload.predicted_score ?? payload.prediction ?? payload.quality_score ?? payload.letter_score);
    if (score === null) return null;

    return {
        score,
        quality_status: mapQualityStatus(score),
        quality_label: mapQualityLabel(score),
        academic_tone: 'Formal',
        breakdown: {
            date: Number(payload.breakdown?.date ?? 5),
            body: Number(payload.breakdown?.body ?? Math.round(score * 0.6)),
            attachments: Number(payload.breakdown?.attachments ?? 20),
            caption: Number(payload.breakdown?.caption ?? 13),
        },
    };
};

const predictLetterScore = async (letterText) => {
    const cleanText = extractScholarLetterBody(letterText);
    if (!cleanText || !String(cleanText).trim()) return {
        score: null,
        quality_status: 'high_risk',
        quality_label: 'Model Offline',
        academic_tone: 'Informal',
        fallback: true,
    };

    try {
        const result = spawnSync(PYTHON_BIN, [PREDICTOR_SCRIPT], {
            input: String(cleanText),
            cwd: MODEL_DIR,
            encoding: 'utf8',
            timeout: 5000,
        });

        if (result?.error) {
            console.warn('Warning: letter scoring predictor failed to launch:', result.error.message);
            return {
                score: null,
                quality_status: 'high_risk',
                quality_label: 'Model Offline',
                academic_tone: predictAcademicTone(letterText),
                fallback: true,
            };
        }

        if (result?.status !== 0) {
            console.warn('Warning: letter scoring predictor returned a non-zero exit code:', result?.stderr || result?.stdout || 'unknown');
            return {
                score: null,
                quality_status: 'high_risk',
                quality_label: 'Model Offline',
                academic_tone: predictAcademicTone(letterText),
                fallback: true,
            };
        }

        const raw = String(result.stdout || '').trim();
        if (!raw) {
            console.warn('Warning: letter scoring predictor returned empty output.');
            return {
                score: null,
                quality_status: 'high_risk',
                quality_label: 'Model Offline',
                academic_tone: predictAcademicTone(letterText),
                fallback: true,
            };
        }

        const payload = JSON.parse(raw);
        const parsed = normalizeLetterScoreResponse(payload);
        if (!parsed) {
            return {
                score: null,
                quality_status: 'high_risk',
                quality_label: 'Model Offline',
                academic_tone: predictAcademicTone(letterText),
                fallback: true,
            };
        }

        return {
            ...parsed,
            academic_tone: predictAcademicTone(cleanText),
            fallback: false,
        };
    } catch (err) {
        console.warn('Warning: letter scoring predictor unavailable; continuing without a model score.', err?.message || err);
        return {
            score: null,
            quality_status: 'high_risk',
            quality_label: 'Model Offline',
            academic_tone: predictAcademicTone(letterText),
            fallback: true,
        };
    }
};

module.exports = {
    MODEL_DIR,
    PREDICTOR_SCRIPT,
    MODEL_PATH,
    VECTORIZER_PATH,
    clampScore,
    mapQualityLabel,
    mapQualityStatus,
    normalizeLetterScoreResponse,
    predictLetterScore,
    loadModelAtStartup,
    isModelLoaded: () => modelLoaded,
    extractScholarLetterBody,
    predictAcademicTone,
};
