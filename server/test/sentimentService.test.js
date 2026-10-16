const assert = require('assert');
const { normalizeSentimentResponse, mapSentimentValueToLabel, normalizeContentScoreResponse } = require('../services/sentimentService');

assert.strictEqual(mapSentimentValueToLabel(-1), 'Negative');
assert.strictEqual(mapSentimentValueToLabel(0), 'Neutral');
assert.strictEqual(mapSentimentValueToLabel(1), 'Positive');

assert.deepStrictEqual(normalizeSentimentResponse({ sentiment: -1, sentiment_label: 'Negative', confidence: 0.9 }), {
  sentiment: -1,
  sentiment_label: 'Negative',
  confidence: 0.9,
});

assert.deepStrictEqual(normalizeContentScoreResponse({
  score: 88,
  breakdown: {
    paragraph: 6,
    academic: 20,
    self_improvement: 12,
    family: 6,
    difficulty: 18,
  },
  quality_label: 'Good',
}), {
  score: 88,
  breakdown: {
    paragraph: 6,
    academic: 20,
    self_improvement: 12,
    family: 6,
    difficulty: 18,
  },
  quality_label: 'Good',
});

console.log('sentimentService test passed');
