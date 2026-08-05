const express = require('express');
const router  = express.Router();
const staff   = require('../../controllers/staffController');
const duty    = require('../../controllers/dutyController');
const { verifyToken, requireRole } = require('../../middleware/authMiddleware');

// Scholars
router.get('/pending', staff.getPendingScholars);

// Announcements
router.get('/announcements', staff.getAnnouncements);
router.post('/announcements', staff.createAnnouncement);
router.post('/announcements/:id/notify', staff.notifyAnnouncement);
router.get('/deadlines', staff.getDeadlines);
router.get('/activities', staff.reportActivities);

// Staff Attendance
router.get   ('/attendance/summary/today', staff.getAttendanceSummary); // ← bago pa sa :id
router.get   ('/attendance',               staff.getAllAttendance);
router.get   ('/attendance/:id',           staff.getAttendanceById);
router.post  ('/attendance',               staff.addAttendance);
router.post  ('/attendance/qr',            staff.qrAttendance);
router.patch ('/attendance/:id/toggle',    staff.toggleAttendance);
router.put   ('/attendance/:id',           staff.updateAttendance);
router.delete('/attendance/:id',           staff.deleteAttendance);

// Reports
router.get('/reports/duty-attendance', staff.reportDutyAttendance);
router.get('/reports/submissions',     staff.reportSubmissions);
router.get('/reports/requirements',    staff.reportRequirements);
router.get('/reports/activities',      staff.reportActivities);

// ── Scholar Groups (Staff-only) ─────────────────────────────
router.get   ('/groups',                          verifyToken, requireRole(['staff', 'Staff']), staff.getGroups);
router.post  ('/groups',                          verifyToken, requireRole(['staff', 'Staff']), staff.createGroup);
router.get   ('/groups/:group_id/members',        verifyToken, requireRole(['staff', 'Staff']), staff.getGroupMembers);
router.post  ('/groups/:group_id/members',        verifyToken, requireRole(['staff', 'Staff']), staff.addGroupMembers);
router.delete('/groups/:group_id/members/:scholar_id', verifyToken, requireRole(['staff', 'Staff']), staff.removeGroupMember);
router.get   ('/scholars-ungrouped',              verifyToken, requireRole(['staff', 'Staff']), staff.getUngroupedScholars);
router.get   ('/scholars-with-groups',            verifyToken, requireRole(['staff', 'Staff']), staff.getAllScholarsWithGroups);

// ── Duty <-> Group Assignment (Staff-only) ──────────────────
// NOTE: dating tumatawag ito sa staffController (staff.xxx), pero na-move na
// ang duty logic papunta sa dutyController.js kaya diretso na tumatawag dito.
router.post  ('/duties/assign-group',             verifyToken, requireRole(['staff', 'Staff']), duty.assignDutyToGroup);
router.get   ('/duties/:duty_id/groups',          verifyToken, requireRole(['staff', 'Staff']), duty.getDutyGroups);
router.delete('/duties/:duty_id/groups/:group_id', verifyToken, requireRole(['staff', 'Staff']), duty.unassignDutyFromGroup);
router.get   ('/duties/:duty_id/qr',              verifyToken, requireRole(['staff', 'Staff']), duty.getDutyQR);
router.get   ('/duties/:duty_id/scholars',        verifyToken, requireRole(['staff', 'Staff']), duty.getDutyScholars);
router.post  ('/duties/:duty_id/notify',          duty.notifyDutyScholars);
router.post  ('/duties/:duty_id/attendance/bulk', verifyToken, requireRole(['staff', 'Staff']), duty.bulkMarkAttendance);

module.exports = router;