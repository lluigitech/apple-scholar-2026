const express = require('express');
const router  = express.Router();
const staff   = require('../../controllers/staffController');
const duty    = require('../../controllers/dutyController');
const { verifyToken, requireRole } = require('../../middleware/authMiddleware');

router.use(verifyToken);
router.use(requireRole(['staff', 'admin', 'officer']));

// Scholars
router.get('/pending', requireRole(['staff', 'admin', 'officer']), staff.getPendingScholars);

// Announcements
router.get('/announcements', staff.getAnnouncements);
router.post('/announcements', staff.createAnnouncement);
router.post('/announcements/:id/notify', staff.notifyAnnouncement);
router.get('/deadlines', staff.getDeadlines);
router.get('/activities', staff.reportActivities);

// Staff Attendance
router.get   ('/attendance/summary/today', requireRole(['staff', 'admin'], { action: 'VIEW_ATTENDANCE', resourceType: 'attendance' }), staff.getAttendanceSummary);
router.get   ('/attendance',               requireRole(['staff', 'admin'], { action: 'VIEW_ATTENDANCE', resourceType: 'attendance' }), staff.getAllAttendance);
router.get   ('/attendance/:id',           requireRole(['staff', 'admin'], { action: 'VIEW_ATTENDANCE', resourceType: 'attendance' }), staff.getAttendanceById);
router.post  ('/attendance',               requireRole(['staff', 'admin'], { action: 'RECORD_ATTENDANCE', resourceType: 'attendance' }), staff.addAttendance);
router.post  ('/attendance/qr',            requireRole(['staff', 'admin'], { action: 'RECORD_ATTENDANCE', resourceType: 'attendance' }), staff.qrAttendance);
router.patch ('/attendance/:id/toggle',    requireRole(['staff', 'admin'], { action: 'UPDATE_ATTENDANCE', resourceType: 'attendance' }), staff.toggleAttendance);
router.put   ('/attendance/:id',           requireRole(['staff', 'admin'], { action: 'UPDATE_ATTENDANCE', resourceType: 'attendance' }), staff.updateAttendance);
router.delete('/attendance/:id',           requireRole(['admin'], { action: 'DELETE_ATTENDANCE', resourceType: 'attendance' }), staff.deleteAttendance);

// Reports
router.get('/reports/duty-attendance', requireRole(['staff', 'admin'], { action: 'VIEW_ATTENDANCE', resourceType: 'attendance' }), staff.reportDutyAttendance);
router.get('/reports/submissions',     requireRole(['admin', 'officer'], { action: 'VIEW_LETTER', resourceType: 'submission_report' }), staff.reportSubmissions);
router.get('/reports/requirements',    requireRole(['admin']), staff.reportRequirements);
router.get('/reports/activities',      requireRole(['staff', 'admin', 'officer'], { action: 'VIEW_ATTENDANCE', resourceType: 'attendance' }), staff.reportActivities);

// ── Scholar Groups (Admin-controlled; staff may read for duty assignment) ──
router.get ('/groups',                          verifyToken, requireRole(['staff', 'Staff', 'admin']), staff.getGroups);
router.get ('/makeup-request-data',              verifyToken, requireRole(['staff', 'Staff']), staff.getMakeupRequestData);
router.post  ('/groups',                          verifyToken, requireRole(['admin']), staff.createGroup);
router.get   ('/groups/:group_id/members',        verifyToken, requireRole(['admin']), staff.getGroupMembers);
router.post  ('/groups/:group_id/members',        verifyToken, requireRole(['admin']), staff.addGroupMembers);
router.delete('/groups/:group_id/members/:scholar_id', verifyToken, requireRole(['admin']), staff.removeGroupMember);
router.get   ('/scholars-ungrouped',              verifyToken, requireRole(['admin']), staff.getUngroupedScholars);
router.get   ('/scholars-with-groups',            verifyToken, requireRole(['admin']), staff.getAllScholarsWithGroups);

// ── Duty <-> Group Assignment (admin-managed; staff may operate duties) ──
// NOTE: dating tumatawag ito sa staffController (staff.xxx), pero na-move na
// ang duty logic papunta sa dutyController.js kaya diretso na tumatawag dito.
router.post  ('/duties/assign-group',             verifyToken, requireRole(['admin']), duty.assignDutyToGroup);
router.get   ('/duties/makeup-permissions',       verifyToken, requireRole(['admin']), duty.getMakeupPermissions);
router.get   ('/duties/makeup-candidates',         verifyToken, requireRole(['admin']), duty.getMakeupCandidates);
router.post  ('/duties/makeup-permissions',       verifyToken, requireRole(['admin']), duty.createMakeupPermission);
router.get   ('/duties/:duty_id/groups',          verifyToken, requireRole(['admin', 'staff', 'Staff']), duty.getDutyGroups);
router.delete('/duties/:duty_id/groups/:group_id', verifyToken, requireRole(['admin']), duty.unassignDutyFromGroup);
router.get   ('/duties/:duty_id/qr',              verifyToken, requireRole(['admin', 'staff', 'Staff']), duty.getDutyQR);
router.get   ('/duties/:duty_id/scholars',        verifyToken, requireRole(['admin', 'staff', 'Staff']), duty.getDutyScholars);
router.post  ('/duties/:duty_id/notify',          verifyToken, requireRole(['admin']), duty.notifyDutyScholars);
router.post  ('/duties/:duty_id/attendance/bulk', verifyToken, requireRole(['admin', 'staff'], { action: 'UPDATE_ATTENDANCE', resourceType: 'attendance' }), duty.bulkMarkAttendance);
router.post  ('/duties/:duty_id/complete', verifyToken, requireRole(['staff', 'admin']), duty.completeDuty);

module.exports = router;