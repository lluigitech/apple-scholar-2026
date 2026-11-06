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
    RefreshCw,
    CheckCircle2,
    XCircle,
    ShieldCheck,
    ArrowUpRight,
    Bell,
    CalendarDays,
    Megaphone,
    ClipboardList,
} from 'lucide-react';

/*
 * Apple Scholar — Scholar Dashboard
 * UI redesign only. All API calls, routes, compliance logic, checklist
 * logic, notification behaviour and localStorage usage are unchanged.
 */

const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const PRIMARY = '#6D2140';
const PRIMARY_DARK = '#4A1730';
const PRIMARY_ACCENT = '#7C2D4C';
const GOLD = '#E4C28F';
const BRONZE = '#A9784E';
const SUCCESS = '#6B8F71';
const WARNING = '#C08A3E';
const DANGER = '#C0473F';
const INK = '#241512';
const MUTED = '#8A7A68';
const RADIUS = 18;
const CARD_SHADOW = '0 1px 2px rgba(36,21,18,0.04), 0 12px 28px -24px rgba(74,23,48,0.3)';

const display = { fontFamily: "'Playfair Display', Georgia, serif" };
const body = { fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif" };

const cardStyle = {
    background: SURFACE,
    border: `1px solid ${BORDER}`,
    borderRadius: RADIUS,
    boxShadow: CARD_SHADOW,
};

const glassStyle = {
    background: 'rgba(255,255,255,0.10)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 999,
};

const eyebrow = {
    ...body,
    fontSize: '0.62rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
};

const pillButton = {
    ...body,
    fontSize: '0.68rem',
    fontWeight: 700,
    color: PRIMARY,
    background: `${PRIMARY}0A`,
    border: `1px solid ${BORDER}`,
    borderRadius: 999,
    padding: '6px 11px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
};

const globalCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700&display=swap');
.sd-root *, .sd-root *::before, .sd-root *::after { box-sizing: border-box; }
.sd-root { overflow-x: hidden; }
.sd-root button:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 2px; }
.sd-lift { transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease; }
.sd-lift:hover { transform: translateY(-1px); border-color: ${BRONZE}66; box-shadow: 0 14px 26px -20px rgba(74,23,48,0.35); }
.sd-btn { transition: background 160ms ease, transform 160ms ease; }
.sd-btn:hover { transform: translateY(-1px); }
.sd-pill:hover { background: ${PRIMARY}14 !important; }
.sd-row { transition: background 160ms ease; }
.sd-row:hover { background: ${BG}; }
.sd-clamp2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
@media (prefers-reduced-motion: reduce) {
    .sd-lift, .sd-btn, .sd-row { transition: none; }
    .sd-lift:hover, .sd-btn:hover { transform: none; }
}
`;

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

const formatShortDate = (value) =>
    value
        ? new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Date unavailable';

const formatNotificationDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? null
        : date.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

/* ───────────────────────── Small components ───────────────────────── */

const StatusBadge = ({ status }) => {
    const config = {
        approved: { color: SUCCESS, bg: `${SUCCESS}14`, icon: CheckCircle2 },
        rejected: { color: DANGER, bg: `${DANGER}12`, icon: XCircle },
        pending: { color: WARNING, bg: `${WARNING}14`, icon: Clock3 },
    };
    const cfg = config[status] || { color: MUTED, bg: `${MUTED}12`, icon: Clock3 };
    const Icon = cfg.icon;

    return (
        <span
            className="inline-flex items-center gap-1.5"
            style={{ ...body, fontSize: '0.7rem', fontWeight: 700, color: cfg.color, background: cfg.bg, borderRadius: 999, padding: '4px 10px', whiteSpace: 'nowrap' }}
        >
            <Icon size={12} />
            {formatStatus(status)}
        </span>
    );
};

const ScholarNotificationBell = ({ api, onNavigate, notifications, setNotifications, loading, error, setError, onRetry }) => {
    const [open, setOpen] = useState(false);
    const [updating, setUpdating] = useState(false);
    const unreadCount = notifications.filter(notification => !notification.read).length;

    const markAsRead = async (notification) => {
        if (notification.read) return true;
        try {
            await axios.patch(`${api}/scholar/notifications/${notification.id}/read`, {}, { headers: authHeader() });
            setNotifications(current => current.map(item => item.id === notification.id ? { ...item, read: true } : item));
            setError('');
            return true;
        } catch (requestError) {
            console.error('Unable to mark scholar notification as read:', requestError);
            setError(requestError.response?.data?.error || 'Unable to update this notification.');
            return false;
        }
    };

    const markAllAsRead = async () => {
        if (!unreadCount || updating) return;
        setUpdating(true);
        try {
            await axios.post(`${api}/scholar/notifications/mark-all-read`, {}, { headers: authHeader() });
            setNotifications(current => current.map(item => ({ ...item, read: true })));
            setError('');
        } catch (requestError) {
            console.error('Unable to mark scholar notifications as read:', requestError);
            setError(requestError.response?.data?.error || 'Unable to update notifications.');
        } finally {
            setUpdating(false);
        }
    };

    const notificationPath = notification => {
        if (notification.source === 'announcement') return '/scholar/announcements';
        if (notification.source === 'duty') return '/scholar/duties';
        if (notification.source === 'submission') return '/scholar/submission';
        if (notification.source === 'task') return '/scholar/submission';
        return '/scholar/checklist';
    };

    return (
        <div className="relative shrink-0">
            <button
                type="button"
                onClick={() => setOpen(current => !current)}
                aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                aria-expanded={open}
                className="sd-btn relative inline-flex items-center justify-center rounded-full"
                style={{ width: 38, height: 38, color: '#fff', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.24)', cursor: 'pointer' }}
            >
                <Bell size={17} />
                {unreadCount > 0 && (
                    <span
                        className="absolute flex items-center justify-center rounded-full px-1"
                        style={{ right: -5, top: -5, minWidth: 19, height: 19, background: DANGER, color: '#fff', ...body, fontSize: '0.58rem', fontWeight: 800, border: `2px solid ${PRIMARY}` }}
                    >
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div
                    className="absolute right-0 z-50 flex flex-col overflow-hidden"
                    style={{
                        top: 48,
                        width: 340,
                        maxWidth: 'calc(100vw - 2rem)',
                        maxHeight: 'min(78vh, 430px)',
                        borderRadius: 18,
                        background: SURFACE,
                        border: `1px solid ${BORDER}`,
                        boxShadow: '0 24px 56px -20px rgba(36,21,18,0.45)',
                    }}
                >
                    <div
                        className="flex items-center justify-between gap-3 px-4 py-3"
                        style={{ borderBottom: `1px solid ${BORDER}`, background: `linear-gradient(180deg, ${PRIMARY}0D, transparent)` }}
                    >
                        <div>
                            <p style={{ ...display, fontSize: '0.98rem', fontWeight: 700, color: INK }}>Notifications</p>
                            <p style={{ ...body, fontSize: '0.68rem', color: MUTED }}>{unreadCount} unread</p>
                        </div>
                        <button
                            type="button"
                            onClick={markAllAsRead}
                            disabled={!unreadCount || updating}
                            style={{ ...body, fontSize: '0.68rem', fontWeight: 700, color: unreadCount ? PRIMARY : MUTED, background: 'none', border: 'none', cursor: unreadCount ? 'pointer' : 'default' }}
                        >
                            {updating ? 'Updating…' : 'Mark all read'}
                        </button>
                    </div>

                    {error && (
                        <div className="flex items-center justify-between gap-2 px-4 py-2" style={{ background: `${DANGER}0d` }}>
                            <p role="alert" style={{ ...body, fontSize: '0.7rem', color: DANGER }}>{error}</p>
                            <button type="button" onClick={onRetry} aria-label="Retry notifications" style={{ color: PRIMARY, background: 'none', border: 'none', cursor: 'pointer' }}>
                                <RefreshCw size={14} />
                            </button>
                        </div>
                    )}

                    <div
                        className="overflow-y-auto px-2 py-1"
                        style={{
                            flex: '1 1 auto',
                            minHeight: 0,
                            maxHeight: 'min(60vh, 320px)',
                            overflowY: 'auto',
                            overscrollBehaviorY: 'contain',
                            WebkitOverflowScrolling: 'touch',
                            touchAction: 'pan-y',
                        }}
                    >
                        {loading ? (
                            <p style={{ ...body, fontSize: '0.76rem', color: MUTED, textAlign: 'center', padding: 18 }}>Loading notifications…</p>
                        ) : notifications.length === 0 && !error ? (
                            <p style={{ ...body, fontSize: '0.76rem', color: MUTED, textAlign: 'center', padding: 18 }}>No notifications yet.</p>
                        ) : notifications.map(notification => (
                            <button
                                key={notification.id}
                                type="button"
                                onClick={async () => {
                                    const marked = await markAsRead(notification);
                                    if (!marked) return;
                                    setOpen(false);
                                    onNavigate(notificationPath(notification));
                                }}
                                className="sd-row w-full rounded-xl px-3 py-2.5 text-left"
                                style={{ background: notification.read ? 'transparent' : `${PRIMARY}08`, border: 'none', borderBottom: `1px solid ${BORDER}70`, cursor: 'pointer' }}
                            >
                                <span className="flex items-start gap-2">
                                    {!notification.read && (
                                        <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: PRIMARY, marginTop: 5, flexShrink: 0 }} />
                                    )}
                                    <span className="min-w-0 flex-1">
                                        <span className="block" style={{ ...body, fontSize: '0.75rem', fontWeight: notification.read ? 500 : 700, color: INK, overflowWrap: 'anywhere' }}>
                                            {notification.title || 'Notification'}
                                        </span>
                                        <span className="mt-1 block" style={{ ...body, fontSize: '0.68rem', color: MUTED, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
                                            {notification.message}
                                        </span>
                                        {notification.date && (
                                            <span className="mt-1 block" style={{ ...body, fontSize: '0.62rem', color: MUTED }}>
                                                {formatNotificationDate(notification.date)}
                                            </span>
                                        )}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const ProgressBar = ({ value, color = PRIMARY }) => (
    <div style={{ width: '100%', height: 7, background: `${BORDER}99`, borderRadius: 999, overflow: 'hidden' }}>
        <div
            style={{
                width: `${Math.max(0, Math.min(100, value || 0))}%`,
                height: '100%',
                background: color,
                borderRadius: 999,
                transition: 'width 600ms ease',
            }}
        />
    </div>
);

/* Gauge for light surfaces: dark number on cream, coloured ring */
const ComplianceGauge = ({ score, loading, size = 84 }) => {
    const value = score == null ? 0 : Math.max(0, Math.min(100, Number(score)));
    const radius = 46;
    const circumference = 2 * Math.PI * radius;
    const dash = (value / 100) * circumference;
    const color = getComplianceColor(score);

    return (
        <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox="0 0 124 124" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="62" cy="62" r={radius} fill="none" stroke={`${BORDER}`} strokeWidth="11" />
                <circle
                    cx="62"
                    cy="62"
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth="11"
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${circumference}`}
                    style={{ transition: 'stroke-dasharray 600ms ease' }}
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                {loading ? (
                    <div className="animate-pulse" style={{ width: 26, height: 16, borderRadius: 5, background: `${BORDER}` }} />
                ) : (
                    <span style={{ ...display, color: INK, fontSize: `${size * 0.0125}rem`, fontWeight: 700, lineHeight: 1 }}>
                        {score == null ? '—' : Math.round(score)}
                    </span>
                )}
            </div>
        </div>
    );
};

const RequirementRow = ({ requirement }) => {
    const status = requirement.done
        ? { label: 'Complete', detail: 'Approved', color: SUCCESS }
        : requirement.status === 'pending_review'
            ? { label: 'Pending Review', detail: 'Awaiting officer review', color: WARNING }
            : ['rejected', 'returned'].includes(requirement.status)
                ? { label: 'Returned', detail: 'Revision required', color: DANGER }
                : requirement.status === 'closed'
                    ? { label: 'Closed', detail: 'Late submissions are not accepted', color: DANGER }
                    : ['missed', 'missing'].includes(requirement.status)
                        ? { label: 'Missed', detail: 'Deadline passed', color: DANGER }
                        : { label: 'Pending', detail: 'Still needs attention', color: WARNING };

    const due = requirement.dueDate ? formatChecklistDate(requirement.dueDate) : null;

    return (
        <div
            className="sd-row flex items-center justify-between gap-3"
            style={{ padding: '10px 8px', borderBottom: `1px solid ${BORDER}`, borderRadius: 10 }}
        >
            <div className="flex items-center gap-3 min-w-0">
                <span
                    className="flex items-center justify-center flex-shrink-0"
                    style={{ width: 32, height: 32, borderRadius: 10, background: `${status.color}14`, color: status.color }}
                >
                    {requirement.icon}
                </span>
                <div className="min-w-0">
                    <p className="truncate" style={{ ...body, fontSize: '0.8rem', fontWeight: 700, color: INK }}>
                        {requirement.label}
                    </p>
                    <p className="truncate" style={{ ...body, fontSize: '0.66rem', color: MUTED, marginTop: 1 }}>
                        {status.detail}
                    </p>
                </div>
            </div>

            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                <span style={{ ...body, fontSize: '0.66rem', fontWeight: 700, color: status.color, background: `${status.color}14`, borderRadius: 999, padding: '2px 9px', whiteSpace: 'nowrap' }}>
                    {status.label}
                </span>
                {due && <span style={{ ...body, fontSize: '0.63rem', color: MUTED, whiteSpace: 'nowrap' }}>Due {due}</span>}
            </div>
        </div>
    );
};

const SectionHeader = ({ label, title, description, action, titleSize = '1.12rem' }) => (
    <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
            <p style={{ ...eyebrow, color: BRONZE }}>{label}</p>
            <h2 style={{ ...display, fontSize: titleSize, fontWeight: 700, color: INK, marginTop: 3 }}>{title}</h2>
            {description && <p style={{ ...body, fontSize: '0.7rem', color: MUTED, marginTop: 3 }}>{description}</p>}
        </div>
        {action}
    </div>
);

const LatestAnnouncementsCard = ({ announcements, onOpen }) => (
    <section className="min-w-0 w-full" style={{ ...cardStyle, padding: '16px 18px' }}>
        <SectionHeader
            label="From your portal"
            title="Latest announcements"
            titleSize="1.08rem"
            action={
                <button type="button" onClick={onOpen} className="sd-pill inline-flex flex-shrink-0 items-center gap-1" style={pillButton}>
                    View all <ChevronRight size={12} />
                </button>
            }
        />

        {announcements.length === 0 ? (
            <div className="mt-3 flex items-center justify-center gap-2.5" style={{ background: BG, border: `1px dashed ${BORDER}`, borderRadius: 14, padding: '18px 14px' }}>
                <Megaphone size={18} style={{ color: MUTED }} />
                <p style={{ ...body, fontSize: '0.74rem', color: MUTED }}>No announcements yet. New notices will appear here.</p>
            </div>
        ) : (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
                {announcements.slice(0, 3).map((announcement) => (
                    <article
                        key={announcement.id}
                        className="sd-lift flex min-w-0 flex-col"
                        style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '12px 14px' }}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center justify-center" style={{ width: 26, height: 26, borderRadius: 8, background: `${PRIMARY}12`, color: PRIMARY }}>
                                <Megaphone size={13} />
                            </span>
                            <span style={{ ...body, fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.06em', color: PRIMARY, background: `${PRIMARY}10`, borderRadius: 999, padding: '3px 8px' }}>
                                NOTICE
                            </span>
                        </div>
                        <h3 className="sd-clamp2 mt-2" style={{ ...display, fontSize: '0.92rem', fontWeight: 700, color: INK, lineHeight: 1.3, minHeight: '2.4em' }}>
                            {announcement.title}
                        </h3>
                        <p className="sd-clamp2 mt-1 flex-1" style={{ ...body, fontSize: '0.7rem', color: MUTED, lineHeight: 1.5 }}>
                            {announcement.content}
                        </p>
                        <p className="mt-2 pt-2" style={{ ...body, fontSize: '0.62rem', color: MUTED, borderTop: `1px solid ${BORDER}` }}>
                            {formatShortDate(announcement.created_at)}
                        </p>
                    </article>
                ))}
            </div>
        )}
    </section>
);

const ComplianceFlags = ({ flags, visible, clear }) => {
    if (!visible) return null;

    if (flags.length === 0) {
        if (!clear) return null;
        return (
            <section style={{ ...cardStyle, padding: '14px 18px' }}>
                <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center flex-shrink-0" style={{ width: 32, height: 32, borderRadius: 10, background: `${SUCCESS}14`, color: SUCCESS }}>
                        <ShieldCheck size={15} />
                    </span>
                    <div>
                        <p style={{ ...body, fontSize: '0.76rem', fontWeight: 700, color: INK }}>No active compliance flags</p>
                        <p style={{ ...body, fontSize: '0.66rem', color: MUTED, marginTop: 1 }}>Nothing needs your attention right now.</p>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section style={{ ...cardStyle, padding: '16px 18px', borderColor: `${DANGER}33` }}>
            <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                    <p style={{ ...eyebrow, color: DANGER }}>Attention needed</p>
                    <h2 style={{ ...display, fontSize: '1.05rem', fontWeight: 700, color: INK, marginTop: 3 }}>Compliance flags</h2>
                </div>
                <span className="flex items-center justify-center flex-shrink-0" style={{ width: 32, height: 32, borderRadius: 10, background: `${DANGER}12`, color: DANGER }}>
                    <AlertTriangle size={15} />
                </span>
            </div>

            <div className="grid grid-cols-1 gap-2">
                {flags.map((flag, index) => (
                    <div
                        key={index}
                        className="flex items-start gap-2.5"
                        style={{ background: `${DANGER}08`, border: `1px solid ${DANGER}1F`, borderRadius: 12, padding: '9px 11px' }}
                    >
                        <AlertTriangle size={13} style={{ color: DANGER, flexShrink: 0, marginTop: 2 }} />
                        <p style={{ ...body, fontSize: '0.72rem', color: INK, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{flag.description}</p>
                    </div>
                ))}
            </div>
        </section>
    );
};

const Skeleton = ({ className = '', style = {} }) => (
    <div className={`animate-pulse ${className}`} style={{ background: `${BORDER}88`, borderRadius: RADIUS, ...style }} />
);

const LoadingLayout = () => (
    <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <Skeleton style={{ height: 104 }} />
            <Skeleton style={{ height: 104 }} />
        </div>
        <Skeleton className="mb-3" style={{ height: 176 }} />
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,0.85fr)] gap-3">
            <Skeleton style={{ height: 420 }} />
            <div className="flex flex-col gap-3">
                <Skeleton style={{ height: 230 }} />
                <Skeleton style={{ height: 100 }} />
            </div>
        </div>
    </>
);

/* ───────────────────────── Page ───────────────────────── */

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
    const [notifications, setNotifications] = useState([]);
    const [notificationsLoading, setNotificationsLoading] = useState(true);
    const [notificationsError, setNotificationsError] = useState('');
    const [checklistInputs, setChecklistInputs] = useState({ duties: [], history: [], grades: [], tasks: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [subRes, annRes, dutiesRes, gradesRes, tasksRes, notificationsRes] = await Promise.allSettled([
                    axios.get(`${API}/submission/history/${scholarId}`, { headers: authHeader() }),
                    axios.get(`${API}/scholar/announcements`, { headers: authHeader() }),
                    axios.get(`${API}/scholar/my-duties`, { headers: authHeader() }),
                    axios.get(`${API}/submission/grades/${scholarId}`, { headers: authHeader() }),
                    axios.get(`${API}/tasks`, { headers: authHeader() }),
                    axios.get(`${API}/scholar/notifications`, { headers: authHeader() }),
                ]);

                const history = subRes.status === 'fulfilled' && Array.isArray(subRes.value.data) ? subRes.value.data : [];
                if (history.length > 0) {
                    setLatestSubmission(history[0]);
                }

                if (annRes.status === 'fulfilled') {
                    setAnnouncements(annRes.value.data.slice(0, 3));
                }

                if (notificationsRes.status === 'fulfilled' && Array.isArray(notificationsRes.value.data)) {
                    setNotifications(notificationsRes.value.data);
                    setNotificationsError('');
                } else {
                    const notificationError = notificationsRes.status === 'rejected'
                        ? notificationsRes.reason
                        : new Error('Unexpected notification response.');
                    console.error('Unable to load scholar notifications:', notificationError);
                    setNotificationsError(notificationError.response?.data?.error || 'Unable to load notifications. Please try again.');
                }
                setNotificationsLoading(false);

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
    }, [scholarId, API]);

    const refreshNotifications = async () => {
        setNotificationsLoading(true);
        try {
            const response = await axios.get(`${API}/scholar/notifications`, { headers: authHeader() });
            setNotifications(Array.isArray(response.data) ? response.data : []);
            setNotificationsError('');
        } catch (requestError) {
            console.error('Unable to refresh scholar notifications:', requestError);
            setNotificationsError(requestError.response?.data?.error || 'Unable to load notifications. Please try again.');
        } finally {
            setNotificationsLoading(false);
        }
    };

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
        if (['closed', 'missed', 'missing'].includes(item.status)) {
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
    const riskLabel = complianceScore !== null ? getRiskLabel(Number(complianceScore)) : 'Loading...';
    const riskColor = complianceScore !== null ? getRiskColor(Number(complianceScore)) : MUTED;

    const topFlags = complianceData?.flags?.slice(0, 2) ?? [];

    const completionPercent = requirements.length
        ? Math.round((completedCount / requirements.length) * 100)
        : 0;

    return (
        <div className="sd-root" style={{ ...body, background: BG, minHeight: '100vh', color: INK }}>
            <style>{globalCss}</style>

            <div className="w-full px-4 sm:px-6 lg:px-8" style={{ paddingTop: 20, paddingBottom: 32 }}>
                {/* ───────────────── HERO (compact) ───────────────── */}
                <section
                    className="relative"
                    style={{
                        zIndex: 30,
                        background: `linear-gradient(120deg, ${PRIMARY_DARK} 0%, ${PRIMARY} 60%, ${PRIMARY_ACCENT} 100%)`,
                        borderRadius: 22,
                        padding: 'clamp(14px, 2vw, 20px) clamp(16px, 2.4vw, 26px)',
                        marginBottom: 12,
                        boxShadow: '0 18px 36px -28px rgba(74,23,48,0.65)',
                    }}
                >
                    <div aria-hidden="true" className="absolute inset-0 overflow-hidden" style={{ borderRadius: 22, pointerEvents: 'none' }}>
                        <div className="absolute" style={{ width: 260, height: 260, right: -70, top: -150, borderRadius: '50%', border: '1px solid rgba(228,194,143,0.16)' }} />
                        <div className="absolute" style={{ left: 0, right: 0, bottom: 0, height: 2, background: `linear-gradient(90deg, transparent, ${GOLD}88, transparent)` }} />
                    </div>

                    <div className="relative flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span style={{ ...eyebrow, fontWeight: 800, letterSpacing: '0.15em', color: GOLD }}>Scholar Portal</span>
                                <span style={{ width: 4, height: 4, borderRadius: '50%', background: GOLD }} />
                                <span style={{ ...body, fontSize: '0.66rem', color: 'rgba(255,255,255,0.7)' }}>
                                    AY {today.getFullYear()}–{today.getFullYear() + 1}
                                </span>
                            </div>

                            <h1 style={{ ...display, fontSize: 'clamp(1.5rem, 2.8vw, 2.05rem)', lineHeight: 1.12, fontWeight: 700, color: '#fff', marginTop: 8, overflowWrap: 'anywhere' }}>
                                Welcome back, {name || 'Scholar'}.
                            </h1>

                            <p style={{ ...body, fontSize: '0.78rem', lineHeight: 1.55, color: 'rgba(255,255,255,0.74)', marginTop: 6, maxWidth: 560 }}>
                                Keep your scholarship requirements on track, review your compliance status, and stay updated with important notices.
                            </p>

                            <div className="flex items-center gap-2 flex-wrap mt-3">
                                {scholarId && (
                                    <span style={{ ...body, fontSize: '0.67rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 999, padding: '5px 11px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {scholarId}
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={() => navigate('/scholar/submission')}
                                    className="sd-btn inline-flex items-center gap-1.5"
                                    style={{ ...body, fontSize: '0.7rem', fontWeight: 700, color: PRIMARY, background: SURFACE, border: 'none', borderRadius: 999, padding: '6px 13px', cursor: 'pointer' }}
                                >
                                    Manage submissions
                                    <ArrowUpRight size={12} />
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                            <div className="hidden sm:inline-flex items-center gap-2" style={{ ...glassStyle, padding: '7px 13px', color: '#fff' }}>
                                <CalendarDays size={14} style={{ color: GOLD }} />
                                <span style={{ ...body, fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                    {today.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                            </div>
                            <ScholarNotificationBell
                                api={API}
                                onNavigate={navigate}
                                notifications={notifications}
                                setNotifications={setNotifications}
                                loading={notificationsLoading}
                                error={notificationsError}
                                setError={setNotificationsError}
                                onRetry={refreshNotifications}
                            />
                        </div>
                    </div>
                </section>

                {loading ? (
                    <LoadingLayout />
                ) : (
                    <>
                        {/* ───────────────── STATUS ROW ───────────────── */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                            <section className="flex items-center gap-4 min-w-0" style={{ ...cardStyle, padding: '14px 18px' }}>
                                <ComplianceGauge score={complianceScore} loading={complianceLoading} size={84} />
                                <div className="min-w-0 flex-1">
                                    <p style={{ ...eyebrow, color: BRONZE }}>Compliance score</p>
                                    <p style={{ ...display, fontSize: '1.2rem', fontWeight: 700, color: complianceLoading ? INK : riskColor, marginTop: 3 }}>
                                        {riskLabel}
                                    </p>
                                    <p style={{ ...body, fontSize: '0.7rem', color: MUTED, marginTop: 2 }}>
                                        {complianceError ? 'Compliance data unavailable' : `${Math.round(riskScore)} risk points recorded`}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={refreshCompliance}
                                    className="sd-btn sd-pill inline-flex flex-shrink-0 items-center gap-1.5"
                                    style={pillButton}
                                >
                                    <RefreshCw size={12} />
                                    <span className="hidden sm:inline">Refresh</span>
                                </button>
                            </section>

                            <section className="flex items-center gap-4 min-w-0" style={{ ...cardStyle, padding: '14px 18px' }}>
                                <span className="flex shrink-0 items-center justify-center" style={{ width: 52, height: 52, borderRadius: 16, background: `${SUCCESS}14`, color: SUCCESS }}>
                                    <ShieldCheck size={24} />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p style={{ ...eyebrow, color: BRONZE }}>Scholarship status</p>
                                    <p style={{ ...display, fontSize: '1.2rem', fontWeight: 700, color: INK, marginTop: 3 }}>Active</p>
                                    <p style={{ ...body, fontSize: '0.7rem', color: MUTED, marginTop: 2 }}>Verified scholar</p>
                                </div>
                                <span className="inline-flex flex-shrink-0 items-center gap-1.5" style={{ ...body, fontSize: '0.66rem', fontWeight: 700, color: SUCCESS, background: `${SUCCESS}14`, borderRadius: 999, padding: '5px 10px' }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: SUCCESS }} />
                                    Verified
                                </span>
                            </section>
                        </div>

                        {/* ───────────────── ANNOUNCEMENTS ───────────────── */}
                        <div className="mb-3">
                            <LatestAnnouncementsCard announcements={announcements} onOpen={() => navigate('/scholar/announcements')} />
                        </div>

                        {/* ───────────────── MAIN GRID ───────────────── */}
                        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,0.85fr)] gap-3 items-start">
                            {/* Requirements */}
                            <section className="min-w-0" style={{ ...cardStyle, padding: '18px 20px' }}>
                                <SectionHeader
                                    label="Requirements Checklist"
                                    title="Requirements"
                                    titleSize="1.2rem"
                                    description="Your assigned requirements and duty status."
                                    action={
                                        <button type="button" onClick={() => navigate('/scholar/checklist')} className="sd-pill inline-flex items-center gap-1" style={pillButton}>
                                            View all
                                            <ChevronRight size={12} />
                                        </button>
                                    }
                                />

                                <div className="mt-4" style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '11px 14px' }}>
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-baseline gap-2">
                                            <span style={{ ...display, fontSize: '1.3rem', fontWeight: 700, color: INK, lineHeight: 1 }}>{completionPercent}%</span>
                                            <span style={{ ...body, fontSize: '0.68rem', fontWeight: 700, color: INK }}>Overall completion</span>
                                        </div>
                                        <span style={{ ...body, fontSize: '0.68rem', fontWeight: 800, color: SUCCESS, background: `${SUCCESS}14`, borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap' }}>
                                            {completedCount}/{requirements.length} completed
                                        </span>
                                    </div>
                                    <div className="mt-2.5">
                                        <ProgressBar value={completionPercent} color={SUCCESS} />
                                    </div>
                                </div>

                                <div className="mt-2">
                                    {requirements.length === 0 ? (
                                        <div className="flex flex-col items-center text-center" style={{ padding: '26px 14px' }}>
                                            <ClipboardList size={20} style={{ color: MUTED }} />
                                            <p style={{ ...body, fontSize: '0.76rem', fontWeight: 700, color: INK, marginTop: 7 }}>No requirements to show</p>
                                            <p style={{ ...body, fontSize: '0.68rem', color: MUTED, marginTop: 2 }}>New requirements and duties will appear here once assigned.</p>
                                        </div>
                                    ) : (
                                        requirements.map((req, index) => (
                                            <RequirementRow key={req.id ?? `${req.label}-${index}`} requirement={req} />
                                        ))
                                    )}
                                </div>

                                {completedCount < requirements.length && (
                                    <button
                                        type="button"
                                        onClick={() => navigate('/scholar/checklist')}
                                        className="sd-btn w-full inline-flex items-center justify-center gap-2"
                                        style={{ ...body, marginTop: 14, padding: '10px 14px', borderRadius: 12, border: 'none', background: PRIMARY, color: '#fff', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                        View pending requirements
                                        <ArrowUpRight size={13} />
                                    </button>
                                )}
                            </section>

                            {/* Right column */}
                            <div className="flex flex-col gap-3 min-w-0">
                                <section style={{ ...cardStyle, padding: '18px 20px' }}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p style={{ ...eyebrow, color: BRONZE }}>Records</p>
                                            <h2 style={{ ...display, fontSize: '1.12rem', fontWeight: 700, color: INK, marginTop: 3 }}>Latest submission</h2>
                                        </div>
                                        <span className="flex items-center justify-center flex-shrink-0" style={{ width: 32, height: 32, borderRadius: 10, background: `${PRIMARY}10`, color: PRIMARY }}>
                                            <FileText size={15} />
                                        </span>
                                    </div>

                                    {latestSubmission ? (
                                        <div className="mt-3" style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 12 }}>
                                            <div className="flex items-start justify-between gap-3 flex-wrap">
                                                <div className="flex items-start gap-3 min-w-0">
                                                    <div className="flex items-center justify-center flex-shrink-0" style={{ width: 36, height: 36, borderRadius: 11, background: `${PRIMARY}12`, color: PRIMARY }}>
                                                        <FileText size={16} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p style={{ ...body, fontSize: '0.78rem', fontWeight: 800, color: INK }}>Monthly submission</p>
                                                        <p className="truncate" style={{ ...body, fontSize: '0.67rem', color: MUTED, marginTop: 2 }}>
                                                            {formatShortDate(latestSubmission.submitted_at)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <StatusBadge status={latestSubmission.status} />
                                            </div>

                                            {latestSubmission.staff_comment && (
                                                <div className="mt-3" style={{ background: `${DANGER}08`, border: `1px solid ${DANGER}1F`, borderRadius: 11, padding: '9px 11px' }}>
                                                    <p style={{ ...eyebrow, fontSize: '0.6rem', color: DANGER }}>Officer feedback</p>
                                                    <p style={{ ...body, fontSize: '0.7rem', color: INK, lineHeight: 1.5, marginTop: 3, overflowWrap: 'anywhere' }}>
                                                        {latestSubmission.staff_comment}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="mt-3 flex flex-col items-center text-center" style={{ background: BG, border: `1px dashed ${BORDER}`, borderRadius: 14, padding: '22px 14px' }}>
                                            <FileText size={20} style={{ color: MUTED }} />
                                            <p style={{ ...body, fontSize: '0.76rem', fontWeight: 700, color: INK, marginTop: 7 }}>No submission recorded yet</p>
                                            <p style={{ ...body, fontSize: '0.68rem', color: MUTED, marginTop: 2 }}>Your latest submission will show up here.</p>
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => navigate('/scholar/submission')}
                                        className="sd-btn sd-pill w-full inline-flex items-center justify-center gap-1.5"
                                        style={{ ...body, marginTop: 12, padding: '9px 12px', borderRadius: 11, border: `1px solid ${BORDER}`, background: SURFACE, color: PRIMARY, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                        Open submission center
                                        <ChevronRight size={12} />
                                    </button>
                                </section>

                                {complianceLoading ? (
                                    <Skeleton style={{ height: 90 }} />
                                ) : (
                                    <ComplianceFlags
                                        flags={topFlags}
                                        visible={!complianceLoading}
                                        clear={!complianceError && complianceData != null}
                                    />
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ScholarDashboard;