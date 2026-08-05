import React from 'react';
import { X } from 'lucide-react';
import { Badge } from './CommonUI';
import { qualityColor, sentimentBadge } from '../../../utils/submissionHelpers';

const MAROON = '#7f2d3a';

// Approve/Reject decision modal for a single submission.
const ReviewModal = ({ modal, decision, setDecision, feedback, setFeedback, saving, onClose, onSubmit }) => {
    if (!modal) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">

                {/* Modal Header */}
                <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-slate-100">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest mb-1"
                            style={{ color: MAROON }}>Review Submission</p>
                        <h3 className="font-black text-slate-900 text-lg leading-tight"
                            style={{ fontFamily: "'Playfair Display', serif" }}>
                            {modal.full_name}
                        </h3>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{modal.scholar_id || modal.sid}</p>
                    </div>
                    <button onClick={onClose}
                        className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-all mt-1">
                        <X size={16} />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5">
                    {/* Score Card */}
                    <div className="rounded-2xl p-4 flex items-center justify-between"
                        style={{ backgroundColor: qualityColor(modal.quality_score) + '12', border: `1px solid ${qualityColor(modal.quality_score)}30` }}>
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Quality Score</p>
                            <p className="text-4xl font-black mt-1"
                                style={{ color: qualityColor(modal.quality_score), fontFamily: "'Playfair Display', serif" }}>
                                {modal.quality_score}%
                            </p>
                        </div>
                        {modal.sentiment_label && (
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Sentiment</p>
                                <Badge bg={sentimentBadge(modal.sentiment_label).bg} color={sentimentBadge(modal.sentiment_label).color}>
                                    {modal.sentiment_label}
                                </Badge>
                            </div>
                        )}
                    </div>

                    {/* Letter */}
                    {modal.letter_content && (
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Letter</p>
                            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 max-h-40 overflow-y-auto">
                                <p className="text-xs text-slate-600 leading-relaxed italic whitespace-pre-line">
                                    "{modal.letter_content}"
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Decision */}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest mb-2"
                            style={{ color: MAROON }}>Decision</p>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { key: 'approved', label: 'Approve', color: '#10b981' },
                                { key: 'rejected', label: 'Reject',  color: '#ef4444' },
                            ].map(btn => (
                                <button key={btn.key} onClick={() => setDecision(btn.key)}
                                    className="py-3 rounded-xl text-xs font-black uppercase tracking-widest border-2 transition-all"
                                    style={{
                                        backgroundColor: decision === btn.key ? btn.color : 'transparent',
                                        color:           decision === btn.key ? '#fff' : '#94a3b8',
                                        borderColor:     decision === btn.key ? btn.color : '#e2e8f0',
                                    }}>
                                    {btn.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Feedback */}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest mb-2"
                            style={{ color: MAROON }}>
                            Feedback {decision === 'rejected' && <span style={{ color: '#ef4444' }}>*</span>}
                        </p>
                        <textarea rows={4} value={feedback} onChange={e => setFeedback(e.target.value)}
                            placeholder={decision === 'rejected'
                                ? 'Explain why this submission is rejected...'
                                : 'Optional feedback for the scholar...'}
                            className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs text-slate-700 outline-none resize-none placeholder:text-slate-300 focus:border-slate-400 transition-all" />
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="px-6 pb-6 flex gap-3">
                    <button onClick={onClose}
                        className="flex-1 py-3 border border-slate-200 text-slate-500 font-bold text-xs rounded-2xl hover:bg-slate-50 transition-all">
                        Cancel
                    </button>
                    <button onClick={onSubmit}
                        disabled={saving || (decision === 'rejected' && !feedback.trim())}
                        className="flex-1 py-3 text-white font-black text-xs rounded-2xl transition-all disabled:opacity-40"
                        style={{ backgroundColor: decision === 'approved' ? '#10b981' : '#ef4444' }}>
                        {saving ? 'Saving...' : decision === 'approved' ? 'Approve' : 'Reject'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReviewModal;