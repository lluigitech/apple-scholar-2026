import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Badge } from './CommonUI';
import { qualityColor, sentimentBadge } from '../../../utils/submissionHelpers';

// ── Apple Scholar Officer tokens (same as the Scholar Submissions page) ──
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const MAROON = '#6D2140';
const INK = '#241512';
const MUTED = '#8A7A68';
const SUCCESS = '#2F855A';
const DANGER = '#B91C1C';

const sans = { fontFamily: "'Inter', sans-serif" };
const serif = { fontFamily: "'Lora', serif" };
const mono = { fontFamily: "'IBM Plex Mono', ui-monospace, Menlo, monospace" };

const sectionLabel = { ...sans, fontSize: '0.72rem', fontWeight: 700, color: MUTED };

const DECISIONS = [
    { key: 'approved', label: 'Approve', color: SUCCESS },
    { key: 'rejected', label: 'Reject', color: DANGER },
];

// Approve/Reject decision modal for a single submission.
const ReviewModal = ({ modal, decision, setDecision, feedback, setFeedback, saving, onClose, onSubmit }) => {
    // Escape closes the dialog (not while a save is in flight).
    useEffect(() => {
        if (!modal) return undefined;
        const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [modal, saving, onClose]);

    if (!modal) return null;

    const qColor = qualityColor(modal.quality_score);
    const sentiment = modal.sentiment_label ? sentimentBadge(modal.sentiment_label) : null;
    const submitColor = decision === 'approved' ? SUCCESS : DANGER;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(36,21,18,0.5)', backdropFilter: 'blur(4px)' }}>
            <style>{`
                .review-textarea:focus { border-color: ${MAROON} !important; box-shadow: 0 0 0 3px rgba(109,33,64,.10); }
                .review-btn:focus-visible { outline: 2px solid ${MAROON}; outline-offset: 2px; }
            `}</style>
            <div role="dialog" aria-modal="true" aria-label="Review submission"
                className="w-full max-w-md max-h-[90vh] overflow-y-auto"
                style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 20, boxShadow: '0 24px 60px -20px rgba(74,23,41,0.40)' }}>

                {/* Modal Header */}
                <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <div className="min-w-0">
                        <p style={{ ...sans, fontSize: '0.72rem', fontWeight: 700, color: MAROON, marginBottom: 2 }}>Review submission</p>
                        <h3 className="break-words" style={{ ...serif, fontSize: '1.15rem', fontWeight: 700, color: INK, lineHeight: 1.25 }}>
                            {modal.full_name}
                        </h3>
                        <p style={{ ...mono, fontSize: '0.7rem', color: MUTED, marginTop: 2 }}>{modal.scholar_id || modal.sid}</p>
                    </div>
                    <button onClick={onClose} aria-label="Close" title="Close"
                        className="review-btn flex items-center justify-center shrink-0 transition-colors"
                        style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${BORDER}`, background: SURFACE, color: MUTED, cursor: 'pointer' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = BG; e.currentTarget.style.color = INK; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = SURFACE; e.currentTarget.style.color = MUTED; }}>
                        <X size={16} />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5">
                    {/* Score Card */}
                    <div className="flex items-center justify-between gap-3"
                        style={{ backgroundColor: qColor + '12', border: `1px solid ${qColor}30`, borderRadius: 14, padding: '14px 16px' }}>
                        <div>
                            <p style={sectionLabel}>Quality score</p>
                            <p style={{ ...serif, fontSize: '2.2rem', fontWeight: 700, color: qColor, lineHeight: 1.1, marginTop: 2 }}>
                                {modal.quality_score}%
                            </p>
                        </div>
                        {sentiment && (
                            <div className="text-right">
                                <p style={{ ...sectionLabel, marginBottom: 6 }}>Sentiment</p>
                                <Badge bg={sentiment.bg} color={sentiment.color}>
                                    {modal.sentiment_label}
                                </Badge>
                            </div>
                        )}
                    </div>

                    {/* Letter */}
                    {modal.letter_content && (
                        <div>
                            <p style={{ ...sectionLabel, marginBottom: 8 }}>Letter</p>
                            <div className="max-h-40 overflow-y-auto" style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12 }}>
                                <p className="whitespace-pre-line break-words" style={{ ...serif, fontSize: '0.84rem', fontStyle: 'italic', color: INK, lineHeight: 1.65 }}>
                                    "{modal.letter_content}"
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Decision */}
                    <div>
                        <p style={{ ...sectionLabel, marginBottom: 8 }}>Decision</p>
                        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Decision">
                            {DECISIONS.map(btn => {
                                const active = decision === btn.key;
                                return (
                                    <button key={btn.key} onClick={() => setDecision(btn.key)} aria-pressed={active}
                                        className="review-btn transition-colors"
                                        style={{
                                            ...sans, height: 42, borderRadius: 12, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                                            backgroundColor: active ? btn.color : SURFACE,
                                            color: active ? '#fff' : MUTED,
                                            border: `1.5px solid ${active ? btn.color : BORDER}`,
                                        }}>
                                        {btn.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Feedback */}
                    <div>
                        <label htmlFor="review-feedback" style={{ ...sectionLabel, display: 'block', marginBottom: 8 }}>
                            Feedback {decision === 'rejected' && <span style={{ color: DANGER }}>*</span>}
                        </label>
                        <textarea id="review-feedback" rows={4} value={feedback} onChange={e => setFeedback(e.target.value)}
                            aria-required={decision === 'rejected'}
                            placeholder={decision === 'rejected'
                                ? 'Explain why this submission is rejected...'
                                : 'Optional feedback for the scholar...'}
                            className="review-textarea w-full resize-none outline-none"
                            style={{ ...sans, fontSize: '0.82rem', color: INK, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12, lineHeight: 1.55 }} />
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="px-6 pb-6 flex gap-3">
                    <button onClick={onClose}
                        className="review-btn flex-1 transition-colors hover:bg-[#F7F4EE]"
                        style={{ ...sans, height: 44, fontSize: '0.82rem', fontWeight: 600, color: INK, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, cursor: 'pointer' }}>
                        Cancel
                    </button>
                    <button onClick={onSubmit}
                        disabled={saving || (decision === 'rejected' && !feedback.trim())}
                        className="review-btn flex-1 transition-opacity hover:opacity-90 disabled:opacity-40"
                        style={{ ...sans, height: 44, fontSize: '0.82rem', fontWeight: 700, color: '#fff', backgroundColor: submitColor, border: 'none', borderRadius: 12, cursor: 'pointer' }}>
                        {saving ? 'Saving...' : decision === 'approved' ? 'Approve' : 'Reject'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReviewModal;