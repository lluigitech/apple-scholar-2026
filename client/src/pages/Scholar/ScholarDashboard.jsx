
import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import useComplianceStatus from '../../hooks/useComplianceStatus';
import { buildScholarChecklist } from '../../utils/scholarChecklist';
import {
    Clock3,
    AlertTriangle,
    ChevronRight,
    FileText,
    Upload,
    Timer,
    Image,
    RefreshCw,
    CheckCircle2,
    XCircle,
    ShieldCheck,
    ArrowUpRight,
} from 'lucide-react';

/*
 * Apple Scholar — Scholar Dashboard
 * Redesigned to match the shared Scholar Portal visual language:
 * rounded bento cards, warm paper background, maroon branding,
 * bronze accents, clean typography, and responsive layouts.
 *
 * IMPORTANT:
 * - Backend/API logic is preserved.
 * - Routes are preserved.
 * - Compliance data, submissions, requirements, announcements,
 *   feedback, and refresh behavior are preserved.
 * - Only the presentation/layout is redesigned.
 */

const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const PRIMARY = '#6D2140';
const PRIMARY_DARK = '#4A1730';
const BRONZE = '#A9784E';
const SUCCESS = '#6B8F71';
const WARNING = '#C08A3E';
const DANGER = '#C0473F';
const INK = '#241512';
const MUTED = '#8A7A68';
const RADIUS = 18;

const display = { fontFamily: "'Playfair Display', Georgia, serif" };
const body = { fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif" };
const mono = { fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif" };

const authHeader = () => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
};

const getComplianceColor = (value) => {
    if (value == null) return MUTED;
    return Number(value) >= 70 ? SUCCESS : DANGER;
};

const getRiskLabel = (score) => {
    if (score >= 70) return 'Low Risk';
    if (score >= 50) return 'Medium Risk';
    return 'High Risk';
};

const getRiskColor = (score) => {
    if (score >= 70) return SUCCESS;
    if (score >= 50) return WARNING;
    return DANGER;
};

const formatStatus = (status) => {
    if (!status) return 'Not submitted';
    if (status === 'approved') return 'Approved';
    if (status === 'rejected') return 'Returned';
    if (status === 'pending') return 'Under review';
    return status;
};

const formatChecklistDate = (value) => {
    if (!value) return null;
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime())
        ? null
        : date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

const StatusBadge = ({ status }) => {
    const config = {
        approved: { color: SUCCESS, bg: `${SUCCESS}14`, icon: CheckCircle2 },
        rejected: { color: DANGER, bg: `${DANGER}12`, icon: XCircle },
        pending: { color: WARNING, bg: `${WARNING}14`, icon: Clock3 },
    };

    const cfg = config[status] || {
        color: MUTED,
        bg: `${MUTED}12`,
        icon: Clock3,
    };

    const Icon = cfg.icon;

    return (
        <span
            className="inline-flex items-center gap-1.5"
            style={{
                ...body,
                fontSize: '0.72rem',
                fontWeight: 700,
                color: cfg.color,
                background: cfg.bg,
                borderRadius: 999,
                padding: '5px 10px',
                whiteSpace: 'nowrap',
            }}
        >
            <Icon size={12} />
            {formatStatus(status)}
        </span>
    );
};

const ProgressBar = ({ value, color = PRIMARY }) => (
    <div
        style={{
            width: '100%',
            height: 7,
            background: `${BORDER}80`,
            borderRadius: 999,
            overflow: 'hidden',
        }}
    >
        <div
            style={{
                width: `${Math.max(0, Math.min(100, value || 0))}%`,
                height: '100%',
                background: color,
                borderRadius: 999,
                transition: 'width 500ms ease',
            }}
        />
    </div>
);

const ComplianceGauge = ({ score, loading }) => {
    const value = score == null ? 0 : Math.max(0, Math.min(100, Number(score)));
    const radius = 46;
    const circumference = 2 * Math.PI * radius;
    const dash = (value / 100) * circumference;
    const color = getComplianceColor(score);

    return (
        <div
            className="relative flex items-center justify-center flex-shrink-0"
            style={{ width: 124, height: 124 }}
        >
            <svg
                width="124"
                height="124"
                viewBox="0 0 124 124"
                style={{ transform: 'rotate(-90deg)' }}
            >
                <circle
                    cx="62"
                    cy="62"
                    r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth="9"
                />
                <circle
                    cx="62"
                    cy="62"
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth="9"
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${circumference}`}
                    style={{ transition: 'stroke-dasharray 600ms ease' }}
                />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
                {loading ? (
                    <div
                        className="animate-pulse"
                        style={{
                            width: 34,
                            height: 20,
                            borderRadius: 6,
                            background: 'rgba(255,255,255,0.2)',
                        }}
                    />
                ) : (
                    <>
                        <span
                            style={{
                                ...display,
                                color: '#fff',
                                fontSize: '1.65rem',
                                fontWeight: 700,
                                lineHeight: 1,
                            }}
                        >
                            {score == null ? '—' : Math.round(score)}
                        </span>
                        <span
                            style={{
                                ...mono,
                                color: 'rgba(255,255,255,0.68)',
                                fontSize: '0.55rem',
                                fontWeight: 800,
                                letterSpacing: '0.09em',
                                marginTop: 5,
                            }}
                        >
                            COMPLIANCE
                        </span>
                    </>
                )}
            </div>
        </div>
    );
};

const BentoStat = ({ icon: Icon, label, value, detail, accent = PRIMARY }) => (
    <div
        className="min-w-0"
        style={{
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: RADIUS,
            padding: '17px 18px',
        }}
    >
        <div className="flex items-start justify-between gap-3">
            <span
                className="flex items-center justify-center flex-shrink-0"
                style={{
                    width: 34,
                    height: 34,
                    borderRadius: 11,
                    background: `${accent}14`,
                }}
            >
                <Icon size={16} style={{ color: accent }} />
            </span>
        </div>

        <p
            style={{
                ...display,
                fontSize: '1.45rem',
                fontWeight: 700,
                color: INK,
                marginTop: 13,
            }}
            className="truncate"
        >
            {value}
        </p>

        <p
            style={{
                ...body,
                fontSize: '0.76rem',
                fontWeight: 700,
                color: INK,
                marginTop: 2,
            }}
        >
            {label}
        </p>

        <p
            style={{
                ...body,
                fontSize: '0.69rem',
                color: MUTED,
                marginTop: 3,
            }}
            className="truncate"
        >
            {detail}
        </p>
    </div>
);

const RequirementRow = ({ requirement }) => {
    const status = requirement.done
        ? { label: 'Complete', detail: 'Approved', color: SUCCESS }
        : requirement.status === 'pending_review'
            ? { label: 'Pending Review', detail: 'Awaiting officer review', color: WARNING }
            : ['rejected', 'returned'].includes(requirement.status)
                ? { label: 'Returned', detail: 'Revision required', color: DANGER }
                : ['missed', 'missing'].includes(requirement.status)
                    ? { label: 'Missed', detail: 'Deadline passed', color: DANGER }
                    : { label: 'Pending', detail: 'Still needs attention', color: WARNING };

    return (
        <div
        className="flex items-center justify-between gap-3"
        style={{
            padding: '13px 0',
            borderBottom: `1px solid ${BORDER}`,
        }}
    >
        <div className="flex items-center gap-3 min-w-0">
            <span
                className="flex items-center justify-center flex-shrink-0"
                style={{
                    width: 34,
                    height: 34,
                    borderRadius: 11,
                    background: `${status.color}14`,
                    color: status.color,
                }}
            >
                {requirement.icon}
            </span>

            <div className="min-w-0">
                <p
                    style={{
                        ...body,
                        fontSize: '0.81rem',
                        fontWeight: 700,
                        color: INK,
                    }}
                    className="truncate"
                >
                    {requirement.label}
                </p>

                <p
                    style={{
                        ...body,
                        fontSize: '0.68rem',
                        color: MUTED,
                        marginTop: 2,
                    }}
                >
                    {status.detail}
                </p>
            </div>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span
                style={{
                    ...body,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: status.color,
                    whiteSpace: 'nowrap',
                }}
            >
                {status.label}
            </span>
            {requirement.dueDate && formatChecklistDate(requirement.dueDate) && (
                <span style={{ ...body, fontSize: '0.65rem', color: MUTED, whiteSpace: 'nowrap' }}>
                    Due {formatChecklistDate(requirement.dueDate)}
                </span>
            )}
        </div>
        </div>
    );
};

const LatestAnnouncementsCard = ({ announcements, onOpen }) => (
    <section
        className="col-span-full min-w-0 w-full"
        style={{
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: RADIUS,
            padding: '18px',
        }}
    >
        <div className="flex items-center justify-between gap-3 mb-4">
            <div>
                <p style={{ ...body, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.08em', color: BRONZE, textTransform: 'uppercase' }}>
                    From your portal
                </p>
                <h2 className="mt-1" style={{ ...display, fontSize: '1.08rem', fontWeight: 700, color: INK }}>
                    Latest announcements
                </h2>
            </div>
            <button
                type="button"
                onClick={onOpen}
                className="inline-flex flex-shrink-0 items-center gap-1"
                style={{ ...body, fontSize: '0.68rem', fontWeight: 700, color: PRIMARY, background: `${PRIMARY}0A`, border: `1px solid ${BORDER}`, borderRadius: 999, padding: '7px 10px', cursor: 'pointer' }}
            >
                View all <ChevronRight size={12} />
            </button>
        </div>

        {announcements.length === 0 ? (
            <p style={{ ...body, fontSize: '0.75rem', color: MUTED }}>No announcements yet.</p>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {announcements.slice(0, 3).map((announcement) => (
                    <article
                        key={announcement.id}
                        className="min-w-0"
                        style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 15px' }}
                    >
                        <span style={{ ...body, fontSize: '0.61rem', fontWeight: 800, color: PRIMARY, background: `${PRIMARY}10`, borderRadius: 999, padding: '4px 8px' }}>
                            NOTICE
                        </span>
                        <h3 className="mt-3 line-clamp-2" style={{ ...display, fontSize: '0.96rem', fontWeight: 700, color: INK, lineHeight: 1.3 }}>
                            {announcement.title}
                        </h3>
                        <p className="mt-1 line-clamp-2" style={{ ...body, fontSize: '0.71rem', color: MUTED, lineHeight: 1.5 }}>
                            {announcement.content}
                        </p>
                        <p className="mt-3 border-t pt-2" style={{ ...body, fontSize: '0.62rem', color: MUTED, borderColor: BORDER }}>
                            {announcement.created_at ? new Date(announcement.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date unavailable'}
                        </p>
                    </article>
                ))}
            </div>
        )}
    </section>
);

const ComplianceFlags = ({ flags, visible }) => visible && flags.length > 0 && (
    <section
        style={{
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: RADIUS,
            padding: '18px 20px',
        }}
    >
        <div className="flex items-center justify-between gap-3 mb-3">
            <div>
                <p style={{ ...body, fontSize: '0.61rem', fontWeight: 800, letterSpacing: '0.1em', color: DANGER, textTransform: 'uppercase' }}>
                    Attention needed
                </p>
                <h2 style={{ ...display, fontSize: '1.05rem', fontWeight: 700, color: INK, marginTop: 3 }}>
                    Compliance flags
                </h2>
            </div>
            <AlertTriangle size={17} style={{ color: DANGER }} />
        </div>

        <div className="grid grid-cols-1 gap-2.5">
            {flags.map((flag, index) => (
                <div
                    key={index}
                    className="flex items-start gap-2.5"
                    style={{ background: `${DANGER}08`, border: `1px solid ${DANGER}18`, borderRadius: 12, padding: '11px 12px' }}
                >
                    <AlertTriangle size={13} style={{ color: DANGER, flexShrink: 0, marginTop: 2 }} />
                    <p style={{ ...body, fontSize: '0.73rem', color: INK, lineHeight: 1.45 }}>
                        {flag.description}
                    </p>
                </div>
            ))}
        </div>
    </section>
);

const Skeleton = ({ className = '' }) => (
    <div
        className={`animate-pulse ${className}`}
        style={{
            background: `${BORDER}88`,
            borderRadius: RADIUS,
        }}
    />
);

const ScholarDashboard = () => {
    const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$|\/$/g, '');
    const API = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;

    const navigate = useNavigate();
    const {
        data: complianceData,
        loading: complianceLoading,
        error: complianceError,
        refetch: refreshCompliance,
    } = useComplianceStatus();

    const name = localStorage.getItem('name');
    const scholarId = localStorage.getItem('scholar_id');

    const [latestSubmission, setLatestSubmission] = useState(null);
    const [announcements, setAnnouncements] = useState([]);
    const [checklistInputs, setChecklistInputs] = useState({ duties: [], history: [], grades: [], tasks: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [subRes, annRes, dutiesRes, gradesRes, tasksRes] = await Promise.allSettled([
                    axios.get(`${API}/submission/history/${scholarId}`, {
                        headers: authHeader(),
                    }),
                    axios.get(`${API}/scholar/announcements`, {
                        headers: authHeader(),
                    }),
                    axios.get(`${API}/scholar/my-duties`, { headers: authHeader() }),
                    axios.get(`${API}/submission/grades/${scholarId}`, { headers: authHeader() }),
                    axios.get(`${API}/tasks`, { headers: authHeader() }),
                ]);

                const history = subRes.status === 'fulfilled' && Array.isArray(subRes.value.data) ? subRes.value.data : [];
                if (history.length > 0) {
                    setLatestSubmission(history[0]);
                }

                if (annRes.status === 'fulfilled') {
                    setAnnouncements(annRes.value.data.slice(0, 3));
                }

                setChecklistInputs({
                    duties: dutiesRes.status === 'fulfilled' && Array.isArray(dutiesRes.value.data) ? dutiesRes.value.data : [],
                    history,
                    grades: gradesRes.status === 'fulfilled' && Array.isArray(gradesRes.value.data) ? gradesRes.value.data : [],
                    tasks: tasksRes.status === 'fulfilled' && Array.isArray(tasksRes.value.data) ? tasksRes.value.data : [],
                });
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [scholarId]);

    const allRequirements = buildScholarChecklist(checklistInputs).map((task) => ({
        ...task,
        label: task.title,
        icon: task.type === 'Duty Participation' ? <Timer size={15} /> : <Upload size={15} />,
    }));
    const today = new Date();
    const checklistNow = today;
    const sevenDaysAgo = checklistNow.getTime() - 7 * 24 * 60 * 60 * 1000;
    const requirements = allRequirements.filter((item) => {
        if (item.done) {
            const completedAt = item.completedAt ? new Date(item.completedAt).getTime() : NaN;
            return Number.isFinite(completedAt) && completedAt >= sevenDaysAgo && completedAt <= checklistNow.getTime();
        }
        if (['missed', 'missing'].includes(item.status)) {
            if (!item.dueDate) return false;
            const dueDate = new Date(`${String(item.dueDate).slice(0, 10)}T00:00:00`);
            return !Number.isNaN(dueDate.getTime())
                && dueDate.getFullYear() === checklistNow.getFullYear()
                && dueDate.getMonth() === checklistNow.getMonth();
        }
        return true;
    });

    const completedCount = requirements.filter((r) => r.done).length;

    const complianceScore = complianceData?.overall_compliance ?? null;
    const riskScore = Number(complianceData?.risk_score || 0);
    const riskLabel =
        complianceScore !== null
            ? getRiskLabel(Number(complianceScore))
            : 'Loading...';
    const riskColor =
        complianceScore !== null
            ? getRiskColor(Number(complianceScore))
            : MUTED;

    const topFlags = complianceData?.flags?.slice(0, 2) ?? [];

    const completionPercent = requirements.length
        ? Math.round((completedCount / requirements.length) * 100)
        : 0;

    return (
        <div
            style={{
                ...body,
                background: BG,
                minHeight: '100vh',
                color: INK,
            }}
        >
            <div
                className="w-full px-4 sm:px-6 lg:px-8"
                style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    paddingTop: 24,
                    paddingBottom: 40,
                }}
            >
                {/* ───────────────── HERO ───────────────── */}
                <section
                    className="relative overflow-hidden"
                    style={{
                        background: `linear-gradient(135deg, ${PRIMARY_DARK} 0%, ${PRIMARY} 58%, #7C2D4C 100%)`,
                        borderRadius: 24,
                        padding: '24px',
                        marginBottom: 16,
                        boxShadow: '0 18px 40px -28px rgba(74,23,48,0.55)',
                    }}
                >
                    <div
                        aria-hidden="true"
                        className="absolute"
                        style={{
                            width: 260,
                            height: 260,
                            right: -80,
                            top: -120,
                            borderRadius: '50%',
                            border: '1px solid rgba(255,255,255,0.09)',
                        }}
                    />
                    <div
                        aria-hidden="true"
                        className="absolute"
                        style={{
                            width: 180,
                            height: 180,
                            right: 30,
                            bottom: -120,
                            borderRadius: '50%',
                            border: '1px solid rgba(255,255,255,0.07)',
                        }}
                    />

                    <div className="relative grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-8 items-center">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span
                                    style={{
                                        ...body,
                                        fontSize: '0.62rem',
                                        fontWeight: 800,
                                        letterSpacing: '0.15em',
                                        color: '#E4C28F',
                                        textTransform: 'uppercase',
                                    }}
                                >
                                    Scholar Portal
                                </span>

                                <span
                                    style={{
                                        width: 4,
                                        height: 4,
                                        borderRadius: '50%',
                                        background: '#E4C28F',
                                    }}
                                />

                                <span
                                    style={{
                                        ...body,
                                        fontSize: '0.65rem',
                                        color: 'rgba(255,255,255,0.62)',
                                    }}
                                >
                                    AY {today.getFullYear()}–{today.getFullYear() + 1}
                                </span>
                            </div>

                            <h1
                                style={{
                                    ...display,
                                    fontSize: 'clamp(1.8rem, 4vw, 2.75rem)',
                                    lineHeight: 1.08,
                                    fontWeight: 700,
                                    color: '#fff',
                                    marginTop: 8,
                                }}
                            >
                                Welcome back, {name || 'Scholar'}.
                            </h1>

                            <p
                                style={{
                                    ...body,
                                    fontSize: '0.82rem',
                                    lineHeight: 1.6,
                                    color: 'rgba(255,255,255,0.72)',
                                    marginTop: 8,
                                    maxWidth: 580,
                                }}
                            >
                                Keep your scholarship requirements on track,
                                review your compliance status, and stay updated
                                with important notices.
                            </p>

                            <div className="flex items-center gap-2 flex-wrap mt-5">
                                {scholarId && (
                                    <span
                                        style={{
                                            ...body,
                                            fontSize: '0.67rem',
                                            fontWeight: 700,
                                            color: 'rgba(255,255,255,0.82)',
                                            background: 'rgba(255,255,255,0.09)',
                                            border: '1px solid rgba(255,255,255,0.12)',
                                            borderRadius: 999,
                                            padding: '6px 11px',
                                        }}
                                    >
                                        {scholarId}
                                    </span>
                                )}

                                <button
                                    onClick={() => navigate('/scholar/submission')}
                                    className="inline-flex items-center gap-1.5"
                                    style={{
                                        ...body,
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        color: PRIMARY,
                                        background: '#FFFDF9',
                                        border: 'none',
                                        borderRadius: 999,
                                        padding: '7px 13px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Manage submissions
                                    <ArrowUpRight size={12} />
                                </button>
                            </div>
                        </div>

                        {/* Hero compliance score */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full xl:w-auto xl:min-w-[560px]">
                                                    <div
                                                        className="flex items-center gap-4 self-stretch"
                            style={{
                                background: 'rgba(255,255,255,0.07)',
                                border: '1px solid rgba(255,255,255,0.10)',
                                borderRadius: 20,
                                padding: '16px 18px',
                            }}
                        >
                            <ComplianceGauge
                                score={complianceScore}
                                loading={complianceLoading}
                            />

                            <div className="min-w-0">
                                <p
                                    style={{
                                        ...body,
                                        fontSize: '0.62rem',
                                        fontWeight: 800,
                                        letterSpacing: '0.11em',
                                        color: 'rgba(255,255,255,0.56)',
                                        textTransform: 'uppercase',
                                    }}
                                >
                                    Current standing
                                </p>

                                <p
                                    style={{
                                        ...display,
                                        fontSize: '1.12rem',
                                        fontWeight: 700,
                                        color: '#fff',
                                        marginTop: 5,
                                    }}
                                >
                                    {riskLabel}
                                </p>

                                <p
                                    style={{
                                        ...body,
                                        fontSize: '0.68rem',
                                        color: 'rgba(255,255,255,0.58)',
                                        lineHeight: 1.5,
                                        marginTop: 4,
                                    }}
                                >
                                    {complianceError
                                        ? 'Compliance data unavailable'
                                        : `${Math.round(riskScore)} risk points recorded`}
                                </p>

                                <button
                                    type="button"
                                    onClick={refreshCompliance}
                                    className="inline-flex items-center gap-1.5 mt-3"
                                    style={{
                                        ...body,
                                        fontSize: '0.66rem',
                                        fontWeight: 700,
                                        color: '#E4C28F',
                                        background: 'none',
                                        border: 'none',
                                        padding: 0,
                                        cursor: 'pointer',
                                    }}
                                >
                                    <RefreshCw size={11} />
                                    Refresh status
                                </button>
                            </div>
                                                    </div>

                                                    <section
                                                        className="flex flex-col justify-center"
                                                        style={{
                                                                background: 'rgba(255,255,255,0.07)',
                                                                border: '1px solid rgba(255,255,255,0.10)',
                                                                borderRadius: 20,
                                                                padding: '16px 18px',
                                                                color: '#fff',
                                                        }}
                                                    >
                                                        <p style={{ ...body, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.11em', color: '#DDB77C', textTransform: 'uppercase' }}>
                                                                Scholarship status
                                                        </p>
                                                        <p style={{ ...display, fontSize: '1.25rem', fontWeight: 700, marginTop: 5 }}>
                                                                Active
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-3">
                                                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#8FE0B0' }} />
                                                                <span style={{ ...body, fontSize: '0.64rem', fontWeight: 700, color: 'rgba(255,255,255,0.74)' }}>
                                                                        VERIFIED SCHOLAR
                                                                </span>
                                                        </div>
                                                    </section>
                                                </div>
                    </div>
                </section>

                {/* ───────────────── BENTO STATS ───────────────── */}
                {loading ? (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                        <Skeleton className="col-span-2 lg:col-span-4 h-[128px]" />
                    </div>
                ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                        <LatestAnnouncementsCard
                            announcements={announcements}
                            onOpen={() => navigate('/scholar/announcements')}
                        />
                    </div>
                )}

                {/* ───────────────── MAIN BENTO GRID ───────────────── */}
                {loading ? (
                    <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_0.85fr] gap-4">
                        <Skeleton className="h-[470px]" />
                        <div className="space-y-4">
                            <Skeleton className="h-[220px]" />
                            <Skeleton className="h-[210px]" />
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_0.85fr] gap-4">
                        {/* Requirements */}
                        <section
                            style={{
                                background: SURFACE,
                                border: `1px solid ${BORDER}`,
                                borderRadius: RADIUS,
                                padding: '20px',
                            }}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p
                                        style={{
                                            ...body,
                                            fontSize: '0.62rem',
                                            fontWeight: 800,
                                            letterSpacing: '0.1em',
                                            color: BRONZE,
                                            textTransform: 'uppercase',
                                        }}
                                    >
                                        Requirements Checklist
                                    </p>

                                    <h2
                                        style={{
                                            ...display,
                                            fontSize: '1.28rem',
                                            fontWeight: 700,
                                            color: INK,
                                            marginTop: 4,
                                        }}
                                    >
                                        Requirements
                                    </h2>

                                    <p
                                        style={{
                                            ...body,
                                            fontSize: '0.72rem',
                                            color: MUTED,
                                            marginTop: 4,
                                        }}
                                    >
                                        Your assigned requirements and duty status.
                                    </p>
                                </div>

                                <button
                                    onClick={() => navigate('/scholar/checklist')}
                                    className="inline-flex items-center gap-1"
                                    style={{
                                        ...body,
                                        fontSize: '0.69rem',
                                        fontWeight: 700,
                                        color: PRIMARY,
                                        background: `${PRIMARY}0A`,
                                        border: `1px solid ${BORDER}`,
                                        borderRadius: 999,
                                        padding: '7px 10px',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    View all
                                    <ChevronRight size={12} />
                                </button>
                            </div>

                            <div
                                className="mt-5"
                                style={{
                                    background: BG,
                                    borderRadius: 15,
                                    padding: '12px 15px',
                                }}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <span
                                        style={{
                                            ...body,
                                            fontSize: '0.69rem',
                                            fontWeight: 700,
                                            color: INK,
                                        }}
                                    >
                                        Overall completion
                                    </span>

                                    <span
                                        style={{
                                            ...body,
                                            fontSize: '0.69rem',
                                            fontWeight: 800,
                                            color: SUCCESS,
                                        }}
                                    >
                                        {completedCount}/{requirements.length}
                                    </span>
                                </div>

                                <div className="mt-2">
                                    <ProgressBar
                                        value={completionPercent}
                                        color={SUCCESS}
                                    />
                                </div>
                            </div>

                            <div className="mt-3">
                                {requirements.map((req, index) => (
                                    <RequirementRow
                                        key={req.label}
                                        requirement={req}
                                    />
                                ))}
                            </div>

                            {completedCount < requirements.length && (
                                <button
                                    onClick={() => navigate('/scholar/checklist')}
                                    className="w-full inline-flex items-center justify-center gap-2"
                                    style={{
                                        ...body,
                                        marginTop: 17,
                                        padding: '11px 14px',
                                        borderRadius: 12,
                                        border: 'none',
                                        background: PRIMARY,
                                        color: '#fff',
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                    }}
                                >
                                    View pending requirements
                                    <ArrowUpRight size={13} />
                                </button>
                            )}
                        </section>

                        {/* Right column */}
                        <div className="flex flex-col gap-4">
                            {/* Latest submission */}
                            <section
                                style={{
                                    background: SURFACE,
                                    border: `1px solid ${BORDER}`,
                                    borderRadius: RADIUS,
                                    padding: '20px',
                                }}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p
                                            style={{
                                                ...body,
                                                fontSize: '0.62rem',
                                                fontWeight: 800,
                                                letterSpacing: '0.1em',
                                                color: BRONZE,
                                                textTransform: 'uppercase',
                                            }}
                                        >
                                            Records
                                        </p>
                                        <h2
                                            style={{
                                                ...display,
                                                fontSize: '1.15rem',
                                                fontWeight: 700,
                                                color: INK,
                                                marginTop: 4,
                                            }}
                                        >
                                            Latest submission
                                        </h2>
                                    </div>

                                    <FileText size={17} style={{ color: PRIMARY }} />
                                </div>

                                {latestSubmission ? (
                                    <div
                                        className="mt-4"
                                        style={{
                                            background: BG,
                                            border: `1px solid ${BORDER}`,
                                            borderRadius: 14,
                                            padding: 14,
                                        }}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-3 min-w-0">
                                                <div
                                                    className="flex items-center justify-center flex-shrink-0"
                                                    style={{
                                                        width: 38,
                                                        height: 38,
                                                        borderRadius: 11,
                                                        background: `${PRIMARY}12`,
                                                        color: PRIMARY,
                                                    }}
                                                >
                                                    <FileText size={17} />
                                                </div>

                                                <div className="min-w-0">
                                                    <p
                                                        style={{
                                                            ...body,
                                                            fontSize: '0.78rem',
                                                            fontWeight: 800,
                                                            color: INK,
                                                        }}
                                                    >
                                                        Monthly submission
                                                    </p>
                                                    <p
                                                        style={{
                                                            ...body,
                                                            fontSize: '0.68rem',
                                                            color: MUTED,
                                                            marginTop: 3,
                                                        }}
                                                        className="truncate"
                                                    >
                                                        {latestSubmission.submitted_at
                                                            ? new Date(
                                                                  latestSubmission.submitted_at
                                                              ).toLocaleDateString(
                                                                  'en-PH',
                                                                  {
                                                                      month: 'short',
                                                                      day: 'numeric',
                                                                      year: 'numeric',
                                                                  }
                                                              )
                                                            : 'Date unavailable'}
                                                    </p>
                                                </div>
                                            </div>

                                            <StatusBadge status={latestSubmission.status} />
                                        </div>

                                        {latestSubmission.staff_comment && (
                                            <div
                                                className="mt-3"
                                                style={{
                                                    borderTop: `1px solid ${BORDER}`,
                                                    paddingTop: 11,
                                                }}
                                            >
                                                <p
                                                    style={{
                                                        ...body,
                                                        fontSize: '0.64rem',
                                                        fontWeight: 800,
                                                        color: DANGER,
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.06em',
                                                    }}
                                                >
                                                    Officer feedback
                                                </p>
                                                <p
                                                    style={{
                                                        ...body,
                                                        fontSize: '0.71rem',
                                                        color: MUTED,
                                                        lineHeight: 1.5,
                                                        marginTop: 4,
                                                    }}
                                                >
                                                    {latestSubmission.staff_comment}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div
                                        className="mt-4 text-center"
                                        style={{
                                            background: BG,
                                            borderRadius: 14,
                                            padding: '28px 14px',
                                        }}
                                    >
                                        <FileText
                                            size={22}
                                            style={{ color: MUTED }}
                                        />
                                        <p
                                            style={{
                                                ...body,
                                                fontSize: '0.76rem',
                                                color: MUTED,
                                                marginTop: 7,
                                            }}
                                        >
                                            No submission recorded yet.
                                        </p>
                                    </div>
                                )}

                                <button
                                    onClick={() => navigate('/scholar/submission')}
                                    className="w-full inline-flex items-center justify-center gap-1.5"
                                    style={{
                                        ...body,
                                        marginTop: 12,
                                        padding: '9px 12px',
                                        borderRadius: 11,
                                        border: `1px solid ${BORDER}`,
                                        background: SURFACE,
                                        color: PRIMARY,
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                    }}
                                >
                                    Open submission center
                                    <ChevronRight size={12} />
                                </button>
                            </section>
                            <ComplianceFlags flags={topFlags} visible={!complianceLoading} />
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default ScholarDashboard;
