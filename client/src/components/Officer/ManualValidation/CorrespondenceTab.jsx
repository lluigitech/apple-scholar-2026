import {
    Mail, CheckCircle2, XCircle, AlertTriangle,
    ChevronDown, ChevronUp, TrendingUp,
} from 'lucide-react';
import { Badge, Skeleton, Empty } from './CommonUI';
import { statusBadge, sentimentBadge, qualityColor, getMediaItems, fileKind } from '../../../utils/submissionHelpers';
import { groupByScholarMonth } from '../../../utils/groupSubmissions';

const MAROON = '#7f2d3a';

const getLetterMedia = (sub) => {
    if (Array.isArray(sub.media) && sub.media.length > 0) {
        return sub.media
            .map((item) => ({
                path: item.file_path || item.path || item.url,
                description: item.description || item.caption || '',
            }))
            .filter((item) => item.path);
    }
    return getMediaItems(sub);
};

export const LetterDocumentCard = ({ sub }) => {
    const media = getLetterMedia(sub);
    const scholarName = sub.full_name || sub.scholar_id || 'Scholar';
    const year = sub.year_level || '—';
    const course = sub.course || '—';
    const school = sub.school || '—';
    const dateLabel = sub.submitted_at
        ? new Date(sub.submitted_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
        : 'Date unavailable';

    const attachments = [
        { label: 'Report Card', url: sub.report_card_path },
        { label: 'Certificate of Registration', url: sub.cor_path },
    ].filter((item) => item.url);

    return (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-[0_18px_45px_rgba(15,23,42,0.08)] overflow-hidden">
            <div className="p-8" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                <div className="mb-8">
                    <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400 mb-2">Kalinga at Pag-ibig Foundation Inc.</p>
                    <h2 className="text-3xl font-black leading-tight" style={{ fontFamily: "'Playfair Display', serif", color: '#3f2c27' }}>
                        Apple Scholars
                    </h2>
                    <p className="text-sm text-slate-500">Rodriguez, Rizal</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 mb-8 text-sm text-slate-700">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400 mb-2">Name</p>
                        <p className="font-semibold text-slate-800">{scholarName}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400 mb-2">Year</p>
                        <p className="font-semibold text-slate-800">{year}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400 mb-2">Course</p>
                        <p className="font-semibold text-slate-800">{course}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400 mb-2">School</p>
                        <p className="font-semibold text-slate-800">{school}</p>
                    </div>
                </div>

                <div className="space-y-4 mb-8 text-sm text-slate-700 leading-relaxed">
                    <p className="text-slate-500">{dateLabel}</p>
                    <p className="font-semibold">Dear Kalinga,</p>
                    <div className="whitespace-pre-line text-slate-700">
                        {sub.letter_content || <span className="italic text-slate-400">No letter content submitted.</span>}
                    </div>
                    <p className="font-semibold">Your scholar,</p>
                    <p className="text-lg font-black" style={{ fontFamily: "'Playfair Display', serif" }}>{scholarName}</p>
                </div>

                {(media.length > 0 || attachments.length > 0) && (
                    <div className="space-y-6 mb-6">
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400 mb-4 font-black">Documentation</p>
                            <div className="grid gap-4 sm:grid-cols-2">
                                {media.map((item, index) => (
                                    <div key={index} className="rounded-3xl overflow-hidden border border-slate-200 bg-slate-50">
                                        {fileKind(item.path) === 'image' ? (
                                            <img src={item.path} alt={item.description || `Documentation ${index + 1}`}
                                                className="w-full h-40 object-cover" />
                                        ) : (
                                            <div className="flex h-40 items-center justify-center bg-slate-100 text-slate-500">
                                                <span className="text-sm font-semibold">View file</span>
                                            </div>
                                        )}
                                        <div className="p-3 text-xs text-slate-500">
                                            {item.description || `Documentation ${index + 1}`}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {attachments.length > 0 && (
                            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400 mb-3 font-black">Additional attachments</p>
                                <div className="space-y-3">
                                    {attachments.map((item, index) => (
                                        <a key={index} href={item.url} target="_blank" rel="noreferrer"
                                            className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                                            {item.label}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 text-[10px] uppercase tracking-[0.25em] text-slate-500 flex items-center justify-between">
                <span>Page 1</span>
                <span>Kalinga at Pag-ibig Foundation</span>
            </div>
        </div>
    );
};

// One scholar's letter card. Unchanged from before, just extracted so it
// can render nested under a scholar+month group header.
const LetterCard = ({
    sub, expandedCorr, setExpandedCorr,
    corrMode, setCorrMode, corrNote, setCorrNote, submitCorrReview,
    setModal, setDecision, setFeedback,
}) => {
    const st     = statusBadge(sub.status);
    const sn     = sentimentBadge(sub.sentiment_label);
    const isOpen = expandedCorr === sub.id;
    const mode   = corrMode[sub.id] || null;
    const note   = corrNote[sub.id] || '';
    const isNeg  = sub.sentiment_label?.includes('Negative');

    return (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden transition-all"
            style={{ borderColor: isNeg ? '#fecaca' : '#f1f5f9' }}>
            <div className="p-5 flex items-center gap-4">
                <div className="w-1 self-stretch rounded-full shrink-0"
                    style={{ backgroundColor: sn.color === '#94a3b8' ? '#e2e8f0' : sn.color }} />

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge bg={st.bg} color={st.color} dot={st.dot}>{st.label}</Badge>
                        {sub.sentiment_label && (
                            <Badge bg={sn.bg} color={sn.color}>{sn.label}</Badge>
                        )}
                        {isNeg && (
                            <Badge bg="#fee2e2" color="#991b1b">
                                <AlertTriangle size={9} /> Needs attention
                            </Badge>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <p className="text-[10px] text-slate-300 hidden sm:block">
                        {new Date(sub.submitted_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    <button onClick={() => setExpandedCorr(isOpen ? null : sub.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-xl transition-all hover:bg-slate-50"
                        style={{ color: '#94a3b8' }}>
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>
            </div>

            {isOpen && (
                <div className="border-t border-slate-50 px-6 py-5 space-y-5"
                    style={{ backgroundColor: '#fafafa' }}>

                    <LetterDocumentCard sub={sub} />

                    {/* NLP */}
                    {(sub.sentiment_label || sub.quality_score !== null) && (
                        <div className="bg-white rounded-xl p-4 border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                                <TrendingUp size={10} /> NLP Analysis
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {sub.sentiment_label && (
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Sentiment</p>
                                        <Badge bg={sn.bg} color={sn.color}>{sn.label}</Badge>
                                    </div>
                                )}
                                {sub.sentiment_score !== null && (
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Score</p>
                                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full"
                                                style={{
                                                    width: `${Math.min(Math.abs(parseFloat(sub.sentiment_score)) * 100, 100)}%`,
                                                    backgroundColor: sn.color,
                                                }} />
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1 font-mono">{sub.sentiment_score}</p>
                                    </div>
                                )}
                                {sub.quality_score !== null && (
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Quality</p>
                                        <p className="text-2xl font-black" style={{ color: qualityColor(sub.quality_score), fontFamily: "'Playfair Display', serif" }}>
                                            {sub.quality_score}%
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Existing feedback */}
                    {sub.staff_comment && (
                        <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
                            sub.status === 'rejected'
                                ? 'bg-red-50 border-red-100 text-red-700'
                                : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                        }`}>
                            <p className="text-[10px] font-black uppercase tracking-widest mb-1">Officer Feedback</p>
                            {sub.staff_comment}
                        </div>
                    )}

                    {/* Action */}
                    {sub.status === 'pending' ? (
                        <div className="border-t border-slate-100 pt-4">
                            {!mode ? (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setCorrMode(p => ({ ...p, [sub.id]: 'approved' }))}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-90"
                                        style={{ backgroundColor: '#10b981' }}>
                                        <CheckCircle2 size={13} /> Approve
                                    </button>
                                    <button
                                        onClick={() => setCorrMode(p => ({ ...p, [sub.id]: 'rejected' }))}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-90"
                                        style={{ backgroundColor: '#ef4444' }}>
                                        <XCircle size={13} /> Return
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        {mode === 'approved' ? 'Approval note (optional)' : 'Reason for returning *'}
                                    </p>
                                    <textarea rows={3} value={note}
                                        onChange={e => setCorrNote(p => ({ ...p, [sub.id]: e.target.value }))}
                                        placeholder={mode === 'approved'
                                            ? 'Optional note for the scholar...'
                                            : 'Explain what needs to be revised...'}
                                        className="w-full bg-white border border-slate-200 p-3 rounded-xl text-xs text-slate-700 outline-none resize-none" />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => submitCorrReview(sub, mode, note)}
                                            disabled={mode === 'rejected' && !note.trim()}
                                            className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all disabled:opacity-40"
                                            style={{ backgroundColor: mode === 'approved' ? '#10b981' : '#ef4444' }}>
                                            Confirm {mode === 'approved' ? 'Approval' : 'Return'}
                                        </button>
                                        <button
                                            onClick={() => setCorrMode(p => ({ ...p, [sub.id]: null }))}
                                            className="px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-200 text-slate-500 hover:bg-white transition-all">
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={() => { setModal(sub); setDecision(sub.status); setFeedback(sub.staff_comment || ''); }}
                            className="w-full py-2.5 rounded-xl text-xs font-bold border border-slate-200 text-slate-500 hover:bg-white transition-all">
                            Update Review
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

const CorrespondenceTab = ({
    loading, corrList, expandedCorr, setExpandedCorr,
    showFull, setShowFull, corrMode, setCorrMode, corrNote, setCorrNote,
    submitCorrReview, setModal, setDecision, setFeedback,
}) => {
    if (loading) {
        return <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} />)}</div>;
    }

    if (corrList.length === 0) {
        return (
            <div className="bg-white rounded-3xl border border-slate-100">
                <Empty icon={Mail} text="No letters found." />
            </div>
        );
    }

    const groups = groupByScholarMonth(corrList, []);

    return (
        <div className="space-y-8">
            {groups.map(group => (
                <div key={group.key}>
                    <div className="flex items-center gap-3 mb-3 px-1">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white shrink-0"
                            style={{ backgroundColor: MAROON }}>
                            {group.full_name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                            <p className="font-black text-slate-800 text-sm leading-none">{group.full_name || 'Unknown Scholar'}</p>
                            <p className="text-[11px] text-slate-400 font-mono mt-1">
                                {group.scholar_id} · {group.periodLabel}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {group.submissionItems.map(sub => (
                            <LetterCard
                                key={sub.id}
                                sub={sub}
                                expandedCorr={expandedCorr}
                                setExpandedCorr={setExpandedCorr}
                                showFull={showFull}
                                setShowFull={setShowFull}
                                corrMode={corrMode}
                                setCorrMode={setCorrMode}
                                corrNote={corrNote}
                                setCorrNote={setCorrNote}
                                submitCorrReview={submitCorrReview}
                                setModal={setModal}
                                setDecision={setDecision}
                                setFeedback={setFeedback}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default CorrespondenceTab;