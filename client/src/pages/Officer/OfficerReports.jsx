import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { FileBarChart2 } from "lucide-react";
import { API_BASE, MAROON, MAROON_LIGHT, authHeaders, exportToExcel } from "../../components/Officer/Reports/ReportsHelpers";
import ComplianceSummaryTab from "../../components/Officer/Reports/ComplianceSummaryTab";
import MonthlyReportsTab from "../../components/Officer/Reports/MonthlyReportsTab";
import ExportReportsTab from "../../components/Officer/Reports/ExportReportsTab";
import OfficerReportDetail from "../../components/Officer/Reports/OfficerReportDetail";
import { buildSummaryRows, currentPeriodLabel, monthPeriodLabel, downloadReportSummaryPdf } from "../../utils/reportPdfExport";

// ── Token system — shared across the whole portal ──
const MAROON_DEEP = '#4f1620';
const GOLD = '#b98b4e';
const GOLD_LIGHT = '#d4af7a';
const IVORY = '#FBF7F2';
const INK = '#241512';
const SAGE = '#6b8f71';
const PAPER = '#F6EFE4';
const RULE = '#e8dccb';
const ROSE = '#F5E8EA';

const serif = { fontFamily: "'Playfair Display', serif" };
const sans = { fontFamily: "'DM Sans', sans-serif" };

const tabItems = [
  { key: "compliance", label: "Submission Summary" },
  { key: "monthly-reports", label: "Monthly Letter Review" },
  { key: "export", label: "Export Reports" },
];

const getReportPeriodLabel = (period) => {
  if (/^\d{4}-\d{2}$/.test(period)) return monthPeriodLabel(period);
  if (period === "Current Month") return currentPeriodLabel();
  if (period === "Last Month") {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  return period;
};

export default function OfficerReports() {
  const [activeTab, setActiveTab] = useState("compliance");

  // ── Compliance Summary tab state ──
  const [complianceRows, setComplianceRows] = useState([]);
  const [complianceExportRows, setComplianceExportRows] = useState([]);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceError, setComplianceError] = useState("");
  const [complianceFetched, setComplianceFetched] = useState(false);
  const [genOptions, setGenOptions] = useState({ report_type: "Monthly Letter", period: new Date().toISOString().slice(0, 7), scholar_group: "All Scholars", date_from: "", date_to: "" });
  const [assignedYearLevels, setAssignedYearLevels] = useState([]);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState("");

  // ── Monthly Reports tab state ──
  const [statusFilter, setStatusFilter] = useState("all");
  const [reports, setReports] = useState([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyError, setMonthlyError] = useState("");
  const [monthlyFetched, setMonthlyFetched] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [actionSaving, setActionSaving] = useState(false);
  const [monthlyFilterMonth, setMonthlyFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [monthlyFilterYearLevel, setMonthlyFilterYearLevel] = useState("");

  // ── Export tab state ──
  const [exportFilters, setExportFilters] = useState({ scholar_id: "", date_from: new Date().toISOString().slice(0, 7), date_to: new Date().toISOString().slice(0, 7), report_type: "all-requirements" });
  const [exportData, setExportData] = useState({ duty_attendance: [], submissions: [], requirements: [], activities: [] });
  const [exportScholars, setExportScholars] = useState([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportFetched, setExportFetched] = useState(false);
  const [exportError, setExportError] = useState("");

  const setExportField = (key, value) => {
    setExportFilters(prev => ({ ...prev, [key]: value }));
    setExportFetched(false);
    setExportData({ duty_attendance: [], submissions: [], requirements: [], activities: [] });
    setExportError("");
  };

  const fetchCompliance = async () => {
    setComplianceLoading(true);
    setComplianceError("");
    try {
      const endpoint = genOptions.report_type === "Task Completion"
        ? `${API_BASE}/officer/reports/task-completion`
        : `${API_BASE}/officer/reports/scholar-submissions`;
      const res = await axios.get(endpoint, {
        ...authHeaders(),
        params: {
          report_type: genOptions.report_type,
          period: genOptions.period,
          scholar_group: genOptions.scholar_group,
          date_from: genOptions.date_from,
          date_to: genOptions.date_to,
        },
      });
      const reportRows = Array.isArray(res.data) ? res.data : [];
      setComplianceExportRows(reportRows);
      setComplianceRows(reportRows.filter(row => Number(row.submitted || 0) > 0));
      setComplianceFetched(true);
    } catch (err) {
      console.error(err);
      setComplianceError(
        err.response?.status === 404
          ? "Missing backend route for the selected report."
          : "Failed to load compliance summary. Check your connection or login session."
      );
    } finally {
      setComplianceLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setGenLoading(true);
    setGenError("");
    try {
      const rows = complianceExportRows.map(row => ({
        scholarName: row.name,
        studentId: row.studentId,
        submitted: row.submitted,
        approved: row.approved,
        pending: row.pending,
        submittedAt: row.latestSubmittedAt,
        qualityStatus: row.qualityStatus,
        reviewStatus: row.submitted > 0
          ? (row.approved > 0 ? `Approved (${row.approved})` : "Pending Review")
          : "No Submission",
      }));
      await downloadReportSummaryPdf({
        role: "officer",
        reportTitle: `${genOptions.report_type} Report`,
        reportType: genOptions.report_type,
        periodLabel: getReportPeriodLabel(genOptions.period),
        rows,
      });
    } catch (err) {
      console.error(err);
      setGenError(
        err.response?.status === 404
          ? "Missing PDF export route for the selected report."
          : "Failed to generate the PDF report. Please try again."
      );
    } finally {
      setGenLoading(false);
    }
  };

  const fetchMonthlyReports = async () => {
    setMonthlyLoading(true);
    setMonthlyError("");
    try {
      const res = await axios.get(`${API_BASE}/officer/reports/monthly-submissions`, {
        ...authHeaders(),
        params: {
          month: monthlyFilterMonth,
          year_level: monthlyFilterYearLevel,
        },
      });
      setReports(res.data || []);
      setMonthlyFetched(true);
    } catch (err) {
      console.error(err);
      setMonthlyError(
        err.response?.status === 404
          ? "Missing backend route: /officer/reports/monthly-submissions"
          : "Failed to load monthly reports. Check your connection or login session."
      );
    } finally {
      setMonthlyLoading(false);
    }
  };

  const handleAction = async (id, action, feedback) => {
    setActionSaving(true);
    try {
      await axios.post(`${API_BASE}/officer/reports/monthly-submissions/${id}/action`, { action, feedback }, authHeaders());
      setReports(prev => prev.map(report => report.id === id ? { ...report, staffAction: action, staffFeedback: feedback } : report));
      setSelectedReport(prev => prev ? { ...prev, staffAction: action, staffFeedback: feedback } : null);
    } catch (err) {
      console.error(err);
      alert(
        err.response?.status === 404
          ? "Missing backend route: /officer/reports/monthly-submissions/:id/action"
          : err.response?.data?.error || "Failed to update the submission review."
      );
    } finally {
      setActionSaving(false);
    }
  };

  useEffect(() => {
    axios.get(`${API_BASE}/officer/assigned-year-levels`, authHeaders())
      .then(res => {
        const levels = Array.isArray(res.data) ? res.data : [];
        setAssignedYearLevels(levels);
        if (levels.length) {
          setGenOptions(current => ({ ...current, scholar_group: levels[0] }));
          setMonthlyFilterYearLevel(current => current || levels[0]);
        }
      })
      .catch(() => setAssignedYearLevels([]));
    axios.get(`${API_BASE}/staff/pending`, authHeaders())
      .then(res => setExportScholars(res.data || []))
      .catch(err => {
        console.error("Failed to load scholars for export filter", err);
        setExportScholars([]);
      });
  }, []);

  useEffect(() => {
    if (activeTab === "compliance") {
      fetchCompliance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, genOptions]);

  useEffect(() => {
    if (activeTab === "monthly-reports") {
      fetchMonthlyReports();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, monthlyFilterMonth, monthlyFilterYearLevel]);

  const handleExportGenerate = async () => {
    setExportLoading(true);
    setExportFetched(false);
    setExportError("");
    try {
      const params = {};
      if (exportFilters.scholar_id) params.scholar_id = exportFilters.scholar_id;
      if (exportFilters.date_from) params.date_from = `${exportFilters.date_from}-01`;
      if (exportFilters.date_to) {
        const [year, month] = exportFilters.date_to.split('-').map(Number);
        params.date_to = new Date(year, month, 0).toISOString().slice(0, 10);
      }

      const reportType = exportFilters.report_type;
      const results = { submissions: [], requirements: [], activities: [] };
      const fetchUrl = (url) => axios.get(`${API_BASE}${url}`, { ...authHeaders(), params }).then(r => r.data);

      if (["monthly-letter", "grades", "cor", "other"].includes(reportType)) {
        const reportNames = { "monthly-letter": "Monthly Letter", grades: "Grades", cor: "COR", other: "Other Documents" };
        const selectedPeriod = exportFilters.date_from && exportFilters.date_to
          ? "Custom Range"
          : "Current Month";
        const response = await axios.get(`${API_BASE}/officer/reports/scholar-submissions`, {
          ...authHeaders(),
          params: { ...params, report_type: reportNames[reportType], period: selectedPeriod },
        });
        results.submissions = (response.data || []).filter(row => Number(row.submitted || 0) === 0 || Number(row.approved || 0) > 0).map(row => ({
          scholar: row.name,
          scholar_id: row.studentId,
          type: reportNames[reportType],
          deadline: row.deadline,
          approved_at: row.status === "approved" ? row.reviewedAt : null,
          submitted_at: row.latestSubmittedAt,
          status: row.submitted > 0 ? "approved" : "Not Submitted",
          quality_status: row.qualityStatus,
        }));
      }
      if (reportType === "all-requirements") {
        const reportNames = ["Monthly Letter", "Report Cards", "Grades", "COR", "Other Documents"];
        const reportRows = await Promise.all(reportNames.map(reportName => axios.get(`${API_BASE}/officer/reports/scholar-submissions`, {
          ...authHeaders(),
          params: {
            ...params,
            report_type: reportName,
            period: exportFilters.date_from && exportFilters.date_to ? "Custom Range" : "Current Month",
          },
        }).then(response => (response.data || []).filter(row => Number(row.submitted || 0) === 0 || Number(row.approved || 0) > 0).map(row => ({
          scholar: row.name,
          scholar_id: row.studentId,
          type: reportName === "Report Cards" ? "Grades" : reportName,
          status: row.submitted > 0 ? (row.approved > 0 ? "approved" : "pending") : "Not Submitted",
          staff_comment: row.submitted > 0 ? (row.approved > 0 ? "Approved" : "Pending Review") : "Not Submitted",
          deadline: row.deadline,
          approved_at: row.approved > 0 ? row.reviewedAt : null,
          submitted_at: row.latestSubmittedAt,
        })))));
        results.requirements = reportRows.flat();
      }

      const sortByReportDate = (a, b) => {
        const aDate = new Date(a.submitted_at || a.deadline || 0).getTime();
        const bDate = new Date(b.submitted_at || b.deadline || 0).getTime();
        return bDate - aDate || a.scholar.localeCompare(b.scholar);
      };
      results.submissions.sort(sortByReportDate);
      results.requirements.sort(sortByReportDate);
      setExportData(results);
      setExportFetched(true);
    } catch (err) {
      console.error(err);
      setExportError("Failed to load export report data. Check your connection or login session.");
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportDownload = () => {
    const scholarName = exportFilters.scholar_id
      ? exportScholars.find(s => s.scholar_id === exportFilters.scholar_id || s.id === Number(exportFilters.scholar_id))?.full_name || "Scholar"
      : "All_Scholars";
    exportToExcel(exportData, scholarName, exportFilters.report_type === "all-requirements" ? "requirements" : "submissions");
  };

  const handleExportPdf = async () => {
    try {
      const records = [
        ...(exportData.submissions || []),
        ...(exportData.requirements || []),
        ...(exportData.activities || []),
      ];
      const rows = records.map(row => ({
        scholarName: row.scholar,
        studentId: row.scholar_id,
        requirement: row.type,
        deadline: row.deadline,
        submittedAt: row.submitted_at,
        approvedAt: row.approved_at,
        reviewStatus: row.status,
      })).sort((a, b) => {
        const aDate = new Date(a.submittedAt || a.deadline || 0).getTime();
        const bDate = new Date(b.submittedAt || b.deadline || 0).getTime();
        return bDate - aDate || a.scholarName.localeCompare(b.scholarName);
      });
      await downloadReportSummaryPdf({ role: 'officer', reportTitle: 'Officer Reports', reportType: 'Export Reports', periodLabel: currentPeriodLabel(), rows });
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to generate the PDF report.');
    }
  };

  const filteredMonthly = useMemo(() => (
    statusFilter === "all" ? reports : reports.filter(report => report.status === statusFilter)
  ), [reports, statusFilter]);

  const monthlyCounts = useMemo(() => ({
    all: reports.length,
    accepted: reports.filter(r => r.status === "accepted").length,
    "medium-risk": reports.filter(r => r.status === "medium-risk").length,
    "high-risk": reports.filter(r => r.status === "high-risk").length,
  }), [reports]);

  const pendingStaff = useMemo(() => reports.filter(r => !r.staffAction).length, [reports]);

  return (
    <div className="min-h-screen" style={{ background: IVORY, ...sans }}>

      {/* ── Ledger header band — same family as the rest of the portal ── */}
      <div className="relative overflow-hidden px-5 sm:px-8 pt-8 pb-11" style={{ background: `linear-gradient(135deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)` }}>
        <svg className="absolute -right-6 -top-10 w-56 h-56 opacity-[0.12] pointer-events-none" viewBox="0 0 200 200" fill="none">
          <rect x="45" y="70" width="20" height="70" fill={GOLD} />
          <rect x="90" y="45" width="20" height="95" fill={GOLD} />
          <rect x="135" y="95" width="20" height="45" fill={GOLD} />
        </svg>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ border: `1.5px solid ${GOLD}` }}>
            <FileBarChart2 size={12} style={{ color: GOLD }} />
          </div>
          <span style={{ ...sans, fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.28em', textTransform: 'uppercase', color: GOLD_LIGHT }}>Officer Portal</span>
        </div>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 style={{ ...serif, fontSize: '2rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>Reports &amp; Analytics</h1>
            <p style={{ ...sans, fontSize: '0.82rem', color: '#e9c9a8', marginTop: 4, maxWidth: 480 }}>Track compliance, review submissions, and export comprehensive scholar reports.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-2" style={{ background: 'rgba(255,255,255,0.08)', border: `1.5px solid ${SAGE}88` }}>
            <span className="inline-flex h-2 w-2 rounded-full" style={{ background: SAGE }} />
            <span style={{ ...sans, fontSize: '0.7rem', fontWeight: 700, color: '#cfe3d2' }}>System Active</span>
          </div>
        </div>
      </div>

      <div className="relative z-10 px-5 sm:px-8 -mt-6 pb-10">

        {/* ── Tab Container ── */}
        <section className="mb-6 rounded-xl overflow-hidden" style={{ background: '#fff', border: `1px solid ${RULE}`, boxShadow: '0 8px 24px -14px rgba(36,21,18,0.2)' }}>

          {/* Tab Navigation */}
          <div className="flex gap-1 px-3 sm:px-5" style={{ borderBottom: `1px solid ${RULE}`, background: PAPER }}>
            {tabItems.map((tab) => {
              const isActive = activeTab === tab.key;
              const tabCount = tab.key === "monthly-reports" && monthlyFetched ? monthlyCounts.all : null;

              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="relative flex items-center gap-2 px-4 py-3 transition-colors"
                  style={{ ...sans, fontSize: '0.8rem', fontWeight: 700, color: isActive ? MAROON : '#a89890', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {tab.label}
                  {tabCount != null && (
                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5" style={{ background: ROSE, color: MAROON, fontSize: '0.65rem', fontWeight: 800 }}>
                      {tabCount}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute left-0 right-0" style={{ bottom: -1, height: 2, background: MAROON }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="p-5 sm:p-6">
            {activeTab === "compliance" && (
              <ComplianceSummaryTab
                rows={complianceRows}
                loading={complianceLoading}
                error={complianceError}
                genOptions={genOptions}
                setGenOptions={setGenOptions}
                genLoading={genLoading}
                genError={genError}
                onGenerate={handleGenerateReport}
                onRefresh={fetchCompliance}
                assignedYearLevels={assignedYearLevels}
              />
            )}

            {activeTab === "monthly-reports" && (
              <MonthlyReportsTab
                filteredReports={filteredMonthly}
                loading={monthlyLoading}
                error={monthlyError}
                counts={monthlyCounts}
                pendingStaff={pendingStaff}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                month={monthlyFilterMonth}
                setMonth={setMonthlyFilterMonth}
                yearLevel={monthlyFilterYearLevel}
                setYearLevel={setMonthlyFilterYearLevel}
                onRefresh={fetchMonthlyReports}
                onSelectReport={setSelectedReport}
                assignedYearLevels={assignedYearLevels}
              />
            )}

            {activeTab === "export" && (
              <ExportReportsTab
                filters={exportFilters}
                setField={setExportField}
                scholars={exportScholars}
                data={exportData}
                loading={exportLoading}
                fetched={exportFetched}
                error={exportError}
                onGenerate={handleExportGenerate}
                onDownload={handleExportDownload}
                onDownloadPdf={handleExportPdf}
              />
            )}
          </div>
        </section>

        {/* ─── Report Detail Modal ─── */}
        {selectedReport && (
          <OfficerReportDetail
            report={selectedReport}
            onClose={() => setSelectedReport(null)}
            onAction={handleAction}
            actionSaving={actionSaving}
          />
        )}
      </div>
    </div>
  );
}