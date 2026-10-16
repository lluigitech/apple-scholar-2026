import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Search, ChevronLeft, ChevronRight, FolderOpen, Download, FileSpreadsheet, FileText, Eye, X, Printer, ExternalLink, Archive, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatYearLevelLabel } from '../../../utils/yearLevelLabels';
import { downloadReportSummaryPdf, monthPeriodLabel } from '../../../utils/reportPdfExport';
import { formatAdminDate, getAdminLocale, getAdminTimezone } from '../../../utils/adminPreferences';
import FilePreviewModal from '../../Officer/ManualValidation/FilePreviewModal';
import { fileKind } from '../../../utils/submissionHelpers';

const API_BASE = (import.meta.env?.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;

const ARCHIVE_BULK_PATH = '/submission/archive/bulk';

const isArchivedRow = (r) => Boolean(
  r?.archived || r?.is_archived || r?.isArchived || r?.archived_at || r?.archivedAt
  || String(r?.status || '').toLowerCase() === 'archived'
);

// ── Design tokens — "Apple Scholar Executive" system ──
const PRIMARY = '#6D2140';
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E5D8CA';
const INK = '#241512';
const MUTED = '#8A7A68';
const BRONZE = '#A9784E';
const DANGER = '#C0473F';
const RADIUS = 16;
const PAGE_SIZE = 10;

const display = { fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };

const surfaceCard = {
  background: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: RADIUS,
  boxShadow: '0 1px 2px rgba(36,21,18,0.04)',
};

const fieldStyle = {
  width: '100%', height: 44, padding: '0 14px', borderRadius: 12,
  border: `1px solid ${BORDER}`, background: '#fff', ...body, fontSize: '0.85rem', color: INK, outline: 'none',
};

const labelStyle = { ...body, fontSize: '0.72rem', fontWeight: 700, color: PRIMARY, display: 'block', marginBottom: 6 };

// Status presentation — keyed by the statuses the API already returns.
// medium-risk is shown as "For Review", high-risk as "Needs Revision".
const STATUS = {
  accepted: { label: 'Accepted', color: '#4F7656', bg: '#EAF3EB' },
  'medium-risk': { label: 'For Review', color: '#9A6B1F', bg: '#FBF1DF' },
  'high-risk': { label: 'Needs Revision', color: '#A83A3A', bg: '#FBEAE8' },
};
const normalizeStatus = (s) => (s === 'approved' || !s ? 'accepted' : s);

// Requirement badges (muted). Falls back to Monthly Letter because the
// monthly-submissions endpoint only returns monthly letters today.
const REQUIREMENTS = {
  'Monthly Letter': { color: '#7A2B4D', bg: '#F6E6EC' },
  COR: { color: '#3E5F86', bg: '#E6EEF7' },
  Grades: { color: '#62508A', bg: '#EDE8F6' },
  'Other Document': { color: '#5E5A55', bg: '#ECEAE6' },
};
const REQUIREMENT_OPTIONS = Object.keys(REQUIREMENTS);
const requirementOf = (r) => {
  const raw = String(r.requirement || r.requirementType || r.documentType || r.document_type || r.submissionType || r.submission_type || '').toLowerCase();
  if (!raw || raw === 'letter' || raw.includes('month')) return 'Monthly Letter';
  if (raw.includes('cor') || raw.includes('registration')) return 'COR';
  if (raw.includes('grade') || raw.includes('report card')) return 'Grades';
  return 'Other Document';
};

const fmtDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : formatAdminDate(d, { month: 'short' });
};
const monthLabel = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat(getAdminLocale(), { timeZone: getAdminTimezone(), month: 'long', year: 'numeric' }).format(d);
};
const periodOf = (r) => r.period || r.periodLabel || monthLabel(r.submittedAt);
const rowKey = (r, i) => r.id || r._id || `${r.scholarName}-${r.submittedAt}-${i}`;

const pageList = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter(p => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push('gap-' + p);
    out.push(p);
  });
  return out;
};

const StatusBadge = ({ status }) => {
  const s = STATUS[normalizeStatus(status)] || STATUS.accepted;
  return (
    <span style={{ ...body, fontSize: '0.74rem', fontWeight: 600, color: s.color, background: s.bg, borderRadius: 8, padding: '4px 10px', whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
};

const RequirementBadge = ({ type }) => {
  const c = REQUIREMENTS[type] || REQUIREMENTS['Other Document'];
  return (
    <span style={{ ...body, fontSize: '0.74rem', fontWeight: 600, color: c.color, background: c.bg, borderRadius: 8, padding: '4px 10px', whiteSpace: 'nowrap' }}>
      {type}
    </span>
  );
};

const Skeleton = () => (
  <div style={{ ...surfaceCard, padding: '1.4rem' }}>
    <div style={{ height: 14, width: 200, borderRadius: 8, background: '#EFE3D4', marginBottom: 18 }} />
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} style={{ height: 38, borderRadius: 10, background: '#F2E9DC', marginBottom: 10 }} />
    ))}
  </div>
);

// ── PDF letter viewer — branded frame around the browser's PDF renderer ──
const PdfLetterModal = ({ preview, onClose }) => {
  const iframeRef = useRef(null);
  const [fit, setFit] = useState('page'); // 'page' = whole letter visible, 'width' = fill the width and scroll
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Lock page scroll while the viewer is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  const fileName = `monthly-letter-${String(preview.title || 'scholar').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;

  const handlePrint = () => {
    try {
      iframeRef.current?.contentWindow?.focus();
      iframeRef.current?.contentWindow?.print();
    } catch {
      window.open(preview.url, '_blank', 'noopener,noreferrer');
    }
  };

  const headerBtn = {
    ...body, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, padding: '0 14px',
    borderRadius: 10, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'none',
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-stretch justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`PDF letter for ${preview.title}`}
      onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}
      style={{ background: 'rgba(36,21,18,0.6)' }}
    >
      <div
        className="flex w-full max-w-[1100px] flex-col overflow-hidden h-dvh sm:h-[min(92vh,960px)] sm:rounded-2xl"
        style={{ background: SURFACE, border: `1px solid ${BORDER}`, boxShadow: '0 24px 60px -20px rgba(36,21,18,0.4)' }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4" style={{ background: BG, borderBottom: `1px solid ${BORDER}` }}>
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="hidden sm:flex shrink-0 items-center justify-center"
              style={{ width: 40, height: 40, borderRadius: '50%', background: `${PRIMARY}14`, color: PRIMARY }}
            >
              <FileText size={18} />
            </span>
            <div className="min-w-0">
              <p style={{ ...body, color: BRONZE, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Monthly Letter PDF
              </p>
              <h2 className="truncate" style={{ ...display, color: INK, fontSize: '1.2rem', fontWeight: 600, marginTop: 2 }}>{preview.title}</h2>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!isMobile && (
              <button
                type="button"
                onClick={() => setFit(f => (f === 'page' ? 'width' : 'page'))}
                title={fit === 'page' ? 'Zoom to fill the width' : 'Show the whole page'}
                style={{ ...headerBtn, border: `1px solid ${BORDER}`, background: '#fff', color: PRIMARY }}
              >
                {fit === 'page' ? 'Fit width' : 'Fit page'}
              </button>
            )}
            {!isMobile && (
              <button type="button" onClick={handlePrint} style={{ ...headerBtn, border: `1px solid ${BORDER}`, background: '#fff', color: PRIMARY }}>
                <Printer size={15} /> Print
              </button>
            )}
            <a href={preview.url} download={fileName} style={{ ...headerBtn, border: `1px solid ${PRIMARY}`, background: PRIMARY, color: '#fff' }}>
              <Download size={15} /> <span className="hidden sm:inline">Download</span><span className="sm:hidden">Save</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close PDF preview"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ background: '#fff', color: MUTED, border: `1px solid ${BORDER}`, cursor: 'pointer' }}
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Body */}
        {isMobile ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-6 py-10 text-center" style={{ background: BG }}>
            <span style={{ width: 64, height: 64, borderRadius: '50%', background: `${PRIMARY}12`, color: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={28} />
            </span>
            <div>
              <h3 style={{ ...display, color: INK, fontSize: '1.15rem' }}>{preview.title}</h3>
              <p style={{ ...body, color: MUTED, fontSize: '0.84rem', marginTop: 6, maxWidth: 280 }}>
                PDF previews are not supported inside this view on phones. Open the letter in a new tab or save it to your device.
              </p>
            </div>
            <div className="flex w-full max-w-xs flex-col gap-2.5">
              <a href={preview.url} target="_blank" rel="noopener noreferrer" style={{ ...headerBtn, height: 44, border: `1px solid ${PRIMARY}`, background: PRIMARY, color: '#fff' }}>
                <ExternalLink size={15} /> Open PDF letter
              </a>
              <a href={preview.url} download={fileName} style={{ ...headerBtn, height: 44, border: `1px solid ${PRIMARY}`, background: '#fff', color: PRIMARY }}>
                <Download size={15} /> Save to device
              </a>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 p-2 sm:p-3" style={{ background: BG }}>
            <iframe
              key={fit}
              ref={iframeRef}
              src={`${preview.url}#toolbar=0&navpanes=0&view=${fit === 'page' ? 'Fit' : 'FitH'}`}
              title={`Monthly letter PDF for ${preview.title}`}
              className="h-full w-full"
              style={{ border: `1px solid ${BORDER}`, borderRadius: 12, background: '#fff' }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default function MonthlyReportsTab({
  filteredReports = [],
  loading,
  error,
  statusFilter,
  setStatusFilter,
  month,
  setMonth,
  yearLevel,
  setYearLevel,
  onRefresh,
  onSelectReport,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [docType, setDocType] = useState('all');
  const [selected, setSelected] = useState(() => new Set());
  const [exportOpen, setExportOpen] = useState(false);
  const [generatingPdfId, setGeneratingPdfId] = useState(null);
  const [bulkPdfLoading, setBulkPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [pdfPreview, setPdfPreview] = useState(null);
  const [documentPreview, setDocumentPreview] = useState(null);

  // Archive (bulk) state
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const [archiveMessage, setArchiveMessage] = useState('');

  // Period choices: All Periods + the last 12 months (+ the active one if older).
  const periodOptions = useMemo(() => {
    const out = [];
    const now = new Date();
    for (let i = 0; i < 12; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      out.push({ value, label: new Intl.DateTimeFormat(getAdminLocale(), { timeZone: getAdminTimezone(), month: 'long', year: 'numeric' }).format(d) });
    }
    if (month && !out.some(o => o.value === month)) {
      out.push({ value: month, label: monthLabel(`${month}-01T00:00:00`) });
    }
    return out;
  }, [month]);

  // Local search layered on the parent's filtered list (scholar name, ID, or assigned officer).
  // Archived rows are kept out of this active list (they live in Archive Management).
  const searchedReports = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const sorted = [...filteredReports]
      .filter(r => !isArchivedRow(r))
      .filter(r => docType === 'all' || requirementOf(r) === docType)
      .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
    if (!term) return sorted;
    return sorted.filter((r) => {
      const officer = r.assignedOfficer || r.assignedOfficerNames?.join(', ') || r.assigned_officer || '';
      const id = r.studentId || r.scholar_id || '';
      return [r.scholarName, id, officer].some(v => String(v || '').toLowerCase().includes(term));
    });
  }, [filteredReports, searchTerm, docType]);

  useEffect(() => { setPage(1); setSelected(new Set()); }, [searchTerm, month, yearLevel, statusFilter, docType, filteredReports.length]);

  const totalPages = Math.max(1, Math.ceil(searchedReports.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = searchedReports.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    if (!pdfPreview) return undefined;
    const handleKeyDown = event => {
      if (event.key === 'Escape') setPdfPreview(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      URL.revokeObjectURL(pdfPreview.url);
    };
  }, [pdfPreview]);

  // Escape closes the archive confirmation (not while a request is running).
  useEffect(() => {
    if (!archiveOpen) return undefined;
    const handleKeyDown = event => {
      if (event.key === 'Escape' && !archiving) { setArchiveOpen(false); setArchiveError(''); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [archiveOpen, archiving]);

  const hasActiveFilters = Boolean(searchTerm || yearLevel || statusFilter !== 'all' || docType !== 'all' || month !== new Date().toISOString().slice(0, 7));
  const handleResetFilters = () => {
    setSearchTerm('');
    setDocType('all');
    setYearLevel('');
    setStatusFilter('all');
    setMonth(new Date().toISOString().slice(0, 7));
  };

  if (error) {
    return (
      <div className="text-center" style={{ ...surfaceCard, padding: '3rem 1.5rem' }}>
        <p style={{ ...body, fontSize: '0.9rem', color: DANGER, marginBottom: 16 }}>{error}</p>
        <button
          onClick={onRefresh}
          style={{ padding: '10px 22px', borderRadius: 10, background: PRIMARY, color: '#fff', ...body, fontWeight: 700, fontSize: '0.85rem', border: 'none', cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    );
  }

  const pageKeys = pageRows.map((r, i) => rowKey(r, start + i));
  const allOnPage = pageKeys.length > 0 && pageKeys.every(k => selected.has(k));
  const toggleAll = () => {
    const next = new Set(selected);
    pageKeys.forEach(k => (allOnPage ? next.delete(k) : next.add(k)));
    setSelected(next);
  };
  const toggleOne = (k) => {
    const next = new Set(selected);
    if (next.has(k)) next.delete(k); else next.add(k);
    setSelected(next);
  };

  // Letters to include in the bulk PDF download: the selected rows if any, otherwise everything in the current filter.
  const letterTargets = (selected.size
    ? searchedReports.filter((r, i) => selected.has(rowKey(r, i)))
    : searchedReports
  ).filter(r => requirementOf(r) === 'Monthly Letter');

  // Submission IDs of the selected rows (reuses the existing `selected` Set), de-duplicated.
  const selectedIds = [...new Set(
    searchedReports
      .filter((r, i) => selected.has(rowKey(r, i)))
      .map(r => r.id || r._id)
      .filter(Boolean)
  )];

  const focus = (e) => { e.target.style.borderColor = PRIMARY; };
  const blur = (e) => { e.target.style.borderColor = BORDER; };

  const openArchiveModal = () => {
    if (!selectedIds.length) return;
    setArchiveError('');
    setArchiveMessage('');
    setArchiveOpen(true);
  };
  const closeArchiveModal = () => {
    if (archiving) return;
    setArchiveOpen(false);
    setArchiveError('');
  };

  // ONE request for all selected submission IDs.
  const handleArchiveSelected = async () => {
    if (archiving || !selectedIds.length) return; // blocks double submission
    setArchiving(true);
    setArchiveError('');
    try {
      const { data } = await axios.post(
        `${API}${ARCHIVE_BULK_PATH}`,
        { submissionIds: selectedIds },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } },
      );
      const archived = Number.isFinite(data?.archivedCount) ? data.archivedCount : selectedIds.length;
      const plural = (n) => `${n} submission record${n === 1 ? '' : 's'}`;
      setArchiveMessage(
        archived < selectedIds.length
          ? `${plural(archived)} archived. ${selectedIds.length - archived} were skipped (already archived or not found).`
          : `${plural(archived)} archived successfully.`
      );
      setArchiveOpen(false);
      setSelected(new Set());
      onRefresh && onRefresh(); // filters live in state above, so they are kept
    } catch (archiveFailure) {
      console.error('Could not archive submission records:', archiveFailure);
      // Keep modal open, selection and filters intact; do not pretend it worked.
      setArchiveError(
        archiveFailure.response?.data?.error
        || archiveFailure.response?.data?.message
        || 'Unable to archive the selected records. Nothing was changed.'
      );
    } finally {
      setArchiving(false);
    }
  };

  const handleViewLetterPdf = async (report) => {
    const submissionId = report.id || report._id;
    if (!submissionId) return;

    const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    setGeneratingPdfId(submissionId);
    setPdfError('');
    try {
      const { data } = await axios.get(`${API}/submission/generate-pdf/${submissionId}`, { headers });
      if (!data?.path) throw new Error('The PDF file path was not returned.');

      const pdfResponse = await axios.get(`${API}/submission/preview?url=${encodeURIComponent(data.path)}`, {
        headers,
        responseType: 'blob',
      });
      const objectUrl = URL.createObjectURL(new Blob([pdfResponse.data], { type: 'application/pdf' }));
      setPdfPreview({ url: objectUrl, title: report.scholarName || 'Scholar' });
    } catch (previewError) {
      console.error('Could not open monthly letter PDF:', previewError);
      setPdfError(previewError.response?.data?.error || previewError.message || 'Unable to generate or view the PDF letter.');
    } finally {
      setGeneratingPdfId(null);
    }
  };
  const handleViewDocument = (report, media, index) => {
    const path = media?.url || media?.path;
    if (!path) return;

    const label = `${requirementOf(report)}${(report.photos || []).length > 1 ? ` (${index + 1})` : ''} · ${report.scholarName || 'Scholar'}`;
    setDocumentPreview({
      url: `${API}/submission/preview?url=${encodeURIComponent(path)}`,
      kind: fileKind(path),
      label,
    });
  };
  const handleDownloadAllLetterPdfs = async () => {
    const submissionIds = letterTargets
      .map(report => report.id || report._id)
      .filter(Boolean);
    if (!submissionIds.length) return;

    setBulkPdfLoading(true);
    setPdfError('');
    try {
      const response = await axios.post(`${API}/submission/letters/bulk-pdf`, { submissionIds }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        responseType: 'blob',
      });
      const objectUrl = URL.createObjectURL(new Blob([response.data], { type: 'application/zip' }));
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `monthly-letters-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (downloadError) {
      console.error('Could not download monthly letter archive:', downloadError);
      setPdfError('Unable to download all PDF letters. Please try again.');
    } finally {
      setBulkPdfLoading(false);
    }
  };

  const handleExportCsv = () => {
    setPdfError('');
    const rows = [
      ['Scholar Name', 'Student ID', 'Year Level', 'Requirement', 'Period', 'Submitted Date', 'Status'],
      ...searchedReports.map(report => [
        report.scholarName || 'Unknown Scholar',
        report.studentId || report.scholar_id || '',
        formatYearLevelLabel(report.year || report.yearLevel || report.year_level || ''),
        requirementOf(report),
        periodOf(report),
        fmtDate(report.submittedAt),
        (STATUS[normalizeStatus(report.status)] || STATUS.accepted).label,
      ]),
    ];
    const csv = `\uFEFF${rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')}`;
    const objectUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `compliance-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  const handleExportPdf = async () => {
    setPdfError('');
    try {
      await downloadReportSummaryPdf({
        role: 'admin',
        reportTitle: 'Compliance Reports',
        reportType: 'Export Reports',
        periodLabel: month ? monthPeriodLabel(month) : 'All Periods',
        rows: searchedReports.map(report => ({
          scholarName: report.scholarName || 'Unknown Scholar',
          studentId: report.studentId || report.scholar_id || '',
          requirement: requirementOf(report),
          submittedAt: report.submittedAt || '',
          reviewStatus: (STATUS[normalizeStatus(report.status)] || STATUS.accepted).label,
        })),
      });
    } catch (exportError) {
      console.error('Could not export compliance reports PDF:', exportError);
      setPdfError(exportError.response?.data?.message || 'Unable to export the PDF report.');
    }
  };

  const th = { ...body, fontSize: '0.74rem', fontWeight: 700, color: INK, textAlign: 'left', padding: '12px 14px', whiteSpace: 'nowrap', borderBottom: `1px solid ${BORDER}`, background: BG };
  const td = { ...body, fontSize: '0.82rem', color: INK, padding: '12px 14px', whiteSpace: 'nowrap', borderBottom: `1px solid ${BORDER}66` };
  const actionBtn = { ...body, fontSize: '0.76rem', fontWeight: 600, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${PRIMARY}`, background: '#fff', color: PRIMARY };
  const menuItem = { ...body, color: INK, fontSize: '0.82rem', background: 'transparent', border: 'none', cursor: 'pointer' };
  const runExport = (fn) => () => { setExportOpen(false); fn(); };
  const archiveDisabled = selectedIds.length === 0 || archiving;

  return (
    <div className="flex flex-col gap-5">

      {/* ── Filter bar (filters apply live) ── */}
      <div
        className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_1.5fr_auto] items-end"
        style={{ ...surfaceCard }}
      >
        <div>
          <label style={labelStyle}>Document Type</label>
          <select value={docType} onChange={e => setDocType(e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }} onFocus={focus} onBlur={blur}>
            <option value="all">All Requirements</option>
            {REQUIREMENT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Month / Period</label>
          <select value={month} onChange={e => setMonth(e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }} onFocus={focus} onBlur={blur}>
            <option value="">All Periods</option>
            {periodOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Year Level</label>
          <select value={yearLevel} onChange={e => setYearLevel(e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }} onFocus={focus} onBlur={blur}>
            <option value="">All Year Levels</option>
            <option value="1st Year College">1st Year College</option>
            <option value="2nd Year College">2nd Year College</option>
            <option value="3rd Year College">3rd Year College</option>
            <option value="4th Year College">4th Year College</option>
          </select>
        </div>

        <div>
          <label style={labelStyle}>Status</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }} onFocus={focus} onBlur={blur}>
            <option value="all">All Statuses</option>
            <option value="accepted">Accepted</option>
            <option value="medium-risk">For Review</option>
            <option value="high-risk">Needs Revision</option>
          </select>
        </div>

        <div>
          <label style={labelStyle}>Search Scholar</label>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: MUTED }} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search scholar name or ID..."
              style={{ ...fieldStyle, paddingLeft: 38 }}
              onFocus={focus}
              onBlur={blur}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetFilters}
            disabled={!hasActiveFilters}
            style={{
              height: 44, padding: '0 16px', borderRadius: 12, border: `1px solid ${hasActiveFilters ? PRIMARY : BORDER}`,
              background: '#fff', color: hasActiveFilters ? PRIMARY : MUTED,
              ...body, fontSize: '0.82rem', fontWeight: 700, cursor: hasActiveFilters ? 'pointer' : 'default', whiteSpace: 'nowrap',
            }}
          >
            Reset filters
          </button>

          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setExportOpen(o => !o)}
              aria-haspopup="menu"
              aria-expanded={exportOpen}
              className="flex items-center gap-2"
              style={{ height: 44, padding: '0 18px', borderRadius: 12, border: `1px solid ${PRIMARY}`, background: PRIMARY, color: '#fff', ...body, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              <Download size={15} /> Export
            </button>
            {exportOpen && (
              <>
                <div onClick={() => setExportOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
                <div
                  role="menu"
                  className="flex flex-col gap-0.5"
                  style={{ ...surfaceCard, position: 'absolute', right: 0, top: 'calc(100% + 6px)', minWidth: 180, zIndex: 31, padding: 6, boxShadow: '0 10px 24px -10px rgba(36,21,18,0.25)' }}
                >
                  <button type="button" role="menuitem" onClick={runExport(handleExportPdf)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-[#F7F4EE]" style={menuItem}>
                    <FileText size={15} style={{ color: PRIMARY }} /> Download PDF
                  </button>
                  <button type="button" role="menuitem" onClick={runExport(handleExportCsv)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-[#F7F4EE]" style={menuItem}>
                    <FileSpreadsheet size={15} style={{ color: PRIMARY }} /> Download CSV
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Submission Records ── */}
      {loading ? (
        <Skeleton />
      ) : (
        <section aria-labelledby="scholar-submissions-title" style={{ ...surfaceCard, padding: '1.25rem 1.25rem 1rem' }}>
          <div className="flex flex-wrap items-start justify-between gap-3" style={{ marginBottom: 14 }}>
            <div>
              <h2 id="scholar-submissions-title" style={{ ...display, fontSize: '1.25rem', fontWeight: 600, color: INK }}>Submission Records</h2>
              <p style={{ ...body, fontSize: '0.82rem', color: MUTED, marginTop: 2 }}>List of scholars and their submitted requirements.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openArchiveModal}
                disabled={archiveDisabled}
                className="flex items-center gap-2"
                style={{
                  height: 38, padding: '0 16px', borderRadius: 10, border: `1px solid ${PRIMARY}`,
                  background: archiveDisabled ? '#fff' : PRIMARY, color: archiveDisabled ? PRIMARY : '#fff',
                  ...body, fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap',
                  cursor: archiveDisabled ? 'not-allowed' : 'pointer', opacity: archiveDisabled ? 0.5 : 1,
                }}
              >
                <Archive size={14} />
                {selectedIds.length > 0 ? `Archive Selected (${selectedIds.length})` : 'Archive Selected'}
              </button>

              <button
                type="button"
                onClick={handleDownloadAllLetterPdfs}
                disabled={bulkPdfLoading || letterTargets.length === 0}
                className="flex items-center gap-2"
                style={{
                  height: 38, padding: '0 16px', borderRadius: 10, border: `1px solid ${PRIMARY}`,
                  background: '#fff', color: PRIMARY, ...body, fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap',
                  cursor: bulkPdfLoading || letterTargets.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: letterTargets.length === 0 ? 0.5 : 1,
                }}
              >
                <Download size={14} />
                {bulkPdfLoading
                  ? 'Preparing PDF letters…'
                  : selected.size > 0
                    ? `Download selected PDF letters (${letterTargets.length})`
                    : `Download PDF letters (${letterTargets.length})`}
              </button>
            </div>
          </div>

          {archiveMessage && (
            <div role="status" className="flex items-center gap-2.5" style={{ background: '#EAF3EB', border: '1px solid #CFE3D2', borderRadius: 12, padding: '10px 14px', marginBottom: 12 }}>
              <CheckCircle2 size={16} style={{ color: '#4F7656', flexShrink: 0 }} />
              <span style={{ ...body, fontSize: '0.82rem', color: '#4F7656', flex: 1 }}>{archiveMessage}</span>
              <button type="button" onClick={() => setArchiveMessage('')} aria-label="Dismiss message" style={{ background: 'transparent', border: 'none', color: '#4F7656', cursor: 'pointer' }}>
                <X size={15} />
              </button>
            </div>
          )}
          {bulkPdfLoading && <p style={{ ...body, color: MUTED, fontSize: '0.8rem', marginBottom: 12 }}>Preparing PDF letters. This may take a moment…</p>}
          {pdfError && <p role="alert" style={{ ...body, color: DANGER, fontSize: '0.8rem', marginBottom: 12 }}>{pdfError}</p>}

          {searchedReports.length === 0 ? (
            <div className="text-center" style={{ padding: '3rem 1rem', border: `1px dashed ${BORDER}`, borderRadius: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: `${BRONZE}14`, color: BRONZE, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <FolderOpen size={24} />
              </div>
              <h3 style={{ ...display, fontSize: '1.1rem', color: INK }}>No submissions found</h3>
              <p style={{ ...body, fontSize: '0.84rem', color: MUTED, marginTop: 4 }}>
                {hasActiveFilters ? 'Try changing or resetting the filters.' : 'Submissions appear here after scholars send their documents.'}
              </p>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto', border: `1px solid ${BORDER}`, borderRadius: 14 }}>
                <table style={{ width: '100%', minWidth: 960, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, width: 40 }}>
                        <input type="checkbox" aria-label="Select all on this page" checked={allOnPage} onChange={toggleAll} style={{ accentColor: PRIMARY }} />
                      </th>
                      {['#', 'Scholar Name', 'Student ID', 'Year Level', 'Requirement', 'Period', 'Submitted Date', 'Status', 'Action'].map(h => (
                        <th key={h} style={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((r, i) => {
                      const key = rowKey(r, start + i);
                      const yl = r.year || r.yearLevel || r.year_level;
                      const isLetter = requirementOf(r) === 'Monthly Letter';
                      const submissionId = r.id || r._id;
                      const opening = generatingPdfId === submissionId;
                      const files = r.photos || [];
                      return (
                        <tr key={key} style={{ background: selected.has(key) ? `${PRIMARY}08` : 'transparent' }}>
                          <td style={td}>
                            <input type="checkbox" aria-label={`Select ${r.scholarName || 'row'}`} checked={selected.has(key)} onChange={() => toggleOne(key)} style={{ accentColor: PRIMARY }} />
                          </td>
                          <td style={{ ...td, color: MUTED }}>{start + i + 1}</td>
                          <td style={{ ...td, fontWeight: 600 }}>{r.scholarName || 'Unknown Scholar'}</td>
                          <td style={td}>{r.studentId || r.scholar_id || '—'}</td>
                          <td style={td}>{yl ? formatYearLevelLabel(yl) : '—'}</td>
                          <td style={td}><RequirementBadge type={requirementOf(r)} /></td>
                          <td style={td}>{periodOf(r)}</td>
                          <td style={td}>{fmtDate(r.submittedAt)}</td>
                          <td style={td}><StatusBadge status={r.status} /></td>
                          <td style={td}>
                            <div className="flex items-center gap-1.5">
                              {isLetter ? (
                                <>
                                  <button type="button" onClick={() => onSelectReport && onSelectReport(r)} style={actionBtn}>
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleViewLetterPdf(r)}
                                    disabled={!submissionId || opening}
                                    aria-label={`View PDF letter for ${r.scholarName || 'scholar'}`}
                                    title="View PDF letter"
                                    className="flex items-center justify-center"
                                    style={{
                                      ...actionBtn, width: 32, height: 28, padding: 0, border: `1px solid ${BORDER}`,
                                      cursor: !submissionId || opening ? 'wait' : 'pointer', opacity: opening ? 0.6 : 1,
                                    }}
                                  >
                                    {opening ? <span style={{ fontSize: '0.7rem' }}>…</span> : <FileText size={14} />}
                                  </button>
                                </>
                              ) : files.length > 0 ? (
                                files.map((media, mediaIndex) => (
                                  <button
                                    key={`${media.url || media.path}-${mediaIndex}`}
                                    type="button"
                                    onClick={() => handleViewDocument(r, media, mediaIndex)}
                                    aria-label={`View ${requirementOf(r)} document${files.length > 1 ? ` ${mediaIndex + 1}` : ''} for ${r.scholarName || 'scholar'}`}
                                    style={actionBtn}
                                  >
                                    <span className="inline-flex items-center gap-1.5">
                                      <Eye size={13} /> View{files.length > 1 ? ` ${mediaIndex + 1}` : ''}
                                    </span>
                                  </button>
                                ))
                              ) : (
                                <span style={{ ...body, fontSize: '0.74rem', color: MUTED }}>No file attached</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Pagination ── */}
              <div className="flex flex-wrap items-center justify-between gap-3" style={{ padding: '14px 4px 4px' }}>
                <span style={{ ...body, fontSize: '0.8rem', color: MUTED }}>
                  Showing {start + 1}–{Math.min(start + PAGE_SIZE, searchedReports.length)} of {searchedReports.length} submission{searchedReports.length === 1 ? '' : 's'}{selected.size > 0 ? ` · ${selected.size} selected` : ''}
                </span>
                <nav className="flex items-center gap-1.5" aria-label="Pagination">
                  <button
                    type="button" aria-label="Previous page" disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                    style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${BORDER}`, background: '#fff', color: INK, opacity: currentPage === 1 ? 0.4 : 1, cursor: currentPage === 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {pageList(currentPage, totalPages).map(p => (
                    typeof p === 'string' ? (
                      <span key={p} style={{ ...body, color: MUTED, padding: '0 4px' }}>…</span>
                    ) : (
                      <button
                        key={p} type="button" onClick={() => setPage(p)} aria-current={p === currentPage ? 'page' : undefined}
                        style={{
                          minWidth: 34, height: 34, borderRadius: 10, ...body, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                          border: `1px solid ${p === currentPage ? PRIMARY : 'transparent'}`,
                          background: p === currentPage ? PRIMARY : 'transparent', color: p === currentPage ? '#fff' : INK,
                        }}
                      >
                        {p}
                      </button>
                    )
                  ))}
                  <button
                    type="button" aria-label="Next page" disabled={currentPage === totalPages}
                    onClick={() => setPage(currentPage + 1)}
                    style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${BORDER}`, background: '#fff', color: INK, opacity: currentPage === totalPages ? 0.4 : 1, cursor: currentPage === totalPages ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </nav>
              </div>
            </>
          )}
        </section>
      )}

      {pdfPreview && <PdfLetterModal preview={pdfPreview} onClose={() => setPdfPreview(null)} />}
      {documentPreview && (
        <FilePreviewModal
          preview={documentPreview}
          onClose={() => setDocumentPreview(null)}
        />
      )}

      {/* ── Archive confirmation ── */}
      {archiveOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(36,21,18,0.55)' }}
          onMouseDown={event => { if (event.target === event.currentTarget) closeArchiveModal(); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-modal-title"
            style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, width: '100%', maxWidth: 460, boxShadow: '0 24px 60px -20px rgba(36,21,18,0.4)' }}
          >
            <div style={{ padding: '22px 24px 8px' }}>
              <h2 id="archive-modal-title" style={{ ...display, fontSize: '1.25rem', fontWeight: 600, color: INK }}>Archive Submission Records?</h2>
              <p style={{ ...body, fontSize: '0.86rem', lineHeight: 1.6, color: MUTED, marginTop: 8 }}>
                You are about to archive {selectedIds.length} submission record{selectedIds.length === 1 ? '' : 's'}.
              </p>
              <p style={{ ...body, fontSize: '0.86rem', lineHeight: 1.6, color: MUTED, marginTop: 6 }}>
                The records and uploaded files will be preserved for historical reference.
              </p>
              {archiveError && (
                <div role="alert" className="flex items-start gap-2" style={{ background: '#FBEAE8', border: '1px solid #F0CFCB', borderRadius: 10, padding: '10px 12px', marginTop: 14 }}>
                  <AlertTriangle size={15} style={{ color: DANGER, marginTop: 1, flexShrink: 0 }} />
                  <span style={{ ...body, fontSize: '0.8rem', color: DANGER }}>{archiveError}</span>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2" style={{ padding: '16px 24px 22px' }}>
              <button
                type="button"
                onClick={closeArchiveModal}
                disabled={archiving}
                style={{ ...body, height: 40, padding: '0 18px', borderRadius: 10, border: `1px solid ${BORDER}`, background: '#fff', color: INK, fontSize: '0.82rem', fontWeight: 600, cursor: archiving ? 'default' : 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleArchiveSelected}
                disabled={archiving}
                style={{ ...body, height: 40, padding: '0 18px', borderRadius: 10, border: `1px solid ${PRIMARY}`, background: PRIMARY, color: '#fff', fontSize: '0.82rem', fontWeight: 700, cursor: archiving ? 'wait' : 'pointer', opacity: archiving ? 0.7 : 1 }}
              >
                {archiving ? 'Archiving…' : `Archive ${selectedIds.length} Record${selectedIds.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}