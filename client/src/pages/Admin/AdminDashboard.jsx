import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
    PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area, LabelList,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
    Users, ShieldCheck, Megaphone,
    AlertTriangle, Clock,
    ArrowRight, MessageSquare, ShieldAlert, CalendarDays,
    ClipboardList, Settings, Star, BarChart3, PieChart as PieChartIcon,
} from 'lucide-react';
import { formatAdminDate, formatAdminMonth } from '../../utils/adminPreferences';

// ── Executive design tokens ──────────────────────────────────────
const BG           = '#F7F4EE';
const SURFACE      = '#FFFDF9';
const BORDER       = '#E7D8C7';
const PRIMARY      = '#6D2140';
const PRIMARY_DEEP = '#4A1730';
const INK          = '#241512';
const MUTED        = '#8A7A68';
const BRONZE       = '#A9784E';
const SUCCESS      = '#6B8F71';
const WARNING      = '#C08A3E';
const DANGER       = '#A24A4A';
const RADIUS       = 18;
const SHADOW       = '0 1px 2px rgba(74, 23, 48, 0.04), 0 8px 24px -16px rgba(74, 23, 48, 0.12)';

// ── Operations routes ────────────────────────────────────────────
// NOTE: verify these two against your router config (the sidebar's
// "Task Assignment" and "Duty Assignment" links) and adjust if they differ.
const TASK_ASSIGNMENT_PATH = '/admin/tasks';
const DUTY_ASSIGNMENT_PATH = '/admin/duties';
const API_BASE = (import.meta.env?.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;

const serif = { fontFamily: "'Playfair Display', serif" };
const sans  = { fontFamily: "'Inter', sans-serif" };

const gridProps = { strokeDasharray: '3 3', stroke: BORDER };
const axisStyle = { fontFamily: "'Inter', sans-serif", fontSize: '0.7rem', fill: MUTED };

const cardStyle = { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: SHADOW };

const authConfig = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

// ── Custom tooltip matching the cream/burgundy theme ──────────────
const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '8px 12px', boxShadow: SHADOW, ...sans, fontSize: '0.78rem' }}>
            {label && <p style={{ fontWeight: 600, color: INK, marginBottom: 4 }}>{label}</p>}
            {payload.map((p) => (
                <p key={p.dataKey || p.name} style={{ color: p.color || p.payload?.color || p.fill, fontWeight: 500 }}>{p.name}: {p.value}</p>
            ))}
        </div>
    );
};

const Skeleton = ({ className }) => (
    <div className={`animate-pulse rounded-2xl ${className}`} style={{ background: '#EFE6D8' }} />
);

const IconBubble = ({ icon: Icon, color = PRIMARY, size = 40, iconSize = 18 }) => (
    <span className="flex items-center justify-center rounded-full flex-shrink-0"
        style={{ width: size, height: size, background: `${color}14`, color }}>
        <Icon size={iconSize} />
    </span>
);

const EmptyState = ({ children }) => (
    <div className="flex items-center justify-center text-center" style={{ height: 230 }}>
        <p style={{ ...sans, fontSize: '0.8rem', color: MUTED, maxWidth: 260 }}>{children}</p>
    </div>
);

// ── Chart card ────────────────────────────────────────────────────
const ChartCard = ({ icon, title, subtitle, children, className = '' }) => (
    <div className={`min-w-0 ${className}`} style={{ ...cardStyle, padding: 22 }}>
        <div className="flex items-center gap-3 mb-4">
            <IconBubble icon={icon} color={PRIMARY} size={40} iconSize={18} />
            <div className="min-w-0">
                <h3 style={{ ...serif, fontSize: '1.02rem', fontWeight: 700, color: PRIMARY }}>{title}</h3>
                {subtitle && <p style={{ ...sans, fontSize: '0.74rem', color: MUTED, marginTop: 1 }}>{subtitle}</p>}
            </div>
        </div>
        {children}
    </div>
);

// ── Panel with icon header (bottom row + operations) ──────────────
const PanelHeader = ({ icon, title, subtitle, action }) => (
    <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
            <IconBubble icon={icon} color={PRIMARY} size={40} iconSize={18} />
            <div className="min-w-0">
                <h3 style={{ ...serif, fontSize: '1.02rem', fontWeight: 700, color: PRIMARY }}>{title}</h3>
                {subtitle && <p style={{ ...sans, fontSize: '0.74rem', color: MUTED, marginTop: 1 }}>{subtitle}</p>}
            </div>
        </div>
        {action}
    </div>
);

const OutlineButton = ({ onClick, children }) => (
    <button type="button" onClick={onClick}
        className="dash-focus inline-flex items-center gap-1.5 flex-shrink-0 transition-colors hover:bg-[#6D21400D]"
        style={{ ...sans, fontSize: '0.72rem', fontWeight: 600, color: PRIMARY, background: SURFACE, border: `1px solid ${PRIMARY}55`, borderRadius: 8, padding: '7px 12px', cursor: 'pointer' }}>
        {children} <ArrowRight size={12} />
    </button>
);

const AdminDashboard = () => {
    const navigate = useNavigate();
    const name = localStorage.getItem('name');

    const [stats, setStats] = useState({ activeAnnouncements: 0, activeTasks: 0, upcomingDuties: 0 });
    const [recentUsers, setRecentUsers] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dashboardError, setDashboardError] = useState('');

    const [scholarGrowth, setScholarGrowth] = useState([]);
    const [complianceBreakdown, setComplianceBreakdown] = useState([]);
    const [complianceRate, setComplianceRate] = useState(0);
    const [riskDistribution, setRiskDistribution] = useState([]);
    const [sentimentBreakdown, setSentimentBreakdown] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const config = authConfig();
                setDashboardError('');
                const [summaryRes, scholarComplianceRes] = await Promise.all([
                    axios.get(`${API}/admin/dashboard-summary`, config),
                    axios.get(`${API}/admin/reports/compliance-summary`, config),
                ]);
                const summary = summaryRes.data;
                const complianceData = scholarComplianceRes.data;

                setStats({
                    activeAnnouncements: summary.announcements.active,
                    activeTasks: summary.tasks.active,
                    upcomingDuties: summary.duties.upcoming,
                });
                setRecentUsers(summary.recentUsers);

                const monthlyCounts = new Map(summary.scholarGrowth.map(({ month, total }) => [month, total]));
                const growth = [];
                const now = new Date();
                for (let offset = 5; offset >= 0; offset -= 1) {
                    const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
                    const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
                    growth.push({
                        month: formatAdminMonth(monthDate, { month: 'short' }),
                        total: monthlyCounts.get(key) || 0,
                    });
                }
                setScholarGrowth(growth);

                setComplianceBreakdown([
                    { name: 'Approved', value: summary.submissions.approved, color: SUCCESS },
                    { name: 'Pending', value: summary.submissions.pending, color: WARNING },
                    { name: 'Rejected', value: summary.submissions.rejected, color: DANGER },
                ]);
                setComplianceRate(summary.submissions.totalRecords
                    ? Math.round((summary.submissions.approved / summary.submissions.totalRecords) * 100)
                    : 0);

                const riskLevels = [
                    { level: 'Low', value: 0, color: SUCCESS },
                    { level: 'Moderate', value: 0, color: WARNING },
                    { level: 'High', value: 0, color: DANGER },
                ];
                complianceData.forEach(({ riskStatus }) => {
                    const level = riskLevels.find((item) => item.level.toLowerCase() === riskStatus);
                    if (level) level.value += 1;
                });
                setRiskDistribution(riskLevels);

                setSentimentBreakdown([
                    { label: 'Positive', value: summary.submissions.sentiment.positive },
                    { label: 'Neutral', value: summary.submissions.sentiment.neutral },
                    { label: 'Negative', value: summary.submissions.sentiment.negative },
                    { label: 'Unscored', value: summary.submissions.sentiment.unscored },
                ]);
                setRecentActivity(summary.recentActivity.map((item) => ({
                    id: item.id,
                    message: item.details?.trim() || String(item.action || 'System event').replace(/[_-]+/g, ' '),
                    time: formatAdminDate(item.created_at, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
                    type: item.module || item.action,
                    status: item.result === 'failure' ? 'warning' : 'success',
                })));
            } catch (err) {
                console.error(err);
                setDashboardError('Dashboard data could not be loaded. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        let refreshTimer;
        const updateRefreshTimer = () => {
            window.clearInterval(refreshTimer);
            let autoRefresh = true;
            try {
                const preferences = JSON.parse(localStorage.getItem('admin-system-settings') || 'null');
                if (typeof preferences?.autoRefresh === 'boolean') autoRefresh = preferences.autoRefresh;
            } catch (error) {
                console.error('Unable to read dashboard refresh preference:', error);
            }
            if (autoRefresh) refreshTimer = window.setInterval(fetchData, 5 * 60 * 1000);
        };
        updateRefreshTimer();
        window.addEventListener('admin-settings-updated', updateRefreshTimer);
        return () => {
            window.clearInterval(refreshTimer);
            window.removeEventListener('admin-settings-updated', updateRefreshTimer);
        };
    }, []);

    const quickLinks = [
        { label: 'User Registry', desc: 'Manage access roles', path: '/admin/users', icon: Users },
        { label: 'Flagged Focus', desc: 'Review critical risk', path: '/admin/flagged', icon: AlertTriangle },
        { label: 'NLP Evaluator', desc: 'Sift emotional vibes', path: '/admin/correspondence', icon: MessageSquare },
        { label: 'Security Audit', desc: 'Privacy trail records', path: '/admin/security', icon: ShieldAlert },
    ];

    const activityDotColor = (status) => {
        if (status === 'success') return SUCCESS;
        if (status === 'warning') return WARNING;
        return PRIMARY;
    };

    const getRoleBadge = (role) => {
        if (role === 'admin') return { background: PRIMARY, color: '#fff' };
        if (role === 'scholar') return { background: `${BRONZE}18`, color: BRONZE };
        return { background: `${SUCCESS}18`, color: SUCCESS };
    };

    const sentimentColor = { Positive: SUCCESS, Neutral: WARNING, Negative: DANGER, Unscored: MUTED };

    const operationsCards = [
        { title: 'Announcements', icon: Megaphone, path: '/admin/announcements', action: 'View Announcements',
          desc: 'Manage published announcements and communications.', count: stats.activeAnnouncements },
        // No reliable task/duty count source exists in this component, so none is shown.
        { title: 'Task Assignment', icon: ClipboardList, path: TASK_ASSIGNMENT_PATH, action: 'View Tasks',
          desc: 'Manage assigned requirements and submission deadlines.', count: stats.activeTasks },
        { title: 'Duty Assignment', icon: CalendarDays, path: DUTY_ASSIGNMENT_PATH, action: 'View Duties',
          desc: 'Coordinate scholar duty schedules and assignments.', count: stats.upcomingDuties },
    ];

    const complianceTotal = complianceBreakdown.reduce((sum, c) => sum + c.value, 0);
    const pct = (value, total) => (total ? Math.round((value / total) * 100) : 0);

    const todayLabel = formatAdminDate(new Date(), { weekday: 'long' });
    const systemStatus = loading ? 'Checking' : dashboardError ? 'Unavailable' : 'Operational';
    const systemStatusColor = dashboardError ? DANGER : SUCCESS;

    return (
        <div className="min-h-screen" style={{ background: BG, ...sans }}>
            <style>{`
                .dash-focus:focus-visible { outline: 2px solid ${PRIMARY}; outline-offset: 2px; }
                .dash-hover { transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease; }
                .dash-hover:hover { border-color: ${PRIMARY}55 !important; box-shadow: 0 10px 24px -14px ${PRIMARY}55 !important; transform: translateY(-1px); }
                @media (prefers-reduced-motion: reduce) { .dash-hover { transition: none; } .dash-hover:hover { transform: none; } }
            `}</style>
            <div className="w-full px-5 sm:px-8 py-8" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* ── Page header ── */}
                <header className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                    <div className="min-w-0">
                        <span style={{ ...sans, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: BRONZE }}>Admin Portal</span>
                        <h1 style={{ ...serif, fontSize: '2rem', fontWeight: 700, color: PRIMARY, marginTop: 4, letterSpacing: '-0.01em', lineHeight: 1.15 }}>Executive Intelligence Dashboard</h1>
                        <p style={{ ...sans, fontSize: '0.85rem', color: MUTED, marginTop: 6, maxWidth: 640 }}>
                            Real-time operational overview of scholars, compliance, governance, security, and institutional performance.
                        </p>
                        <p style={{ ...sans, fontSize: '0.8rem', color: MUTED, marginTop: 8 }}>Welcome back, {name || 'Admin'}.</p>
                    </div>
                    <div className="flex flex-wrap gap-3 flex-shrink-0">
                        <div className="flex items-center gap-2.5 px-4 py-3" style={{ ...cardStyle, borderRadius: 14 }}>
                            <CalendarDays size={18} style={{ color: BRONZE }} />
                            <div>
                                <p style={{ ...sans, fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED }}>Today</p>
                                <p style={{ ...sans, fontSize: '0.8rem', fontWeight: 600, color: INK }}>{todayLabel}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2.5 px-4 py-3" style={{ ...cardStyle, borderRadius: 14 }}>
                            <span className="rounded-full flex-shrink-0" style={{ width: 8, height: 8, background: systemStatusColor }} />
                            <div>
                                <p style={{ ...sans, fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED }}>System Status</p>
                                <p style={{ ...sans, fontSize: '0.8rem', fontWeight: 600, color: systemStatusColor }}>{systemStatus}</p>
                            </div>
                        </div>
                    </div>
                </header>
                {dashboardError && (
                    <p role="alert" style={{ ...sans, color: DANGER, background: `${DANGER}12`, border: `1px solid ${DANGER}44`, borderRadius: 10, padding: '10px 14px', fontSize: '0.8rem' }}>
                        {dashboardError}
                    </p>
                )}

                {/* ── Recent Users + System Activity ── */}
                <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5">
                    {/* Recent Users */}
                    <section className="min-w-0 overflow-hidden" style={{ ...cardStyle, padding: 22 }}>
                        <PanelHeader icon={Users} title="Recent Users" subtitle="Latest registered users in the system."
                            action={<OutlineButton onClick={() => navigate('/admin/users')}>View Registry</OutlineButton>} />

                        {loading ? (
                            <div className="flex flex-col gap-3">
                                {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-12" />)}
                            </div>
                        ) : recentUsers.length === 0 ? (
                            <p style={{ ...sans, fontSize: '0.82rem', color: MUTED, textAlign: 'center', padding: '32px 0' }}>No users yet.</p>
                        ) : (
                            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                {recentUsers.map((user, idx) => {
                                    const badge = getRoleBadge(user.role);
                                    return (
                                        <li key={user.id} className="flex items-center gap-3 py-2.5"
                                            style={{ borderTop: idx === 0 ? 'none' : `1px solid ${BORDER}` }}>
                                            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DEEP} 100%)` }}>
                                                <span style={{ ...serif, color: '#fff', fontSize: '0.78rem', fontWeight: 600 }}>
                                                    {(user.full_name || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p style={{ ...sans, fontSize: '0.82rem', fontWeight: 600, color: INK }} className="truncate">{user.full_name}</p>
                                                <p style={{ ...sans, fontSize: '0.72rem', color: MUTED }} className="truncate">{user.email}</p>
                                            </div>
                                            <span className="px-2.5 py-1 rounded-full flex-shrink-0" style={{ ...sans, fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', ...badge }}>
                                                {user.role}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>

                    {/* System Activity */}
                    <section className="min-w-0 overflow-hidden" style={{ ...cardStyle, padding: 22 }}>
                        <PanelHeader icon={Clock} title="System Activity" subtitle="Core system events trail." />
                        <div>
                            {recentActivity.length === 0 ? (
                                <p style={{ ...sans, fontSize: '0.82rem', color: MUTED, textAlign: 'center', padding: '32px 0' }}>No recent activity.</p>
                            ) : recentActivity.map((item, i) => (
                                <div key={item.id} className="relative pl-6" style={{ paddingBottom: i < recentActivity.length - 1 ? 18 : 0 }}>
                                    {i < recentActivity.length - 1 && (
                                        <span className="absolute" style={{ left: 4.5, top: 14, bottom: -2, width: 1, background: BORDER }} />
                                    )}
                                    <span className="absolute rounded-full" style={{ width: 10, height: 10, left: 0, top: 4, background: activityDotColor(item.status) }} />
                                    <p style={{ ...sans, fontSize: '0.8rem', fontWeight: 600, color: INK }}>{item.message}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span style={{ ...sans, fontSize: '0.68rem', color: MUTED, display: 'flex', alignItems: 'center', gap: 3 }}>
                                            <Clock size={10} /> {item.time}
                                        </span>
                                        <span className="px-1.5 py-0.5 rounded-full" style={{ ...sans, fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', background: `${BRONZE}14`, color: BRONZE }}>
                                            {item.type}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                {/* ── Analytics: two balanced rows ── */}
                {loading ? (
                    <div className="grid grid-cols-1 gap-5">
                        <Skeleton className="h-72" />
                        <Skeleton className="h-72" />
                    </div>
                ) : (
                    <>
                        {/* Row 1: Scholar Growth + Compliance Status */}
                        <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-5">
                            <ChartCard icon={BarChart3} title="Scholar Growth" subtitle="Monthly registrations of scholars.">
                                {scholarGrowth.length === 0 ? (
                                    <EmptyState>No registration dates are available yet, so growth can't be charted.</EmptyState>
                                ) : (
                                    <ResponsiveContainer width="100%" height={230}>
                                        <AreaChart data={scholarGrowth} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.22} />
                                                    <stop offset="100%" stopColor={PRIMARY} stopOpacity={0.02} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid {...gridProps} />
                                            <XAxis dataKey="month" tick={axisStyle} stroke={BORDER} />
                                            <YAxis tick={axisStyle} stroke={BORDER} allowDecimals={false} />
                                            <Tooltip content={<ChartTooltip />} />
                                            <Area type="monotone" dataKey="total" name="Scholars" stroke={PRIMARY} strokeWidth={2.5}
                                                fill="url(#growthFill)" dot={{ fill: PRIMARY, r: 3 }} activeDot={{ r: 5 }} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )}
                            </ChartCard>

                            <ChartCard icon={PieChartIcon} title="Compliance Status" subtitle="Approved • Pending • Rejected submissions.">
                                {complianceTotal === 0 ? (
                                    <EmptyState>No compliance submissions yet.</EmptyState>
                                ) : (
                                    <div className="flex flex-col sm:flex-row items-center gap-4">
                                        <div className="relative min-w-0 flex-shrink-0 w-full sm:w-[210px]" style={{ height: 210 }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={complianceBreakdown} cx="50%" cy="50%" innerRadius={62} outerRadius={92} paddingAngle={2} dataKey="value" nameKey="name">
                                                        {complianceBreakdown.map((entry) => (
                                                            <Cell key={entry.name} fill={entry.color} stroke="none" />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip content={<ChartTooltip />} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                <span style={{ ...serif, fontSize: '1.6rem', fontWeight: 700, color: INK }}>{complianceRate}%</span>
                                                <span style={{ ...sans, fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: MUTED }}>Approved</span>
                                            </div>
                                        </div>
                                        <ul className="flex-1 w-full flex flex-col gap-3" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                            {complianceBreakdown.map((item) => (
                                                <li key={item.name} className="flex items-center gap-3">
                                                    <span className="rounded-full flex-shrink-0" style={{ width: 12, height: 12, background: item.color }} />
                                                    <span className="flex-1" style={{ ...sans, fontSize: '0.82rem', color: INK }}>{item.name}</span>
                                                    <span style={{ ...sans, fontSize: '0.82rem', fontWeight: 600, color: INK, minWidth: 24, textAlign: 'right' }}>{item.value}</span>
                                                    <span style={{ ...sans, fontSize: '0.8rem', fontWeight: 700, color: item.color, minWidth: 40, textAlign: 'right' }}>{pct(item.value, complianceTotal)}%</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </ChartCard>
                        </div>

                        {/* Row 2: Risk Distribution + NLP Sentiment */}
                        <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-5">
                            <ChartCard icon={ShieldCheck} title="Risk Distribution" subtitle="Active scholars by compliance risk level.">
                                {riskDistribution.reduce((sum, item) => sum + item.value, 0) === 0 ? (
                                    <EmptyState>No risk data yet.</EmptyState>
                                ) : (
                                    <ResponsiveContainer width="100%" height={230}>
                                        <BarChart data={riskDistribution} layout="vertical" margin={{ top: 4, left: 4, right: 36, bottom: 0 }}>
                                            <CartesianGrid {...gridProps} horizontal={false} />
                                            <XAxis type="number" tick={axisStyle} stroke={BORDER} allowDecimals={false} />
                                            <YAxis type="category" dataKey="level" tick={axisStyle} stroke={BORDER} width={72} />
                                            <Tooltip content={<ChartTooltip />} cursor={{ fill: `${BORDER}55` }} />
                                            <Bar dataKey="value" name="Scholars" radius={[0, 6, 6, 0]} barSize={20}>
                                                {riskDistribution.map((entry) => (
                                                    <Cell key={entry.level} fill={entry.color} />
                                                ))}
                                                <LabelList dataKey="value" position="right" style={{ ...axisStyle, fontWeight: 600, fill: INK }} />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </ChartCard>

                            <ChartCard icon={MessageSquare} title="NLP Sentiment" subtitle="Sentiment analysis of submitted letters.">
                                {sentimentBreakdown.reduce((sum, item) => sum + item.value, 0) === 0 ? (
                                    <EmptyState>No sentiment data yet.</EmptyState>
                                ) : (
                                    <ResponsiveContainer width="100%" height={230}>
                                        <BarChart data={sentimentBreakdown} margin={{ top: 16, right: 12, left: -16, bottom: 0 }}>
                                            <CartesianGrid {...gridProps} />
                                            <XAxis dataKey="label" tick={axisStyle} stroke={BORDER} />
                                            <YAxis tick={axisStyle} stroke={BORDER} allowDecimals={false} />
                                            <Tooltip content={<ChartTooltip />} cursor={{ fill: `${BORDER}55` }} />
                                            <Bar dataKey="value" name="Letters" radius={[6, 6, 0, 0]} maxBarSize={72}>
                                                {sentimentBreakdown.map((entry) => (
                                                    <Cell key={entry.label} fill={sentimentColor[entry.label]} />
                                                ))}
                                                <LabelList dataKey="value" position="top" style={{ ...axisStyle, fontWeight: 600, fill: INK }} />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </ChartCard>
                        </div>
                    </>
                )}

                {/* ── Operations Overview ── */}
                <section aria-labelledby="ops-heading" style={{ ...cardStyle, padding: 22 }}>
                    <div className="flex items-center gap-3 mb-4">
                        <IconBubble icon={Settings} color={PRIMARY} size={40} iconSize={18} />
                        <div>
                            <h2 id="ops-heading" style={{ ...serif, fontSize: '1.02rem', fontWeight: 700, color: PRIMARY }}>Operations Overview</h2>
                            <p style={{ ...sans, fontSize: '0.74rem', color: MUTED, marginTop: 1 }}>Quick access to key administrative operations.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {operationsCards.map((card) => {
                            const showCount = card.count !== null && card.count !== undefined && !loading;
                            return (
                                <div key={card.title} className="dash-hover flex flex-col justify-between gap-4 p-5" style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 14 }}>
                                    <div className="flex items-start gap-4">
                                        <IconBubble icon={card.icon} color={PRIMARY} size={48} iconSize={20} />
                                        <div className="min-w-0 flex-1">
                                            <h3 style={{ ...serif, fontSize: '0.98rem', fontWeight: 700, color: PRIMARY }}>{card.title}</h3>
                                            {showCount && (
                                                <p style={{ ...serif, fontSize: '1.8rem', fontWeight: 700, color: INK, lineHeight: 1.1, marginTop: 2 }}>{card.count}</p>
                                            )}
                                            <p style={{ ...sans, fontSize: '0.74rem', color: MUTED, marginTop: 4 }}>{card.desc}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <OutlineButton onClick={() => navigate(card.path)}>{card.action}</OutlineButton>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* ── Governance Shortcuts ── */}
                <div>

                    {/* Governance Shortcuts */}
                    <section className="min-w-0" style={{ ...cardStyle, padding: 22 }}>
                        <PanelHeader icon={Star} title="Governance Shortcuts" subtitle="Quick access to commonly used tools." />
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                            {quickLinks.map(link => {
                                const Icon = link.icon;
                                return (
                                    <button key={link.path} type="button" onClick={() => navigate(link.path)}
                                        className="dash-focus dash-hover flex items-center gap-3 p-3 text-left"
                                        style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 14, cursor: 'pointer' }}>
                                        <IconBubble icon={Icon} color={PRIMARY} size={36} iconSize={16} />
                                        <div className="flex-1 min-w-0">
                                            <p style={{ ...sans, fontSize: '0.8rem', fontWeight: 700, color: INK }}>{link.label}</p>
                                            <p style={{ ...sans, fontSize: '0.68rem', color: MUTED, marginTop: 1 }}>{link.desc}</p>
                                        </div>
                                        <ArrowRight size={13} style={{ color: PRIMARY, flexShrink: 0 }} />
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                </div>

            </div>
        </div>
    );
};

export default AdminDashboard;