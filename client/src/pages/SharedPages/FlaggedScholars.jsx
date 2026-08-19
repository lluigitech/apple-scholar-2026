import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    AlertTriangle, ChevronDown, ChevronUp, Mail,
    BookOpen, Calendar, FileText, TrendingDown,
    MessageSquare, ShieldCheck, RefreshCw, UserX, Clock
} from 'lucide-react';

const API = 'http://localhost:5000/api';

// ── Token system — shared across the whole portal ──
const MAROON = '#7f2d3a';
const MAROON_DEEP = '#4f1620';
const GOLD = '#b98b4e';
const IVORY = '#FBF7F2';
const INK = '#241512';
const ROSE = '#F5E8EA';

// ─── Helpers — recolored onto the shared ledger palette ────────

const riskColor  = (l) => l === 'high' ? '#991b1b' : '#92400e';
const riskBg     = (l) => l === 'high' ? '#FBE9E9' : '#FBF0DE';
const riskDot    = (l) => l === 'high' ? '#991b1b' : '#92400e';
const sevColor   = (s) => ({ high: '#991b1b', medium: '#92400e', low: '#6b6058' }[s] || '#6b6058');
const sevBg      = (s) => ({ high: '#FBE9E9', medium: '#FBF0DE', low: '#f1ece8' }[s] || '#f1ece8');
const qualityColor = (q) => q >= 80 ? '#15803d' : q >= 60 ? '#92400e' : '#991b1b';

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
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] px-2.5 py-1 rounded-full"
        style={{ backgroundColor: bg, color, fontFamily: "'DM Sans', sans-serif" }}>
        {dot && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dot }} />}
        {children}
    </span>
);

// Small metric components used in PredictiveRisk UI
const ProbBar = ({ value, color }) => (
    <div>
        <div className="h-1.5 rounded-full mt-1" style={{ background: '#f0e6e0' }}>
            <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
        </div>
    </div>
);

const MetricPill = ({ label, value, color }) => (
    <div className="rounded-lg px-3 py-2 text-center min-w-[88px]" style={{ background: IVORY, border: '1px solid #f0e6e0' }}>
        <div className="text-[10px] mb-0.5" style={{ fontFamily: "'DM Sans', sans-serif", color: '#a89890' }}>{label}</div>
        <div className="text-sm font-semibold" style={{ fontFamily: "'DM Sans', sans-serif", color: INK }}>{value}%</div>
        <ProbBar value={value} color={color} />
    </div>
);

// ─── Scholar Card — a case-dossier style card, one per flagged scholar ──

const ScholarCard = ({ scholar }) => {
    const [expanded, setExpanded] = useState(false);
    const [note,     setNote]     = useState('');
    const [saved,    setSaved]    = useState(false);
    const [showExplanation, setShowExplanation] = useState(false);
    const [loggingVisit, setLoggingVisit] = useState(false);

    const s  = scholar.stats;
    const rc = riskColor(scholar.risk_level);
    const rb = riskBg(scholar.risk_level);
    const rd = riskDot(scholar.risk_level);

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

    const predictiveRisk = riskScore;

    return (
        <div className="bg-white rounded-2xl overflow-hidden transition-all"
            style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)' }}>

            <div className="flex items-center gap-4 p-5">
                <div className="w-1.5 self-stretch rounded-full shrink-0" style={{ backgroundColor: rd }} />

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge bg={rb} color={rc} dot={rd}>
                            {scholar.risk_level === 'high' ? 'High Risk' : 'Medium Risk'}
                        </Badge>
                        <Badge bg={overallCompliance < minCompliance ? '#FBE9E9' : '#EAF3EC'} color={overallCompliance < minCompliance ? '#991b1b' : '#15803d'}>
                            Compliance Credits: {overallCompliance} / {minCompliance} minimum
                        </Badge>
                        {hasGpa && (
                            <Badge bg={IVORY} color="#6b6058">GPA: {Number(s.gwa).toFixed(2)}</Badge>
                        )}
                        <Badge bg="#F6EFE1" color="#8a6a3a">Academic Status: {academicStatus.replace('-', ' ')}</Badge>
                        <Badge bg={`${qualityColor(s.attendance_rate)}15`} color={qualityColor(s.attendance_rate)}>
                            Attendance: {s.attendance_rate}%
                        </Badge>
                        {s.negative_letters > 0 && (
                            <Badge bg="#FBE9E9" color="#991b1b">
                                <AlertTriangle size={9} /> {s.negative_letters} Negative Letters
                            </Badge>
                        )}
                    </div>
                    <p className="font-bold text-base leading-none"
                        style={{ fontFamily: "'Playfair Display', serif", color: INK }}>{scholar.full_name}</p>
                    <p className="text-[11px] font-mono mt-1" style={{ color: '#c9b3b8' }}>{scholar.scholar_id}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    <div className="flex flex-col items-end gap-2 mr-3">
                        <a href={`mailto:${scholar.email}`} className="flex items-center gap-1.5 hover:opacity-90 text-white text-[13px] font-semibold px-3.5 py-1.5 rounded-full transition-all whitespace-nowrap" style={{
                            fontFamily: "'DM Sans', sans-serif",
                            background: `linear-gradient(120deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)`,
                        }}>
                            <Mail size={12} /> Contact Scholar
                        </a>
                        <button onClick={() => setShowExplanation(!showExplanation)} className="flex items-center gap-1.5 hover:opacity-90 text-[13px] font-semibold px-3 py-1.5 rounded-full transition-all whitespace-nowrap" style={{ border: '1px solid #e9dfd8', background: '#fff', color: '#6b6058' }}>
                            Score explanation
                        </button>
                        <button onClick={handleHomeVisit} disabled={loggingVisit}
                            className="flex items-center gap-1.5 hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-all whitespace-nowrap" style={{
                            fontFamily: "'DM Sans', sans-serif",
                            background: `linear-gradient(120deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)`,
                        }}>
                            {loggingVisit ? 'Opening Gmail…' : 'Home Visit'}
                        </button>
                    </div>

                    <div className="hidden sm:flex flex-col items-end gap-2 mr-2">
                        <MetricPill label="Compliance" value={overallCompliance} color={overallCompliance < minCompliance ? '#991b1b' : '#15803d'} />
                        <MetricPill label="Risk Points" value={predictiveRisk} color={scholar.risk_level === 'high' ? '#991b1b' : '#92400e'} />
                    </div>

                    <div className="flex items-center gap-2">
                        <p className="text-[10px] hidden sm:block mr-2" style={{ color: '#d8c9c2' }}>
                            {lastSubFormatted
                                ? <span style={s.days_since_submission > 30 ? { color: '#991b1b', fontWeight: 700 } : {}}>{lastSubFormatted}</span>
                                : <span style={{ color: '#991b1b', fontWeight: 700 }}>No record</span>}
                        </p>
                        <button onClick={() => setExpanded(!expanded)}
                            className="w-8 h-8 flex items-center justify-center rounded-full transition-all hover:bg-slate-50"
                            style={{ color: '#a89890' }}>
                            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                    </div>
                </div>
            </div>

            <div className="px-6 pb-4 flex flex-wrap gap-1.5">
                {flags.map((flag, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: sevBg(flag.severity), color: sevColor(flag.severity), fontFamily: "'DM Sans', sans-serif" }}>
                        <AlertTriangle size={9} /> {flag.description}
                    </span>
                ))}
            </div>

            {expanded && (
                <div className="px-6 py-5 space-y-5" style={{ background: IVORY, borderTop: '1px solid #f0e6e0' }}>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: MAROON }}>
                                <BookOpen size={10} /> Submission Record
                            </p>
                            <div className="bg-white rounded-xl divide-y" style={{ borderColor: '#f0e6e0', border: '1px solid #f0e6e0' }}>
                                {[
                                    { label: 'Total Submitted', value: s.total_submissions, color: INK                          },
                                    { label: 'Approved',        value: s.approved,          color: '#15803d'                    },
                                    { label: 'Rejected',        value: s.rejected,          color: '#991b1b'                    },
                                    { label: 'Avg Quality',     value: `${s.avg_quality}%`, color: qualityColor(s.avg_quality)  },
                                    { label: 'GPA',               value: hasGpa ? Number(s.gwa).toFixed(2) : 'No grades', color: '#6b6058' },
                                    { label: 'Compliance Credits', value: `${overallCompliance} / ${minCompliance.toFixed(2)} minimum`, color: overallCompliance < minCompliance ? '#991b1b' : '#15803d' },
                                    { label: 'Compliance',      value: `${compliancePct}%`, color: MAROON                       },
                                ].map((row, i) => (
                                    <div key={i} className="flex items-center justify-between px-4 py-2.5">
                                        <p className="text-xs" style={{ fontFamily: "'DM Sans', sans-serif", color: '#a89890' }}>{row.label}</p>
                                        <p className="text-xs font-bold" style={{ fontFamily: "'DM Sans', sans-serif", color: row.color }}>{row.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: MAROON }}>
                                <FileText size={10} /> Risk Flags
                            </p>
                            <div className="space-y-2">
                                {flags.map((flag, i) => (
                                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl"
                                        style={{ backgroundColor: sevBg(flag.severity) }}>
                                        <AlertTriangle size={13} style={{ color: sevColor(flag.severity), marginTop: 1, flexShrink: 0 }} />
                                        <div className="flex-1">
                                            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: sevColor(flag.severity) }}>{flag.type}</p>
                                            <p className="text-xs mt-0.5" style={{ color: sevColor(flag.severity), fontFamily: "'DM Sans', sans-serif" }}>{flag.description}</p>
                                        </div>
                                        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0"
                                            style={{ backgroundColor: sevColor(flag.severity) + '20', color: sevColor(flag.severity) }}>
                                            {flag.severity}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: MAROON }}>
                                <Calendar size={10} /> Duty Attendance
                            </p>
                            <p className="text-[10px] font-mono" style={{ color: '#a89890' }}>
                                {s.present}/{s.total_duties} duties attended
                            </p>
                        </div>
                        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: '#f0e6e0' }}>
                            <div className="h-full rounded-full transition-all"
                                style={{
                                    width: `${s.attendance_rate}%`,
                                    backgroundColor: s.attendance_rate < 50 ? '#991b1b' : '#92400e',
                                }} />
                        </div>
                    </div>

                    {s.negative_letters > 0 && (
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: MAROON }}>
                                <TrendingDown size={10} /> Sentiment Overview
                            </p>
                            <div className="rounded-xl p-4" style={{ background: '#FBE9E9', border: '1px solid #f3c6c6' }}>
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-xs font-bold" style={{ fontFamily: "'DM Sans', sans-serif", color: '#991b1b' }}>
                                        {s.negative_letters} Negative Sentiment {s.negative_letters === 1 ? 'Letter' : 'Letters'}
                                    </p>
                                    {lastSubFormatted && (
                                        <p className="text-[10px]" style={{ fontFamily: "'DM Sans', sans-serif", color: '#a89890' }}>
                                            Last: {lastSubFormatted}
                                        </p>
                                    )}
                                </div>
                                <p className="text-xs italic" style={{ fontFamily: "'DM Sans', sans-serif", color: '#c4696e' }}>
                                    {s.negative_letters} out of {s.total_submissions} submissions flagged with negative tone by NLP analysis.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="pt-4" style={{ borderTop: '1px solid #e9dfd8' }}>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: MAROON }}>
                            <MessageSquare size={10} /> Intervention Notes
                        </p>
                        <textarea rows={3} value={note} onChange={e => setNote(e.target.value)}
                            placeholder="Add intervention notes, home visit schedule, or contact attempts..."
                            className="w-full bg-white p-3 rounded-xl text-xs outline-none resize-none placeholder:text-slate-300"
                            style={{ fontFamily: "'DM Sans', sans-serif", color: INK, border: '1px solid #e9dfd8' }} />
                        <div className="flex gap-2 mt-3">
                            <button onClick={saveNote}
                                className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest text-white transition-all hover:opacity-90"
                                style={{ background: `linear-gradient(120deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)` }}>
                                {saved ? '✓ Saved' : 'Save Note'}
                            </button>
                            <a href={`mailto:${scholar.email}`}
                                className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold transition-all hover:bg-white"
                                style={{ fontFamily: "'DM Sans', sans-serif", border: '1px solid #e9dfd8', color: '#6b6058' }}>
                                <Mail size={12} /> Email Scholar
                            </a>
                        </div>
                    </div>

                    {/* Score explanation panel (toggleable) */}
                    {showExplanation && (
                        <div className="pt-3">
                            <div className="rounded-xl p-3 text-xs" style={{ background: ROSE, color: '#a56475' }}>
                                <p className="font-semibold mb-1" style={{ color: MAROON }}>Score explanation</p>
                                <ul className="list-disc list-inside space-y-1">
                                    {flags.map((f, i) => (<li key={i}>{f.type}: {f.description}</li>))}
                                    <li>Avg Quality: {s.avg_quality}%</li>
                                    <li>Attendance: {s.attendance_rate}% ({s.present}/{s.total_duties})</li>
                                    <li>Compliance credits: {overallCompliance}</li>
                                    <li>Risk points: {riskScore}</li>
                                </ul>
                            </div>
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
        <div className="min-h-screen p-5 sm:p-8" style={{ backgroundColor: IVORY, fontFamily: "'DM Sans', sans-serif" }}>

            <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: ROSE }}>
                        <ShieldCheck size={14} style={{ color: MAROON }} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: '#a56475' }}>{portalLabel}</span>
                </div>
                <div className="flex items-end justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-3xl font-bold leading-none mb-1"
                            style={{ fontFamily: "'Playfair Display', serif", letterSpacing: '-0.02em', color: INK }}>
                            Flagged Scholars
                        </h1>
                        <p className="text-sm" style={{ color: '#a89890' }}>Scholars requiring immediate attention and intervention.</p>
                    </div>
                    <button onClick={fetchScholars}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all hover:bg-white"
                        style={{ border: '1.5px solid #d8c9c2', color: '#6b6058', background: '#fff' }}>
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {!loading && (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                    {[
                        { label: 'High Risk',     value: highCount,       color: '#991b1b', bg: '#FBE9E9', icon: AlertTriangle },
                        { label: 'Medium Risk',   value: medCount,        color: '#92400e', bg: '#FBF0DE', icon: Clock         },
                        { label: 'Total Flagged', value: scholars.length, color: MAROON,    bg: ROSE,      icon: UserX         },
                    ].map(({ label, value, color, bg, icon: Icon }) => (
                        <div key={label} className="rounded-2xl p-5" style={{ backgroundColor: bg, boxShadow: '0 8px 20px -14px rgba(36,21,18,0.15)' }}>
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: '#a89890' }}>{label}</p>
                                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/70">
                                    <Icon size={14} style={{ color }} />
                                </div>
                            </div>
                            <p className="text-4xl font-bold" style={{ color, fontFamily: "'Playfair Display', serif" }}>{value}</p>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex gap-2 mb-5 flex-wrap items-center">
                <div className="flex items-center gap-3 mr-4">
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search name or ID"
                        className="px-3.5 py-2.5 rounded-full text-sm outline-none bg-white"
                        style={{ border: '1px solid #e9dfd8', color: INK }} />
                    <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}
                        className="px-3.5 py-2.5 rounded-full text-sm outline-none bg-white"
                        style={{ border: '1px solid #e9dfd8', color: INK }}>
                        <option value="all">All Years</option>
                        {gradeOptions.map(({ value, label }) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                </div>
                {[
                    { key: 'all',    label: `All · ${scholars.length}`     },
                    { key: 'high',   label: `High Risk · ${highCount}`     },
                    { key: 'medium', label: `Medium Risk · ${medCount}`    },
                ].map(({ key, label }) => (
                    <button key={key} onClick={() => setRiskFilter(key)}
                        className="px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all"
                        style={
                            riskFilter === key
                                ? { background: `linear-gradient(120deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)`, color: '#fff', border: `1.5px solid ${MAROON}` }
                                : { backgroundColor: '#fff', color: '#a89890', border: '1.5px solid #e9dfd8' }
                        }>
                        {label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="space-y-3">
                    {Array(3).fill(0).map((_, i) => (
                        <div key={i} className="animate-pulse rounded-2xl h-24" style={{ background: '#EFE7E2' }} />
                    ))}
                </div>
            ) : error ? (
                <div className="rounded-2xl p-8 text-center" style={{ background: '#FBE9E9', border: '1px solid #f3c6c6' }}>
                    <AlertTriangle size={28} className="mx-auto mb-2" style={{ color: '#c4696e' }} />
                    <p className="text-sm font-bold" style={{ color: '#991b1b' }}>{error}</p>
                    <button onClick={fetchScholars} className="mt-3 text-xs font-bold underline" style={{ color: '#991b1b' }}>Try again</button>
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-[2rem] flex flex-col items-center justify-center py-20" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)' }}>
                    <UserX size={48} strokeWidth={1} style={{ color: '#e9d9dc' }} className="mb-3" />
                    <p className="text-sm font-bold" style={{ color: '#c9b3b8' }}>No flagged scholars found.</p>
                    <p className="text-xs mt-1" style={{ color: '#c9b3b8' }}>All scholars are currently compliant.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(s => <ScholarCard key={s.scholar_id} scholar={s} />)}
                </div>
            )}
        </div>
    );
};

export default FlaggedScholars;