const express = require('express');
const router = express.Router();
const dutyController = require('../controllers/dutyController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { logPrivacyAccess } = require('../middleware/privacyAccess');

const dutyReaders = [verifyToken, requireRole(['admin', 'staff'])];
const dutyManagers = [verifyToken, requireRole(['admin'])];
const authenticatedUsers = [verifyToken];
const attendanceAccess = (getScholarId, action) => [verifyToken, async (req, res, next) => {
	const scholarId = getScholarId(req);
	const isManager = ['admin', 'staff'].includes(req.user?.role);
	const isOwner = req.user?.role === 'scholar' && req.user.scholar_id === scholarId;
	try {
		await logPrivacyAccess(req, {
			action: isManager || isOwner ? action : 'DENIED_ACCESS',
			resourceType: 'attendance',
			resourceId: scholarId,
			status: isManager || isOwner ? 'allowed' : 'denied',
		});
	} catch (auditError) {
		console.error('Failed to log attendance access:', auditError);
		return res.status(500).json({ message: 'Unable to verify and log attendance access' });
	}
	if (isManager || isOwner) return next();
	return res.status(403).json({ message: 'Access denied: attendance belongs to another scholar' });
}];
const allowOwnAttendance = attendanceAccess((req) => req.params.scholar_id, 'VIEW_ATTENDANCE');
const allowOwnAttendanceMark = attendanceAccess((req) => req.body?.scholar_id, 'RECORD_ATTENDANCE');

// ─── CREATE DUTY (now with QR token + group assignment) ──────
router.post('/', dutyManagers, dutyController.createDuty);

// ─── GET ALL DUTIES ───────────────────────────────────────────
router.get('/', authenticatedUsers, dutyController.getAllDuties);

// ─── GET ATTENDANCE BY SCHOLAR ────────────────────────────────
router.get('/attendance/:scholar_id', allowOwnAttendance, dutyController.getAttendanceByScholar);

// ─── NOTIFY SCHOLARS FOR A DUTY (manual trigger — staff/officer/admin presses this) ──
router.post('/:id/notify', dutyManagers, dutyController.notifyDutyScholars);

// ─── GET DUTIES FOR SCHOLAR (group-based na, hindi na year_level) ─────
// NOTE: superseded na ito ng GET /api/scholar/my-duties (scholarController.js).
// Iniwan lang dito kung sakaling may ibang lumang bahagi ng app na tumatawag pa dito.
router.get('/scholar/:year_level', dutyReaders, dutyController.getDutiesForScholarLegacy);

// ─── GET SCHOLARS FOR A SPECIFIC DUTY (group-based na) ────────
// NOTE: superseded na ito ng GET /api/staff/duties/:duty_id/scholars (staffController.js),
// na naka-base na sa group membership. Iniwan lang dito para hindi masira ang lumang tawag.
router.get('/:id/scholars', dutyReaders, dutyController.getScholarsForDutyLegacy);

// ─── GET SINGLE DUTY WITH ATTENDANCE ─────────────────────────
router.get('/:id', dutyReaders, dutyController.getDutyById);

// ─── UPDATE DUTY ──────────────────────────────────────────────
router.put('/:id', dutyManagers, dutyController.updateDuty);

// ─── DELETE DUTY ──────────────────────────────────────────────
router.delete('/:id', dutyManagers, dutyController.deleteDuty);

// ─── MARK SINGLE ATTENDANCE (QR) ─────────────────────────────
router.post('/:id/attendance', allowOwnAttendanceMark, dutyController.markAttendance);

// ─── BULK SAVE ATTENDANCE (Manual Entry) ─────────────────────
// NOTE: superseded ng POST /api/staff/duties/:duty_id/attendance/bulk (staffController.js).
router.post('/:id/attendance/bulk', dutyManagers, dutyController.bulkSaveAttendance);

// ─── GET ATTENDANCE SUMMARY FOR A DUTY ───────────────────────
router.get('/:id/attendance/summary', dutyReaders, dutyController.getAttendanceSummary);

module.exports = router;