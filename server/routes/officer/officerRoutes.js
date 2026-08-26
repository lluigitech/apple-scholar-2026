const express = require('express');
const router = express.Router();
const officerController = require('../../controllers/officerController');
const { verifyToken, requireRole } = require('../../middleware/authMiddleware');

// ── Announcements ──────────────────────────────────────────
router.get('/announcements',  officerController.getAnnouncements);
router.post('/announcements', officerController.createAnnouncement);
router.post('/announcements/:id/notify', officerController.notifyAnnouncement);


// ── Duties (for attendance dropdown) ──────────────────────
router.get('/duties', officerController.getDuties);

// ── Attendance ─────────────────────────────────────────────
router.get('/attendance',                officerController.getAttendance);    // ?duty_id=1
router.post('/attendance',               officerController.markAttendance);
router.patch('/attendance/:id/checkout', officerController.markCheckout);

router.get('/reports/compliance-summary', verifyToken, requireRole(['officer']), officerController.getComplianceSummary);
router.get('/assigned-year-levels', verifyToken, requireRole(['officer']), officerController.getAssignedYearLevels);
router.get('/reports/task-completion', verifyToken, requireRole(['officer']), officerController.getTaskCompletionSummary);
router.get('/reports/scholar-submissions', verifyToken, requireRole(['officer']), officerController.getScholarSubmissionSummary);
router.post('/reports/compliance-summary/pdf', verifyToken, requireRole(['officer']), officerController.generateComplianceSummaryPdf);
router.get('/reports/monthly-submissions', verifyToken, requireRole(['officer']), officerController.getMonthlySubmissions);
router.post('/reports/monthly-submissions/:id/action', verifyToken, requireRole(['officer']), officerController.reviewMonthlySubmission);

module.exports = router;