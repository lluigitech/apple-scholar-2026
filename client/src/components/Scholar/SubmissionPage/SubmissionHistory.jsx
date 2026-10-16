import { useMemo, useState } from 'react';
import { CheckCircle, XCircle, Clock, MessageSquare, Mail, GraduationCap, IdCard, Folder, ChevronDown, ChevronUp, Archive } from 'lucide-react';

// ── Design tokens — Apple Scholar Portal system ──
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const PRIMARY = '#6D2140';
const PRIMARY_TINT = 'rgba(109, 33, 64, 0.08)';
const BRONZE = '#A9784E';
const INK = '#241512';
const MUTED = '#8A7A68';
const SUCCESS = '#6B8F71';
const WARNING = '#B8863F';
const DANGER = '#C1666B';
const RADIUS = 16;

const display = { fontFamily: "'Playfair Display', Georgia, serif" };
const body = { fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif" };

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
    approved: { label: 'Approved',              color: SUCCESS, Icon: CheckCircle },
    rejected: { label: 'Returned for Revision',  color: DANGER,  Icon: XCircle },
    returned: { label: 'Returned for Revision',  color: DANGER,  Icon: XCircle },
    pending:  { label: 'Pending Review',         color: WARNING, Icon: Clock },
};

// Submission records carry no explicit academic-year field, so the
// timeline groups them by the Philippine academic year (June–May)
// derived from `submitted_at` — a real, existing field, not new data.
const academicYearOf = (dateStr) => {
    if (!dateStr) return 'Undated';
    const d = new Date(dateStr);
    if (isNaN(d)) return 'Undated';
    const y = d.getFullYear();
    const m = d.getMonth(); // 0-indexed; June = 5
    return m >= 5 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
};

const AlertStrip = ({ color, icon: Icon, title, children }) => (
    <div className="flex items-start gap-2" style={{ borderLeft: `3px solid ${color}`, background: `${color}0d`, borderRadius: 8, padding: '10px 14px' }}>
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color }} />}
        <div>
            {title && <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', color, marginBottom: 3, textTransform: 'uppercase' }}>{title}</p>}
            <p style={{ ...body, fontSize: '0.79rem', color: INK, lineHeight: 1.5 }}>{children}</p>
        </div>
    </div>
);

// One card per submission — same underlying computations as before
// (sentiment %, completeness, word count, missing-item heuristics),
// now shown as a compact summary that expands for the full breakdown.
const HistoryCard = ({ item, onResubmit }) => {
    const [expanded, setExpanded] = useState(false);

    const status = item.status || 'pending';
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    const StatusIcon = cfg.Icon;
    const isLetter = item.submission_type === 'letter';

    const wordCount = isLetter && item.letter_content
        ? item.letter_content.trim().split(/\s+/).filter(Boolean).length
        : null;

    const sentimentPct = item.sentiment_score !== null && item.sentiment_score !== undefined
        ? Math.max(0, Math.min(100, Math.round(((parseFloat(item.sentiment_score) + 1) / 2) * 100)))
        : null;
    const sentColor = sentimentPct === null ? MUTED : sentimentPct >= 70 ? SUCCESS : sentimentPct >= 40 ? WARNING : DANGER;

    const completeness = isLetter && item.quality_score !== null && item.quality_score !== undefined
        ? Number(item.quality_score)
        : null;

    const hasMedia = !!item.media_paths;

    const missingItems = [];
    if (isLetter) {
        if (wordCount !== null && wordCount < 150) {
            missingItems.push(`Below word count (150 min) - currently ${wordCount}`);
        }
        if (!hasMedia) {
            missingItems.push('No documentation photos attached');
        }
    }

    const TypeIcon = TYPE_ICONS[item.submission_type] || Mail;
    const scoreToShow = completeness !== null ? `${completeness}%` : sentimentPct !== null ? `${sentimentPct}/100` : null;

    return (
        <div className="overflow-hidden" style={{ background: SURFACE, border: `1px solid ${status === 'rejected' || status === 'returned' ? `${DANGER}55` : BORDER}`, borderRadius: RADIUS }}>
            <button
                onClick={() => setExpanded(v => !v)}
                className="w-full flex items-center justify-between gap-3 flex-wrap text-left transition-colors"
                style={{ padding: '16px 18px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
                {/* LEFT — icon, title, date, type */}
                <div className="flex items-center gap-3 min-w-0">
                    <span className="flex items-center justify-center flex-shrink-0" style={{ width: 34, height: 34, borderRadius: 10, background: PRIMARY_TINT }}>
                        <TypeIcon className="w-4 h-4" style={{ color: PRIMARY }} />
                    </span>
                    <div className="min-w-0">
                        <p style={{ ...body, fontSize: '0.88rem', fontWeight: 700, color: INK }}>
                            {TYPE_LABELS[item.submission_type] || 'Submission'}
                        </p>
                        <p style={{ ...body, fontSize: '0.74rem', color: MUTED, marginTop: 1 }}>
                            {formatDate(item.submitted_at)}{wordCount !== null ? ` · ${wordCount} words` : ''}
                        </p>
                    </div>
                </div>

                {/* RIGHT — status badge, score, expand indicator */}
                <div className="flex items-center gap-3 flex-shrink-0">
                    {scoreToShow && (
                        <span style={{ ...display, fontSize: '0.95rem', fontWeight: 700, color: sentColor }}>{scoreToShow}</span>
                    )}
                    <span className="flex items-center gap-1.5"
                        style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase', color: cfg.color, background: `${cfg.color}14`, padding: '4px 11px', borderRadius: 999 }}>
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label}
                    </span>
                    {expanded ? <ChevronUp size={15} style={{ color: MUTED }} /> : <ChevronDown size={15} style={{ color: MUTED }} />}
                </div>
            </button>

            {expanded && (
                <div className="px-[18px] pb-[18px]" style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14 }}>
                    {isLetter && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x mb-3" style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, borderColor: BORDER }}>
                            <div className="p-3 sm:px-4">
                                <p style={{ ...body, fontSize: '0.64rem', fontWeight: 700, color: BRONZE, letterSpacing: '0.03em', marginBottom: 4 }}>SENTIMENT</p>
                                <p style={{ ...body, fontSize: '0.85rem', fontWeight: 700, color: sentColor }}>
                                    {item.sentiment_label || 'N/A'}{sentimentPct !== null ? ` · ${sentimentPct}/100` : ''}
                                </p>
                                {sentimentPct !== null && (
                                    <div className="w-full mt-1.5 overflow-hidden" style={{ height: 4, borderRadius: 999, background: BORDER }}>
                                        <div className="h-full" style={{ width: `${sentimentPct}%`, background: sentColor, borderRadius: 999 }} />
                                    </div>
                                )}
                            </div>
                            <div className="p-3 sm:px-4">
                                <p style={{ ...body, fontSize: '0.64rem', fontWeight: 700, color: BRONZE, letterSpacing: '0.03em', marginBottom: 4 }}>COMPLETENESS</p>
                                <p style={{ ...body, fontSize: '0.85rem', fontWeight: 700, color: completeness !== null && completeness >= 80 ? SUCCESS : WARNING }}>
                                    {completeness !== null ? `${completeness}%` : 'N/A'}
                                </p>
                                {completeness !== null && (
                                    <div className="w-full mt-1.5 overflow-hidden" style={{ height: 4, borderRadius: 999, background: BORDER }}>
                                        <div className="h-full" style={{ width: `${completeness}%`, background: completeness >= 80 ? SUCCESS : WARNING, borderRadius: 999 }} />
                                    </div>
                                )}
                            </div>
                            <div className="p-3 sm:px-4">
                                <p style={{ ...body, fontSize: '0.64rem', fontWeight: 700, color: BRONZE, letterSpacing: '0.03em', marginBottom: 4 }}>WORD COUNT</p>
                                <p style={{ ...body, fontSize: '0.85rem', fontWeight: 700, color: wordCount !== null && wordCount >= 150 ? SUCCESS : DANGER }}>
                                    {wordCount !== null ? `${wordCount} words` : 'N/A'}
                                </p>
                                {wordCount !== null && (
                                    <p style={{ ...body, fontSize: '0.66rem', marginTop: 5, fontWeight: 700, color: wordCount >= 150 ? SUCCESS : DANGER }}>
                                        {wordCount >= 150 ? '✓ Meets minimum' : '✗ Below 150 min'}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {missingItems.length > 0 && (
                        <div className="mb-3">
                            <AlertStrip color={WARNING} title="Missing items flagged">
                                {missingItems.map((m, i) => <span key={i} className="block">· {m}</span>)}
                            </AlertStrip>
                        </div>
                    )}

                    {/* ── 5. Officer feedback — soft comment container ──── */}
                    {item.staff_comment && (
                        <div className="flex items-start gap-2.5" style={{ background: BG, borderRadius: 12, padding: '12px 14px' }}>
                            <MessageSquare size={14} style={{ color: cfg.color, marginTop: 2, flexShrink: 0 }} />
                            <div>
                                <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, color: cfg.color, letterSpacing: '0.03em', marginBottom: 2 }}>OFFICER REMARKS</p>
                                <p style={{ ...body, fontSize: '0.82rem', color: INK, lineHeight: 1.55 }}>{item.staff_comment}</p>
                            </div>
                        </div>
                    )}

                    {/* ── 6. Resubmission ─────────────────────────────── */}
                    {status === 'rejected' && onResubmit && (
                        <button onClick={() => onResubmit(item)}
                            className="mt-3 inline-flex items-center gap-2 transition-opacity hover:opacity-85"
                            style={{ padding: '9px 16px', borderRadius: 999, ...body, fontSize: '0.82rem', fontWeight: 700, background: `${DANGER}14`, color: DANGER, border: `1px solid ${DANGER}44`, cursor: 'pointer' }}>
                            <XCircle className="w-4 h-4" /> Resubmit this item
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

const SubmissionHistory = ({ history = [], loading = false, error = '', onResubmit }) => {
    const [selectedYear, setSelectedYear] = useState('all');

    // Group by derived academic year, newest first — purely client-side,
    // no backend logic touched.
    const years = useMemo(() => {
        const set = new Set(history.map(item => academicYearOf(item.submitted_at)));
        return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
    }, [history]);

    const filteredHistory = selectedYear === 'all'
        ? history
        : history.filter(item => academicYearOf(item.submitted_at) === selectedYear);

    const counts = {
        total: history.length,
        approved: history.filter(i => i.status === 'approved').length,
        pending: history.filter(i => !i.status || i.status === 'pending').length,
    };

    return (
        <div style={{ ...body }}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Inter:wght@400;500;600;700&display=swap');`}</style>

            {/* ── 1. Scholar header ─────────────────────────────────── */}
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '18px 22px', marginBottom: 20 }}>
                <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', color: BRONZE }}>SCHOLAR PORTAL</p>
                <h1 style={{ ...display, fontSize: '1.5rem', fontWeight: 600, color: INK, marginTop: 4 }}>Submission History</h1>
                <p style={{ ...body, fontSize: '0.83rem', color: MUTED, marginTop: 5 }}>
                    Review your submitted reports, grades, and official documents.
                </p>
            </div>

            {loading && (
                <div className="text-center" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '48px 20px' }}>
                    <p style={{ ...body, fontSize: '0.82rem', color: MUTED }}>Loading your submission history…</p>
                </div>
            )}

            {!loading && error && (
                <div className="text-center" style={{ background: SURFACE, border: `1px solid ${DANGER}44`, borderRadius: RADIUS, padding: '48px 20px' }}>
                    <p style={{ ...body, fontSize: '0.85rem', fontWeight: 600, color: DANGER }}>{error}</p>
                </div>
            )}

            {!loading && !error && history.length === 0 && (
                <div className="flex flex-col items-center gap-3 text-center" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '64px 20px' }}>
                    <div className="flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: '50%', background: PRIMARY_TINT }}>
                        <Archive size={22} style={{ color: PRIMARY }} />
                    </div>
                    <p style={{ ...display, fontSize: '1.05rem', fontWeight: 600, color: INK }}>No submissions yet</p>
                    <p className="max-w-sm" style={{ ...body, fontSize: '0.83rem', color: MUTED, lineHeight: 1.6 }}>
                        Your academic submissions will appear here after your first report.
                    </p>
                </div>
            )}

            {!loading && !error && history.length > 0 && (
                <>
                    {/* ── 2. Academic overview — 3 stat cards ───────────── */}
                    <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-5">
                        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS - 4, padding: '14px 16px' }}>
                            <p style={{ ...body, fontSize: '0.68rem', fontWeight: 600, color: BRONZE }}>Total</p>
                            <p style={{ ...display, fontSize: '1.4rem', fontWeight: 700, color: INK, marginTop: 4 }}>{counts.total}</p>
                        </div>
                        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS - 4, padding: '14px 16px' }}>
                            <p style={{ ...body, fontSize: '0.68rem', fontWeight: 600, color: BRONZE }}>Approved</p>
                            <p style={{ ...display, fontSize: '1.4rem', fontWeight: 700, color: SUCCESS, marginTop: 4 }}>{counts.approved}</p>
                        </div>
                        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS - 4, padding: '14px 16px' }}>
                            <p style={{ ...body, fontSize: '0.68rem', fontWeight: 600, color: BRONZE }}>Pending Review</p>
                            <p style={{ ...display, fontSize: '1.4rem', fontWeight: 700, color: WARNING, marginTop: 4 }}>{counts.pending}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-[160px_minmax(0,1fr)] gap-5">

                        {/* ── 3. Semester timeline sidebar ────────────────── */}
                        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '16px 14px', height: 'fit-content' }}>
                            <p style={{ ...body, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.05em', color: BRONZE, marginBottom: 12, paddingLeft: 4 }}>ACADEMIC YEARS</p>
                            <div className="relative" style={{ paddingLeft: 18 }}>
                                <div className="absolute" style={{ left: 5, top: 4, bottom: 4, width: 2, background: BORDER }} />

                                <button
                                    onClick={() => setSelectedYear('all')}
                                    className="relative flex items-center gap-2 w-full text-left transition-colors"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}
                                >
                                    <span className="absolute" style={{ left: -18, width: 11, height: 11, borderRadius: '50%', background: selectedYear === 'all' ? PRIMARY : '#fff', border: `2px solid ${PRIMARY}` }} />
                                    <span style={{ ...body, fontSize: '0.8rem', fontWeight: selectedYear === 'all' ? 700 : 500, color: INK }}>All Years</span>
                                </button>

                                {years.map((y) => (
                                    <button
                                        key={y}
                                        onClick={() => setSelectedYear(y)}
                                        className="relative flex items-center gap-2 w-full text-left transition-colors"
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}
                                    >
                                        <span className="absolute" style={{ left: -18, width: 11, height: 11, borderRadius: '50%', background: selectedYear === y ? PRIMARY : '#fff', border: `2px solid ${PRIMARY}` }} />
                                        <span style={{ ...body, fontSize: '0.8rem', fontWeight: selectedYear === y ? 700 : 500, color: INK }}>
                                            {y === 'Undated' ? y : `AY ${y}`}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ── 4. Modern submission cards ──────────────────── */}
                        <div className="space-y-3">
                            {filteredHistory.map(item => (
                                <HistoryCard key={item.id} item={item} onResubmit={onResubmit} />
                            ))}
                            {filteredHistory.length === 0 && (
                                <p style={{ ...body, fontSize: '0.82rem', color: MUTED, textAlign: 'center', padding: '32px 0' }}>
                                    No submissions recorded for this academic year.
                                </p>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default SubmissionHistory;