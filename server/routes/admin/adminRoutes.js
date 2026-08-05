const express = require('express');
const router  = express.Router();
const admin   = require('../../controllers/adminController');
const { verifyToken, requireRole } = require('../../middleware/authMiddleware');

// Users
router.get   ('/users',              admin.getAllUsers);
router.post  ('/users',              admin.createUser);
router.put   ('/users/:id',          admin.updateUser);
router.post  ('/users/:id/role',     admin.assignUserRole);
router.delete('/users/:id',          admin.deleteUser);
router.get   ('/users/:id/qr',       admin.getUserQR);

// Scholar profile
router.get('/scholars/:id/profile',     admin.getScholarProfile);
router.get('/scholars/:id/submissions', admin.getScholarSubmissions);
router.get('/scholars/:id/attendance',  admin.getScholarAttendance);
// Scholar grades (admin-managed)
router.get('/scholars/:id/grades',      admin.getScholarGrades);
router.post('/scholars/:id/grades',     admin.addScholarGrade);
router.delete('/scholars/:id/grades/:gradeId', admin.deleteScholarGrade);
// Scholar-specific compliance summary
router.get('/scholars/:id/compliance-summary', admin.getScholarComplianceSummary);

// Announcements
router.get   ('/announcements',             admin.getAnnouncements);
router.post  ('/announcements',             admin.createAnnouncement);
router.post  ('/announcements/:id/notify',  admin.notifyAnnouncement);
router.delete('/announcements/:id',         admin.deleteAnnouncement);
router.put   ('/announcements/:id/toggle',  admin.toggleAnnouncement);

// Compliance
router.get('/compliance',          admin.getCompliance);
router.get('/compliance/:id',      admin.getComplianceById);
router.put('/compliance/:id/review', admin.reviewCompliance);

// Reports
router.get('/reports/compliance-summary', admin.getComplianceSummary);
router.get('/reports/monthly-submissions', admin.getMonthlySubmissions);

// Compliance Manager settings (persisted thresholds) - protected
router.get('/compliance-settings', verifyToken, requireRole(['admin']), admin.getComplianceSettings);
router.post('/compliance-settings', verifyToken, requireRole(['admin']), admin.upsertComplianceSettings);

module.exports = router;