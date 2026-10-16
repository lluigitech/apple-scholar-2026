import { useState, useMemo } from 'react';
import { Download, Search, X, ShieldCheck } from 'lucide-react';
import { formatYearLevelLabel } from '../../../utils/yearLevelLabels';

// ── Design tokens — "Apple Scholar Executive" system (matches AdminReports.jsx) ──
const PRIMARY = '#6D2140';
const PRIMARY_DEEP = '#4A1730';
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const INK = '#241512';
const MUTED = '#8A7A68';
const SUCCESS = '#6B8F71';
const SUCCESS_BG = '#EAF3EB';
const WARNING = '#C08A3E';
const WARNING_BG = '#FBF1DF';
const DANGER = '#A24A4A';
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

const RISK_BADGE = {
  low: { bg: SUCCESS_BG, color: SUCCESS, label: 'Low Risk' },
  medium: { bg: WARNING_BG, color: WARNING, label: 'Medium Risk' },
  high: { bg: DANGER_BG, color: DANGER, label: 'High Risk' },
  excellent: { bg: SUCCESS_BG, color: SUCCESS, label: 'Low Risk' },
  good: { bg: WARNING_BG, color: WARNING, label: 'Medium Risk' },
  'at-risk': { bg: DANGER_BG, color: DANGER, label: 'High Risk' },
};

// Small circular progress ring for compliance points
function CreditRing({ value, color }) {
  const size = 52;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={BORDER} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center"
        style={{ ...body, fontSize: '0.72rem', fontWeight: 800, color: INK }}
      >
        {Math.round(pct)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Presentational-only helpers (skeletons / empty state)
// ---------------------------------------------------------------------------

const ProfileCardSkeleton = () => (
  <div className="flex flex-col gap-3">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} style={{ ...surfaceCard, padding: '1rem 1.3rem', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#EFE3D4', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 14, width: 160, borderRadius: 8, background: '#EFE3D4' }} />
          <div style={{ height: 10, width: 100, borderRadius: 8, background: '#EFE3D4', marginTop: 8 }} />
        </div>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#EFE3D4', flexShrink: 0 }} />
        <div style={{ width: 100, height: 26, borderRadius: 999, background: '#EFE3D4', flexShrink: 0 }} />
      </div>
    ))}
  </div>
);

const EmptyState = ({ hasNoData }) => (
  <div className="text-center" style={{ ...surfaceCard, padding: '3.2rem 1.5rem' }}>
    <div
      style={{
        width: 52, height: 52, borderRadius: '50%', background: `${PRIMARY}12`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: PRIMARY,
      }}
    >
      <ShieldCheck size={24} />
    </div>
    <h3 style={{ ...display, fontSize: '1.15rem', color: INK }}>No compliance records found</h3>
    <p style={{ ...body, fontSize: '0.86rem', color: MUTED, marginTop: 6 }}>
      {hasNoData ? 'No compliance data available yet.' : 'Try adjusting the search or filters.'}
    </p>
  </div>
);

export default function ComplianceSummaryTab({
  rows = [],
  loading,
  error,
  onRefresh,
  onGenerate,
}) {
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [nameSearch, setNameSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');

  const handleGeneratePDF = async () => {
    setGeneratingPdf(true);
    try {
      await onGenerate();
    } finally {
      setGeneratingPdf(false);
    }
  };

  const getRiskBadge = (status) => RISK_BADGE[status] || RISK_BADGE.good;
  const getRingColor = (status) => {
    if (status === 'high' || status === 'at-risk') return DANGER;
    if (status === 'medium' || status === 'good') return WARNING;
    return SUCCESS;
  };

  const availableGrades = useMemo(() => {
    const grades = new Set();
    rows.forEach(row => {
      const grade = row.year_level || row.yearLevel || row.grade;
      if (grade) grades.add(grade);
    });
    return Array.from(grades).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      const name = (row.name || row.scholarName || row.full_name || '').toLowerCase();
      const studentId = (row.studentId || row.scholar_id || '').toLowerCase();
      const grade = row.year_level || row.yearLevel || row.grade || '';
      const risk = row.riskStatus || 'low';

      const searchTerm = nameSearch.toLowerCase();
      const matchesSearch = searchTerm === '' || name.includes(searchTerm) || studentId.includes(searchTerm);
      const matchesGrade = gradeFilter === '' || grade === gradeFilter;
      const matchesRisk = riskFilter === 'all' || risk === riskFilter;

      return matchesSearch && matchesGrade && matchesRisk;
    });
  }, [rows, nameSearch, gradeFilter, riskFilter]);

  if (error) {
    return (
      <div className="text-center" style={{ ...surfaceCard, padding: '3rem 1.5rem' }}>
        <p style={{ ...body, fontSize: '0.9rem', color: DANGER, marginBottom: 16 }}>{error}</p>
        <button
          onClick={onRefresh}
          style={{
            padding: '10px 22px', borderRadius: 10, background: PRIMARY, color: '#fff',
            ...body, fontWeight: 700, fontSize: '0.85rem', border: 'none', cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Smart toolbar ── */}
      <div className="flex flex-wrap items-center gap-3.5 p-4" style={{ ...surfaceCard, background: BG }}>
        <div className="relative flex-1" style={{ minWidth: 220 }}>
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: MUTED }} />
          <input
            type="text"
            placeholder="Search scholar name or ID…"
            value={nameSearch}
            onChange={e => setNameSearch(e.target.value)}
            style={{
              width: '100%', height: 46, paddingLeft: 38, paddingRight: 34,
              borderRadius: 12, border: `1px solid ${BORDER}`, background: '#fff',
              ...body, fontSize: '0.875rem', color: INK, outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = PRIMARY; }}
            onBlur={e => { e.target.style.borderColor = BORDER; }}
          />
          {nameSearch && (
            <button
              onClick={() => setNameSearch('')}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
            >
              <X className="w-4 h-4" style={{ color: MUTED }} />
            </button>
          )}
        </div>

        <select
          value={gradeFilter}
          onChange={e => setGradeFilter(e.target.value)}
          style={{
            height: 46, padding: '0 14px', borderRadius: 12, border: `1px solid ${BORDER}`,
            background: '#fff', ...body, fontSize: '0.875rem', color: INK, cursor: 'pointer', outline: 'none', minWidth: 170,
          }}
          onFocus={e => { e.target.style.borderColor = PRIMARY; }}
          onBlur={e => { e.target.style.borderColor = BORDER; }}
        >
          <option value="">All Year Levels</option>
          {availableGrades.map(grade => (
            <option key={grade} value={grade}>{grade}</option>
          ))}
        </select>

        {(nameSearch || gradeFilter || riskFilter !== 'all') && (
          <button
            onClick={() => { setNameSearch(''); setGradeFilter(''); setRiskFilter('all'); }}
            style={{
              height: 46, padding: '0 16px', borderRadius: 12, border: `1px solid ${BORDER}`, background: '#fff',
              ...body, fontSize: '0.78rem', fontWeight: 700, color: MUTED, cursor: 'pointer',
            }}
          >
            Clear Filters
          </button>
        )}

        <button
          onClick={handleGeneratePDF}
          disabled={generatingPdf}
          className="flex items-center gap-2"
          style={{ ...body, height: 46, padding: '0 16px', borderRadius: 12, border: 'none', background: PRIMARY, color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', opacity: generatingPdf ? 0.65 : 1 }}
        >
          <Download size={15} /> {generatingPdf ? 'Generating…' : 'Export PDF'}
        </button>

        <span style={{ marginLeft: 'auto', ...body, fontSize: '0.78rem', color: MUTED, fontWeight: 600 }}>
          Showing {filteredRows.length} of {rows.length}
        </span>
      </div>

      {/* ── 4. Executive compliance cards ── */}
      {loading ? (
        <ProfileCardSkeleton />
      ) : filteredRows.length > 0 ? (
        <div className="flex flex-col gap-3">
          {filteredRows.map((row, i) => {
            const risk = row.riskStatus || 'low';
            const badge = getRiskBadge(risk);
            const ringColor = getRingColor(risk);
            const name = row.name || '—';
            const initial = name.trim().charAt(0).toUpperCase() || '?';
            const credits = Number(row.completionRate ?? row.credits ?? 0);
            const yearLevel = row.year_level || row.yearLevel || row.grade || '—';
            return (
              <div
                key={i}
                className="flex items-center gap-5 flex-wrap"
                style={{ ...surfaceCard, padding: '1.1rem 1.4rem', borderLeft: `4px solid ${ringColor}` }}
              >
                {/* LEFT — avatar, name, id, status */}
                <span
                  className="flex items-center justify-center flex-shrink-0"
                  style={{ width: 46, height: 46, borderRadius: '50%', background: `${PRIMARY}12`, color: PRIMARY, ...display, fontWeight: 700, fontSize: '1.05rem' }}
                >
                  {initial}
                </span>

                <div style={{ minWidth: 160 }}>
                  <div style={{ ...body, fontSize: '0.94rem', fontWeight: 700, color: INK }}>{name}</div>
                  <div style={{ ...body, fontSize: '0.74rem', color: MUTED, marginTop: 2 }}>{row.studentId || '—'}</div>
                  <div className="flex items-center gap-1.5" style={{ marginTop: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: SUCCESS, display: 'inline-block' }} />
                    <span style={{ ...body, fontSize: '0.72rem', color: MUTED }}>{row.status || 'Active'}</span>
                  </div>
                </div>

                {/* CENTER — three metric blocks */}
                <div className="flex items-center gap-6 flex-wrap" style={{ marginLeft: 'auto' }}>
                  <div style={{ textAlign: 'center', minWidth: 76 }}>
                    <div style={{ ...body, fontSize: '0.62rem', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                      Year Level
                    </div>
                    <div style={{ ...display, fontSize: '0.98rem', fontWeight: 700, color: INK }}>{formatYearLevelLabel(yearLevel)}</div>
                  </div>

                  <div className="flex flex-col items-center" style={{ minWidth: 76 }}>
                    <div style={{ ...body, fontSize: '0.62rem', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                      Compliance Points
                    </div>
                    <CreditRing value={credits} color={ringColor} />
                  </div>

                  <div style={{ textAlign: 'center', minWidth: 76 }}>
                    <div style={{ ...body, fontSize: '0.62rem', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                      Completion
                    </div>
                    <div style={{ ...display, fontSize: '1.05rem', fontWeight: 700, color: PRIMARY_DEEP }}>{credits.toFixed(0)}%</div>
                  </div>
                </div>

                {/* RIGHT — risk badge + placeholder action */}
                <div className="flex flex-col items-end gap-2" style={{ minWidth: 130 }}>
                  <span
                    style={{
                      display: 'inline-block', padding: '7px 16px', borderRadius: 999,
                      ...body, fontSize: '0.78rem', fontWeight: 700, background: badge.bg, color: badge.color,
                    }}
                  >
                    {badge.label}
                  </span>
                  <button
                    disabled
                    title="Coming soon"
                    style={{
                      ...body, fontSize: '0.7rem', fontWeight: 600, color: MUTED,
                      border: `1px solid ${BORDER}`, borderRadius: 8, padding: '4px 10px',
                      background: '#fff', cursor: 'not-allowed', opacity: 0.7,
                    }}
                  >
                    View Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState hasNoData={rows.length === 0} />
      )}
    </div>
  );
}