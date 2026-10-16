import axios from 'axios';

const API_BASE = (import.meta.env?.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;

const authHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  responseType: 'blob',
});

export const currentPeriodLabel = () => new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
}).format(new Date());

export const monthPeriodLabel = (monthValue) => {
  if (!monthValue) return currentPeriodLabel();
  const date = new Date(`${monthValue}-01T00:00:00`);
  return Number.isNaN(date.getTime()) ? monthValue : new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);
};

const getBatch = (row) => row.batch || row.group_name || row.year_level || row.yearLevel || row.year || 'All Scholars';
const getName = (row) => row.name || row.scholar || row.full_name || row.fullName || '';

export const buildSummaryRows = (records = [], isCompliant = (row) => Number(row.completionRate ?? row.credits ?? 0) >= 70) => {
  const grouped = new Map();
  records.forEach((row) => {
    const batch = getBatch(row);
    if (!grouped.has(batch)) grouped.set(batch, { batch, total: 0, compliant: 0, missingList: [] });
    const group = grouped.get(batch);
    group.total += 1;
    if (isCompliant(row)) group.compliant += 1;
    else if (getName(row)) group.missingList.push(getName(row).split(/\s+/).pop());
  });

  return [...grouped.values()].map(({ batch, total, compliant, missingList }) => ({
    batch,
    compliance: `${compliant}/${total}`,
    missingList: [...new Set(missingList)],
  }));
};

export const downloadReportSummaryPdf = async ({ role, reportTitle, periodLabel, reportType, rows, endorsedTo = [] }) => {
  const response = await axios.post(`${API}/reports/${role}/export-pdf`, {
    reportTitle,
    periodLabel,
    reportType,
    rows,
    endorsedTo,
  }, authHeaders());
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  const titlePart = reportTitle || `summary-of-${role}-reports`;
  anchor.download = `${titlePart.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${String(periodLabel).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
};
