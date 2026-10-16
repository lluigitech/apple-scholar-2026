import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';
import {
  Download, TrendingUp, Users, FileText, AlertTriangle, BarChart3,
  CalendarDays, ShieldCheck, PieChart as PieChartIcon,
} from 'lucide-react';
import { API_BASE, authHeaders } from '../../components/Officer/Reports/ReportsHelpers';
import { formatYearLevelLabel } from '../../utils/yearLevelLabels';

// ── Token system — shared across the whole portal ──
const MAROON = '#7f2d3a';
const MAROON_DEEP = '#4f1620';
const GOLD = '#b98b4e';
const GOLD_LIGHT = '#d4af7a';
const IVORY = '#FBF7F2';
const INK = '#241512';
const SAGE = '#6b8f71';
const CLAY = '#c1666b';
const AMBER = '#b8863f';
const PAPER = '#F6EFE4';
const RULE = '#e8dccb';

const serif = { fontFamily: "'Playfair Display', serif" };
const sans = { fontFamily: "'DM Sans', sans-serif" };
const mono = { fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, monospace" };
const chartStyle = { ...sans, fontSize: '0.72rem' };

const tile = {
  background: '#fff',
  border: `1px solid ${RULE}`,
  borderRadius: 14,
  boxShadow: '0 8px 20px -16px rgba(36,21,18,0.35)',
};
const tooltipStyle = { ...sans, fontSize: '0.8rem', borderRadius: 8, border: `1px solid ${RULE}` };

const getPeriodRange = (period) => {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - (period === '1m' ? 0 : period === '3m' ? 2 : 5), 1);
  return {
    date_from: start.toISOString().slice(0, 10),
    date_to: end.toISOString().slice(0, 10),
  };
};

// ── KPI card ──
function StatCard({ label, value, sub, color, icon: Icon }) {
  return (
    <div className="flex h-full items-center gap-4" style={{ ...tile, padding: '16px 20px', minWidth: 0 }}>
      <span className="inline-flex flex-shrink-0 items-center justify-center rounded-full" style={{ width: 48, height: 48, background: `${color}1a` }}>
        <Icon size={22} strokeWidth={1.75} style={{ color }} />
      </span>
      <div style={{ minWidth: 0 }}>
        <p style={{ ...sans, fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a89890' }}>{label}</p>
        <p style={{ ...serif, fontSize: '1.75rem', fontWeight: 700, color: INK, lineHeight: 1.1, marginTop: 2 }}>{value}</p>
        {sub && <p className="truncate" style={{ ...sans, fontSize: '0.74rem', color: '#7a6a62', marginTop: 3 }}>{sub}</p>}
      </div>
    </div>
  );
}

// ── Chart card shell ──
function ChartCard({ icon: Icon, title, description, children, className = '' }) {
  return (
    <section className={`min-w-0 ${className}`} style={{ ...tile, padding: '18px 20px' }}>
      <div className="flex items-start gap-3" style={{ marginBottom: 14 }}>
        <span className="inline-flex flex-shrink-0 items-center justify-center rounded-lg" style={{ width: 34, height: 34, background: `${GOLD}1a` }}>
          <Icon size={17} strokeWidth={1.75} style={{ color: GOLD }} />
        </span>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ ...serif, fontSize: '1.02rem', fontWeight: 700, color: MAROON, lineHeight: 1.25 }}>{title}</h3>
          {description && <p style={{ ...sans, fontSize: '0.76rem', color: '#a89890', marginTop: 2 }}>{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

const EmptyNote = ({ children }) => (
  <div className="flex items-center justify-center" style={{ minHeight: 120 }}>
    <p style={{ ...sans, fontSize: '0.8rem', color: '#a89890' }}>{children}</p>
  </div>
);

const Skeleton = ({ height }) => (
  <div className="animate-pulse" style={{ ...tile, height, background: `${PAPER}` }} aria-hidden="true" />
);

const OfficerAnalytics = () => {
  const [period, setPeriod] = useState('6m');
  const [selectedYearLevel, setSelectedYearLevel] = useState('all');
  const [monthlySubs, setMonthlySubs] = useState([]);
  const [complianceSummary, setComplianceSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const range = getPeriodRange(period);
        const params = { ...range };
        if (selectedYearLevel !== 'all') params.year_level = selectedYearLevel;
        const [summaryRes, monthlyRes] = await Promise.all([
          axios.get(`${API_BASE}/officer/reports/compliance-summary`, { ...authHeaders(), params }),
          axios.get(`${API_BASE}/officer/reports/monthly-submissions`, { ...authHeaders(), params }),
        ]);

        setComplianceSummary(summaryRes.data || []);
        setMonthlySubs(monthlyRes.data || []);
      } catch (err) {
        console.error('Error loading analytics data:', err);
        setError('Unable to load analytics data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [period, selectedYearLevel]);

  const yearLevelOptions = useMemo(() => {
    const levels = Array.from(new Set(complianceSummary
      .map(item => item.year_level || 'Unknown')
      .filter(Boolean)));
    return ['all', ...levels];
  }, [complianceSummary]);

  const visibleSummary = selectedYearLevel === 'all'
    ? complianceSummary
    : complianceSummary.filter(item => item.year_level === selectedYearLevel);
  const totalScholars = visibleSummary.length;
  const avgCompliance = totalScholars > 0
    ? Math.round(visibleSummary.reduce((sum, item) => sum + (item.completionRate || 0), 0) / totalScholars)
    : 0;
  const lettersReviewed = monthlySubs.filter(sub => sub.staffAction === 'approved').length;
  const atRiskScholars = visibleSummary.filter(item => item.completionRate < 50).length;

  const yearLevelCompliance = useMemo(() => {
    const grouped = {};
    const source = selectedYearLevel === 'all'
      ? complianceSummary
      : complianceSummary.filter(item => item.year_level === selectedYearLevel);

    source.forEach((item) => {
      const level = item.year_level || 'Unknown';
      if (!grouped[level]) grouped[level] = { total: 0, sumCompliance: 0 };
      grouped[level].total += 1;
      grouped[level].sumCompliance += item.completionRate || 0;
    });

    return Object.entries(grouped).map(([level, stats]) => ({
      level,
      compliance: stats.total ? Math.round(stats.sumCompliance / stats.total) : 0,
      scholars: stats.total,
    }));
  }, [complianceSummary, selectedYearLevel]);

  const sentimentDist = useMemo(() => {
    const counts = { Positive: 0, Neutral: 0, Negative: 0 };
    monthlySubs.forEach((sub) => {
      const label = String(sub.sentimentLabel || 'Neutral').toLowerCase();
      if (label.includes('negative')) counts.Negative += 1;
      else if (label.includes('positive')) counts.Positive += 1;
      else counts.Neutral += 1;
    });
    const total = monthlySubs.length || 1;
    return [
      { name: 'Positive', value: counts.Positive, color: SAGE },
      { name: 'Neutral', value: counts.Neutral, color: AMBER },
      { name: 'Negative', value: counts.Negative, color: CLAY },
    ].map(item => ({ ...item, pct: Math.round((item.value / total) * 100) }));
  }, [monthlySubs]);

  const completenessData = useMemo(() => {
    const total = monthlySubs.length || 1;
    const counts = {
      'Letter body (50+ words)': 0,
      'Minimum length (150+ words)': 0,
      'At least 1 photo': 0,
      'All photos have descriptions': 0,
    };

    monthlySubs.forEach((sub) => {
      sub.checklistResults?.forEach((check) => {
        if (check.passed) counts[check.label] += 1;
      });
    });

    return Object.entries(counts).map(([category, passed]) => ({
      category,
      pct: Math.round((passed / total) * 100),
    }));
  }, [monthlySubs]);

  const monthlyTrend = useMemo(() => {
    const groups = {};
    monthlySubs.forEach((sub) => {
      const date = new Date(sub.submittedAt || sub.date);
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[key]) groups[key] = { month: key, submissions: 0, compliantCount: 0, sentimentPositive: 0, sentimentNeutral: 0, sentimentNegative: 0 };
      groups[key].submissions += 1;
      const qualityStatus = String(sub.status || '').toLowerCase();
      if (qualityStatus !== 'high-risk') groups[key].compliantCount += 1;
      const sentiment = String(sub.sentimentLabel || 'Neutral').toLowerCase();
      if (sentiment.includes('negative')) groups[key].sentimentNegative += 1;
      else if (sentiment.includes('positive')) groups[key].sentimentPositive += 1;
      else groups[key].sentimentNeutral += 1;
    });

    const sorted = Object.values(groups).sort((a, b) => a.month.localeCompare(b.month));
    return sorted.map((item) => {
      const date = new Date(`${item.month}-01`);
      return {
        month: date.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
        submissions: item.submissions,
        compliance: item.submissions ? Math.round((item.compliantCount / item.submissions) * 100) : 0,
        sentimentPos: item.submissions ? Math.round((item.sentimentPositive / item.submissions) * 100) : 0,
        sentimentNeg: item.submissions ? Math.round((item.sentimentNegative / item.submissions) * 100) : 0,
        sentimentNeutral: item.submissions ? Math.round((item.sentimentNeutral / item.submissions) * 100) : 0,
      };
    });
  }, [monthlySubs]);

  const displayTrend = useMemo(() => {
    if (period === '1m') return monthlyTrend.slice(-1);
    if (period === '3m') return monthlyTrend.slice(-3);
    return monthlyTrend;
  }, [monthlyTrend, period]);

  const topIssues = useMemo(() => {
    const counts = {
      'Below minimum length': 0,
      'Missing photo': 0,
      'Missing photo descriptions': 0,
      'High-risk letters': 0,
    };

    monthlySubs.forEach((sub) => {
      const checks = sub.checklistResults || [];
      if (!checks.find(c => c.label === 'Letter body (50+ words)')?.passed) counts['Below minimum length'] += 1;
      if (!checks.find(c => c.label === 'Minimum length (150+ words)')?.passed) counts['Below minimum length'] += 1;
      if (!checks.find(c => c.label === 'At least 1 photo')?.passed) counts['Missing photo'] += 1;
      if (!checks.find(c => c.label === 'All photos have descriptions')?.passed) counts['Missing photo descriptions'] += 1;
      if (String(sub.status || '').toLowerCase() === 'high-risk') counts['High-risk letters'] += 1;
    });

    const total = monthlySubs.length || 1;
    return Object.entries(counts)
      .map(([issue, count]) => ({ issue, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [monthlySubs]);

  const exportCSV = () => {
    const rows = [['Month', 'Submissions', 'Compliance%', 'Positive%', 'Negative%', 'Neutral%']];
    displayTrend.forEach(d => rows.push([d.month, String(d.submissions), String(d.compliance), String(d.sentimentPos), String(d.sentimentNeg), String(d.sentimentNeutral)]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'officer_analytics.csv'; a.click();
    URL.revokeObjectURL(url);
    axios.post(`${API_BASE}/export/google-sheets`, { log_only: true, module: 'Officer Analytics', report_resource: 'Analytics', spreadsheet_title: 'Officer Analytics Export', details: 'officer_analytics.csv' }, authHeaders()).catch(() => {});
  };

  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const yearChartMinWidth = Math.max(480, yearLevelCompliance.length * 72);
  const hasBody = !loading && !error;

  return (
    <div className="min-h-screen" style={{ background: IVORY, ...sans }}>
      <style>{`
        .oa-btn:focus-visible, .oa-field:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 2px; }
        .oa-field:focus { border-color: ${GOLD} !important; }
        .oa-export:hover { background: ${PAPER}; }
        .oa-scroll::-webkit-scrollbar { height: 6px; }
        .oa-scroll::-webkit-scrollbar-thumb { background: rgba(127,45,58,.2); border-radius: 999px; }
      `}</style>

      <div className="flex flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8" style={{ minWidth: 0 }}>

        {/* ── Standard Officer header: title card + date card ── */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
          <div style={{ ...tile, padding: '20px 24px' }}>
            <p style={{ ...sans, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', color: GOLD }}>OFFICER PORTAL</p>
            <h1 style={{ ...serif, fontSize: '1.75rem', fontWeight: 700, color: MAROON_DEEP, marginTop: 4, lineHeight: 1.2 }}>Analytics</h1>
            <p style={{ ...sans, fontSize: '0.84rem', color: '#a89890', marginTop: 6, maxWidth: 640 }}>
              Track submission trends, compliance rates, and scholar performance.
            </p>
          </div>
          <div className="flex items-center gap-3" style={{ ...tile, padding: '16px 24px' }}>
            <span className="inline-flex flex-shrink-0 items-center justify-center" style={{ width: 42, height: 42, borderRadius: 12, background: `${MAROON}10` }}>
              <CalendarDays size={19} style={{ color: MAROON }} />
            </span>
            <div>
              <p style={{ ...sans, fontSize: '0.68rem', color: '#a89890' }}>Today</p>
              <p style={{ ...sans, fontSize: '0.92rem', fontWeight: 600, color: INK, whiteSpace: 'nowrap' }}>{todayLabel}</p>
            </div>
          </div>
        </div>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Scholars" value={loading ? '—' : totalScholars}
            sub={selectedYearLevel === 'all' ? 'Across all year levels' : formatYearLevelLabel(selectedYearLevel)} color={MAROON} icon={Users} />
          <StatCard label="Average Compliance" value={loading ? '—' : `${avgCompliance}%`}
            sub="Overall completion rate" color={SAGE} icon={ShieldCheck} />
          <StatCard label="Letters Reviewed" value={loading ? '—' : lettersReviewed}
            sub="Approved by officers" color={GOLD} icon={FileText} />
          <StatCard label="At-Risk Scholars" value={loading ? '—' : atRiskScholars}
            sub="Below 50% compliance" color={CLAY} icon={AlertTriangle} />
        </div>

        {/* ── Filter toolbar ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center" style={{ ...tile, padding: '12px 18px' }}>
          <div className="flex items-center gap-3">
            <span style={{ ...sans, fontSize: '0.78rem', color: '#7a6a62' }}>Period</span>
            <div className="inline-flex gap-1.5" role="group" aria-label="Period">
              {['1m', '3m', '6m'].map(p => {
                const active = period === p;
                return (
                  <button key={p} type="button" aria-pressed={active} onClick={() => setPeriod(p)} className="oa-btn transition-colors"
                    style={{ ...sans, height: 36, minWidth: 48, padding: '0 14px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                      background: active ? MAROON : PAPER, color: active ? '#fff' : INK, border: `1px solid ${active ? MAROON : RULE}` }}>
                    {p.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 sm:ml-4" style={{ minWidth: 0 }}>
            <label htmlFor="oa-year" style={{ ...sans, fontSize: '0.78rem', color: '#7a6a62', whiteSpace: 'nowrap' }}>Year Level</label>
            <select id="oa-year" className="oa-field" value={selectedYearLevel} onChange={(e) => setSelectedYearLevel(e.target.value)}
              style={{ ...sans, height: 38, minWidth: 180, maxWidth: '100%', padding: '0 12px', borderRadius: 8, border: `1px solid ${RULE}`, background: '#fff', fontSize: '0.82rem', color: INK, cursor: 'pointer', outline: 'none' }}>
              {yearLevelOptions.map(level => (
                <option key={level} value={level}>{level === 'all' ? 'All Year Levels' : formatYearLevelLabel(level)}</option>
              ))}
            </select>
          </div>

          <button type="button" onClick={exportCSV} className="oa-btn oa-export inline-flex items-center justify-center gap-2 sm:ml-auto"
            style={{ ...sans, height: 38, padding: '0 16px', borderRadius: 8, background: '#fff', color: MAROON, border: `1px solid ${MAROON}`, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
            <Download size={14} /> Export CSV
          </button>
        </div>

        {/* ── Error ── */}
        {error && (
          <div role="alert" className="flex items-center gap-2" style={{ ...tile, borderLeft: `3px solid ${CLAY}`, background: `${CLAY}0d`, padding: '12px 16px', ...sans, fontSize: '0.82rem', fontWeight: 600, color: CLAY }}>
            <AlertTriangle size={15} className="flex-shrink-0" /> {error}
          </div>
        )}

        {/* ── Loading skeletons ── */}
        {loading && (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><Skeleton height={300} /><Skeleton height={300} /></div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><Skeleton height={230} /><Skeleton height={230} /></div>
            <Skeleton height={300} />
          </>
        )}

        {hasBody && (
          <>
            {/* ── Row 1: trend + sentiment ── */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard icon={TrendingUp} title="Monthly Submissions Trend" description="Compliance and sentiment percentages per month.">
                {displayTrend.length === 0 ? <EmptyNote>No submissions in this period.</EmptyNote> : (
                  <div style={{ width: '100%', height: 240, minWidth: 0 }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <LineChart data={displayTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={RULE} />
                        <XAxis dataKey="month" stroke="#a89890" style={chartStyle} />
                        <YAxis stroke="#a89890" style={chartStyle} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ ...sans, fontSize: '0.75rem' }} />
                        <Line type="monotone" dataKey="compliance" stroke={MAROON} strokeWidth={2} name="Compliance %" dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="sentimentPos" stroke={SAGE} strokeWidth={2} name="Positive %" dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="sentimentNeg" stroke={CLAY} strokeWidth={2} name="Negative %" dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </ChartCard>

              <ChartCard icon={PieChartIcon} title="Sentiment Distribution" description="Sentiment analysis of submitted letters.">
                {monthlySubs.length === 0 ? <EmptyNote>No letters in this period.</EmptyNote> : (
                  <div className="flex flex-col items-center gap-4 sm:flex-row">
                    <div className="relative w-full sm:w-3/5" style={{ height: 220, minWidth: 0 }}>
                      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <PieChart>
                          <Pie data={sentimentDist} cx="50%" cy="50%" innerRadius={52} outerRadius={84} dataKey="pct" label={({ value }) => `${value}%`} labelLine={false}>
                            {sentimentDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span style={{ ...serif, fontSize: '1.4rem', fontWeight: 700, color: INK, lineHeight: 1 }}>{monthlySubs.length}</span>
                        <span style={{ ...sans, fontSize: '0.7rem', color: '#a89890' }}>Letters</span>
                      </div>
                    </div>
                    <div className="w-full flex-1">
                      {sentimentDist.map((item, i) => (
                        <div key={item.name} className="flex items-center gap-2.5 py-2.5" style={{ borderTop: i > 0 ? `1px solid ${RULE}` : 'none' }}>
                          <span className="flex-shrink-0 rounded-full" style={{ width: 11, height: 11, background: item.color }} />
                          <span className="flex-1" style={{ ...sans, fontSize: '0.8rem', color: INK }}>{item.name}</span>
                          <span style={{ ...mono, fontSize: '0.76rem', color: '#6b6058', minWidth: 28, textAlign: 'right' }}>{item.value}</span>
                          <span style={{ ...mono, fontSize: '0.76rem', fontWeight: 700, color: item.color, minWidth: 42, textAlign: 'right' }}>{item.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </ChartCard>
            </div>

            {/* ── Row 2: completeness + issues ── */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard icon={FileText} title="Letter Completeness by Metric" description="Share of letters that meet each completeness check.">
                <div className="space-y-4">
                  {completenessData.map((item) => {
                    const color = item.pct >= 85 ? SAGE : item.pct >= 70 ? AMBER : CLAY;
                    return (
                      <div key={item.category}>
                        <div className="flex justify-between gap-3" style={{ ...sans, fontSize: '0.78rem', color: '#4b3f38', marginBottom: 6 }}>
                          <span>{item.category}</span>
                          <span style={{ fontWeight: 700 }}>{item.pct}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: RULE }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, item.pct))}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ChartCard>

              <ChartCard icon={AlertTriangle} title="Top Compliance Issues" description="Most common missing or incomplete components.">
                <div>
                  {topIssues.map((item, i) => (
                    <div key={item.issue} className="flex items-center gap-3 py-2.5" style={{ borderTop: i > 0 ? `1px solid ${RULE}` : 'none' }}>
                      <span className="flex flex-shrink-0 items-center justify-center rounded-full" style={{ width: 22, height: 22, background: MAROON, color: '#fff', ...sans, fontSize: '0.64rem', fontWeight: 800 }}>{i + 1}</span>
                      <span className="min-w-0 flex-1" style={{ ...sans, fontSize: '0.82rem', color: '#4b3f38' }}>{item.issue}</span>
                      <div className="hidden w-24 flex-shrink-0 overflow-hidden rounded-full sm:block" style={{ height: 6, background: RULE }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, item.pct))}%`, background: i === 0 ? MAROON : i < 3 ? GOLD : GOLD_LIGHT }} />
                      </div>
                      <div className="flex-shrink-0 text-right" style={{ minWidth: 74 }}>
                        <span style={{ ...serif, fontSize: '0.95rem', fontWeight: 700, color: MAROON }}>{item.count}</span>
                        <span style={{ ...mono, fontSize: '0.7rem', color: '#a89890', marginLeft: 4 }}>({item.pct}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ChartCard>
            </div>

            {/* ── Row 3: full-width year-level chart ── */}
            <ChartCard icon={BarChart3} title="Compliance Rate by Year Level" description="Average completion rate per year level.">
              {yearLevelCompliance.length === 0 ? <EmptyNote>No year-level data available.</EmptyNote> : (
                <div className="oa-scroll overflow-x-auto">
                  <div style={{ minWidth: yearChartMinWidth, height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <AreaChart data={yearLevelCompliance} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={RULE} />
                        <XAxis dataKey="level" stroke="#a89890" style={chartStyle} interval={0} tickMargin={6} tickFormatter={(v) => formatYearLevelLabel(v)} />
                        <YAxis domain={[0, 100]} stroke="#a89890" style={chartStyle} />
                        <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => formatYearLevelLabel(v)} />
                        <Area type="monotone" dataKey="compliance" stroke={MAROON} fill={PAPER} strokeWidth={2} name="Compliance %" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </ChartCard>
          </>
        )}
      </div>
    </div>
  );
};

export default OfficerAnalytics;