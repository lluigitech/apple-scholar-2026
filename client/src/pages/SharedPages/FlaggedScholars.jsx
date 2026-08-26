import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    AlertTriangle, ChevronDown, ChevronUp, Mail,
    BookOpen, Calendar, FileText, TrendingDown,
    MessageSquare, ShieldCheck, RefreshCw, UserX, Clock, Flag
} from 'lucide-react';

const API = 'http://localhost:5000/api';

// ── Token system — shared with the rest of the portal (Manual Validation) ──
const MAROON = '#7f2d3a';
const MAROON_DEEP = '#4f1620';
const GOLD = '#b98b4e';
const GOLD_LIGHT = '#d4af7a';
const IVORY = '#FBF7F2';
const INK = '#241512';
const SAGE = '#6b8f71';
const CLAY = '#c1666b';
const AMBER = '#b8863f';
const PAPER = '#F6EFE4';
const RULE = '#e8dccb';
const ROSE = '#F5E8EA';

const serif = { fontFamily: "'Playfair Display', serif" };
const sans = { fontFamily: "'DM Sans', sans-serif" };
const mono = { fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, monospace" };

// ─── Helpers — recolored onto the shared ledger palette ────────

const riskColor  = (l) => l === 'high' ? CLAY : AMBER;
const riskBg     = (l) => l === 'high' ? `${CLAY}16` : `${AMBER}16`;
const sevColor   = (s) => ({ high: CLAY, medium: AMBER, low: '#8a7a70' }[s] || '#8a7a70');
const sevBg      = (s) => ({ high: `${CLAY}16`, medium: `${AMBER}16`, low: PAPER }[s] || PAPER);
const qualityColor = (q) => q >= 80 ? SAGE : q >= 60 ? AMBER : CLAY;

// Opens a Gmail compose window (in the browser, using the logged-in Google
// account) with the recipient, subject, and a starter message already
// filled in. The staff member can still edit everything — including the
// reason for the home visit — before hitting send inside Gmail itself.
const openGmailCompose = ({ to, subject, body }) => {
    const params = new URLSearchParams({
        view: 'cm',
        fs: '1',
        to,
        su: subject,
        body,
    });
    window.open(`https://mail.google.com/mail/?${params.toString()}`, '_blank', 'noopener,noreferrer');
};

const buildHomeVisitEmail = (scholar) => {
    const subject = `Home Visit Notice - ${scholar.full_name} (${scholar.scholar_id})`;
    const body =
`Hi ${scholar.full_name},

We would like to schedule a home visit as part of our regular scholar monitoring process.

Reason for home visit: [write the reason here]
Proposed date/time: [write your proposed schedule here]

Please let us know if this date works for you or if you'd like to propose another schedule.

Thank you,
Kalinga at Pag-ibig Foundation Inc.`;
    return { to: scholar.email, subject, body };
};

const Badge = ({ bg, color, dot, children }) => (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: bg, color, ...sans, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {dot && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dot }} />}
        {children}
    </span>
);

// ── Risk ring — the card's focal point. A glanceable gauge replaces
// what used to be two separate badges ("High Risk" + "Risk Points").
const RiskRing = ({ score, level }) => {
    const color = riskColor(level);
    const radius = 25, stroke = 5.5;
    const c = 2 * Math.PI * radius;
    const pct = Math.min(100, Math.max(0, score));
    const offset = c - (pct / 100) * c;
    return (
        <div className="relative flex-shrink-0" style={{ width: 62, height: 62 }}>
            <svg width={62} height={62} viewBox="0 0 62 62">
                <circle cx={31} cy={31} r={radius} fill="none" stroke={RULE} strokeWidth={stroke} />
                <circle cx={31} cy={31} r={radius} fill="none" stroke={color} strokeWidth={stroke}
                    strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
                    transform="rotate(-90 31 31)" style={{ transition: 'stroke-dashoffset 0.4s ease' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span style={{ ...serif, fontSize: '1.05rem', fontWeight: 800, color, lineHeight: 1 }}>{Math.round(score)}</span>
                <span style={{ ...sans, fontSize: '0.48rem', fontWeight: 800, color: '#a89890', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>risk</span>
            </div>
        </div>
    );
};

// ── Compact compliance bar — replaces the "Compliance Credits" badge
const ComplianceBar = ({ value, min }) => {
    const short = value < min;
    const color = short ? CLAY : SAGE;
    return (
        <div className="min-w-[120px] max-w-[180px] flex-1">
            <div className="flex items-center justify-between mb-1">
                <span style={{ ...sans, fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#a89890' }}>Compliance</span>
                <span style={{ ...mono, fontSize: '0.66rem', fontWeight: 700, color }}>{value}/{min}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: RULE }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / Math.max(min, 1)) * 100)}%`, background: color }} />
            </div>
        </div>
    );
};

// Small metric components used in the score-explanation panel
const ProbBar = ({ value, color }) => (
    <div className="h-1.5 rounded-full mt-1" style={{ background: RULE }}>
        <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
    </div>
);

// ─── Scholar Card — a flagged case, risk ring first ──

const ScholarCard = ({ scholar }) => {
    const [expanded, setExpanded] = useState(false);
    const [note,     setNote]     = useState('');
    const [saved,    setSaved]    = useState(false);
    const [showExplanation, setShowExplanation] = useState(false);
    const [loggingVisit, setLoggingVisit] = useState(false);

    const s  = scholar.stats;
    const rc = riskColor(scholar.risk_level);
    const rb = riskBg(scholar.risk_level);

    const saveNote = () => {
        if (!note.trim()) return;
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    // Logs the home visit request on the backend (best-effort — the email
    // still opens even if this call fails, so staff never gets blocked by a
    // network hiccup) and then opens Gmail with a pre-filled message.
    const handleHomeVisit = async () => {
        if (!scholar.email) {
            alert('This scholar has no email on file, so a Gmail draft cannot be pre-filled.');
            return;
        }

        setLoggingVisit(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post(
                `${API}/flagged/scholars/${scholar.scholar_id}/home-visit`,
                { note: note?.trim() || null },
                { headers }
            );
        } catch (e) {
            console.error('Failed to log home visit request:', e);
            // Non-blocking: still proceed to open Gmail below.
        } finally {
            setLoggingVisit(false);
        }

        openGmailCompose(buildHomeVisitEmail(scholar));
    };

    const lastSubFormatted = s.last_submission
        ? new Date(s.last_submission).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
        : null;

    const compliancePct = s.total_submissions > 0
        ? Math.round((s.approved / s.total_submissions) * 100)
        : 0;
    const hasGpa = s.gwa !== null && s.gwa !== undefined;
    const riskScore = Number.isFinite(Number(scholar.risk_score)) ? Math.round(Number(scholar.risk_score)) : 0;
    const minCompliance = Number.isFinite(Number(s.min_compliance)) ? Number(s.min_compliance) : 70;
    const overallCompliance = Number.isFinite(Number(scholar.overall_compliance))
        ? Math.round(Number(scholar.overall_compliance))
        : Math.max(0, 100 - riskScore);
    const flags = scholar.flags || [];
    const academicStatus = scholar.academic_status || 'no-record';
    const visibleFlags = flags.slice(0, 3);
    const extraFlags = flags.length - visibleFlags.length;

    return (
        <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: `1px solid ${RULE}` }}>

            <div className="flex items-start gap-4 p-5 flex-wrap sm:flex-nowrap">
                <RiskRing score={riskScore} level={scholar.risk_level} />

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <Badge bg={rb} color={rc}>{scholar.risk_level === 'high' ? 'High Risk' : 'Medium Risk'}</Badge>
                        <p style={{ ...serif, fontSize: '1rem', fontWeight: 700, color: INK }}>{scholar.full_name}</p>
                        <span style={{ ...mono, fontSize: '0.64rem', color: '#c9b3b8' }}>{scholar.scholar_id}</span>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap mb-2.5">
                        <ComplianceBar value={overallCompliance} min={minCompliance} />
                        {hasGpa && <span style={{ ...sans, fontSize: '0.72rem', color: '#6b6058' }}>GPA <b style={{ color: INK }}>{Number(s.gwa).toFixed(2)}</b></span>}
                        <span style={{ ...sans, fontSize: '0.72rem', color: '#6b6058' }}>
                            Attendance <b style={{ color: qualityColor(s.attendance_rate) }}>{s.attendance_rate}%</b>
                        </span>
                        <span style={{ ...sans, fontSize: '0.72rem', color: '#6b6058', textTransform: 'capitalize' }}>{academicStatus.replace('-', ' ')}</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                        {s.negative_letters > 0 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full" style={{ backgroundColor: `${CLAY}16`, color: CLAY, ...sans, fontSize: '0.62rem', fontWeight: 800 }}>
                                <AlertTriangle size={9} /> {s.negative_letters} Negative {s.negative_letters === 1 ? 'Letter' : 'Letters'}
                            </span>
                        )}
                        {visibleFlags.map((flag, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full" style={{ backgroundColor: sevBg(flag.severity), color: sevColor(flag.severity), ...sans, fontSize: '0.62rem', fontWeight: 700 }}>
                                <Flag size={9} /> {flag.description}
                            </span>
                        ))}
                        {extraFlags > 0 && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full" style={{ backgroundColor: PAPER, color: '#a89890', ...sans, fontSize: '0.62rem', fontWeight: 700 }}>
                                +{extraFlags} more
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-auto">
                    <div className="hidden md:flex flex-col items-end gap-1.5">
                        <a href={`mailto:${scholar.email}`}
                            className="flex items-center gap-1.5 text-white transition-opacity hover:opacity-85 whitespace-nowrap"
                            style={{ ...sans, fontSize: '0.72rem', fontWeight: 700, background: MAROON, padding: '6px 14px', borderRadius: 999 }}>
                            <Mail size={12} /> Contact
                        </a>
                        <button onClick={handleHomeVisit} disabled={loggingVisit}
                            className="flex items-center gap-1.5 transition-opacity hover:opacity-85 disabled:opacity-60 whitespace-nowrap"
                            style={{ ...sans, fontSize: '0.72rem', fontWeight: 700, color: MAROON, background: '#fff', border: `1.5px solid ${MAROON}55`, padding: '6px 14px', borderRadius: 999, cursor: loggingVisit ? 'default' : 'pointer' }}>
                            {loggingVisit ? 'Opening…' : 'Home Visit'}
                        </button>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                        <p style={{ ...mono, fontSize: '0.62rem' }}>
                            {lastSubFormatted
                                ? <span style={{ color: s.days_since_submission > 30 ? CLAY : '#c9b3b8', fontWeight: s.days_since_submission > 30 ? 700 : 400 }}>{lastSubFormatted}</span>
                                : <span style={{ color: CLAY, fontWeight: 700 }}>No record</span>}
                        </p>
                        <button onClick={() => setExpanded(!expanded)}
                            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-[#f6efe4]"
                            style={{ color: GOLD, border: `1px solid ${RULE}`, background: '#fff' }}>
                            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* mobile-only action row */}
            <div className="flex md:hidden items-center gap-2 px-5 pb-4">
                <a href={`mailto:${scholar.email}`}
                    className="flex-1 flex items-center justify-center gap-1.5 text-white"
                    style={{ ...sans, fontSize: '0.72rem', fontWeight: 700, background: MAROON, padding: '8px 0', borderRadius: 999 }}>
                    <Mail size={12} /> Contact
                </a>
                <button onClick={handleHomeVisit} disabled={loggingVisit}
                    className="flex-1 flex items-center justify-center gap-1.5 disabled:opacity-60"
                    style={{ ...sans, fontSize: '0.72rem', fontWeight: 700, color: MAROON, background: '#fff', border: `1.5px solid ${MAROON}55`, padding: '8px 0', borderRadius: 999 }}>
                    {loggingVisit ? 'Opening…' : 'Home Visit'}
                </button>
            </div>

            {expanded && (
                <div className="px-5 py-5 space-y-5" style={{ background: PAPER, borderTop: `1px solid ${RULE}` }}>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <p className="flex items-center gap-1.5 mb-3" style={{ ...sans, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: MAROON }}>
                                <BookOpen size={11} /> Submission Record
                            </p>
                            <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: `1px solid ${RULE}` }}>
                                {[
                                    { label: 'Total Submitted', value: s.total_submissions, color: INK },
                                    { label: 'Approved', value: s.approved, color: SAGE },
                                    { label: 'Rejected', value: s.rejected, color: CLAY },
                                    { label: 'Avg Quality', value: `${s.avg_quality}%`, color: qualityColor(s.avg_quality) },
                                    { label: 'GPA', value: hasGpa ? Number(s.gwa).toFixed(2) : 'No grades', color: '#6b6058' },
                                    { label: 'Compliance Credits', value: `${overallCompliance} / ${minCompliance.toFixed(2)} minimum`, color: overallCompliance < minCompliance ? CLAY : SAGE },
                                    { label: 'Compliance', value: `${compliancePct}%`, color: MAROON },
                                ].map((row, i) => (
                                    <div key={i} className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: i > 0 ? `1px solid ${RULE}` : 'none' }}>
                                        <p style={{ ...sans, fontSize: '0.74rem', color: '#a89890' }}>{row.label}</p>
                                        <p style={{ ...sans, fontSize: '0.74rem', fontWeight: 700, color: row.color }}>{row.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <p className="flex items-center gap-1.5 mb-3" style={{ ...sans, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: MAROON }}>
                                <FileText size={11} /> Risk Flags
                            </p>
                            <div className="space-y-2">
                                {flags.length === 0 ? (
                                    <div className="rounded-lg px-4 py-3" style={{ background: '#fff', border: `1px dashed ${RULE}` }}>
                                        <span style={{ ...sans, fontSize: '0.72rem', color: '#a89890', fontStyle: 'italic' }}>No individual flags recorded.</span>
                                    </div>
                                ) : flags.map((flag, i) => (
                                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: sevBg(flag.severity) }}>
                                        <AlertTriangle size={13} style={{ color: sevColor(flag.severity), marginTop: 1, flexShrink: 0 }} />
                                        <div className="flex-1">
                                            <p style={{ ...sans, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: sevColor(flag.severity) }}>{flag.type}</p>
                                            <p style={{ ...sans, fontSize: '0.74rem', color: sevColor(flag.severity), marginTop: 2 }}>{flag.description}</p>
                                        </div>
                                        <span className="shrink-0 px-2 py-0.5 rounded-full" style={{ backgroundColor: sevColor(flag.severity) + '25', color: sevColor(flag.severity), ...sans, fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase' }}>
                                            {flag.severity}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="flex items-center gap-1.5" style={{ ...sans, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: MAROON }}>
                                <Calendar size={11} /> Duty Attendance
                            </p>
                            <p style={{ ...mono, fontSize: '0.66rem', color: '#a89890' }}>{s.present}/{s.total_duties} duties attended</p>
                        </div>
                        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: RULE }}>
                            <div className="h-full rounded-full" style={{ width: `${s.attendance_rate}%`, backgroundColor: s.attendance_rate < 50 ? CLAY : AMBER }} />
                        </div>
                    </div>

                    {s.negative_letters > 0 && (
                        <div>
                            <p className="flex items-center gap-1.5 mb-2" style={{ ...sans, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: MAROON }}>
                                <TrendingDown size={11} /> Sentiment Overview
                            </p>
                            <div className="rounded-lg p-4" style={{ background: `${CLAY}0f`, border: `1px solid ${CLAY}40` }}>
                                <div className="flex items-center justify-between mb-1">
                                    <p style={{ ...sans, fontSize: '0.76rem', fontWeight: 700, color: CLAY }}>
                                        {s.negative_letters} Negative Sentiment {s.negative_letters === 1 ? 'Letter' : 'Letters'}
                                    </p>
                                    {lastSubFormatted && <p style={{ ...sans, fontSize: '0.66rem', color: '#a89890' }}>Last: {lastSubFormatted}</p>}
                                </div>
                                <p style={{ ...sans, fontSize: '0.74rem', fontStyle: 'italic', color: '#a56475' }}>
                                    {s.negative_letters} out of {s.total_submissions} submissions flagged with negative tone by NLP analysis.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="pt-4" style={{ borderTop: `1px solid ${RULE}` }}>
                        <p className="flex items-center gap-1.5 mb-3" style={{ ...sans, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: MAROON }}>
                            <MessageSquare size={11} /> Intervention Notes
                        </p>
                        <textarea rows={3} value={note} onChange={e => setNote(e.target.value)}
                            placeholder="Add intervention notes, home visit schedule, or contact attempts..."
                            className="w-full rounded-lg p-3 outline-none resize-none"
                            style={{ ...sans, fontSize: '0.78rem', color: INK, background: '#fff', border: `1px solid ${RULE}` }} />
                        <div className="flex gap-2 mt-3">
                            <button onClick={saveNote}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-white transition-opacity hover:opacity-90"
                                style={{ ...sans, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', background: MAROON, border: 'none', cursor: 'pointer' }}>
                                {saved ? '✓ Saved' : 'Save Note'}
                            </button>
                            <a href={`mailto:${scholar.email}`}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-full transition-colors hover:bg-white"
                                style={{ ...sans, fontSize: '0.68rem', fontWeight: 700, border: `1px solid ${RULE}`, color: '#6b6058' }}>
                                <Mail size={12} /> Email Scholar
                            </a>
                            <button onClick={() => setShowExplanation(!showExplanation)}
                                className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-full transition-colors hover:bg-white"
                                style={{ ...sans, fontSize: '0.68rem', fontWeight: 700, border: `1px solid ${RULE}`, color: '#6b6058', background: '#fff', cursor: 'pointer' }}>
                                {showExplanation ? 'Hide' : 'Show'} score explanation
                            </button>
                        </div>
                    </div>

                    {showExplanation && (
                        <div className="rounded-lg p-4" style={{ background: ROSE, border: `1px solid ${MAROON}22` }}>
                            <p style={{ ...sans, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: MAROON, marginBottom: 8 }}>Score explanation</p>
                            <ul className="space-y-1.5">
                                {flags.map((f, i) => (
                                    <li key={i} className="flex items-start gap-1.5" style={{ ...sans, fontSize: '0.74rem', color: '#8a5a68' }}>
                                        <span style={{ color: MAROON }}>·</span> <span><b>{f.type}:</b> {f.description}</span>
                                    </li>
                                ))}
                                <li className="flex items-start gap-1.5" style={{ ...sans, fontSize: '0.74rem', color: '#8a5a68' }}><span style={{ color: MAROON }}>·</span> Avg Quality: {s.avg_quality}%</li>
                                <li className="flex items-start gap-1.5" style={{ ...sans, fontSize: '0.74rem', color: '#8a5a68' }}><span style={{ color: MAROON }}>·</span> Attendance: {s.attendance_rate}% ({s.present}/{s.total_duties})</li>
                                <li className="flex items-start gap-1.5" style={{ ...sans, fontSize: '0.74rem', color: '#8a5a68' }}><span style={{ color: MAROON }}>·</span> Compliance credits: {overallCompliance}</li>
                                <li className="flex items-start gap-1.5" style={{ ...sans, fontSize: '0.74rem', color: '#8a5a68' }}><span style={{ color: MAROON }}>·</span> Risk points: {riskScore}</li>
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Main ─────────────────────────────────────────────────────

const getRiskBucket = (riskLevel) => {
    if (riskLevel === 'high') return 'high';
    if (riskLevel === 'medium') return 'medium';
    return 'low';
};

const FlaggedScholars = ({ portalLabel = 'Portal' }) => {
    const [scholars,   setScholars]   = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState('');
    const [riskFilter, setRiskFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [gradeFilter, setGradeFilter] = useState('all');

    const fetchScholars = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.get(`${API}/flagged/scholars`, { headers });
            setScholars(res.data);
        } catch (e) {
            console.error(e);
            setError('Failed to load flagged scholars.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        (async () => {
            await fetchScholars();
        })();
    }, [fetchScholars]);

    const highCount = scholars.filter(s => getRiskBucket(s.risk_level) === 'high').length;
    const medCount  = scholars.filter(s => getRiskBucket(s.risk_level) === 'medium').length;

    const gradeCounts = scholars.reduce((acc, s) => {
        const value = String(s.year_level ?? 'N/A').trim() || 'N/A';
        acc[value] = (acc[value] || 0) + 1;
        return acc;
    }, {});

    const gradeOptions = Object.entries(gradeCounts)
        .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
        .map(([year, count]) => ({ value: year, label: `${year} (${count})` }));

    const filtered  = scholars.filter(s => {
        const riskBucket = getRiskBucket(s.risk_level);
        const normalizedYear = String(s.year_level ?? 'N/A').trim() || 'N/A';

        if (riskFilter !== 'all' && riskBucket !== riskFilter) return false;
        if (gradeFilter !== 'all' && normalizedYear !== gradeFilter) return false;
        if (searchQuery && !((s.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (s.scholar_id || '').toLowerCase().includes(searchQuery.toLowerCase()))) return false;
        return true;
    });

    return (
        <div className="min-h-screen" style={{ backgroundColor: IVORY, ...sans }}>

            {/* ── Ledger header band — same family as Manual Validation, different watch ── */}
            <div className="relative overflow-hidden px-5 sm:px-8 pt-8 pb-11" style={{ background: `linear-gradient(135deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)` }}>
                <svg className="absolute -right-6 -top-8 w-56 h-56 opacity-[0.12] pointer-events-none" viewBox="0 0 200 200" fill="none">
                    <path d="M100 30 L120 80 L175 85 L133 118 L148 172 L100 142 L52 172 L67 118 L25 85 L80 80 Z" fill={GOLD} />
                </svg>
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ border: `1.5px solid ${GOLD}` }}>
                        <ShieldCheck size={12} style={{ color: GOLD }} />
                    </div>
                    <span style={{ ...sans, fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.28em', textTransform: 'uppercase', color: GOLD_LIGHT }}>{portalLabel} · Risk &amp; Intervention</span>
                </div>
                <div className="flex items-end justify-between gap-4 flex-wrap">
                    <div>
                        <h1 style={{ ...serif, fontSize: '2rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>Flagged Scholars</h1>
                        <p style={{ ...sans, fontSize: '0.82rem', color: '#e9c9a8', marginTop: 4 }}>Scholars requiring immediate attention and intervention.</p>
                    </div>
                    <button onClick={fetchScholars}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-full transition-colors hover:opacity-85"
                        style={{ ...sans, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', border: `1.5px solid ${GOLD}55`, color: GOLD_LIGHT, background: 'rgba(255,255,255,0.06)', cursor: 'pointer' }}>
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            <div className="relative z-10 px-5 sm:px-8 -mt-6 pb-10">

                {!loading && (
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5 mb-6">
                        {[
                            { label: 'High Risk', value: highCount, color: CLAY, icon: AlertTriangle },
                            { label: 'Medium Risk', value: medCount, color: AMBER, icon: Clock },
                            { label: 'Total Flagged', value: scholars.length, color: MAROON, icon: UserX },
                        ].map(({ label, value, color, icon: Icon }) => (
                            <div key={label} className="rounded-xl p-4" style={{ background: '#fff', border: `1px solid ${RULE}`, boxShadow: '0 8px 24px -16px rgba(36,21,18,0.25)' }}>
                                <div className="flex items-center justify-between mb-2">
                                    <p style={{ ...sans, fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a89890' }}>{label}</p>
                                    <Icon size={14} style={{ color }} />
                                </div>
                                <p style={{ ...serif, fontSize: '2rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</p>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex gap-2.5 mb-5 flex-wrap items-center">
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search name or ID"
                        className="px-3.5 py-2.5 rounded-full outline-none bg-white"
                        style={{ ...sans, fontSize: '0.8rem', border: `1px solid ${RULE}`, color: INK }} />
                    <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}
                        className="px-3.5 py-2.5 rounded-full outline-none bg-white"
                        style={{ ...sans, fontSize: '0.8rem', border: `1px solid ${RULE}`, color: INK }}>
                        <option value="all">All Years</option>
                        {gradeOptions.map(({ value, label }) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                    <div className="flex items-center gap-2 ml-auto">
                        {[
                            { key: 'all', label: `All · ${scholars.length}` },
                            { key: 'high', label: `High Risk · ${highCount}` },
                            { key: 'medium', label: `Medium Risk · ${medCount}` },
                        ].map(({ key, label }) => (
                            <button key={key} onClick={() => setRiskFilter(key)}
                                className="px-3.5 py-2 rounded-full transition-colors"
                                style={
                                    riskFilter === key
                                        ? { ...sans, fontSize: '0.7rem', fontWeight: 700, background: MAROON, color: '#fff', border: `1px solid ${MAROON}`, cursor: 'pointer' }
                                        : { ...sans, fontSize: '0.7rem', fontWeight: 700, backgroundColor: '#fff', color: '#8a7a70', border: `1px solid ${RULE}`, cursor: 'pointer' }
                                }>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="space-y-3">
                        {Array(3).fill(0).map((_, i) => (
                            <div key={i} className="animate-pulse rounded-xl h-24" style={{ background: '#EFE7E2' }} />
                        ))}
                    </div>
                ) : error ? (
                    <div className="rounded-xl p-8 text-center" style={{ background: `${CLAY}10`, border: `1px solid ${CLAY}40` }}>
                        <AlertTriangle size={28} className="mx-auto mb-2" style={{ color: CLAY }} />
                        <p style={{ ...sans, fontSize: '0.85rem', fontWeight: 700, color: CLAY }}>{error}</p>
                        <button onClick={fetchScholars} className="mt-3" style={{ ...sans, fontSize: '0.76rem', fontWeight: 700, color: CLAY, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>Try again</button>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="rounded-xl flex flex-col items-center justify-center py-20" style={{ background: '#fff', border: `1px dashed ${RULE}` }}>
                        <UserX size={44} strokeWidth={1} style={{ color: '#e9d9dc' }} className="mb-3" />
                        <p style={{ ...sans, fontSize: '0.85rem', fontWeight: 700, color: '#c9b3b8' }}>No flagged scholars found.</p>
                        <p style={{ ...sans, fontSize: '0.75rem', color: '#c9b3b8', marginTop: 4 }}>All scholars are currently compliant.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map(s => <ScholarCard key={s.scholar_id} scholar={s} />)}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FlaggedScholars;