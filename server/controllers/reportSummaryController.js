const db = require('../config/db');
const { buildReportSummaryHTML } = require('../services/reportSummaryTemplate');
const { generateReportPdf } = require('../services/reportPdfService');
const { getLogoBase64 } = require('../utils/logoLoader');

const ALLOWED_ROLES = new Set(['officer', 'staff', 'admin']);

const getUserName = async (userId) => {
  const [rows] = await db.promise().query('SELECT full_name FROM users WHERE id = ? LIMIT 1', [userId]);
  return rows[0]?.full_name?.trim() || null;
};

const safeFilenamePart = (value) => String(value || 'period')
  .trim()
  .replace(/[^a-z0-9]+/gi, '-')
  .replace(/^-|-$/g, '')
  .toLowerCase() || 'period';

const exportReportSummaryPdf = async (req, res) => {
  try {
    const role = String(req.params.role || '').toLowerCase();
    if (!ALLOWED_ROLES.has(role)) {
      return res.status(400).json({ success: false, message: 'Role must be officer, staff, or admin.' });
    }
    if (req.user?.role !== role) {
      return res.status(403).json({ success: false, message: 'You can only export reports for your authenticated role.' });
    }

    const { periodLabel, reportTitle, reportType, rows, endorsedTo } = req.body || {};
    if (typeof periodLabel !== 'string' || !periodLabel.trim() || !Array.isArray(rows) || !Array.isArray(endorsedTo)) {
      return res.status(400).json({ success: false, message: 'periodLabel, rows, and endorsedTo are required.' });
    }
    if (periodLabel.trim().length > 120) {
      return res.status(400).json({ success: false, message: 'periodLabel is too long.' });
    }
    if (reportTitle !== undefined && (typeof reportTitle !== 'string' || reportTitle.trim().length > 120)) {
      return res.status(400).json({ success: false, message: 'reportTitle is invalid.' });
    }

    const normalizedRows = rows.map((row) => ({
      batch: String(row?.batch ?? ''),
      compliance: String(row?.compliance ?? ''),
      missingList: Array.isArray(row?.missingList) ? row.missingList.map(String) : [],
      scholarName: row?.scholarName ? String(row.scholarName) : '',
      studentId: row?.studentId ? String(row.studentId) : '',
      riskStatus: row?.riskStatus ? String(row.riskStatus) : '',
      submitted: Number(row?.submitted || 0),
      approved: Number(row?.approved || 0),
      pending: Number(row?.pending || 0),
      assigned: Number(row?.assigned || 0),
      missing: Number(row?.missing || 0),
      requirement: row?.requirement ? String(row.requirement) : '',
      deadline: row?.deadline ? String(row.deadline) : '',
      approvedAt: row?.approvedAt ? String(row.approvedAt) : (row?.approved_at ? String(row.approved_at) : ''),
      reviewStatus: row?.reviewStatus ? String(row.reviewStatus) : '',
      submittedAt: row?.submittedAt ? String(row.submittedAt) : '',
      qualityStatus: row?.qualityStatus ? String(row.qualityStatus) : '',
      exportAvailableAt: row?.exportAvailableAt ? String(row.exportAvailableAt) : '',
      groupName: row?.groupName ? String(row.groupName) : '',
      assignedStaff: row?.assignedStaff ? String(row.assignedStaff) : '',
      duty: row?.duty ? String(row.duty) : '',
      attendanceDate: row?.attendanceDate ? String(row.attendanceDate) : '',
      attendanceTime: row?.attendanceTime ? String(row.attendanceTime) : '',
      attendanceStatus: row?.attendanceStatus ? String(row.attendanceStatus) : '',
    }));
    const recipients = endorsedTo.map(String);
    const certifiedByName = await getUserName(req.user.id);
    if (!certifiedByName) {
      return res.status(401).json({ success: false, message: 'Authenticated account could not be resolved.' });
    }

    const html = buildReportSummaryHTML({
      logoBase64: getLogoBase64(),
      roleLabel: role,
      reportTitle: reportTitle?.trim() || undefined,
      periodLabel: periodLabel.trim(),
      reportType: reportType?.trim() || reportTitle?.trim() || undefined,
      rows: normalizedRows,
      certifiedByName,
      endorsedTo: recipients,
    });
    const pdfBuffer = await generateReportPdf(html);
    const filename = `${safeFilenamePart(reportTitle || `summary-of-${role}-reports`)}-${safeFilenamePart(periodLabel)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('[exportReportSummaryPdf]', error);
    return res.status(500).json({ success: false, message: 'Failed to generate the report summary PDF.' });
  }
};

module.exports = { exportReportSummaryPdf };