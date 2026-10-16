const express = require('express');
const router  = express.Router();
const admin   = require('../../controllers/adminController');
const adminDashboard = require('../../controllers/adminDashboardController');
const privacy = require('../../controllers/privacyController');
const staff   = require('../../controllers/staffController');
const { verifyToken, requireRole } = require('../../middleware/authMiddleware');

router.use(verifyToken, requireRole(['admin'], {
  action: 'VIEW_ADMIN_RESOURCE',
  resourceType: 'admin_resource',
  logAllowed: false,
}));

// All routes in this router expose administrator data or operations.
router.get('/privacy', privacy.getSettings);
router.put('/privacy', privacy.updateSettings);
router.get('/privacy/logs', privacy.getAccessLogs);

// Users
router.get   ('/users',              requireRole(['admin'], { action: 'VIEW_SCHOLAR', resourceType: 'user_directory' }), admin.getAllUsers);
router.get   ('/officer-assignments', admin.getOfficerAssignments);
router.put   ('/officer-assignments/:id', admin.updateOfficerAssignments);
router.get   ('/staff-assignments', admin.getStaffAssignments);
router.put   ('/staff-assignments/:id', admin.updateStaffAssignments);
router.delete('/staff-assignments/:id', admin.deleteStaffAssignments);
router.get   ('/scholar-groups', staff.getGroups);
router.post  ('/scholar-groups', staff.createGroup);
router.put   ('/scholar-groups/:group_id', staff.updateGroup);
router.delete('/scholar-groups/:group_id', staff.deleteGroup);
router.get   ('/scholar-groups/scholars', requireRole(['admin'], { action: 'VIEW_SCHOLAR', resourceType: 'scholar_directory' }), staff.getAllScholarsWithGroups);
router.post  ('/scholar-groups/:group_id/members', staff.addGroupMembers);
router.delete('/scholar-groups/:group_id/members/:scholar_id', staff.removeGroupMember);
router.post  ('/users',              admin.createUser);
router.put   ('/users/:id',          admin.updateUser);
router.post  ('/users/:id/role',     admin.assignUserRole);
router.patch ('/users/:id/archive',  admin.archiveScholar);
router.delete('/users/:id',          admin.deleteUser);
router.get   ('/privacy-requests',   admin.getPrivacyRequests);
router.patch ('/privacy-requests/:id', admin.updatePrivacyRequest);
router.get   ('/settings/profile', admin.getAdminProfile);
router.put   ('/settings/profile', admin.updateAdminProfile);
router.get   ('/settings', admin.getAdminSettings);
router.put   ('/settings', admin.updateAdminSettings);
router.get('/dashboard-summary', adminDashboard.getSummary);

// Scholar profile
router.get('/scholars/:id/profile',     requireRole(['admin'], { action: 'VIEW_SCHOLAR', resourceType: 'scholar', getResourceId: (req) => req.params.id }), admin.getScholarProfile);
router.get('/scholars/:id/submissions', requireRole(['admin'], { action: 'VIEW_SCHOLAR', resourceType: 'submission_history', getResourceId: (req) => req.params.id }), admin.getScholarSubmissions);
router.get('/scholars/:id/attendance',  requireRole(['admin'], { action: 'VIEW_ATTENDANCE', resourceType: 'attendance', getResourceId: (req) => req.params.id }), admin.getScholarAttendance);
// Scholar grades (admin-managed)
router.get('/scholars/:id/grades',      requireRole(['admin'], { action: 'VIEW_SCHOLAR', resourceType: 'grades', getResourceId: (req) => req.params.id }), admin.getScholarGrades);
router.post('/scholars/:id/grades',     admin.addScholarGrade);
router.delete('/scholars/:id/grades/:gradeId', admin.deleteScholarGrade);
// Scholar-specific compliance summary
router.get('/scholars/:id/compliance-summary', requireRole(['admin'], { action: 'VIEW_SCHOLAR', resourceType: 'compliance_summary', getResourceId: (req) => req.params.id }), admin.getScholarComplianceSummary);

// Announcements
router.get   ('/announcements',             admin.getAnnouncements);
router.post  ('/announcements',             admin.createAnnouncement);
router.post  ('/announcements/:id/notify',  admin.notifyAnnouncement);
router.delete('/announcements/:id',         admin.deleteAnnouncement);
router.put   ('/announcements/:id/toggle',  admin.toggleAnnouncement);

// Compliance
router.get('/compliance',          admin.getCompliance);
router.get('/compliance/:id',      admin.getComplianceById);

// Reports
router.get('/reports/compliance-summary', requireRole(['admin'], { action: 'VIEW_SCHOLAR', resourceType: 'compliance_report' }), admin.getComplianceSummary);
router.get('/reports/monthly-submissions', requireRole(['admin'], { action: 'VIEW_LETTER', resourceType: 'letter_report' }), admin.getMonthlySubmissions);

// Compliance Manager settings (persisted thresholds) - protected
router.get('/compliance-settings', admin.getComplianceSettings);
router.post('/compliance-settings', admin.upsertComplianceSettings);

module.exports = router;