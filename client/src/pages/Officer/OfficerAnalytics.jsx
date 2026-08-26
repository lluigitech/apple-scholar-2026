import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';
import { Download, TrendingUp, Users, FileText, AlertTriangle, BarChart3 } from 'lucide-react';
import { API_BASE, authHeaders } from '../../components/Officer/Reports/ReportsHelpers';

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

const getPeriodRange = (period) => {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - (period === '1m' ? 0 : period === '3m' ? 2 : 5), 1);
  return {
    date_from: start.toISOString().slice(0, 10),
    date_to: end.toISOString().slice(0, 10),
  };
};

function StatCard({ label, value, sub, color, icon: Icon }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#fff', border: `1px solid ${RULE}`, boxShadow: '0 8px 24px -16px rgba(36,21,18,0.2)' }}>
      <div className="flex items-center justify-between mb-2">
        <p style={{ ...sans, fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a89890' }}>{label}</p>
        <Icon size={14} style={{ color }} />
      </div>
      <p style={{ ...serif, fontSize: '1.7rem', fontWeight: 700, color: INK, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ ...sans, fontSize: '0.68rem', color, marginTop: 5 }}>{sub}</p>}
    </div>
  );
}

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: IVORY }}>
        <p style={{ ...sans, fontSize: '0.85rem', color: '#a89890' }}>Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: IVORY }}>
        <p style={{ ...sans, fontSize: '0.85rem', color: CLAY }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: IVORY, ...sans }}>

      {/* ── Ledger header band — same family as the rest of the portal ── */}
      <div className="relative overflow-hidden px-5 sm:px-8 pt-8 pb-11" style={{ background: `linear-gradient(135deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)` }}>
        <svg className="absolute -right-6 -top-10 w-56 h-56 opacity-[0.12] pointer-events-none" viewBox="0 0 200 200" fill="none">
          <polyline points="30,150 75,110 115,130 170,60" stroke={GOLD} strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="170" cy="60" r="7" fill={GOLD} />
        </svg>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ border: `1.5px solid ${GOLD}` }}>
            <BarChart3 size={12} style={{ color: GOLD }} />
          </div>
          <span style={{ ...sans, fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.28em', textTransform: 'uppercase', color: GOLD_LIGHT }}>Officer Portal</span>
        </div>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 style={{ ...serif, fontSize: '2rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>Analytics Dashboard</h1>
            <p style={{ ...sans, fontSize: '0.82rem', color: '#e9c9a8', marginTop: 4 }}>Scholar compliance, sentiment trends, and submission metrics.</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <div className="flex rounded-full overflow-hidden" style={{ border: `1.5px solid ${GOLD}55` }}>
              {['1m', '3m', '6m'].map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className="px-3.5 py-1.5 transition-colors"
                  style={{ ...sans, fontSize: '0.72rem', fontWeight: 700, background: period === p ? GOLD : 'transparent', color: period === p ? MAROON_DEEP : GOLD_LIGHT, border: 'none', cursor: 'pointer' }}>
                  {p}
                </button>
              ))}
            </div>
            <select
              value={selectedYearLevel}
              onChange={(e) => setSelectedYearLevel(e.target.value)}
              className="px-3.5 py-1.5 rounded-full outline-none"
              style={{ ...sans, fontSize: '0.76rem', fontWeight: 700, background: 'rgba(255,255,255,0.08)', border: `1.5px solid ${GOLD}55`, color: GOLD_LIGHT, cursor: 'pointer' }}
            >
              {yearLevelOptions.map(level => (
                <option key={level} value={level} style={{ color: INK }}>{level === 'all' ? 'All Year Levels' : level}</option>
              ))}
            </select>
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 rounded-full transition-colors hover:opacity-90"
              style={{ ...sans, fontSize: '0.76rem', fontWeight: 700, background: GOLD, color: MAROON_DEEP, border: 'none', padding: '7px 16px', cursor: 'pointer' }}>
              <Download size={13} /> Export
            </button>
          </div>
        </div>
      </div>

      <div className="relative z-10 px-5 sm:px-8 -mt-6 pb-10">

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
          <StatCard label="Total Scholars" value={totalScholars} sub="Active scholars" color={MAROON} icon={Users} />
          <StatCard label="Avg Compliance" value={`${avgCompliance}%`} sub="Average completion rate" color={SAGE} icon={TrendingUp} />
          <StatCard label="Letters Reviewed" value={lettersReviewed} sub="Total letters" color={GOLD} icon={FileText} />
          <StatCard label="At-Risk Scholars" value={atRiskScholars} sub="Completion below 50%" color={CLAY} icon={AlertTriangle} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <div className="rounded-xl p-5" style={{ background: '#fff', border: `1px solid ${RULE}` }}>
            <h3 style={{ ...serif, fontSize: '1rem', fontWeight: 700, color: MAROON, marginBottom: 14 }}>Compliance &amp; Sentiment Trend</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={displayTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke={RULE} />
                <XAxis dataKey="month" stroke="#a89890" style={chartStyle} />
                <YAxis stroke="#a89890" style={chartStyle} />
                <Tooltip contentStyle={{ ...sans, fontSize: '0.8rem', borderRadius: 8, border: `1px solid ${RULE}` }} />
                <Legend wrapperStyle={{ ...sans, fontSize: '0.75rem' }} />
                <Line type="monotone" dataKey="compliance" stroke={MAROON} strokeWidth={2} name="Compliance %" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="sentimentPos" stroke={SAGE} strokeWidth={2} name="Positive %" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="sentimentNeg" stroke={CLAY} strokeWidth={2} name="Negative %" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl p-5" style={{ background: '#fff', border: `1px solid ${RULE}` }}>
            <h3 style={{ ...serif, fontSize: '1rem', fontWeight: 700, color: MAROON, marginBottom: 14 }}>Letter Sentiment Distribution</h3>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="60%" height={200}>
                <PieChart>
                  <Pie data={sentimentDist} cx="50%" cy="50%" outerRadius={80} dataKey="pct" label={({ value }) => `${value}%`} labelLine={false}>
                    {sentimentDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ ...sans, fontSize: '0.8rem', borderRadius: 8, border: `1px solid ${RULE}` }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-3">
                {sentimentDist.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <div>
                      <p style={{ ...sans, fontSize: '0.72rem', fontWeight: 700, color: INK }}>{item.name}</p>
                      <p style={{ ...serif, fontSize: '1.15rem', fontWeight: 700, color: item.color }}>{item.pct}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <div className="rounded-xl p-5" style={{ background: '#fff', border: `1px solid ${RULE}` }}>
            <h3 style={{ ...serif, fontSize: '1rem', fontWeight: 700, color: MAROON, marginBottom: 14 }}>Letter Completeness by Metric</h3>
            <div className="space-y-3.5">
              {completenessData.map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between mb-1.5" style={{ ...sans, fontSize: '0.74rem', color: '#6b6058' }}>
                    <span>{item.category}</span>
                    <span style={{ fontWeight: 700 }}>{item.pct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: RULE }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${item.pct}%`, backgroundColor: item.pct >= 85 ? SAGE : item.pct >= 70 ? AMBER : CLAY }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl p-5" style={{ background: '#fff', border: `1px solid ${RULE}` }}>
            <h3 style={{ ...serif, fontSize: '1rem', fontWeight: 700, color: MAROON, marginBottom: 10 }}>Top Compliance Issues</h3>
            <div>
              {topIssues.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2.5" style={{ borderTop: i > 0 ? `1px solid ${RULE}` : 'none' }}>
                  <div className="flex items-center gap-2.5">
                    <span className="flex-shrink-0 flex items-center justify-center rounded-full" style={{ width: 20, height: 20, background: MAROON, color: '#fff', ...sans, fontSize: '0.62rem', fontWeight: 800 }}>{i + 1}</span>
                    <span style={{ ...sans, fontSize: '0.8rem', color: '#4b3f38' }}>{item.issue}</span>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <span style={{ ...serif, fontSize: '0.92rem', fontWeight: 700, color: MAROON }}>{item.count}</span>
                    <span style={{ ...mono, fontSize: '0.68rem', color: '#a89890', marginLeft: 4 }}>({item.pct}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl p-5" style={{ background: '#fff', border: `1px solid ${RULE}` }}>
          <h3 style={{ ...serif, fontSize: '1rem', fontWeight: 700, color: MAROON, marginBottom: 14 }}>Compliance Rate by Year Level</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={yearLevelCompliance}>
              <CartesianGrid strokeDasharray="3 3" stroke={RULE} />
              <XAxis dataKey="level" stroke="#a89890" style={chartStyle} />
              <YAxis domain={[0, 100]} stroke="#a89890" style={chartStyle} />
              <Tooltip contentStyle={{ ...sans, fontSize: '0.8rem', borderRadius: 8, border: `1px solid ${RULE}` }} />
              <Area type="monotone" dataKey="compliance" stroke={MAROON} fill={PAPER} strokeWidth={2} name="Compliance %" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default OfficerAnalytics;