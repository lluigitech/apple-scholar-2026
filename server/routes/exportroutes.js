const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware'); // ✅ fixed path

// Export routes: most require staff/admin, but logging hooks (google-sheets) should accept any authenticated user
const allowStaffAndAdmin = [verifyToken, requireRole(['staff', 'admin'])];
const allowAuthenticated = [verifyToken];

// ─── Excel ────────────────────────────────────────────────────────────────────
// GET /api/export/excel?type=compliance|donor|audit&scholar_id=&date_from=&date_to=
router.get('/excel', allowStaffAndAdmin, exportController.exportExcel);

// ─── PDF ──────────────────────────────────────────────────────────────────────
// GET /api/export/pdf?type=compliance|donor|audit&scholar_id=&date_from=&date_to=
router.get('/pdf', allowStaffAndAdmin, exportController.exportPDF);

// ─── Google Sheets ────────────────────────────────────────────────────────────
// POST /api/export/google-sheets
// body: { type, scholar_id, date_from, date_to, spreadsheet_title }
// Allow any authenticated user to call this so downloads initiated by scholars/officers are recorded
router.post('/google-sheets', allowAuthenticated, exportController.exportGoogleSheets);

// ─── Preview (JSON — used by frontend table) ──────────────────────────────────
// GET /api/export/preview?type=compliance|donor|audit&scholar_id=&date_from=&date_to=
router.get('/preview', allowStaffAndAdmin, exportController.previewReport);

module.exports = router;