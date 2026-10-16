import { X, Image as ImageIcon, ImageOff, AlertTriangle, CheckCircle, XCircle, Sparkles, ClipboardCheck } from "lucide-react";
import ScoreRing from "../../shared/ScoreRing";

// ── Design tokens — "Apple Scholar Executive" system (matches AdminDonorPage / AdminReports) ──
const BG = "#F7F4EE";
const SURFACE = "#FFFDF9";
const BORDER = "#E5D8CA";
const PRIMARY = "#6D2140";
const PRIMARY_DEEP = "#4A1730";
const BRONZE = "#A9784E";
const INK = "#241512";
const MUTED = "#8A7A68";
const SUCCESS = "#6B8F71";
const SUCCESS_BG = "#EAF3EB";
const WARNING = "#C08A3E";
const WARNING_BG = "#FBF1DF";
const DANGER = "#A24A4A";
const DANGER_BG = "#FBEAE8";
const RADIUS = 16;

const display = { fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };

const scoreColor = (score) => {
  if (score >= 80) return SUCCESS;
  if (score >= 60) return WARNING;
  return DANGER;
};

// Labels match the Compliance Reports table and summary cards.
const reportStatusBadge = (status) => ({
  accepted: { bg: SUCCESS_BG, color: SUCCESS, label: "Accepted", Icon: CheckCircle },
  "medium-risk": { bg: WARNING_BG, color: WARNING, label: "For Review", Icon: AlertTriangle },
  "high-risk": { bg: DANGER_BG, color: DANGER, label: "Needs Revision", Icon: XCircle },
})[status];

const recommendationCopy = (status) => ({
  accepted: { title: "Ready for approval", detail: "This report meets quality and compliance standards. It can be approved as submitted." },
  "medium-risk": { title: "Requires staff verification", detail: "Some checklist items need a closer look before this report is finalized." },
  "high-risk": { title: "Needs immediate revision", detail: "This report did not meet minimum quality standards and should be sent back to the scholar." },
}[status] || { title: "Awaiting evaluation", detail: "No system recommendation is available for this report yet." });

const InfoCard = ({ label, value }) => (
  <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "0.7rem 0.9rem" }}>
    <p style={{ ...body, fontSize: "0.64rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>
      {label}
    </p>
    <p style={{ ...body, fontSize: "0.86rem", fontWeight: 600, color: INK }}>{value || "—"}</p>
  </div>
);

const StatChip = ({ label, value }) => (
  <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "0.7rem", textAlign: "center" }}>
    <p style={{ ...body, fontSize: "0.62rem", color: MUTED, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
    <p style={{ ...display, fontSize: "1.15rem", fontWeight: 700, color: scoreColor(value) }}>{value || 0}</p>
  </div>
);

export default function AdminReportDetail({ report, onClose }) {
  const systemBadge = reportStatusBadge(report.status);
  const SystemIcon = systemBadge?.Icon || CheckCircle;
  const checklist = report.checklistResults || [];
  const passedCount = checklist.filter((c) => c.passed).length;
  const recommendation = recommendationCopy(report.status);
  const quality = report.qualityScore || 0;
  const scholarIdValue = report.scholarId || report.studentId || report.scholar_id;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "rgba(36,21,18,0.55)" }}>
      <div className="min-h-screen flex items-start justify-center p-4 py-8">
        <div
          className="w-full flex flex-col"
          style={{
            maxWidth: 1280,
            maxHeight: "90vh",
            background: SURFACE,
            borderRadius: 18,
            boxShadow: "0 24px 60px -20px rgba(36,21,18,0.35)",
            overflow: "hidden",
          }}
        >
          {/* ── Header ── */}
          <div
            className="flex items-start justify-between gap-4 flex-wrap"
            style={{ padding: "1.4rem 1.8rem", borderBottom: `1px solid ${BORDER}`, background: BG, flexShrink: 0 }}
          >
            <div>
              <p style={{ ...body, color: BRONZE, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Admin Report Review
              </p>
              <h1 style={{ ...display, fontSize: "1.55rem", color: INK, marginTop: 4 }}>Monthly Scholar Report</h1>
              <p style={{ ...body, fontSize: "0.84rem", color: MUTED, marginTop: 4 }}>
                {report.scholarName}
                {scholarIdValue ? ` · ID ${scholarIdValue}` : ""}
                {report.submittedAt ? ` · Submitted ${report.submittedAt}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              {systemBadge && (
                <div
                  className="flex items-center gap-1.5"
                  style={{ background: systemBadge.bg, borderRadius: 999, padding: "6px 14px" }}
                >
                  <SystemIcon size={14} color={systemBadge.color} />
                  <span style={{ ...body, fontSize: "0.76rem", fontWeight: 700, color: systemBadge.color }}>
                    {systemBadge.label}
                  </span>
                </div>
              )}
              <button
                onClick={onClose}
                aria-label="Close"
                style={{
                  width: 34, height: 34, borderRadius: "50%", border: `1px solid ${BORDER}`, background: "#fff",
                  color: MUTED, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* ── Two-column body ── */}
          <div className="flex flex-col lg:flex-row flex-1" style={{ minHeight: 0, overflow: "hidden" }}>
            {/* LEFT — report document (~68%) */}
            <div className="overflow-y-auto lg:w-[68%] md:w-[60%] w-full" style={{ borderRight: `1px solid ${BORDER}` }}>
              <div className="px-6 sm:px-9 pt-8 pb-6">
                {/* Scholar information cards */}
                <div className="grid grid-cols-2 gap-3 mb-8">
                  <InfoCard label="Name" value={report.scholarName} />
                  <InfoCard label="Age" value={report.age ? `${report.age} years old` : null} />
                  <InfoCard label="Year" value={report.year} />
                  <InfoCard label="Course" value={report.course} />
                  <InfoCard label="School" value={report.school} />
                  <InfoCard label="Report Date" value={report.date} />
                </div>

                {/* Report body — reading document */}
                <div
                  style={{
                    background: BG, border: `1px solid ${BORDER}`, borderRadius: RADIUS,
                    padding: "1.8rem 2rem",
                  }}
                >
                  <p style={{ ...body, fontSize: "0.72rem", fontWeight: 700, color: BRONZE, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>
                    Kalinga at Pag-ibig Foundation Inc. · Apple Scholars, Rodriguez, Rizal
                  </p>

                  <p style={{ ...body, fontSize: "0.98rem", lineHeight: 1.9, color: INK, marginBottom: 16 }}>
                    Dear Kalinga,
                  </p>
                  {(report.body || "")
                    .split(/\n\n+/)
                    .filter((p) => p.trim())
                    .map((para, i) => (
                      <p key={i} style={{ ...body, fontSize: "0.98rem", lineHeight: 1.9, color: INK, marginBottom: 14, textIndent: "2rem" }}>
                        {para.trim()}
                      </p>
                    ))}
                  <p style={{ ...body, fontSize: "0.95rem", color: INK, marginTop: 24, marginBottom: 3 }}>
                    Your scholar,
                  </p>
                  <p style={{ ...display, fontSize: "1.05rem", fontWeight: 700, color: PRIMARY_DEEP }}>
                    {report.scholarName}
                  </p>
                </div>

                {/* Documentation photos — masonry */}
                <div className="mt-8">
                  <div className="flex items-center gap-2 mb-4">
                    <ImageIcon size={16} color={PRIMARY} />
                    <h3 style={{ ...display, fontSize: "1.05rem", color: INK }}>
                      Documentation {report.photos?.length > 0 ? `(${report.photos.length})` : ""}
                    </h3>
                  </div>

                  {report.photos?.length > 0 ? (
                    <div style={{ columnCount: 2, columnGap: 14 }} className="sm:[column-count:3]">
                      {report.photos.map((photo, i) => (
                        <figure key={i} style={{ margin: "0 0 14px", breakInside: "avoid" }}>
                          <div
                            style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${BORDER}` }}
                          >
                            <img
                              src={photo.url}
                              alt={photo.description || ""}
                              style={{
                                width: "100%", display: "block", transition: "transform 0.25s ease",
                                cursor: "zoom-in",
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                            />
                          </div>
                          <figcaption style={{ ...body, fontSize: "0.74rem", color: MUTED, marginTop: 6, fontStyle: "italic", textAlign: "center" }}>
                            {photo.description || "No description"}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  ) : (
                    <div
                      className="flex flex-col items-center text-center"
                      style={{ background: BG, border: `1px dashed ${BORDER}`, borderRadius: RADIUS, padding: "2rem 1rem" }}
                    >
                      <div
                        style={{
                          width: 44, height: 44, borderRadius: "50%", background: `${PRIMARY}12`,
                          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10, color: PRIMARY,
                        }}
                      >
                        <ImageOff size={20} />
                      </div>
                      <p style={{ ...body, fontSize: "0.84rem", color: MUTED }}>No documentation photos attached.</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-between mt-8 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
                  <span style={{ ...body, fontSize: "0.7rem", color: MUTED }}>Apple Scholar Foundation</span>
                  <span style={{ ...body, fontSize: "0.7rem", color: MUTED }}>{report.date}</span>
                </div>
              </div>
            </div>

            {/* RIGHT — AI evaluation panel (~32%) */}
            <div
              className="overflow-y-auto lg:w-[32%] md:w-[40%] w-full"
              style={{ background: BG, flexShrink: 0 }}
            >
              <div className="p-5 sm:p-6">
                {/* Score ring */}
                <div className="flex flex-col items-center text-center mb-6">
                  <div style={{ position: "relative", width: 96, height: 96 }}>
                    <ScoreRing score={quality} size={96} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span style={{ ...display, fontSize: "1.5rem", fontWeight: 700, color: INK }}>{quality}</span>
                    </div>
                  </div>
                  <p style={{ ...body, fontSize: "0.68rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 10 }}>
                    AI Quality Score
                  </p>
                  <div style={{ width: "100%", height: 6, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 99, overflow: "hidden", marginTop: 10 }}>
                    <div style={{ height: "100%", width: `${quality}%`, background: scoreColor(quality), borderRadius: 99 }} />
                  </div>
                </div>

                {/* AI breakdown */}
                <p style={{ ...body, fontSize: "0.66rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  AI Breakdown
                </p>
                <div className="grid grid-cols-3 gap-2 mb-6">
                  <StatChip label="Report" value={report.reportScore || 0} />
                  <StatChip label="Media" value={report.mediaScore || 0} />
                  <StatChip label="Checklist" value={checklist.length ? Math.round((passedCount / checklist.length) * 100) : 0} />
                </div>
                <p style={{ ...body, fontSize: "0.68rem", color: MUTED, marginTop: -14, marginBottom: 18 }}>
                  {passedCount}/{checklist.length} checklist items passed
                </p>

                {/* Checklist validation */}
                <div className="flex items-center gap-2 mb-3">
                  <ClipboardCheck size={15} color={PRIMARY} />
                  <p style={{ ...body, fontSize: "0.78rem", fontWeight: 700, color: INK }}>Checklist Validation</p>
                </div>
                <div className="flex flex-col gap-1.5 mb-6">
                  {checklist.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2"
                      style={{
                        borderRadius: 10, padding: "8px 10px",
                        background: c.passed ? SUCCESS_BG : DANGER_BG,
                      }}
                    >
                      {c.passed ? (
                        <CheckCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} color={SUCCESS} />
                      ) : (
                        <XCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} color={DANGER} />
                      )}
                      <span style={{ ...body, fontSize: "0.76rem", color: c.passed ? SUCCESS : DANGER, lineHeight: 1.4 }}>
                        {c.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* System recommendation */}
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={15} color={BRONZE} />
                  <p style={{ ...body, fontSize: "0.78rem", fontWeight: 700, color: INK }}>System Recommendation</p>
                </div>
                <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: "0.9rem 1rem" }}>
                  <p style={{ ...display, fontSize: "0.95rem", color: INK, marginBottom: 4 }}>{recommendation.title}</p>
                  <p style={{ ...body, fontSize: "0.78rem", color: MUTED, lineHeight: 1.5 }}>{recommendation.detail}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div
            className="flex items-center justify-between gap-3 flex-wrap"
            style={{ padding: "1rem 1.8rem", borderTop: `1px solid ${BORDER}`, background: SURFACE, flexShrink: 0 }}
          >
            <span style={{ ...body, fontSize: "0.76rem", color: MUTED }}>Report generated by Apple Scholar</span>
            <div className="flex items-center gap-2.5">
              <button
                onClick={onClose}
                style={{
                  ...body, fontSize: "0.82rem", fontWeight: 600, color: MUTED,
                  border: `1px solid ${BORDER}`, borderRadius: 10, padding: "9px 18px",
                  background: "#fff", cursor: "pointer",
                }}
              >
                Close
              </button>
              <button
                disabled
                title="Coming soon"
                style={{
                  ...body, fontSize: "0.82rem", fontWeight: 600, color: "#fff",
                  border: "none", borderRadius: 10, padding: "9px 18px",
                  background: PRIMARY, opacity: 0.45, cursor: "not-allowed",
                }}
              >
                Review
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}