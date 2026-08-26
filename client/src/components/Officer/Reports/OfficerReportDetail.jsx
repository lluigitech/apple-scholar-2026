import { useState } from "react";
import {
  ChevronLeft, X, Image, AlertTriangle, MessageSquare,
  ThumbsUp, ThumbsDown, Send, CheckCircle, XCircle, Loader2,
} from "lucide-react";
import ScoreRing from "../../Shared/ScoreRing";
import { MAROON, ROSE, PAPER, RULE, INK, SAGE, CLAY, AMBER, serif, sans, mono, scoreColor, reportStatusBadge, staffActionBadge } from "./ReportsHelpers";

export default function OfficerReportDetail({ report, onClose, onAction, actionSaving }) {
  const [feedback, setFeedback] = useState(report.staffFeedback || "");
  const [confirmAction, setConfirmAction] = useState(null);
  const [showFeedbackBox, setShowFeedbackBox] = useState(!!report.staffFeedback);

  const systemBadge = reportStatusBadge(report.status);
  const SystemIcon = systemBadge.Icon;
  const staffBadge = report.staffAction ? staffActionBadge(report.staffAction) : null;
  const StaffIcon = staffBadge?.Icon;
  const passedCount = (report.checklistResults || []).filter(c => c.passed).length;
  const qualityScore = Number(report.qualityScore) || 0;

  const handleConfirm = () => {
    if (!confirmAction) return;
    onAction(report.id, confirmAction, feedback);
    setConfirmAction(null);
  };

  const actionConfig = {
    approved: {
      label: "Approve Report",
      sublabel: "This will mark the report as officially approved and notify the scholar.",
      confirmLabel: "Yes, Approve",
      bg: SAGE, lightBg: `${SAGE}14`, border: `${SAGE}55`, color: SAGE,
    },
    rejected: {
      label: "Reject Report",
      sublabel: "This will reject the report. Scholar will be notified to re-submit.",
      confirmLabel: "Yes, Reject",
      bg: CLAY, lightBg: `${CLAY}14`, border: `${CLAY}55`, color: CLAY,
    },
    "needs-revision": {
      label: "Request Revision",
      sublabel: "Scholar will be asked to revise and resubmit their report.",
      confirmLabel: "Yes, Request Revision",
      bg: AMBER, lightBg: `${AMBER}14`, border: `${AMBER}55`, color: AMBER,
    },
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "rgba(20,10,12,0.55)", backdropFilter: 'blur(4px)' }}>
      <div className="min-h-screen flex items-start justify-center p-4 pt-8 pb-12">
        <div className="w-full max-w-3xl rounded-xl overflow-hidden" style={{ background: '#fff', boxShadow: '0 24px 70px -20px rgba(36,21,18,0.45)' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4" style={{ background: ROSE, borderBottom: `1px solid ${RULE}` }}>
            <div className="flex items-center gap-3">
              <button onClick={onClose} style={{ ...sans, fontSize: "0.8rem", fontWeight: 700, color: MAROON, background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <span style={{ color: RULE }}>|</span>
              <div>
                <p style={{ ...serif, fontSize: "0.95rem", fontWeight: 700, color: MAROON }}>Monthly Report</p>
                <p style={{ ...sans, fontSize: "0.72rem", color: '#a56475' }}>{report.scholarName} · {report.submittedAt}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full" style={{ background: systemBadge.bg }}>
                <SystemIcon className="w-3.5 h-3.5" style={{ color: systemBadge.color }} />
                <span style={{ ...sans, fontSize: "0.7rem", fontWeight: 800, color: systemBadge.color }}>{systemBadge.label}</span>
              </div>
              {staffBadge && StaffIcon && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full" style={{ background: staffBadge.bg, border: `1px solid ${staffBadge.border}` }}>
                  <StaffIcon className="w-3.5 h-3.5" style={{ color: staffBadge.color }} />
                  <span style={{ ...sans, fontSize: "0.7rem", fontWeight: 800, color: staffBadge.color }}>{staffBadge.label}</span>
                </div>
              )}
              <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: '#a56475', padding: 4 }}>
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* AI Quality bar — was a jarring dark navy strip, now part of the same ledger palette */}
          <div className="px-6 py-4" style={{ background: PAPER, borderBottom: `1px solid ${RULE}` }}>
            <div className="flex items-center gap-5">
              <div className="relative flex-shrink-0" style={{ width: 54, height: 54 }}>
                <ScoreRing score={qualityScore} size={54} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span style={{ ...serif, fontSize: "0.8rem", fontWeight: 800, color: scoreColor(qualityScore) }}>{qualityScore}</span>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span style={{ ...sans, fontSize: "0.62rem", fontWeight: 800, color: '#a89890', textTransform: "uppercase", letterSpacing: "0.1em" }}>AI Quality Score</span>
                  <span style={{ ...serif, fontSize: "1.05rem", fontWeight: 700, color: INK }}>{qualityScore}/100</span>
                </div>
                <div style={{ height: 5, background: RULE, borderRadius: 99, overflow: "hidden", marginBottom: 8 }}>
                  <div style={{ height: "100%", width: `${qualityScore}%`, background: scoreColor(qualityScore), borderRadius: 99 }} />
                </div>
                <div className="flex items-center gap-4">
                  <span style={{ ...sans, fontSize: "0.7rem", color: '#a89890' }}>Quality: <b style={{ color: '#6b6058' }}>{qualityScore}/100</b></span>
                  <span style={{ ...sans, fontSize: "0.7rem", color: '#6b6058' }}>Sentiment: <b>{report.sentimentLabel || "Neutral"}</b></span>
                  <span style={{ ...sans, fontSize: "0.7rem", color: '#a89890' }}>Checklist: <b style={{ color: '#6b6058' }}>{passedCount}/{(report.checklistResults || []).length} passed</b></span>
                </div>
              </div>
            </div>
          </div>

          {/* Two-column body */}
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_230px]" style={{ maxHeight: "55vh", overflow: "hidden" }}>

            {/* Left — letter */}
            <div className="overflow-y-auto" style={{ borderRight: `1px solid ${RULE}` }}>
              {report.staffFeedback && (
                <div className="mx-6 mt-5 rounded-lg p-4 flex items-start gap-3" style={{ background: `${SAGE}0f`, border: `1px solid ${SAGE}45` }}>
                  <MessageSquare className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: SAGE }} />
                  <div>
                    <p style={{ ...sans, fontSize: "0.72rem", fontWeight: 800, color: SAGE, marginBottom: 3 }}>Staff Feedback</p>
                    <p style={{ ...sans, fontSize: "0.78rem", color: '#4b5d4e', lineHeight: 1.55 }}>{report.staffFeedback}</p>
                  </div>
                </div>
              )}

              <div className="text-center pt-7 pb-4 px-8" style={{ borderBottom: `1px solid ${RULE}` }}>
                <p style={{ ...serif, fontSize: "0.95rem", fontWeight: 700, color: MAROON }}>Kalinga at Pag-ibig Foundation Inc.</p>
                <p style={{ ...sans, fontSize: "0.74rem", color: '#a89890', marginTop: 2 }}>Apple Scholars · Rodriguez, Rizal</p>
              </div>

              <div className="grid grid-cols-2 gap-0 mx-8 my-4 rounded-lg overflow-hidden" style={{ border: `1px solid ${RULE}` }}>
                {[["Name", report.scholarName], ["Age", `${report.age} years old`], ["Year", report.year], ["Course", report.course], ["School", report.school], ["Date", report.date]].map(([label, value], i) => (
                  <div key={i} className="px-4 py-2.5" style={{ borderRight: i % 2 === 0 ? `1px solid ${RULE}` : "none", borderBottom: i < 4 ? `1px solid ${RULE}` : "none", background: i % 2 === 0 ? PAPER : '#fff' }}>
                    <p style={{ ...sans, fontSize: "0.62rem", fontWeight: 800, color: '#a89890', textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</p>
                    <p style={{ ...sans, fontSize: "0.8rem", fontWeight: 700, color: INK }}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="px-8 pb-4">
                <p style={{ ...sans, fontSize: "0.85rem", lineHeight: 1.8, color: '#4b3f38', marginBottom: 14 }}>Dear Kalinga,</p>
                {(report.body || "").split(/\n\n+/).filter(p => p.trim()).map((para, i) => (
                  <p key={i} style={{ ...sans, fontSize: "0.85rem", lineHeight: 1.8, color: '#4b3f38', marginBottom: 12, textIndent: "2rem" }}>{para.trim()}</p>
                ))}
                <p style={{ ...sans, fontSize: "0.85rem", color: '#4b3f38', marginTop: 20, marginBottom: 2 }}>Your scholar,</p>
                <p style={{ ...serif, fontSize: "0.92rem", fontWeight: 700, color: MAROON }}>{report.scholarName}</p>
              </div>

              {report.photos?.length > 0 ? (
                <div className="px-8 pb-6" style={{ borderTop: `1px solid ${RULE}` }}>
                  <div className="flex items-center gap-2 mt-4 mb-3">
                    <Image className="w-3.5 h-3.5" style={{ color: MAROON }} />
                    <p style={{ ...serif, fontSize: "0.88rem", fontWeight: 700, color: INK }}>Documentation ({report.photos.length})</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {report.photos.map((photo, i) => (
                      <div key={i}>
                        <div className="rounded-lg overflow-hidden" style={{ height: 100, border: `1px solid ${RULE}` }}>
                          <img src={photo.url} alt="" className="w-full h-full object-cover" />
                        </div>
                        <p style={{ ...sans, fontSize: "0.7rem", color: '#a89890', marginTop: 3, textAlign: "center", fontStyle: "italic", lineHeight: 1.4 }}>({photo.description || "No description"})</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mx-8 mb-5 rounded-lg p-3 flex items-center gap-2" style={{ background: `${AMBER}0f`, border: `1px solid ${AMBER}40` }}>
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: AMBER }} />
                  <p style={{ ...sans, fontSize: "0.76rem", color: '#7a5a2e' }}>No documentation photos attached.</p>
                </div>
              )}

              <div className="mx-8 mb-4 pt-2 flex justify-between" style={{ borderTop: `1px solid ${RULE}` }}>
                <span style={{ ...mono, fontSize: "0.66rem", color: '#c9b9b0' }}>Page 1 / Apple Scholar</span>
                <span style={{ ...mono, fontSize: "0.66rem", color: '#c9b9b0' }}>{report.date}</span>
              </div>
            </div>

            {/* Right — AI evaluation */}
            <div className="overflow-y-auto p-4" style={{ background: PAPER }}>
              <p style={{ ...sans, fontSize: "0.64rem", fontWeight: 800, color: '#a89890', textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>AI Scores</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[{ label: "Quality", value: qualityScore }, { label: "Photos", value: report.photos?.length || 0 }].map(s => (
                  <div key={s.label} className="rounded-lg p-2.5 text-center" style={{ background: "#fff", border: `1px solid ${RULE}` }}>
                    <p style={{ ...sans, fontSize: "0.64rem", color: '#a89890', marginBottom: 2 }}>{s.label}</p>
                    <p style={{ ...serif, fontSize: "1.05rem", fontWeight: 700, color: s.label === "Quality" ? scoreColor(s.value) : INK }}>{s.value}{s.label === "Quality" ? "/100" : ""}</p>
                  </div>
                ))}
              </div>
              <p style={{ ...sans, fontSize: "0.64rem", fontWeight: 800, color: '#a89890', textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>Checklist</p>
              <div className="space-y-1.5">
                {(report.checklistResults || []).map((c, i) => (
                  <div key={i} className="flex items-start gap-1.5 rounded-md px-2 py-1.5"
                    style={c.passed ? { background: `${SAGE}0f`, border: `1px solid ${SAGE}40` } : { background: `${CLAY}0f`, border: `1px solid ${CLAY}40` }}>
                    {c.passed
                      ? <CheckCircle className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: SAGE }} />
                      : <XCircle className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: CLAY }} />}
                    <span style={{ ...sans, fontSize: "0.69rem", color: c.passed ? SAGE : CLAY, lineHeight: 1.4 }}>{c.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Staff Action Zone */}
          <div style={{ borderTop: `2px solid ${RULE}` }}>
            <div className="px-6 pt-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" style={{ color: MAROON }} />
                  <span style={{ ...sans, fontSize: "0.85rem", fontWeight: 700, color: INK }}>Officer Feedback</span>
                  <span style={{ ...sans, fontSize: "0.72rem", color: '#a89890' }}>— visible to scholar after action</span>
                </div>
                {!showFeedbackBox && (
                  <button onClick={() => setShowFeedbackBox(true)}
                    style={{ ...sans, fontSize: "0.78rem", fontWeight: 700, color: MAROON, background: "none", border: "none", cursor: "pointer" }}>
                    + Add Feedback
                  </button>
                )}
              </div>
              {showFeedbackBox && (
                <div className="mb-4">
                  <textarea
                    value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                    rows={3}
                    placeholder="Write your feedback to the scholar here..."
                    className="w-full outline-none resize-none"
                    style={{ ...sans, fontSize: "0.85rem", lineHeight: 1.6, color: '#4b3f38', background: '#fff', border: `1px solid ${RULE}`, borderRadius: 10, padding: 12 }}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <span style={{ ...sans, fontSize: "0.72rem", color: '#a89890' }}>{feedback.length} characters</span>
                    {!report.staffFeedback && (
                      <button onClick={() => { setShowFeedbackBox(false); setFeedback(""); }}
                        style={{ ...sans, fontSize: "0.72rem", color: '#a89890', background: "none", border: "none", cursor: "pointer" }}>
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 pb-5 flex items-center gap-3">
              <button
                onClick={() => setConfirmAction("approved")}
                disabled={report.staffAction === "approved" || actionSaving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full transition-opacity hover:opacity-90"
                style={{ ...sans, fontSize: "0.85rem", fontWeight: 700, background: SAGE, color: "#fff", border: "none", cursor: report.staffAction === "approved" ? "not-allowed" : "pointer", opacity: report.staffAction === "approved" ? 0.5 : 1 }}>
                <ThumbsUp className="w-4 h-4" />
                {report.staffAction === "approved" ? "Approved ✓" : "Approve"}
              </button>
              <button
                onClick={() => setConfirmAction("needs-revision")}
                disabled={report.staffAction === "needs-revision" || actionSaving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full transition-opacity hover:opacity-90"
                style={{ ...sans, fontSize: "0.85rem", fontWeight: 700, background: AMBER, color: "#fff", border: "none", cursor: report.staffAction === "needs-revision" ? "not-allowed" : "pointer", opacity: report.staffAction === "needs-revision" ? 0.5 : 1 }}>
                <MessageSquare className="w-4 h-4" />
                {report.staffAction === "needs-revision" ? "Sent ✓" : "Needs Revision"}
              </button>
              <button
                onClick={() => setConfirmAction("rejected")}
                disabled={report.staffAction === "rejected" || actionSaving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full transition-opacity hover:opacity-90"
                style={{ ...sans, fontSize: "0.85rem", fontWeight: 700, background: CLAY, color: "#fff", border: "none", cursor: report.staffAction === "rejected" ? "not-allowed" : "pointer", opacity: report.staffAction === "rejected" ? 0.5 : 1 }}>
                <ThumbsDown className="w-4 h-4" />
                {report.staffAction === "rejected" ? "Rejected ✓" : "Reject"}
              </button>
            </div>
          </div>
        </div>

        {/* Confirm overlay */}
        {confirmAction && (() => {
          const cfg = actionConfig[confirmAction];
          return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(20,10,12,0.55)" }}>
              <div className="rounded-xl w-full max-w-sm p-6" style={{ background: '#fff', boxShadow: '0 24px 70px -20px rgba(36,21,18,0.45)' }}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: cfg.lightBg }}>
                  {confirmAction === "approved"
                    ? <ThumbsUp className="w-5 h-5" style={{ color: cfg.color }} />
                    : confirmAction === "rejected"
                    ? <ThumbsDown className="w-5 h-5" style={{ color: cfg.color }} />
                    : <MessageSquare className="w-5 h-5" style={{ color: cfg.color }} />}
                </div>
                <h3 style={{ ...serif, fontSize: "1.1rem", fontWeight: 700, color: INK, textAlign: "center", marginBottom: 8 }}>{cfg.label}</h3>
                <p style={{ ...sans, fontSize: "0.82rem", color: '#a89890', lineHeight: 1.5, textAlign: "center", marginBottom: 20 }}>{cfg.sublabel}</p>
                {feedback && (
                  <div className="rounded-lg p-3 mb-4" style={{ background: PAPER, border: `1px solid ${RULE}` }}>
                    <p style={{ ...sans, fontSize: "0.72rem", fontWeight: 800, color: '#6b6058', marginBottom: 4 }}>Feedback to send:</p>
                    <p style={{ ...sans, fontSize: "0.78rem", color: '#a89890', lineHeight: 1.5 }}>"{feedback}"</p>
                  </div>
                )}
                <div className="flex gap-3">
                  <button onClick={() => setConfirmAction(null)} disabled={actionSaving}
                    style={{ flex: 1, padding: "10px 0", borderRadius: 999, ...sans, fontSize: "0.85rem", fontWeight: 700, border: `1.5px solid ${RULE}`, background: "#fff", color: '#6b6058', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={handleConfirm} disabled={actionSaving}
                    style={{ flex: 1, padding: "10px 0", borderRadius: 999, ...sans, fontSize: "0.85rem", fontWeight: 700, border: "none", background: cfg.bg, color: "#fff", cursor: 'pointer', display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: actionSaving ? 0.7 : 1 }}>
                    {actionSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {cfg.confirmLabel}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}