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
      const results = { duty_attendance: [], submissions: [], requirements: [], activities: [] };
      const fetchUrl = (url) => axios.get(`${API_BASE}${url}`, { ...authHeaders(), params }).then(r => r.data);

      if (reportType === "all" || reportType === "duty_attendance") results.duty_attendance = await fetchUrl("/staff/reports/duty-attendance");
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
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Officer Reports</p>
              <h1 className="text-3xl font-black text-slate-900">Request Summary & Reports</h1>
              <p className="max-w-2xl text-sm text-slate-500">View compliance status, review monthly scholar submissions, and generate exports from the officer dashboard.</p>
            </div>
            <div className="rounded-3xl bg-[#7f2d3a]/10 px-4 py-3 inline-flex items-center gap-3 text-sm font-semibold text-[#7f2d3a]">
              <span className="inline-flex h-3 w-3 rounded-full bg-[#7f2d3a]" /> Live data from real backend reports
            </div>
          </div>
        </header>

        <section className="rounded-[2rem] bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex flex-wrap gap-2 bg-slate-100 p-4 sm:p-5">
            {tabItems.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${activeTab === tab.key ? "bg-white text-[#7f2d3a] shadow-sm" : "text-slate-500 hover:bg-white/70 hover:text-slate-700"}`}
              >
                {tab.label}
                {tab.key === "monthly-reports" && monthlyFetched && (
                  <span className="ml-2 inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[#fef2f2] px-2 text-[0.65rem] font-bold text-red-600">{monthlyCounts.all}</span>
                )}
              </button>
            ))}
          </div>

          <div className="p-6">
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
