const express = require('express');
const router = express.Router();
const flaggedController = require('../controllers/flaggedController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// Flagged scholar summaries combine attendance, submissions, and academic records.
router.get('/scholars', verifyToken, requireRole(['admin'], { action: 'VIEW_SCHOLAR', resourceType: 'scholar_risk_summary' }), flaggedController.getFlaggedScholars);
router.post('/scholars/:scholarId/remind', verifyToken, requireRole(['admin'], { action: 'UPDATE_SCHOLAR', resourceType: 'scholar_risk_summary' }), flaggedController.remindScholar);
router.post('/scholars/:scholarId/home-visit', verifyToken, requireRole(['admin'], { action: 'UPDATE_SCHOLAR', resourceType: 'scholar_risk_summary' }), flaggedController.logHomeVisit);

module.exports = router;