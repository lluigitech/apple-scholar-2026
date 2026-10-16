// ─── Scoring (LOCAL — temporary stand-in until Naive Bayes dataset is ready) ──
// This rule-based utility provides consistent output for the UI. When the
// ML scoring service is available, swap out buildEval while preserving the
// same return shape.

// The scoring contract is intentionally three-way in the UI model,
// rendered as a 100-point scoreboard with explicit subcomponent maxes.
export const LETTER_BODY_MAX = 70;
const DOCUMENTATION_MAX = 20;
const INFO_MAX = 10;

export function classifyQualityScore(score) {
    const normalizedScore = Math.min(Math.max(Number(score) || 0, 0), 100);

    if (normalizedScore >= 90) {
        return { riskLevel: 'accepted', riskColor: '#16a34a', riskLabel: 'Excellent', accepted: true, qualityStatus: 'accepted' };
    }
    if (normalizedScore >= 75) {
        return { riskLevel: 'accepted', riskColor: '#16a34a', riskLabel: 'Good', accepted: true, qualityStatus: 'accepted' };
    }
    if (normalizedScore >= 50) {
        return { riskLevel: 'medium', riskColor: '#d97706', riskLabel: 'Needs Improvement', accepted: false, qualityStatus: 'medium_risk' };
    }
    return { riskLevel: 'high', riskColor: '#ef4444', riskLabel: 'Non-Compliant', accepted: false, qualityStatus: 'high_risk' };
}

export function classifyAcademicTone(body) {
    const text = asText(body).toLowerCase();
    if (!text) return { toneLabel: 'Formal', toneColor: '#16a34a' };

    const formalSignals = [
        /\bdear\b/, /\brespectfully\b/, /\bsincerely\b/, /\bthank you\b/, /\bgrateful\b/, /\bappreciate\b/, /\bscholarship\b/, /\bfoundation\b/,
    ];
    const informalSignals = [
        /\bgonna\b/, /\bwanna\b/, /\bthanks a lot\b/, /\bsuper\b/, /\bcan\\'t\b/, /\bdon\\'t\b/, /\bwon\\'t\b/, /\bain\\'t\b/,
    ];
    const formalScore = formalSignals.filter((pattern) => pattern.test(text)).length;
    const informalScore = informalSignals.filter((pattern) => pattern.test(text)).length;

    if (formalScore >= informalScore && formalScore > 0) return { toneLabel: 'Formal', toneColor: '#16a34a' };
    if (informalScore > 0) return { toneLabel: 'Informal', toneColor: '#ef4444' };
    return { toneLabel: 'Moderate', toneColor: '#d97706' };
}

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

export function calcInfoScore(info) {
    let score = 0;
    score += asText(info.name).length > 2 ? 3 : 0;
    score += asText(info.age).length > 0 ? 1 : 0;
    score += asText(info.year).length > 0 ? 1.5 : 0;
    score += asText(info.course).length > 2 ? 2 : 0;
    score += asText(info.school).length > 2 ? 2 : 0;
    score += asText(info.date).length > 0 ? 0.5 : 0;
    return Math.min(score, 10);
}

export function isInfoBlank(info) {
    return !asText(info.name)
        && !asText(info.age)
        && !asText(info.year)
        && !asText(info.course)
        && !asText(info.school)
        && !asText(info.date);
}

export function calcMediaScore(media) {
    if (!Array.isArray(media) || media.length === 0) return 0;

    const photos = Array.isArray(media) ? media.length : 0;
    const described = Array.isArray(media) ? media.filter(m => m.description?.trim().length > 3).length : 0;
    const pictureScore = photos >= 1 ? 15 : 0;
    const captionScore = Math.min(described, photos) >= 1 ? 5 : 0;
    const total = Math.min(Math.round(pictureScore + captionScore), 20);
    return total;
}

export function buildEval(info, body, media) {
    const rawReportScore = calcReportScore(info, body);
    const mediaScore = calcMediaScore(media);
    const infoScore = calcInfoScore(info);

    const reportScore = rawReportScore * LETTER_BODY_MAX / 100;
    const overallScore = Math.min(reportScore + mediaScore + infoScore, 100);

    const checklist = CHECKLIST.map(item => ({ item, passed: item.check(info, body, media) }));
    const tone = classifyAcademicTone(body);

    const quality = classifyQualityScore(overallScore);

    const sentimentLabel = overallScore >= 75 ? 'Positive' : overallScore >= 50 ? 'Neutral' : 'Negative';
    const sentimentScore = Math.max(-1, Math.min(1, (overallScore - 50) / 50));

    return {
        reportScore,
        mediaScore,
        infoScore,
        overallScore,
        checklist,
        ...tone,
        ...quality,
        sentimentLabel,
        sentimentScore,
    };
}

export function getRiskBg(l) { return l === 'accepted' ? '#f0fdf4' : l === 'medium' ? '#fffbeb' : '#fef2f2'; }
export function getRiskBorder(l) { return l === 'accepted' ? '#bbf7d0' : l === 'medium' ? '#fde68a' : '#fecaca'; }