import React from 'react';
import { CheckCircle2, XCircle, AlertCircle, Send, Loader2, Sparkles } from 'lucide-react';

function getRiskBg(l) { return l === 'accepted' ? '#EAF3EC' : l === 'medium' ? '#FBF0DE' : '#FBE9E9'; }
function getRiskBorder(l) { return l === 'accepted' ? '#bbf7d0' : l === 'medium' ? '#f3d9a6' : '#f3c6c6'; }

// ── Scholar Portal design system ──
// Same tokens as the rest of the Scholar module (dashboard, submissions,
// duty & participation, etc.) so this modal doesn't clash with the page
// that opens it.
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const PRIMARY = '#6D2140';
const PRIMARY_DARK = '#4A1730';
const BRONZE = '#A9784E';
const SUCCESS = '#6B8F71';
const WARNING = '#C08A3E';
const DANGER = '#C0473F';
const INK = '#241512';
const MUTED = '#8A7A68';
const RADIUS = 18;

const display = { fontFamily: "'Playfair Display', Georgia, serif" };
const body = { fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif" };

const outlineBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 18px', border: `1px solid ${BORDER}`, borderRadius: 12, background: SURFACE, color: INK, ...body, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' };
const filledBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 18px', border: 'none', borderRadius: 12, background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`, color: '#fff', ...body, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' };

// Circular quality-score ring — replaces the dashed rubber grade stamp.
const ScoreRing = ({ score, color, size = 92 }) => {
    const stroke = 9;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(100, score));
    const offset = c - (pct / 100) * c;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={BORDER} strokeWidth={stroke} />
            <circle
                cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
            <text x="50%" y="46%" textAnchor="middle" style={{ ...display, fontSize: size * 0.24, fontWeight: 700, fill: INK }}>{score}</text>
            <text x="50%" y="66%" textAnchor="middle" style={{ ...body, fontSize: size * 0.1, fill: MUTED }}>Score</text>
        </svg>
    );
};

// One of the 3 compact evaluation-breakdown cards.
const BreakdownCard = ({ label, value, sub }) => {
    const color = value >= 75 ? SUCCESS : value >= 50 ? WARNING : DANGER;
    return (
        <div className="text-center" style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '12px 10px' }}>
            <p style={{ ...body, fontSize: '0.66rem', color: MUTED, marginBottom: 3 }} className="truncate">{label}</p>
            <p style={{ ...display, fontSize: '1.15rem', fontWeight: 700, color }}>{value}</p>
            <p style={{ ...body, fontSize: '0.6rem', color: '#c6b8ae' }}>{sub}</p>
        </div>
    );
};

const ConfirmModal = ({ ev, submitting, submitError, onCancel, onConfirm }) => {
    const RiskIcon = ev.accepted ? CheckCircle2 : ev.riskLevel === 'medium' ? AlertCircle : XCircle;
    const failedItems = ev.checklist.filter(c => !c.passed);
    const sourceLabel = ev.source === 'naive_bayes' ? 'Naive Bayes ML' : ev.source === 'flagged' ? 'Flagged' : 'Rule-Based';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(36,21,18,0.55)' }}>
            <div className="w-full max-w-lg overflow-hidden" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: '0 24px 48px -20px rgba(36,21,18,0.5)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                {/* ── 1. Premium header ── */}
                <div style={{ height: 4, background: `linear-gradient(90deg, ${PRIMARY} 0%, ${BRONZE} 100%)`, flexShrink: 0 }} />
                <div className="p-5 sm:p-6 pb-4" style={{ flexShrink: 0 }}>
                    <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', color: BRONZE }}>AI QUALITY EVALUATION</p>
                    <h3 style={{ ...display, fontSize: '1.3rem', fontWeight: 600, color: INK, marginTop: 4 }}>Review Before Submission</h3>
                    <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginTop: 4 }}>
                        {ev.accepted ? 'Your report meets the quality standard — take a last look before it goes out.' : 'A few things need attention before this can be submitted.'}
                    </p>
                </div>

                <div className="px-5 sm:px-6 overflow-y-auto" style={{ flex: 1 }}>
                    {/* ── 2. Hero evaluation ── */}
                    <div className="flex items-center gap-4 flex-wrap" style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '18px 20px', marginBottom: 16 }}>
                        <ScoreRing score={ev.overallScore} color={ev.riskColor} />
                        <div className="flex-1 min-w-[140px]">
                            <span
                                className="inline-flex items-center gap-1.5"
                                style={{ ...body, fontSize: '0.72rem', fontWeight: 600, color: ev.riskColor, background: `${ev.riskColor}16`, borderRadius: 999, padding: '4px 12px' }}
                            >
                                <RiskIcon size={13} />
                                {ev.riskLabel}
                            </span>
                            <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginTop: 8 }}>
                                {ev.accepted ? 'Ready for admin/office review.' : 'Not yet ready — see the checklist below.'}
                            </p>
                        </div>
                        <div className="text-right flex-shrink-0" style={{ minWidth: 110 }}>
                            <p style={{ ...body, fontSize: '0.66rem', color: MUTED }}>Overall score</p>
                            <p style={{ ...display, fontSize: '1.1rem', fontWeight: 600, color: INK }}>{ev.overallScore}/100</p>
                            {ev.toneLabel && (
                                <>
                                    <p style={{ ...body, fontSize: '0.66rem', color: MUTED, marginTop: 6 }}>Academic tone</p>
                                    <p style={{ ...body, fontSize: '0.8rem', fontWeight: 600, color: ev.toneColor || INK }}>{ev.toneLabel}</p>
                                </>
                            )}
                            <p style={{ ...body, fontSize: '0.66rem', color: MUTED, marginTop: 6 }}>Evaluation source</p>
                            <p style={{ ...body, fontSize: '0.76rem', fontWeight: 600, color: INK }}>{sourceLabel}</p>
                        </div>
                    </div>

                    {/* ── 3. Evaluation breakdown ── */}
                    <div className="grid grid-cols-3 gap-2" style={{ marginBottom: 16 }}>
                        <BreakdownCard label="Letter Body" value={ev.reportScore} sub="70 pts" />
                        <BreakdownCard label="Documentation" value={ev.mediaScore} sub="20 pts" />
                        <BreakdownCard label="Info" value={ev.infoScore || 0} sub="10 pts" />
                    </div>

                    {/* ── 4. Improvement checklist ── */}
                    <div style={{ background: failedItems.length ? `${DANGER}0a` : `${SUCCESS}0d`, border: `1px solid ${failedItems.length ? `${DANGER}33` : `${SUCCESS}33`}`, borderRadius: RADIUS, padding: '16px 18px', marginBottom: 16 }}>
                        {failedItems.length === 0 ? (
                            <div className="flex items-center gap-2.5">
                                <CheckCircle2 size={18} style={{ color: SUCCESS, flexShrink: 0 }} />
                                <div>
                                    <p style={{ ...body, fontSize: '0.82rem', fontWeight: 600, color: SUCCESS }}>Everything checks out</p>
                                    <p style={{ ...body, fontSize: '0.76rem', color: SUCCESS, marginTop: 2 }}>All checklist requirements are satisfied.</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', color: DANGER, marginBottom: 10 }}>IMPROVEMENT CHECKLIST</p>
                                <div className="space-y-2">
                                    {failedItems.map(c => (
                                        <div key={c.item.id} className="flex items-start gap-2.5">
                                            <XCircle size={15} style={{ color: DANGER, flexShrink: 0, marginTop: 1 }} />
                                            <div className="min-w-0">
                                                <p style={{ ...body, fontSize: '0.8rem', fontWeight: 600, color: INK }}>{c.item.label}</p>
                                                <p style={{ ...body, fontSize: '0.72rem', color: MUTED, marginTop: 1 }}>Address this before resubmitting.</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* ── 5. Error callout ── */}
                    {submitError && (
                        <div className="mb-4 flex items-start gap-2.5" style={{ borderLeft: `3px solid ${DANGER}`, background: `${DANGER}0d`, borderRadius: '0 12px 12px 0', padding: '11px 14px' }}>
                            <AlertCircle size={16} style={{ color: DANGER, flexShrink: 0, marginTop: 1 }} />
                            <p style={{ ...body, fontSize: '0.78rem', color: DANGER }}>{submitError}</p>
                        </div>
                    )}
                </div>

                {/* ── 6. Footer actions ── */}
                <div className="p-5 sm:p-6 pt-4 flex gap-3" style={{ flexShrink: 0, borderTop: `1px solid ${BG}` }}>
                    <button onClick={onCancel} disabled={submitting} className="flex-1 transition-opacity hover:opacity-80 disabled:opacity-50" style={outlineBtn}>
                        Back &amp; Edit
                    </button>
                    {ev.accepted && (
                        <button onClick={onConfirm} disabled={submitting} className="flex-1 transition-opacity hover:opacity-85 disabled:opacity-60"
                            style={{ ...filledBtn, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                            {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting…</> : <><Send size={16} /> Submit Report</>}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;