const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const buildTaskComplianceHTML = ({ task, rows, certifiedByName }) => {
  const safeTitle = escapeHtml(task.title || 'Task Compliance Report');
  const targetLevels = Array.isArray(task.targetYearLevels) && task.targetYearLevels.length
    ? task.targetYearLevels.join(', ')
    : 'All scholars';
  const safeRows = rows.map(row => `
    <tr>
      <td><strong>${escapeHtml(row.scholar_name)}</strong><br><span class="muted">${escapeHtml(row.scholar_id)}</span></td>
      <td>${escapeHtml(row.latest_status)}</td>
      <td>${escapeHtml(row.submission_count)}</td>
      <td>${escapeHtml(row.latest_submitted_at || 'Not submitted')}</td>
      <td>${escapeHtml(row.officer_feedback || '—')}</td>
    </tr>`).join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${safeTitle}</title>
<style>
@page { size: A4 landscape; margin: 14mm; }
* { box-sizing: border-box; } body { margin: 0; color: #241512; font-family: Arial, sans-serif; font-size: 10px; }
.top { height: 8px; background: #7f2d3a; margin: -14mm -14mm 12mm; }
.eyebrow { color: #7f2d3a; font-size: 9px; font-weight: bold; letter-spacing: 2px; }
h1 { margin: 0 0 6px; font-family: Georgia, serif; font-size: 25px; }
.meta { color: #6b6058; line-height: 1.6; margin-bottom: 14px; }
.meta strong { color: #7f2d3a; } table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th { background: #7f2d3a; color: white; padding: 8px; text-align: left; font-size: 9px; }
td { border-bottom: 1px solid #e8dccb; padding: 8px; vertical-align: top; overflow-wrap: anywhere; }
tr { page-break-inside: avoid; } .muted { color: #8b7c74; font-size: 9px; }
.footer { margin-top: 22px; color: #6b6058; } .signature { margin-top: 28px; width: 180px; border-top: 1px solid #241512; padding-top: 6px; }
</style></head><body><div class="top"></div>
<p class="eyebrow">APPLE SCHOLAR FOUNDATION · TASK COMPLIANCE</p>
<h1>${safeTitle}</h1>
<div class="meta"><strong>Type:</strong> ${escapeHtml(task.type || 'Task')} &nbsp; | &nbsp; <strong>Due:</strong> ${escapeHtml(task.dueDate || 'No due date')}<br>
<strong>Created by:</strong> ${escapeHtml(task.createdByName || 'System')} ${task.createdByRole ? `(${escapeHtml(task.createdByRole)})` : ''}<br>
<strong>Target year levels:</strong> ${escapeHtml(targetLevels)}</div>
<table><thead><tr><th style="width:20%">SCHOLAR</th><th style="width:18%">STATUS</th><th style="width:12%">SUBMISSIONS</th><th style="width:20%">LATEST SUBMITTED</th><th style="width:30%">OFFICER FEEDBACK</th></tr></thead>
<tbody>${safeRows || '<tr><td colspan="5">No scholar submission data available.</td></tr>'}</tbody></table>
<div class="footer"><div>Generated on ${escapeHtml(new Date().toLocaleString('en-PH'))}</div><div class="signature">Prepared by ${escapeHtml(certifiedByName)}</div></div>
</body></html>`;
};

module.exports = { buildTaskComplianceHTML };
