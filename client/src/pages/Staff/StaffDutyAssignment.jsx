import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    ClipboardList, CalendarDays, MapPin, Clock,
    Plus, X, Save, Loader2,
    CheckSquare, Square, AlertCircle, RefreshCw, TrendingUp,
    ChevronDown, Search,
} from 'lucide-react';

const API = 'http://localhost:5000/api';
const token = () => localStorage.getItem('token');
const authHeaders = () => ({ headers: { Authorization: `Bearer ${token()}` } });

// ── Design tokens — Apple Scholar system (matches Admin & Scholar portals) ──
const BG = '#F7F4EE';
const CARD = '#FFFFFF';
const BORDER = '#E8DCCB';
const MAROON = '#7A1F2B';
const MAROON_DEEP = '#5B1621';
const GOLD = '#B78A4A';
const INK = '#241512';
const MUTED = '#8C7E74';
const SUCCESS = '#3F8A55';
const SUCCESS_BG = '#EAF6EC';
const CLAY = '#C1666B';
const CLAY_BG = '#FBEAE8';
const GRAY = '#8C8478';
const GRAY_BG = '#F0ECE5';
const RADIUS = 16;

const display = { fontFamily: "'Lora', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace" };

const cardShadow = { boxShadow: '0 12px 28px -20px rgba(36,21,18,0.22)' };

const STATUS_CONFIG = {
    upcoming:    { color: GOLD,    bg: `${GOLD}18`,    label: 'Upcoming'    },
    ongoing:     { color: SUCCESS, bg: SUCCESS_BG,     label: 'Ongoing'     },
    completed:   { color: GRAY,    bg: GRAY_BG,        label: 'Completed'   },
    cancelled:   { color: CLAY,    bg: CLAY_BG,        label: 'Cancelled'   },
    unscheduled: { color: GOLD,    bg: `${GOLD}18`,    label: 'Unscheduled' },
};

const getDutyStatus = (duty) => {
    const storedStatus = String(duty.status || '').trim().toLowerCase();
    if (storedStatus === 'completed' || storedStatus === 'cancelled') return storedStatus;

    const start = new Date(`${duty.duty_date}T${duty.time_start || '00:00'}`);
    const end = new Date(`${duty.duty_date}T${duty.time_end || '23:59'}`);
    const now = new Date();
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return ['upcoming', 'ongoing'].includes(storedStatus) ? storedStatus : 'upcoming';
    }
    // The displayed status follows the actual schedule so stale database
    // values cannot leave an already-finished duty marked Upcoming.
    if (now > end) return 'completed';
    if (now >= start) return 'ongoing';
    return 'upcoming';
};

const getStatusLabel = (status) => STATUS_CONFIG[status]?.label || 'Unscheduled';

// Presentation-only: "13:00" / "13:00:00" -> "01:00 PM". Falls back to the raw value.
const formatTime = (value) => {
    if (!value) return '';
    const match = String(value).match(/^(\d{1,2}):(\d{2})/);
    if (!match) return String(value);
    const h = Number(match[1]);
    const m = match[2];
    if (Number.isNaN(h) || h > 23) return String(value);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${String(h12).padStart(2, '0')}:${m} ${suffix}`;
};

const EMPTY_FORM = {
    title: '',
    description: '',
    location: '',
    duty_date: '',
    time_start: '',
    time_end: '',
    group_ids: [],
};

// ─── Shared field styles ──────────────────────────────────────────────────
const fieldStyle = {
    width: '100%', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 10,
    background: '#fff', ...body, fontSize: '0.85rem', color: INK, outline: 'none',
};
const fieldLabel = { ...body, fontSize: '0.72rem', color: MUTED, display: 'block', marginBottom: 6 };

// ─── Modern chip, replacing the paper checklist squares ───────────────────
const GroupChip = ({ value, label, checked, onChange }) => (
    <button type="button" onClick={() => onChange(value)} aria-pressed={checked}
        className="flex items-center gap-2"
        style={{
            ...body, fontSize: '0.78rem', fontWeight: 600, borderRadius: 999, padding: '7px 14px', cursor: 'pointer',
            border: `1px solid ${checked ? MAROON : BORDER}`,
            background: checked ? MAROON : '#fff',
            color: checked ? '#fff' : MUTED,
        }}>
        {checked ? <CheckSquare size={13} /> : <Square size={13} />}
        {label}
    </button>
);

const KPICard = ({ icon: Icon, label, value, accent = GOLD, tint }) => (
    <div
        className="min-w-0 h-full"
        style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: 'clamp(14px, 3vw, 18px)', ...cardShadow }}
    >
        <div className="flex items-center gap-3 sm:gap-4">
            <div
                className="flex items-center justify-center flex-shrink-0"
                style={{ width: 44, height: 44, borderRadius: 12, background: tint || `${GOLD}22`, color: accent }}
            >
                <Icon size={20} />
            </div>
            <div className="min-w-0">
                <p style={{ ...display, fontSize: 'clamp(1.35rem, 4vw, 1.7rem)', fontWeight: 700, color: MAROON, lineHeight: 1 }}>{value}</p>
                <p style={{ ...body, fontSize: '0.78rem', color: MUTED, marginTop: 5 }}>{label}</p>
            </div>
        </div>
    </div>
);

const SkeletonRow = () => (
    <div className="animate-pulse" style={{ background: `${BORDER}88`, height: 52, borderRadius: 10 }} />
);

const StatusBadge = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.unscheduled;
    return (
        <span style={{
            ...body, fontSize: '0.7rem', fontWeight: 700, borderRadius: 999,
            padding: '4px 12px', background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap', display: 'inline-block',
        }}>
            {getStatusLabel(status)}
        </span>
    );
};

const StaffDutyAssignment = () => {
    const staffId   = localStorage.getItem('user_id') || localStorage.getItem('id');
    const isAdmin   = String(localStorage.getItem('role') || '').toLowerCase() === 'admin';

    const [duties, setDuties]         = useState([]);
    const [groups, setGroups]         = useState([]);
    const [loading, setLoading]       = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm]             = useState(EMPTY_FORM);
    const [saving, setSaving]         = useState(false);
    const [formError, setFormError]   = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [makeupSources, setMakeupSources] = useState([]);
    const [activeStatusFilter, setActiveStatusFilter] = useState('total');

    // ---- Presentation-only UI state ----
    const [makeupOpen, setMakeupOpen] = useState(false);      // collapsed by default
    const [makeupHover, setMakeupHover] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');


    const fetchDuties = async () => {
        try {
            const res = await axios.get(`${API}/duties`, authHeaders());
            const dutiesWithGroups = await Promise.all(res.data.map(async (duty) => {
                try {
                    const groupRes = await axios.get(`${API}/staff/duties/${duty.id}/groups`, authHeaders());
                    return { ...duty, assigned_groups: groupRes.data || [] };
                } catch (groupError) {
                    console.error(`Failed to load groups for duty ${duty.id}:`, groupError);
                    return { ...duty, assigned_groups: [] };
                }
            }));
            setDuties(dutiesWithGroups);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchGroups = async () => {
        try {
            const res = await axios.get(`${API}/staff/groups`, authHeaders());
            setGroups(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchMakeupRequestData = async () => {
        try {
            const res = await axios.get(`${API}/staff/makeup-request-data`, authHeaders());
            setMakeupSources(res.data.sources || []);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => { fetchDuties(); fetchGroups(); fetchMakeupRequestData(); }, []);
    useEffect(() => {
        const intervalId = setInterval(fetchMakeupRequestData, 60 * 1000);
        return () => clearInterval(intervalId);
    }, []);

    // ---- Presentation-only: combined refresh for the Refresh button.
    // Calls the exact same fetch functions above; adds no new
    // request or business logic of its own.
    const [refreshing, setRefreshing] = useState(false);
    const handleRefreshAll = async () => {
        setRefreshing(true);
        await Promise.all([fetchDuties(), fetchGroups(), fetchMakeupRequestData()]);
        setTimeout(() => setRefreshing(false), 400);
    };

    // ─── Duty Form handlers ───────────────────────────────────────────────────
    const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const toggleGroup = (groupId) => {
        setForm(f => ({
            ...f,
            group_ids: f.group_ids.includes(groupId)
                ? f.group_ids.filter(g => g !== groupId)
                : [...f.group_ids, groupId],
        }));
    };

    const handleCreate = async () => {
        setFormError('');
        if (!form.title)                  return setFormError('Title is required.');
        if (!form.duty_date)              return setFormError('Date is required.');
        if (!form.group_ids.length)       return setFormError('Select at least one group.');

        setSaving(true);
        try {
            await axios.post(`${API}/duties`, {
                ...form,
                created_by: staffId,
            }, authHeaders());

            setSuccessMsg('Task created successfully!');
            setShowCreate(false);
            setForm(EMPTY_FORM);
            await fetchDuties();
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            setFormError(err.response?.data?.error || 'Failed to create task. Please try again.');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const dutyStatusCounts = duties.reduce((counts, duty) => {
        const status = getDutyStatus(duty);
        counts[status] = (counts[status] || 0) + 1;
        return counts;
    }, { upcoming: 0, ongoing: 0, completed: 0, cancelled: 0 });

    const dutySummary = [
        { key: 'total',     label: 'All' },
        { key: 'upcoming',  label: 'Upcoming' },
        { key: 'ongoing',   label: 'Ongoing' },
        { key: 'completed', label: 'Completed' },
    ];

    const filteredDuties = activeStatusFilter === 'total'
        ? duties
        : duties.filter(duty => getDutyStatus(duty) === activeStatusFilter);

    // Presentation-only search, layered on top of filteredDuties (client-side, no requests).
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const visibleDuties = normalizedSearch
        ? filteredDuties.filter(duty => {
            const haystack = [
                duty.title,
                duty.description,
                duty.location,
                ...(duty.assigned_groups || []).map(g => g.group_name),
            ].filter(Boolean).join(' ').toLowerCase();
            return haystack.includes(normalizedSearch);
        })
        : filteredDuties;

    // ---- Presentation-only KPI values, derived from existing counts ----
    const completionRate = duties.length ? Math.round((dutyStatusCounts.completed / duties.length) * 100) : 0;

    const todayLabel = new Date().toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' });

    const thStyle = {
        ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', color: MUTED,
        textAlign: 'left', padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, background: BG, whiteSpace: 'nowrap',
    };
    const tdStyle = { padding: '16px 16px', borderBottom: `1px solid ${BORDER}`, verticalAlign: 'top', ...body, fontSize: '0.78rem', color: INK };

    return (
        <div className="min-h-screen p-4 sm:p-6 lg:p-8" style={{ ...body, background: BG, overflowX: 'hidden' }}>
            <div className="w-full">

                {/* ── Standard header: title card + date card ── */}
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3 sm:gap-4 mb-5">
                    <div
                        className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 min-w-0"
                        style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: 'clamp(14px, 3vw, 20px)', ...cardShadow }}
                    >
                        <div className="min-w-0">
                            <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', color: GOLD }}>{isAdmin ? 'ADMIN PORTAL' : 'STAFF PORTAL'}</p>
                            <h1 style={{ ...display, fontSize: 'clamp(1.3rem, 4vw, 1.6rem)', fontWeight: 600, color: MAROON, marginTop: 4, lineHeight: 1.2 }}>Duty Operations Center</h1>
                            <p style={{ ...body, fontSize: '0.82rem', color: MUTED, marginTop: 4, lineHeight: 1.5 }}>
                                Manage duty schedules, assigned groups, and makeup-duty requests.
                            </p>
                            <p style={{ ...body, fontSize: '0.74rem', color: MUTED, marginTop: 2, lineHeight: 1.5 }}>
                                {isAdmin ? 'Create duties for groups whose staff assignments are already configured in Team Assignments.' : 'Track duty schedules, notifications, attendance, and makeup requests.'}
                            </p>
                        </div>

                        <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0">
                            <button
                                type="button"
                                onClick={handleRefreshAll}
                                className="flex items-center justify-center gap-1.5"
                                style={{ background: '#fff', border: `1px solid ${BORDER}`, color: MAROON, borderRadius: 999, padding: '8px 16px', ...body, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                            >
                                <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
                            </button>
                            {isAdmin && (
                                <button type="button" onClick={() => { setShowCreate(true); setFormError(''); }}
                                    className="flex items-center justify-center gap-2"
                                    style={{ ...body, fontSize: '0.78rem', fontWeight: 700, color: '#fff', padding: '8px 18px', border: 'none', borderRadius: 999, background: MAROON, cursor: 'pointer' }}>
                                    <Plus size={14} /> Create Duty
                                </button>
                            )}
                        </div>
                    </div>

                    <div
                        className="flex items-center gap-3"
                        style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: 'clamp(14px, 3vw, 20px)', ...cardShadow }}
                    >
                        <div className="flex items-center justify-center flex-shrink-0" style={{ width: 42, height: 42, borderRadius: 12, background: `${GOLD}22`, color: GOLD }}>
                            <CalendarDays size={17} />
                        </div>
                        <div>
                            <p style={{ ...mono, fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.05em', color: MUTED }}>Today</p>
                            <p style={{ ...display, fontSize: '0.95rem', fontWeight: 600, color: INK, marginTop: 2, whiteSpace: 'nowrap' }}>{todayLabel}</p>
                        </div>
                    </div>
                </div>

                {successMsg && (
                    <div className="mb-5 flex items-center gap-2" role="status" style={{ borderLeft: `3px solid ${SUCCESS}`, background: SUCCESS_BG, borderRadius: '0 12px 12px 0', padding: '10px 14px', ...body, fontSize: '0.8rem', fontWeight: 600, color: SUCCESS }}>
                        {successMsg}
                    </div>
                )}

                {/* ── KPI cards ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-5">
                    <KPICard icon={ClipboardList} label="Total Duties" value={duties.length} accent={MAROON} tint={`${MAROON}12`} />
                    <KPICard icon={Clock} label="Ongoing" value={dutyStatusCounts.ongoing} />
                    <KPICard icon={CalendarDays} label="Upcoming" value={dutyStatusCounts.upcoming} />
                    <KPICard icon={TrendingUp} label="Completion Rate" value={`${completionRate}%`} />
                </div>

                {/* ── Single-column layout: duties table, then collapsible makeup request ── */}
                <div className="flex flex-col gap-5">

                    {/* Assigned Duties (full width) */}
                    <section className="min-w-0" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS, ...cardShadow, overflow: 'hidden' }}>
                        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 xl:gap-4" style={{ padding: 'clamp(14px, 3vw, 18px)' }}>
                            <div className="min-w-0">
                                <h2 style={{ ...display, fontSize: '1.1rem', fontWeight: 600, color: INK }}>Assigned Duties</h2>
                                <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 3 }}>View and manage your duty schedule and assigned groups.</p>
                            </div>

                            <div className="flex flex-col md:flex-row md:items-center gap-3 min-w-0">
                                {/* Search (client-side only) */}
                                <div className="relative w-full md:w-64 flex-shrink-0">
                                    <Search size={14} aria-hidden="true" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: MUTED, pointerEvents: 'none' }} />
                                    <input
                                        type="search"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Search duties, location, or group..."
                                        aria-label="Search duties, location, or group"
                                        style={{ ...fieldStyle, paddingLeft: 34, borderRadius: 999, fontSize: '0.78rem' }}
                                    />
                                </div>

                                {/* Segmented status filter */}
                                <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Filter duties by status">
                                    {dutySummary.map(item => {
                                        const active = activeStatusFilter === item.key;
                                        return (
                                            <button
                                                key={item.key}
                                                type="button"
                                                onClick={() => setActiveStatusFilter(item.key)}
                                                aria-pressed={active}
                                                className="flex-shrink-0"
                                                style={{
                                                    ...body, fontSize: '0.76rem', fontWeight: 600, borderRadius: 999, padding: '6px 14px', cursor: 'pointer', whiteSpace: 'nowrap',
                                                    border: `1px solid ${active ? MAROON : BORDER}`,
                                                    background: active ? MAROON : '#fff',
                                                    color: active ? '#fff' : MUTED,
                                                }}
                                            >
                                                {item.label}
                                                {item.key !== 'total' && ` (${dutyStatusCounts[item.key] || 0})`}
                                                {item.key === 'total' && ` (${duties.length})`}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {loading ? (
                            <div className="space-y-2" style={{ padding: '0 clamp(14px, 3vw, 18px) clamp(14px, 3vw, 18px)' }}>
                                {Array(5).fill(0).map((_, i) => <SkeletonRow key={i} />)}
                            </div>
                        ) : visibleDuties.length === 0 ? (
                            <div className="text-center" style={{ borderTop: `1px dashed ${BORDER}`, padding: '48px 20px' }}>
                                <ClipboardList size={32} style={{ margin: '0 auto 14px', color: BORDER }} />
                                <p style={{ ...body, fontSize: '0.88rem', fontWeight: 600, color: MUTED }}>
                                    {normalizedSearch
                                        ? 'No duties match your search.'
                                        : `No ${activeStatusFilter === 'total' ? 'duties' : getStatusLabel(activeStatusFilter).toLowerCase() + ' duties'} found.`}
                                </p>
                                <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 4 }}>
                                    {normalizedSearch ? 'Try a different keyword or status.' : 'Choose another status above to view other assignments.'}
                                </p>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto', borderTop: `1px solid ${BORDER}` }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            <th scope="col" style={{ ...thStyle, width: 48 }}>#</th>
                                            <th scope="col" style={thStyle}>Duty</th>
                                            <th scope="col" style={thStyle}>Assigned Groups</th>
                                            <th scope="col" style={thStyle}>Schedule</th>
                                            <th scope="col" style={thStyle}>Location</th>
                                            <th scope="col" style={thStyle}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleDuties.map((duty, index) => {
                                            const dutyStatus = getDutyStatus(duty);
                                            return (
                                                <tr key={duty.id}>
                                                    <td style={{ ...tdStyle, color: MUTED }}>{index + 1}</td>
                                                    <td style={{ ...tdStyle, minWidth: 200, maxWidth: 300 }}>
                                                        <p style={{ ...display, fontSize: '0.95rem', fontWeight: 600, color: INK, wordBreak: 'break-word' }}>{duty.title}</p>
                                                        {duty.description && (
                                                            <p className="line-clamp-2" style={{ ...body, fontSize: '0.74rem', color: MUTED, marginTop: 3, wordBreak: 'break-word' }}>{duty.description}</p>
                                                        )}
                                                    </td>
                                                    <td style={{ ...tdStyle, minWidth: 160 }}>
                                                        {duty.assigned_groups?.length ? (
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {duty.assigned_groups.map((group, idx) => (
                                                                    <span key={group.id ?? `${group.group_name}-${idx}`} style={{ ...body, fontSize: '0.7rem', fontWeight: 600, color: MAROON, background: `${MAROON}10`, border: `1px solid ${MAROON}22`, borderRadius: 999, padding: '3px 10px', wordBreak: 'break-word' }}>
                                                                        {group.group_name}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span style={{ color: MUTED }}>No group assigned</span>
                                                        )}
                                                    </td>
                                                    <td style={{ ...tdStyle, minWidth: 170 }}>
                                                        <div className="flex items-center gap-1.5" style={{ color: INK }}>
                                                            <CalendarDays size={13} style={{ color: GOLD, flexShrink: 0 }} />
                                                            <span style={{ whiteSpace: 'nowrap' }}>{new Date(duty.duty_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                                        </div>
                                                        {duty.time_start && (
                                                            <div className="flex items-center gap-1.5" style={{ color: MUTED, marginTop: 4 }}>
                                                                <Clock size={13} style={{ color: GOLD, flexShrink: 0 }} />
                                                                <span style={{ whiteSpace: 'nowrap' }}>{formatTime(duty.time_start)}{duty.time_end ? ` – ${formatTime(duty.time_end)}` : ''}</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={{ ...tdStyle, minWidth: 130 }}>
                                                        {duty.location ? (
                                                            <div className="flex items-start gap-1.5" style={{ color: INK }}>
                                                                <MapPin size={13} style={{ color: GOLD, flexShrink: 0, marginTop: 2 }} />
                                                                <span style={{ wordBreak: 'break-word' }}>{duty.location}</span>
                                                            </div>
                                                        ) : (
                                                            <span style={{ color: MUTED }}>—</span>
                                                        )}
                                                    </td>
                                                    <td style={tdStyle}>
                                                        <StatusBadge status={dutyStatus} />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    {/* Absence records available for Admin makeup-duty assignment */}
                    <section className="min-w-0" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS, ...cardShadow, overflow: 'hidden' }}>
                        <button
                            type="button"
                            id="makeup-toggle"
                            onClick={() => setMakeupOpen(open => !open)}
                            onMouseEnter={() => setMakeupHover(true)}
                            onMouseLeave={() => setMakeupHover(false)}
                            aria-expanded={makeupOpen}
                            aria-controls="makeup-panel"
                            className="w-full flex items-center gap-3 sm:gap-4 text-left"
                            style={{
                                padding: 'clamp(14px, 3vw, 20px)', border: 'none', cursor: 'pointer',
                                background: makeupHover ? '#FBF8F2' : CARD,
                                transition: 'background-color 180ms ease',
                            }}
                        >
                            <div className="flex items-center justify-center flex-shrink-0" style={{ width: 44, height: 44, borderRadius: 999, background: `${MAROON}12`, color: MAROON }}>
                                <AlertCircle size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h2 style={{ ...display, fontSize: '1.1rem', fontWeight: 600, color: MAROON }}>Absences for Admin Assignment</h2>
                                <p style={{ ...body, fontSize: '0.78rem', color: MUTED, marginTop: 3 }}>Admin assigns the next duty for scholars marked absent or excused.</p>
                            </div>
                            <span style={{ ...body, fontSize: '0.72rem', fontWeight: 700, color: MAROON, background: `${MAROON}12`, borderRadius: 999, padding: '5px 10px' }}>
                                {makeupSources.length} awaiting assignment
                            </span>
                            <ChevronDown
                                size={20}
                                aria-hidden="true"
                                className="flex-shrink-0"
                                style={{ color: MAROON, transition: 'transform 220ms ease', transform: makeupOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                            />
                        </button>

                        <div
                            id="makeup-panel"
                            role="region"
                            aria-labelledby="makeup-toggle"
                            aria-hidden={!makeupOpen}
                            style={{
                                display: 'grid',
                                gridTemplateRows: makeupOpen ? '1fr' : '0fr',
                                visibility: makeupOpen ? 'visible' : 'hidden',
                                transition: makeupOpen
                                    ? 'grid-template-rows 240ms ease, visibility 0s'
                                    : 'grid-template-rows 240ms ease, visibility 0s linear 240ms',
                            }}
                        >
                            <div style={{ overflow: 'hidden', minHeight: 0 }}>
                                <div style={{ borderTop: `1px solid ${BORDER}`, padding: 'clamp(14px, 3vw, 20px)' }}>
                                    <p className="mb-4" style={{ ...body, fontSize: '0.76rem', color: MUTED }}>
                                        Absences are recorded in attendance and shown here for visibility. Admin chooses and assigns the makeup duty.
                                    </p>
                                    {makeupSources.length === 0 ? (
                                        <p style={{ ...body, fontSize: '0.8rem', color: MUTED, textAlign: 'center', padding: '20px 12px', background: BG, borderRadius: 10 }}>
                                            No absent or excused scholars are awaiting a makeup-duty assignment.
                                        </p>
                                    ) : (
                                        <div className="overflow-x-auto" style={{ border: `1px solid ${BORDER}`, borderRadius: 10, background: '#fff' }}>
                                            <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ ...body, fontSize: '0.68rem', textAlign: 'left', color: MUTED, padding: '10px 12px', background: BG }}>Scholar</th>
                                                        <th style={{ ...body, fontSize: '0.68rem', textAlign: 'left', color: MUTED, padding: '10px 12px', background: BG }}>Missed Duty</th>
                                                        <th style={{ ...body, fontSize: '0.68rem', textAlign: 'left', color: MUTED, padding: '10px 12px', background: BG }}>Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {makeupSources.map(source => (
                                                        <tr key={`${source.scholar_id}-${source.source_duty_id}`}>
                                                            <td style={{ ...body, fontSize: '0.78rem', color: INK, padding: '11px 12px', borderTop: `1px solid ${BORDER}` }}>{source.scholar_name}</td>
                                                            <td style={{ ...body, fontSize: '0.78rem', color: INK, padding: '11px 12px', borderTop: `1px solid ${BORDER}` }}>{source.source_duty_title}</td>
                                                            <td style={{ ...body, fontSize: '0.72rem', fontWeight: 700, color: CLAY, padding: '11px 12px', borderTop: `1px solid ${BORDER}`, textTransform: 'capitalize' }}>{source.source_status}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            {/* ── CREATE DUTY MODAL (admin only) ── */}
            {isAdmin && showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(36,21,18,0.5)' }} role="dialog" aria-modal="true" aria-label="Create New Duty">
                    <div className="w-full sm:max-w-xl h-full sm:h-auto max-h-full sm:max-h-[90vh] overflow-y-auto rounded-none sm:rounded-2xl" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                        <div className="flex items-center justify-between gap-3 sticky top-0 z-10" style={{ padding: 'clamp(16px, 4vw, 20px) clamp(16px, 4vw, 24px) 16px', borderBottom: `1px solid ${BORDER}`, background: CARD }}>
                            <div className="min-w-0">
                                <p style={{ ...body, fontSize: '0.68rem', color: GOLD, fontWeight: 700, letterSpacing: '0.06em' }}>DUTY INFORMATION</p>
                                <h3 style={{ ...display, fontSize: 'clamp(1.05rem, 4vw, 1.2rem)', fontWeight: 600, color: INK, marginTop: 2 }}>Create New Duty</h3>
                            </div>
                            <button onClick={() => setShowCreate(false)} aria-label="Close"
                                className="flex-shrink-0"
                                style={{ padding: 8, borderRadius: 10, border: 'none', background: 'none', color: MUTED, cursor: 'pointer' }}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-5" style={{ padding: 'clamp(16px, 4vw, 24px)' }}>
                            {formError && (
                                <div className="flex items-center gap-2" role="alert" style={{ borderLeft: `3px solid ${CLAY}`, background: CLAY_BG, borderRadius: '0 10px 10px 0', padding: '10px 14px', ...body, fontSize: '0.78rem', fontWeight: 600, color: CLAY }}>
                                    <AlertCircle size={13} /> {formError}
                                </div>
                            )}

                            <div>
                                <label style={fieldLabel}>Task Title *</label>
                                <input type="text" value={form.title} onChange={e => setField('title', e.target.value)}
                                    placeholder="e.g. Library Duty — May 2025"
                                    style={{ ...fieldStyle, fontSize: '0.875rem' }} />
                            </div>

                            <div>
                                <label style={fieldLabel}>Description</label>
                                <textarea value={form.description} onChange={e => setField('description', e.target.value)}
                                    placeholder="Optional details about this task..."
                                    rows={3}
                                    style={{ ...fieldStyle, background: BG, fontSize: '0.875rem', resize: 'none' }} />
                            </div>

                            <div>
                                <p style={{ ...body, fontSize: '0.72rem', fontWeight: 700, color: GOLD, letterSpacing: '0.05em', marginBottom: 4 }}>SCHEDULE</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label style={fieldLabel}>Date *</label>
                                    <input type="date" value={form.duty_date} onChange={e => setField('duty_date', e.target.value)} style={fieldStyle} />
                                </div>
                                <div>
                                    <label style={fieldLabel}>Time Start</label>
                                    <input type="time" value={form.time_start} onChange={e => setField('time_start', e.target.value)} style={fieldStyle} />
                                </div>
                                <div>
                                    <label style={fieldLabel}>Time End</label>
                                    <input type="time" value={form.time_end} onChange={e => setField('time_end', e.target.value)} style={fieldStyle} />
                                </div>
                            </div>

                            <div>
                                <label style={fieldLabel}>Location</label>
                                <input type="text" value={form.location} onChange={e => setField('location', e.target.value)}
                                    placeholder="e.g. School Library, Covered Court..."
                                    style={{ ...fieldStyle, fontSize: '0.875rem' }} />
                            </div>

                            {/* Assign Scholars — modern chips */}
                            <div>
                                <p style={{ ...body, fontSize: '0.72rem', fontWeight: 700, color: GOLD, letterSpacing: '0.05em', marginBottom: 8 }}>ASSIGN SCHOLARS</p>
                                <label style={{ ...fieldLabel, marginBottom: 8 }}>
                                    Group(s) * <span style={{ color: '#c6b8ae', fontWeight: 400 }}>(makikita LANG ng members ng napiling group)</span>
                                </label>
                                {groups.length === 0 ? (
                                    <p style={{ ...body, fontSize: '0.78rem', color: MUTED, background: BG, borderRadius: 10, padding: '10px 12px', border: `1px solid ${BORDER}` }}>
                                        Wala pang groups. Ipa-manage sa administrator ang scholar groups.
                                    </p>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {groups.map(g => (
                                            <GroupChip
                                                key={g.id}
                                                value={g.id}
                                                label={`${g.group_name} (${g.member_count ?? 0})`}
                                                checked={form.group_ids.includes(g.id)}
                                                onChange={() => toggleGroup(g.id)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3" style={{ padding: 'clamp(14px, 3.5vw, 18px) clamp(16px, 4vw, 24px)', borderTop: `1px solid ${BORDER}` }}>
                            <button onClick={() => setShowCreate(false)}
                                className="w-full sm:w-auto"
                                style={{ padding: '10px 20px', ...body, fontSize: '0.82rem', fontWeight: 600, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 10, background: 'none', cursor: 'pointer' }}>
                                Cancel
                            </button>
                            <button onClick={handleCreate} disabled={saving}
                                className="w-full sm:w-auto flex items-center justify-center gap-2"
                                style={{
                                    padding: '10px 22px', ...body, fontSize: '0.82rem', fontWeight: 700, color: '#fff',
                                    border: 'none', borderRadius: 10, background: MAROON,
                                    cursor: 'pointer', opacity: saving ? 0.6 : 1,
                                }}>
                                {saving
                                    ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                                    : <><Save size={14} /> Create Duty</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default StaffDutyAssignment;