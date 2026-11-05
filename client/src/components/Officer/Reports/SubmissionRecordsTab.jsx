import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Download, FileText, Search, Users, AlertCircle, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { API_BASE, authHeaders } from "./ReportsHelpers";
import { downloadReportSummaryPdf } from "../../../utils/reportPdfExport";
import { formatYearLevelLabel } from "../../../utils/yearLevelLabels";
import { readOfficerWorkPreferences } from "../../../utils/officerWorkPreferences";
import FilePreviewModal from "../ManualValidation/FilePreviewModal";

const MAROON = "#6D2140";
const DEEP = "#6D2140";
const BG = "#F7F4EE";
const CARD = "#FFFDF9";
const RULE = "#E5D8CA";
const INK = "#241512";
const MUTED = "#8A7A68";
const SAGE = "#6B8F71";
const AMBER = "#C08A3E";
const CLAY = "#A24A4A";
const TYPE_OPTIONS = [
  { value: "all", label: "All Submission Types" },
  { value: "letter", label: "Monthly Letter" },
  { value: "grades", label: "Grades" },
  { value: "cor", label: "COR" },
  { value: "other", label: "Other Documents" },
];

const body = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };
const display = { fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif" };
const surface = { background: CARD, border: `1px solid ${RULE}`, borderRadius: 16, boxShadow: "0 1px 2px rgba(36,21,18,0.04)" };
const labelStyle = { ...body, display: "block", fontSize: "0.72rem", fontWeight: 700, color: MAROON, marginBottom: 6 };
const fieldStyle = { width: "100%", height: 44, padding: "0 14px", border: `1px solid ${RULE}`, borderRadius: 12, background: "#fff", ...body, fontSize: "0.85rem", color: INK, outline: "none" };
const statusInfo = row => {
  const value = String(row.status || row.qualityStatus || "pending").toLowerCase().replace(/_/g, "-");
  if (value === "not-submitted") return { label: "Not Submitted", color: CLAY, bg: `${CLAY}18` };
  if (["approved", "archived", "accepted"].includes(value)) return { label: "Accepted", color: SAGE, bg: `${SAGE}18` };
  if (["returned", "rejected", "high-risk", "needs-revision"].includes(value)) return { label: "Needs Revision", color: CLAY, bg: `${CLAY}18` };
  if (["medium-risk", "for-review"].includes(value)) return { label: "For Review", color: AMBER, bg: `${AMBER}18` };
  return { label: "Pending", color: AMBER, bg: `${AMBER}18` };
};

const periodLabel = value => {
  if (!value) return "—";
  const date = new Date(`${value}-01T00:00:00`);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

const dateLabel = value => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

const getPreviewKind = filePath => {
  const extension = String(filePath || "").split(/[?#]/, 1)[0].split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(extension)) return "image";
  if (extension === "pdf") return "pdf";
  if (["doc", "docx"].includes(extension)) return "doc";
  return "other";
};

export default function SubmissionRecordsTab({ assignedYearLevels = [], assignedYearLevelsLoading = false }) {
  const [workPreferences] = useState(readOfficerWorkPreferences);
  const pageSize = workPreferences.pageSize;
  const [records, setRecords] = useState([]);
  const [documentType, setDocumentType] = useState("all");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [yearLevel, setYearLevel] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [error, setError] = useState("");
  const [filePreview, setFilePreview] = useState(null);

  useEffect(() => {
    let active = true;
    const loadRecords = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await axios.get(`${API_BASE}/officer/reports/submission-records`, {
          ...authHeaders(),
          params: { document_type: documentType, month: month || undefined, year_level: yearLevel || undefined },
        });
        if (!active) return;
        setRecords(Array.isArray(response.data?.records) ? response.data.records : []);
      } catch (loadError) {
        if (!active) return;
        console.error("Could not load officer submission records:", loadError);
        setError(loadError.response?.data?.error || "Failed to load submission records. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadRecords();
    return () => { active = false; };
  }, [documentType, month, yearLevel]);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return records.filter(row => {
      const status = statusInfo(row).label.toLowerCase();
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (!normalizedSearch) return true;
      return [row.scholarName, row.scholarId, row.requirement, row.yearLevel]
        .some(value => String(value || "").toLowerCase().includes(normalizedSearch));
    });
  }, [records, search, statusFilter]);

  const submittedRecords = records.filter(row => !row.isMissing);
  const acceptedCount = submittedRecords.filter(row => statusInfo(row).label === "Accepted").length;
  const notSubmitted = records.filter(row => row.isMissing).length;
  const totalApplicableRequirements = submittedRecords.length + notSubmitted;
  const complianceRate = totalApplicableRequirements
    ? Math.round((acceptedCount / totalApplicableRequirements) * 100)
    : 0;
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageRows = filteredRecords.slice(start, start + pageSize);

  const handleExport = () => {
    const rows = [
      ["Scholar Name", "Student ID", "Year Level", "Requirement", "Period", "Submitted Date", "Status"],
      ...filteredRecords.map(row => [
        row.scholarName,
        row.scholarId,
        row.yearLevel,
        row.requirement,
        periodLabel(row.period || row.submittedAt?.slice(0, 7)),
        dateLabel(row.submittedAt),
        statusInfo(row).label,
      ]),
    ];
    const csv = `\uFEFF${rows.map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `officer-submission-records-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDownloadPdf = async () => {
    setGeneratingPdf(true);
    setError("");
    try {
      await downloadReportSummaryPdf({
        role: "officer",
        reportTitle: "Submission Records",
        periodLabel: month ? periodLabel(month) : "All months",
        reportType: "Submission Records",
        endorsedTo: [],
        rows: filteredRecords.map(row => ({
          scholarName: row.scholarName,
          studentId: row.scholarId,
          yearLevel: row.yearLevel,
          requirement: row.requirement,
          period: periodLabel(row.period || row.submittedAt?.slice(0, 7)),
          submittedAt: row.submittedAt,
          reviewStatus: statusInfo(row).label,
        })),
      });
    } catch (downloadError) {
      console.error("Could not download submission records PDF:", downloadError);
      setError(downloadError.response?.data?.error || "Failed to download the PDF. Please try again.");
    } finally {
      setGeneratingPdf(false);
      setExportOpen(false);
    }
  };

  const handleViewFile = row => {
    if (!row.filePath) return;
    setError("");
    const query = new URLSearchParams({ url: row.filePath });
    setFilePreview({
      url: `${API_BASE}/submission/preview?${query.toString()}`,
      label: `${row.scholarName} - ${row.requirement}`,
      kind: getPreviewKind(row.filePath),
    });
  };

  const statCards = [
    { label: "Total Submissions", value: submittedRecords.length, note: "Approved submissions for selected filters", Icon: FileText, color: DEEP },
    { label: "Accepted", value: acceptedCount, note: totalApplicableRequirements ? `${Math.round((acceptedCount / totalApplicableRequirements) * 100)}% of applicable requirements` : "No requirements due", Icon: CheckCircle2, color: SAGE },
    { label: "Not Submitted", value: notSubmitted, note: "Past-due requirements without a submission", Icon: AlertTriangle, color: CLAY },
    { label: "Submission Rate", value: `${complianceRate}%`, note: `${acceptedCount} of ${totalApplicableRequirements} applicable requirements`, Icon: Users, color: AMBER },
  ];

  const requirementColors = {
    "Monthly Letter": { color: "#7A2B4D", background: "#F6E6EC" },
    Grades: { color: "#62508A", background: "#EDE8F6" },
    COR: { color: "#3E5F86", background: "#E6EEF7" },
    "Other Documents": { color: "#5E5A55", background: "#ECEAE6" },
  };
  const tableHeader = { ...body, fontSize: "0.74rem", fontWeight: 700, color: INK, textAlign: "left", padding: workPreferences.density === "compact" ? "8px 10px" : "12px 14px", whiteSpace: "nowrap", borderBottom: `1px solid ${RULE}`, background: BG };
  const tableCell = { ...body, fontSize: "0.82rem", color: INK, padding: workPreferences.density === "compact" ? "7px 9px" : "12px 14px", whiteSpace: "nowrap", borderBottom: `1px solid ${RULE}66` };

  return (
    <div className="flex flex-col gap-5" style={{ minWidth: 0 }}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, note, Icon, color }) => (
          <div key={label} className="flex items-center gap-3.5" style={{ ...surface, padding: "14px 18px" }}>
            <span className="flex shrink-0 items-center justify-center rounded-full" style={{ width: 44, height: 44, background: `${color}1f`, color }}>
              <Icon size={20} />
            </span>
            <div className="min-w-0">
              <p style={{ ...body, color: INK, fontSize: "0.82rem", fontWeight: 600 }}>{label}</p>
              <p style={{ ...display, color: MAROON, fontSize: "1.7rem", fontWeight: 600, lineHeight: 1.15 }}>{value}</p>
              <p style={{ ...body, color: MUTED, fontSize: "0.78rem" }}>{note}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid items-end gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.5fr_auto_auto]" style={surface}>
        <div>
          <label style={labelStyle}>Document Type</label>
          <select value={documentType} onChange={event => { setPage(1); setDocumentType(event.target.value); }} style={{ ...fieldStyle, cursor: "pointer" }}>
            {TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="submission-records-month" style={labelStyle}>Filter by Month</label>
          <input
            id="submission-records-month"
            type="month"
            value={month}
            onChange={event => { setPage(1); setMonth(event.target.value); }}
            style={{ ...fieldStyle, minWidth: 0, cursor: "pointer" }}
          />
        </div>
        <div>
          <label style={labelStyle}>Year Level</label>
          <select
            value={yearLevel}
            onChange={event => { setPage(1); setYearLevel(event.target.value); }}
            disabled={assignedYearLevelsLoading || assignedYearLevels.length === 0}
            style={{ ...fieldStyle, cursor: assignedYearLevelsLoading || assignedYearLevels.length === 0 ? "not-allowed" : "pointer", opacity: assignedYearLevelsLoading ? 0.7 : 1 }}
          >
            <option value="">
              {assignedYearLevelsLoading ? "Loading assigned year levels..." : assignedYearLevels.length ? "All Assigned Year Levels" : "No Assigned Year Levels"}
            </option>
            {assignedYearLevels.map(level => <option key={level} value={level}>{formatYearLevelLabel(level)}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select value={statusFilter} onChange={event => { setPage(1); setStatusFilter(event.target.value); }} style={{ ...fieldStyle, cursor: "pointer" }}>
            <option value="all">All Statuses</option>
            <option value="accepted">Accepted</option>
            <option value="not submitted">Not Submitted</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Search Scholar</label>
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
            <input value={search} onChange={event => { setPage(1); setSearch(event.target.value); }} placeholder="Search scholar name or ID..." style={{ ...fieldStyle, paddingLeft: 38 }} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={generatingPdf || filteredRecords.length === 0}
            className="inline-flex items-center justify-center gap-2"
            style={{
              ...body,
              height: 44,
              padding: "0 16px",
              border: `1px solid ${MAROON}`,
              borderRadius: 12,
              color: "#fff",
              background: MAROON,
              fontSize: "0.82rem",
              fontWeight: 700,
              whiteSpace: "nowrap",
              cursor: generatingPdf ? "wait" : "pointer",
              opacity: generatingPdf || filteredRecords.length === 0 ? 0.65 : 1,
            }}
          >
            <FileText size={15} /> {generatingPdf ? "Generating PDF..." : "Download PDF"}
          </button>

          <div style={{ position: "relative" }}>
            <button type="button" onClick={() => setExportOpen(value => !value)} style={{ ...body, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, height: 44, padding: "0 18px", border: `1px solid ${MAROON}`, borderRadius: 12, color: "#fff", background: MAROON, fontSize: "0.82rem", fontWeight: 700, whiteSpace: "nowrap", cursor: "pointer" }}>
              <Download size={15} /> Export
            </button>
            {exportOpen && (
              <>
                <div onClick={() => setExportOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
                <div role="menu" style={{ ...surface, position: "absolute", right: 0, top: "calc(100% + 6px)", minWidth: 180, zIndex: 31, boxShadow: "0 10px 24px -10px rgba(36,21,18,0.25)", padding: 6 }}>
                  <button type="button" disabled={generatingPdf || filteredRecords.length === 0} onClick={() => { setExportOpen(false); handleDownloadPdf(); }} style={{ ...body, width: "100%", textAlign: "left", border: "none", background: "transparent", padding: "9px 10px", borderRadius: 8, color: INK, fontSize: "0.82rem", cursor: generatingPdf || filteredRecords.length === 0 ? "not-allowed" : "pointer", opacity: generatingPdf || filteredRecords.length === 0 ? 0.55 : 1 }}><span className="inline-flex items-center gap-2"><FileText size={14} /> Download PDF</span></button>
                  <button type="button" onClick={() => { setExportOpen(false); handleExport(); }} style={{ ...body, width: "100%", textAlign: "left", border: "none", background: "transparent", padding: "9px 10px", borderRadius: 8, color: INK, fontSize: "0.82rem", cursor: "pointer" }}><span className="inline-flex items-center gap-2"><Download size={14} /> Download CSV</span></button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <section style={{ ...surface, padding: "16px", minWidth: 0 }}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 style={{ ...display, color: INK, fontSize: "1.2rem", fontWeight: 600 }}>Submission Records</h2>
            <p style={{ ...body, color: MUTED, fontSize: "0.78rem", marginTop: 2 }}>List of scholars and their submitted requirements.</p>
          </div>
        </div>

        {error && <div role="alert" className="mb-3 flex items-center gap-2" style={{ ...body, padding: "10px 12px", borderRadius: 8, color: CLAY, background: `${CLAY}12`, fontSize: "0.78rem" }}><AlertCircle size={15} />{error}</div>}

        {loading ? (
          <div className="animate-pulse overflow-hidden" style={{ border: `1px solid ${RULE}`, borderRadius: 12, padding: 12 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{ height: 38, borderRadius: 8, background: "#F2E9DC", marginBottom: 8 }} />
            ))}
          </div>
        ) : pageRows.length ? (
          <div className="overflow-x-auto" style={{ border: `1px solid ${RULE}`, borderRadius: 12 }}>
            <table className="w-full" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["#", "Scholar Name", "Student ID", "Year Level", "Requirement", "Period", "Submitted Date", "Status", "Action"].map(label => (
                    <th key={label} style={label === "Action" ? { ...tableHeader, textAlign: "center" } : tableHeader}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, index) => {
                  const status = statusInfo(row);
                  const requirement = requirementColors[row.requirement] || requirementColors["Other Documents"];
                  return (
                    <tr key={row.id || `${row.scholarId}-${row.requirement}-${index}`}>
                      <td style={tableCell}>{start + index + 1}</td>
                      <td style={{ ...tableCell, fontWeight: 600 }}>{row.scholarName || "Unknown Scholar"}</td>
                      <td style={tableCell}>{row.scholarId || "—"}</td>
                      <td style={tableCell}>{formatYearLevelLabel(row.yearLevel || "—")}</td>
                      <td style={tableCell}>
                        <span style={{ ...body, fontSize: "0.74rem", fontWeight: 600, color: requirement.color, background: requirement.background, borderRadius: 8, padding: "4px 10px" }}>{row.requirement || "Other Documents"}</span>
                      </td>
                      <td style={tableCell}>{periodLabel(row.period || row.submittedAt?.slice(0, 7))}</td>
                      <td style={tableCell}>{dateLabel(row.submittedAt)}</td>
                      <td style={tableCell}>
                        <span style={{ ...body, fontSize: "0.74rem", fontWeight: 600, color: status.color, background: status.bg, borderRadius: 8, padding: "4px 10px" }}>{status.label}</span>
                      </td>
                      <td style={{ ...tableCell, textAlign: "center" }}>
                        {row.filePath ? (
                          <button type="button" onClick={() => handleViewFile(row)} style={{ ...body, fontSize: "0.76rem", fontWeight: 600, padding: "5px 12px", borderRadius: 8, cursor: "pointer", border: `1px solid ${MAROON}`, background: "#fff", color: MAROON }}>
                            View
                          </button>
                        ) : <span style={{ color: MUTED }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center" style={{ padding: "3rem 1rem", border: `1px dashed ${RULE}`, borderRadius: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: `${AMBER}18`, color: AMBER, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <Users size={24} />
            </div>
            <h3 style={{ ...display, fontSize: "1.1rem", color: INK }}>No submissions found</h3>
            <p style={{ ...body, fontSize: "0.84rem", color: MUTED, marginTop: 4 }}>Try changing or resetting the filters.</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-3">
          <span style={{ ...body, color: MUTED, fontSize: "0.74rem" }}>
            {filteredRecords.length ? `Showing ${start + 1}–${Math.min(start + pageSize, filteredRecords.length)} of ${filteredRecords.length} submissions` : "Showing 0 submissions"}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(value => Math.max(1, value - 1))} style={{ ...body, width: 32, height: 32, border: `1px solid ${RULE}`, borderRadius: 8, color: INK, background: CARD, opacity: currentPage === 1 ? 0.45 : 1, cursor: currentPage === 1 ? "default" : "pointer" }}><ChevronLeft size={15} /></button>
            <span style={{ ...body, color: DEEP, background: `${MAROON}18`, borderRadius: 8, minWidth: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700 }}>{currentPage}</span>
            <button type="button" aria-label="Next page" disabled={currentPage >= totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))} style={{ ...body, width: 32, height: 32, border: `1px solid ${RULE}`, borderRadius: 8, color: INK, background: CARD, opacity: currentPage >= totalPages ? 0.45 : 1, cursor: currentPage >= totalPages ? "default" : "pointer" }}><ChevronRight size={15} /></button>
          </div>
        </div>
      </section>
      {filePreview && <FilePreviewModal preview={filePreview} onClose={() => setFilePreview(null)} />}
    </div>
  );
}
