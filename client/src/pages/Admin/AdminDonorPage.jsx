import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  Users, GraduationCap, Clock, Sparkles, Download, X, HeartHandshake, FileText, CheckCircle2,
  Search, ChevronLeft, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { formatAdminMonth } from '../../utils/adminPreferences';
import AdminPageHeader from '../../components/Admin/AdminPageHeader';

/**
 * DEPENDENCIES — install if not already present:
 *   npm install recharts lucide-react
 *
 * FONTS — add to index.html <head>:
 *   <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
 */

const API_BASE = (import.meta.env?.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
const authHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
});

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const PRIMARY = '#6D2140';
const PRIMARY_DEEP = '#4A1730';
const INK = '#241512';
const MUTED = '#8A7A68';
const BRONZE = '#A9784E';
const SUCCESS = '#6B8F71';
const WARNING = '#C08A3E';
const DANGER = '#A24A4A';
const RADIUS = 16;

const display = { fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };
const surfaceCard = {
  background: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: RADIUS,
  boxShadow: '0 1px 2px rgba(36,21,18,0.04)',
};

const YEAR_LEVEL_ORDER = [
  'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
  '1st Year College', '2nd Year College', '3rd Year College', '4th Year College', '5th Year College',
];

const CHART_PALETTE = [PRIMARY, BRONZE, SUCCESS, WARNING, PRIMARY_DEEP, '#B08968', '#8A9A8C', '#D8B98C', '#C97A8B', '#9C6B4E', '#5E8A66'];

const SCHOLARS_PER_PAGE = 20;

const formatYearLevel = (value) => {
  if (!value) return '—';
  const normalized = String(value).trim().toLowerCase().replace(/_/g, ' ');
  const aliasMap = {
    'grade 7': 'Grade 7',
    'grade 8': 'Grade 8',
    'grade 9': 'Grade 9',
    'grade 10': 'Grade 10',
    'grade 11': 'Grade 11',
    'grade 12': 'Grade 12',
    '1st year college': '1st Year College',
    '2nd year college': '2nd Year College',
    '3rd year college': '3rd Year College',
    '4th year college': '4th Year College',
    '5th year college': '5th Year College',
  };
  return aliasMap[normalized] || value;
};

// ---------------------------------------------------------------------------
// Missing-data helpers.
// A value that is null / undefined / '' / not a number is "no data" (null).
// A real 0 from the backend stays 0. Nothing here converts missing → 0.
// ---------------------------------------------------------------------------
const num = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const validOnly = (values) => values.filter((v) => v !== null);
const sumValid = (values) => {
  const valid = validOnly(values);
  return valid.length ? valid.reduce((a, b) => a + b, 0) : null;
};
const avgValid = (values) => {
  const valid = validOnly(values);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
};
const fmtNum = (value, digits) => {
  if (value === null || value === undefined) return '—';
  return digits != null ? Number(value).toFixed(digits) : String(value);
};

const gpaOf = (row) => num(row.gpa);
const reportsOf = (row) => num(row.reports_submitted);
const hoursOf = (row) => num(row.total_duty_hours);
const activitiesOf = (row) => num(row.activities_attended);
// Only a real backend value counts. No proxy / estimate is ever made.
const complianceOf = (row) => num(row.compliance_rate);

const joinList = (items) => {
  if (items.length <= 1) return items[0] || '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
};

const getInitials = (name) => {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
};

const formatMonthLabel = (value) => {
  if (!value) return '—';
  const [year, monthNum] = String(value).split('-');
  const date = new Date(Number(year), Number(monthNum) - 1, 1);
  if (Number.isNaN(date.getTime())) return value;
  return formatAdminMonth(date);
};

const pageNumbers = (current, total) => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
};

const toCsv = (rows) => {
  const header = ['Scholar', 'Student ID', 'Year Level', 'GPA', 'Reports Submitted', 'Service Hours', 'Activities'];
  const esc = (v) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // avoid spreadsheet formula injection
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((row) => [
    row.scholar, row.scholar_id, row.year_level ? formatYearLevel(row.year_level) : '',
    gpaOf(row), reportsOf(row), hoursOf(row), activitiesOf(row),
  ].map(esc).join(','));
  return `\uFEFF${[header.join(','), ...lines].join('\r\n')}`;
};

// ---------------------------------------------------------------------------
// Donor report data (per scholar)
// ---------------------------------------------------------------------------

const buildFallbackNarrative = (row) => {
  const name = row.scholar || 'This scholar';
  const gpa = gpaOf(row);
  const reports = reportsOf(row);
  const hours = hoursOf(row);
  const activities = activitiesOf(row);
  const clauses = [];
  if (gpa !== null) clauses.push(`maintained a GPA of ${gpa.toFixed(2)}`);
  if (reports !== null) clauses.push(`submitted ${reports} progress report${reports === 1 ? '' : 's'}`);
  if (hours !== null) clauses.push(`completed ${hours.toFixed(1)} community service hour${hours === 1 ? '' : 's'}`);
  if (activities !== null) clauses.push(`participated in ${activities} program activit${activities === 1 ? 'y' : 'ies'}`);
  if (!clauses.length) return `Progress data for ${name} is not yet available for this period.`;
  return `During this period, ${name} ${joinList(clauses)}.`;
};

const fetchScholarReport = async (row, month) => {
  const scholarId = row.scholar_id || row.scholar;
  try {
    const res = await axios.get(`${API}/export/donor-report/${scholarId}`, {
      ...authHeaders(),
      params: { month },
    });
    const data = res.data || {};
    return {
      narrative: data.narrative || buildFallbackNarrative(row),
      photos: Array.isArray(data.photos) ? data.photos : [],
      milestones: Array.isArray(data.milestones) ? data.milestones : [],
    };
  } catch (err) {
    return {
      narrative: row.narrative || buildFallbackNarrative(row),
      photos: Array.isArray(row.photos) ? row.photos : [],
      milestones: Array.isArray(row.milestones) ? row.milestones : [],
    };
  }
};

// ---------------------------------------------------------------------------
// Presentational pieces
// ---------------------------------------------------------------------------

const chartTooltipStyle = {
  background: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  ...body,
  fontSize: '0.8rem',
  color: INK,
};

const IconBadge = ({ icon: Icon, color = PRIMARY, size = 40 }) => (
  <div
    style={{
      width: size, height: size, borderRadius: 12, background: `${color}14`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}
  >
    <Icon size={size * 0.46} color={color} strokeWidth={2} />
  </div>
);

const KPICard = ({ icon, label, value, note, accent }) => (
  <div style={{ ...surfaceCard, padding: '1rem 1.15rem', display: 'flex', gap: 14, alignItems: 'flex-start', minWidth: 0 }}>
    <IconBadge icon={icon} color={accent} />
    <div style={{ minWidth: 0 }}>
      <div style={{ ...body, fontSize: '0.74rem', fontWeight: 600, color: PRIMARY }}>{label}</div>
      <div style={{ ...display, fontSize: '1.7rem', color: value === '—' ? MUTED : INK, lineHeight: 1.15, marginTop: 2 }}>{value}</div>
      <div style={{ ...body, fontSize: '0.72rem', color: MUTED, marginTop: 3 }}>{note}</div>
    </div>
  </div>
);

const Panel = ({ icon, title, subtitle, className, children }) => (
  <section style={{ ...surfaceCard, padding: '1.1rem 1.2rem', minWidth: 0 }} className={className}>
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
      <IconBadge icon={icon} size={36} />
      <div style={{ minWidth: 0 }}>
        <h3 style={{ ...display, fontSize: '1.02rem', color: INK, lineHeight: 1.25 }}>{title}</h3>
        <p style={{ ...body, fontSize: '0.74rem', color: MUTED, marginTop: 2 }}>{subtitle}</p>
      </div>
    </div>
    {children}
  </section>
);

const NoData = ({ text = 'No data available' }) => (
  <div style={{ ...body, fontSize: '0.82rem', color: MUTED, textAlign: 'center', padding: '1.6rem 0' }}>{text}</div>
);

// Horizontal bar list. value === null → "—" and no bar (never drawn as 0).
const HBarList = ({ items, max, color, format }) => {
  const safeMax = max > 0 ? max : 1;
  return (
    <div role="list" style={{ display: 'grid', gap: 10 }}>
      {items.map((item) => (
        <div
          key={item.label}
          role="listitem"
          style={{ display: 'grid', gridTemplateColumns: 'minmax(92px, 124px) minmax(0, 1fr) 48px', alignItems: 'center', gap: 10 }}
        >
          <span style={{ ...body, fontSize: '0.76rem', color: INK }}>{item.label}</span>
          <div style={{ height: 12, borderRadius: 999, background: '#F2E9DC', overflow: 'hidden' }}>
            {item.value !== null && item.value > 0 && (
              <div style={{ width: `${Math.max(2, (item.value / safeMax) * 100)}%`, height: '100%', background: color, borderRadius: 999 }} />
            )}
          </div>
          <span style={{ ...body, fontSize: '0.76rem', fontWeight: 600, color: item.value === null ? MUTED : INK, textAlign: 'right' }}>
            {item.value === null ? '—' : format(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

const Skeleton = ({ w = '100%', h = 14, r = 8, style }) => (
  <div style={{ width: w, height: h, borderRadius: r, background: '#EFE3D4', ...style }} />
);

const PageSkeleton = () => (
  <div aria-busy="true" aria-label="Loading donor reporting data">
    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><Skeleton w={110} h={10} /><Skeleton w={300} h={28} style={{ marginTop: 10 }} /><Skeleton w={380} h={12} style={{ marginTop: 10 }} /></div>
      <Skeleton w={420} h={44} r={12} />
    </div>
    <div style={{ ...surfaceCard, padding: '1.1rem 1.3rem', marginBottom: 16 }}><Skeleton w={180} h={16} /><Skeleton w="70%" h={12} style={{ marginTop: 10 }} /></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ ...surfaceCard, padding: '1rem 1.15rem', display: 'flex', gap: 14 }}>
          <Skeleton w={40} h={40} r={12} /><div style={{ flex: 1 }}><Skeleton w="60%" h={10} /><Skeleton w="35%" h={24} style={{ marginTop: 8 }} /></div>
        </div>
      ))}
    </div>
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3 mb-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={{ ...surfaceCard, padding: '1.1rem 1.2rem', height: 220 }}><Skeleton w={160} h={14} /><Skeleton h={130} r={12} style={{ marginTop: 18, background: '#F2E9DC' }} /></div>
      ))}
    </div>
    <div style={{ ...surfaceCard, padding: '1.1rem 1.2rem' }}>
      <Skeleton w={180} h={16} />
      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={30} style={{ marginTop: 12 }} />)}
    </div>
  </div>
);

const EmptyState = ({ title, text }) => (
  <div style={{ ...surfaceCard, padding: '2.8rem 1.5rem', textAlign: 'center' }}>
    <div style={{ width: 52, height: 52, borderRadius: '50%', background: `${PRIMARY}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
      <HeartHandshake size={24} color={PRIMARY} strokeWidth={1.8} />
    </div>
    <h3 style={{ ...display, fontSize: '1.15rem', color: INK }}>{title}</h3>
    <p style={{ ...body, fontSize: '0.86rem', color: MUTED, marginTop: 6 }}>{text}</p>
  </div>
);

const MilestoneTimeline = ({ milestones }) => (
  <div style={{ position: 'relative', paddingLeft: 22 }}>
    <div style={{ position: 'absolute', left: 5, top: 6, bottom: 6, width: 2, background: BORDER }} />
    {milestones.map((m, i) => (
      <div key={i} style={{ position: 'relative', marginBottom: i === milestones.length - 1 ? 0 : 14 }}>
        <span
          style={{
            position: 'absolute', left: -22, top: 3, width: 10, height: 10, borderRadius: '50%',
            background: PRIMARY, border: `2px solid ${SURFACE}`, boxShadow: `0 0 0 1px ${PRIMARY}`,
          }}
        />
        <span style={{ ...body, fontSize: '0.88rem', color: INK }}>{typeof m === 'string' ? m : m.label}</span>
      </div>
    ))}
  </div>
);

const PhotoMasonry = ({ photos, scholarName }) => (
  <div style={{ columnCount: 2, columnGap: 12 }} className="sm:[column-count:3]">
    {photos.map((photo, i) => {
      const src = typeof photo === 'string' ? photo : photo.url;
      const caption = typeof photo === 'string' ? '' : photo.caption;
      return (
        <figure key={i} style={{ margin: '0 0 12px', breakInside: 'avoid' }}>
          <img
            src={src}
            alt={caption || `${scholarName} highlight ${i + 1}`}
            style={{ width: '100%', borderRadius: 14, border: `1px solid ${BORDER}`, display: 'block' }}
          />
          {caption && <figcaption style={{ ...body, fontSize: '0.72rem', color: MUTED, marginTop: 6 }}>{caption}</figcaption>}
        </figure>
      );
    })}
  </div>
);

const StatusPill = ({ status }) => {
  if (!status) return <span style={{ ...body, fontSize: '0.78rem', color: MUTED }}>—</span>;
  const active = String(status).toLowerCase() === 'active';
  return (
    <span
      style={{
        ...body, fontSize: '0.72rem', fontWeight: 600, borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap',
        color: active ? SUCCESS : MUTED, background: active ? `${SUCCESS}1f` : '#F1ECE3',
        border: `1px solid ${active ? `${SUCCESS}44` : BORDER}`, textTransform: 'capitalize',
      }}
    >
      {status}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Donor Report Modal (per scholar)
// ---------------------------------------------------------------------------

const DonorReportModal = ({ row, month, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState({ narrative: '', photos: [], milestones: [] });

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchScholarReport(row, month).then((data) => {
      if (active) {
        setReport(data);
        setLoading(false);
      }
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row, month]);

  const handlePrint = () => window.print();

  // null values are passed as undefined so the chart leaves a gap instead of drawing 0
  const snapshot = {
    metric: 'This period',
    Reports: reportsOf(row) ?? undefined,
    Activities: activitiesOf(row) ?? undefined,
    'Community Service Hours': hoursOf(row) ?? undefined,
  };
  const hasSnapshot = [snapshot.Reports, snapshot.Activities, snapshot['Community Service Hours']].some((v) => v !== undefined);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8"
      style={{ background: 'rgba(36,21,18,0.5)' }}
      onClick={onClose}
    >
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 16mm; }
          body * { visibility: hidden; }
          #donor-report-printable, #donor-report-printable * { visibility: visible; }
          #donor-report-printable { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; }
        }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        id="donor-report-printable"
        style={{ ...surfaceCard, maxWidth: 760, width: '100%', margin: 'auto', overflow: 'hidden' }}
      >
        <div
          className="flex items-start justify-between gap-4"
          style={{ padding: '1.5rem 1.7rem', borderBottom: `1px solid ${BORDER}`, background: BG }}
        >
          <div>
            <p style={{ ...body, color: BRONZE, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Donor Impact Report
            </p>
            <h2 style={{ ...display, fontSize: '1.55rem', marginTop: 4, color: INK }}>{row.scholar || 'Scholar'}</h2>
            <p style={{ ...body, color: MUTED, fontSize: '0.85rem', marginTop: 2 }}>
              {formatYearLevel(row.year_level)} · Reporting month {formatMonthLabel(month)}
            </p>
          </div>
          <div className="flex gap-2 print:hidden">
            <button
              onClick={handlePrint}
              style={{
                ...body, fontSize: '0.8rem', fontWeight: 600, color: '#fff',
                border: 'none', borderRadius: 10, padding: '9px 16px', background: PRIMARY,
                display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
              }}
            >
              <Download size={14} /> Print / Export
            </button>
            <button
              onClick={onClose}
              aria-label="Close report"
              style={{
                ...body, fontSize: '0.8rem', color: MUTED, border: `1px solid ${BORDER}`,
                borderRadius: 10, padding: '9px 10px', background: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center',
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div style={{ padding: '1.7rem' }}>
          {loading ? (
            <div style={{ ...body, color: MUTED, textAlign: 'center', padding: '2rem 0' }}>Building report…</div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
                {[
                  { label: 'GPA', value: fmtNum(gpaOf(row), 2), accent: BRONZE },
                  { label: 'Reports', value: fmtNum(reportsOf(row)), accent: SUCCESS },
                  { label: 'Service Hours', value: fmtNum(hoursOf(row), 1), accent: PRIMARY },
                  { label: 'Activities', value: fmtNum(activitiesOf(row)), accent: WARNING },
                ].map((stat) => (
                  <div key={stat.label} style={{ border: `1px solid ${BORDER}`, borderRadius: 14, padding: '0.9rem', background: BG }}>
                    <div style={{ ...body, fontSize: '0.65rem', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</div>
                    <div style={{ ...display, fontSize: '1.5rem', marginTop: 4, color: stat.value === '—' ? MUTED : stat.accent }}>{stat.value}</div>
                  </div>
                ))}
              </div>

              <div className="mb-7">
                <h3 style={{ ...display, fontSize: '1.1rem', marginBottom: 10, color: INK }}>Progress Summary</h3>
                <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '1.1rem 1.2rem' }}>
                  <p style={{ ...body, color: INK, fontSize: '0.94rem', lineHeight: 1.7 }}>{report.narrative}</p>
                </div>
              </div>

              <div className="mb-7">
                <h3 style={{ ...display, fontSize: '1.1rem', marginBottom: 10, color: INK }}>Progress Snapshot</h3>
                {hasSnapshot ? (
                  <div style={{ width: '100%', minWidth: 0, height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                      <LineChart data={[snapshot]}>
                        <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                        <XAxis dataKey="metric" tick={{ ...body, fontSize: 11, fill: MUTED }} axisLine={{ stroke: BORDER }} tickLine={false} />
                        <YAxis tick={{ ...body, fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Legend wrapperStyle={{ ...body, fontSize: 11 }} />
                        <Line type="monotone" dataKey="Reports" stroke={PRIMARY} strokeWidth={2} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="Activities" stroke={SUCCESS} strokeWidth={2} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="Community Service Hours" stroke={BRONZE} strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <NoData />
                )}
              </div>

              {report.milestones.length > 0 && (
                <div className="mb-7">
                  <h3 style={{ ...display, fontSize: '1.1rem', marginBottom: 12, color: INK }}>Milestones</h3>
                  <MilestoneTimeline milestones={report.milestones} />
                </div>
              )}

              <div className="mb-2">
                <h3 style={{ ...display, fontSize: '1.1rem', marginBottom: 10, color: INK }}>Photo Highlights</h3>
                {report.photos.length > 0 ? (
                  <PhotoMasonry photos={report.photos} scholarName={row.scholar} />
                ) : (
                  <p style={{ ...body, fontSize: '0.85rem', color: MUTED }}>No photos uploaded for this period yet.</p>
                )}
              </div>

              <div style={{ marginTop: '1.6rem', paddingTop: '1.2rem', borderTop: `1px solid ${BORDER}`, textAlign: 'center' }}>
                <div style={{ ...display, fontSize: '1rem', color: PRIMARY_DEEP }}>Apple Scholar Foundation</div>
                <div style={{ ...body, fontSize: '0.72rem', color: MUTED, letterSpacing: '0.04em', marginTop: 2 }}>Official Donor Progress Report</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Monthly Donor Summary Report — print-friendly (A4 portrait) executive summary
// for every scholar in the selected month. Uses only data already fetched.
// ---------------------------------------------------------------------------

const REPORT_PAGE = {
  width: '100%',
  maxWidth: 794,
  margin: '0 auto',
  background: '#fff',
  padding: '28px 32px',
};

const MonthlyReportModal = ({ rows, month, totals, distributionData, gpaByLevelData, onClose }) => {
  const monthLabel = formatMonthLabel(month);
  const complianceRate = totals.complianceRate; // null unless backend supplies compliance_rate
  const showCompliance = rows.some((row) => complianceOf(row) !== null);

  const narrative = useMemo(() => {
    const clauses = [];
    if (totals.averageGpa !== null) clauses.push(`maintained an average GPA of ${totals.averageGpa.toFixed(2)}`);
    if (totals.totalDutyHours !== null) clauses.push(`completed ${totals.totalDutyHours.toFixed(0)} community service hours`);
    if (totals.totalActivities !== null) clauses.push(`took part in ${totals.totalActivities} program activit${totals.totalActivities === 1 ? 'y' : 'ies'}`);
    if (complianceRate !== null) clauses.push(`reached ${complianceRate.toFixed(0)}% reporting compliance`);
    const lead = `During ${monthLabel}, ${totals.totalScholars} scholar${totals.totalScholars === 1 ? '' : 's'} took part in the scholarship program`;
    const detail = clauses.length ? `, and together they ${joinList(clauses)}` : '';
    return `${lead}${detail}. Donor support helps sustain scholarship access, academic progress, and community engagement across the foundation's scholar community.`;
  }, [monthLabel, totals, complianceRate]);

  // Photos come from whatever scholars already carry on their row. No extra API calls.
  const communityPhotos = useMemo(() => {
    const items = [];
    rows.forEach((row) => {
      (Array.isArray(row.photos) ? row.photos : []).forEach((photo) => {
        const src = typeof photo === 'string' ? photo : photo.url;
        const caption = typeof photo === 'string' ? '' : photo.caption;
        if (src) items.push({ src, caption, scholar: row.scholar });
      });
    });
    return items.slice(0, 6);
  }, [rows]);

  const handlePrint = () => window.print();

  const kpis = [
    { label: 'Active Scholars', value: totals.totalScholars, accent: PRIMARY },
    { label: 'Average GPA', value: fmtNum(totals.averageGpa, 2), accent: BRONZE },
    { label: 'Community Service Hours', value: totals.totalDutyHours === null ? '—' : `${totals.totalDutyHours.toFixed(0)} hrs`, accent: WARNING },
    complianceRate !== null
      ? { label: 'Reporting Compliance', value: `${complianceRate.toFixed(0)}%`, accent: SUCCESS }
      : { label: 'Program Activities', value: fmtNum(totals.totalActivities), accent: SUCCESS },
  ];

  const th = { ...body, textAlign: 'left', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: MUTED, padding: '8px 6px' };
  const td = { ...body, fontSize: '0.8rem', color: INK, padding: '7px 6px' };
  const tf = { ...body, fontSize: '0.78rem', fontWeight: 700, color: INK, padding: '9px 6px' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8"
      style={{ background: 'rgba(36,21,18,0.55)' }}
      onClick={onClose}
    >
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 16mm; }
          body * { visibility: hidden; }
          #monthly-report-printable, #monthly-report-printable * { visibility: visible; }
          #monthly-report-printable { position: absolute; left: 0; top: 0; width: 100%; max-height: none !important; overflow: visible !important; }
          .monthly-report-page { page-break-after: always; }
          .monthly-report-page:last-child { page-break-after: auto; }
        }
      `}</style>

      <div onClick={(e) => e.stopPropagation()} style={{ ...surfaceCard, maxWidth: 840, width: '100%', margin: 'auto', overflow: 'hidden' }}>
        <div
          className="flex items-start justify-between gap-4 print:hidden"
          style={{ padding: '1.4rem 1.7rem', borderBottom: `1px solid ${BORDER}`, background: BG }}
        >
          <div>
            <p style={{ ...body, color: BRONZE, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Monthly Donor Summary Report
            </p>
            <h2 style={{ ...display, fontSize: '1.4rem', marginTop: 4, color: INK }}>{monthLabel}</h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              style={{
                ...body, fontSize: '0.8rem', fontWeight: 600, color: '#fff',
                border: 'none', borderRadius: 10, padding: '9px 16px', background: PRIMARY,
                display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
              }}
            >
              <Download size={14} /> Export PDF
            </button>
            <button
              onClick={onClose}
              aria-label="Close report"
              style={{
                ...body, fontSize: '0.8rem', color: MUTED, border: `1px solid ${BORDER}`,
                borderRadius: 10, padding: '9px 10px', background: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center',
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div id="monthly-report-printable" style={{ background: '#EFE7DA', padding: '20px 0', maxHeight: '78vh', overflowY: 'auto' }}>
          {/* Page 1 — Executive cover */}
          <div className="monthly-report-page" style={{ ...REPORT_PAGE, marginBottom: 20 }}>
            <div style={{ background: PRIMARY, borderRadius: 14, padding: '22px 26px', color: '#fff' }}>
              <p style={{ ...body, fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#E7D8C7' }}>Apple Scholar Foundation</p>
              <h1 style={{ ...display, fontSize: '1.8rem', marginTop: 10, lineHeight: 1.15 }}>Monthly Donor Summary Report</h1>
              <p style={{ ...body, fontSize: '0.85rem', marginTop: 10, color: '#F3E9DD' }}>{monthLabel}</p>
            </div>

            <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginTop: 18 }}>Prepared for Donor Partners</p>

            <div className="grid grid-cols-2 gap-3" style={{ marginTop: 16 }}>
              {kpis.map((kpi) => (
                <div key={kpi.label} style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ ...body, fontSize: '0.65rem', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</div>
                  <div style={{ ...display, fontSize: '1.7rem', marginTop: 6, color: kpi.value === '—' ? MUTED : kpi.accent }}>{kpi.value}</div>
                </div>
              ))}
            </div>

            <p style={{ ...body, fontSize: '0.86rem', color: INK, lineHeight: 1.7, marginTop: 20 }}>{narrative}</p>
          </div>

          {/* Page 2 — Impact analytics */}
          <div className="monthly-report-page" style={{ ...REPORT_PAGE, marginBottom: 20 }}>
            <h2 style={{ ...display, fontSize: '1.3rem', color: INK, marginBottom: 4 }}>Overall Impact Metrics</h2>
            <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginBottom: 16 }}>Distribution and academic performance</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 style={{ ...body, fontSize: '0.78rem', fontWeight: 700, color: INK, marginBottom: 6 }}>Scholar Distribution</h3>
                {distributionData.length ? (
                  <div style={{ width: '100%', minWidth: 0, height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                      <PieChart>
                        <Pie data={distributionData} dataKey="value" nameKey="name" innerRadius={44} outerRadius={78} paddingAngle={2}>
                          {distributionData.map((entry, i) => <Cell key={entry.name} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={chartTooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : <NoData />}
              </div>
              <div>
                <h3 style={{ ...body, fontSize: '0.78rem', fontWeight: 700, color: INK, marginBottom: 6 }}>Average GPA by Year Level</h3>
                {gpaByLevelData.length ? (
                  <div style={{ width: '100%', minWidth: 0, height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                      <BarChart data={gpaByLevelData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                        <XAxis dataKey="level" tick={{ ...body, fontSize: 9, fill: MUTED }} axisLine={{ stroke: BORDER }} tickLine={false} interval={0} angle={-25} textAnchor="end" height={50} />
                        <YAxis tick={{ ...body, fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} domain={[0, 4]} />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Bar dataKey="gpa" fill={PRIMARY} radius={[6, 6, 0, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <NoData text="No GPA data available" />}
              </div>
            </div>
          </div>

          {/* Scholar summary — chunked so large rosters paginate when printed */}
          {(() => {
            const ROWS_PER_PRINT_PAGE = 28;
            const chunks = [];
            for (let i = 0; i < rows.length; i += ROWS_PER_PRINT_PAGE) chunks.push(rows.slice(i, i + ROWS_PER_PRINT_PAGE));
            if (chunks.length === 0) chunks.push([]);
            const heads = ['Scholar', 'Year', 'GPA', ...(showCompliance ? ['Compliance'] : []), 'Hours'];

            return chunks.map((chunk, chunkIndex) => (
              <div className="monthly-report-page" style={{ ...REPORT_PAGE, marginBottom: 20 }} key={chunkIndex}>
                <div className="flex items-baseline justify-between" style={{ marginBottom: 14 }}>
                  <h2 style={{ ...display, fontSize: '1.3rem', color: INK, margin: 0 }}>Scholar Summary</h2>
                  {chunks.length > 1 && <span style={{ ...body, fontSize: '0.72rem', color: MUTED }}>Page {chunkIndex + 1} of {chunks.length}</span>}
                </div>
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${INK}` }}>{heads.map((h) => <th key={h} style={th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {chunk.map((row) => (
                      <tr key={row.scholar_id || row.scholar} style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <td style={td}>{row.scholar || '—'}</td>
                        <td style={{ ...td, color: MUTED }}>{formatYearLevel(row.year_level)}</td>
                        <td style={td}>{fmtNum(gpaOf(row), 2)}</td>
                        {showCompliance && <td style={td}>{complianceOf(row) === null ? '—' : `${complianceOf(row).toFixed(0)}%`}</td>}
                        <td style={td}>{fmtNum(hoursOf(row), 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {chunkIndex === chunks.length - 1 && rows.length > 0 && (
                    <tfoot>
                      <tr style={{ borderTop: `2px solid ${INK}` }}>
                        <td style={tf}>Totals / Averages</td>
                        <td style={{ padding: '9px 6px' }} />
                        <td style={tf}>{fmtNum(totals.averageGpa, 2)}</td>
                        {showCompliance && <td style={tf}>{complianceRate === null ? '—' : `${complianceRate.toFixed(0)}%`}</td>}
                        <td style={tf}>{fmtNum(totals.totalDutyHours, 1)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            ));
          })()}

          {/* Community impact */}
          <div className="monthly-report-page" style={{ ...REPORT_PAGE, marginBottom: 20 }}>
            <h2 style={{ ...display, fontSize: '1.3rem', color: INK, marginBottom: 14 }}>Community Impact</h2>
            {communityPhotos.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {communityPhotos.map((photo, i) => (
                  <figure key={i} style={{ margin: 0 }}>
                    <img src={photo.src} alt={photo.caption || photo.scholar} style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 12, border: `1px solid ${BORDER}` }} />
                    <figcaption style={{ ...body, fontSize: '0.72rem', color: MUTED, marginTop: 5 }}>{photo.caption || photo.scholar}</figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <p style={{ ...body, fontSize: '0.85rem', color: MUTED }}>No verified activity photos are attached to this period's scholar records yet.</p>
            )}
          </div>

          {/* SDG alignment & donor narrative */}
          <div className="monthly-report-page" style={{ ...REPORT_PAGE }}>
            <h2 style={{ ...display, fontSize: '1.3rem', color: INK, marginBottom: 16 }}>SDG Alignment &amp; Donor Narrative</h2>

            <div style={{ border: `1px solid ${BORDER}`, borderRadius: 14, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', background: `${SUCCESS}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CheckCircle2 size={22} color={SUCCESS} />
              </div>
              <div>
                <div style={{ ...body, fontSize: '0.68rem', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>SDG 4 — Quality Education</div>
                <div style={{ ...body, fontSize: '0.88rem', color: INK, lineHeight: 1.55, marginTop: 4 }}>
                  Aligned through scholarship access, academic support, and student progress monitoring.
                </div>
              </div>
            </div>

            <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '18px 20px' }}>
              <p style={{ ...body, fontSize: '0.9rem', color: INK, lineHeight: 1.75 }}>{narrative}</p>
            </div>

            <div style={{ marginTop: '2rem', paddingTop: '1.2rem', borderTop: `1px solid ${BORDER}`, textAlign: 'center' }}>
              <div style={{ ...display, fontSize: '1rem', color: PRIMARY_DEEP }}>Apple Scholar Foundation</div>
              <div style={{ ...body, fontSize: '0.72rem', color: MUTED, letterSpacing: '0.04em', marginTop: 2 }}>Official Monthly Donor Summary Report</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const AdminDonorPage = () => {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [yearLevel, setYearLevel] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportRow, setReportRow] = useState(null);
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);
  const [scholarSearch, setScholarSearch] = useState('');
  const [tableLevel, setTableLevel] = useState('');
  const [scholarPage, setScholarPage] = useState(1);
  const [impactView, setImpactView] = useState('hours'); // 'hours' | 'activities'

  const fetchDonorOverview = async () => {
    try {
      setLoading(true);
      setError('');
      const params = { type: 'donor', month };
      if (yearLevel) params.year_level = yearLevel;
      const res = await axios.get(`${API}/export/preview`, { ...authHeaders(), params });
      setRows(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      setRows([]);
      setError(err.response?.data?.message || 'Unable to load donor overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDonorOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, yearLevel]);

  useEffect(() => { setTableLevel(''); }, [rows]);
  useEffect(() => { setScholarPage(1); }, [scholarSearch, tableLevel, rows]);

  const filteredScholarRows = useMemo(() => {
    const query = scholarSearch.trim().toLowerCase();
    return rows.filter((row) => {
      if (query && !(row.scholar || '').toLowerCase().includes(query)) return false;
      if (tableLevel && formatYearLevel(row.year_level) !== tableLevel) return false;
      return true;
    });
  }, [rows, scholarSearch, tableLevel]);

  const scholarPageCount = Math.max(1, Math.ceil(filteredScholarRows.length / SCHOLARS_PER_PAGE));
  const pageStart = (scholarPage - 1) * SCHOLARS_PER_PAGE;
  const paginatedScholarRows = useMemo(
    () => filteredScholarRows.slice(pageStart, pageStart + SCHOLARS_PER_PAGE),
    [filteredScholarRows, pageStart]
  );

  // Totals: missing values stay null ("no data"), they are never turned into 0.
  const totals = useMemo(() => ({
    totalScholars: rows.length,
    averageGpa: avgValid(rows.map(gpaOf)),
    totalDutyHours: sumValid(rows.map(hoursOf)),
    totalActivities: sumValid(rows.map(activitiesOf)),
    complianceRate: avgValid(rows.map(complianceOf)),
  }), [rows]);

  // One grouping reused by every chart. Only year levels that exist in the data appear.
  const levelStats = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const level = row.year_level ? formatYearLevel(row.year_level) : 'Unspecified';
      if (!map.has(level)) map.set(level, []);
      map.get(level).push(row);
    });
    const ordered = [
      ...YEAR_LEVEL_ORDER.filter((lvl) => map.has(lvl)),
      ...[...map.keys()].filter((lvl) => !YEAR_LEVEL_ORDER.includes(lvl)),
    ];
    return ordered.map((level) => {
      const group = map.get(level);
      return {
        level,
        count: group.length,
        gpa: avgValid(group.map(gpaOf)),
        hours: sumValid(group.map(hoursOf)),
        activities: sumValid(group.map(activitiesOf)),
      };
    });
  }, [rows]);

  const distributionData = useMemo(() => levelStats.map((s) => ({ name: s.level, value: s.count })), [levelStats]);
  const gpaByLevelData = useMemo(
    () => levelStats.filter((s) => s.gpa !== null).map((s) => ({ level: s.level, gpa: Number(s.gpa.toFixed(2)) })),
    [levelStats]
  );

  const panelStats = useMemo(() => [...levelStats].reverse(), [levelStats]); // highest level first
  const hasGpaData = levelStats.some((s) => s.gpa !== null);
  const impactKey = impactView === 'hours' ? 'hours' : 'activities';
  const hasImpactData = levelStats.some((s) => s[impactKey] !== null);
  const maxOf = (key) => Math.max(0, ...levelStats.map((s) => s[key] ?? 0));

  const handleExportTable = () => {
    const blob = new Blob([toCsv(filteredScholarRows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `scholar-impact-${month}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const initialLoading = loading && rows.length === 0;
  const hasRows = rows.length > 0;
  const fieldStyle = { ...body, width: '100%', borderRadius: 12, padding: '9px 12px', border: `1px solid ${BORDER}`, background: '#fff', color: INK, fontSize: '0.85rem' };
  const thStyle = { ...body, textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em', color: PRIMARY_DEEP, padding: '10px 12px', whiteSpace: 'nowrap', background: '#F6EFE4' };
  const tdStyle = { ...body, fontSize: '0.82rem', color: INK, padding: '10px 12px', whiteSpace: 'nowrap' };

  return (
    <div className="min-h-screen w-full" style={{ background: BG, color: INK }}>
      <style>{`
        .dr-row:hover { background: #FBF7EE; }
        .dr-field:focus { outline: none; border-color: ${PRIMARY} !important; box-shadow: 0 0 0 3px rgba(109,33,64,0.1); }
      `}</style>
      <div className="w-full px-4 sm:px-6 lg:px-8" style={{ overflowX: 'hidden' }}>
        {initialLoading ? (
          <PageSkeleton />
        ) : (
          <>
            <AdminPageHeader
              title="Donor Reporting Center"
              description="Monthly scholarship impact, scholar progress, and donor-ready reports."
              className="mb-5"
              actions={
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end w-full lg:w-auto">
                <label className="flex-1 sm:w-44">
                  <span style={{ ...body, fontSize: '0.72rem', color: MUTED, display: 'block', marginBottom: 5 }}>Month</span>
                  <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="dr-field" style={fieldStyle} />
                </label>
                <label className="flex-1 sm:w-48">
                  <span style={{ ...body, fontSize: '0.72rem', color: MUTED, display: 'block', marginBottom: 5 }}>Year level</span>
                  <select value={yearLevel} onChange={(e) => setYearLevel(e.target.value)} className="dr-field" style={fieldStyle}>
                    <option value="">All levels</option>
                    {YEAR_LEVEL_ORDER.map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    ...body, fontSize: '0.82rem', fontWeight: 600, color: '#fff', background: PRIMARY, border: 'none',
                    borderRadius: 12, padding: '10px 18px', whiteSpace: 'nowrap', minHeight: 40,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer',
                  }}
                >
                  <Download size={15} /> Export Data
                </button>
              </div>
              }
            />

            {error && (
              <div role="alert" style={{ ...surfaceCard, padding: '0.8rem 1.1rem', marginBottom: 16, borderColor: '#E8C5C1', background: '#FBEAE8', display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={16} color={DANGER} style={{ flexShrink: 0 }} />
                <span style={{ ...body, color: DANGER, fontWeight: 600, fontSize: '0.84rem' }}>{error}</span>
              </div>
            )}

            {/* Monthly Donor Summary */}
            <section
              style={{
                ...surfaceCard, background: 'rgba(109,33,64,0.05)', borderColor: 'rgba(109,33,64,0.18)',
                padding: '1.1rem 1.3rem', marginBottom: 16,
              }}
              className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
            >
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', minWidth: 0 }}>
                <IconBadge icon={FileText} />
                <div style={{ minWidth: 0 }}>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <h2 style={{ ...display, fontSize: '1.1rem', color: INK }}>Monthly Donor Summary</h2>
                    <span style={{ ...body, fontSize: '0.78rem', color: PRIMARY, fontWeight: 600 }}>{formatMonthLabel(month)}</span>
                  </div>
                  <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginTop: 3, maxWidth: 620, lineHeight: 1.55 }}>
                    Generate a comprehensive donor-ready report for the selected month, including scholar progress, community impact, and verified highlights.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMonthlyReport(true)}
                disabled={!hasRows}
                style={{
                  ...body, fontSize: '0.82rem', fontWeight: 600, color: '#fff', background: PRIMARY, border: 'none',
                  borderRadius: 12, padding: '10px 18px', whiteSpace: 'nowrap', minHeight: 40,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  cursor: hasRows ? 'pointer' : 'not-allowed', opacity: hasRows ? 1 : 0.55,
                }}
              >
                <FileText size={15} /> Generate Monthly Report
              </button>
            </section>

            {/* KPI cards */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-5">
              <KPICard
                icon={Users} label="Active Scholars" accent={PRIMARY}
                value={hasRows ? totals.totalScholars : '—'}
                note={hasRows ? 'Scholars supported this period.' : 'No scholar data for this period'}
              />
              <KPICard
                icon={GraduationCap} label="Average GPA" accent={BRONZE}
                value={fmtNum(totals.averageGpa, 2)}
                note={totals.averageGpa === null ? 'No GPA data available' : 'Academic performance average.'}
              />
              <KPICard
                icon={Clock} label="Community Service Hours" accent={SUCCESS}
                value={fmtNum(totals.totalDutyHours, 1)}
                note={totals.totalDutyHours === null ? 'No records available' : 'Verified service hours completed.'}
              />
              <KPICard
                icon={Sparkles} label="Program Activities" accent={WARNING}
                value={fmtNum(totals.totalActivities)}
                note={totals.totalActivities === null ? 'No activity data available' : 'Activities participated this period.'}
              />
            </div>

            {/* Impact Overview */}
            <p style={{ ...body, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: MUTED, textTransform: 'uppercase', margin: '4px 2px 10px' }}>
              Impact Overview
            </p>
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3 mb-6">
              <Panel icon={Users} title="Scholar Distribution by Year Level" subtitle="Number of active scholars per year level.">
                {hasRows ? (
                  <HBarList
                    items={panelStats.map((s) => ({ label: s.level, value: s.count }))}
                    max={Math.max(...levelStats.map((s) => s.count))}
                    color={PRIMARY}
                    format={(v) => String(v)}
                  />
                ) : <NoData />}
              </Panel>

              <Panel icon={GraduationCap} title="Average GPA by Year Level" subtitle="Academic performance by year level.">
                {hasGpaData ? (
                  <HBarList
                    items={panelStats.map((s) => ({ label: s.level, value: s.gpa }))}
                    max={4}
                    color={PRIMARY}
                    format={(v) => v.toFixed(2)}
                  />
                ) : <NoData text="No GPA data available" />}
              </Panel>

              <Panel icon={HeartHandshake} title="Community Impact" subtitle="Service hours and participation by year level." className="lg:col-span-2 xl:col-span-1">
                <div role="group" aria-label="Community impact view" style={{ display: 'inline-flex', padding: 3, borderRadius: 11, background: '#F2E9DC', marginBottom: 14 }}>
                  {[['hours', 'Service Hours'], ['activities', 'Program Activities']].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={impactView === key}
                      onClick={() => setImpactView(key)}
                      style={{
                        ...body, fontSize: '0.74rem', fontWeight: 600, border: 0, borderRadius: 9, padding: '6px 12px', cursor: 'pointer',
                        background: impactView === key ? PRIMARY : 'transparent', color: impactView === key ? '#fff' : MUTED,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {hasImpactData ? (
                  <HBarList
                    items={panelStats.map((s) => ({ label: s.level, value: s[impactKey] }))}
                    max={maxOf(impactKey)}
                    color={impactView === 'hours' ? SUCCESS : WARNING}
                    format={(v) => (impactView === 'hours' ? v.toFixed(1) : String(v))}
                  />
                ) : <NoData text={impactView === 'hours' ? 'No service hour records available' : 'No activity data available'} />}
                <div className="grid grid-cols-2 gap-3" style={{ marginTop: 16 }}>
                  <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 12px', background: '#fff' }}>
                    <div style={{ ...display, fontSize: '1.15rem', color: totals.totalDutyHours === null ? MUTED : INK }}>{fmtNum(totals.totalDutyHours, 1)}</div>
                    <div style={{ ...body, fontSize: '0.7rem', color: MUTED, marginTop: 2 }}>Total Service Hours</div>
                  </div>
                  <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 12px', background: '#fff' }}>
                    <div style={{ ...display, fontSize: '1.15rem', color: totals.totalActivities === null ? MUTED : INK }}>{fmtNum(totals.totalActivities)}</div>
                    <div style={{ ...body, fontSize: '0.7rem', color: MUTED, marginTop: 2 }}>Total Activities</div>
                  </div>
                </div>
              </Panel>
            </div>

            {/* Scholar Impact */}
            <section style={{ ...surfaceCard, padding: '1.1rem 1.2rem' }}>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between" style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
                  <IconBadge icon={FileText} />
                  <div style={{ minWidth: 0 }}>
                    <h2 style={{ ...display, fontSize: '1.2rem', color: INK }}>Scholar Impact</h2>
                    <p style={{ ...body, fontSize: '0.78rem', color: MUTED, marginTop: 2 }}>Detailed progress, reports, and participation of each scholar.</p>
                  </div>
                </div>
                {hasRows && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                      <Search size={15} color={MUTED} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                      <input
                        type="text"
                        value={scholarSearch}
                        onChange={(e) => setScholarSearch(e.target.value)}
                        placeholder="Search scholar…"
                        aria-label="Search scholar"
                        className="dr-field"
                        style={{ ...fieldStyle, paddingLeft: 34 }}
                      />
                    </div>
                    <select
                      value={tableLevel}
                      onChange={(e) => setTableLevel(e.target.value)}
                      aria-label="Filter table by year level"
                      className="dr-field"
                      style={{ ...fieldStyle, width: 'auto', minWidth: 150 }}
                    >
                      <option value="">All levels</option>
                      {levelStats.map((s) => <option key={s.level} value={s.level}>{s.level}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={handleExportTable}
                      disabled={filteredScholarRows.length === 0}
                      style={{
                        ...body, fontSize: '0.8rem', fontWeight: 600, color: PRIMARY, background: '#fff',
                        border: `1px solid ${PRIMARY}`, borderRadius: 12, padding: '9px 14px', whiteSpace: 'nowrap',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                        cursor: filteredScholarRows.length ? 'pointer' : 'not-allowed', opacity: filteredScholarRows.length ? 1 : 0.55,
                      }}
                    >
                      <Download size={14} /> Export Table
                    </button>
                  </div>
                )}
              </div>

              {!hasRows ? (
                <EmptyState title="No scholars found" text="No scholar data is available for the selected reporting period." />
              ) : filteredScholarRows.length === 0 ? (
                <EmptyState title="No scholars match your search." text="Try adjusting your search or filters." />
              ) : (
                <>
                  <div style={{ overflowX: 'auto', border: `1px solid ${BORDER}`, borderRadius: 12 }}>
                    <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['#', 'Scholar', 'Student ID', 'Year Level', 'GPA', 'Reports Submitted', 'Service Hours', 'Activities', 'Status', 'Actions'].map((h) => (
                            <th key={h} scope="col" style={thStyle}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedScholarRows.map((row, i) => {
                          const status = row.status || row.scholar_status || '';
                          return (
                            <tr key={row.scholar_id || row.scholar} className="dr-row" style={{ borderTop: `1px solid ${BORDER}` }}>
                              <td style={{ ...tdStyle, color: MUTED }}>{pageStart + i + 1}</td>
                              <td style={{ ...tdStyle, fontWeight: 600 }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                                  <span style={{ width: 28, height: 28, borderRadius: '50%', background: PRIMARY, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', ...display }}>
                                    {getInitials(row.scholar)}
                                  </span>
                                  {row.scholar || '—'}
                                </span>
                              </td>
                              <td style={{ ...tdStyle, color: MUTED }}>{row.scholar_id || '—'}</td>
                              <td style={tdStyle}>{formatYearLevel(row.year_level)}</td>
                              <td style={tdStyle}>{fmtNum(gpaOf(row), 2)}</td>
                              <td style={tdStyle}>{fmtNum(reportsOf(row))}</td>
                              <td style={tdStyle}>{fmtNum(hoursOf(row), 1)}</td>
                              <td style={tdStyle}>{fmtNum(activitiesOf(row))}</td>
                              <td style={tdStyle}><StatusPill status={status} /></td>
                              <td style={tdStyle}>
                                <button
                                  type="button"
                                  onClick={() => setReportRow(row)}
                                  style={{
                                    ...body, fontSize: '0.76rem', fontWeight: 600, color: PRIMARY, background: '#fff',
                                    border: `1px solid ${BORDER}`, borderRadius: 9, padding: '6px 11px', cursor: 'pointer',
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                  }}
                                >
                                  <FileText size={13} /> View Report
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" style={{ marginTop: 14 }}>
                    <span style={{ ...body, fontSize: '0.8rem', color: MUTED }}>
                      Showing {pageStart + 1}–{Math.min(pageStart + SCHOLARS_PER_PAGE, filteredScholarRows.length)} of {filteredScholarRows.length} scholar{filteredScholarRows.length === 1 ? '' : 's'}
                    </span>
                    {scholarPageCount > 1 && (
                      <nav aria-label="Scholar pages" className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setScholarPage((p) => Math.max(1, p - 1))}
                          disabled={scholarPage === 1}
                          style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: scholarPage === 1 ? MUTED : PRIMARY, border: `1px solid ${BORDER}`, borderRadius: 9, padding: '6px 11px', background: '#fff', cursor: scholarPage === 1 ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <ChevronLeft size={14} /> Previous
                        </button>
                        {pageNumbers(scholarPage, scholarPageCount).map((p, i) => (
                          p === '…' ? (
                            <span key={`gap-${i}`} style={{ ...body, color: MUTED, padding: '0 4px' }}>…</span>
                          ) : (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setScholarPage(p)}
                              aria-current={p === scholarPage ? 'page' : undefined}
                              style={{
                                ...body, fontSize: '0.78rem', fontWeight: 700, minWidth: 32, padding: '6px 8px', borderRadius: 9, cursor: 'pointer',
                                border: `1px solid ${p === scholarPage ? PRIMARY : BORDER}`,
                                background: p === scholarPage ? PRIMARY : '#fff', color: p === scholarPage ? '#fff' : INK,
                              }}
                            >
                              {p}
                            </button>
                          )
                        ))}
                        <button
                          type="button"
                          onClick={() => setScholarPage((p) => Math.min(scholarPageCount, p + 1))}
                          disabled={scholarPage === scholarPageCount}
                          style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: scholarPage === scholarPageCount ? MUTED : PRIMARY, border: `1px solid ${BORDER}`, borderRadius: 9, padding: '6px 11px', background: '#fff', cursor: scholarPage === scholarPageCount ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          Next <ChevronRight size={14} />
                        </button>
                      </nav>
                    )}
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>

      {reportRow && <DonorReportModal row={reportRow} month={month} onClose={() => setReportRow(null)} />}

      {showMonthlyReport && (
        <MonthlyReportModal
          rows={rows}
          month={month}
          totals={totals}
          distributionData={distributionData}
          gpaByLevelData={gpaByLevelData}
          onClose={() => setShowMonthlyReport(false)}
        />
      )}
    </div>
  );
};

export default AdminDonorPage;  