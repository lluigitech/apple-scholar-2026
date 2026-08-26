const express  = require('express');
const router   = express.Router();
const scholar  = require('../../controllers/scholarController');
const { verifyToken, requireRole } = require('../../middleware/authMiddleware');

router.get('/profile/:id',    scholar.getProfile);
router.patch('/profile/:id',  verifyToken, requireRole(['scholar']), scholar.updateProfile);
router.get('/announcements',  scholar.getAnnouncements);
router.get('/compliance-status', verifyToken, requireRole(['scholar']), scholar.getComplianceStatus);
router.get('/data-consent', verifyToken, requireRole(['scholar']), scholar.getDataConsent);
router.patch('/data-consent', verifyToken, requireRole(['scholar']), scholar.updateDataConsent);
router.get('/privacy-requests', verifyToken, requireRole(['scholar']), scholar.getPrivacyRequests);
router.post('/privacy-requests', verifyToken, requireRole(['scholar']), scholar.createPrivacyRequest);
router.get('/privacy-export', verifyToken, requireRole(['scholar']), scholar.exportMyData);

// Duty by Group -- protected: scholar_id galing sa JWT (req.user.scholar_id),
// hindi na sa URL, para hindi pwede palitan/i-spoof
router.get ('/my-duties', verifyToken, requireRole(['scholar', 'Scholar']), scholar.getMyDuties);
router.post('/checkin',   verifyToken, requireRole(['scholar', 'Scholar']), scholar.checkInToDuty);

module.exports = router;