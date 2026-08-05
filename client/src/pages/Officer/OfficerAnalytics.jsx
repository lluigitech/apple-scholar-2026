import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';
import { Download, TrendingUp, Users, FileText, AlertTriangle } from 'lucide-react';
import { API_BASE, authHeaders } from '../../components/Officer/Reports/ReportsHelpers';

function StatCard({ label, value, sub, color, icon: Icon }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + '15' }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-xs mb-0.5" style={{ fontFamily: "'DM Sans', sans-serif", color: '#6b7280' }}>{label}</p>
        <p className="text-xl font-bold" style={{ fontFamily: "'DM Sans', sans-serif", color: '#1a1a1a' }}>{value}</p>
        {sub && <p className="text-xs" style={{ fontFamily: "'DM Sans', sans-serif", color }}>{sub}</p>}
      </div>
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
        const [summaryRes, monthlyRes] = await Promise.all([
          axios.get(`${API_BASE}/officer/reports/compliance-summary`, authHeaders()),
          axios.get(`${API_BASE}/officer/reports/monthly-submissions`, authHeaders()),
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
  }, []);

  const yearLevelOptions = useMemo(() => {
    const levels = Array.from(new Set(complianceSummary
      .map(item => item.year_level || 'Unknown')
      .filter(Boolean)));
    return ['all', ...levels];
  }, [complianceSummary]);

  const totalScholars = complianceSummary.length;
  const avgCompliance = totalScholars > 0
    ? Math.round(complianceSummary.reduce((sum, item) => sum + (item.completionRate || 0), 0) / totalScholars)
    : 0;
  const lettersReviewed = monthlySubs.length;
  const atRiskScholars = complianceSummary.filter(item => item.completionRate < 50).length;

  const yearLevelCompliance = useMemo(() => {
    const grouped = monthlySubs.length ? {} : {};
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
      { name: 'Positive', value: counts.Positive, color: '#22c55e' },
      { name: 'Neutral', value: counts.Neutral, color: '#f59e0b' },
      { name: 'Negative', value: counts.Negative, color: '#ef4444' },
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
      const [year, month] = item.month.split('-');
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

  const chartStyle = { fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem' };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <p className="text-sm text-gray-500">Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="mb-1" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.75rem', fontWeight: 700, color: '#1a1a1a' }}>
            Analytics Dashboard
          </h1>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem', color: '#6b7280' }}>
            Scholar compliance, sentiment trends, and submission metrics
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {['1m', '3m', '6m'].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className="text-xs px-3 py-1.5 transition-all"
                style={{ fontFamily: "'DM Sans', sans-serif", backgroundColor: period === p ? '#802B36' : '#fff', color: period === p ? '#fff' : '#374151', border: 'none', cursor: 'pointer' }}>
                {p}
              </button>
            ))}
          </div>
          <select
            value={selectedYearLevel}
            onChange={(e) => setSelectedYearLevel(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg outline-none text-sm"
            style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151' }}
          >
            {yearLevelOptions.map(level => (
              <option key={level} value={level}>{level === 'all' ? 'All Year Levels' : level}</option>
            ))}
          </select>
          <button onClick={exportCSV} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50" style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151' }}>
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Scholars" value={totalScholars} sub="Active scholars" color="#802B36" icon={Users} />
        <StatCard label="Avg Compliance" value={`${avgCompliance}%`} sub="Average completion rate" color="#22c55e" icon={TrendingUp} />
        <StatCard label="Letters Reviewed" value={lettersReviewed} sub="Total letters" color="#3b82f6" icon={FileText} />
        <StatCard label="At-Risk Scholars" value={atRiskScholars} sub="Completion below 50%" color="#ef4444" icon={AlertTriangle} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="mb-4" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', fontWeight: 700, color: '#802B36' }}>
            Compliance & Sentiment Trend
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={displayTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" stroke="#9ca3af" style={chartStyle} />
              <YAxis stroke="#9ca3af" style={chartStyle} />
              <Tooltip contentStyle={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem', borderRadius: '8px' }} />
              <Legend wrapperStyle={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem' }} />
              <Line type="monotone" dataKey="compliance" stroke="#802B36" strokeWidth={2} name="Compliance %" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="sentimentPos" stroke="#22c55e" strokeWidth={2} name="Positive %" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="sentimentNeg" stroke="#ef4444" strokeWidth={2} name="Negative %" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="mb-4" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', fontWeight: 700, color: '#802B36' }}>
            Letter Sentiment Distribution
          </h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="60%" height={200}>
              <PieChart>
                <Pie data={sentimentDist} cx="50%" cy="50%" outerRadius={80} dataKey="pct" label={({ value }) => `${value}%`} labelLine={false}>
                  {sentimentDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-3">
              {sentimentDist.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <div>
                    <p className="text-xs font-medium" style={{ fontFamily: "'DM Sans', sans-serif", color: '#1a1a1a' }}>{item.name}</p>
                    <p className="text-lg font-bold" style={{ fontFamily: "'DM Sans', sans-serif", color: item.color }}>{item.pct}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="mb-4" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', fontWeight: 700, color: '#802B36' }}>
            Letter Completeness by Metric
          </h3>
          <div className="space-y-3">
            {completenessData.map((item, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1" style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151' }}>
                  <span>{item.category}</span>
                  <span className="font-semibold">{item.pct}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${item.pct}%`, backgroundColor: item.pct >= 85 ? '#22c55e' : item.pct >= 70 ? '#f59e0b' : '#ef4444' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="mb-4" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', fontWeight: 700, color: '#802B36' }}>
            Top Compliance Issues
          </h3>
          <div className="space-y-3">
            {topIssues.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: '#802B36', fontSize: '0.65rem' }}>{i + 1}</span>
                  <span className="text-sm" style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151' }}>{item.issue}</span>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <span className="text-sm font-bold" style={{ fontFamily: "'DM Sans', sans-serif", color: '#802B36' }}>{item.count}</span>
                  <span className="text-xs ml-1" style={{ fontFamily: "'DM Sans', sans-serif", color: '#9ca3af' }}>({item.pct}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="mb-4" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', fontWeight: 700, color: '#802B36' }}>
          Compliance Rate by Year Level
        </h3>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={yearLevelCompliance}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="level" stroke="#9ca3af" style={chartStyle} />
            <YAxis domain={[0, 100]} stroke="#9ca3af" style={chartStyle} />
            <Tooltip contentStyle={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem', borderRadius: '8px' }} />
            <Area type="monotone" dataKey="compliance" stroke="#802B36" fill="#F5E8EA" strokeWidth={2} name="Compliance %" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default OfficerAnalytics;
