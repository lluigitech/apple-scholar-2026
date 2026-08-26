const express = require('express');
const { verifyToken } = require('../middleware/authMiddleware');
const { exportReportSummaryPdf } = require('../controllers/reportSummaryController');

const router = express.Router();

router.post('/:role/export-pdf', verifyToken, exportReportSummaryPdf);

module.exports = router;