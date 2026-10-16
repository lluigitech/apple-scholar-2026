import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Download, FileText, UserRound, Search, FileSpreadsheet } from 'lucide-react';
import AdminReportDetail from '../../components/Admin/Reports/AdminReportDetail';
import { downloadReportSummaryPdf } from '../../utils/reportPdfExport';
import { formatYearLevelLabel } from '../../utils/yearLevelLabels';
import { formatAdminMonth } from '../../utils/adminPreferences';
import AdminPageHeader from '../../components/Admin/AdminPageHeader';

// ── Design tokens — "Apple Scholar Executive" system ──
const PRIMARY = '#6D2140';
const BRONZE = '#A9784E';
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const INK = '#241512';
const MUTED = '#8A7A68';
const SUCCESS = '#6B8F71';
const SUCCESS_BG = '#EAF3EB';
const WARNING = '#C08A3E';
const WARNING_BG = '#FBF1DF';
const DANGER = '#C0473F';
const DANGER_BG = '#FBEAE8';
const RADIUS = 18;

const display = { fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };

const surfaceCard = {
  background: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: RADIUS,
  boxShadow: '0 1px 2px rgba(36,21,18,0.03), 0 14px 30px -16px rgba(74,23,48,0.14)',
};

const API_BASE = (import.meta.env?.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;

const authHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
});

const formatMonthLabel = (monthValue) => {
  if (!monthValue) return 'Selected Month';
  const [year, month] = monthValue.split('-');
  if (!year || !month) return monthValue;
  const date = new Date(Number(year), Number(month) - 1, 1);
  return formatAdminMonth(date);
};

const exportCsv = (rows, filename) => {
  const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

// ---------------------------------------------------------------------------
// Presentational-only helpers (UI redesign; no data logic lives here)
// ---------------------------------------------------------------------------

const statusBadgeTone = (status) => {
  if (status === 'high-risk') return { bg: DANGER_BG, color: DANGER, label: 'High Risk' };
  if (status === 'medium-risk') return { bg: WARNING_BG, color: WARNING, label: 'Medium Risk' };
  return { bg: SUCCESS_BG, color: SUCCESS, label: 'Approved' };
};

// Small circular quality-score chip
const QualityRing = ({ score, color }) => {
  const size = 40;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score));
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={BORDER} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center" style={{ ...body, fontSize: '0.62rem', fontWeight: 800, color: INK }}>
        {Math.round(pct)}
      </span>
    </div>
  );
};

const KPICard = ({ icon: IconEl, label, value, helper, accent }) => (
  <div style={{ ...surfaceCard, padding: '1.1rem 1.3rem' }}>
    <div
      style={{
        width: 38, height: 38, borderRadius: '50%', background: `${accent}14`, color: accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
      }}
    >
      <IconEl size={17} />
    </div>
    <div style={{ ...display, fontSize: '1.7rem', color: INK, lineHeight: 1 }}>{value}</div>
    <div style={{ ...body, fontSize: '0.68rem', color: MUTED, marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    {helper && <div style={{ ...body, fontSize: '0.7rem', color: MUTED, marginTop: 2 }}>{helper}</div>}
  </div>
);

const KPISkeleton = () => (
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} style={{ ...surfaceCard, padding: '1.1rem 1.3rem' }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#EFE3D4', marginBottom: 12 }} />
        <div style={{ height: 22, width: 48, borderRadius: 8, background: '#EFE3D4' }} />
        <div style={{ height: 9, width: 90, borderRadius: 8, background: '#EFE3D4', marginTop: 10 }} />
      </div>
    ))}
  </div>
);

const RegistryCardSkeleton = () => (
  <div className="flex flex-col gap-3">
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} style={{ ...surfaceCard, padding: '1.1rem 1.4rem' }}>
        <div className="flex items-center gap-4">
          <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#EFE3D4', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: 14, width: 160, borderRadius: 8, background: '#EFE3D4' }} />
            <div style={{ height: 10, width: 100, borderRadius: 8, background: '#EFE3D4', marginTop: 8 }} />
          </div>
          <div style={{ width: 90, height: 26, borderRadius: 999, background: '#EFE3D4' }} />
        </div>
        <div style={{ height: 56, borderRadius: 12, background: '#F2E9DC', marginTop: 14 }} />
      </div>
    ))}
  </div>
);

const EmptyState = () => (
  <div className="text-center" style={{ ...surfaceCard, padding: '3.2rem 1.5rem' }}>
    <div
      style={{
        width: 52, height: 52, borderRadius: '50%', background: `${PRIMARY}12`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: PRIMARY,
      }}
    >
      <FileText size={24} />
    </div>
    <h3 style={{ ...display, fontSize: '1.15rem', color: INK }}>No scholars found</h3>
    <p style={{ ...body, fontSize: '0.86rem', color: MUTED, marginTop: 6 }}>
      There are no submissions for this reporting period.
    </p>
  </div>
);

export default function MonthlyReportYearLevelPage() {
  const navigate = useNavigate();
  const { month, yearLevel } = useParams();
  const decodedYearLevel = decodeURIComponent(yearLevel || '');
  const displayYearLevel = formatYearLevelLabel(decodedYearLevel);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);

  useEffect(() => {
    const fetchReports = async () => {
      if (!month) return;
      setLoading(true);
      setError('');

      try {
        const res = await axios.get(`${API}/admin/reports/monthly-submissions`, {
          ...authHeaders(),
          params: { month, year_level: decodedYearLevel },
        });

        setReports(res.data || []);
      } catch (err) {
        console.error(err);
        setError('Failed to load scholars for this year level.');
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [month, decodedYearLevel]);

  const scholars = useMemo(() => {
    const map = new Map();

    reports.forEach(report => {
      const name = report.scholarName || 'Unknown Scholar';
      const existing = map.get(name) || {
        name,
        userId: report.userId || report.user_id || null,
        scholarId: report.scholar_id || report.studentId || '—',
        reports: [],
        officer: report.assignedOfficer || 'Unassigned',
      };

      existing.reports.push(report);
      if (!existing.userId && (report.userId || report.user_id)) existing.userId = report.userId || report.user_id;
      if (existing.scholarId === '—' && (report.scholar_id || report.studentId)) existing.scholarId = report.scholar_id || report.studentId;
      if (report.assignedOfficer && report.assignedOfficer !== 'Unassigned') existing.officer = report.assignedOfficer;

      map.set(name, existing);
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [reports]);

  const exportYearLevelReport = () => {
    const rows = [
      ['Scholar Name', 'Scholar ID', 'Reports Submitted', 'Latest Submitted', 'Officer'],
      ...scholars.map(scholar => [
        scholar.name,
        scholar.scholarId,
        scholar.reports.length,
        scholar.reports[0]?.submittedAt || '—',
        scholar.officer || 'Unassigned',
      ]),
    ];
    const safeMonth = month || 'selected-month';
    const safeYearLevel = (decodedYearLevel || 'all-year-levels').replace(/\s+/g, '-');
    exportCsv(rows, `monthly-reports-${safeMonth}-${safeYearLevel}.csv`);
  };

  const exportYearLevelPdf = async () => {
    if (!scholars.length) return;

    const rows = scholars.map(scholar => {
      const latestReport = scholar.reports[0] || {};
      const averageScore = scholar.reports.length
        ? Math.round(scholar.reports.reduce((sum, report) => sum + Number(report.qualityScore ?? report.quality_score ?? 0), 0) / scholar.reports.length)
        : 0;
      const highestRisk = scholar.reports.some(report => report.status === 'high-risk')
        ? 'High Risk'
        : scholar.reports.some(report => report.status === 'medium-risk')
          ? 'Medium Risk'
          : 'Approved';

      return {
        scholarName: scholar.name,
        studentId: scholar.scholarId,
        submitted: scholar.reports.length,
        submittedAt: latestReport.submittedAt || '',
        qualityStatus: `${averageScore}/100`,
        reviewStatus: highestRisk,
      };
    });

    await downloadReportSummaryPdf({
      role: 'admin',
      reportTitle: 'Monthly Letter Report',
      reportType: 'Monthly Letter',
      periodLabel: formatMonthLabel(month),
      rows,
      endorsedTo: [],
    });
  };

  const scoreTone = (score) => {
    const value = Number(score || 0);
    if (value >= 80) return { bg: '#d1fae5', color: '#065f46' };
    if (value >= 60) return { bg: '#fef3c7', color: '#92400e' };
    return { bg: '#fee2e2', color: '#991b1b' };
  };

  // ---- Presentation-only derived values (new; do not alter data above) ----

  const [scholarSearch, setScholarSearch] = useState('');

  const filteredScholars = useMemo(() => {
    const term = scholarSearch.trim().toLowerCase();
    if (!term) return scholars;
    return scholars.filter(
      s => s.name.toLowerCase().includes(term)
        || String(s.scholarId).toLowerCase().includes(term)
        || String(s.officer || 'Unassigned').toLowerCase().includes(term)
    );
  }, [scholars, scholarSearch]);

  const kpis = useMemo(() => {
    const approved = reports.filter(r => r.status === 'accepted').length;
    const highRisk = reports.filter(r => r.status === 'high-risk').length;
    return [
      { key: 'scholars', icon: UserRound, label: 'Total Scholars', value: scholars.length, helper: displayYearLevel || 'All year levels', accent: PRIMARY },
      { key: 'reports', icon: FileSpreadsheet, label: 'Total Reports', value: reports.length, helper: formatMonthLabel(month), accent: BRONZE },
      { key: 'approved', icon: FileText, label: 'Approved Reports', value: approved, helper: 'Meets standards', accent: SUCCESS },
      { key: 'highrisk', icon: FileText, label: 'High Risk Reports', value: highRisk, helper: 'Needs attention', accent: DANGER },
    ];
  }, [reports, scholars.length, decodedYearLevel, month]);

  const scholarStatus = (scholar) => {
    if (scholar.reports.some(r => r.status === 'high-risk')) return statusBadgeTone('high-risk');
    if (scholar.reports.some(r => r.status === 'medium-risk')) return statusBadgeTone('medium-risk');
    return statusBadgeTone('accepted');
  };

  return (
    <div className="min-h-screen w-full" style={{ background: BG, color: INK }}>
      <div className="w-full px-4 sm:px-6 lg:px-8">

        <AdminPageHeader
          title="Monthly Report Registry"
          description="Review scholar submissions for the selected reporting month and year level."
          className="mb-6"
          actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2"
              style={{
                ...body, fontSize: '0.8rem', fontWeight: 600, color: PRIMARY,
                background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 999, padding: '8px 16px', cursor: 'pointer',
              }}
            >
              <ArrowLeft size={14} /> Back to Compliance Reports
            </button>
            <span style={{ ...body, fontSize: '0.8rem', fontWeight: 600, color: INK, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '8px 14px' }}>
              {formatMonthLabel(month)}
            </span>
            <span style={{ ...body, fontSize: '0.8rem', fontWeight: 600, color: INK, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '8px 14px' }}>
              {displayYearLevel || 'All Year Levels'}
            </span>
            <button
              onClick={exportYearLevelReport}
              className="flex items-center gap-2"
              style={{ ...body, fontSize: '0.82rem', fontWeight: 600, color: PRIMARY, background: '#fff', border: `1.5px solid ${PRIMARY}`, borderRadius: 12, padding: '9px 16px', cursor: 'pointer' }}
            >
              <Download size={14} /> Export CSV
            </button>
            <button
              onClick={exportYearLevelPdf}
              className="flex items-center gap-2"
              style={{ ...body, fontSize: '0.82rem', fontWeight: 600, color: '#fff', background: PRIMARY, border: 'none', borderRadius: 12, padding: '9px 18px', cursor: 'pointer' }}
            >
              <FileText size={14} /> Export PDF
            </button>
          </div>
          }
        />

        {/* ── KPI overview ── */}
        {loading ? (
          <div className="mb-6"><KPISkeleton /></div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
            {kpis.map(k => (
              <KPICard key={k.key} icon={k.icon} label={k.label} value={k.value} helper={k.helper} accent={k.accent} />
            ))}
          </div>
        )}

        {/* ── Smart toolbar ── */}
        <div className="flex flex-wrap items-center gap-3 mb-6 p-4" style={{ ...surfaceCard, background: BG }}>
          <div className="relative flex-1" style={{ minWidth: 220 }}>
            <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: MUTED }} />
            <input
              type="text"
              value={scholarSearch}
              onChange={e => setScholarSearch(e.target.value)}
              placeholder="Search assigned officer, scholar, or ID…"
              style={{
                width: '100%', height: 44, paddingLeft: 38, paddingRight: 14,
                borderRadius: 12, border: `1px solid ${BORDER}`, background: '#fff',
                ...body, fontSize: '0.86rem', color: INK, outline: 'none',
              }}
            />
          </div>
          <span style={{ ...body, fontSize: '0.8rem', color: MUTED, fontWeight: 600, marginLeft: 'auto' }}>
            Showing {filteredScholars.length} Scholar{filteredScholars.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* ── Scholar registry ── */}
        {loading ? (
          <RegistryCardSkeleton />
        ) : error ? (
          <div className="text-center" style={{ ...surfaceCard, padding: '2.5rem 1.5rem' }}>
            <p style={{ ...body, fontSize: '0.9rem', color: DANGER }}>{error}</p>
          </div>
        ) : filteredScholars.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-3">
            {filteredScholars.map(scholar => {
              const badge = scholarStatus(scholar);
              const latestReport = scholar.reports[0];
              const previousCount = scholar.reports.length - 1;
              const initial = scholar.name.trim().charAt(0).toUpperCase() || '?';

              return (
                <div key={`${scholar.name}-${scholar.scholarId}`} style={{ ...surfaceCard, padding: '1.2rem 1.4rem' }}>
                  <div className="flex flex-wrap items-center gap-4">
                    {/* LEFT — avatar, name, id */}
                    <span
                      className="flex items-center justify-center flex-shrink-0"
                      style={{ width: 46, height: 46, borderRadius: '50%', background: `${PRIMARY}12`, color: PRIMARY, ...display, fontWeight: 700, fontSize: '1.05rem' }}
                    >
                      {initial}
                    </span>
                    <div style={{ minWidth: 150 }}>
                      <div style={{ ...body, fontSize: '0.94rem', fontWeight: 700, color: INK }}>{scholar.name}</div>
                      <div style={{ ...body, fontSize: '0.74rem', color: MUTED, marginTop: 2 }}>{scholar.scholarId}</div>
                    </div>

                    {/* CENTER — three metric blocks */}
                    <div className="flex items-center gap-6 flex-wrap" style={{ marginLeft: 'auto' }}>
                      <div style={{ textAlign: 'center', minWidth: 90 }}>
                        <div style={{ ...body, fontSize: '0.62rem', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                          Reports Submitted
                        </div>
                        <div style={{ ...display, fontSize: '1.05rem', fontWeight: 700, color: INK }}>{scholar.reports.length}</div>
                      </div>
                      <div style={{ textAlign: 'center', minWidth: 110 }}>
                        <div style={{ ...body, fontSize: '0.62rem', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                          Latest Submission
                        </div>
                        <div style={{ ...body, fontSize: '0.82rem', fontWeight: 600, color: INK }}>{latestReport?.submittedAt || '—'}</div>
                      </div>
                      <div style={{ textAlign: 'center', minWidth: 110 }}>
                        <div style={{ ...body, fontSize: '0.62rem', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                          Assigned Officer
                        </div>
                        <div style={{ ...body, fontSize: '0.82rem', fontWeight: 600, color: INK }}>{scholar.officer || 'Unassigned'}</div>
                      </div>
                    </div>

                    {/* RIGHT — status badge + view reports */}
                    <div className="flex flex-col items-end gap-2">
                      <span style={{ ...body, fontSize: '0.76rem', fontWeight: 700, borderRadius: 999, padding: '6px 14px', background: badge.bg, color: badge.color }}>
                        {badge.label}
                      </span>
                      {latestReport && (
                        <button
                          onClick={() => setSelectedReport(latestReport)}
                          style={{
                            ...body, fontSize: '0.76rem', fontWeight: 600, color: PRIMARY,
                            border: `1px solid ${PRIMARY}`, borderRadius: 10, padding: '6px 14px',
                            background: '#fff', cursor: 'pointer',
                          }}
                        >
                          View Reports
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Latest report preview */}
                  {latestReport && (
                    <div
                      onClick={() => setSelectedReport(latestReport)}
                      className="mt-4"
                      style={{ borderRadius: 12, border: `1px solid ${BORDER}`, padding: '12px 16px', background: BG, cursor: 'pointer' }}
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <div style={{ ...body, fontSize: '0.82rem', fontWeight: 700, color: INK }}>Monthly Progress Report</div>
                          <div style={{ ...body, fontSize: '0.72rem', color: MUTED, marginTop: 2 }}>
                            Submitted: {latestReport.submittedAt || '—'}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <QualityRing
                            score={Number(latestReport.qualityScore ?? latestReport.quality_score ?? 0)}
                            color={scoreTone(latestReport.qualityScore ?? latestReport.quality_score).color}
                          />
                        </div>
                      </div>
                      {previousCount > 0 && (
                        <div style={{ ...body, fontSize: '0.72rem', color: MUTED, marginTop: 8 }}>
                          +{previousCount} previous submission{previousCount === 1 ? '' : 's'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedReport && (
        <AdminReportDetail
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </div>
  );
}