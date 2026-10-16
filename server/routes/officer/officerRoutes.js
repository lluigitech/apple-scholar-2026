const express = require('express');
const router = express.Router();
const officerController = require('../../controllers/officerController');
const officerSettingsController = require('../../controllers/officerSettingsController');
const authController = require('../../controllers/authController');
const { verifyToken, requireRole } = require('../../middleware/authMiddleware');

router.use(verifyToken, requireRole(['officer'], {
    action: 'VIEW_OFFICER_RESOURCE',
    resourceType: 'officer_resource',
    logAllowed: false,
}));

// ── Announcements ──────────────────────────────────────────
router.get('/announcements',  officerController.getAnnouncements);
router.post('/announcements', officerController.createAnnouncement);
router.post('/announcements/:id/notify', officerController.notifyAnnouncement);

// ── Account settings ─────────────────────────────────────────
router.get('/profile', officerSettingsController.getProfile);
router.put('/profile', officerSettingsController.updateProfile);
router.post('/change-password', authController.changePassword);
router.get('/settings/notifications', officerSettingsController.getNotificationPreferences);
router.put('/settings/notifications', officerSettingsController.updateNotificationPreferences);

// ── Duties (for attendance dropdown) ──────────────────────
router.get('/duties', officerController.getDuties);

// ── Attendance ─────────────────────────────────────────────
router.get('/attendance',                requireRole(['admin', 'staff'], { action: 'VIEW_ATTENDANCE', resourceType: 'attendance' }), officerController.getAttendance);    // ?duty_id=1
router.post('/attendance',               requireRole(['admin', 'staff'], { action: 'RECORD_ATTENDANCE', resourceType: 'attendance' }), officerController.markAttendance);
router.patch('/attendance/:id/checkout', requireRole(['admin', 'staff'], { action: 'UPDATE_ATTENDANCE', resourceType: 'attendance' }), officerController.markCheckout);

router.get('/reports/compliance-summary', verifyToken, requireRole(['officer'], { action: 'VIEW_ATTENDANCE', resourceType: 'attendance' }), officerController.getComplianceSummary);
router.get('/assigned-year-levels', verifyToken, requireRole(['officer']), officerController.getAssignedYearLevels);
router.get('/reports/task-completion', verifyToken, requireRole(['officer'], { action: 'VIEW_SCHOLAR', resourceType: 'submission_report' }), officerController.getTaskCompletionSummary);
router.get('/reports/scholar-submissions', verifyToken, requireRole(['officer'], { action: 'VIEW_SCHOLAR', resourceType: 'submission_report', logAllowed: false }), officerController.getScholarSubmissionSummary);
router.post('/reports/compliance-summary/pdf', verifyToken, requireRole(['officer']), officerController.generateComplianceSummaryPdf);
router.get('/reports/monthly-submissions', verifyToken, requireRole(['officer'], { action: 'VIEW_LETTER', resourceType: 'letter' }), officerController.getMonthlySubmissions);
router.post('/reports/monthly-submissions/:id/action', verifyToken, requireRole(['officer']), officerController.reviewMonthlySubmission);

module.exports = router;