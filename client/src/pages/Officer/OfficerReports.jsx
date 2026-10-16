import { useState, useEffect } from "react";
import axios from "axios";
import { CalendarDays, BarChart3, FileText } from "lucide-react";
import { API_BASE, authHeaders } from "../../components/Officer/Reports/ReportsHelpers";
import ComplianceSummaryTab from "../../components/Officer/Reports/ComplianceSummaryTab";
import MonthlyReportsTab from "../../components/Officer/Reports/MonthlyReportsTab";
import { monthPeriodLabel, downloadReportSummaryPdf } from "../../utils/reportPdfExport";
import * as XLSX from "xlsx";

// ── Design tokens — shared Apple Scholar brand system (unchanged) ──
const MAROON_DEEP = '#4f1620';
const GOLD = '#b98b4e';
const BG = '#F6EFE4';
const CARD = '#fffdf8';
const RULE = '#e8dccb';
const INK = '#241512';
const MUTED = '#a89890';

const display = { fontFamily: "'Lora', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Work Sans', 'Segoe UI', sans-serif" };
// Shared bento tile: one radius, one border, one shadow for every card.
const tile = {
  background: CARD,
  border: `1px solid ${RULE}`,
  borderRadius: 14,
  boxShadow: '0 8px 20px -16px rgba(36,21,18,0.35)',
};

// Tab keys and labels are unchanged; icons are presentational only.
const tabItems = [
  { key: "compliance", label: "Compliance Reports", Icon: BarChart3 },
  { key: "monthly-reports", label: "Monthly Letter Review", Icon: FileText },
];

const currentMonth = new Date().toISOString().slice(0, 7);

export default function OfficerReports() {
  const [activeTab, setActiveTab] = useState("compliance");

  // ── Compliance Summary tab state ──
  const [complianceRows, setComplianceRows] = useState([]);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceError, setComplianceError] = useState("");
  const [genOptions, setGenOptions] = useState({
    report_type: "Monthly Letter",
    period: currentMonth,
    scholar_group: "All Scholars",
    scholar_id: "",
  });
  const [assignedYearLevels, setAssignedYearLevels] = useState([]);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState("");

  const fetchCompliance = async () => {
    if (!/^\d{4}-\d{2}$/.test(genOptions.period)) {
      setComplianceRows([]);
      setComplianceError("Select a month or period to load this report.");
      return;
    }
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
        },
      });
      const reportRows = Array.isArray(res.data) ? res.data : [];
      setComplianceRows(genOptions.report_type === "Task Completion"
        ? reportRows.filter(row => Number(row.assignedTasks || 0) > 0)
        : reportRows);
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
      const rows = filteredComplianceRows.map(row => ({
        scholarName: row.name,
        studentId: row.studentId,
        submitted: genOptions.report_type === "Task Completion" ? row.completedTasks : row.submitted,
        approved: genOptions.report_type === "Task Completion" ? row.completedTasks : row.approved,
        pending: genOptions.report_type === "Task Completion" ? row.pendingTasks : row.pending,
        assigned: row.assignedTasks,
        missing: row.missingTasks,
        submittedAt: row.latestSubmittedAt,
        qualityStatus: row.qualityStatus,
        exportAvailableAt: row.exportAvailableAt,
        reviewStatus: genOptions.report_type === "Task Completion"
          ? `Missing: ${row.missingTasks}; Pending: ${row.pendingTasks}`
          : row.submitted > 0
            ? (row.approved > 0 ? `Approved (${row.approved})` : "Pending Review")
            : "No Submission",
      }));
      await downloadReportSummaryPdf({
        role: "officer",
        reportTitle: `${genOptions.report_type} Report`,
        reportType: genOptions.report_type,
        periodLabel: monthPeriodLabel(genOptions.period),
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

  const handleExportSummaryExcel = () => {
    const rows = filteredComplianceRows.map(row => ({
      Scholar: row.name,
      "Student ID": row.studentId,
      "Year Level": row.year_level,
      "Submitted Count": genOptions.report_type === "Task Completion" ? row.completedTasks : row.submitted,
      "Approved Count": genOptions.report_type === "Task Completion" ? row.completedTasks : row.approved,
      Pending: genOptions.report_type === "Task Completion" ? row.pendingTasks : row.pending,
      "Completion Rate": `${row.completionRate}%`,
      "Latest Submission": row.latestSubmittedAt || "—",
      "Quality Status": row.qualityStatus || "—",
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Compliance Reports");
    const filename = `compliance-reports-${genOptions.report_type.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${monthPeriodLabel(genOptions.period).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  useEffect(() => {
    axios.get(`${API_BASE}/officer/assigned-year-levels`, authHeaders())
      .then(res => {
        const levels = Array.isArray(res.data) ? res.data : [];
        setAssignedYearLevels(levels);
      })
      .catch(() => setAssignedYearLevels([]));
  }, []);

  useEffect(() => {
    if (activeTab === "compliance") {
      fetchCompliance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTab,
    genOptions.report_type,
    genOptions.period,
    genOptions.scholar_group,
  ]);

  const filteredComplianceRows = complianceRows.filter(row => {
    if (genOptions.scholar_group !== "All Scholars" && row.year_level !== genOptions.scholar_group) return false;
    if (genOptions.scholar_id && row.studentId !== genOptions.scholar_id) return false;
    return true;
  });

  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ ...body, background: BG }}>
      <style>{`
        .or-tabs-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        .or-tabs-scroll::-webkit-scrollbar { display: none; }
        .or-tab:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 2px; }
      `}</style>

      {/* ── Bento header — title tile + date tile, separated by a gap ── */}
      <header className="flex flex-col gap-4 sm:flex-row mb-4">
        <div style={{ ...tile, flex: 1, minWidth: 0, padding: '20px 24px' }}>
          <span style={{ ...body, display: 'block', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: GOLD, marginBottom: 6 }}>
            Officer Portal
          </span>
          <h1 style={{ ...display, fontSize: 'clamp(1.7rem, 3.4vw, 2.3rem)', fontWeight: 600, lineHeight: 1.1, letterSpacing: '-0.01em', color: MAROON_DEEP, margin: 0 }}>
            Reports &amp; Analytics
          </h1>
          <p style={{ ...body, fontSize: '0.88rem', color: '#7a6a62', marginTop: 8, maxWidth: 560, lineHeight: 1.5 }}>
            View submission summaries and generate reports for your assigned scholars.
          </p>
        </div>

        <div className="flex items-center gap-3" style={{ ...tile, padding: '16px 22px' }}>
          <span className="inline-flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 10, background: `${MAROON_DEEP}0f`, flexShrink: 0 }}>
            <CalendarDays size={20} strokeWidth={1.75} style={{ color: MAROON_DEEP }} />
          </span>
          <div>
            <div style={{ ...body, fontSize: '0.66rem', color: MUTED, lineHeight: 1.2 }}>Today</div>
            <div style={{ ...body, fontSize: '0.86rem', fontWeight: 600, color: INK, lineHeight: 1.3, whiteSpace: 'nowrap' }}>{todayLabel}</div>
          </div>
        </div>
      </header>

      {/* ── Tabs — compact segmented bar. Burgundy marks the active tab. ── */}
      <nav aria-label="Report sections" className="or-tabs-scroll mb-4" style={{ overflowX: 'auto' }}>
        <div
          role="tablist"
          className="flex"
          style={{ ...tile, minWidth: 'max-content', width: '100%', padding: 6, gap: 6 }}
        >
          {tabItems.map(({ key, label, Icon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(key)}
                className="or-tab flex flex-1 items-center justify-center gap-2"
                style={{
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: `1px solid ${isActive ? MAROON_DEEP : 'transparent'}`,
                  background: isActive ? MAROON_DEEP : 'transparent',
                  color: isActive ? '#fffdf8' : '#6f6058',
                  ...body, fontSize: '0.82rem', fontWeight: isActive ? 600 : 500,
                  whiteSpace: 'nowrap', cursor: 'pointer',
                  transition: 'background 120ms ease, color 120ms ease',
                }}
              >
                <Icon size={15} strokeWidth={1.9} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Content surface ── */}
      <section
        style={{ ...tile, minWidth: 0 }}
      >
        <div className="p-4 sm:p-6" style={{ minWidth: 0, overflowX: 'auto' }}>
          {activeTab === "compliance" && (
            <ComplianceSummaryTab
            rows={filteredComplianceRows}
            scholars={complianceRows}
            loading={complianceLoading}
            error={complianceError}
              genOptions={genOptions}
              setGenOptions={setGenOptions}
              genLoading={genLoading}
              genError={genError}
              onGenerate={handleGenerateReport}
              onExportExcel={handleExportSummaryExcel}
              onRefresh={fetchCompliance}
              assignedYearLevels={assignedYearLevels}
            />
          )}

          {activeTab === "monthly-reports" && (
            <MonthlyReportsTab assignedYearLevels={assignedYearLevels} />
          )}

        </div>
      </section>

    </div>
  );
}