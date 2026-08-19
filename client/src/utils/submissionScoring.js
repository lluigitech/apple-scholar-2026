// ─── Scoring (LOCAL — temporary stand-in until Naive Bayes dataset is ready) ──
// This rule-based utility provides consistent output for the UI. When the
// ML scoring service is available, swap out buildEval while preserving the
// same return shape.

const FORMAL_WORDS = [
    'furthermore', 'therefore', 'accordingly', 'hereby', 'grateful',
    'appreciate', 'sincerely', 'respectfully', 'honor', 'commitment',
    'responsible', 'attentive', 'diligent', 'support', 'opportunity',
];

const CLOSING_PHRASES = [
    'sincerely', 'respectfully', 'yours truly', 'best regards',
    'kind regards', 'thank you', 'warm regards', 'truly yours',
];

const asText = (value) => {
    if (value === null || typeof value === 'undefined') return '';
    return String(value).trim();
};

export const CHECKLIST = [
    { id: 'name',    label: 'Scholar name filled in',              check: (i) => asText(i.name).length > 2 },
    { id: 'age',     label: 'Age provided',                        check: (i) => asText(i.age).length > 0 },
    { id: 'year',    label: 'Year level provided',                 check: (i) => asText(i.year).length > 0 },
    { id: 'course',  label: 'Course provided',                     check: (i) => asText(i.course).length > 2 },
    { id: 'school',  label: 'School provided',                     check: (i) => asText(i.school).length > 2 },
    { id: 'body',    label: 'Letter body written (50+ words)',      check: (_, b) => asText(b).split(/\s+/).filter(Boolean).length >= 50 },
    { id: 'length',  label: 'Letter meets length (150+ words)',    check: (_, b) => asText(b).split(/\s+/).filter(Boolean).length >= 150 },
    { id: 'media',   label: 'At least 1 documentation photo',      check: (_, _b, m) => Array.isArray(m) && m.length >= 1 },
    { id: 'mdesc',   label: 'All photos have descriptions',        check: (_, _b, m) => Array.isArray(m) && m.length > 0 && m.every(p => asText(p.description).length > 3) },
];

const countSentences = (text) => text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean).length;
const countParagraphs = (text) => text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean).length;

export function calcReportScore(info, body) {
    const normalized = asText(body);
    const text = normalized.toLowerCase();
    const words = normalized.split(/\s+/).filter(Boolean).length;
    const sentences = countSentences(normalized);
    const paragraphs = countParagraphs(normalized);

    let score = 0;
    score += asText(info.name).length > 2 ? 10 : 0;
    score += asText(info.age).length > 0 ? 5 : 0;
    score += asText(info.year).length > 0 ? 5 : 0;
    score += asText(info.course).length > 2 ? 5 : 0;
    score += asText(info.school).length > 2 ? 5 : 0;

    score += words >= 50 ? 12 : 0;
    score += words >= 150 ? 16 : 0;
    score += words >= 300 ? 10 : 0;

    if (text.includes('dear')) score += 5;
    if (CLOSING_PHRASES.some(phrase => text.includes(phrase))) score += 5;
    if (sentences >= 4) score += 5;
    if (paragraphs >= 2) score += 5;

    const formalCount = FORMAL_WORDS.reduce((count, word) => count + (text.includes(word) ? 1 : 0), 0);
    score += Math.min(formalCount * 2, 12);

    if (words >= 150 && sentences > 0) {
        const avgSentenceLength = words / sentences;
        if (avgSentenceLength >= 12 && avgSentenceLength <= 28) score += 5;
    }

    return Math.min(Math.max(Math.round(score), 0), 100);
}

export function calcMediaScore(media) {
    if (!Array.isArray(media) || media.length === 0) return 0;

    const photos = media.length;
    const described = media.filter(m => m.description?.trim().length > 3).length;

    let score = 10;
    score += photos >= 1 ? 20 : 0;
    score += photos >= 2 ? 10 : 0;
    score += photos >= 3 ? 10 : 0;
    score += photos >= 5 ? 5 : 0;
    score += Math.min((described / photos) * 30, 30);

    return Math.min(Math.round(score), 100);
}

export function buildEval(info, body, media) {
    const reportScore = calcReportScore(info, body);
    const mediaScore = calcMediaScore(media);
    const overallScore = Math.round(reportScore * 0.7 + mediaScore * 0.3);
    const checklist = CHECKLIST.map(item => ({ item, passed: item.check(info, body, media) }));
    const toneLabel = overallScore >= 80 ? 'Strong' : overallScore >= 60 ? 'Moderate' : 'Informal';
    const toneColor = overallScore >= 80 ? '#16a34a' : overallScore >= 60 ? '#d97706' : '#ef4444';

    let riskLevel = 'high';
    let riskColor = '#ef4444';
    let riskLabel = 'High Risk';
    let accepted = false;
    let qualityStatus = 'high_risk';

    if (overallScore >= 71) {
        riskLevel = 'accepted';
        riskColor = '#16a34a';
        riskLabel = 'Accepted';
        accepted = true;
        qualityStatus = 'accepted';
    } else if (overallScore >= 51) {
        riskLevel = 'medium';
        riskColor = '#d97706';
        riskLabel = 'Medium Risk';
        qualityStatus = 'medium_risk';
    }

    const sentimentLabel = overallScore >= 71 ? 'Positive' : overallScore >= 51 ? 'Neutral' : 'Negative';
    const sentimentScore = Math.max(-1, Math.min(1, (overallScore - 50) / 50));

    return {
        reportScore, mediaScore, overallScore, checklist,
        toneLabel, toneColor, riskLevel, riskColor, riskLabel, accepted,
        qualityStatus, sentimentLabel, sentimentScore,
    };
}

export function getRiskBg(l) { return l === 'accepted' ? '#f0fdf4' : l === 'medium' ? '#fffbeb' : '#fef2f2'; }
export function getRiskBorder(l) { return l === 'accepted' ? '#bbf7d0' : l === 'medium' ? '#fde68a' : '#fecaca'; }