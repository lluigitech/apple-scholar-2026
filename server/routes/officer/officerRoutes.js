const express = require('express');
const router = express.Router();
const officerController = require('../../controllers/officerController');

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

router.get('/reports/compliance-summary', officerController.getComplianceSummary);
router.post('/reports/compliance-summary/pdf', officerController.generateComplianceSummaryPdf);
router.get('/reports/monthly-submissions', officerController.getMonthlySubmissions);
router.post('/reports/monthly-submissions/:id/action', officerController.reviewMonthlySubmission);

module.exports = router;