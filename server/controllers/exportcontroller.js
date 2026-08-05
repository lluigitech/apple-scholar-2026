const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { google } = require('googleapis');
const {
  getComplianceReport,
  getDonorReport,
  getAuditReport,
} = require('../services/reportQueryService.js');
const { logAuditEvent } = require('../utils/auditLogger');
const jwt = require('jsonwebtoken');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getFilters = (query) => ({
  scholar_id: query.scholar_id || null,
  date_from:  query.date_from  || null,
  date_to:    query.date_to    || null,
});

const getReportData = async (type, filters) => {
  switch (type) {
    case 'compliance': return { kind: 'compliance', data: await getComplianceReport(filters) };
    case 'donor':      return { kind: 'donor',      data: await getDonorReport(filters) };
    case 'audit':      return { kind: 'audit',      data: await getAuditReport(filters) };
    default: throw new Error(`Unknown report type: ${type}`);
  }
};

// ─── Excel styles ─────────────────────────────────────────────────────────────
const applyHeaderStyle = (row) => {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7F2D3A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
    };
  });
  row.height = 22;
};

const applyDataStyle = (row, rowIndex) => {
  const isEven = rowIndex % 2 === 0;
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: isEven ? 'FFFCF8F8' : 'FFFFFFFF' },
    };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.font = { size: 10 };
  });
  row.height = 18;
};

// ─── Build Excel workbook ─────────────────────────────────────────────────────
const buildExcel = async (kind, data) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Apple Scholar System';
  wb.created = new Date();

  const addSheet = (name, columns, rows) => {
    const ws = wb.addWorksheet(name, {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
    });
    ws.columns = columns.map((c) => ({ ...c, width: c.width || 20 }));

    const headerRow = ws.addRow(columns.map((c) => c.header));
    applyHeaderStyle(headerRow);

    rows.forEach((r, i) => {
      const row = ws.addRow(columns.map((c) => r[c.key] ?? ''));
      applyDataStyle(row, i);
    });

    ws.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + columns.length)}1` };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  };

  if (kind === 'compliance') {
    addSheet('Duty Attendance', [
      { header: 'Scholar',  key: 'scholar',  width: 22 },
      { header: 'Course',   key: 'course',   width: 12 },
      { header: 'Year',     key: 'year_level', width: 8 },
      { header: 'Date',     key: 'date',     width: 14 },
      { header: 'Duty',     key: 'duty',     width: 24 },
      { header: 'Status',   key: 'status',   width: 14 },
      { header: 'Hours',    key: 'hours',    width: 10 },
    ], data.duty_attendance);

    addSheet('Submissions', [
      { header: 'Scholar',      key: 'scholar',      width: 22 },
      { header: 'Type',         key: 'type',         width: 18 },
      { header: 'Period',       key: 'period',       width: 16 },
      { header: 'Submitted At', key: 'submitted_at', width: 18 },
      { header: 'Status',       key: 'status',       width: 14 },
    ], data.submissions);

    addSheet('Requirements', [
      { header: 'Scholar',      key: 'scholar',      width: 22 },
      { header: 'Requirement',  key: 'type',         width: 16 },
      { header: 'Semester',     key: 'semester',     width: 20 },
      { header: 'Submitted At', key: 'submitted_at', width: 18 },
      { header: 'Status',       key: 'status',       width: 14 },
    ], data.requirements);

    addSheet('Activity Participation', [
      { header: 'Scholar',     key: 'scholar',      width: 22 },
      { header: 'Activity',    key: 'activity',     width: 24 },
      { header: 'Date',        key: 'date',         width: 14 },
      { header: 'Attended',    key: 'attended',     width: 12 },
      { header: 'With Photos', key: 'with_photos',  width: 14 },
      { header: 'Photo Count', key: 'photos_count', width: 14 },
    ], data.activities.map(r => ({
      ...r,
      attended:    r.attended    ? 'Yes' : 'No',
      with_photos: r.with_photos ? 'Yes' : 'No',
    })));
  }

  if (kind === 'donor') {
    addSheet('Donor Report', [
      { header: 'Scholar',              key: 'scholar',               width: 22 },
      { header: 'Course',               key: 'course',                width: 14 },
      { header: 'Year',                 key: 'year_level',            width: 8  },
      { header: 'GPA',                  key: 'gpa',                   width: 10 },
      { header: 'Reports Submitted',    key: 'reports_submitted',     width: 18 },
      { header: 'Reports Verified',     key: 'reports_verified',      width: 18 },
      { header: 'Req. Submitted',       key: 'requirements_submitted',width: 18 },
      { header: 'Req. Verified',        key: 'requirements_verified', width: 16 },
      { header: 'Total Duty Hours',     key: 'total_duty_hours',      width: 16 },
      { header: 'Activities Attended',  key: 'activities_attended',   width: 18 },
      { header: 'Activities w/ Photos', key: 'activities_with_photos',width: 20 },
    ], data);
  }

  if (kind === 'audit') {
    addSheet('Audit Trail', [
      { header: 'Timestamp',    key: 'timestamp',    width: 22 },
      { header: 'Performed By', key: 'performed_by', width: 22 },
      { header: 'Role',         key: 'role',         width: 12 },
      { header: 'Action',       key: 'action',       width: 18 },
      { header: 'Module',       key: 'module',       width: 18 },
      { header: 'Details',      key: 'details',      width: 36 },
      { header: 'IP Address',   key: 'ip_address',   width: 16 },
    ], data);
  }

  return wb;
};

// ─── Build PDF ────────────────────────────────────────────────────────────────
const buildPDF = (kind, data, res) => {
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  doc.pipe(res);

  const BRAND = '#7f2d3a';
  const drawHeader = (title, subtitle) => {
    doc.rect(0, 0, doc.page.width, 60).fill(BRAND);
    doc.fillColor('white').fontSize(18).font('Helvetica-Bold').text('Apple Scholar System', 40, 14);
    doc.fontSize(10).font('Helvetica').text(title, 40, 36);
    if (subtitle) doc.text(subtitle, 40, 50);
    doc.fillColor('#333333');
    doc.moveDown(4);
  };

  const drawTable = (headers, rows, colWidths) => {
    const startX = 40;
    const rowH = 18;
    let y = doc.y;
    const pageW = doc.page.width - 80;

    // Header row
    doc.rect(startX, y, pageW, rowH).fill(BRAND);
    doc.fillColor('white').fontSize(8).font('Helvetica-Bold');
    let x = startX + 4;
    headers.forEach((h, i) => {
      doc.text(h, x, y + 5, { width: colWidths[i], ellipsis: true });
      x += colWidths[i];
    });

    // Data rows
    rows.forEach((row, ri) => {
      y += rowH;
      if (y > doc.page.height - 60) {
        doc.addPage();
        y = 40;
      }
      doc.rect(startX, y, pageW, rowH).fill(ri % 2 === 0 ? '#fcf8f8' : '#ffffff');
      doc.fillColor('#333333').fontSize(7).font('Helvetica');
      x = startX + 4;
      Object.values(row).forEach((val, i) => {
        doc.text(String(val ?? ''), x, y + 5, { width: colWidths[i], ellipsis: true });
        x += colWidths[i];
      });
    });

    doc.y = y + rowH + 10;
  };

  const date = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });

  if (kind === 'compliance') {
    drawHeader('Compliance Report', `Generated: ${date}`);

    doc.fillColor(BRAND).fontSize(11).font('Helvetica-Bold').text('Duty Attendance').moveDown(0.3);
    drawTable(
      ['Scholar', 'Course', 'Date', 'Duty', 'Status', 'Hours'],
      data.duty_attendance.map(r => ({
        scholar: r.scholar, course: r.course, date: r.date,
        duty: r.duty, status: r.status, hours: r.hours,
      })),
      [120, 60, 80, 130, 70, 50]
    );

    doc.addPage();
    doc.fillColor(BRAND).fontSize(11).font('Helvetica-Bold').text('Submissions').moveDown(0.3);
    drawTable(
      ['Scholar', 'Type', 'Period', 'Submitted At', 'Status'],
      data.submissions.map(r => ({
        scholar: r.scholar, type: r.type, period: r.period,
        submitted_at: r.submitted_at ?? '—', status: r.status,
      })),
      [130, 100, 90, 110, 80]
    );

    doc.addPage();
    doc.fillColor(BRAND).fontSize(11).font('Helvetica-Bold').text('Requirements').moveDown(0.3);
    drawTable(
      ['Scholar', 'Requirement', 'Semester', 'Submitted At', 'Status'],
      data.requirements.map(r => ({
        scholar: r.scholar, type: r.type, semester: r.semester,
        submitted_at: r.submitted_at ?? '—', status: r.status,
      })),
      [130, 90, 120, 110, 80]
    );

    doc.addPage();
    doc.fillColor(BRAND).fontSize(11).font('Helvetica-Bold').text('Activity Participation').moveDown(0.3);
    drawTable(
      ['Scholar', 'Activity', 'Date', 'Attended', 'With Photos', 'Photos'],
      data.activities.map(r => ({
        scholar: r.scholar, activity: r.activity, date: r.date,
        attended: r.attended ? 'Yes' : 'No',
        with_photos: r.with_photos ? 'Yes' : 'No',
        photos_count: r.photos_count,
      })),
      [120, 130, 80, 70, 80, 60]
    );
  }

  if (kind === 'donor') {
    drawHeader('Donor Report — Scholar Progress Summary', `Generated: ${date}`);
    drawTable(
      ['Scholar', 'Course', 'Yr', 'GPA', 'Rpts Sub.', 'Rpts Ver.', 'Req Sub.', 'Req Ver.', 'Duty Hrs', 'Acts', 'w/ Photos'],
      data.map(r => ({
        scholar: r.scholar, course: r.course, year_level: r.year_level, gpa: r.gpa,
        reports_submitted: r.reports_submitted, reports_verified: r.reports_verified,
        requirements_submitted: r.requirements_submitted, requirements_verified: r.requirements_verified,
        total_duty_hours: r.total_duty_hours,
        activities_attended: r.activities_attended, activities_with_photos: r.activities_with_photos,
      })),
      [110, 55, 25, 35, 55, 55, 50, 50, 50, 40, 55]
    );
  }

  if (kind === 'audit') {
    drawHeader('Audit Trail Report', `Generated: ${date}`);
    drawTable(
      ['Timestamp', 'Performed By', 'Role', 'Action', 'Module', 'Details', 'IP'],
      data.map(r => ({
        timestamp: r.timestamp, performed_by: r.performed_by, role: r.role,
        action: r.action, module: r.module, details: r.details, ip_address: r.ip_address,
      })),
      [110, 100, 55, 70, 70, 160, 80]
    );
  }

  doc.end();
};

// ─── CONTROLLERS ──────────────────────────────────────────────────────────────

// Preview (JSON)
exports.previewReport = async (req, res) => {
  try {
    const { type = 'compliance' } = req.query;
    const filters = getFilters(req.query);
    const { kind, data } = await getReportData(type, filters);

    if (kind === 'audit') {
      await logAuditEvent({
        req,
        userId: req.user?.id,
        action: 'view',
        module: 'Audit Log',
        details: `Viewed audit log preview for ${type} report`,
        result: 'success',
      });
    }

    res.json({ success: true, type: kind, data });
  } catch (err) {
    console.error('[previewReport]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Export Excel
exports.exportExcel = async (req, res) => {
  try {
    const { type = 'compliance' } = req.query;
    const filters = getFilters(req.query);
    const { kind, data } = await getReportData(type, filters);

    const wb = await buildExcel(kind, data);
    const filename = `${kind}_report_${Date.now()}.xlsx`;

    // Build descriptive label from filters
    const filterParts = [];
    if (filters.scholar_id) filterParts.push(`Scholar:${filters.scholar_id}`);
    if (filters.date_from || filters.date_to) filterParts.push(`Range:${filters.date_from || '—'} to ${filters.date_to || '—'}`);
    const reportLabel = `${kind}${filterParts.length ? ' (' + filterParts.join(' | ') + ')' : ''}`;

    await logAuditEvent({
      req,
      userId: req.user?.id,
      action: 'export',
      module: kind === 'audit' ? 'Audit Log' : 'Report Export',
      details: `Exported ${reportLabel} as Excel — ${filename}`,
      result: 'success',
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[exportExcel]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Export PDF
exports.exportPDF = async (req, res) => {
  try {
    const { type = 'compliance' } = req.query;
    const filters = getFilters(req.query);
    const { kind, data } = await getReportData(type, filters);

    await logAuditEvent({
      req,
      userId: req.user?.id,
      action: 'export',
      module: kind === 'audit' ? 'Audit Log' : 'Report Export',
      details: `Exported ${kind} report as PDF`,
      result: 'success',
    });

    // Build descriptive label from filters
    const filterPartsPdf = [];
    if (filters.scholar_id) filterPartsPdf.push(`Scholar:${filters.scholar_id}`);
    if (filters.date_from || filters.date_to) filterPartsPdf.push(`Range:${filters.date_from || '—'} to ${filters.date_to || '—'}`);
    const reportLabelPdf = `${kind}${filterPartsPdf.length ? ' (' + filterPartsPdf.join(' | ') + ')' : ''}`;

    const filename = `${kind}_report_${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await logAuditEvent({
      req,
      userId: req.user?.id,
      action: 'export',
      module: kind === 'audit' ? 'Audit Log' : 'Report Export',
      details: `Exported ${reportLabelPdf} as PDF — ${filename}`,
      result: 'success',
    });

    buildPDF(kind, data, res);
  } catch (err) {
    console.error('[exportPDF]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Export to Google Sheets
exports.exportGoogleSheets = async (req, res) => {
  try {
    const { type = 'compliance', scholar_id, date_from, date_to, spreadsheet_title, log_only, module: moduleName, details: explicitDetails, report_resource } = req.body;

    // Support best-effort client logging that may include a token in the body (used by navigator.sendBeacon fallback)
    if (!req.user && req.body && req.body.token) {
      try {
        const decoded = jwt.verify(req.body.token, process.env.JWT_SECRET);
        req.user = { ...decoded, role: typeof decoded.role === 'string' ? decoded.role.toLowerCase().trim() : decoded.role };
      } catch (e) {
        // ignore verification failures; route will still attempt to log but without user context
      }
    }

    const logOnly = log_only === true || log_only === 'true';
    const logModule = moduleName || report_resource || 'Report Export';
    const logDetails = explicitDetails || spreadsheet_title || `Exported ${logModule}`;

    if (logOnly) {
      await logAuditEvent({
        req,
        userId: req.user?.id,
        action: 'export',
        module: logModule,
        details: logDetails,
        result: 'success',
      });
      return res.json({ success: true, logged: true });
    }

    const filters = { scholar_id, date_from, date_to };
    const { kind, data } = await getReportData(type, filters);

    const filterPartsGs = [];
    if (filters.scholar_id) filterPartsGs.push(`Scholar:${filters.scholar_id}`);
    if (filters.date_from || filters.date_to) filterPartsGs.push(`Range:${filters.date_from || '—'} to ${filters.date_to || '—'}`);
    const reportLabelGs = `${kind}${filterPartsGs.length ? ' (' + filterPartsGs.join(' | ') + ')' : ''}`;

    await logAuditEvent({
      req,
      userId: req.user?.id,
      action: 'export',
      module: kind === 'audit' ? 'Audit Log' : 'Report Export',
      details: `Exported ${reportLabelGs} to Google Sheets`,
      result: 'success',
    });

    // Google Sheets service (see googleSheetsService.js)
    const googleSheetsService = require('../services/googleSheetsService');
    const title = spreadsheet_title || `${kind} Report — ${new Date().toLocaleDateString('en-PH')}`;
    const url = await googleSheetsService.createSpreadsheet(title, kind, data);

    res.json({ success: true, url });
  } catch (err) {
    console.error('[exportGoogleSheets]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};