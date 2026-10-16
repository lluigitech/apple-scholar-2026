const express  = require('express');
const router   = express.Router();
const scholar  = require('../../controllers/scholarController');
const { verifyToken, requireRole } = require('../../middleware/authMiddleware');

router.get('/profile/:id',    verifyToken, requireRole(['scholar']), scholar.getProfile);
router.patch('/profile/:id',  verifyToken, requireRole(['scholar']), scholar.updateProfile);
router.get('/announcements',  scholar.getAnnouncements);
router.get('/compliance-status', verifyToken, requireRole(['scholar']), scholar.getComplianceStatus);
router.get('/data-consent', verifyToken, requireRole(['scholar']), scholar.getDataConsent);
router.patch('/data-consent', verifyToken, requireRole(['scholar']), scholar.updateDataConsent);
router.get('/privacy-requests', verifyToken, requireRole(['scholar']), scholar.getPrivacyRequests);
router.post('/privacy-requests', verifyToken, requireRole(['scholar']), scholar.createPrivacyRequest);
router.get('/privacy-export', verifyToken, requireRole(['scholar']), scholar.exportMyData);

// Notification feed and read-state persistence backed by notification_logs
router.get('/notifications', verifyToken, requireRole(['scholar', 'Scholar']), scholar.getScholarNotifications);
router.post('/notifications/mark-all-read', verifyToken, requireRole(['scholar', 'Scholar']), scholar.markAllNotificationsRead);
router.patch('/notifications/:id/read', verifyToken, requireRole(['scholar', 'Scholar']), scholar.markNotificationRead);

// Duty by Group -- protected: scholar_id galing sa JWT (req.user.scholar_id),
// hindi na sa URL, para hindi pwede palitan/i-spoof
router.get ('/my-duties', verifyToken, requireRole(['scholar', 'Scholar']), scholar.getMyDuties);
router.get ('/makeup-options/:source_duty_id', verifyToken, requireRole(['scholar', 'Scholar']), scholar.getMakeupOptions);
router.get ('/makeup-requests', verifyToken, requireRole(['scholar', 'Scholar']), scholar.getMyMakeupRequests);
router.post('/makeup-requests', verifyToken, requireRole(['scholar', 'Scholar']), scholar.requestMakeup);
router.post('/checkin',   verifyToken, requireRole(['scholar', 'Scholar']), scholar.checkInToDuty);

module.exports = router;