import { X, CheckCircle, Clock, XCircle, Download, Image as ImageIcon } from 'lucide-react';

const MAROON = '#802B36';
const MAROON_LIGHT = '#F5E8EA';

// ─── Helpers ──────────────────────────────────────────────────

const getQualityColor = (score) => {
    if (!score && score !== 0) return '#6b7280';
    if (score >= 71) return '#16a34a';
    if (score >= 51) return '#d97706';
    return '#ef4444';
};

const getQualityLabel = (status) => {
    if (status === 'accepted')    return { label: 'Accepted',    color: '#16a34a', bg: '#dcfce7' };
    if (status === 'medium_risk') return { label: 'Medium Risk', color: '#d97706', bg: '#fef9c3' };
    if (status === 'high_risk')   return { label: 'High Risk',   color: '#ef4444', bg: '#fee2e2' };
    return                               { label: 'Pending',     color: '#6b7280', bg: '#f3f4f6' };
};

const getSentimentStyle = (label) => {
    if (!label) return { color: '#6b7280', bg: '#f3f4f6' };
    if (label.includes('Positive')) return { color: '#15803d', bg: '#dcfce7' };
    if (label === 'Neutral')        return { color: '#854d0e', bg: '#fef9c3' };
    return                                 { color: '#991b1b', bg: '#fee2e2' };
};

const getStatusBadge = (status) => {
    if (status === 'approved') return { Icon: CheckCircle, color: '#15803d', bg: '#dcfce7', label: 'Approved'       };
    if (status === 'rejected') return { Icon: XCircle,     color: '#991b1b', bg: '#fee2e2', label: 'Rejected'       };
    return                            { Icon: Clock,        color: '#854d0e', bg: '#fef9c3', label: 'Pending Review' };
};

// Parse GROUP_CONCAT strings from backend into arrays
const getMediaItems = (submission) => {
    if (!submission?.media_paths) return [];
    const paths = submission.media_paths.split(',').filter(Boolean);
    const descs = submission.media_descriptions
        ? submission.media_descriptions.split(',')
        : [];
    return paths.map((path, i) => ({ path: path.trim(), description: descs[i]?.trim() || '' }));
};

// ─── Main Component ────────────────────────────────────────────

/**
 * ScholarLetterView
 * Renders an official Kalinga Foundation letter in a modal.
 *
 * Props:
 *   submission  — the full submission object from the API
 *                 (must include: letter_content, quality_score, quality_status,
 *                  sentiment_label, sentiment_score, status, submitted_at,
 *                  full_name, scholar_id / sid, year_level,
 *                  report_card_path, cor_path, media_paths, media_descriptions,
 *                  staff_comment)
 *   onClose     — function called when modal is dismissed
 */
const ScholarLetterView = ({ submission, onClose }) => {
    if (!submission) return null;

    const mediaItems = getMediaItems(submission);
    const qualityInfo = getQualityLabel(submission.quality_status);
    const sentimentStyle = getSentimentStyle(submission.sentiment_label);
    const statusBadge = getStatusBadge(submission.status);
    const StatusIcon = statusBadge.Icon;

    const submittedDate = submission.submitted_at
        ? new Date(submission.submitted_at).toLocaleDateString('en-PH', {
              month: 'long', day: 'numeric', year: 'numeric'
          })
        : '—';

    const submittedTime = submission.submitted_at
        ? new Date(submission.submitted_at).toLocaleTimeString('en-PH', {
              hour: '2-digit', minute: '2-digit'
          })
        : '';

    // Split letter body into paragraphs for proper rendering
    const paragraphs = (submission.letter_content || '')
        .split(/\n\n+/)
        .map(p => p.trim())
        .filter(Boolean);

    return (
        <div
            className="fixed inset-0 z-50 overflow-y-auto"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="min-h-screen flex items-start justify-center p-4 pt-8 pb-16">
                <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden">

                    {/* ── Modal Header ── */}
                    <div
                        className="flex items-center justify-between px-6 py-4"
                        style={{ background: MAROON_LIGHT, borderBottom: '1px solid #f3d0d4' }}
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="min-w-0">
                                <p style={{ fontFamily: "'Playfair Display',serif", fontSize: '0.95rem', fontWeight: 700, color: MAROON }}>
                                    Monthly Report Letter
                                </p>
                                <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.74rem', color: '#9ca3af' }}>
                                    {submission.full_name} · {submittedDate} · {submittedTime}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Status badge */}
                            <span
                                className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
                                style={{ backgroundColor: statusBadge.bg, color: statusBadge.color }}
                            >
                                <StatusIcon className="w-3.5 h-3.5" />
                                {statusBadge.label}
                            </span>
                            {/* Quality badge */}
                            <span
                                className="text-xs font-bold px-2.5 py-1 rounded-full"
                                style={{ backgroundColor: qualityInfo.bg, color: qualityInfo.color }}
                            >
                                {submission.quality_score}% · {qualityInfo.label}
                            </span>
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white/60 transition-all"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* ── AI Analysis Bar ── */}
                    <div className="px-6 py-3 flex items-center gap-6 flex-wrap" style={{ background: '#1e2a3a', borderBottom: '1px solid #0f1923' }}>
                        <div>
                            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                                Quality Score
                            </p>
                            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '1rem', fontWeight: 800, color: getQualityColor(submission.quality_score) }}>
                                {submission.quality_score ?? '—'}/100
                            </p>
                        </div>
                        <div>
                            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                                Sentiment
                            </p>
                            <span
                                className="text-xs font-bold px-2 py-0.5 rounded-lg inline-block mt-0.5"
                                style={{ backgroundColor: sentimentStyle.bg, color: sentimentStyle.color }}
                            >
                                {submission.sentiment_label || 'N/A'}
                            </span>
                        </div>
                        <div>
                            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                                Word Count
                            </p>
                            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '1rem', fontWeight: 800, color: '#94a3b8' }}>
                                {submission.letter_content
                                    ? submission.letter_content.trim().split(/\s+/).filter(Boolean).length
                                    : 0} words
                            </p>
                        </div>
                        {submission.staff_comment && (
                            <div className="ml-auto">
                                <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                                    Staff Feedback
                                </p>
                                <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.75rem', color: '#94a3b8', maxWidth: 200 }} className="truncate">
                                    {submission.staff_comment}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* ── Scrollable Letter Body ── */}
                    <div className="overflow-y-auto" style={{ maxHeight: '70vh' }}>

                        {/* Staff feedback banner (if reviewed) */}
                        {submission.staff_comment && (
                            <div
                                className="mx-6 mt-5 rounded-xl p-4 flex items-start gap-3"
                                style={{
                                    background: submission.status === 'approved' ? '#f0fdf4' : submission.status === 'rejected' ? '#fef2f2' : '#f0f9ff',
                                    border: `1px solid ${submission.status === 'approved' ? '#bbf7d0' : submission.status === 'rejected' ? '#fecaca' : '#bae6fd'}`
                                }}
                            >
                                <StatusIcon
                                    className="w-4 h-4 flex-shrink-0 mt-0.5"
                                    style={{ color: statusBadge.color }}
                                />
                                <div>
                                    <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.75rem', fontWeight: 700, color: statusBadge.color, marginBottom: 3 }}>
                                        Staff Feedback
                                    </p>
                                    <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.82rem', color: '#374151', lineHeight: 1.55 }}>
                                        {submission.staff_comment}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* ── Official Letter Template ── */}

                        {/* Letterhead */}
                        <div
                            className="text-center pt-8 pb-5 px-8"
                            style={{ borderBottom: '2px solid #f3d0d4', background: MAROON_LIGHT, marginTop: submission.staff_comment ? 16 : 0 }}
                        >
                            <p style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.05rem', fontWeight: 700, color: MAROON }}>
                                Kalinga at Pag-ibig Foundation Inc.
                            </p>
                            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.82rem', fontWeight: 600, color: '#6b7280', marginTop: 2 }}>
                                Apple Scholars
                            </p>
                            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.79rem', color: '#9ca3af', marginTop: 1 }}>
                                Rodriguez, Rizal
                            </p>
                        </div>

                        {/* Scholar Info Table */}
                        <div className="grid grid-cols-2 gap-0 mx-8 my-5 rounded-xl overflow-hidden" style={{ border: '1px solid #f3f4f6' }}>
                            {[
                                ['Name',       submission.full_name || '—'                ],
                                ['Scholar ID', submission.scholar_id || submission.sid || '—'],
                                ['Year Level', submission.year_level || '—'               ],
                                ['Date',       submittedDate                              ],
                            ].map(([label, value], i) => (
                                <div
                                    key={i}
                                    className="px-4 py-3"
                                    style={{
                                        borderRight:  i % 2 === 0 ? '1px solid #f3f4f6' : 'none',
                                        borderBottom: i < 2       ? '1px solid #f3f4f6' : 'none',
                                        background:   i % 2 === 0 ? '#fafafa'           : '#fff',
                                    }}
                                >
                                    <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.65rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
                                        {label}
                                    </p>
                                    <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
                                        {value}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* Letter Body */}
                        <div className="px-10 pb-6">
                            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.9rem', lineHeight: 1.8, color: '#374151', marginBottom: 16 }}>
                                Dear Kalinga,
                            </p>

                            {paragraphs.length > 0 ? paragraphs.map((para, i) => (
                                <p
                                    key={i}
                                    style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', marginBottom: 14, textIndent: '2rem' }}
                                >
                                    {para}
                                </p>
                            )) : (
                                <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.85rem', color: '#9ca3af', fontStyle: 'italic' }}>
                                    No letter content submitted.
                                </p>
                            )}

                            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.9rem', lineHeight: 1.8, color: '#374151', marginTop: 24, marginBottom: 2 }}>
                                Your scholar,
                            </p>
                            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.9rem', fontWeight: 700, color: '#1a1a1a' }}>
                                {submission.full_name || '—'}
                            </p>
                        </div>

                        {/* Documentation Photos */}
                        {mediaItems.length > 0 && (
                            <div className="px-10 pb-8" style={{ borderTop: '1px solid #f3f4f6' }}>
                                <div className="flex items-center gap-2 mt-6 mb-4">
                                    <ImageIcon size={14} style={{ color: MAROON }} />
                                    <p style={{ fontFamily: "'Playfair Display',serif", fontSize: '0.95rem', fontWeight: 700, color: '#1a1a1a' }}>
                                        Documentation ({mediaItems.length} photo{mediaItems.length > 1 ? 's' : ''})
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {mediaItems.map((item, i) => (
                                        <div key={i}>
                                            <a
                                                href={`http://localhost:5000/${item.path}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="block rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:opacity-90 transition-opacity"
                                                style={{ height: 150 }}
                                            >
                                                <img
                                                    src={`http://localhost:5000/${item.path}`}
                                                    alt={item.description || `Documentation ${i + 1}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            </a>
                                            {item.description && (
                                                <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.72rem', color: '#6b7280', marginTop: 5, textAlign: 'center', fontStyle: 'italic', lineHeight: 1.4 }}>
                                                    ({item.description})
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-6 pt-4" style={{ borderTop: '1px dashed #e5e7eb' }}>
                                    <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center' }}>
                                        (Report Card and Certificate of Enrollment)
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Attached Documents row */}
                        {(submission.report_card_path || submission.cor_path) && (
                            <div className="mx-8 mb-6 grid grid-cols-2 gap-3">
                                {[
                                    { label: 'Report Card', path: submission.report_card_path },
                                    { label: 'COR',         path: submission.cor_path         },
                                ].map(doc => (
                                    <div
                                        key={doc.label}
                                        className="p-3 rounded-xl border text-center"
                                        style={doc.path ? { background: '#f0fdf4', borderColor: '#bbf7d0' } : { background: '#f9fafb', borderColor: '#e5e7eb' }}
                                    >
                                        <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            {doc.label}
                                        </p>
                                        {doc.path ? (
                                            <a
                                                href={`http://localhost:5000/${doc.path}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center justify-center gap-1 mt-1 text-xs font-bold"
                                                style={{ color: '#16a34a' }}
                                            >
                                                <Download size={11} /> View File
                                            </a>
                                        ) : (
                                            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.75rem', fontWeight: 700, color: '#ef4444', marginTop: 4 }}>
                                                ❌ Not submitted
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Page footer */}
                        <div
                            className="flex items-center justify-between px-8 py-3"
                            style={{ borderTop: '1px solid #f3f4f6', background: '#fafafa' }}
                        >
                            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.7rem', color: '#d1d5db' }}>
                                Page 1 / Apple Scholar
                            </span>
                            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.7rem', color: '#d1d5db' }}>
                                {submittedDate}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScholarLetterView;