import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, LabelList } from "recharts";
import { Download, Users, TrendingUp, AlertTriangle, GraduationCap, ArrowUpRight, ArrowDownRight, FileBarChart2, MessageSquareText } from "lucide-react";
import { formatAdminMonth } from '../../utils/adminPreferences';
import AdminPageHeader from '../../components/Admin/AdminPageHeader';

const API_BASE = (import.meta.env?.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");
const API = API_BASE.endsWith("/api") ? API_BASE : `${API_BASE}/api`;

// ── Executive design tokens ──────────────────────────────────────
const BG           = '#F7F4EE';
const SURFACE      = '#FFFDF9';
const BORDER       = '#E7D8C7';
const PRIMARY      = '#6D2140';
const PRIMARY_DEEP = '#4A1730';
const INK          = '#241512';
const MUTED        = '#8A7A68';
const BRONZE       = '#A9784E';
const SUCCESS      = '#6B8F71';
const WARNING      = '#C08A3E';
const DANGER       = '#A24A4A';
const RADIUS       = 16;
const SHADOW       = '0 1px 2px rgba(74, 23, 48, 0.04), 0 6px 18px rgba(74, 23, 48, 0.04)';

// Aliases so every downstream data/color reference in the original
// analytics logic (SAGE / AMBER / CLAY / MAROON / GOLD / IVORY / RULE / PAPER)
// keeps working untouched — only the hex values move to the new tokens.
const MAROON      = PRIMARY;
const MAROON_DEEP = PRIMARY_DEEP;
const GOLD        = BRONZE;
const IVORY       = BG;
const PAPER       = SURFACE;
const RULE        = BORDER;
const SAGE        = SUCCESS;
const CLAY        = DANGER;
const AMBER       = WARNING;

const serif = { fontFamily: "'Playfair Display', serif" };
const sans  = { fontFamily: "'Inter', sans-serif" };

const gridProps = { strokeDasharray: '3 3', stroke: BORDER, vertical: false };
const axisStyle = { fontFamily: "'Inter', sans-serif", fontSize: '0.72rem', fill: MUTED };
const tooltipStyle = { backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '10px', fontFamily: "'Inter', sans-serif", fontSize: '0.8rem' };
const legendStyle = { fontFamily: "'Inter', sans-serif", fontSize: '0.78rem', color: MUTED };

const CHART_HEIGHT = 240;
const CHART_MARGIN = { top: 8, right: 8, left: -12, bottom: 0 };

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

// Display-only: compact axis ticks so three-across charts stay readable.
// Tooltips and data keep the full year-level name.
const shortLevel = (level) => {
  const text = String(level || "");
  const grade = text.match(/^Grade (\d+)$/);
  if (grade) return `G${grade[1]}`;
  const college = text.match(/^(\d)(?:st|nd|rd|th) Year College$/);
  if (college) return `${college[1]}Y`;
  return text.length > 10 ? `${text.slice(0, 9)}…` : text;
};

// Two-line tick for the scrollable Scholars per Year Level chart (full names, no abbreviation).
const LevelTick = ({ x, y, payload }) => {
  const words = String(payload?.value || "").split(" ");
  const split = words.length > 2 ? 2 : 1;
  const lines = [words.slice(0, split).join(" "), words.slice(split).join(" ")].filter(Boolean);
  return (
    <g transform={`translate(${x},${y})`}>
      {lines.map((line, i) => (
        <text key={i} x={0} y={0} dy={14 + i * 13} textAnchor="middle" style={axisStyle}>{line}</text>
      ))}
    </g>
  );
};

const SCHOLAR_CHART_MIN_COL = 72; // px reserved per populated year level before the plot scrolls

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
    { id: "compliant", name: "Compliant", value: 0, color: SAGE },
    { id: "pending", name: "Pending", value: 0, color: AMBER },
    { id: "noncompliant", name: "Non-compliant", value: 0, color: CLAY },
  ],
  submissionTrends: [],
  submissions: [],
  sentimentTrend: [],
  sentimentByYearLevel: [],
  averageGradeData: [],
  summary: [],
};

// ── KPI card ─────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, color, onClick }) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} type={onClick ? 'button' : undefined}
      className="p-5 text-left w-full min-w-0 h-full transition-opacity hover:opacity-90"
      style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: SHADOW, cursor: onClick ? 'pointer' : 'default' }}>
      <div className="flex items-center justify-between gap-3">
        <p style={{ ...sans, fontSize: '0.8rem', fontWeight: 500, color: MUTED }}>{label}</p>
        <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${color}14`, color }}>
          <Icon size={16} />
        </span>
      </div>
      <p style={{ ...serif, fontSize: '2rem', fontWeight: 600, color: INK, lineHeight: 1.1, marginTop: 14 }}>{value}</p>
    </Tag>
  );
};

// ── Chart card — equal height within a grid row ──────────────────
const ChartCard = ({ title, subtitle, footer, action, children }) => (
  <div className="flex flex-col h-full min-w-0" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: 20, boxShadow: SHADOW }}>
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h3 style={{ ...serif, fontSize: '1.05rem', fontWeight: 600, color: INK }}>{title}</h3>
        {subtitle && <p style={{ ...sans, fontSize: '0.76rem', color: MUTED, marginTop: 3 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
    <div className="flex-1 min-w-0">{children}</div>
    {footer && (
      <p style={{ ...sans, fontSize: '0.74rem', color: MUTED, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>{footer}</p>
    )}
  </div>
);

// ── Donut legend — dot, label, share ─────────────────────────────
const DonutLegend = ({ items }) => (
  <ul className="mt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
    {items.map((it, i) => (
      <li key={it.label} className="flex items-center justify-between py-2"
        style={{ borderTop: i === 0 ? 'none' : `1px solid ${BORDER}`, ...sans, fontSize: '0.8rem' }}>
        <span className="inline-flex items-center gap-2" style={{ color: INK }}>
          <span className="rounded-full" style={{ width: 8, height: 8, background: it.color }} />{it.label}
        </span>
        <span style={{ fontWeight: 600, color: INK }}>{it.value}%</span>
      </li>
    ))}
  </ul>
);

// ── Compact insight row (no per-row borders; separators only) ────
const InsightRow = ({ first, icon: Icon, color, label, sublabel, value }) => (
  <div className="flex items-center justify-between gap-3 py-3.5" style={{ borderTop: first ? 'none' : `1px solid ${BORDER}` }}>
    <div className="flex items-center gap-3 min-w-0">
      <span className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 34, height: 34, background: `${color}14`, color }}>
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <p style={{ ...sans, fontSize: '0.78rem', color: MUTED }}>{label}</p>
        {sublabel && <p style={{ ...sans, fontSize: '0.88rem', fontWeight: 600, color: INK }}>{sublabel}</p>}
      </div>
    </div>
    <span style={{ ...serif, fontSize: '1.2rem', fontWeight: 600, color }}>{value}</span>
  </div>
);

const SectionHeading = ({ title, subtitle }) => (
  <div>
    <h2 style={{ ...serif, fontSize: '1.3rem', fontWeight: 600, color: INK }}>{title}</h2>
    {subtitle && <p style={{ ...sans, fontSize: '0.82rem', color: MUTED, marginTop: 3 }}>{subtitle}</p>}
  </div>
);

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
          axios.get(`${API}/admin/reports/compliance-summary`, getAuthHeaders()),
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
          return riskScore >= 40 || item.riskStatus === "high" || item.riskStatus === "medium";
        }).length;

        const compliantCount = summary.filter((item) => Number(item.completionRate || 0) >= 75).length;
        const pendingCount = summary.filter((item) => {
          const rate = Number(item.completionRate || 0);
          return rate >= 50 && rate < 75;
        }).length;
        const nonCompliantCount = Math.max(0, totalScholars - compliantCount - pendingCount);

        const overallCompliance = [
          { id: "compliant", name: "Compliant", value: totalScholars ? Math.round((compliantCount / totalScholars) * 100) : 0, color: SAGE },
          { id: "pending", name: "Pending", value: totalScholars ? Math.round((pendingCount / totalScholars) * 100) : 0, color: AMBER },
          { id: "noncompliant", name: "Non-compliant", value: totalScholars ? Math.round((nonCompliantCount / totalScholars) * 100) : 0, color: CLAY },
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
            const label = formatAdminMonth(new Date(`${year}-${month}-01`), { month: 'short' });
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
              month: formatAdminMonth(new Date(`${year}-${month}-01`), { month: 'short' }),
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

  // Only year levels that actually have scholars, in canonical order (unknown labels last).
  const scholarsPerLevelData = useMemo(() => {
    const rank = (level) => {
      const i = yearLevelOrder.indexOf(level);
      return i === -1 ? yearLevelOrder.length : i;
    };
    return filteredData
      .filter((item) => Number(item.total) > 0)
      .slice()
      .sort((a, b) => rank(a.level) - rank(b.level));
  }, [filteredData]);

  const selectedSummaryTotals = useMemo(() => {
    const total = filteredSummary.length;
    const avg = total > 0
      ? Math.round(filteredSummary.reduce((sum, item) => sum + Number(item.completionRate || 0), 0) / total)
      : 0;
    const atRisk = filteredSummary.filter((item) => Number(item.riskScore || 0) >= 40 || item.riskStatus === "high" || item.riskStatus === "medium").length;

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
        { id: "compliant", name: "Compliant", value: total ? Math.round((compliantCount / total) * 100) : 0, color: SAGE },
        { id: "pending", name: "Pending", value: total ? Math.round((pendingCount / total) * 100) : 0, color: AMBER },
        { id: "noncompliant", name: "Non-compliant", value: total ? Math.round((nonCompliantCount / total) * 100) : 0, color: CLAY },
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
        const label = formatAdminMonth(new Date(`${year}-${month}-01`), { month: 'short' });
        return { month: label, approved: item.approved, pending: item.pending, rejected: item.rejected };
      });
  }, [analytics.submissions, analytics.summary, selectedYearLevel]);

  const yearLevelOptions = useMemo(() => [
    { value: "all", label: "All Year Levels" },
    ...analytics.yearLevelData.map((item) => ({ value: item.level, label: item.level }))
  ], [analytics.yearLevelData]);

  const activeYearLevels = useMemo(() => (
    selectedYearLevel === "all" ? analytics.yearLevelData.length : 1
  ), [analytics.yearLevelData, selectedYearLevel]);

  const filteredGradeData = useMemo(() => (
    analytics.averageGradeData.filter((item) => selectedYearLevel === "all" || item.level === selectedYearLevel)
  ), [analytics.averageGradeData, selectedYearLevel]);

  const academicInsights = useMemo(() => {
    if (!filteredGradeData.length) return { best: null, worst: null, totalRecords: 0 };
    const best = filteredGradeData.reduce((a, b) => (b.average < a.average ? b : a));
    const worst = filteredGradeData.reduce((a, b) => (b.average > a.average ? b : a));
    const totalRecords = filteredGradeData.reduce((sum, item) => sum + item.records, 0);
    return { best, worst, totalRecords };
  }, [filteredGradeData]);

  const sentimentSummary = useMemo(() => {
    const trend = analytics.sentimentTrend;
    if (!trend.length) return { positive: 0, neutral: 0, negative: 0 };
    const sum = trend.reduce((acc, t) => ({
      positive: acc.positive + Number(t.positive || 0),
      neutral: acc.neutral + Number(t.neutral || 0),
      negative: acc.negative + Number(t.negative || 0),
    }), { positive: 0, neutral: 0, negative: 0 });
    return {
      positive: Math.round(sum.positive / trend.length),
      neutral: Math.round(sum.neutral / trend.length),
      negative: Math.round(sum.negative / trend.length),
    };
  }, [analytics.sentimentTrend]);

  const earlyWarnings = useMemo(() => {
    const warnings = [];
    const atRisk = filteredSummary.filter(item => Number(item.riskScore || 0) >= 40 || item.riskStatus === 'high' || item.riskStatus === 'medium').length;
    const pending = filteredSummary.filter(item => Number(item.completionRate || 0) < 75).length;
    const negative = analytics.sentimentTrend.reduce((sum, item) => sum + Number(item.negative || 0), 0);
    const rejected = analytics.submissions.filter(item => String(item.status || '').toLowerCase() === 'rejected').length;
    if (atRisk) warnings.push({ label: 'Prioritize At-Risk Scholars', detail: `${atRisk} scholar${atRisk === 1 ? '' : 's'} require immediate follow-up.`, action: 'View', path: '/admin/flagged' });
    if (pending) warnings.push({ label: 'Follow Up on Incomplete Compliance', detail: `${pending} scholar${pending === 1 ? '' : 's'} are below the 75% completion threshold.`, action: 'View', path: '/admin/compliance' });
    if (negative) warnings.push({ label: 'Review Negative Correspondence', detail: `${negative} negative sentiment record${negative === 1 ? '' : 's'} appear in the loaded trend.`, action: 'View', path: '/admin/correspondence' });
    if (rejected) warnings.push({ label: 'Resolve Rejected Submissions', detail: `${rejected} submission${rejected === 1 ? '' : 's'} require scholar revision.`, action: 'View', path: '/admin/reports' });
    return warnings.length ? warnings : [{ label: 'No Urgent Warnings Detected', detail: 'Continue monitoring new submissions and compliance changes.', action: 'View', path: '/admin/reports' }];
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

  // ── Loading skeleton — mirrors the final layout ──
  if (loading) {
    const block = { background: '#EFE6D8' };
    return (
      <div className="min-h-screen overflow-x-hidden" style={{ background: BG, ...sans }}>
        <div className="w-full px-4 sm:px-6 lg:px-8 flex flex-col gap-6">
          <div>
            <div className="animate-pulse h-3 w-28 rounded-full mb-3" style={{ background: `${BRONZE}30` }} />
            <div className="animate-pulse h-8 w-72 max-w-full rounded-lg" style={{ background: `${PRIMARY}14` }} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map(i => <div key={i} className="animate-pulse h-28" style={{ ...block, borderRadius: RADIUS }} />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="animate-pulse h-80" style={{ ...block, borderRadius: RADIUS }} />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {[0, 1].map(i => <div key={i} className="animate-pulse h-64" style={{ ...block, borderRadius: RADIUS }} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: BG, ...sans }}>
      <div className="w-full px-4 sm:px-6 lg:px-8 flex flex-col gap-6">

        <AdminPageHeader
          title="Analytics Dashboard"
          description="Overview of scholar records, submissions, compliance, and performance."
          actions={
            <div className="flex flex-wrap items-center gap-2.5 flex-shrink-0">
            <select
              value={selectedYearLevel}
              onChange={(e) => setSelectedYearLevel(e.target.value)}
              aria-label="Filter by year level"
              className="px-4 py-2.5 rounded-full outline-none max-w-full"
              style={{ ...sans, fontSize: '0.78rem', fontWeight: 600, background: SURFACE, border: `1px solid ${BORDER}`, color: INK, cursor: 'pointer' }}
            >
              {yearLevelOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button
              onClick={exportCsv}
              className="flex items-center gap-2 rounded-full transition-opacity hover:opacity-90"
              style={{ ...sans, fontSize: '0.78rem', fontWeight: 700, background: PRIMARY, color: '#fff', border: 'none', padding: '10px 18px', cursor: 'pointer' }}
            >
              <Download size={14} /> Export CSV
            </button>
            </div>
          }
        />

        {error && (
          <div className="rounded-xl px-4 py-3" style={{ background: `${WARNING}14`, border: `1px solid ${WARNING}45` }}>
            <span style={{ ...sans, fontSize: '0.82rem', color: '#8a6423' }}>{error}</span>
          </div>
        )}

        {/* ── KPI overview ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={Users}          label="Total Scholars"     value={selectedSummaryTotals.total}     color={PRIMARY} />
          <KpiCard icon={TrendingUp}     label="Average Compliance" value={`${selectedSummaryTotals.avg}%`} color={SUCCESS} />
          <KpiCard icon={AlertTriangle}  label="High-Risk Scholars" value={selectedSummaryTotals.atRisk}    color={DANGER} onClick={() => navigate('/admin/flagged')} />
          <KpiCard icon={GraduationCap}  label="Active Year Levels" value={activeYearLevels}                color={BRONZE} />
        </div>

        {/* ── Main analytics: row 1 ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <ChartCard title="Compliance Distribution" subtitle="Share of scholars in each compliance bracket.">
            <ResponsiveContainer width="100%" height={CHART_HEIGHT - 60}>
              <PieChart>
                <Pie
                  data={selectedSummaryTotals.overallCompliance}
                  cx="50%" cy="50%" labelLine={false}
                  innerRadius={52} outerRadius={82} paddingAngle={2} stroke={SURFACE}
                  dataKey="value" nameKey="name"
                >
                  {selectedSummaryTotals.overallCompliance.map((entry) => (
                    <Cell key={`pie-cell-${entry.id}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [`${v}%`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <DonutLegend items={selectedSummaryTotals.overallCompliance.map((c) => ({ label: c.name, value: c.value, color: c.color }))} />
          </ChartCard>

          <ChartCard title="Monthly Submission Trends" subtitle="Approved, pending, and rejected submissions.">
            <ResponsiveContainer width="100%" height={CHART_HEIGHT + 40}>
              <LineChart data={selectedSubmissionTrends} margin={CHART_MARGIN}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="month" tick={axisStyle} stroke={BORDER} />
                <YAxis tick={axisStyle} stroke={BORDER} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={legendStyle} />
                <Line type="monotone" dataKey="approved" stroke={SUCCESS} strokeWidth={2.5} dot={{ fill: SUCCESS, r: 3 }} name="Approved" />
                <Line type="monotone" dataKey="pending" stroke={WARNING} strokeWidth={2.5} dot={{ fill: WARNING, r: 3 }} name="Pending" />
                <Line type="monotone" dataKey="rejected" stroke={DANGER} strokeWidth={2.5} dot={{ fill: DANGER, r: 3 }} name="Rejected" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="md:col-span-2 xl:col-span-1 min-w-0">
            <ChartCard title="Sentiment Analysis" subtitle="Average share across the last 6 months of correspondence.">
              <ResponsiveContainer width="100%" height={CHART_HEIGHT - 60}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Positive', value: sentimentSummary.positive, color: SUCCESS },
                      { name: 'Neutral', value: sentimentSummary.neutral, color: WARNING },
                      { name: 'Negative', value: sentimentSummary.negative, color: DANGER },
                    ]}
                    cx="50%" cy="50%" labelLine={false}
                    innerRadius={52} outerRadius={82} paddingAngle={2} stroke={SURFACE}
                    dataKey="value" nameKey="name"
                  >
                    {[SUCCESS, WARNING, DANGER].map((c, i) => <Cell key={`sent-cell-${i}`} fill={c} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [`${v}%`, n]} />
                </PieChart>
              </ResponsiveContainer>
              <DonutLegend items={[
                { label: 'Positive', value: sentimentSummary.positive, color: SUCCESS },
                { label: 'Neutral', value: sentimentSummary.neutral, color: WARNING },
                { label: 'Negative', value: sentimentSummary.negative, color: DANGER },
              ]} />
            </ChartCard>
          </div>
        </div>

        {/* ── Main analytics: row 2 ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <ChartCard title="Scholars per Year Level" subtitle="Total scholars in each batch with records.">
            {scholarsPerLevelData.length === 0 ? (
              <div className="flex items-center justify-center text-center" style={{ height: CHART_HEIGHT, ...sans, fontSize: '0.8rem', color: MUTED }}>
                No scholar records for this selection yet.
              </div>
            ) : (
              <div className="overflow-x-auto" style={{ margin: '0 -4px', padding: '0 4px' }}>
                <div style={{ width: '100%', minWidth: scholarsPerLevelData.length * SCHOLAR_CHART_MIN_COL }}>
                  <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                    <BarChart data={scholarsPerLevelData} margin={{ ...CHART_MARGIN, top: 20 }}>
                      <CartesianGrid {...gridProps} />
                      <XAxis dataKey="level" tick={<LevelTick />} stroke={BORDER} interval={0} height={44} />
                      <YAxis tick={axisStyle} stroke={BORDER} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: `${PRIMARY}0A` }} />
                      <Bar dataKey="total" fill={PRIMARY} name="Scholars" radius={[4, 4, 0, 0]} maxBarSize={44}>
                        <LabelList dataKey="total" position="top" style={{ ...axisStyle, fontWeight: 600, fill: INK }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </ChartCard>

          <ChartCard title="Average Grades by Year Level" subtitle="Based on available verified grade records.">
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <BarChart data={filteredGradeData} margin={CHART_MARGIN}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="level" tick={axisStyle} stroke={BORDER} tickFormatter={shortLevel} interval={0} />
                <YAxis tick={axisStyle} stroke={BORDER} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="average" fill={BRONZE} name="Average GWA / grade" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="md:col-span-2 xl:col-span-1 min-w-0">
            <ChartCard title="Compliance Rate by Year Level" subtitle="Compliant, pending, and non-compliant share per batch.">
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <BarChart data={filteredData} margin={CHART_MARGIN} stackOffset="expand">
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="level" tick={axisStyle} stroke={BORDER} tickFormatter={shortLevel} interval={0} />
                  <YAxis tick={axisStyle} stroke={BORDER} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={legendStyle} />
                  <Bar dataKey="compliant" stackId="a" fill={SUCCESS} name="Compliant" />
                  <Bar dataKey="pending" stackId="a" fill={WARNING} name="Pending" />
                  <Bar dataKey="nonCompliant" stackId="a" fill={DANGER} name="Non-compliant" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </div>

        {/* ── Academic insights + executive recommendations ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-2 min-w-0">
            <ChartCard title="Quick Academic Insights" subtitle="Derived from current grade records.">
              <div>
                <InsightRow first icon={ArrowUpRight} color={SUCCESS} label="Best performing" sublabel={academicInsights.best?.level || '—'}
                  value={academicInsights.best ? academicInsights.best.average.toFixed(2) : '—'} />
                <InsightRow icon={ArrowDownRight} color={DANGER} label="Lowest average GWA" sublabel={academicInsights.worst?.level || '—'}
                  value={academicInsights.worst ? academicInsights.worst.average.toFixed(2) : '—'} />
                <InsightRow icon={FileBarChart2} color={PRIMARY} label="Total grade records"
                  value={academicInsights.totalRecords} />
              </div>
            </ChartCard>
          </div>

          <div className="lg:col-span-3 min-w-0">
            <ChartCard title="Executive Recommendations" subtitle="Based on current records and live compliance signals.">
              <div>
                {earlyWarnings.map((warning, i) => (
                  <div key={warning.label} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5"
                    style={{ borderTop: i === 0 ? 'none' : `1px solid ${BORDER}` }}>
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 34, height: 34, background: `${WARNING}14`, color: WARNING }}>
                        <AlertTriangle size={15} />
                      </span>
                      <div className="min-w-0">
                        <p style={{ ...sans, fontSize: '0.86rem', fontWeight: 700, color: INK }}>{warning.label}</p>
                        <p style={{ ...sans, fontSize: '0.76rem', color: MUTED, marginTop: 2 }}>{warning.detail}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => navigate(warning.path)}
                      className="flex-shrink-0 self-start sm:self-center rounded-full transition-opacity hover:opacity-80"
                      style={{ ...sans, fontSize: '0.74rem', fontWeight: 700, color: PRIMARY, background: `${PRIMARY}0F`, border: 'none', padding: '7px 16px', cursor: 'pointer' }}>
                      {warning.action}
                    </button>
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>
        </div>

        {/* ── Natural Language Intelligence — one card, subtle separators ── */}
        <section style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: SHADOW }}>
          <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${BORDER}` }}>
            <SectionHeading title="Natural Language Intelligence" subtitle="AI-powered correspondence sentiment monitoring." />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="min-w-0" style={{ padding: 20 }}>
              <h3 style={{ ...serif, fontSize: '1.02rem', fontWeight: 600, color: INK }}>Sentiment Trend</h3>
              <p style={{ ...sans, fontSize: '0.76rem', color: MUTED, marginTop: 3, marginBottom: 14 }}>Last 6 months of scholar correspondence.</p>
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <AreaChart data={analytics.sentimentTrend} margin={CHART_MARGIN}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="month" tick={axisStyle} stroke={BORDER} />
                  <YAxis tick={axisStyle} stroke={BORDER} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={legendStyle} />
                  <Area type="monotone" dataKey="positive" stackId="1" stroke={SUCCESS} fill={`${SUCCESS}33`} name="Positive %" />
                  <Area type="monotone" dataKey="neutral" stackId="1" stroke={WARNING} fill={`${WARNING}33`} name="Neutral %" />
                  <Area type="monotone" dataKey="negative" stackId="1" stroke={DANGER} fill={`${DANGER}33`} name="Negative %" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="min-w-0 border-t lg:border-t-0 lg:border-l" style={{ padding: 20, borderColor: BORDER }}>
              <h3 style={{ ...serif, fontSize: '1.02rem', fontWeight: 600, color: INK }}>Sentiment by Year Level</h3>
              <p style={{ ...sans, fontSize: '0.76rem', color: MUTED, marginTop: 3, marginBottom: 14 }}>Positive vs. negative share per batch.</p>
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <BarChart data={analytics.sentimentByYearLevel} margin={CHART_MARGIN}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="level" tick={axisStyle} stroke={BORDER} tickFormatter={shortLevel} interval={0} />
                  <YAxis tick={axisStyle} stroke={BORDER} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={legendStyle} />
                  <Bar dataKey="positive" fill={SUCCESS} name="Positive %" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="negative" fill={DANGER} name="Negative %" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sentiment summary strip */}
          <div style={{ padding: 20, borderTop: `1px solid ${BORDER}` }}>
            <div className="flex items-baseline justify-between gap-3 mb-4">
              <h3 style={{ ...serif, fontSize: '1.02rem', fontWeight: 600, color: INK }}>Sentiment Summary</h3>
              <p style={{ ...sans, fontSize: '0.76rem', color: MUTED }}>Average share across the loaded trend.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: 'Positive', value: sentimentSummary.positive, color: SUCCESS },
                { label: 'Neutral', value: sentimentSummary.neutral, color: WARNING },
                { label: 'Negative', value: sentimentSummary.negative, color: DANGER },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-4 rounded-xl px-4 py-3.5" style={{ background: `${s.color}0C` }}>
                  <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}18`, color: s.color }}>
                    <MessageSquareText size={16} />
                  </span>
                  <div>
                    <p style={{ ...serif, fontSize: '1.5rem', fontWeight: 600, color: s.color, lineHeight: 1.1 }}>{s.value}%</p>
                    <p style={{ ...sans, fontSize: '0.76rem', fontWeight: 500, color: MUTED, marginTop: 2 }}>{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};

export default AdminAnalytics;