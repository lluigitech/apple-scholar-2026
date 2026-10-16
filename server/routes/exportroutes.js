const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware'); // ✅ fixed path

const allowReportExport = [verifyToken, requireRole(['admin'], { action: 'DOWNLOAD_REPORT', resourceType: 'scholar_report' })];

// ─── Excel ────────────────────────────────────────────────────────────────────
// GET /api/export/excel?type=compliance|donor|audit&scholar_id=&date_from=&date_to=
router.get('/excel', allowReportExport, exportController.exportExcel);

// ─── PDF ──────────────────────────────────────────────────────────────────────
// GET /api/export/pdf?type=compliance|donor|audit&scholar_id=&date_from=&date_to=
router.get('/pdf', allowReportExport, exportController.exportPDF);

// ─── Google Sheets ────────────────────────────────────────────────────────────
// POST /api/export/google-sheets
// body: { type, scholar_id, date_from, date_to, spreadsheet_title }
router.post('/google-sheets', verifyToken, (req, res, next) => {
  const logOnly = req.body?.log_only === true || req.body?.log_only === 'true';
  const roles = logOnly ? ['admin', 'staff', 'officer'] : ['admin'];
  return requireRole(roles, logOnly ? undefined : { action: 'DOWNLOAD_REPORT', resourceType: 'scholar_report' })(req, res, next);
}, exportController.exportGoogleSheets);

// Individual donor report (used by the donor detailed modal)
// GET /api/export/donor-report/:scholarId?month=YYYY-MM
router.get('/donor-report/:scholarId', allowReportExport, exportController.getDonorScholarReport);

// ─── Preview (JSON — used by frontend table) ──────────────────────────────────
// GET /api/export/preview?type=compliance|donor|audit&scholar_id=&date_from=&date_to=
router.get('/preview', allowReportExport, exportController.previewReport);

module.exports = router;