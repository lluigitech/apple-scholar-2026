import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from "recharts";
import { Download } from "lucide-react";

const API_BASE = (import.meta.env?.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");
const API = API_BASE.endsWith("/api") ? API_BASE : `${API_BASE}/api`;

const yearLevelOrder = [
  "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12",
  "1st Year College", "2nd Year College", "3rd Year College", "4th Year College", "5th Year College"
];

const normalizeYearLevel = (value) => {
  if (!value) return "Unknown";
  const normalized = String(value).trim().toLowerCase();
  if (["grade 7", "grade_7", "g7"].includes(normalized)) return "Grade 7";
  if (["grade 8", "grade_8", "g8"].includes(normalized)) return "Grade 8";
  if (["grade 9", "grade_9", "g9"].includes(normalized)) return "Grade 9";
  if (["grade 10", "grade_10", "g10"].includes(normalized)) return "Grade 10";
  if (["grade 11", "grade_11", "g11"].includes(normalized)) return "Grade 11";
  if (["grade 12", "grade_12", "g12"].includes(normalized)) return "Grade 12";
  if (["1st year college", "1st year", "college_1", "college 1", "1y"].includes(normalized)) return "1st Year College";
  if (["2nd year college", "2nd year", "college_2", "college 2", "2y"].includes(normalized)) return "2nd Year College";
  if (["3rd year college", "3rd year", "college_3", "college 3", "3y"].includes(normalized)) return "3rd Year College";
  if (["4th year college", "4th year", "college_4", "college 4", "4y"].includes(normalized)) return "4th Year College";
  if (["5th year college", "5th year", "college_5", "college 5", "5y"].includes(normalized)) return "5th Year College";
  return String(value).trim();
};

const getSentimentBucket = (value) => {
  const label = String(value || "Neutral").toLowerCase();
  if (label.includes("negative")) return "negative";
  if (label.includes("positive")) return "positive";
  return "neutral";
};

const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });

const initialAnalytics = {
  totalScholars: 0,
  avgCompliance: 0,
  atRiskScholars: 0,
  yearLevelData: [],
  overallCompliance: [
    { id: "compliant", name: "Compliant", value: 0, color: "#22c55e" },
    { id: "pending", name: "Pending", value: 0, color: "#f59e0b" },
    { id: "noncompliant", name: "Non-compliant", value: 0, color: "#dc2626" },
  ],
  submissionTrends: [],
  submissions: [],
  sentimentTrend: [],
  sentimentByYearLevel: [],
  averageGradeData: [],
  summary: [],
};

const AdminAnalytics = () => {
  const navigate = useNavigate();
  const [selectedYearLevel, setSelectedYearLevel] = useState("all");
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError("");

        const [summaryRes, submissionsRes, usersRes, gradesRes] = await Promise.all([
          axios.get(`${API}/officer/reports/compliance-summary`, getAuthHeaders()),
          axios.get(`${API}/submission/all`, getAuthHeaders()),
          axios.get(`${API}/admin/users`, getAuthHeaders()),
          axios.get(`${API}/submission/grades/all`, getAuthHeaders()),
        ]);

        const summary = Array.isArray(summaryRes?.data) ? summaryRes.data : [];
        const submissions = Array.isArray(submissionsRes?.data) ? submissionsRes.data : [];
        const users = Array.isArray(usersRes?.data) ? usersRes.data : [];
        const grades = Array.isArray(gradesRes?.data) ? gradesRes.data : [];

        const scholarYearMap = users.reduce((acc, user) => {
          if (user?.role === "scholar" && user?.scholar_id) {
            acc[user.scholar_id] = normalizeYearLevel(user.year_level);
          }
          return acc;
        }, {});

        const gradeBuckets = {};
        grades.forEach((gradeRecord) => {
          const gwa = Number(gradeRecord.gwa);
          if (!Number.isFinite(gwa)) return;
          const level = normalizeYearLevel(scholarYearMap[gradeRecord.scholar_id] || 'Unknown');
          if (!gradeBuckets[level]) gradeBuckets[level] = { level, total: 0, sum: 0 };
          gradeBuckets[level].total += 1;
          gradeBuckets[level].sum += gwa;
        });
        const averageGradeData = Object.values(gradeBuckets).map((bucket) => ({
          level: bucket.level,
          average: Number((bucket.sum / bucket.total).toFixed(2)),
          records: bucket.total,
        }));

        const yearBuckets = {};
        summary.forEach((item) => {
          const level = normalizeYearLevel(item.year_level || "Unknown");
          if (!yearBuckets[level]) {
            yearBuckets[level] = { level, total: 0, compliant: 0, pending: 0, nonCompliant: 0 };
          }
          yearBuckets[level].total += 1;
          const rate = Number(item.completionRate || 0);
          if (rate >= 75) yearBuckets[level].compliant += 1;
          else if (rate >= 50) yearBuckets[level].pending += 1;
          else yearBuckets[level].nonCompliant += 1;
        });

        const yearLevelData = yearLevelOrder
          .filter((level) => yearBuckets[level])
          .map((level) => ({
            level,
            total: yearBuckets[level].total,
            compliant: yearBuckets[level].compliant,
            pending: yearBuckets[level].pending,
            nonCompliant: yearBuckets[level].nonCompliant,
          }))
          .concat(
            Object.keys(yearBuckets)
              .filter((level) => !yearLevelOrder.includes(level))
              .map((level) => ({
                level,
                total: yearBuckets[level].total,
                compliant: yearBuckets[level].compliant,
                pending: yearBuckets[level].pending,
                nonCompliant: yearBuckets[level].nonCompliant,
              }))
          );

        const totalScholars = summary.length;
        const avgCompliance = totalScholars > 0
          ? Math.round(summary.reduce((sum, item) => sum + Number(item.completionRate || 0), 0) / totalScholars)
          : 0;
        const atRiskScholars = summary.filter((item) => {
          const riskScore = Number(item.riskScore || 0);
          return riskScore >= 40 || item.riskStatus === "at-risk";
        }).length;

        const compliantCount = summary.filter((item) => Number(item.completionRate || 0) >= 75).length;
        const pendingCount = summary.filter((item) => {
          const rate = Number(item.completionRate || 0);
          return rate >= 50 && rate < 75;
        }).length;
        const nonCompliantCount = Math.max(0, totalScholars - compliantCount - pendingCount);

        const overallCompliance = [
          { id: "compliant", name: "Compliant", value: totalScholars ? Math.round((compliantCount / totalScholars) * 100) : 0, color: "#22c55e" },
          { id: "pending", name: "Pending", value: totalScholars ? Math.round((pendingCount / totalScholars) * 100) : 0, color: "#f59e0b" },
          { id: "noncompliant", name: "Non-compliant", value: totalScholars ? Math.round((nonCompliantCount / totalScholars) * 100) : 0, color: "#dc2626" },
        ];

        const monthlyGroups = {};
        submissions.forEach((sub) => {
          const submittedAt = sub.submitted_at || sub.created_at || sub.date;
          const date = new Date(submittedAt);
          if (Number.isNaN(date.getTime())) return;
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          if (!monthlyGroups[key]) {
            monthlyGroups[key] = { month: key, approved: 0, pending: 0, rejected: 0 };
          }

          const status = String(sub.status || "pending").toLowerCase();
          if (status === "approved") monthlyGroups[key].approved += 1;
          else if (status === "rejected") monthlyGroups[key].rejected += 1;
          else monthlyGroups[key].pending += 1;
        });

        const submissionTrends = Object.values(monthlyGroups)
          .sort((a, b) => a.month.localeCompare(b.month))
          .map((item) => {
            const [year, month] = item.month.split("-");
            const label = new Date(`${year}-${month}-01`).toLocaleString("en-US", { month: "short" });
            return {
              month: label,
              approved: item.approved,
              pending: item.pending,
              rejected: item.rejected,
            };
          });

        const sentimentByMonth = {};
        submissions.forEach((sub) => {
          const submittedAt = sub.submitted_at || sub.created_at || sub.date;
          const date = new Date(submittedAt);
          if (Number.isNaN(date.getTime())) return;
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          if (!sentimentByMonth[key]) {
            sentimentByMonth[key] = { month: key, positive: 0, neutral: 0, negative: 0 };
          }
          const bucket = getSentimentBucket(sub.sentiment_label);
          sentimentByMonth[key][bucket] += 1;
        });

        const sentimentTrend = Object.values(sentimentByMonth)
          .sort((a, b) => a.month.localeCompare(b.month))
          .slice(-6)
          .map((item) => {
            const [year, month] = item.month.split("-");
            const total = item.positive + item.neutral + item.negative || 1;
            return {
              month: new Date(`${year}-${month}-01`).toLocaleString("en-US", { month: "short" }),
              positive: Math.round((item.positive / total) * 100),
              neutral: Math.round((item.neutral / total) * 100),
              negative: Math.round((item.negative / total) * 100),
            };
          });

        const sentimentByYearLevelBuckets = {};
        submissions.forEach((sub) => {
          const level = normalizeYearLevel(scholarYearMap[sub.scholar_id] || sub.year_level || "Unknown");
          if (!sentimentByYearLevelBuckets[level]) {
            sentimentByYearLevelBuckets[level] = { level, positive: 0, neutral: 0, negative: 0, total: 0 };
          }
          const bucket = getSentimentBucket(sub.sentiment_label);
          sentimentByYearLevelBuckets[level][bucket] += 1;
          sentimentByYearLevelBuckets[level].total += 1;
        });

        const sentimentByYearLevel = Object.values(sentimentByYearLevelBuckets)
          .sort((a, b) => yearLevelOrder.indexOf(a.level) - yearLevelOrder.indexOf(b.level))
          .map((item) => ({
            level: item.level,
            positive: item.total ? Math.round((item.positive / item.total) * 100) : 0,
            negative: item.total ? Math.round((item.negative / item.total) * 100) : 0,
          }));

        setAnalytics({
          totalScholars,
          avgCompliance,
          atRiskScholars,
          yearLevelData,
          overallCompliance,
          submissionTrends,
          submissions,
          sentimentTrend,
          sentimentByYearLevel,
          averageGradeData,
          summary,
        });
      } catch (err) {
        console.error("Error loading analytics", err);
        setError("Unable to load live analytics. Please refresh or try again.");
        setAnalytics(initialAnalytics);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  const filteredSummary = useMemo(() => {
    if (selectedYearLevel === "all") return analytics.summary;
    return analytics.summary.filter((item) => normalizeYearLevel(item.year_level || "Unknown") === selectedYearLevel);
  }, [analytics.summary, selectedYearLevel]);

  const filteredData = useMemo(() => {
    if (selectedYearLevel === "all") return analytics.yearLevelData;
    return analytics.yearLevelData.filter((item) => item.level === selectedYearLevel);
  }, [analytics.yearLevelData, selectedYearLevel]);

  const selectedSummaryTotals = useMemo(() => {
    const total = filteredSummary.length;
    const avg = total > 0
      ? Math.round(filteredSummary.reduce((sum, item) => sum + Number(item.completionRate || 0), 0) / total)
      : 0;
    const atRisk = filteredSummary.filter((item) => Number(item.riskScore || 0) >= 40 || item.riskStatus === "at-risk").length;

    const compliantCount = filteredSummary.filter((item) => Number(item.completionRate || 0) >= 75).length;
    const pendingCount = filteredSummary.filter((item) => {
      const rate = Number(item.completionRate || 0);
      return rate >= 50 && rate < 75;
    }).length;
    const nonCompliantCount = Math.max(0, total - compliantCount - pendingCount);

    return {
      total,
      avg,
      atRisk,
      overallCompliance: [
        { id: "compliant", name: "Compliant", value: total ? Math.round((compliantCount / total) * 100) : 0, color: "#22c55e" },
        { id: "pending", name: "Pending", value: total ? Math.round((pendingCount / total) * 100) : 0, color: "#f59e0b" },
        { id: "noncompliant", name: "Non-compliant", value: total ? Math.round((nonCompliantCount / total) * 100) : 0, color: "#dc2626" },
      ],
    };
  }, [filteredSummary]);

  const selectedSubmissionTrends = useMemo(() => {
    if (!analytics.submissions?.length) return [];

    const scholarYearMap = Object.fromEntries(
      (analytics.summary || []).map((item) => [
        item.studentId || item.scholar_id || item.scholarId,
        normalizeYearLevel(item.year_level || "Unknown"),
      ])
    );

    const monthlyGroups = {};
    analytics.submissions.forEach((sub) => {
      const submittedAt = sub.submitted_at || sub.created_at || sub.date;
      const date = new Date(submittedAt);
      if (Number.isNaN(date.getTime())) return;
      const level = normalizeYearLevel(scholarYearMap[sub.scholar_id] || sub.year_level || "Unknown");
      if (selectedYearLevel !== "all" && level !== selectedYearLevel) return;

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyGroups[key]) {
        monthlyGroups[key] = { month: key, approved: 0, pending: 0, rejected: 0 };
      }

      const status = String(sub.status || "pending").toLowerCase();
      if (status === "approved") monthlyGroups[key].approved += 1;
      else if (status === "rejected") monthlyGroups[key].rejected += 1;
      else monthlyGroups[key].pending += 1;
    });

    return Object.values(monthlyGroups)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((item) => {
        const [year, month] = item.month.split("-");
        const label = new Date(`${year}-${month}-01`).toLocaleString("en-US", { month: "short" });
        return { month: label, approved: item.approved, pending: item.pending, rejected: item.rejected };
      });
  }, [analytics.submissions, analytics.summary, selectedYearLevel]);

  const yearLevelOptions = useMemo(() => [
    { value: "all", label: "All Year Levels" },
    ...analytics.yearLevelData.map((item) => ({ value: item.level, label: item.level }))
  ], [analytics.yearLevelData]);

  const earlyWarnings = useMemo(() => {
    const warnings = [];
    const atRisk = filteredSummary.filter(item => Number(item.riskScore || 0) >= 40 || item.riskStatus === 'at-risk').length;
    const pending = filteredSummary.filter(item => Number(item.completionRate || 0) < 75).length;
    const negative = analytics.sentimentTrend.reduce((sum, item) => sum + Number(item.negative || 0), 0);
    const rejected = analytics.submissions.filter(item => String(item.status || '').toLowerCase() === 'rejected').length;
    if (atRisk) warnings.push({ label: 'Prioritize at-risk scholars', detail: `${atRisk} scholar${atRisk === 1 ? '' : 's'} need compliance follow-up.`, action: 'Open flagged scholars', path: '/admin/flagged' });
    if (pending) warnings.push({ label: 'Follow up on incomplete compliance', detail: `${pending} scholar${pending === 1 ? '' : 's'} are below the 75% completion threshold.`, action: 'Review compliance', path: '/admin/compliance' });
    if (negative) warnings.push({ label: 'Review negative correspondence', detail: `${negative} negative sentiment record${negative === 1 ? '' : 's'} appear in the loaded trend.`, action: 'Open correspondence', path: '/admin/correspondence' });
    if (rejected) warnings.push({ label: 'Resolve rejected submissions', detail: `${rejected} submission${rejected === 1 ? '' : 's'} require scholar revision.`, action: 'Review submissions', path: '/admin/reports' });
    return warnings.length ? warnings : [{ label: 'No urgent warnings detected', detail: 'Continue monitoring new submissions and compliance changes.', action: 'View reports', path: '/admin/reports' }];
  }, [analytics.sentimentTrend, analytics.submissions, filteredSummary]);

  const exportCsv = () => {
    const rows = [["Month", "Positive%", "Neutral%", "Negative%"]];
    analytics.sentimentTrend.forEach((d) => rows.push([d.month, String(d.positive), String(d.neutral), String(d.negative)]));
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "analytics_export.csv";
    a.click();
    URL.revokeObjectURL(url);

    axios.post(`${API}/export/google-sheets`, { log_only: true, module: 'Analytics', report_resource: 'Admin Analytics', spreadsheet_title: 'Admin Analytics Export', details: 'analytics_export.csv' }, getAuthHeaders()).catch(() => {});
  };

  return (
    <div className="p-6 sm:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-8">
        <div>
          <h1 className="mb-2" style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '2rem',
            fontWeight: 700,
            color: '#802B36'
          }}>
            Scholar Analysis by Year Level
          </h1>
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.95rem',
            color: '#6b7280'
          }}>
            Live analytics based on current scholar submissions and compliance data
          </p>
        </div>

        <select
          value={selectedYearLevel}
          onChange={(e) => setSelectedYearLevel(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 transition-all"
          style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem' }}
        >
          {yearLevelOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm mb-2" style={{ fontFamily: "'DM Sans', sans-serif", color: '#6b7280' }}>
            Total Scholars
          </h3>
          <p className="mb-1" style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.5rem', fontWeight: 700, color: '#802B36' }}>
            {loading ? "—" : selectedSummaryTotals.total}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm mb-2" style={{ fontFamily: "'DM Sans', sans-serif", color: '#6b7280' }}>
            Average Compliance
          </h3>
          <p className="mb-1" style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.5rem', fontWeight: 700, color: '#22c55e' }}>
            {loading ? "—" : `${selectedSummaryTotals.avg}%`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/admin/flagged')}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-left transition hover:shadow-md hover:-translate-y-0.5"
        >
          <h3 className="text-sm mb-2" style={{ fontFamily: "'DM Sans', sans-serif", color: '#6b7280' }}>
            High Risk
          </h3>
          <p className="mb-1" style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.5rem', fontWeight: 700, color: '#dc2626' }}>
            {loading ? "—" : selectedSummaryTotals.atRisk}
          </p>
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="mb-4" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.25rem', fontWeight: 700, color: '#802B36' }}>
            Compliance by Year Level
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={filteredData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="level"
                stroke="#6b7280"
                angle={-45}
                textAnchor="end"
                height={100}
                style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem' }}
              />
              <YAxis stroke="#6b7280" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem' }} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontFamily: "'DM Sans', sans-serif" }} />
              <Legend wrapperStyle={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem' }} />
              <Bar dataKey="compliant" stackId="a" fill="#22c55e" name="Compliant" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pending" stackId="a" fill="#f59e0b" name="Pending" />
              <Bar dataKey="nonCompliant" stackId="a" fill="#dc2626" name="Non-compliant" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="mb-4" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.25rem', fontWeight: 700, color: '#802B36' }}>
            Overall Compliance Distribution
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={selectedSummaryTotals.overallCompliance}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {analytics.overallCompliance.map((entry) => (
                  <Cell key={`pie-cell-${entry.id}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontFamily: "'DM Sans', sans-serif" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="mb-4" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.25rem', fontWeight: 700, color: '#802B36' }}>
          Monthly Submission Trends
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={selectedSubmissionTrends}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" stroke="#6b7280" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem' }} />
            <YAxis stroke="#6b7280" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem' }} />
            <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontFamily: "'DM Sans', sans-serif" }} />
            <Legend wrapperStyle={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem' }} />
            <Line type="monotone" dataKey="approved" stroke="#22c55e" strokeWidth={3} dot={{ fill: '#22c55e', r: 4 }} name="Approved" />
            <Line type="monotone" dataKey="pending" stroke="#f59e0b" strokeWidth={3} dot={{ fill: '#f59e0b', r: 4 }} name="Pending" />
            <Line type="monotone" dataKey="rejected" stroke="#dc2626" strokeWidth={3} dot={{ fill: '#dc2626', r: 4 }} name="Rejected" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="mb-1" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.15rem', fontWeight: 700, color: '#802B36' }}>
            Average Recorded Grade / GWA by Batch
          </h3>
          <p className="mb-4 text-xs text-gray-500">Based on available verified grade records.</p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={analytics.averageGradeData.filter(item => selectedYearLevel === 'all' || item.level === selectedYearLevel)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="level" stroke="#6b7280" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.72rem' }} />
              <YAxis stroke="#6b7280" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem' }} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontFamily: "'DM Sans', sans-serif" }} />
              <Bar dataKey="average" fill="#b98b4e" name="Average GWA / grade" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="mb-1" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.15rem', fontWeight: 700, color: '#802B36' }}>
            Actionable Early Warnings
          </h3>
          <p className="mb-4 text-xs text-gray-500">Recommended follow-up based on current records.</p>
          <div className="space-y-3">
            {earlyWarnings.map((warning) => (
              <div key={warning.label} className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div><p className="text-sm font-semibold text-gray-800">{warning.label}</p><p className="mt-1 text-xs text-gray-500">{warning.detail}</p></div>
                <button type="button" onClick={() => navigate(warning.path)} className="shrink-0 text-xs font-semibold text-[#802B36] underline">{warning.action}</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-2">
        <h2 className="mb-1" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', fontWeight: 700, color: '#802B36' }}>
          NLP Sentiment Analysis
        </h2>
        <p className="mb-5" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem', color: '#6b7280' }}>
          Automated sentiment analysis of scholar letters and correspondence
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="mb-4" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', fontWeight: 700, color: '#802B36' }}>
            Sentiment Trend (6 Months)
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={analytics.sentimentTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#6b7280" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem' }} />
              <YAxis stroke="#6b7280" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem' }} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontFamily: "'DM Sans', sans-serif" }} />
              <Legend wrapperStyle={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem' }} />
              <Area type="monotone" dataKey="positive" stackId="1" stroke="#22c55e" fill="#dcfce7" name="Positive %" />
              <Area type="monotone" dataKey="neutral" stackId="1" stroke="#f59e0b" fill="#fef9c3" name="Neutral %" />
              <Area type="monotone" dataKey="negative" stackId="1" stroke="#ef4444" fill="#fee2e2" name="Negative %" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="mb-4" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', fontWeight: 700, color: '#802B36' }}>
            Sentiment by Year Level
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={analytics.sentimentByYearLevel}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="level" stroke="#6b7280" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.72rem' }} />
              <YAxis stroke="#6b7280" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem' }} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontFamily: "'DM Sans', sans-serif" }} />
              <Legend wrapperStyle={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem' }} />
              <Bar dataKey="positive" fill="#22c55e" name="Positive %" radius={[4, 4, 0, 0]} />
              <Bar dataKey="negative" fill="#ef4444" name="Negative %" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={exportCsv}
          className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151' }}
        >
          <Download className="w-4 h-4" /> Export to CSV
        </button>
      </div>
    </div>
  );
};

export default AdminAnalytics;