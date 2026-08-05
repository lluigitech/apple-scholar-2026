import React from 'react';
import {
    FileCheck, CheckCircle2, Eye, ChevronDown, ChevronUp,
    Image as ImageIcon, MessageSquare, FileText, GraduationCap,
} from 'lucide-react';
import { Badge, Skeleton, Empty } from './CommonUI';
import FileThumb from './FileThumb';
import { statusBadge, sentimentBadge, qualityColor, getMediaItems, fileKind } from '../../../utils/submissionHelpers';
import { groupByScholarMonth } from '../../../utils/groupSubmissions';

const MAROON = '#7f2d3a';

// One scholar's individual submission row (letter/COR/report-card/media/service hours).
// Unchanged from before, just extracted so it can render inside a grouped card.
const SubmissionDocCard = ({
    sub, expandedDoc, setExpandedDoc, showFull, setShowFull,
    setModal, setDecision, setFeedback, setFilePreview,
}) => {
    const st   = statusBadge(sub.status);
    const sn   = sentimentBadge(sub.sentiment_label);
    const media = getMediaItems(sub);
    const isOpen = expandedDoc === sub.id;
    const longLetter = sub.letter_content?.length > 280;
    const fullLetter = showFull[`d-${sub.id}`];

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all">
            {/* Row */}
            <div className="p-5 flex items-center gap-4">
                <div className="w-1 self-stretch rounded-full shrink-0"
                    style={{ backgroundColor: st.dot }} />

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge bg={st.bg} color={st.color} dot={st.dot}>{st.label}</Badge>
                        {sub.quality_score !== null && (
                            <Badge bg="#f8fafc" color={qualityColor(sub.quality_score)}>
                                {sub.quality_score}% quality
                            </Badge>
                        )}
                        {sub.sentiment_label && (
                            <Badge bg={sn.bg} color={sn.color}>{sn.label}</Badge>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <p className="text-[10px] text-slate-300 hidden sm:block">
                        {new Date(sub.submitted_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    {sub.status === 'pending' && (
                        <button
                            onClick={() => { setModal(sub); setDecision('approved'); setFeedback(''); }}
                            className="flex items-center gap-1.5 text-xs font-black px-4 py-2 rounded-xl text-white transition-all hover:opacity-90"
                            style={{ backgroundColor: MAROON }}>
                            <Eye size={12} /> Review
                        </button>
                    )}
                    <button onClick={() => setExpandedDoc(isOpen ? null : sub.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-xl transition-all hover:bg-slate-50"
                        style={{ color: '#94a3b8' }}>
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>
            </div>

            {/* Expanded */}
            {isOpen && (
                <div className="border-t border-slate-50 px-6 py-5 space-y-5"
                    style={{ backgroundColor: '#fafafa' }}>

                    {/* Letter */}
                    {sub.letter_content && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <MessageSquare size={10} /> Monthly Letter
                                </p>
                                {longLetter && (
                                    <button
                                        onClick={() => setShowFull(p => ({ ...p, [`d-${sub.id}`]: !p[`d-${sub.id}`] }))}
                                        className="text-[10px] font-black uppercase tracking-wider hover:underline"
                                        style={{ color: MAROON }}>
                                        {fullLetter ? 'Show less' : 'Read full'}
                                    </button>
                                )}
                            </div>
                            <div className="bg-white rounded-xl p-4 border border-slate-100">
                                <p className="text-xs text-slate-600 leading-relaxed italic whitespace-pre-line"
                                    style={!fullLetter && longLetter ? {
                                        display: '-webkit-box', WebkitLineClamp: 4,
                                        WebkitBoxOrient: 'vertical', overflow: 'hidden'
                                    } : {}}>
                                    "{sub.letter_content}"
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Photos */}
                    {media.length > 0 && (
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <ImageIcon size={10} /> Photos ({media.length})
                            </p>
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                {media.map((item, i) => (
                                    <FileThumb key={i} url={item.path}
                                        label={item.description || `Photo ${i + 1}`}
                                        onPreview={setFilePreview} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Docs */}
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: 'Report Card', key: 'report_card_path' },
                            { label: 'COR',         key: 'cor_path'         },
                        ].map(doc => (
                            <div key={doc.label} className={`rounded-xl p-3 border flex items-center justify-between ${
                                sub[doc.key] ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'
                            }`}>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{doc.label}</p>
                                    {sub[doc.key]
                                        ? <p className="text-xs font-bold text-emerald-600 mt-0.5">Uploaded</p>
                                        : <p className="text-xs font-bold text-red-400 mt-0.5">Missing</p>}
                                </div>
                                {sub[doc.key] && (
                                    <button
                                        onClick={() => setFilePreview({ url: sub[doc.key], kind: fileKind(sub[doc.key]), label: doc.label })}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-emerald-100 text-emerald-600 hover:bg-emerald-100 transition-all"
                                        style={{ cursor: 'pointer' }}>
                                        <Eye size={12} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Service Hours */}
                    {sub.service_activity && (
                        <div className="bg-white rounded-xl p-3 border border-slate-100 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Community Service</p>
                                <p className="text-xs font-bold text-slate-700 mt-0.5">{sub.service_activity}</p>
                            </div>
                            <span className="text-xs font-black px-3 py-1.5 rounded-xl"
                                style={{ backgroundColor: `${MAROON}12`, color: MAROON }}>
                                {sub.service_hours} hrs
                            </span>
                        </div>
                    )}

                    {/* Feedback */}
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

                    {sub.status !== 'pending' && (
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

// Read-only summary card for a scholar's grades in a given semester.
// Grades are locked at submission time, so no approve/reject needed here.
const GradeSummaryCard = ({ grade, setFilePreview }) => (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
        <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: '#a855f7' }} />
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#f5f0ff', color: '#a855f7' }}>
            <GraduationCap size={16} />
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                Grades · {grade.semester} AY {grade.academic_year}
            </p>
            <p className="text-sm font-bold text-slate-700">
                GWA: <span style={{ color: grade.status === 'passed' ? '#10b981' : '#ef4444' }}>{grade.gwa ?? '—'}</span>
                <span className="text-slate-400 font-normal"> · {grade.subjects.length} subject{grade.subjects.length !== 1 ? 's' : ''}</span>
            </p>
        </div>
        {grade.proof_path && (
            <button
                onClick={() => setFilePreview({ url: grade.proof_path, kind: fileKind(grade.proof_path), label: 'Grades Proof' })}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all shrink-0"
                style={{ cursor: 'pointer' }}>
                <Eye size={12} />
            </button>
        )}
    </div>
);

const DocumentsTab = ({
    loading, submissions, grades = [], expandedDoc, setExpandedDoc,
    showFull, setShowFull, setModal, setDecision, setFeedback,
    setFilePreview,
}) => {
    if (loading) {
        return <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} />)}</div>;
    }

    if (submissions.length === 0 && grades.length === 0) {
        return (
            <div className="bg-white rounded-3xl border border-slate-100">
                <Empty icon={FileCheck} text="No submissions found." />
            </div>
        );
    }

    const groups = groupByScholarMonth(submissions, grades);

    return (
        <div className="space-y-8">
            {groups.map(group => (
                <div key={group.key}>
                    {/* Group header - one per scholar per month */}
                    <div className="flex items-center gap-3 mb-3 px-1">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white shrink-0"
                            style={{ backgroundColor: MAROON }}>
                            {group.full_name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                            <p className="font-black text-slate-800 text-sm leading-none">{group.full_name || 'Unknown Scholar'}</p>
                            <p className="text-[11px] text-slate-400 font-mono mt-1">
                                {group.scholar_id} · {group.periodLabel} · {group.submissionItems.length + group.gradeItems.length} item{(group.submissionItems.length + group.gradeItems.length) !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {group.submissionItems.map(sub => (
                            <SubmissionDocCard
                                key={sub.id}
                                sub={sub}
                                expandedDoc={expandedDoc}
                                setExpandedDoc={setExpandedDoc}
                                showFull={showFull}
                                setShowFull={setShowFull}
                                setModal={setModal}
                                setDecision={setDecision}
                                setFeedback={setFeedback}
                                setFilePreview={setFilePreview}
                            />
                        ))}
                        {group.gradeItems.map((g, i) => (
                            <GradeSummaryCard key={`grade-${i}`} grade={g} setFilePreview={setFilePreview} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default DocumentsTab;