import { useState } from "react";
import { ChevronLeft, X, Image, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import ScoreRing from "../shared/ScoreRing";

const MAROON = "#802B36";
const MAROON_LIGHT = "#F5E8EA";

const scoreColor = (score) => {
  if (score >= 80) return "#16a34a";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
};

const reportStatusBadge = (status) => ({
  accepted: { bg: "#d1fae5", color: "#065f46", label: "Accepted", Icon: CheckCircle },
  "medium-risk": { bg: "#fef3c7", color: "#92400e", label: "Medium Risk", Icon: AlertTriangle },
  "high-risk": { bg: "#fee2e2", color: "#991b1b", label: "High Risk", Icon: XCircle },
})[status];

export default function AdminReportDetail({ report, onClose }) {
  const systemBadge = reportStatusBadge(report.status);
  const SystemIcon = systemBadge?.Icon || CheckCircle;
  const passedCount = (report.checklistResults || []).filter(c => c.passed).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div className="min-h-screen flex items-start justify-center p-4 pt-8 pb-12">
        <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ background: MAROON_LIGHT, borderBottom: "1px solid #f3d0d4" }}
          >
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                style={{
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: MAROON,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <span style={{ color: "#d1d5db" }}>|</span>
              <div>
                <p
                  style={{
                    fontFamily: "'Playfair Display',serif",
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    color: MAROON,
                  }}
                >
                  Monthly Report
                </p>
                <p
                  style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: "0.74rem",
                    color: "#9ca3af",
                  }}
                >
                  {report.scholarName} · {report.submittedAt}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {systemBadge && (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
                  style={{ background: systemBadge.bg }}
                >
                  <SystemIcon className="w-3.5 h-3.5" style={{ color: systemBadge.color }} />
                  <span
                    style={{
                      fontFamily: "'DM Sans',sans-serif",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: systemBadge.color,
                    }}
                  >
                    {systemBadge.label}
                  </span>
                </div>
              )}
              <button
                onClick={onClose}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#9ca3af",
                  padding: 4,
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* AI Quality bar */}
          <div className="px-6 py-4" style={{ background: "#1e2a3a" }}>
            <div className="flex items-center gap-5">
              <div className="relative flex-shrink-0" style={{ width: 56, height: 56 }}>
                <ScoreRing score={report.qualityScore || 0} size={56} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    style={{
                      fontFamily: "'DM Sans',sans-serif",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "#fff",
                    }}
                  >
                    {report.qualityScore || 0}
                  </span>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    style={{
                      fontFamily: "'DM Sans',sans-serif",
                      fontSize: "0.68rem",
                      fontWeight: 600,
                      color: "#94a3b8",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    AI Quality Score
                  </span>
                  <span
                    style={{
                      fontFamily: "'Playfair Display',serif",
                      fontSize: "1.1rem",
                      fontWeight: 700,
                      color: "#fff",
                    }}
                  >
                    {report.qualityScore || 0}/100
                  </span>
                </div>
                <div
                  style={{
                    height: 5,
                    background: "#334155",
                    borderRadius: 99,
                    overflow: "hidden",
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${report.qualityScore || 0}%`,
                      background: scoreColor(report.qualityScore || 0),
                      borderRadius: 99,
                    }}
                  />
                </div>
                <div className="flex items-center gap-4">
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.7rem", color: "#64748b" }}>
                    Report: <strong style={{ color: "#94a3b8" }}>{report.reportScore || "—"}</strong>
                  </span>
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.7rem", color: "#64748b" }}>
                    Media: <strong style={{ color: "#94a3b8" }}>{report.mediaScore || "—"}</strong>
                  </span>
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.7rem", color: "#64748b" }}>
                    Checklist: <strong style={{ color: "#94a3b8" }}>
                      {passedCount}/{(report.checklistResults || []).length} passed
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Two-column body */}
          <div className="grid" style={{ gridTemplateColumns: "1fr 230px", maxHeight: "44vh", overflow: "hidden" }}>
            {/* Left — letter */}
            <div className="overflow-y-auto" style={{ borderRight: "1px solid #f3f4f6" }}>
              <div className="text-center pt-7 pb-4 px-8" style={{ borderBottom: "1px solid #f5f5f5" }}>
                <p
                  style={{
                    fontFamily: "'Playfair Display',serif",
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    color: MAROON,
                  }}
                >
                  Kalinga at Pag-ibig Foundation Inc.
                </p>
                <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.76rem", color: "#9ca3af", marginTop: 2 }}>
                  Apple Scholars · Rodriguez, Rizal
                </p>
              </div>

              <div
                className="grid grid-cols-2 gap-0 mx-8 my-4 rounded-xl overflow-hidden"
                style={{ border: "1px solid #f3f4f6" }}
              >
                {[
                  ["Name", report.scholarName],
                  ["Age", `${report.age} years old`],
                  ["Year", report.year],
                  ["Course", report.course],
                  ["School", report.school],
                  ["Date", report.date],
                ].map(([label, value], i) => (
                  <div
                    key={i}
                    className="px-4 py-2.5"
                    style={{
                      borderRight: i % 2 === 0 ? "1px solid #f3f4f6" : "none",
                      borderBottom: i < 4 ? "1px solid #f3f4f6" : "none",
                      background: i % 2 === 0 ? "#fafafa" : "#fff",
                    }}
                  >
                    <p
                      style={{
                        fontFamily: "'DM Sans',sans-serif",
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        color: "#9ca3af",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        marginBottom: 2,
                      }}
                    >
                      {label}
                    </p>
                    <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.8rem", fontWeight: 600, color: "#374151" }}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="px-8 pb-4">
                <p
                  style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: "0.88rem",
                    lineHeight: 1.8,
                    color: "#374151",
                    marginBottom: 14,
                  }}
                >
                  Dear Kalinga,
                </p>
                {(report.body || "")
                  .split(/\n\n+/)
                  .filter(p => p.trim())
                  .map((para, i) => (
                    <p
                      key={i}
                      style={{
                        fontFamily: "'DM Sans',sans-serif",
                        fontSize: "0.88rem",
                        lineHeight: 1.8,
                        color: "#374151",
                        marginBottom: 12,
                        textIndent: "2rem",
                      }}
                    >
                      {para.trim()}
                    </p>
                  ))}
                <p
                  style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: "0.88rem",
                    color: "#374151",
                    marginTop: 20,
                    marginBottom: 2,
                  }}
                >
                  Your scholar,
                </p>
                <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.88rem", fontWeight: 700, color: "#1a1a1a" }}>
                  {report.scholarName}
                </p>
              </div>

              {report.photos?.length > 0 ? (
                <div className="px-8 pb-6" style={{ borderTop: "1px solid #f5f5f5" }}>
                  <div className="flex items-center gap-2 mt-4 mb-3">
                    <Image className="w-3.5 h-3.5" style={{ color: MAROON }} />
                    <p
                      style={{
                        fontFamily: "'Playfair Display',serif",
                        fontSize: "0.88rem",
                        fontWeight: 700,
                        color: "#1a1a1a",
                      }}
                    >
                      Documentation ({report.photos.length})
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {report.photos.map((photo, i) => (
                      <div key={i}>
                        <div className="rounded-lg overflow-hidden" style={{ height: 100, border: "1px solid #f0f0f0" }}>
                          <img src={photo.url} alt="" className="w-full h-full object-cover" />
                        </div>
                        <p
                          style={{
                            fontFamily: "'DM Sans',sans-serif",
                            fontSize: "0.7rem",
                            color: "#6b7280",
                            marginTop: 3,
                            textAlign: "center",
                            fontStyle: "italic",
                            lineHeight: 1.4,
                          }}
                        >
                          ({photo.description || "No description"})
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  className="mx-8 mb-5 rounded-xl p-3 flex items-center gap-2"
                  style={{ background: "#fef9ee", border: "1px solid #fde68a" }}
                >
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#d97706" }} />
                  <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.76rem", color: "#92400e" }}>
                    No documentation photos attached.
                  </p>
                </div>
              )}

              <div className="mx-8 mb-4 pt-2 flex justify-between" style={{ borderTop: "1px solid #f5f5f5" }}>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.68rem", color: "#d1d5db" }}>
                  Page 1 / Apple Scholar
                </span>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.68rem", color: "#d1d5db" }}>
                  {report.date}
                </span>
              </div>
            </div>

            {/* Right — AI evaluation */}
            <div className="overflow-y-auto p-4" style={{ background: "#f9fafb" }}>
              <p
                style={{
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: "0.67rem",
                  fontWeight: 700,
                  color: "#374151",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  marginBottom: 8,
                }}
              >
                AI Scores
              </p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { label: "Report", value: report.reportScore || 0 },
                  { label: "Media", value: report.mediaScore || 0 },
                ].map(s => (
                  <div
                    key={s.label}
                    className="rounded-lg p-2.5 text-center"
                    style={{ background: "#fff", border: "1px solid #e5e7eb" }}
                  >
                    <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.66rem", color: "#9ca3af", marginBottom: 2 }}>
                      {s.label}
                    </p>
                    <p
                      style={{
                        fontFamily: "'Playfair Display',serif",
                        fontSize: "1.1rem",
                        fontWeight: 700,
                        color: scoreColor(s.value),
                      }}
                    >
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
              <p
                style={{
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: "0.67rem",
                  fontWeight: 700,
                  color: "#374151",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  marginBottom: 7,
                }}
              >
                Checklist
              </p>
              <div className="space-y-1">
                {(report.checklistResults || []).map((c, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-1.5 rounded-md px-2 py-1.5"
                    style={
                      c.passed
                        ? { background: "#f0fdf4", border: "1px solid #bbf7d0" }
                        : { background: "#fef2f2", border: "1px solid #fecaca" }
                    }
                  >
                    {c.passed ? (
                      <CheckCircle className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: "#16a34a" }} />
                    ) : (
                      <XCircle className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: "#ef4444" }} />
                    )}
                    <span
                      style={{
                        fontFamily: "'DM Sans',sans-serif",
                        fontSize: "0.69rem",
                        color: c.passed ? "#16a34a" : "#ef4444",
                        lineHeight: 1.4,
                      }}
                    >
                      {c.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
