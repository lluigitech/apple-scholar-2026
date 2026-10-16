import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  Search, CheckCircle2, XCircle, Clock, FileText, GraduationCap,
  School, FolderOpen, Download, Eye, Users, AlarmClock, Flag, RefreshCw, CalendarDays,
} from 'lucide-react';

// Reusing your existing shared components instead of duplicating them
import FilePreviewModal from '../../components/Officer/ManualValidation/FilePreviewModal';
import ReviewModal from '../../components/Officer/ManualValidation/ReviewModal';
import { fileKind } from '../../utils/submissionHelpers';
import { formatYearLevelLabel } from '../../utils/yearLevelLabels';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;

const normalizeYearLevelKey = value => {
  const normalized = String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  const aliases = {
    grade7: 'grade_7', 'grade 7': 'grade_7',
    grade8: 'grade_8', 'grade 8': 'grade_8',
    grade9: 'grade_9', 'grade 9': 'grade_9',
    grade10: 'grade_10', 'grade 10': 'grade_10',
    grade11: 'grade_11', 'grade 11': 'grade_11',
    grade12: 'grade_12', 'grade 12': 'grade_12',
    '1st year': 'college_1', '1st year college': 'college_1', 'college 1': 'college_1',
    '2nd year': 'college_2', '2nd year college': 'college_2', 'college 2': 'college_2',
    '3rd year': 'college_3', '3rd year college': 'college_3', 'college 3': 'college_3',
    '4th year': 'college_4', '4th year college': 'college_4', 'college 4': 'college_4',
    '5th year': 'college_5', '5th year college': 'college_5', 'college 5': 'college_5',
  };
  return aliases[normalized] || normalized.replace(/\s+/g, '_') || 'unassigned';
};

// ── Apple Scholar branding tokens (Officer Portal) ────────────
const BG = '#F7F4EE';        // page background
const SURFACE = '#FFFDF9';   // card surface
const MAROON = '#6D2140';    // primary
const MAROON_DEEP = '#4A1729';
const GOLD = '#A9784E';      // accent
const BORDER = '#E7D8C7';    // border
const SUCCESS = '#2F855A';
const WARNING = '#D97706';
const DANGER = '#B91C1C';
const INK = '#241512';
const MUTED = '#8A7A68';
const PAPER = '#FCF9F4';     // row hover / quiet surface

const SHADOW_CARD = '0 1px 2px rgba(36,21,18,0.05), 0 6px 18px -12px rgba(109,33,64,0.18)';
const SHADOW_LIFT = '0 6px 16px rgba(36,21,18,0.08), 0 18px 40px -18px rgba(109,33,64,0.30)';
const RADIUS = 16;
const RADIUS_SM = 12;

const serif = { fontFamily: "'Lora', serif" };
const sans = { fontFamily: "'Inter', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', ui-monospace, Menlo, monospace" };

const PAGE_SIZE = 10;

const authHeader = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

// ── Status mapping (existing statuses; returned / under_review shown explicitly) ──
const SEAL_MAP = {
  approved:     { label: 'Approved',     color: SUCCESS },
  passed:       { label: 'Passed',       color: SUCCESS },
  rejected:     { label: 'Rejected',     color: DANGER },
  failed:       { label: 'Failed',       color: DANGER },
  pending:      { label: 'Pending',      color: WARNING },
  under_review: { label: 'Under Review', color: WARNING },
  returned:     { label: 'Returned',     color: GOLD },
};
const NEEDS_REVIEW_STATUSES = ['pending', 'under_review', 'returned', 'rejected'];
const statusKeyOf = item => String(item?.status || 'pending').toLowerCase();
const isNeedsReview = item => NEEDS_REVIEW_STATUSES.includes(statusKeyOf(item));
const isFlaggedEntry = e => e.scholar.hasNegative || e.item.sentiment_label?.includes('Negative');

const StatusPill = ({ status }) => {
  const key = String(status || 'pending').toLowerCase();
  const s = SEAL_MAP[key] || SEAL_MAP.pending;
  const Icon = key === 'approved' || key === 'passed' ? CheckCircle2
    : key === 'rejected' || key === 'failed' ? XCircle : Clock;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full whitespace-nowrap"
      style={{ ...sans, fontSize: '0.68rem', fontWeight: 700, color: s.color, background: `${s.color}14`, border: `1px solid ${s.color}35` }}>
      <Icon size={12} strokeWidth={2.4} />{s.label}
    </span>
  );
};

// Keep one active letter per calendar month while preserving returned history.
const getVisibleMonthlyLetters = (letters = []) => {
  const sorted = [...letters].sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  const includedNonRejectedMonths = new Set();
  return sorted.filter(item => {
    const submittedAt = item.submitted_at ? new Date(item.submitted_at) : null;
    const monthKey = submittedAt ? `${submittedAt.getFullYear()}-${submittedAt.getMonth()}` : 'undated';
    if (item.status === 'rejected' || item.status === 'returned') return true;
    if (includedNonRejectedMonths.has(monthKey)) return false;
    includedNonRejectedMonths.add(monthKey);
    return true;
  });
};

// Entries per category for a list of scholars (same mapping as before).
const buildCategoryEntries = list => ({
  letters: list.flatMap(s => getVisibleMonthlyLetters(s.monthly_letters).map(item => ({ scholar: s, item }))),
  grades: list.flatMap(s => (s.grades || []).map(item => ({ scholar: s, item }))),
  cor: list.flatMap(s => (s.cors || []).map(item => ({ scholar: s, item }))),
  docs: list.flatMap(s => [
    ...(s.report_cards || []).map(item => ({ ...item, document_label: 'Report Card' })),
    ...(s.other_documents || []),
  ].map(item => ({ scholar: s, item }))),
});

const fmtDate = d => {
  if (!d) return '—';
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

// ── Small UI pieces ───────────────────────────────────────────
const Card = ({ children, style = {}, className = '' }) => (
  <div className={className} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: SHADOW_CARD, ...style }}>
    {children}
  </div>
);

const SummaryCard = ({ icon: Icon, label, value, sub, color }) => (
  <Card className="min-w-0" style={{ padding: '16px 18px' }}>
    <div className="flex items-center gap-3.5">
      <span className="flex items-center justify-center flex-shrink-0 rounded-full" style={{ width: 42, height: 42, background: `${color}14`, color }}>
        <Icon size={19} strokeWidth={1.9} />
      </span>
      <div className="min-w-0">
        <p style={{ ...sans, fontSize: '0.74rem', fontWeight: 600, color: MUTED }}>{label}</p>
        <p style={{ ...serif, fontSize: '1.7rem', fontWeight: 700, color: INK, lineHeight: 1.1 }}>{value}</p>
        <p className="truncate" style={{ ...sans, fontSize: '0.7rem', color: MUTED, marginTop: 1 }}>{sub}</p>
      </div>
    </div>
  </Card>
);

const YearChip = ({ group, selected, onSelect }) => {
  const barColor = group.percentage >= 90 ? SUCCESS : group.percentage >= 70 ? WARNING : DANGER;
  return (
    <button onClick={onSelect} aria-pressed={selected}
      className="yq-chip text-left transition-colors"
      style={{
        padding: '16px 18px', borderRadius: RADIUS, cursor: 'pointer',
        background: selected ? '#F3E7EC' : SURFACE,
        border: `1.5px solid ${selected ? MAROON : BORDER}`,
        boxShadow: selected ? 'none' : SHADOW_CARD,
      }}>
      <div className="flex items-baseline justify-between gap-3">
        <span style={{ ...serif, fontSize: '1.02rem', fontWeight: 700, color: selected ? MAROON : INK }}>{group.label}</span>
        <span style={{ ...sans, fontSize: '0.82rem', fontWeight: 700, color: selected ? MAROON : MUTED }}>{group.percentage}%</span>
      </div>
      <div className="rounded-full" style={{ height: 7, background: '#EFE5D8', overflow: 'hidden', marginTop: 12 }}>
        <div style={{ height: '100%', width: `${group.percentage}%`, background: barColor, borderRadius: 999 }} />
      </div>
      <p style={{ ...sans, fontSize: '0.76rem', color: MUTED, marginTop: 8 }}>
        <span style={{ ...mono, fontWeight: 600, color: INK }}>{group.submitted}/{group.total}</span> scholars submitted
      </p>
      <div className="grid grid-cols-4 gap-1.5" style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
        {[
          { key: 'letters', label: 'Monthly' },
          { key: 'grades', label: 'Grades' },
          { key: 'cor', label: 'COR' },
          { key: 'docs', label: 'Other' },
        ].map(c => (
          <div key={c.key} className="min-w-0">
            <p style={{ ...serif, fontSize: '1.05rem', fontWeight: 700, color: INK, lineHeight: 1.1 }}>{group.counts[c.key]}</p>
            <p className="truncate" style={{ ...sans, fontSize: '0.66rem', color: MUTED, marginTop: 2 }}>{c.label}</p>
          </div>
        ))}
      </div>
      <p style={{ ...sans, fontSize: '0.72rem', fontWeight: 600, color: group.needsReview ? WARNING : MUTED, marginTop: 10 }}>
        {group.needsReview ? `${group.needsReview} record${group.needsReview !== 1 ? 's' : ''} need review` : 'No records need review'}
      </p>
    </button>
  );
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Needs Review' },
  { key: 'flagged', label: 'Flagged' },
];

const CATEGORIES = [
  { key: 'letters', label: 'Monthly Letters', icon: FileText },
  { key: 'grades', label: 'Grades', icon: GraduationCap },
  { key: 'cor', label: 'COR', icon: School },
  { key: 'docs', label: 'Other Documents', icon: FolderOpen },
];

const pageWindow = (page, pages) => {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 3) { set.add(2); set.add(3); set.add(4); }
  if (page >= pages - 2) { set.add(pages - 1); set.add(pages - 2); set.add(pages - 3); }
  const list = [...set].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b);
  return list.flatMap((n, i) => (i && n - list[i - 1] > 1 ? ['…', n] : [n]));
};

const Pagination = ({ page, pages, total, from, to, onChange }) => {
  const nav = (label, aria, target, disabled) => (
    <button key={aria} onClick={() => onChange(target)} disabled={disabled} aria-label={aria}
      style={{ ...sans, width: 32, height: 32, borderRadius: 10, fontSize: '0.9rem', fontWeight: 600, border: `1px solid ${BORDER}`, background: SURFACE, color: INK, opacity: disabled ? 0.4 : 1, cursor: disabled ? 'default' : 'pointer' }}>
      {label}
    </button>
  );
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3.5" style={{ borderTop: `1px solid ${BORDER}` }}>
      <p style={{ ...sans, fontSize: '0.76rem', color: MUTED }}>Showing {from}–{to} of {total} submission{total !== 1 ? 's' : ''}</p>
      {pages > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {nav('‹', 'Previous page', page - 1, page <= 1)}
          {pageWindow(page, pages).map((n, i) => n === '…'
            ? <span key={`gap-${i}`} style={{ ...sans, fontSize: '0.8rem', color: MUTED, padding: '0 4px' }}>…</span>
            : (
              <button key={n} onClick={() => onChange(n)} aria-current={page === n ? 'page' : undefined}
                style={{ ...sans, minWidth: 32, height: 32, padding: '0 6px', borderRadius: 10, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${page === n ? MAROON : BORDER}`, background: page === n ? MAROON : SURFACE, color: page === n ? '#fff' : INK }}>
                {n}
              </button>
            ))}
          {nav('›', 'Next page', page + 1, page >= pages)}
        </div>
      )}
    </div>
  );
};

const selectStyle = {
  ...sans, fontSize: '0.8rem', color: INK, background: SURFACE, border: `1px solid ${BORDER}`,
  borderRadius: 10, height: 40, padding: '0 12px', outline: 'none', width: '100%',
};

const FilterField = ({ label, children, style }) => (
  <label className="flex flex-col gap-1.5" style={style}>
    <span style={{ ...sans, fontSize: '0.68rem', fontWeight: 600, color: MUTED }}>{label}</span>
    {children}
  </label>
);

// ── Per-category row description (real fields only) ───────────
const describeEntry = (category, scholar, item, resolveFile) => {
  let typeLabel = 'Document';
  let docLabel = 'Document';
  let extras = [];
  let previewPath = null;

  if (category === 'letters') {
    const submitted = new Date(item.submitted_at);
    typeLabel = 'Monthly Letter';
    docLabel = `MonthlyLetter_${submitted.toLocaleDateString('en-US', { month: 'short' })}${submitted.getFullYear()}.pdf`;
    previewPath = item.generated_pdf_path;
    if (Number.isFinite(Number(item.quality_score))) extras.push({ text: `Quality ${Math.round(item.quality_score)}`, color: SUCCESS });
    if (item.sentiment_label) extras.push({ text: item.sentiment_label, color: item.sentiment_label.includes('Negative') ? DANGER : SUCCESS });
  } else if (category === 'grades') {
    typeLabel = 'Grades';
    docLabel = `${item.semester} · AY ${item.academic_year}`;
    previewPath = item.proof_path;
    extras.push({ text: `GWA ${item.gwa ?? '—'}`, color: MUTED });
  } else if (category === 'cor') {
    typeLabel = 'COR';
    docLabel = 'Certificate of Registration';
    previewPath = item.cor_path;
  } else {
    typeLabel = item.document_label === 'Report Card' ? 'Report Card' : 'Other Document';
    docLabel = item.document_label || item.media?.[0]?.description || item.description || 'Document';
    previewPath = item.report_card_path || item.media?.[0]?.file_path || item.file_path || null;
  }

  const { url } = resolveFile(previewPath);
  return {
    typeLabel, docLabel, extras, previewPath, url,
    dateText: fmtDate(item.submitted_at),
    status: statusKeyOf(item),
    yearLabel: formatYearLevelLabel(normalizeYearLevelKey(scholar.year_level)),
  };
};

const Avatar = ({ name, id, selected }) => (
  <span className="flex items-center justify-center flex-shrink-0 rounded-full"
    style={{ width: 34, height: 34, background: selected ? MAROON : '#F3E7EC', color: selected ? '#fff' : MAROON, ...serif, fontWeight: 700, fontSize: '0.8rem' }}>
    {(name || id || '?').charAt(0).toUpperCase()}
  </span>
);

const ActionButtons = ({ category, item, d, onPreview, onGeneratePdf, pdfBusy }) => (
  <div className="flex items-center gap-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
    {d.url ? (
      <>
        <button onClick={() => onPreview(d.previewPath, d.docLabel)} aria-label={`Open ${d.docLabel}`}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full transition-opacity hover:opacity-80"
          style={{ ...sans, fontSize: '0.68rem', fontWeight: 700, color: MAROON, background: SURFACE, border: `1px solid ${BORDER}`, cursor: 'pointer' }}>
          <Eye size={12} /> Open
        </button>
        <a href={d.url} download aria-label={`Download ${d.docLabel}`}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full transition-opacity hover:opacity-85"
          style={{ ...sans, fontSize: '0.68rem', fontWeight: 700, color: '#fff', backgroundColor: MAROON, textDecoration: 'none' }}>
          <Download size={12} /> Download
        </a>
      </>
    ) : category === 'letters' ? (
      <button onClick={() => onGeneratePdf(item.id)} disabled={pdfBusy}
        className="px-3 py-1.5 rounded-full transition-opacity hover:opacity-85 disabled:opacity-50"
        style={{ ...sans, fontSize: '0.68rem', fontWeight: 700, backgroundColor: GOLD, color: '#fff', border: 'none', cursor: pdfBusy ? 'default' : 'pointer' }}>
        {pdfBusy ? 'Generating…' : 'Generate PDF'}
      </button>
    ) : (
      <span style={{ ...sans, fontSize: '0.7rem', color: '#B8A999' }}>No file</span>
    )}
  </div>
);

const SelectBox = ({ selected, onToggle, label }) => (
  <button onClick={e => { e.stopPropagation(); onToggle(); }} role="checkbox" aria-checked={selected} aria-label={label}
    className="flex items-center justify-center flex-shrink-0"
    style={{ width: 18, height: 18, borderRadius: 5, cursor: 'pointer', border: `1.5px solid ${selected ? MAROON : BORDER}`, background: selected ? MAROON : '#fff', padding: 0 }}>
    {selected && (
      <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    )}
  </button>
);

// ────────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────────
const OfficerManualValidation = () => {
  const navigate = useNavigate();
  const [scholars, setScholars] = useState([]);
  const [assignedYearLevels, setAssignedYearLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [authFailure, setAuthFailure] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);

  const [selectedYearLevel, setSelectedYearLevel] = useState(null);
  const [activeCategory, setActiveCategory] = useState('letters');
  const [academicYear, setAcademicYear] = useState('all');
  const [semester, setSemester] = useState('all');
  const [selectedEntry, setSelectedEntry] = useState(null); // { scholar, item }
  const [page, setPage] = useState(1);

  const [modal, setModal] = useState(null);
  const [decision, setDecision] = useState('rejected');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  const [filePreview, setFilePreview] = useState(null);
  const [generatingPdfId, setGeneratingPdfId] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError('');
      setAuthFailure(false);
      const [scholarsRes, assignmentsRes] = await Promise.all([
        axios.get(`${API}/submission/scholar-view`, { headers: authHeader() }),
        axios.get(`${API}/officer/assigned-year-levels`, { headers: authHeader() }),
      ]);
      if (!Array.isArray(scholarsRes.data) || !Array.isArray(assignmentsRes.data)) {
        throw new Error('The live scholar or assignment API returned an unexpected response.');
      }
      setScholars(scholarsRes.data);
      setAssignedYearLevels(assignmentsRes.data);
    } catch (e) {
      console.error('Error fetching scholar view:', e);
      const responseMessage = e.response?.data?.message || e.response?.data?.error;
      const invalidToken = /invalid or expired token|no token provided/i.test(responseMessage || '');
      const roleDenied = /insufficient role/i.test(responseMessage || '');
      setAuthFailure(e.response?.status === 401 || invalidToken || roleDenied);
      setFetchError(roleDenied
        ? `This session does not have permission to view officer submissions. Signed-in role: ${localStorage.getItem('role') || 'unknown'}.`
        : invalidToken
          ? 'Your sign-in session has expired or is invalid.'
          : responseMessage || e.message || 'Unable to fetch live submissions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => { await fetchData(); })();
  }, [fetchData]);

  // Precompute per-scholar stats once per fetch instead of on every render/row.
  // NOTE: assumes each scholar record carries a `year_level` field (e.g.
  // "1st Year"). Adjust the key below if your API names it differently.
  const scholarStats = useMemo(() => scholars.map(s => {
    const visibleLetters = getVisibleMonthlyLetters(s.monthly_letters);
    const flatItems = [...visibleLetters, ...s.grades, ...s.report_cards, ...s.cors, ...s.other_documents];
    const pendingCount = flatItems.filter(isNeedsReview).length;
    const hasNegative = visibleLetters.some(l => l.sentiment_label?.includes('Negative'));
    const allDates = flatItems.map(x => x.submitted_at).filter(Boolean);
    const lastSubmittedAt = allDates.length
      ? new Date(Math.max(...allDates.map(d => new Date(d).getTime())))
      : null;
    return { ...s, pendingCount, hasNegative, lastSubmittedAt };
  }), [scholars]);

  // Year Level Queue — one entry per year level present in this officer's
  // assigned scholars, with submitted/total counts and a progress bar.
  const yearLevelGroups = useMemo(() => {
    const map = new Map();
    assignedYearLevels.forEach(level => {
      const key = normalizeYearLevelKey(level);
      if (!map.has(key)) map.set(key, []);
    });
    scholarStats.forEach(s => {
      const key = normalizeYearLevelKey(s.year_level);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    });
    return Array.from(map.entries()).map(([key, group]) => {
      const total = group.length;
      const submitted = group.filter(s => s.lastSubmittedAt).length;
      const percentage = total ? Math.round((submitted / total) * 100) : 0;
      // Compliance records per category for this year level (real submitted records).
      const entries = buildCategoryEntries(group);
      const counts = {
        letters: entries.letters.length,
        grades: entries.grades.length,
        cor: entries.cor.length,
        docs: entries.docs.length,
      };
      const needsReview = Object.values(entries).flat().filter(e => isNeedsReview(e.item)).length;
      return { key, label: formatYearLevelLabel(key), total, submitted, percentage, counts, needsReview };
    }).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  }, [scholarStats, assignedYearLevels]);

  const selectedYearLevelKey = selectedYearLevel ? normalizeYearLevelKey(selectedYearLevel) : null;
  const defaultYearLevel = yearLevelGroups.find(group => group.total > 0)?.key ?? yearLevelGroups[0]?.key ?? null;
  const effectiveYearLevel = yearLevelGroups.some(g => g.key === selectedYearLevelKey)
    ? selectedYearLevelKey
    : defaultYearLevel;
  const activeYearGroup = yearLevelGroups.find(g => g.key === effectiveYearLevel) || null;

  // Any filter / scope change returns the table to page 1.
  useEffect(() => { setPage(1); }, [search, activeFilter, academicYear, semester, activeCategory, effectiveYearLevel]);

  const selectYearLevel = key => {
    setSelectedYearLevel(key);
    setSelectedEntry(null);
  };

  const selectCategory = key => {
    setActiveCategory(key);
    setSelectedEntry(null);
  };

  const scopedScholars = useMemo(() => (
    activeYearGroup ? scholarStats.filter(s => normalizeYearLevelKey(s.year_level) === activeYearGroup.key) : scholarStats
  ), [scholarStats, activeYearGroup]);

  // All entries per category, scoped to the selected year level only —
  // used for the category counts (unaffected by search/status filters).
  const categoryEntriesAll = useMemo(() => buildCategoryEntries(scopedScholars), [scopedScholars]);

  // Page-level summary across ALL assigned scholars (every year level).
  // Scholars and submitted records are counted separately.
  const summary = useMemo(() => {
    const all = Object.values(buildCategoryEntries(scholarStats)).flat();
    return {
      scholars: scholarStats.length,
      yearLevels: yearLevelGroups.filter(g => g.total > 0).length,
      records: all.length,
      needsReview: all.filter(e => isNeedsReview(e.item)).length,
      approved: all.filter(e => ['approved', 'passed'].includes(statusKeyOf(e.item))).length,
      flagged: all.filter(isFlaggedEntry).length,
    };
  }, [scholarStats, yearLevelGroups]);

  const academicYearOptions = useMemo(() => {
    const set = new Set();
    scholarStats.forEach(s => (s.grades || []).forEach(g => g.academic_year && set.add(g.academic_year)));
    return Array.from(set).sort().reverse();
  }, [scholarStats]);

  const semesterOptions = useMemo(() => {
    const set = new Set();
    scholarStats.forEach(s => (s.grades || []).forEach(g => g.semester && set.add(g.semester)));
    return Array.from(set).sort();
  }, [scholarStats]);

  // The active category's entries, further narrowed by search, the
  // All / Needs Review / Flagged filter, and (for Grades) AY + Semester.
  const displayedEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = categoryEntriesAll[activeCategory] || [];
    if (q) {
      list = list.filter(e => (e.scholar.full_name || '').toLowerCase().includes(q) || (e.scholar.scholar_id || '').toLowerCase().includes(q));
    }
    if (activeFilter === 'pending') {
      list = list.filter(e => isNeedsReview(e.item));
    }
    if (activeFilter === 'flagged') {
      list = list.filter(isFlaggedEntry);
    }
    if (activeCategory === 'grades') {
      if (academicYear !== 'all') list = list.filter(e => e.item.academic_year === academicYear);
      if (semester !== 'all') list = list.filter(e => e.item.semester === semester);
    }
    return [...list].sort((a, b) => {
      const ap = isNeedsReview(a.item) ? 0 : 1;
      const bp = isNeedsReview(b.item) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return (a.scholar.full_name || '').localeCompare(b.scholar.full_name || '');
    });
  }, [categoryEntriesAll, activeCategory, search, activeFilter, academicYear, semester]);

  const pages = Math.max(1, Math.ceil(displayedEntries.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageEntries = displayedEntries.slice(pageStart, pageStart + PAGE_SIZE);
  const rangeFrom = displayedEntries.length ? pageStart + 1 : 0;
  const rangeTo = Math.min(pageStart + PAGE_SIZE, displayedEntries.length);

  const hasFilters = !!search || activeFilter !== 'all' || academicYear !== 'all' || semester !== 'all';
  const resetFilters = () => {
    setSearch(''); setActiveFilter('all'); setAcademicYear('all'); setSemester('all');
  };

  const buildMeta = (scholar, item) => (
    activeCategory === 'grades'
      ? { ...item, full_name: scholar.full_name, scholar_id: scholar.scholar_id, is_grades: true }
      : { ...item, full_name: scholar.full_name, scholar_id: scholar.scholar_id }
  );

  const selectedMeta = selectedEntry ? buildMeta(selectedEntry.scholar, selectedEntry.item) : null;
  const selectedBusyKey = selectedMeta
    ? (selectedMeta.is_grades ? `grades-${selectedMeta.scholar_id}-${selectedMeta.semester}-${selectedMeta.academic_year}` : selectedMeta.id)
    : null;
  const selectedBusy = selectedBusyKey != null && busyId === selectedBusyKey;

  const handleReview = async (item, status, staff_comment) => {
    const busyKey = item.is_grades
      ? `grades-${item.scholar_id}-${item.semester}-${item.academic_year}`
      : item.id;
    setBusyId(busyKey);
    try {
      if (item.is_grades) {
        await axios.put(`${API}/submission/grades/review`, {
          scholar_id: item.scholar_id, semester: item.semester, academic_year: item.academic_year,
          status, staff_comment,
        }, { headers: authHeader() });
      } else {
        await axios.put(`${API}/submission/review/${item.id}`, { status, staff_comment }, { headers: authHeader() });
      }
      await fetchData();
    } catch (e) {
      console.error('Review error:', e);
    } finally {
      setBusyId(null);
    }
  };

  const handleApproveSelected = async () => {
    if (!selectedMeta) return;
    await handleReview(selectedMeta, 'approved', '');
    setSelectedEntry(null);
  };

  const handleOpenReject = (item) => {
    setModal(item);
    setDecision('rejected');
    setFeedback('');
  };

  const submitReview = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      if (modal.is_grades) {
        await axios.put(`${API}/submission/grades/review`, {
          scholar_id: modal.scholar_id, semester: modal.semester, academic_year: modal.academic_year,
          status: decision, staff_comment: feedback,
        }, { headers: authHeader() });
      } else {
        await axios.put(`${API}/submission/review/${modal.id}`, { status: decision, staff_comment: feedback }, { headers: authHeader() });
      }
      setModal(null);
      setSelectedEntry(null);
      await fetchData();
    } catch (e) {
      console.error('Review error:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePdf = async (submissionId) => {
    setGeneratingPdfId(submissionId);
    try {
      await axios.get(`${API}/submission/generate-pdf/${submissionId}`, { headers: authHeader() });
      await fetchData();
    } catch (e) {
      console.error('Error generating PDF:', e);
    } finally {
      setGeneratingPdfId(null);
    }
  };

  // Builds an absolute, directly-loadable URL (and detected kind) for a
  // stored file path — shared by the preview modal and the file list.
  const resolveFile = (path) => {
    if (!path) return { url: null, kind: null };
    const backendRoot = API.replace(/\/api$/, '');
    const normalized = path.startsWith('/') ? `${backendRoot}${path}` : path;
    const url = normalized.includes('res.cloudinary.com')
      ? `${API}/submission/preview?url=${encodeURIComponent(normalized)}`
      : normalized;
    return { url, kind: fileKind(normalized) };
  };

  const handlePreview = (path, label = 'File Preview', description = null) => {
    if (!path) return;
    const { url, kind } = resolveFile(path);
    setFilePreview({ url, kind, label, description });
  };

  const todayLabel = new Date().toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const activeCategoryMeta = CATEGORIES.find(c => c.key === activeCategory);
  const isSelected = (scholar, item) => selectedEntry?.scholar.scholar_id === scholar.scholar_id && selectedEntry?.item === item;
  const toggleSelect = (scholar, item) => {
    setSelectedEntry(isSelected(scholar, item) ? null : { scholar, item });
  };
  const rowKey = (scholar, item) => `${scholar.scholar_id}-${activeCategory}-${item.id ?? `${item.semester}-${item.academic_year}`}`;

  const thStyle = { ...sans, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED, padding: '11px 14px', textAlign: 'left', background: BG, borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' };
  const tdStyle = { padding: '12px 14px', verticalAlign: 'middle' };

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: BG, ...sans }}>
      <style>{`
        .ov-input:focus, .ov-select:focus { border-color: ${MAROON} !important; box-shadow: 0 0 0 3px rgba(109,33,64,.10); }
        .ov-row { transition: background-color 150ms ease; }
        .ov-row:hover { background: ${PAPER}; }
        .ov-btn:focus-visible, .ov-tab:focus-visible { outline: 2px solid ${MAROON}; outline-offset: 2px; }
        .ov-scroll::-webkit-scrollbar { height: 6px; }
        .ov-scroll::-webkit-scrollbar-thumb { background: rgba(109,33,64,.18); border-radius: 999px; }
        .yq-grid { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 6px; }
        .yq-chip { flex: 0 0 230px; }
        @media (min-width: 768px) {
          .yq-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); overflow: visible; padding-bottom: 0; }
          .yq-chip { flex: initial; }
        }
      `}</style>

      <div className="px-5 sm:px-8 pt-8 flex flex-col gap-5" style={{ paddingBottom: selectedEntry ? 110 : 32 }}>

        {/* ── Standard Officer header: title card + date card ── */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '20px 24px', boxShadow: SHADOW_CARD }}>
            <p style={{ ...sans, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', color: GOLD }}>OFFICER PORTAL</p>
            <h1 style={{ ...serif, fontSize: '1.75rem', fontWeight: 700, color: INK, marginTop: 4 }}>Scholar Submissions</h1>
            <p style={{ ...sans, fontSize: '0.84rem', color: MUTED, marginTop: 6, maxWidth: 640 }}>
              Review and validate scholar submissions for compliance.
            </p>
          </div>
          <div className="flex items-stretch gap-3">
            <div className="flex items-center gap-3" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '16px 24px', boxShadow: SHADOW_CARD }}>
              <div className="flex items-center justify-center flex-shrink-0" style={{ width: 42, height: 42, borderRadius: 12, background: `${MAROON}10` }}>
                <CalendarDays size={19} style={{ color: MAROON }} />
              </div>
              <div>
                <p style={{ ...sans, fontSize: '0.68rem', color: MUTED }}>Today</p>
                <p style={{ ...sans, fontSize: '0.92rem', fontWeight: 600, color: INK, whiteSpace: 'nowrap' }}>{todayLabel}</p>
              </div>
            </div>
            <button onClick={fetchData} disabled={loading} aria-label="Refresh submissions"
              className="ov-btn flex items-center gap-2 px-4 transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ ...sans, fontSize: '0.78rem', fontWeight: 700, color: MAROON, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: SHADOW_CARD, cursor: loading ? 'default' : 'pointer' }}>
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: MUTED, ...sans }}>
            <Clock size={14} className="animate-spin" /> Retrieving records...
          </div>
        ) : fetchError ? (
          <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl px-4 py-4" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: DANGER }}>
            <p style={{ ...sans, fontSize: '0.82rem', fontWeight: 700 }}>Could not load live submissions: {fetchError}</p>
            <button
              onClick={() => {
                if (authFailure) {
                  ['token', 'role', 'name', 'email', 'id', 'scholar_id', 'must_change_password'].forEach(key => localStorage.removeItem(key));
                  navigate('/login', { replace: true });
                  return;
                }
                fetchData();
              }}
              className="px-3 py-1.5 rounded-full"
              style={{ ...sans, fontSize: '0.72rem', fontWeight: 700, background: '#fff', border: `1px solid ${BORDER}`, color: MAROON, cursor: 'pointer' }}
            >
              {authFailure ? 'Sign in again' : 'Retry'}
            </button>
          </div>
        ) : (
          <>
            {/* ── Summary cards (assigned scholars vs. submitted records) ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryCard icon={Users} label="Assigned Scholars" value={summary.scholars} color={MAROON}
                sub={`${summary.yearLevels} year level${summary.yearLevels !== 1 ? 's' : ''} · ${summary.records} submitted record${summary.records !== 1 ? 's' : ''}`} />
              <SummaryCard icon={AlarmClock} label="Needs Review" value={summary.needsReview} color={WARNING}
                sub="Pending, returned, or rejected records" />
              <SummaryCard icon={CheckCircle2} label="Approved Records" value={summary.approved} color={SUCCESS}
                sub="Approved or verified records" />
              <SummaryCard icon={Flag} label="Flagged Records" value={summary.flagged} color={DANGER}
                sub="Matches the Flagged filter" />
            </div>

            {/* ── Year Level Queue ── */}
            <section aria-label="Year level queue">
              <p style={{ ...sans, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: GOLD, marginBottom: 10 }}>Year Level Queue</p>
              {yearLevelGroups.length === 0 ? (
                <p style={{ ...sans, fontSize: '0.8rem', color: MUTED }}>No assigned year levels.</p>
              ) : (
                <div className="ov-scroll yq-grid">
                  {yearLevelGroups.map(g => (
                    <YearChip key={g.key} group={g} selected={g.key === effectiveYearLevel} onSelect={() => selectYearLevel(g.key)} />
                  ))}
                </div>
              )}
            </section>

            {/* ── Submissions workspace ── */}
            <Card className="min-w-0" style={{ overflow: 'hidden' }}>

              {/* Filter toolbar */}
              <div className="flex flex-wrap items-end gap-3 px-4 sm:px-5 py-4" style={{ background: BG, borderBottom: `1px solid ${BORDER}` }}>
                <FilterField label="Search" style={{ flex: '1 1 240px', minWidth: 200 }}>
                  <div className="relative">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#B8A999' }} />
                    <input value={search} onChange={e => setSearch(e.target.value)} aria-label="Search scholar name or ID"
                      placeholder="Scholar name or ID…" className="ov-input"
                      style={{ ...selectStyle, paddingLeft: 34 }} />
                  </div>
                </FilterField>
                <FilterField label="Submission category" style={{ flex: '0 1 190px', minWidth: 150 }}>
                  <select className="ov-select" style={selectStyle} value={activeCategory} onChange={e => selectCategory(e.target.value)} aria-label="Submission category">
                    {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label} ({categoryEntriesAll[c.key]?.length ?? 0})</option>)}
                  </select>
                </FilterField>
                <div className="flex flex-col gap-1.5">
                  <span style={{ ...sans, fontSize: '0.68rem', fontWeight: 600, color: MUTED }}>Status</span>
                  <div className="flex gap-1.5" role="group" aria-label="Status filter">
                    {FILTERS.map(f => (
                      <button key={f.key} onClick={() => setActiveFilter(f.key)} aria-pressed={activeFilter === f.key}
                        className="ov-btn px-3.5 transition-colors flex-shrink-0"
                        style={{ ...sans, height: 40, fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', borderRadius: 10,
                          background: activeFilter === f.key ? MAROON : SURFACE, color: activeFilter === f.key ? '#fff' : MAROON,
                          border: `1px solid ${activeFilter === f.key ? MAROON : BORDER}` }}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                {activeCategory === 'grades' && (
                  <>
                    <FilterField label="Academic year" style={{ flex: '0 1 150px', minWidth: 130 }}>
                      <select className="ov-select" style={selectStyle} value={academicYear} onChange={e => setAcademicYear(e.target.value)} aria-label="Academic year">
                        <option value="all">All Academic Years</option>
                        {academicYearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </FilterField>
                    <FilterField label="Semester" style={{ flex: '0 1 150px', minWidth: 130 }}>
                      <select className="ov-select" style={selectStyle} value={semester} onChange={e => setSemester(e.target.value)} aria-label="Semester">
                        <option value="all">All Semesters</option>
                        {semesterOptions.map(sVal => <option key={sVal} value={sVal}>{sVal}</option>)}
                      </select>
                    </FilterField>
                  </>
                )}
                <button onClick={resetFilters} disabled={!hasFilters}
                  className="ov-btn px-4 transition-opacity"
                  style={{ ...sans, height: 40, fontSize: '0.78rem', fontWeight: 600, color: MAROON, background: SURFACE, border: `1px solid ${MAROON}`, borderRadius: 10,
                    cursor: hasFilters ? 'pointer' : 'default', opacity: hasFilters ? 1 : 0.5 }}>
                  Reset Filters
                </button>
              </div>

              {displayedEntries.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <p style={{ ...serif, fontSize: '1.05rem', fontWeight: 600, color: INK }}>
                    {hasFilters ? 'No matching submissions' : `No ${activeCategoryMeta?.label.toLowerCase() || 'records'} filed yet`}
                  </p>
                  <p style={{ ...sans, fontSize: '0.8rem', color: MUTED, marginTop: 4 }}>
                    {hasFilters ? 'Try adjusting your search or filters.' : 'Nothing has been submitted in this category for the selected year level.'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop / tablet: table */}
                  <div className="ov-scroll hidden md:block overflow-x-auto">
                    <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 960 }}>
                      <thead>
                        <tr>
                          <th style={{ ...thStyle, width: 40 }}><span className="sr-only">Select</span></th>
                          <th style={thStyle}>Scholar</th>
                          <th style={thStyle}>Year Level</th>
                          <th style={thStyle}>Submission Type</th>
                          <th style={thStyle}>{activeCategory === 'grades' ? 'Academic Period' : 'Document'}</th>
                          <th style={thStyle}>Date Submitted</th>
                          <th style={thStyle}>Status</th>
                          <th style={thStyle}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageEntries.map(({ scholar, item }) => {
                          const d = describeEntry(activeCategory, scholar, item, resolveFile);
                          const selected = isSelected(scholar, item);
                          const pdfBusy = activeCategory === 'letters' && generatingPdfId === item.id;
                          return (
                            <tr key={rowKey(scholar, item)} className="ov-row cursor-pointer" onClick={() => setSelectedEntry({ scholar, item })}
                              style={{ borderTop: `1px solid ${BORDER}`, background: selected ? `${MAROON}0d` : undefined, boxShadow: selected ? `inset 3px 0 0 ${MAROON}` : 'none' }}>
                              <td style={tdStyle}><SelectBox selected={selected} onToggle={() => toggleSelect(scholar, item)} label={`Select ${scholar.full_name || scholar.scholar_id}`} /></td>
                              <td style={tdStyle}>
                                <div className="flex items-center gap-3 min-w-0">
                                  <Avatar name={scholar.full_name} id={scholar.scholar_id} selected={selected} />
                                  <div className="min-w-0">
                                    <p style={{ ...sans, fontSize: '0.84rem', fontWeight: 600, color: INK }}>{scholar.full_name || 'Unnamed Scholar'}</p>
                                    <p style={{ ...mono, fontSize: '0.66rem', color: MUTED }}>{scholar.scholar_id}</p>
                                  </div>
                                </div>
                              </td>
                              <td style={{ ...tdStyle, ...sans, fontSize: '0.8rem', color: INK, whiteSpace: 'nowrap' }}>{d.yearLabel}</td>
                              <td style={{ ...tdStyle, ...sans, fontSize: '0.8rem', color: INK, whiteSpace: 'nowrap' }}>{d.typeLabel}</td>
                              <td style={tdStyle}>
                                <p className="break-words" style={{ ...sans, fontSize: '0.8rem', color: INK }}>{d.docLabel}</p>
                                {d.extras.length > 0 && (
                                  <div className="flex flex-wrap gap-x-2.5 mt-0.5">
                                    {d.extras.map(x => <span key={x.text} style={{ ...sans, fontSize: '0.68rem', fontWeight: 600, color: x.color }}>{x.text}</span>)}
                                  </div>
                                )}
                              </td>
                              <td style={{ ...tdStyle, ...sans, fontSize: '0.8rem', color: MUTED, whiteSpace: 'nowrap' }}>{d.dateText}</td>
                              <td style={tdStyle}><StatusPill status={d.status} /></td>
                              <td style={tdStyle}>
                                <ActionButtons category={activeCategory} item={item} d={d} onPreview={handlePreview} onGeneratePdf={handleGeneratePdf} pdfBusy={pdfBusy} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile: record cards */}
                  <div className="md:hidden flex flex-col gap-3 p-3">
                    {pageEntries.map(({ scholar, item }) => {
                      const d = describeEntry(activeCategory, scholar, item, resolveFile);
                      const selected = isSelected(scholar, item);
                      const pdfBusy = activeCategory === 'letters' && generatingPdfId === item.id;
                      return (
                        <div key={rowKey(scholar, item)} onClick={() => setSelectedEntry({ scholar, item })}
                          style={{ borderRadius: RADIUS_SM, padding: 14, cursor: 'pointer', background: selected ? `${MAROON}0d` : SURFACE, border: `1px solid ${selected ? MAROON : BORDER}` }}>
                          <div className="flex items-center gap-3">
                            <SelectBox selected={selected} onToggle={() => toggleSelect(scholar, item)} label={`Select ${scholar.full_name || scholar.scholar_id}`} />
                            <Avatar name={scholar.full_name} id={scholar.scholar_id} selected={selected} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate" style={{ ...sans, fontSize: '0.84rem', fontWeight: 600, color: INK }}>{scholar.full_name || 'Unnamed Scholar'}</p>
                              <p style={{ ...mono, fontSize: '0.66rem', color: MUTED }}>{scholar.scholar_id} · {d.yearLabel}</p>
                            </div>
                            <StatusPill status={d.status} />
                          </div>
                          <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                            <p style={{ ...sans, fontSize: '0.74rem', color: MUTED }}>{d.typeLabel} · {d.dateText}</p>
                            <p className="break-words" style={{ ...sans, fontSize: '0.82rem', color: INK, marginTop: 2 }}>{d.docLabel}</p>
                            {d.extras.length > 0 && (
                              <div className="flex flex-wrap gap-x-2.5 mt-0.5">
                                {d.extras.map(x => <span key={x.text} style={{ ...sans, fontSize: '0.68rem', fontWeight: 600, color: x.color }}>{x.text}</span>)}
                              </div>
                            )}
                            <div className="mt-3">
                              <ActionButtons category={activeCategory} item={item} d={d} onPreview={handlePreview} onGeneratePdf={handleGeneratePdf} pdfBusy={pdfBusy} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Pagination page={currentPage} pages={pages} total={displayedEntries.length} from={rangeFrom} to={rangeTo} onChange={setPage} />
                </>
              )}
            </Card>
          </>
        )}
      </div>

      {/* ── Review action dock — only visible once a submission is selected ── */}
      {selectedEntry && selectedMeta && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-4 pointer-events-none">
          <div className="pointer-events-auto w-full sm:w-auto flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3"
            style={{ borderRadius: RADIUS_SM, maxWidth: 620, background: 'rgba(255,253,249,0.97)', border: `1px solid ${BORDER}`, boxShadow: SHADOW_LIFT }}>
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <Avatar name={selectedEntry.scholar.full_name} id={selectedEntry.scholar.scholar_id} selected />
              <div className="min-w-0">
                <p className="truncate" style={{ ...sans, fontSize: '0.8rem', fontWeight: 700, color: INK }}>{selectedEntry.scholar.full_name || 'Unnamed Scholar'}</p>
                <p className="truncate" style={{ ...mono, fontSize: '0.62rem', color: MUTED }}>{selectedEntry.scholar.scholar_id}</p>
              </div>
            </div>
            {selectedMeta.status === 'approved' || selectedMeta.status === 'rejected' ? (
              <StatusPill status={selectedMeta.status} />
            ) : (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button disabled={selectedBusy} onClick={() => handleOpenReject(selectedMeta)}
                  className="ov-btn px-4 py-2 rounded-full transition-opacity hover:opacity-85 disabled:opacity-40"
                  style={{ ...sans, fontSize: '0.76rem', fontWeight: 700, background: '#fff', color: GOLD, border: `1.5px solid ${GOLD}`, cursor: 'pointer' }}>
                  Return Revision
                </button>
                <button disabled={selectedBusy} onClick={handleApproveSelected}
                  className="ov-btn px-4 py-2 rounded-full transition-opacity hover:opacity-85 disabled:opacity-40"
                  style={{ ...sans, fontSize: '0.76rem', fontWeight: 700, backgroundColor: MAROON, color: '#fff', border: 'none', cursor: 'pointer' }}>
                  {selectedBusy ? 'Saving…' : 'Approve'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* REJECT / REVIEW MODAL - shared component */}
      <ReviewModal
        modal={modal}
        decision={decision}
        setDecision={setDecision}
        feedback={feedback}
        setFeedback={setFeedback}
        saving={saving}
        onClose={() => setModal(null)}
        onSubmit={submitReview}
      />

      {/* IN-PAGE FILE PREVIEW - shared component */}
      {filePreview && (
        <FilePreviewModal preview={filePreview} onClose={() => setFilePreview(null)} />
      )}
    </div>
  );
};

export default OfficerManualValidation;