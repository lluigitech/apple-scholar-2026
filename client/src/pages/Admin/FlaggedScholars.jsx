import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
    AlertTriangle, Mail, TrendingDown, MessageSquare, RefreshCw, UserX, Clock,
    Flag, Users, Bookmark, Search, Download, MoreVertical, Calendar, Eye,
    FileText, RotateCcw, Home, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import AdminPageHeader from '../../components/Admin/AdminPageHeader';

const API_BASE = (import.meta.env?.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;

// ── Design tokens — Apple Scholar admin design system ──
const BG      = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER  = '#E7D8C7';
const PRIMARY = '#6D2140';
const DEEP    = '#4A1730';
const INK     = '#241512';
const MUTED   = '#8A7A68';
const BRONZE  = '#A9784E';
const SUCCESS = '#6B8F71';
const WARNING = '#C08A3E';
const DANGER  = '#A24A4A';
const RADIUS  = 16;
const SHADOW  = '0 1px 2px rgba(74, 23, 48, 0.04), 0 8px 24px -16px rgba(74, 23, 48, 0.12)';

const serif = { fontFamily: "'Playfair Display', serif" };
const sans  = { fontFamily: "'Inter', sans-serif" };

const cardStyle = { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: SHADOW };

const outlineBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: `1px solid ${BORDER}`, borderRadius: 10, background: SURFACE, color: INK, ...sans, fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer' };
const filledBtn  = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: 'none', borderRadius: 10, background: `linear-gradient(120deg, ${PRIMARY} 0%, ${DEEP} 100%)`, color: '#fff', ...sans, fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer' };
const fieldStyle = { width: '100%', padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, background: SURFACE, ...sans, fontSize: '0.78rem', color: INK, outline: 'none' };

// ─── Helpers ─────────────────────────────────────────────────

const riskColor    = (l) => l === 'high' ? DANGER : l === 'medium' ? WARNING : SUCCESS;
const sevColor     = (s) => ({ high: DANGER, medium: WARNING, low: MUTED }[s] || MUTED);
const qualityColor = (q) => q >= 80 ? SUCCESS : q >= 60 ? WARNING : DANGER;
const riskLabel    = (l) => l === 'high' ? 'High' : l === 'medium' ? 'Medium' : 'Low';

const getRiskBucket = (riskLevel) => {
    if (riskLevel === 'high') return 'high';
    if (riskLevel === 'medium') return 'medium';
    return 'low';
};

const initialsOf = (name) =>
    (name || '?').split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase();

const formatDate = (value) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime())
        ? null
        : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Uses an explicit "updated" date when the API provides one, otherwise the
// last submission date. `exact` says which of the two it is.
const lastUpdatedOf = (scholar) => {
    const direct = formatDate(scholar.updated_at || scholar.last_updated || scholar.updatedAt);
    if (direct) return { label: direct, exact: true };
    const sub = formatDate(scholar.stats?.last_submission);
    return sub ? { label: sub, exact: false } : null;
};

const openGmailCompose = ({ to, subject, body }) => {
    const params = new URLSearchParams({ view: 'cm', fs: '1', to, su: subject, body });
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

// Same formulas as before — only gathered in one place.
const deriveMetrics = (scholar) => {
    const s = scholar.stats || {};
    const riskScore = Number.isFinite(Number(scholar.risk_score)) ? Math.round(Number(scholar.risk_score)) : 0;
    const minCompliance = Number.isFinite(Number(s.min_compliance)) ? Number(s.min_compliance) : 70;
    const overallCompliance = Number.isFinite(Number(scholar.overall_compliance))
        ? Math.round(Number(scholar.overall_compliance))
        : Math.max(0, 100 - riskScore);
    return {
        s,
        riskScore,
        minCompliance,
        overallCompliance,
        compliancePct: s.total_submissions > 0 ? Math.round((s.approved / s.total_submissions) * 100) : 0,
        hasGpa: s.gwa !== null && s.gwa !== undefined,
        flags: scholar.flags || [],
        academicStatus: scholar.academic_status || 'no-record',
        lastSubFormatted: formatDate(s.last_submission),
    };
};

const csvCell = (value) => {
    let text = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`; // neutralise spreadsheet formulas
    return `"${text.replace(/"/g, '""')}"`;
};

const exportCsv = (rows) => {
    const header = ['Scholar ID', 'Name', 'Email', 'Year Level', 'Risk Level', 'Risk Score', 'Compliance Points', 'Attendance %', 'Negative Letters', 'Last Updated', 'Flags'];
    const lines = rows.map((sch) => {
        const m = deriveMetrics(sch);
        return [
            sch.scholar_id, sch.full_name, sch.email, sch.year_level ?? '', riskLabel(sch.risk_level), m.riskScore,
            m.overallCompliance, m.s.attendance_rate ?? '', m.s.negative_letters ?? 0, lastUpdatedOf(sch)?.label ?? '',
            m.flags.map(f => f.description).join('; '),
        ].map(csvCell).join(',');
    });
    const blob = new Blob([[header.map(csvCell).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flagged-scholars-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// ─── Small UI pieces ─────────────────────────────────────────

const IconBubble = ({ icon: Icon, color = PRIMARY, size = 40, iconSize = 18 }) => (
    <span className="flex items-center justify-center rounded-full flex-shrink-0"
        style={{ width: size, height: size, background: `${color}14`, color }}>
        <Icon size={iconSize} />
    </span>
);

const RiskBadge = ({ level }) => {
    const color = riskColor(level);
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full"
            style={{ ...sans, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 10px', background: `${color}1A`, color }}>
            <span className="rounded-full" style={{ width: 6, height: 6, background: color }} />
            {riskLabel(level)}
        </span>
    );
};

const Avatar = ({ name, size = 36 }) => (
    <span className="flex items-center justify-center rounded-full flex-shrink-0"
        style={{ width: size, height: size, background: `${PRIMARY}14`, color: PRIMARY, ...sans, fontSize: size > 40 ? '1.05rem' : '0.74rem', fontWeight: 700 }}>
        {initialsOf(name)}
    </span>
);

// Semi-circular dial with needle
const RiskDial = ({ score, level, w = 150 }) => {
    const color = riskColor(level);
    const pct = Math.min(100, Math.max(0, score));
    const h = w * 0.58;
    const cx = w / 2, cy = h - 6, r = w * 0.42;
    const needleLen = r - 10;
    const rad = ((-90 + (pct / 100) * 180) * Math.PI) / 180;
    const nx = cx + needleLen * Math.sin(rad);
    const ny = cy - needleLen * Math.cos(rad);
    const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
    return (
        <div className="flex flex-col items-center" style={{ width: w }}>
            <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Risk score ${score} out of 100`}>
                <path d={arc} fill="none" stroke={BORDER} strokeWidth="9" strokeLinecap="round" />
                <path d={arc} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
                    strokeDasharray={`${(pct / 100) * Math.PI * r} ${Math.PI * r}`} />
                <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={INK} strokeWidth="2" strokeLinecap="round" />
                <circle cx={cx} cy={cy} r="4" fill={INK} />
            </svg>
            <div className="flex items-end justify-between w-full px-1" style={{ marginTop: -2 }}>
                <span style={{ ...sans, fontSize: '0.62rem', color: MUTED }}>0</span>
                <span className="text-center">
                    <span style={{ ...serif, fontSize: '1.5rem', fontWeight: 700, color: INK, display: 'block', lineHeight: 1 }}>{Math.round(score)}</span>
                    <span style={{ ...sans, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color }}>{riskLabel(level)} risk</span>
                </span>
                <span style={{ ...sans, fontSize: '0.62rem', color: MUTED }}>100</span>
            </div>
        </div>
    );
};

const IndicatorRow = ({ label, valueText, pct, color }) => (
    <div className="flex items-center gap-3">
        <span style={{ ...sans, fontSize: '0.74rem', color: INK, width: 84, flexShrink: 0 }}>{label}</span>
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: BORDER }}>
            {pct !== null && <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />}
        </div>
        <span style={{ ...sans, fontSize: '0.72rem', fontWeight: 700, color: pct === null ? MUTED : color, minWidth: 58, textAlign: 'right' }}>{valueText}</span>
    </div>
);

const PanelTitle = ({ icon: Icon, children, right }) => (
    <div className="flex items-center justify-between gap-2 mb-3">
        <p className="flex items-center gap-2" style={{ ...serif, fontSize: '0.92rem', fontWeight: 700, color: PRIMARY }}>
            <IconBubble icon={Icon} size={28} iconSize={14} /> {children}
        </p>
        {right}
    </div>
);

const Skeleton = ({ style }) => <div className="animate-pulse" style={{ background: '#EFE6D8', borderRadius: 14, ...style }} />;

// ─── Details panel ───────────────────────────────────────────

const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'records', label: 'Records' },
    { key: 'submissions', label: 'Submissions' },
    { key: 'interventions', label: 'Interventions' },
];

const DetailsPanel = ({ scholar, tab, setTab, note, setNote, saved, onSaveNote, onHomeVisit, onAddNote, loggingVisit }) => {
    const [showExplanation, setShowExplanation] = useState(false);
    const [showAllIssues, setShowAllIssues] = useState(false);

    const { s, riskScore, minCompliance, overallCompliance, compliancePct, hasGpa, flags, academicStatus, lastSubFormatted } = deriveMetrics(scholar);
    const updated = lastUpdatedOf(scholar);

    const attendanceKnown = s.attendance_rate !== null && s.attendance_rate !== undefined && s.total_duties !== 0;
    const submissionsKnown = s.total_submissions > 0;
    const negShare = submissionsKnown ? Math.round(((s.negative_letters || 0) / s.total_submissions) * 100) : null;
    const visibleIssues = showAllIssues ? flags : flags.slice(0, 3);

    return (
        <div>
            {/* Identity */}
            <div className="flex items-start gap-4 flex-wrap">
                <Avatar name={scholar.full_name} size={56} />
                <div className="flex-1 min-w-[160px]">
                    <p style={{ ...serif, fontSize: '1.1rem', fontWeight: 700, color: INK }}>{scholar.full_name}</p>
                    <p style={{ ...sans, fontSize: '0.74rem', color: MUTED, marginTop: 2 }}>
                        {scholar.scholar_id}{scholar.year_level ? ` · ${scholar.year_level}` : ''}
                    </p>
                    {scholar.email && <p style={{ ...sans, fontSize: '0.74rem', color: MUTED, wordBreak: 'break-all' }}>{scholar.email}</p>}
                </div>
                <div className="flex flex-col items-end gap-1">
                    <RiskBadge level={scholar.risk_level} />
                    <p style={{ ...sans, fontSize: '0.8rem', fontWeight: 600, color: INK }}>Score: {riskScore}/100</p>
                    <p style={{ ...sans, fontSize: '0.66rem', color: MUTED }}>
                        {updated ? `${updated.exact ? 'Last updated' : 'Last submission'}: ${updated.label}` : 'No submission record'}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div role="tablist" aria-label="Scholar details" className="flex gap-1 mt-5 overflow-x-auto" style={{ borderBottom: `1px solid ${BORDER}` }}>
                {TABS.map(t => {
                    const active = tab === t.key;
                    return (
                        <button key={t.key} role="tab" type="button" aria-selected={active} onClick={() => setTab(t.key)}
                            className="fs-focus"
                            style={{ ...sans, fontSize: '0.78rem', fontWeight: active ? 700 : 500, color: active ? PRIMARY : MUTED, background: 'none', border: 'none', borderBottom: `2px solid ${active ? PRIMARY : 'transparent'}`, padding: '9px 14px', marginBottom: -1, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {t.label}
                        </button>
                    );
                })}
            </div>

            <div role="tabpanel" className="pt-4">
                {tab === 'overview' && (
                    <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div style={{ border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14 }}>
                                <PanelTitle icon={FileText}>Risk Analysis</PanelTitle>
                                <div className="flex justify-center"><RiskDial score={riskScore} level={scholar.risk_level} /></div>
                                <button type="button" className="fs-focus w-full mt-3" onClick={() => setShowExplanation(v => !v)}
                                    style={{ ...outlineBtn, justifyContent: 'center', color: PRIMARY, width: '100%' }}>
                                    {showExplanation ? 'Hide' : 'Show'} score explanation
                                </button>
                            </div>

                            <div style={{ border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14 }}>
                                <PanelTitle icon={Flag}>Key Indicators</PanelTitle>
                                <div className="flex flex-col gap-4 pt-1">
                                    <IndicatorRow label="Compliance" valueText={`${overallCompliance}/${minCompliance}`}
                                        pct={overallCompliance} color={overallCompliance < minCompliance ? DANGER : SUCCESS} />
                                    <IndicatorRow label="Submissions"
                                        valueText={submissionsKnown ? `${compliancePct}%` : 'N/A'}
                                        pct={submissionsKnown ? compliancePct : null} color={qualityColor(compliancePct)} />
                                    <IndicatorRow label="Attendance"
                                        valueText={attendanceKnown ? `${s.attendance_rate}%` : 'N/A'}
                                        pct={attendanceKnown ? Number(s.attendance_rate) : null} color={qualityColor(s.attendance_rate)} />
                                    <IndicatorRow label="Sentiment"
                                        valueText={submissionsKnown ? `${s.negative_letters || 0}/${s.total_submissions} neg.` : 'N/A'}
                                        pct={negShare} color={(s.negative_letters || 0) > 0 ? DANGER : SUCCESS} />
                                </div>
                            </div>
                        </div>

                        {showExplanation && (
                            <div style={{ background: `${PRIMARY}08`, border: `1px solid ${PRIMARY}22`, borderRadius: 14, padding: 14 }}>
                                <p style={{ ...sans, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: PRIMARY, marginBottom: 8 }}>Score explanation</p>
                                <ul className="space-y-1.5" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                    {flags.map((f, i) => (
                                        <li key={i} style={{ ...sans, fontSize: '0.74rem', color: '#6b5560' }}><b>{f.type}:</b> {f.description}</li>
                                    ))}
                                    <li style={{ ...sans, fontSize: '0.74rem', color: '#6b5560' }}>Avg Quality: {s.avg_quality}%</li>
                                    <li style={{ ...sans, fontSize: '0.74rem', color: '#6b5560' }}>Attendance: {s.attendance_rate}% ({s.present}/{s.total_duties})</li>
                                    <li style={{ ...sans, fontSize: '0.74rem', color: '#6b5560' }}>Compliance points: {overallCompliance}</li>
                                    <li style={{ ...sans, fontSize: '0.74rem', color: '#6b5560' }}>Risk points: {riskScore}</li>
                                </ul>
                            </div>
                        )}

                        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14 }}>
                            <PanelTitle icon={AlertTriangle} right={flags.length > 3 && (
                                <button type="button" className="fs-focus" onClick={() => setShowAllIssues(v => !v)} style={{ ...outlineBtn, color: PRIMARY, padding: '5px 12px' }}>
                                    {showAllIssues ? 'Show less' : 'View All'}
                                </button>
                            )}>Recent Issues</PanelTitle>
                            {flags.length === 0 ? (
                                <p style={{ ...sans, fontSize: '0.74rem', color: MUTED, fontStyle: 'italic' }}>No individual flags recorded.</p>
                            ) : (
                                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                    {visibleIssues.map((flag, i) => {
                                        const c = sevColor(flag.severity);
                                        const Icon = flag.severity === 'low' ? Clock : AlertTriangle;
                                        return (
                                            <li key={i} className="flex items-center gap-3 py-2.5" style={{ borderTop: i === 0 ? 'none' : `1px solid ${BORDER}` }}>
                                                <IconBubble icon={Icon} color={c} size={30} iconSize={14} />
                                                <div className="flex-1 min-w-0">
                                                    <p style={{ ...sans, fontSize: '0.8rem', fontWeight: 600, color: INK }}>{flag.description}</p>
                                                    <p style={{ ...sans, fontSize: '0.7rem', color: MUTED, textTransform: 'capitalize' }}>{flag.type}</p>
                                                </div>
                                                <span style={{ ...sans, fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '2px 8px', borderRadius: 999, background: `${c}1A`, color: c }}>{flag.severity}</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>
                )}

                {tab === 'records' && (
                    <div className="flex flex-col gap-4">
                        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
                            {[
                                { label: 'GPA', value: hasGpa ? Number(s.gwa).toFixed(2) : 'No grades', color: INK },
                                { label: 'Academic Status', value: academicStatus.replace('-', ' '), color: INK, capitalize: true },
                                { label: 'Compliance Points', value: `${overallCompliance} / ${minCompliance.toFixed(2)} minimum`, color: overallCompliance < minCompliance ? DANGER : SUCCESS },
                                { label: 'Last Submission', value: lastSubFormatted || 'No record', color: s.days_since_submission > 30 || !lastSubFormatted ? DANGER : INK },
                            ].map((row, i) => (
                                <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-2.5" style={{ borderTop: i > 0 ? `1px solid ${BORDER}` : 'none' }}>
                                    <p style={{ ...sans, fontSize: '0.76rem', color: MUTED }}>{row.label}</p>
                                    <p style={{ ...sans, fontSize: '0.78rem', fontWeight: 700, color: row.color, textTransform: row.capitalize ? 'capitalize' : 'none' }}>{row.value}</p>
                                </div>
                            ))}
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="flex items-center gap-1.5" style={{ ...sans, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: PRIMARY }}>
                                    <Calendar size={12} /> Duty Attendance
                                </p>
                                <p style={{ ...sans, fontSize: '0.72rem', color: MUTED }}>{s.present}/{s.total_duties} duties attended</p>
                            </div>
                            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: BORDER }}>
                                <div className="h-full rounded-full" style={{ width: `${Math.min(100, s.attendance_rate || 0)}%`, background: (s.attendance_rate || 0) < 50 ? DANGER : WARNING }} />
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'submissions' && (
                    <div className="flex flex-col gap-4">
                        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
                            {[
                                { label: 'Total Submitted', value: s.total_submissions, color: INK },
                                { label: 'Approved', value: s.approved, color: SUCCESS },
                                { label: 'Rejected', value: s.rejected, color: DANGER },
                                { label: 'Avg Quality', value: `${s.avg_quality}%`, color: qualityColor(s.avg_quality) },
                                { label: 'Compliance', value: submissionsKnown ? `${compliancePct}%` : 'N/A', color: PRIMARY },
                            ].map((row, i) => (
                                <div key={row.label} className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: i > 0 ? `1px solid ${BORDER}` : 'none' }}>
                                    <p style={{ ...sans, fontSize: '0.76rem', color: MUTED }}>{row.label}</p>
                                    <p style={{ ...sans, fontSize: '0.78rem', fontWeight: 700, color: row.color }}>{row.value}</p>
                                </div>
                            ))}
                        </div>
                        {(s.negative_letters || 0) > 0 ? (
                            <div style={{ background: `${DANGER}0d`, border: `1px solid ${DANGER}40`, borderRadius: 14, padding: 14 }}>
                                <p className="flex items-center gap-1.5 mb-1" style={{ ...sans, fontSize: '0.78rem', fontWeight: 700, color: DANGER }}>
                                    <TrendingDown size={13} /> {s.negative_letters} Negative Sentiment {s.negative_letters === 1 ? 'Letter' : 'Letters'}
                                </p>
                                <p style={{ ...sans, fontSize: '0.74rem', fontStyle: 'italic', color: '#8a5a62' }}>
                                    {s.negative_letters} out of {s.total_submissions} submissions flagged with negative tone by NLP analysis.
                                </p>
                            </div>
                        ) : (
                            <p style={{ ...sans, fontSize: '0.74rem', color: MUTED, fontStyle: 'italic' }}>No negative-sentiment letters recorded.</p>
                        )}
                    </div>
                )}

                {tab === 'interventions' && (
                    <div>
                        <p className="flex items-center gap-1.5 mb-2" style={{ ...sans, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: PRIMARY }}>
                            <MessageSquare size={12} /> Case Log
                        </p>
                        <div className="flex items-center gap-2 mb-2" style={{ ...sans, fontSize: '0.68rem', color: MUTED }}>
                            <span>{new Date().toLocaleDateString('en-PH', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            <span style={{ flex: 1, borderBottom: `1px dashed ${BORDER}` }} />
                        </div>
                        <textarea id="case-note" rows={4} value={note} onChange={e => setNote(e.target.value)}
                            aria-label="Case note"
                            placeholder="Add intervention notes, home visit schedule, or contact attempts..."
                            className="w-full outline-none resize-none fs-focus"
                            style={{ ...fieldStyle, borderRadius: 12, padding: 12 }} />
                        <div className="flex gap-2 mt-3 flex-wrap">
                            <button type="button" onClick={onSaveNote} className="fs-focus" style={filledBtn}>{saved ? '✓ Saved' : 'Save Note'}</button>
                            <a href={`mailto:${scholar.email}`} className="fs-focus" style={outlineBtn}><Mail size={12} /> Email Scholar</a>
                            <button type="button" onClick={onHomeVisit} disabled={loggingVisit} className="fs-focus disabled:opacity-60"
                                style={{ ...outlineBtn, color: PRIMARY, border: `1px solid ${PRIMARY}55` }}>
                                <Home size={12} /> {loggingVisit ? 'Opening…' : 'Home Visit'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Intervention Actions */}
            <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
                <p style={{ ...serif, fontSize: '0.95rem', fontWeight: 700, color: PRIMARY, marginBottom: 10 }}>Intervention Actions</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <a href={`mailto:${scholar.email}`} className="fs-focus" style={{ ...filledBtn, justifyContent: 'center', padding: '11px 14px', textDecoration: 'none' }}>
                        <Mail size={14} /> Send Email
                    </a>
                    <button type="button" onClick={onHomeVisit} disabled={loggingVisit} className="fs-focus disabled:opacity-60"
                        style={{ ...outlineBtn, justifyContent: 'center', padding: '11px 14px', color: PRIMARY, border: `1px solid ${PRIMARY}55` }}>
                        <Home size={14} /> {loggingVisit ? 'Opening…' : 'Home Visit'}
                    </button>
                    <button type="button" onClick={onAddNote} className="fs-focus"
                        style={{ ...outlineBtn, justifyContent: 'center', padding: '11px 14px', color: PRIMARY, border: `1px solid ${PRIMARY}55` }}>
                        <FileText size={14} /> Add Case Note
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Modal shell ─────────────────────────────────────────────

const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

const ScholarModal = ({ onClose, titleId, children }) => {
    const dialogRef = useRef(null);

    useEffect(() => {
        const previouslyFocused = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        if (dialogRef.current) dialogRef.current.focus();

        const onKey = (e) => {
            if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
            if (e.key !== 'Tab' || !dialogRef.current) return;
            const nodes = dialogRef.current.querySelectorAll(FOCUSABLE);
            if (!nodes.length) return;
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            const active = document.activeElement;
            if (e.shiftKey && (active === first || active === dialogRef.current)) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = previousOverflow;
            if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
        };
    }, [onClose]);

    return createPortal(
        <div
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
            style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, background: 'rgba(36, 21, 18, 0.55)' }}>
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
                style={{ position: 'relative', width: 'min(880px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, boxShadow: '0 30px 70px -20px rgba(36,21,18,0.55)', outline: 'none', ...sans }}>
                <div className="flex items-center justify-between gap-3" style={{ position: 'sticky', top: 0, zIndex: 2, background: SURFACE, padding: '18px 24px 10px', borderBottom: `1px solid ${BORDER}66` }}>
                    <h2 id={titleId} style={{ ...serif, fontSize: '1.3rem', fontWeight: 700, color: PRIMARY }}>Scholar Details</h2>
                    <button type="button" onClick={onClose} aria-label="Close scholar details" className="fs-focus"
                        style={{ width: 34, height: 34, borderRadius: 999, border: `1px solid ${BORDER}`, background: SURFACE, color: MUTED, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={16} />
                    </button>
                </div>
                <div style={{ padding: '16px 24px 24px' }}>{children}</div>
            </div>
        </div>,
        document.body
    );
};

// ─── Main ─────────────────────────────────────────────────────

const PAGE_SIZE = 8;

const FlaggedScholars = ({ portalLabel = 'Portal' }) => {
    const [scholars,   setScholars]   = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState('');
    const [riskFilter, setRiskFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [gradeFilter, setGradeFilter] = useState('all');
    const [page, setPage] = useState(1);

    // Modal / selection state
    const [detailId, setDetailId] = useState(null);
    const [tab, setTab] = useState('overview');
    const [notes, setNotes] = useState({});
    const [savedNoteFor, setSavedNoteFor] = useState(null);
    const [loggingVisitFor, setLoggingVisitFor] = useState(null);
    const [menu, setMenu] = useState(null);

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

    useEffect(() => { setPage(1); }, [riskFilter, gradeFilter, searchQuery]);

    useEffect(() => {
        if (!menu) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setMenu(null); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [menu]);

    const highCount = scholars.filter(s => getRiskBucket(s.risk_level) === 'high').length;
    const medCount  = scholars.filter(s => getRiskBucket(s.risk_level) === 'medium').length;
    const lowCount  = scholars.filter(s => getRiskBucket(s.risk_level) === 'low').length;

    const gradeCounts = scholars.reduce((acc, s) => {
        const value = String(s.year_level ?? 'N/A').trim() || 'N/A';
        acc[value] = (acc[value] || 0) + 1;
        return acc;
    }, {});

    const gradeOptions = Object.entries(gradeCounts)
        .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
        .map(([year, count]) => ({ value: year, label: `${year} (${count})` }));

    const filtered = scholars.filter(s => {
        const riskBucket = getRiskBucket(s.risk_level);
        const normalizedYear = String(s.year_level ?? 'N/A').trim() || 'N/A';

        if (riskFilter !== 'all' && riskBucket !== riskFilter) return false;
        if (gradeFilter !== 'all' && normalizedYear !== gradeFilter) return false;
        if (searchQuery && !((s.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (s.scholar_id || '').toLowerCase().includes(searchQuery.toLowerCase()))) return false;
        return true;
    });

    // Pagination (client-side over the filtered list)
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const startIdx = (safePage - 1) * PAGE_SIZE;
    const pageRows = filtered.slice(startIdx, startIdx + PAGE_SIZE);
    const pageWindowStart = Math.max(1, Math.min(safePage - 2, totalPages - 4));
    const pageNumbers = Array.from({ length: Math.min(5, totalPages) }, (_, i) => pageWindowStart + i);

    const detailScholar = detailId ? scholars.find(s => s.scholar_id === detailId) : null;
    const detailNote = detailScholar ? (notes[detailScholar.scholar_id] || '') : '';

    const openDetails = (id) => { setTab('overview'); setDetailId(id); setMenu(null); };
    const closeDetails = useCallback(() => setDetailId(null), []);

    const resetFilters = () => { setSearchQuery(''); setRiskFilter('all'); setGradeFilter('all'); };

    const setNoteFor = (id, value) => setNotes(prev => ({ ...prev, [id]: value }));

    const saveNote = (id) => {
        if (!(notes[id] || '').trim()) return;
        setSavedNoteFor(id);
        setTimeout(() => setSavedNoteFor(null), 2000);
    };

    const handleHomeVisit = async (scholar) => {
        if (!scholar.email) {
            alert('This scholar has no email on file, so a Gmail draft cannot be pre-filled.');
            return;
        }
        setLoggingVisitFor(scholar.scholar_id);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post(
                `${API}/flagged/scholars/${scholar.scholar_id}/home-visit`,
                { note: (notes[scholar.scholar_id] || '').trim() || null },
                { headers }
            );
        } catch (e) {
            console.error('Failed to log home visit request:', e);
        } finally {
            setLoggingVisitFor(null);
        }
        openGmailCompose(buildHomeVisitEmail(scholar));
    };

    const openMenu = (e, scholarId) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setMenu({ id: scholarId, top: rect.bottom + 4, left: Math.max(8, rect.right - 190) });
    };

    const focusCaseNote = () => {
        setTab('interventions');
        setTimeout(() => {
            const el = document.getElementById('case-note');
            if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
        }, 50);
    };

    const menuScholar = menu ? scholars.find(s => s.scholar_id === menu.id) : null;

    const todayLabel = new Date().toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

    const summary = [
        { title: 'Total Flagged', value: scholars.length, color: PRIMARY, icon: Users, desc: 'Scholars in this list' },
        { title: 'High Risk', value: highCount, color: DANGER, icon: AlertTriangle, desc: 'Requires immediate action' },
        { title: 'Medium Risk', value: medCount, color: WARNING, icon: Flag, desc: 'Needs close monitoring' },
        { title: 'Low Risk', value: lowCount, color: SUCCESS, icon: Bookmark, desc: 'No immediate concern' },
    ];

    const riskTabs = [
        { key: 'all', label: 'All', count: scholars.length },
        { key: 'high', label: 'High Risk', count: highCount },
        { key: 'medium', label: 'Medium Risk', count: medCount },
        { key: 'low', label: 'Low Risk', count: lowCount },
    ];

    return (
        <div className="min-h-screen w-full min-w-0 max-w-full overflow-x-hidden" style={{ ...sans, background: BG }} aria-label={`${portalLabel} flagged scholars`}>
            <style>{`
                .fs-focus:focus-visible { outline: 2px solid ${PRIMARY}; outline-offset: 2px; }
                .fs-row:hover { background: ${PRIMARY}08; }
            `}</style>

            <div className="w-full px-4 sm:px-6 lg:px-8">

                <AdminPageHeader
                    title="Flagged Scholars"
                    description="Monitor at-risk scholars, review records, and manage interventions."
                    actions={
                        <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
                        <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ ...cardStyle, borderRadius: 12 }}>
                            <Calendar size={17} style={{ color: BRONZE }} />
                            <div>
                                <p style={{ ...sans, fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED }}>Today</p>
                                <p style={{ ...sans, fontSize: '0.78rem', fontWeight: 600, color: INK }}>{todayLabel}</p>
                            </div>
                        </div>
                        <button type="button" className="fs-focus disabled:opacity-60" disabled={loading || filtered.length === 0}
                            onClick={() => exportCsv(filtered)} style={{ ...filledBtn, padding: '11px 18px' }}>
                            <Download size={14} /> Export CSV
                        </button>
                        </div>
                    }
                />

                <div className="flex flex-col gap-5">
                {/* ── KPI cards ── */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        {[0, 1, 2, 3].map(i => <Skeleton key={i} style={{ height: 104 }} />)}
                    </div>
                ) : (
                    <section aria-label="Risk summary" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        {summary.map(c => (
                            <div key={c.title} className="flex items-center gap-4 p-5" style={{ ...cardStyle, minHeight: 104 }}>
                                <IconBubble icon={c.icon} color={c.color} size={52} iconSize={22} />
                                <div className="min-w-0">
                                    <p style={{ ...serif, fontSize: '0.92rem', fontWeight: 700, color: c.color }}>{c.title}</p>
                                    <p style={{ ...serif, fontSize: '1.9rem', fontWeight: 700, color: INK, lineHeight: 1.1 }}>{c.value}</p>
                                    <p style={{ ...sans, fontSize: '0.72rem', color: MUTED, marginTop: 2 }}>{c.desc}</p>
                                </div>
                            </div>
                        ))}
                    </section>
                )}

                {/* ── Records ── */}
                <section style={{ ...cardStyle, padding: 20 }}>
                    {/* Toolbar */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        <div className="relative flex-1" style={{ minWidth: 220 }}>
                            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: MUTED }} />
                            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search name or scholar ID"
                                aria-label="Search scholars" className="fs-focus" style={{ ...fieldStyle, paddingLeft: 34 }} />
                        </div>
                        <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)} aria-label="Filter by year level" className="fs-focus" style={{ ...fieldStyle, width: 'auto', cursor: 'pointer' }}>
                            <option value="all">All Year Levels</option>
                            {gradeOptions.map(({ value, label }) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                        <button type="button" onClick={resetFilters} className="fs-focus" style={outlineBtn}>
                            <RotateCcw size={13} /> Reset
                        </button>
                        <button type="button" onClick={fetchScholars} className="fs-focus" style={outlineBtn} aria-label="Refresh list">
                            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> <span className="hidden sm:inline">Refresh</span>
                        </button>
                    </div>

                    {/* Risk tabs */}
                    <div className="flex gap-1 mb-4 overflow-x-auto" role="group" aria-label="Filter by risk level" style={{ borderBottom: `1px solid ${BORDER}` }}>
                        {riskTabs.map(t => {
                            const active = riskFilter === t.key;
                            return (
                                <button key={t.key} type="button" aria-pressed={active} onClick={() => setRiskFilter(t.key)} className="fs-focus"
                                    style={{ ...sans, fontSize: '0.78rem', fontWeight: active ? 700 : 500, color: active ? PRIMARY : MUTED, background: 'none', border: 'none', borderBottom: `2px solid ${active ? PRIMARY : 'transparent'}`, padding: '9px 14px', marginBottom: -1, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                    {t.label} <span style={{ fontWeight: 700 }}>· {t.count}</span>
                                </button>
                            );
                        })}
                    </div>

                    {loading ? (
                        <div className="flex flex-col gap-2">
                            {Array(5).fill(0).map((_, i) => <Skeleton key={i} style={{ height: 56 }} />)}
                        </div>
                    ) : error ? (
                        <div className="text-center" style={{ background: `${DANGER}0d`, border: `1px solid ${DANGER}40`, borderRadius: 14, padding: 28 }}>
                            <AlertTriangle size={26} className="mx-auto mb-2" style={{ color: DANGER }} />
                            <p style={{ ...sans, fontSize: '0.85rem', fontWeight: 700, color: DANGER }}>{error}</p>
                            <button type="button" onClick={fetchScholars} className="mt-3 fs-focus" style={{ ...sans, fontSize: '0.74rem', fontWeight: 700, color: DANGER, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>Try again</button>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-14" style={{ border: `1px dashed ${BORDER}`, borderRadius: 14 }}>
                            <UserX size={38} strokeWidth={1} style={{ color: BORDER }} className="mb-3" />
                            <p style={{ ...sans, fontSize: '0.85rem', fontWeight: 700, color: MUTED }}>No flagged scholars found.</p>
                            <p style={{ ...sans, fontSize: '0.75rem', color: MUTED, marginTop: 4 }}>All scholars are currently compliant.</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto" style={{ border: `1px solid ${BORDER}`, borderRadius: 12 }}>
                                <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 460 }}>
                                    <thead>
                                        <tr style={{ background: BG }}>
                                            {[
                                                { h: '#', cls: 'hidden sm:table-cell', w: 40 },
                                                { h: 'Scholar', cls: '' },
                                                { h: 'Year Level', cls: 'hidden md:table-cell' },
                                                { h: 'Risk Level', cls: '' },
                                                { h: 'Risk Score', cls: '' },
                                                { h: 'Key Issue', cls: 'hidden lg:table-cell' },
                                                { h: 'Last Updated', cls: 'hidden lg:table-cell' },
                                                { h: 'Actions', cls: '', align: 'right' },
                                            ].map(col => (
                                                <th key={col.h} scope="col" className={col.cls}
                                                    style={{ ...sans, fontSize: '0.68rem', fontWeight: 700, color: MUTED, textAlign: col.align || 'left', padding: '10px 14px', width: col.w }}>
                                                    {col.h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pageRows.map((sch, idx) => {
                                            const m = deriveMetrics(sch);
                                            const topFlag = m.flags[0];
                                            const updated = lastUpdatedOf(sch);
                                            return (
                                                <tr key={sch.scholar_id} className="fs-row" style={{ borderTop: `1px solid ${BORDER}` }}>
                                                    <td className="hidden sm:table-cell" style={{ ...sans, fontSize: '0.76rem', color: MUTED, padding: '10px 14px' }}>{startIdx + idx + 1}</td>
                                                    <td style={{ padding: '10px 14px' }}>
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <Avatar name={sch.full_name} />
                                                            <div className="min-w-0">
                                                                <p style={{ ...sans, fontSize: '0.8rem', fontWeight: 700, color: INK }} className="truncate">{sch.full_name}</p>
                                                                <p style={{ ...sans, fontSize: '0.68rem', color: MUTED }} className="truncate">
                                                                    {sch.scholar_id}<span className="md:hidden">{sch.year_level ? ` · ${sch.year_level}` : ''}</span>
                                                                </p>
                                                                {sch.email && <p className="truncate hidden sm:block" style={{ ...sans, fontSize: '0.68rem', color: MUTED }}>{sch.email}</p>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="hidden md:table-cell" style={{ ...sans, fontSize: '0.76rem', color: MUTED, padding: '10px 14px' }}>{sch.year_level ?? '—'}</td>
                                                    <td style={{ padding: '10px 14px' }}><RiskBadge level={sch.risk_level} /></td>
                                                    <td style={{ padding: '10px 14px' }}>
                                                        <p style={{ ...serif, fontSize: '1rem', fontWeight: 700, color: riskColor(sch.risk_level) }}>{m.riskScore}</p>
                                                        <div className="h-1 rounded-full overflow-hidden mt-1" style={{ background: BORDER, width: 44 }}>
                                                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, m.riskScore)}%`, background: riskColor(sch.risk_level) }} />
                                                        </div>
                                                    </td>
                                                    <td className="hidden lg:table-cell" style={{ padding: '10px 14px', maxWidth: 240 }}>
                                                        <p style={{ ...sans, fontSize: '0.76rem', color: INK }} className="truncate">{topFlag ? topFlag.description : '—'}</p>
                                                    </td>
                                                    <td className="hidden lg:table-cell" style={{ ...sans, fontSize: '0.76rem', color: MUTED, padding: '10px 14px', whiteSpace: 'nowrap' }}
                                                        title={updated && !updated.exact ? 'Based on last submission date' : undefined}>
                                                        {updated ? updated.label : '—'}
                                                    </td>
                                                    <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                        <button type="button" onClick={() => openDetails(sch.scholar_id)} className="fs-focus"
                                                            aria-label={`View details for ${sch.full_name}`}
                                                            style={{ ...outlineBtn, color: PRIMARY, border: `1px solid ${PRIMARY}55`, padding: '6px 14px', marginRight: 6 }}>
                                                            View
                                                        </button>
                                                        <button type="button" aria-label={`More actions for ${sch.full_name}`} aria-haspopup="menu"
                                                            onClick={(e) => openMenu(e, sch.scholar_id)} className="fs-focus"
                                                            style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${BORDER}`, background: SURFACE, color: MUTED, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', verticalAlign: 'middle' }}>
                                                            <MoreVertical size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
                                <p style={{ ...sans, fontSize: '0.74rem', color: MUTED }}>
                                    Showing {startIdx + 1}–{startIdx + pageRows.length} of {filtered.length} {filtered.length === 1 ? 'scholar' : 'scholars'}
                                </p>
                                <nav aria-label="Pagination" className="flex items-center gap-1.5">
                                    <button type="button" onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage === 1} aria-label="Previous page" className="fs-focus disabled:opacity-40"
                                        style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, background: SURFACE, color: MUTED, cursor: safePage === 1 ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <ChevronLeft size={15} />
                                    </button>
                                    {pageNumbers.map(n => {
                                        const active = n === safePage;
                                        return (
                                            <button key={n} type="button" onClick={() => setPage(n)} aria-current={active ? 'page' : undefined} className="fs-focus"
                                                style={{ ...sans, minWidth: 32, height: 32, borderRadius: 8, border: `1px solid ${active ? PRIMARY : BORDER}`, background: active ? PRIMARY : SURFACE, color: active ? '#fff' : INK, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                                                {n}
                                            </button>
                                        );
                                    })}
                                    <button type="button" onClick={() => setPage(Math.min(totalPages, safePage + 1))} disabled={safePage === totalPages} aria-label="Next page" className="fs-focus disabled:opacity-40"
                                        style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, background: SURFACE, color: MUTED, cursor: safePage === totalPages ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <ChevronRight size={15} />
                                    </button>
                                </nav>
                            </div>
                        </>
                    )}
                </section>
                </div>
            </div>

            {/* Row action menu */}
            {menu && menuScholar && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} aria-hidden="true" />
                    <div role="menu" className="fixed z-50" style={{ top: menu.top, left: menu.left, width: 190, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: '0 14px 30px -12px rgba(36,21,18,0.3)', padding: 6 }}>
                        {[
                            { label: 'View details', icon: Eye, onClick: () => openDetails(menuScholar.scholar_id) },
                            { label: 'Send email', icon: Mail, href: `mailto:${menuScholar.email}`, onClick: () => setMenu(null) },
                            { label: 'Home visit', icon: Home, onClick: () => { setMenu(null); handleHomeVisit(menuScholar); } },
                        ].map(item => {
                            const Icon = item.icon;
                            const style = { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', borderRadius: 8, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', ...sans, fontSize: '0.78rem', color: INK, textDecoration: 'none' };
                            return item.href
                                ? <a key={item.label} role="menuitem" href={item.href} onClick={item.onClick} className="fs-focus fs-row" style={style}><Icon size={14} style={{ color: PRIMARY }} /> {item.label}</a>
                                : <button key={item.label} role="menuitem" type="button" onClick={item.onClick} className="fs-focus fs-row" style={style}><Icon size={14} style={{ color: PRIMARY }} /> {item.label}</button>;
                        })}
                    </div>
                </>
            )}

            {/* Scholar Details modal */}
            {detailScholar && (
                <ScholarModal onClose={closeDetails} titleId="scholar-details-title">
                    <DetailsPanel key={detailScholar.scholar_id} scholar={detailScholar}
                        tab={tab} setTab={setTab}
                        note={detailNote} setNote={(v) => setNoteFor(detailScholar.scholar_id, v)}
                        saved={savedNoteFor === detailScholar.scholar_id} onSaveNote={() => saveNote(detailScholar.scholar_id)}
                        onHomeVisit={() => handleHomeVisit(detailScholar)} onAddNote={focusCaseNote}
                        loggingVisit={loggingVisitFor === detailScholar.scholar_id} />
                </ScholarModal>
            )}
        </div>
    );
};

export default FlaggedScholars;