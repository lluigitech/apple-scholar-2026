import { useState } from "react";
import {
  ChevronLeft, X, Image, AlertTriangle, MessageSquare,
  ThumbsUp, ThumbsDown, Send, CheckCircle, XCircle, Loader2,
} from "lucide-react";
import ScoreRing from "../../Shared/ScoreRing";
import { MAROON, scoreColor, reportStatusBadge, staffActionBadge } from "./ReportsHelpers";

// ── Design tokens — shared Records Office brand system ──
// This modal reviews a single scholar letter, so its letterhead
// panel mirrors the Submission preview pane (Lora masthead, ruled
// info grid), while the surrounding chrome matches the "Statistics
// Bureau" tables it's opened from.
const MAROON_DEEP = '#4f1620';
const GOLD = '#b98b4e';
const BG = '#F6EFE4';
const CARD = '#fffdf8';
const RULE = '#e8dccb';
const INK = '#241512';
const MUTED = '#a89890';
const SAGE = '#6b8f71';
const CLAY = '#c1666b';
const AMBER = '#b8863f';

const display = { fontFamily: "'Lora', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Work Sans', 'Segoe UI', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace" };

const outlineBtn = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', border: `1px solid ${RULE}`, borderRadius: 4, background: CARD, color: INK, ...body, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' };

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
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "rgba(36,21,18,0.55)", backdropFilter: 'blur(4px)' }}>
      <div className="min-h-screen flex items-start justify-center p-4 pt-8 pb-12">
        <div className="w-full max-w-3xl overflow-hidden" style={{ background: CARD, borderRadius: 6, border: `1px solid ${RULE}`, boxShadow: '0 24px 70px -20px rgba(36,21,18,0.45)' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4" style={{ background: `${MAROON}08`, borderBottom: `1px solid ${RULE}` }}>
            <div className="flex items-center gap-3">
              <button onClick={onClose} style={{ ...body, fontSize: "0.8rem", fontWeight: 700, color: MAROON, background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <span style={{ color: RULE }}>|</span>
              <div>
                <p style={{ ...display, fontSize: "0.95rem", fontWeight: 600, color: MAROON }}>Monthly Report</p>
                <p style={{ ...mono, fontSize: "0.68rem", color: MUTED }}>{report.scholarName} · {report.submittedAt}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded" style={{ background: systemBadge.bg }}>
                <SystemIcon className="w-3.5 h-3.5" style={{ color: systemBadge.color }} />
                <span style={{ ...mono, fontSize: "0.64rem", fontWeight: 700, color: systemBadge.color, textTransform: 'uppercase' }}>{systemBadge.label}</span>
              </div>
              {staffBadge && StaffIcon && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded" style={{ background: staffBadge.bg, border: `1px solid ${staffBadge.border}` }}>
                  <StaffIcon className="w-3.5 h-3.5" style={{ color: staffBadge.color }} />
                  <span style={{ ...mono, fontSize: "0.64rem", fontWeight: 700, color: staffBadge.color, textTransform: 'uppercase' }}>{staffBadge.label}</span>
                </div>
              )}
              <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 4 }}>
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* AI Quality bar */}
          <div className="px-6 py-4" style={{ background: BG, borderBottom: `1px solid ${RULE}` }}>
            <div className="flex items-center gap-5">
              <div className="relative flex-shrink-0" style={{ width: 54, height: 54 }}>
                <ScoreRing score={qualityScore} size={54} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span style={{ ...display, fontSize: "0.8rem", fontWeight: 700, color: scoreColor(qualityScore) }}>{qualityScore}</span>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span style={{ ...mono, fontSize: "0.6rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em" }}>AI Quality Score</span>
                  <span style={{ ...display, fontSize: "1.05rem", fontWeight: 700, color: INK }}>{qualityScore}/100</span>
                </div>
                <div style={{ height: 5, background: RULE, borderRadius: 99, overflow: "hidden", marginBottom: 8 }}>
                  <div style={{ height: "100%", width: `${qualityScore}%`, background: scoreColor(qualityScore), borderRadius: 99 }} />
                </div>
                <div className="flex items-center gap-4">
                  <span style={{ ...body, fontSize: "0.7rem", color: MUTED }}>Quality: <b style={{ color: '#6b6058' }}>{qualityScore}/100</b></span>
                  <span style={{ ...body, fontSize: "0.7rem", color: '#6b6058' }}>Sentiment: <b>{report.sentimentLabel || "Neutral"}</b></span>
                  <span style={{ ...body, fontSize: "0.7rem", color: MUTED }}>Checklist: <b style={{ color: '#6b6058' }}>{passedCount}/{(report.checklistResults || []).length} passed</b></span>
                </div>
              </div>
            </div>
          </div>

          {/* Two-column body */}
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_230px]" style={{ maxHeight: "55vh", overflow: "hidden" }}>

            {/* Left — letter, styled as the same letterhead used on Submission */}
            <div className="overflow-y-auto" style={{ borderRight: `1px solid ${RULE}` }}>
              {report.staffFeedback && (
                <div className="mx-6 mt-5 rounded p-4 flex items-start gap-3" style={{ background: `${SAGE}0f`, border: `1px solid ${SAGE}45` }}>
                  <MessageSquare className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: SAGE }} />
                  <div>
                    <p style={{ ...mono, fontSize: "0.64rem", fontWeight: 700, color: SAGE, marginBottom: 3, textTransform: 'uppercase' }}>Staff Feedback</p>
                    <p style={{ ...body, fontSize: "0.78rem", color: '#4b5d4e', lineHeight: 1.55 }}>{report.staffFeedback}</p>
                  </div>
                </div>
              )}

              <div className="text-center pt-7 pb-4 px-8" style={{ borderBottom: `1px solid ${GOLD}55` }}>
                <p style={{ ...display, fontSize: "0.95rem", fontWeight: 700, color: MAROON }}>Kalinga at Pag-ibig Foundation Inc.</p>
                <p style={{ ...mono, fontSize: "0.7rem", color: MUTED, marginTop: 2 }}>Apple Scholars · Rodriguez, Rizal</p>
              </div>

              <div className="grid grid-cols-2 gap-0 mx-8 my-4 overflow-hidden" style={{ border: `1px solid ${RULE}`, borderRadius: 4 }}>
                {[["Name", report.scholarName], ["Age", `${report.age} years old`], ["Year", report.year], ["Course", report.course], ["School", report.school], ["Date", report.date]].map(([label, value], i) => (
                  <div key={i} className="px-4 py-2.5" style={{ borderRight: i % 2 === 0 ? `1px solid ${RULE}` : "none", borderBottom: i < 4 ? `1px solid ${RULE}` : "none", background: i % 2 === 0 ? BG : CARD }}>
                    <p style={{ ...mono, fontSize: "0.6rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</p>
                    <p style={{ ...body, fontSize: "0.8rem", fontWeight: 700, color: INK }}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="px-8 pb-4">
                <p style={{ ...body, fontSize: "0.85rem", lineHeight: 1.8, color: '#4b3f38', marginBottom: 14 }}>Dear Kalinga,</p>
                {(report.body || "").split(/\n\n+/).filter(p => p.trim()).map((para, i) => (
                  <p key={i} style={{ ...body, fontSize: "0.85rem", lineHeight: 1.8, color: '#4b3f38', marginBottom: 12, textIndent: "2rem" }}>{para.trim()}</p>
                ))}
                <p style={{ ...body, fontSize: "0.85rem", color: '#4b3f38', marginTop: 20, marginBottom: 2 }}>Your scholar,</p>
                <p style={{ ...display, fontSize: "0.92rem", fontWeight: 700, color: MAROON }}>{report.scholarName}</p>
              </div>

              {report.photos?.length > 0 ? (
                <div className="px-8 pb-6" style={{ borderTop: `1px solid ${RULE}` }}>
                  <div className="flex items-center gap-2 mt-4 mb-3">
                    <Image className="w-3.5 h-3.5" style={{ color: MAROON }} />
                    <p style={{ ...display, fontSize: "0.88rem", fontWeight: 600, color: INK }}>Documentation ({report.photos.length})</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {report.photos.map((photo, i) => (
                      <div key={i}>
                        <div className="rounded overflow-hidden" style={{ height: 100, border: `1px solid ${RULE}` }}>
                          <img src={photo.url} alt="" className="w-full h-full object-cover" />
                        </div>
                        <p style={{ ...body, fontSize: "0.7rem", color: MUTED, marginTop: 3, textAlign: "center", fontStyle: "italic", lineHeight: 1.4 }}>({photo.description || "No description"})</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mx-8 mb-5 rounded p-3 flex items-center gap-2" style={{ background: `${AMBER}0f`, border: `1px solid ${AMBER}40` }}>
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: AMBER }} />
                  <p style={{ ...body, fontSize: "0.76rem", color: '#7a5a2e' }}>No documentation photos attached.</p>
                </div>
              )}

              <div className="mx-8 mb-4 pt-2 flex justify-between" style={{ borderTop: `1px solid ${RULE}` }}>
                <span style={{ ...mono, fontSize: "0.66rem", color: '#c9b9b0' }}>Page 1 / Apple Scholar</span>
                <span style={{ ...mono, fontSize: "0.66rem", color: '#c9b9b0' }}>{report.date}</span>
              </div>
            </div>

            {/* Right — AI evaluation */}
            <div className="overflow-y-auto p-4" style={{ background: BG }}>
              <p style={{ ...mono, fontSize: "0.6rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>AI Scores</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[{ label: "Quality", value: qualityScore }, { label: "Photos", value: report.photos?.length || 0 }].map(s => (
                  <div key={s.label} className="rounded p-2.5 text-center" style={{ background: CARD, border: `1px solid ${RULE}` }}>
                    <p style={{ ...mono, fontSize: "0.6rem", color: MUTED, marginBottom: 2, textTransform: 'uppercase' }}>{s.label}</p>
                    <p style={{ ...display, fontSize: "1.05rem", fontWeight: 700, color: s.label === "Quality" ? scoreColor(s.value) : INK }}>{s.value}{s.label === "Quality" ? "/100" : ""}</p>
                  </div>
                ))}
              </div>
              <p style={{ ...mono, fontSize: "0.6rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>Checklist</p>
              <div className="space-y-1.5">
                {(report.checklistResults || []).map((c, i) => (
                  <div key={i} className="flex items-start gap-1.5 rounded px-2 py-1.5"
                    style={c.passed ? { background: `${SAGE}0f`, border: `1px solid ${SAGE}40` } : { background: `${CLAY}0f`, border: `1px solid ${CLAY}40` }}>
                    {c.passed
                      ? <CheckCircle className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: SAGE }} />
                      : <XCircle className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: CLAY }} />}
                    <span style={{ ...body, fontSize: "0.69rem", color: c.passed ? SAGE : CLAY, lineHeight: 1.4 }}>{c.label}</span>
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
                  <span style={{ ...body, fontSize: "0.85rem", fontWeight: 700, color: INK }}>Officer Feedback</span>
                  <span style={{ ...mono, fontSize: "0.66rem", color: MUTED }}>— visible to scholar after action</span>
                </div>
                {!showFeedbackBox && (
                  <button onClick={() => setShowFeedbackBox(true)}
                    style={{ ...body, fontSize: "0.78rem", fontWeight: 700, color: MAROON, background: "none", border: "none", cursor: "pointer" }}>
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
                    style={{ ...body, fontSize: "0.85rem", lineHeight: 1.6, color: '#4b3f38', background: CARD, border: `1px solid ${RULE}`, borderRadius: 4, padding: 12 }}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <span style={{ ...mono, fontSize: "0.68rem", color: MUTED }}>{feedback.length} characters</span>
                    {!report.staffFeedback && (
                      <button onClick={() => { setShowFeedbackBox(false); setFeedback(""); }}
                        style={{ ...body, fontSize: "0.72rem", color: MUTED, background: "none", border: "none", cursor: "pointer" }}>
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
                className="flex-1 flex items-center justify-center gap-2 py-2.5 transition-opacity hover:opacity-90"
                style={{ ...body, fontSize: "0.85rem", fontWeight: 600, background: SAGE, color: "#fff", border: "none", borderRadius: 4, cursor: report.staffAction === "approved" ? "not-allowed" : "pointer", opacity: report.staffAction === "approved" ? 0.5 : 1 }}>
                <ThumbsUp className="w-4 h-4" />
                {report.staffAction === "approved" ? "Approved ✓" : "Approve"}
              </button>
              <button
                onClick={() => setConfirmAction("needs-revision")}
                disabled={report.staffAction === "needs-revision" || actionSaving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 transition-opacity hover:opacity-90"
                style={{ ...body, fontSize: "0.85rem", fontWeight: 600, background: AMBER, color: "#fff", border: "none", borderRadius: 4, cursor: report.staffAction === "needs-revision" ? "not-allowed" : "pointer", opacity: report.staffAction === "needs-revision" ? 0.5 : 1 }}>
                <MessageSquare className="w-4 h-4" />
                {report.staffAction === "needs-revision" ? "Sent ✓" : "Needs Revision"}
              </button>
              <button
                onClick={() => setConfirmAction("rejected")}
                disabled={report.staffAction === "rejected" || actionSaving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 transition-opacity hover:opacity-90"
                style={{ ...body, fontSize: "0.85rem", fontWeight: 600, background: CLAY, color: "#fff", border: "none", borderRadius: 4, cursor: report.staffAction === "rejected" ? "not-allowed" : "pointer", opacity: report.staffAction === "rejected" ? 0.5 : 1 }}>
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
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(36,21,18,0.55)" }}>
              <div className="w-full max-w-sm p-6" style={{ background: CARD, borderRadius: 6, border: `1px solid ${RULE}`, boxShadow: '0 24px 70px -20px rgba(36,21,18,0.45)' }}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: cfg.lightBg }}>
                  {confirmAction === "approved"
                    ? <ThumbsUp className="w-5 h-5" style={{ color: cfg.color }} />
                    : confirmAction === "rejected"
                    ? <ThumbsDown className="w-5 h-5" style={{ color: cfg.color }} />
                    : <MessageSquare className="w-5 h-5" style={{ color: cfg.color }} />}
                </div>
                <h3 style={{ ...display, fontSize: "1.1rem", fontWeight: 600, color: INK, textAlign: "center", marginBottom: 8 }}>{cfg.label}</h3>
                <p style={{ ...body, fontSize: "0.82rem", color: MUTED, lineHeight: 1.5, textAlign: "center", marginBottom: 20 }}>{cfg.sublabel}</p>
                {feedback && (
                  <div className="rounded p-3 mb-4" style={{ background: BG, border: `1px solid ${RULE}` }}>
                    <p style={{ ...mono, fontSize: "0.66rem", fontWeight: 700, color: '#6b6058', marginBottom: 4, textTransform: 'uppercase' }}>Feedback to send:</p>
                    <p style={{ ...body, fontSize: "0.78rem", color: MUTED, lineHeight: 1.5 }}>"{feedback}"</p>
                  </div>
                )}
                <div className="flex gap-3">
                  <button onClick={() => setConfirmAction(null)} disabled={actionSaving} style={{ ...outlineBtn, flex: 1, justifyContent: 'center', padding: '10px 0' }}>
                    Cancel
                  </button>
                  <button onClick={handleConfirm} disabled={actionSaving}
                    style={{ flex: 1, padding: "10px 0", borderRadius: 4, ...body, fontSize: "0.85rem", fontWeight: 600, border: "none", background: cfg.bg, color: "#fff", cursor: 'pointer', display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: actionSaving ? 0.7 : 1 }}>
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