const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const buildReportSummaryHTML = ({
  logoBase64,
  roleLabel,
  reportTitle,
  reportType,
  periodLabel,
  rows = [],
  certifiedByName,
  endorsedTo = [],
}) => {
  const safeRoleLabel = escapeHtml(roleLabel);
  const safeReportTitle = reportTitle
    ? escapeHtml(reportTitle)
    : `Summary of ${safeRoleLabel} reports`;
  const detailRows = rows.filter(row => row.scholarName);
  const isMonthlyReport = String(reportType || '').toLowerCase() === 'monthly letter';
  const isExportReport = String(reportType || '').toLowerCase() === 'export reports'
    || detailRows.some(row => row.requirement || row.deadline || row.approvedAt || row.approved_at);
  const totalScholars = detailRows.length;
  const submittedScholars = detailRows.filter(row => isExportReport
    ? row.reviewStatus !== 'Not Submitted'
    : row.submitted > 0);
  const missingScholars = detailRows.filter(row => isExportReport
    ? row.reviewStatus === 'Not Submitted'
    : row.submitted === 0).map(row => row.scholarName);
  const formatDate = value => value ? new Date(value).toLocaleDateString('en-PH') : '—';
  const renderExportRows = exportRows => exportRows.map(row => `
      <tr>
        <td>${escapeHtml(row.scholarName)}</td>
        <td>${escapeHtml(row.studentId || '—')}</td>
        <td>${escapeHtml(row.requirement || '—')}</td>
        <td>${escapeHtml(formatDate(row.deadline))}</td>
        <td>${escapeHtml(formatDate(row.submittedAt))}</td>
        <td>${escapeHtml(formatDate(row.approvedAt))}</td>
        <td class="${row.reviewStatus === 'Not Submitted' ? 'muted' : 'submitted'}">${escapeHtml(row.reviewStatus || 'Not Submitted')}</td>
      </tr>`).join('');
  const exportGroups = isExportReport ? (() => {
    const monthGroups = new Map();
    detailRows.forEach(row => {
      const dateValue = row.submittedAt || row.deadline;
      const date = dateValue ? new Date(dateValue) : null;
      const monthKey = date && !Number.isNaN(date.getTime())
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        : 'unknown';
      const monthLabel = date && !Number.isNaN(date.getTime())
        ? date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : 'No Date';
      const requirement = row.requirement || 'Other Documents';
      if (!monthGroups.has(monthKey)) monthGroups.set(monthKey, { monthKey, monthLabel, types: new Map() });
      const monthGroup = monthGroups.get(monthKey);
      if (!monthGroup.types.has(requirement)) monthGroup.types.set(requirement, []);
      monthGroup.types.get(requirement).push(row);
    });
    return [...monthGroups.values()]
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
      .flatMap(monthGroup => [...monthGroup.types.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([requirement, groupedRows]) => ({
          title: `${monthGroup.monthLabel} — ${requirement}`,
          rows: groupedRows.sort((a, b) => new Date(b.submittedAt || b.deadline || 0) - new Date(a.submittedAt || a.deadline || 0)),
        })));
  })() : [];
  const exportBreakdown = isExportReport ? exportGroups.map(group => {
    const submitted = group.rows.filter(row => row.reviewStatus !== 'Not Submitted').length;
    return `<div><span class="summary-label">${escapeHtml(group.title)}</span><strong>${submitted}/${group.rows.length}</strong><span class="breakdown-detail">${submitted ? `${submitted} accepted` : 'Not Submitted'}${group.rows.length - submitted ? ` · ${group.rows.length - submitted} not submitted` : ''}</span></div>`;
  }).join('') : '';
  const safeRows = !isExportReport && detailRows.length ? detailRows.map((row) => `
      <tr>
        <td>${escapeHtml(row.scholarName)}</td>
        <td>${escapeHtml(row.studentId || '—')}</td>
        <td class="${row.submitted > 0 ? 'submitted' : 'muted'}">${row.submitted > 0 ? 'Submitted' : 'Not Submitted'}</td>
        <td>${escapeHtml(row.submitted)}</td>
        ${isMonthlyReport ? `<td>${escapeHtml(row.submittedAt ? new Date(row.submittedAt).toLocaleDateString('en-PH') : '—')}</td><td>${escapeHtml(row.qualityStatus || '—')}</td>` : ''}
        <td>${escapeHtml(row.reviewStatus || (row.submitted > 0 ? 'Pending Review' : 'No Submission'))}</td>
      </tr>`).join('') : rows.map((row) => {
    const missing = Array.isArray(row.missingList) ? row.missingList : [];
    return `
      <tr>
        <td>${escapeHtml(row.batch)}</td>
        <td class="compliance">${escapeHtml(row.compliance)}</td>
        <td class="${missing.length ? '' : 'muted'}">${missing.length ? escapeHtml(missing.join(', ')) : 'None'}</td>
        </tr>`;
  }).join('');

  const recipients = endorsedTo.map((name) => `<div>${escapeHtml(name)}</div>`).join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeReportTitle}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet">
    <style>
      @page { size: A4; margin: 0; }
      :root { --ivory: #F0F0EE; --maroon: #7F2D3A; --gold: #B98B4E; --ink: #2B2320; --muted: #817875; }
      * { box-sizing: border-box; }
      html, body { margin: 0; min-height: 100%; }
      body { background: var(--ivory); color: var(--ink); font-family: 'DM Sans', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .top-bar { position: fixed; z-index: 10; top: 0; right: 0; left: 0; height: 12px; background: var(--maroon); }
      .page { min-height: 297mm; padding: 25mm 22mm 18mm; display: flex; flex-direction: column; }
      .eyebrow { margin: 0 0 8px; color: var(--maroon); font-size: 9px; font-weight: 700; letter-spacing: 2.1px; }
      .header { position: relative; min-height: 64mm; padding-right: 48mm; }
      h1 { margin: 0; max-width: 125mm; font-family: 'Playfair Display', Georgia, serif; font-size: 30px; line-height: 1.12; font-weight: 700; }
      .period { margin: 10px 0 0; color: var(--maroon); font-family: 'Playfair Display', Georgia, serif; font-size: 16px; font-style: italic; }
      .seal { position: absolute; top: 2mm; right: 0; width: 37mm; height: 37mm; border: 2px solid var(--gold); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
      .seal::before { content: ''; position: absolute; inset: 3px; border: 1px solid var(--gold); border-radius: 50%; }
      .seal img { position: relative; width: 27mm; height: 27mm; object-fit: contain; }
      .divider { height: 1px; background: var(--gold); margin: 0 0 12mm; }
      .export-group { margin: 0 0 10mm; page-break-inside: avoid; }
      .export-group h2 { margin: 0 0 5mm; color: var(--maroon); font-family: 'Playfair Display', Georgia, serif; font-size: 16px; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11px; }
      col.batch { width: 31%; } col.compliance { width: 25%; } col.missing { width: 44%; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; break-inside: avoid; }
      th { padding: 0 0 8px; border-bottom: 2px solid var(--ink); color: var(--maroon); font-size: 9px; font-weight: 700; letter-spacing: 1.5px; text-align: left; }
      td { padding: 12px 0; border-bottom: 1px solid #D8D3D0; vertical-align: top; line-height: 1.45; overflow-wrap: anywhere; }
      td:first-child { font-weight: 700; }
      td.compliance { color: var(--maroon); font-weight: 600; }
      td.muted { color: var(--muted); }
      .empty { color: var(--muted); font-style: italic; }
      .summary { display: grid; grid-template-columns: 32mm 32mm 1fr; gap: 8mm; margin: 22mm 0 10mm; padding: 6mm; border: 1px solid #D8D3D0; background: #F8F7F5; }
      .summary-breakdown { display: block; }
      .breakdown-heading > .summary-label { margin-bottom: 8px; }
      .breakdown-heading { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8mm; }
      .breakdown-heading > .summary-label { grid-column: 1 / -1; }
      .breakdown-heading > div { min-width: 0; }
      .breakdown-detail { display: block; color: var(--muted); font-size: 9px; line-height: 1.4; }
      .summary-label { display: block; margin-bottom: 4px; color: var(--maroon); font-size: 8px; font-weight: 700; letter-spacing: 1px; }
      .summary strong { display: block; color: var(--ink); font-family: 'Playfair Display', Georgia, serif; font-size: 19px; }
      .missing-names span:last-child { display: block; color: var(--ink); font-size: 10px; line-height: 1.4; }
      .footer { display: flex; gap: 26mm; margin-top: auto; padding-top: 22mm; page-break-inside: avoid; break-inside: avoid; }
      .signature-block { width: 55mm; }
      .signature-label { margin-bottom: 13px; color: var(--muted); font-size: 8px; font-weight: 700; letter-spacing: 1.4px; }
      .signature-line { border-bottom: 1px solid var(--ink); height: 1px; margin-bottom: 8px; }
      .signature-name { font-size: 10px; line-height: 1.35; }
    </style>
  </head>
  <body>
    <div class="top-bar"></div>
    <main class="page">
      <header class="header">
        <p class="eyebrow">APPLE SCHOLAR FOUNDATION</p>
        <h1>${safeReportTitle}</h1>
        <p class="period">${escapeHtml(periodLabel)}</p>
        <div class="seal" aria-label="Apple Scholar seal"><img src="${escapeHtml(logoBase64)}" alt="Apple Scholar"></div>
      </header>
      <div class="divider"></div>
      ${isExportReport ? exportGroups.map(group => `
        <section class="export-group">
          <h2>${escapeHtml(group.title)}</h2>
          <table>
            <colgroup><col style="width:18%"><col style="width:14%"><col style="width:16%"><col style="width:12%"><col style="width:13%"><col style="width:13%"><col style="width:14%"></colgroup>
            <thead><tr><th>SCHOLAR</th><th>STUDENT ID</th><th>REQUIREMENT</th><th>DEADLINE</th><th>SUBMITTED AT</th><th>APPROVED AT</th><th>STATUS</th></tr></thead>
            <tbody>${renderExportRows(group.rows)}</tbody>
          </table>
        </section>`).join('') : `<table>
        ${detailRows.length
          ? (isExportReport ? '<colgroup><col style="width:18%"><col style="width:14%"><col style="width:16%"><col style="width:12%"><col style="width:13%"><col style="width:13%"><col style="width:14%"></colgroup><thead><tr><th>SCHOLAR</th><th>STUDENT ID</th><th>REQUIREMENT</th><th>DEADLINE</th><th>SUBMITTED AT</th><th>APPROVED AT</th><th>STATUS</th></tr></thead>' : isMonthlyReport ? '<colgroup><col style="width:22%"><col style="width:16%"><col style="width:16%"><col style="width:10%"><col style="width:14%"><col style="width:10%"><col style="width:12%"></colgroup><thead><tr><th>SCHOLAR</th><th>STUDENT ID</th><th>SUBMISSION STATUS</th><th>COUNT</th><th>SUBMITTED AT</th><th>QUALITY STATUS</th><th>OFFICER REVIEW</th></tr></thead>' : '<colgroup><col style="width:28%"><col style="width:20%"><col style="width:20%"><col style="width:12%"><col style="width:20%"></colgroup><thead><tr><th>BATCH</th><th>COMPLIANCE</th><th>MISSING</th></tr></thead>')
          : '<colgroup><col class="batch"><col class="compliance"><col class="missing"></colgroup><thead><tr><th>BATCH</th><th>COMPLIANCE</th><th>MISSING</th></tr></thead>'}
        <tbody>${safeRows || '<tr><td colspan="3" class="empty">No report rows available</td></tr>'}</tbody>
      </table>`}
      ${detailRows.length ? `<section class="summary ${isExportReport ? 'summary-breakdown' : ''}">
        ${isExportReport ? `<div class="breakdown-heading"><span class="summary-label">REPORT BREAKDOWN</span>${exportBreakdown}</div>` : `<div><span class="summary-label">SUBMITTED</span><strong>${submittedScholars.length}/${totalScholars}</strong></div>
        <div><span class="summary-label">NOT SUBMITTED</span><strong>${missingScholars.length}</strong></div>
        <div class="missing-names"><span class="summary-label">SCHOLARS WITHOUT SUBMISSION</span><span>${escapeHtml(missingScholars.length ? missingScholars.join(', ') : 'None')}</span></div>`}
      </section>` : ''}
      <footer class="footer">
        <section class="signature-block">
          <div class="signature-label">CERTIFIED BY</div>
          <div class="signature-line"></div>
          <div class="signature-name">${escapeHtml(certifiedByName)}</div>
        </section>
        <section class="signature-block">
          <div class="signature-label">ENDORSED TO</div>
          <div class="signature-line"></div>
          <div class="signature-name">${recipients || '<span class="muted">None</span>'}</div>
        </section>
      </footer>
    </main>
  </body>
</html>`;
};

module.exports = { buildReportSummaryHTML };