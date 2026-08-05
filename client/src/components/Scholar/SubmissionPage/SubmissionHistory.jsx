import { CheckCircle, XCircle, Clock, TrendingUp, MessageSquare, Mail, GraduationCap, IdCard, Folder } from 'lucide-react';

// ── Token system — shared across the Scholar Portal ──
const MAROON = '#7f2d3a';
const GOLD = '#b98b4e';
const IVORY = '#FBF7F2';
const INK = '#241512';

const TYPE_LABELS = {
    letter: 'Monthly Report',
    report_card: 'Report Card',
    cor: 'Certificate of Registration',
    other: 'Other Document',
};

const TYPE_ICONS = {
    letter: Mail,
    report_card: GraduationCap,
    cor: IdCard,
    other: Folder,
};

const formatDate = (value) => {
    if (!value) return '';
    try {
        return new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return value;
    }
};

const STATUS_CONFIG = {
    approved: { label: 'Approved', color: '#15803d', bg: '#EAF3EC', Icon: CheckCircle },
    rejected: { label: 'Returned for Revision', color: '#991b1b', bg: '#FBE9E9', Icon: XCircle },
    returned: { label: 'Returned for Revision', color: '#991b1b', bg: '#FBE9E9', Icon: XCircle },
    pending:  { label: 'Pending Review', color: '#92400e', bg: '#FBF0DE', Icon: Clock },
};

// One card per submission. Monthly letters get the full sentiment/completeness/
// word-count breakdown (since those fields are only ever populated for
// submission_type === 'letter' - see submissionController.js normalizedPayload).
// Report cards / COR / other documents get a simpler card since there's no
// NLP analysis attached to them.
const HistoryCard = ({ item, onResubmit }) => {
    const status = item.status || 'pending';
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    const StatusIcon = cfg.Icon;
    const isLetter = item.submission_type === 'letter';

    const wordCount = isLetter && item.letter_content
        ? item.letter_content.trim().split(/\s+/).filter(Boolean).length
        : null;

    // sentiment_score from Gemini is -1..1 - convert to a 0-100 scale so it
    // reads the same way as the quality/completeness score.
    const sentimentPct = item.sentiment_score !== null && item.sentiment_score !== undefined
        ? Math.max(0, Math.min(100, Math.round(((parseFloat(item.sentiment_score) + 1) / 2) * 100)))
        : null;
    const sentColor = sentimentPct === null ? '#6b7280' : sentimentPct >= 70 ? '#15803d' : sentimentPct >= 40 ? '#92400e' : '#991b1b';
    const sentBg    = sentimentPct === null ? IVORY : sentimentPct >= 70 ? '#EAF3EC' : sentimentPct >= 40 ? '#FBF0DE' : '#FBE9E9';

    const completeness = isLetter && item.quality_score !== null && item.quality_score !== undefined
        ? Number(item.quality_score)
        : null;

    const hasMedia = !!item.media_paths;

    // Lightweight heuristics based only on what's actually persisted -
    // there's no stored "missing items" list from submission time, so this
    // is reconstructed from the saved letter content / media / score.
    const missingItems = [];
    if (isLetter) {
        if (wordCount !== null && wordCount < 150) {
            missingItems.push(`Below word count (150 min) - currently ${wordCount}`);
        }
        if (!hasMedia) {
            missingItems.push('No documentation photos attached');
        }
        if (item.letter_content && !item.letter_content.toLowerCase().includes('gwa')) {
            missingItems.push('GWA not mentioned');
        }
    }

    const TypeIcon = TYPE_ICONS[item.submission_type] || Mail;

    return (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)' }}>
            {/* thin gold rule — same letterhead cue used across the Submission flow */}
            <div style={{ height: 3, background: `linear-gradient(90deg, ${MAROON} 0%, ${GOLD} 100%)` }} />
            <div className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#F5E8EA' }}>
                            <TypeIcon className="w-3.5 h-3.5" style={{ color: MAROON }} />
                        </span>
                        <div>
                            <p className="text-sm font-semibold" style={{ fontFamily: "'DM Sans', sans-serif", color: INK }}>
                                {TYPE_LABELS[item.submission_type] || 'Submission'}
                            </p>
                            <p className="text-xs" style={{ fontFamily: "'DM Sans', sans-serif", color: '#9ca3af' }}>
                                Submitted: {formatDate(item.submitted_at)}{wordCount !== null ? ` · ${wordCount} words` : ''}
                            </p>
                        </div>
                    </div>
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full w-fit"
                        style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {cfg.label}
                    </span>
                </div>

                {isLetter && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x rounded-xl mb-3" style={{ background: IVORY, border: '1px solid #f0e6e0', borderColor: '#f0e6e0' }}>
                        <div className="p-3 sm:px-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#c9a9b0' }}>Sentiment</p>
                            <p className="text-sm font-bold" style={{ fontFamily: "'DM Sans', sans-serif", color: sentColor }}>
                                {item.sentiment_label || 'N/A'}{sentimentPct !== null ? ` · ${sentimentPct}/100` : ''}
                            </p>
                            {sentimentPct !== null && (
                                <div className="w-full h-1 rounded-full mt-1.5 overflow-hidden" style={{ background: '#e9dfd8' }}>
                                    <div className="h-full rounded-full" style={{ width: `${sentimentPct}%`, backgroundColor: sentColor }} />
                                </div>
                            )}
                        </div>
                        <div className="p-3 sm:px-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#c9a9b0' }}>Completeness</p>
                            <p className="text-sm font-bold" style={{ fontFamily: "'DM Sans', sans-serif", color: completeness !== null && completeness >= 80 ? '#15803d' : '#92400e' }}>
                                {completeness !== null ? `${completeness}%` : 'N/A'}
                            </p>
                            {completeness !== null && (
                                <div className="w-full h-1 rounded-full mt-1.5 overflow-hidden" style={{ background: '#e9dfd8' }}>
                                    <div className="h-full rounded-full" style={{ width: `${completeness}%`, backgroundColor: completeness >= 80 ? '#15803d' : '#92400e' }} />
                                </div>
                            )}
                        </div>
                        <div className="p-3 sm:px-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#c9a9b0' }}>Word Count</p>
                            <p className="text-sm font-bold" style={{ fontFamily: "'DM Sans', sans-serif", color: wordCount !== null && wordCount >= 150 ? '#15803d' : '#991b1b' }}>
                                {wordCount !== null ? `${wordCount} words` : 'N/A'}
                            </p>
                            {wordCount !== null && (
                                <p className="text-[10px] mt-1.5 font-semibold" style={{ fontFamily: "'DM Sans', sans-serif", color: wordCount >= 150 ? '#15803d' : '#991b1b' }}>
                                    {wordCount >= 150 ? '✓ Meets minimum' : '✗ Below 150 min'}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {missingItems.length > 0 && (
                    <div className="mb-2 p-3 rounded-lg" style={{ backgroundColor: '#FBF0DE', borderLeft: '3px solid #d9a441' }}>
                        <p className="text-xs font-semibold mb-1" style={{ fontFamily: "'DM Sans', sans-serif", color: '#92400e' }}>Missing items flagged</p>
                        {missingItems.map((m, i) => (
                            <p key={i} className="text-xs" style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151' }}>· {m}</p>
                        ))}
                    </div>
                )}

                {item.staff_comment && (
                    <div className="flex items-start gap-1.5 p-2.5 rounded-lg"
                        style={{ backgroundColor: status === 'approved' ? '#EAF3EC' : status === 'rejected' ? '#FBE9E9' : '#FBF0DE' }}>
                        <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: cfg.color }} />
                        <div>
                            <p className="text-xs font-semibold" style={{ fontFamily: "'DM Sans', sans-serif", color: cfg.color }}>Officer Feedback:</p>
                            <p className="text-xs" style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151' }}>{item.staff_comment}</p>
                        </div>
                    </div>
                )}

                {status === 'rejected' && onResubmit && (
                    <button onClick={() => onResubmit(item)}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
                        style={{ backgroundColor: '#FBE9E9', color: '#991b1b', border: '1px solid #f3c6c6', fontFamily: "'DM Sans', sans-serif" }}>
                        <XCircle className="w-4 h-4" /> Resubmit this item
                    </button>
                )}
            </div>
        </div>
    );
};

const SubmissionHistory = ({ history = [], loading = false, error = '', onResubmit }) => {
    return (
        <div>
            <header className="mb-8">
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.75rem', fontWeight: 700, color: '#1a1a1a' }}>Submission History</h2>
                <p className="mt-1 pl-4" style={{ fontFamily: "'DM Sans', sans-serif", color: '#9ca3af', fontWeight: 500, borderLeft: `4px solid ${MAROON}` }}>
                    Review your previously submitted requirements.
                </p>
            </header>

            {loading && (
                <div className="bg-white rounded-2xl p-12 text-center" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)' }}>
                    <p className="text-sm text-slate-400 font-medium">Loading your submission history...</p>
                </div>
            )}

            {!loading && error && (
                <div className="bg-white rounded-2xl p-12 text-center" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)', border: '1px solid #f3c6c6' }}>
                    <p className="text-sm font-medium" style={{ color: '#991b1b' }}>{error}</p>
                </div>
            )}

            {!loading && !error && history.length === 0 && (
                <div className="bg-white rounded-2xl p-12 text-center" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)' }}>
                    <p className="text-sm text-slate-400 font-medium">You haven't submitted any requirements yet.</p>
                </div>
            )}

            {!loading && !error && history.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-start gap-2 p-3 rounded-xl mb-1" style={{ backgroundColor: '#F5E8EA', border: '1px solid #e9c9d2' }}>
                        <TrendingUp className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: MAROON }} />
                        <p className="text-xs" style={{ fontFamily: "'DM Sans', sans-serif", color: MAROON }}>
                            <strong>AI Sentiment Analysis:</strong> Each submitted letter is automatically analyzed for tone and completeness by the system. Officers use this to monitor your well-being and ensure your reports meet foundation standards.
                        </p>
                    </div>
                    {history.map(item => <HistoryCard key={item.id} item={item} onResubmit={onResubmit} />)}
                </div>
            )}
        </div>
    );
};

export default SubmissionHistory;