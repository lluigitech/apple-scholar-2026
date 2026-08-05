const express = require('express');
const router = express.Router();
const dutyController = require('../controllers/dutyController');

// ─── CREATE DUTY (now with QR token + group assignment) ──────
router.post('/', dutyController.createDuty);

// ─── GET ALL DUTIES ───────────────────────────────────────────
router.get('/', dutyController.getAllDuties);

// ─── GET ATTENDANCE BY SCHOLAR ────────────────────────────────
router.get('/attendance/:scholar_id', dutyController.getAttendanceByScholar);

// ─── NOTIFY SCHOLARS FOR A DUTY (manual trigger — staff/officer/admin presses this) ──
router.post('/:id/notify', dutyController.notifyDutyScholars);

// ─── GET DUTIES FOR SCHOLAR (group-based na, hindi na year_level) ─────
// NOTE: superseded na ito ng GET /api/scholar/my-duties (scholarController.js).
// Iniwan lang dito kung sakaling may ibang lumang bahagi ng app na tumatawag pa dito.
router.get('/scholar/:year_level', dutyController.getDutiesForScholarLegacy);

// ─── GET SCHOLARS FOR A SPECIFIC DUTY (group-based na) ────────
// NOTE: superseded na ito ng GET /api/staff/duties/:duty_id/scholars (staffController.js),
// na naka-base na sa group membership. Iniwan lang dito para hindi masira ang lumang tawag.
router.get('/:id/scholars', dutyController.getScholarsForDutyLegacy);

// ─── GET SINGLE DUTY WITH ATTENDANCE ─────────────────────────
router.get('/:id', dutyController.getDutyById);

// ─── UPDATE DUTY ──────────────────────────────────────────────
router.put('/:id', dutyController.updateDuty);

// ─── DELETE DUTY ──────────────────────────────────────────────
router.delete('/:id', dutyController.deleteDuty);

// ─── MARK SINGLE ATTENDANCE (QR) ─────────────────────────────
router.post('/:id/attendance', dutyController.markAttendance);

// ─── BULK SAVE ATTENDANCE (Manual Entry) ─────────────────────
// NOTE: superseded ng POST /api/staff/duties/:duty_id/attendance/bulk (staffController.js).
router.post('/:id/attendance/bulk', dutyController.bulkSaveAttendance);

// ─── GET ATTENDANCE SUMMARY FOR A DUTY ───────────────────────
router.get('/:id/attendance/summary', dutyController.getAttendanceSummary);

module.exports = router;