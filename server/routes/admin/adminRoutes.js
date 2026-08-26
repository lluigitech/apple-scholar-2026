const express = require('express');
const router  = express.Router();
const admin   = require('../../controllers/adminController');
const staff   = require('../../controllers/staffController');
const { verifyToken, requireRole } = require('../../middleware/authMiddleware');

// Users
router.get   ('/users',              verifyToken, requireRole(['admin']), admin.getAllUsers);
router.get   ('/officer-assignments', verifyToken, requireRole(['admin']), admin.getOfficerAssignments);
router.put   ('/officer-assignments/:id', verifyToken, requireRole(['admin']), admin.updateOfficerAssignments);
router.get   ('/staff-assignments', verifyToken, requireRole(['admin']), admin.getStaffAssignments);
router.put   ('/staff-assignments/:id', verifyToken, requireRole(['admin']), admin.updateStaffAssignments);
router.delete('/staff-assignments/:id', verifyToken, requireRole(['admin']), admin.deleteStaffAssignments);
router.get   ('/scholar-groups', verifyToken, requireRole(['admin']), staff.getGroups);
router.post  ('/scholar-groups', verifyToken, requireRole(['admin']), staff.createGroup);
router.get   ('/scholar-groups/scholars', verifyToken, requireRole(['admin']), staff.getAllScholarsWithGroups);
router.post  ('/scholar-groups/:group_id/members', verifyToken, requireRole(['admin']), staff.addGroupMembers);
router.delete('/scholar-groups/:group_id/members/:scholar_id', verifyToken, requireRole(['admin']), staff.removeGroupMember);
router.post  ('/users',              verifyToken, requireRole(['admin']), admin.createUser);
router.put   ('/users/:id',          verifyToken, requireRole(['admin']), admin.updateUser);
router.post  ('/users/:id/role',     verifyToken, requireRole(['admin']), admin.assignUserRole);
router.delete('/users/:id',          verifyToken, requireRole(['admin']), admin.deleteUser);
router.get   ('/users/:id/qr',       admin.getUserQR);
router.get   ('/privacy-requests',   verifyToken, requireRole(['admin']), admin.getPrivacyRequests);
router.patch ('/privacy-requests/:id', verifyToken, requireRole(['admin']), admin.updatePrivacyRequest);

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