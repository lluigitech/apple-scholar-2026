import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    AlertTriangle, ChevronDown, ChevronUp, Mail,
    BookOpen, Calendar, FileText, TrendingDown,
    MessageSquare, ShieldCheck, RefreshCw, UserX, Clock
} from 'lucide-react';

const API = 'http://localhost:5000/api';
const MAROON = '#7f2d3a';

// ─── Helpers ──────────────────────────────────────────────────

const riskColor  = (l) => l === 'high' ? '#ef4444' : '#f59e0b';
const riskBg     = (l) => l === 'high' ? '#fee2e2' : '#fef3c7';
const riskDot    = (l) => l === 'high' ? '#ef4444' : '#f59e0b';
const sevColor   = (s) => ({ high: '#991b1b', medium: '#854d0e', low: '#374151' }[s] || '#374151');
const sevBg      = (s) => ({ high: '#fee2e2', medium: '#fef9c3', low: '#f3f4f6' }[s] || '#f3f4f6');
const qualityColor = (q) => q >= 80 ? '#10b981' : q >= 60 ? '#f59e0b' : '#ef4444';

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
    <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] px-2.5 py-1 rounded-full"
        style={{ backgroundColor: bg, color, fontFamily: "'DM Sans', sans-serif" }}>
        {dot && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dot }} />}
        {children}
    </span>
);

// Small metric components used in PredictiveRisk UI
const ProbBar = ({ value, color }) => (
    <div>
        <div className="h-1.5 rounded-full bg-slate-100 mt-1">
            <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
        </div>
    </div>
);

const MetricPill = ({ label, value, color }) => (
    <div className="bg-white border border-slate-100 rounded-lg px-3 py-2 text-center min-w-[88px]">
        <div className="text-[10px] text-slate-400 mb-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
        <div className="text-sm font-medium text-slate-900" style={{ fontFamily: "'DM Sans', sans-serif" }}>{value}%</div>
        <ProbBar value={value} color={color} />
    </div>
);

// ─── Scholar Card ─────────────────────────────────────────────

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
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden transition-all"
            style={{ borderColor: scholar.risk_level === 'high' ? '#fecaca' : '#fde68a' }}>

            <div className="flex items-center gap-4 p-5">
                <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: rd }} />

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge bg={rb} color={rc} dot={rd}>
                            {scholar.risk_level === 'high' ? 'High Risk' : 'Medium Risk'}
                        </Badge>
                        <Badge bg={overallCompliance < minCompliance ? '#fee2e2' : '#ecfdf5'} color={overallCompliance < minCompliance ? '#991b1b' : '#047857'}>
                            Overall Compliance: {overallCompliance}% / {minCompliance}% min
                        </Badge>
                        {hasGpa && (
                            <Badge bg="#f8fafc" color="#64748b">GPA: {Number(s.gwa).toFixed(2)}</Badge>
                        )}
                        <Badge bg="#eff6ff" color="#1d4ed8">Academic Status: {academicStatus.replace('-', ' ')}</Badge>
                        <Badge bg={`${qualityColor(s.attendance_rate)}15`} color={qualityColor(s.attendance_rate)}>
                            Attendance: {s.attendance_rate}%
                        </Badge>
                        {s.negative_letters > 0 && (
                            <Badge bg="#fee2e2" color="#991b1b">
                                <AlertTriangle size={9} /> {s.negative_letters} Negative Letters
                            </Badge>
                        )}
                    </div>
                    <p className="font-black text-slate-800 text-base leading-none"
                        style={{ fontFamily: "'Playfair Display', serif" }}>{scholar.full_name}</p>
                    <p className="text-[11px] text-slate-400 font-mono mt-1">{scholar.scholar_id}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    <div className="flex flex-col items-end gap-2 mr-3">
                        <a href={`mailto:${scholar.email}`} className="flex items-center gap-1.5 hover:opacity-90 text-white text-[13px] font-medium px-3.5 py-1.5 rounded-lg transition-all whitespace-nowrap" style={{
                            fontFamily: "'DM Sans', sans-serif",
                            backgroundColor: '#802B36'
                        }}>
                            <Mail size={12} /> Contact Scholar
                        </a>
                        <button onClick={() => setShowExplanation(!showExplanation)} className="flex items-center gap-1.5 hover:opacity-90 text-slate-700 text-[13px] font-medium px-3 py-1.5 rounded-lg transition-all whitespace-nowrap border border-slate-100 bg-white">
                            Score explanation
                        </button>
                        <button onClick={handleHomeVisit} disabled={loggingVisit}
                            className="flex items-center gap-1.5 hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all whitespace-nowrap" style={{
                            fontFamily: "'DM Sans', sans-serif",
                            backgroundColor: '#802B36'
                        }}>
                            {loggingVisit ? 'Opening Gmail…' : 'Home Visit'}
                        </button>
                    </div>

                    <div className="hidden sm:flex flex-col items-end gap-2 mr-2">
                        <MetricPill label="Compliance" value={overallCompliance} color={overallCompliance < minCompliance ? '#ef4444' : '#10b981'} />
                        <MetricPill label="Risk score" value={predictiveRisk} color={scholar.risk_level === 'high' ? '#ef4444' : '#f59e0b'} />
                    </div>

                    <div className="flex items-center gap-2">
                        <p className="text-[10px] text-slate-300 hidden sm:block mr-2">
                            {lastSubFormatted
                                ? <span className={s.days_since_submission > 30 ? 'text-red-400 font-bold' : ''}>{lastSubFormatted}</span>
                                : <span className="text-red-400 font-bold">No record</span>}
                        </p>
                        <button onClick={() => setExpanded(!expanded)}
                            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-50 transition-all"
                            style={{ color: '#94a3b8' }}>
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
                <div className="border-t border-slate-50 px-6 py-5 space-y-5" style={{ backgroundColor: '#fafafa' }}>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: MAROON }}>
                                <BookOpen size={10} /> Submission Record
                            </p>
                            <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-50">
                                {[
                                    { label: 'Total Submitted', value: s.total_submissions, color: '#1e293b'                    },
                                    { label: 'Approved',        value: s.approved,          color: '#10b981'                    },
                                    { label: 'Rejected',        value: s.rejected,          color: '#ef4444'                    },
                                    { label: 'Avg Quality',     value: `${s.avg_quality}%`, color: qualityColor(s.avg_quality)  },
                                    { label: 'GPA',               value: hasGpa ? Number(s.gwa).toFixed(2) : 'No grades', color: '#64748b' },
                                    { label: 'Overall Compliance', value: `${overallCompliance}% / ${minCompliance.toFixed(2)}%`, color: overallCompliance < minCompliance ? '#ef4444' : '#10b981' },
                                    { label: 'Compliance',      value: `${compliancePct}%`, color: MAROON                       },
                                ].map((row, i) => (
                                    <div key={i} className="flex items-center justify-between px-4 py-2.5">
                                        <p className="text-xs text-slate-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>{row.label}</p>
                                        <p className="text-xs font-black" style={{ fontFamily: "'DM Sans', sans-serif", color: row.color }}>{row.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: MAROON }}>
                                <FileText size={10} /> Risk Flags
                            </p>
                            <div className="space-y-2">
                                {flags.map((flag, i) => (
                                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl"
                                        style={{ backgroundColor: sevBg(flag.severity) }}>
                                        <AlertTriangle size={13} style={{ color: sevColor(flag.severity), marginTop: 1, flexShrink: 0 }} />
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: sevColor(flag.severity) }}>{flag.type}</p>
                                            <p className="text-xs mt-0.5" style={{ color: sevColor(flag.severity), fontFamily: "'DM Sans', sans-serif" }}>{flag.description}</p>
                                        </div>
                                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0"
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
                            <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: MAROON }}>
                                <Calendar size={10} /> Duty Attendance
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">
                                {s.present}/{s.total_duties} duties attended
                            </p>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all"
                                style={{
                                    width: `${s.attendance_rate}%`,
                                    backgroundColor: s.attendance_rate < 50 ? '#ef4444' : '#f59e0b',
                                }} />
                        </div>
                    </div>

                    {s.negative_letters > 0 && (
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: MAROON }}>
                                <TrendingDown size={10} /> Sentiment Overview
                            </p>
                            <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-xs font-black text-red-700" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                        {s.negative_letters} Negative Sentiment {s.negative_letters === 1 ? 'Letter' : 'Letters'}
                                    </p>
                                    {lastSubFormatted && (
                                        <p className="text-[10px] text-slate-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                            Last: {lastSubFormatted}
                                        </p>
                                    )}
                                </div>
                                <p className="text-xs italic text-red-600/70" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                    {s.negative_letters} out of {s.total_submissions} submissions flagged with negative tone by NLP analysis.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="border-t border-slate-100 pt-4">
                        <p className="text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: MAROON }}>
                            <MessageSquare size={10} /> Intervention Notes
                        </p>
                        <textarea rows={3} value={note} onChange={e => setNote(e.target.value)}
                            placeholder="Add intervention notes, home visit schedule, or contact attempts..."
                            className="w-full bg-white border border-slate-200 p-3 rounded-xl text-xs text-slate-700 outline-none resize-none placeholder:text-slate-300"
                            style={{ fontFamily: "'DM Sans', sans-serif" }} />
                        <div className="flex gap-2 mt-3">
                            <button onClick={saveNote}
                                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-90"
                                style={{ backgroundColor: MAROON }}>
                                {saved ? '✓ Saved' : 'Save Note'}
                            </button>
                            <a href={`mailto:${scholar.email}`}
                                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-200 text-slate-500 hover:bg-white transition-all"
                                style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                <Mail size={12} /> Email Scholar
                            </a>
                        </div>
                    </div>

                    {/* Score explanation panel (toggleable) */}
                    {showExplanation && (
                        <div className="px-6 pb-4 pt-3" style={{ backgroundColor: '#fff' }}>
                            <div className="mt-2 rounded-xl bg-gray-50 border border-gray-100 p-3 text-xs text-gray-600" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                <p className="font-semibold text-gray-800 mb-1">Score explanation</p>
                                <ul className="list-disc list-inside space-y-1">
                                    {flags.map((f, i) => (<li key={i}>{f.type}: {f.description}</li>))}
                                    <li>Avg Quality: {s.avg_quality}%</li>
                                    <li>Attendance: {s.attendance_rate}% ({s.present}/{s.total_duties})</li>
                                    <li>Overall compliance: {overallCompliance}%</li>
                                    <li>Risk score: {riskScore}%</li>
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
        const timer = setTimeout(fetchScholars, 0);
        return () => clearTimeout(timer);
    }, [fetchScholars]);

    const highCount = scholars.filter(s => s.risk_level === 'high').length;
    const medCount  = scholars.filter(s => s.risk_level === 'medium').length;
    const lowCount  = scholars.filter(s => s.risk_level !== 'high' && s.risk_level !== 'medium').length;

    // derive grade options from data
    const gradeOptions = Array.from(new Set(scholars.map(s => s.year_level || 'N/A'))).sort();

    const filtered  = scholars.filter(s => {
        if (riskFilter !== 'all' && s.risk_level !== riskFilter) return false;
        if (gradeFilter !== 'all' && (s.year_level || '') !== gradeFilter) return false;
        if (searchQuery && !((s.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (s.scholar_id || '').toLowerCase().includes(searchQuery.toLowerCase()))) return false;
        return true;
    });

    return (
        <div className="min-h-screen p-5 sm:p-8" style={{ backgroundColor: '#f8f7f9', fontFamily: "'DM Sans', sans-serif" }}>

            <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${MAROON}18` }}>
                        <ShieldCheck size={14} style={{ color: MAROON }} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: MAROON }}>{portalLabel}</span>
                </div>
                <div className="flex items-end justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 leading-none mb-1"
                            style={{ fontFamily: "'Playfair Display', serif", letterSpacing: '-0.02em' }}>
                            Flagged Scholars
                        </h1>
                        <p className="text-sm text-slate-400">Scholars requiring immediate attention and intervention.</p>
                    </div>
                    <button onClick={fetchScholars}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border border-slate-200 text-slate-500 hover:bg-white transition-all">
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {!loading && (
                <div className="grid grid-cols-4 gap-4 mb-8">
                    {[
                        { label: 'High Risk',     value: highCount,       color: '#ef4444', bg: '#fef2f2', icon: AlertTriangle },
                        { label: 'Medium Risk',   value: medCount,        color: '#f59e0b', bg: '#fffbeb', icon: Clock         },
                        { label: 'Low Risk',      value: lowCount,        color: '#10b981', bg: '#ecfdf5', icon: ShieldCheck  },
                        { label: 'Total Flagged', value: scholars.length, color: MAROON,    bg: '#fdf2f3', icon: UserX         },
                    ].map(({ label, value, color, bg, icon: Icon }) => (
                        <div key={label} className="rounded-2xl p-5 border border-white shadow-sm" style={{ backgroundColor: bg }}>
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</p>
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '20' }}>
                                    <Icon size={14} style={{ color }} />
                                </div>
                            </div>
                            <p className="text-4xl font-black" style={{ color, fontFamily: "'Playfair Display', serif" }}>{value}</p>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex gap-2 mb-5 flex-wrap">
                <div className="flex items-center gap-3 mr-4">
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search name or ID" className="px-3 py-2 rounded-lg border border-slate-100 text-sm outline-none" />
                    <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-100 text-sm outline-none">
                        <option value="all">All Years</option>
                        {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                </div>
                {[
                    { key: 'all',    label: `All · ${scholars.length}`     },
                    { key: 'high',   label: `High Risk · ${highCount}`     },
                    { key: 'medium', label: `Medium Risk · ${medCount}`    },
                ].map(({ key, label }) => (
                    <button key={key} onClick={() => setRiskFilter(key)}
                        className="px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wider transition-all"
                        style={{
                            backgroundColor: riskFilter === key ? MAROON : '#fff',
                            color:           riskFilter === key ? '#fff'  : '#94a3b8',
                            border:          riskFilter === key ? `1.5px solid ${MAROON}` : '1.5px solid #e2e8f0',
                        }}>
                        {label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="space-y-3">
                    {Array(3).fill(0).map((_, i) => (
                        <div key={i} className="animate-pulse bg-white rounded-2xl h-24 border border-slate-100" />
                    ))}
                </div>
            ) : error ? (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center">
                    <AlertTriangle size={28} className="mx-auto mb-2 text-red-400" />
                    <p className="text-sm font-bold text-red-600">{error}</p>
                    <button onClick={fetchScholars} className="mt-3 text-xs font-black text-red-500 underline">Try again</button>
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-100 flex flex-col items-center justify-center py-20">
                    <UserX size={48} strokeWidth={1} className="text-slate-200 mb-3" />
                    <p className="text-sm font-bold text-slate-300">No flagged scholars found.</p>
                    <p className="text-xs text-slate-300 mt-1">All scholars are currently compliant.</p>
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