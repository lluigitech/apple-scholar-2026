import React from 'react';
import { CheckCircle, XCircle, AlertCircle, Send, Loader2 } from 'lucide-react';

function getRiskBg(l) { return l === 'accepted' ? '#EAF3EC' : l === 'medium' ? '#FBF0DE' : '#FBE9E9'; }
function getRiskBorder(l) { return l === 'accepted' ? '#bbf7d0' : l === 'medium' ? '#f3d9a6' : '#f3c6c6'; }

// ── Token system — shared across the Scholar Portal ──
const MAROON = '#7f2d3a';
const MAROON_DEEP = '#4f1620';
const GOLD = '#b98b4e';
const IVORY = '#FBF7F2';
const INK = '#241512';

const ConfirmModal = ({ ev, submitting, submitError, onCancel, onConfirm }) => {
    const RiskIcon = ev.accepted ? CheckCircle : ev.riskLevel === 'medium' ? AlertCircle : XCircle;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(36,21,18,0.55)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* thin gold rule at the top — same letterhead cue as the Submission page cards */}
                <div style={{ height: 3, background: `linear-gradient(90deg, ${MAROON} 0%, ${GOLD} 100%)` }} />

                <div className="p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: getRiskBg(ev.riskLevel) }}>
                            <RiskIcon className="w-5 h-5" style={{ color: ev.riskColor }} />
                        </div>
                        <div>
                            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', fontWeight: 700, color: INK }}>
                                Confirm Submission
                            </h3>
                            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.78rem', color: '#6b7280' }}>
                                Please review before finalizing
                            </p>
                        </div>
                    </div>

                    <div className="rounded-xl p-4 mb-4" style={{ background: getRiskBg(ev.riskLevel), border: `1px solid ${getRiskBorder(ev.riskLevel)}` }}>
                        <div className="flex items-center justify-between mb-2">
                            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', fontWeight: 700, color: ev.riskColor }}>
                                Overall Quality Score: {ev.overallScore}/100
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                                style={{ fontFamily: "'DM Sans', sans-serif", background: ev.riskColor + '22', color: ev.riskColor }}>
                                {ev.riskLabel}
                            </span>
                        </div>
                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem', color: ev.riskColor, lineHeight: 1.5 }}>
                            {ev.accepted
                                ? 'Your report meets the quality standard. It will be sent to the admin/office for review.'
                                : ev.riskLevel === 'medium'
                                ? 'Medium Risk — Your score must reach 71+ to be accepted. The system will not forward this report.'
                                : 'High Risk — Your score is too low. The system will not accept this submission.'}
                        </p>
                    </div>

                    {!ev.accepted && (
                        <div className="rounded-xl p-3 mb-4" style={{ background: IVORY, border: '1px solid #e9dfd8' }}>
                            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                                What needs improvement:
                            </p>
                            {ev.checklist.filter(c => !c.passed).map(c => (
                                <div key={c.item.id} className="flex items-center gap-2 mb-1.5">
                                    <XCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#991b1b' }} />
                                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.78rem', color: '#6b7280' }}>{c.item.label}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {submitError && (
                        <div className="rounded-xl p-3 mb-4 flex items-start gap-2" style={{ background: '#FBE9E9', border: '1px solid #f3c6c6' }}>
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#991b1b' }} />
                            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.78rem', color: '#991b1b' }}>{submitError}</p>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button onClick={onCancel} disabled={submitting} className="flex-1 py-2.5 rounded-full transition-opacity hover:opacity-80 disabled:opacity-50"
                            style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.88rem', fontWeight: 600, border: '1.5px solid #d8c9c2', background: '#fff', color: '#6b6058', cursor: 'pointer' }}>
                            Go Back &amp; Edit
                        </button>
                        {ev.accepted && (
                            <button onClick={onConfirm} disabled={submitting} className="flex-1 py-2.5 rounded-full flex items-center justify-center gap-2 transition-opacity hover:opacity-85 disabled:opacity-60"
                                style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.88rem', fontWeight: 600, border: 'none', background: `linear-gradient(120deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)`, color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer' }}>
                                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : <><Send className="w-4 h-4" /> Yes, Submit</>}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;