import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { API_BASE, MAROON, MAROON_LIGHT, authHeaders, exportToExcel } from "../../components/Officer/Reports/ReportsHelpers";
import ComplianceSummaryTab from "../../components/Officer/Reports/ComplianceSummaryTab";
import MonthlyReportsTab from "../../components/Officer/Reports/MonthlyReportsTab";
import ExportReportsTab from "../../components/Officer/Reports/ExportReportsTab";
import OfficerReportDetail from "../../components/Officer/Reports/OfficerReportDetail";

const tabItems = [
  { key: "compliance", label: "Compliance Summary" },
  { key: "monthly-reports", label: "Monthly Reports" },
  { key: "export", label: "Export Reports" },
];

export default function OfficerReports() {
  const [activeTab, setActiveTab] = useState("compliance");

  // ── Compliance Summary tab state ──
  const [complianceRows, setComplianceRows] = useState([]);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceError, setComplianceError] = useState("");
  const [complianceFetched, setComplianceFetched] = useState(false);
  const [genOptions, setGenOptions] = useState({ report_type: "Compliance Summary", period: "Current Month", scholar_group: "All Scholars", date_from: "", date_to: "" });
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
  const [monthlyFilterMonth, setMonthlyFilterMonth] = useState("");
  const [monthlyFilterYearLevel, setMonthlyFilterYearLevel] = useState("");

  // ── Export tab state ──
  const [exportFilters, setExportFilters] = useState({ scholar_id: "", date_from: "", date_to: "", report_type: "all" });
  const [exportData, setExportData] = useState({ duty_attendance: [], submissions: [], requirements: [], activities: [] });
  const [exportScholars, setExportScholars] = useState([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportFetched, setExportFetched] = useState(false);
  const [exportError, setExportError] = useState("");

  const setExportField = (key, value) => setExportFilters(prev => ({ ...prev, [key]: value }));

  const fetchCompliance = async () => {
    setComplianceLoading(true);
    setComplianceError("");
    try {
      const res = await axios.get(`${API_BASE}/officer/reports/compliance-summary`, {
        ...authHeaders(),
        params: {
          period: genOptions.period,
          scholar_group: genOptions.scholar_group,
          date_from: genOptions.date_from,
          date_to: genOptions.date_to,
        },
      });
      setComplianceRows(res.data || []);
      setComplianceFetched(true);
    } catch (err) {
      console.error(err);
      setComplianceError(
        err.response?.status === 404
          ? "Missing backend route: /officer/reports/compliance-summary"
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
      const res = await axios.post(`${API_BASE}/officer/reports/compliance-summary/pdf`, genOptions, {
        ...authHeaders(),
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `ComplianceSummary_${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setGenError(
        err.response?.status === 404
          ? "Missing backend route: /officer/reports/compliance-summary/pdf"
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
      if (exportFilters.date_from) params.date_from = exportFilters.date_from;
      if (exportFilters.date_to) params.date_to = exportFilters.date_to;

      const reportType = exportFilters.report_type;
      const results = { submissions: [], requirements: [], activities: [] };
      const fetchUrl = (url) => axios.get(`${API_BASE}${url}`, { ...authHeaders(), params }).then(r => r.data);

      if (reportType === "all" || reportType === "submissions") results.submissions = await fetchUrl("/staff/reports/submissions");
      if (reportType === "all" || reportType === "requirements") results.requirements = await fetchUrl("/staff/reports/requirements");
      if (reportType === "all" || reportType === "activities") results.activities = await fetchUrl("/staff/reports/activities");

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
    exportToExcel(exportData, scholarName, exportFilters.report_type);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        
        {/* ─── Header ─── */}
        <header className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Officer Portal</p>
              <h1 className="text-4xl font-black text-slate-900">Reports & Analytics</h1>
              <p className="max-w-xl text-sm text-slate-600">Track compliance, review submissions, and export comprehensive scholar reports</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-green-50 px-4 py-2 border border-green-200">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
              <span className="text-xs font-semibold text-green-700">System Active</span>
            </div>
          </div>
        </header>

        {/* ─── Tab Container ─── */}
        <section className="mb-6 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          
          {/* Tab Navigation */}
          <div className="flex gap-0 border-b border-slate-200 bg-slate-50 p-3 sm:p-4">
            {tabItems.map((tab, idx) => {
              const isActive = activeTab === tab.key;
              const tabCount = tab.key === "monthly-reports" && monthlyFetched ? monthlyCounts.all : null;
              
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative px-4 py-2.5 text-sm font-semibold transition-all ${
                    isActive
                      ? "text-slate-900"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {tab.label}
                    {tabCount && (
                      <span className="inline-flex h-5 min-w-max items-center rounded-full bg-red-100 px-2 text-[0.65rem] font-bold text-red-700">
                        {tabCount}
                      </span>
                    )}
                  </span>
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#7f2d3a] to-[#a43d4d] rounded-t-full" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="p-6 lg:p-8">
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
