import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Megaphone, Search, X,
    ChevronDown, AlertCircle, AlertTriangle, Info, Send, FilterX,
    Plus, Users, RefreshCw,
} from 'lucide-react';

const API = 'http://localhost:5000/api';
const authHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
});

// ── Apple Scholar design system — same tokens as StaffAnnouncement,
// Scholar Portfolio, Staff Duty Assignment and Staff Attendance. ──
const PRIMARY = '#6D2140';
const GOLD = '#A9784E';
const BG = '#F3EEE6';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const INK = '#241512';
const MUTED = '#8A7A68';
const SUCCESS = '#3F8A55';
const WARNING = '#B8863F';
const DANGER = '#C1666B';
const RADIUS = 16;

const display = { fontFamily: "'Lora', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace" };

const cardShadow = { boxShadow: '0 12px 28px -20px rgba(36,21,18,0.22)' };
const cardWrap = { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, ...cardShadow };

const fieldStyle = {
    width: '100%', padding: '11px 14px', border: `1px solid ${BORDER}`, borderRadius: 10,
    background: '#FCFAF5', ...body, fontSize: '0.875rem', color: INK, outline: 'none',
};

// ─── Year Level Config ──────────────────────────────────────────────────────
const AUDIENCE_GROUPS = [
    { label: 'Junior High School', options: [
        { value: 'grade_7',  label: 'Grade 7'  },
        { value: 'grade_8',  label: 'Grade 8'  },
        { value: 'grade_9',  label: 'Grade 9'  },
        { value: 'grade_10', label: 'Grade 10' },
    ]},
    { label: 'Senior High School', options: [
        { value: 'grade_11', label: 'Grade 11' },
        { value: 'grade_12', label: 'Grade 12' },
    ]},
    { label: 'College', options: [
        { value: 'college_1', label: '1st Year College' },
        { value: 'college_2', label: '2nd Year College' },
        { value: 'college_3', label: '3rd Year College' },
        { value: 'college_4', label: '4th Year College' },
        { value: 'college_5', label: '5th Year College' },
    ]},
];
const ALL_LEVELS = AUDIENCE_GROUPS.flatMap(g => g.options);
const getLevelLabel = (val) => ALL_LEVELS.find(o => o.value === val)?.label || val;

const ROLE_OPTIONS = [
    { value: 'scholar', label: 'Scholars' },
    { value: 'staff',   label: 'Staff'    },
];

const PRIORITY_CONFIG = {
    critical:  { color: DANGER,  label: 'Critical'  },
    important: { color: WARNING, label: 'Important' },
    info:      { color: GOLD,    label: 'Info'      },
};

const SOURCE_CONFIG = {
    admin:   { label: 'Admin'   },
    officer: { label: 'Officer' },
    staff:   { label: 'Staff'   },
};

const SOURCE_TABS = [
    { key: 'all',     label: 'All'     },
    { key: 'admin',   label: 'Admin'   },
    { key: 'officer', label: 'Officer' },
    { key: 'staff',   label: 'Staff'   },
];

const PRIORITY_TABS = [
    { key: 'all',       label: 'All'       },
    { key: 'critical',  label: 'Critical'  },
    { key: 'important', label: 'Important' },
    { key: 'info',      label: 'Info'      },
];

function PriorityIcon({ priority, size = 12 }) {
    if (priority === 'critical')  return <AlertCircle  size={size} />;
    if (priority === 'important') return <AlertTriangle size={size} />;
    return <Info size={size} />;
}

// KPI card (same as StaffAnnouncement)
const KPICard = ({ icon: Icon, label, value, accent }) => (
    <div className="min-w-0 h-full" style={{ ...cardWrap, padding: 'clamp(14px, 3vw, 18px)' }}>
        <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center justify-center flex-shrink-0" style={{ width: 44, height: 44, borderRadius: 12, background: `${accent}18`, color: accent }}>
                <Icon size={20} />
            </div>
            <div className="min-w-0">
                <p style={{ ...display, fontSize: 'clamp(1.35rem, 4vw, 1.7rem)', fontWeight: 700, color: PRIMARY, lineHeight: 1 }}>{value}</p>
                <p style={{ ...body, fontSize: '0.78rem', color: MUTED, marginTop: 5 }}>{label}</p>
            </div>
        </div>
    </div>
);

// ─── Year Level Multi-select ─────────────────────────────────────────────────
function LevelSelector({ value, onChange }) {
    const [open, setOpen] = useState(false);
    const toggle = (val) => onChange(value.includes(val) ? value.filter(v => v !== val) : [...value, val]);
    const displayLabel = () => {
        if (!value.length) return 'All year levels';
        if (value.length <= 2) return value.map(getLevelLabel).join(', ');
        return `${getLevelLabel(value[0])} +${value.length - 1} more`;
    };

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="w-full flex items-center justify-between"
                style={{ ...fieldStyle, cursor: 'pointer', color: value.length ? INK : '#B7A99E' }}
            >
                <span className="truncate">{displayLabel()}</span>
                <ChevronDown size={14} style={{ color: MUTED, flexShrink: 0, marginLeft: 8 }} />
            </button>
            {open && (
                <>
                    <div
                        className="absolute z-50 top-full left-0 right-0 mt-2 overflow-auto"
                        style={{ maxHeight: 240, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: '0 16px 32px -18px rgba(36,21,18,0.3)' }}
                    >
                        {AUDIENCE_GROUPS.map(group => (
                            <div key={group.label}>
                                <p style={{ padding: '10px 14px 4px', ...body, fontSize: '0.68rem', fontWeight: 700, color: GOLD }}>
                                    {group.label}
                                </p>
                                {group.options.map(opt => {
                                    const selected = value.includes(opt.value);
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => toggle(opt.value)}
                                            className="w-full flex items-center gap-2.5 transition-colors hover:bg-[#F3EEE6]"
                                            style={{ padding: '9px 14px', textAlign: 'left', ...body, fontSize: '0.875rem', color: INK, border: 'none', background: 'none', cursor: 'pointer' }}
                                        >
                                            <span
                                                className="flex items-center justify-center flex-shrink-0"
                                                style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${selected ? PRIMARY : BORDER}`, background: selected ? PRIMARY : '#fff' }}
                                            >
                                                {selected && (
                                                    <svg width="9" height="7" viewBox="0 0 10 8" fill="none">
                                                        <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                )}
                                            </span>
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                </>
            )}
        </div>
    );
}

// ─── Create Modal — "Communication composer" ────────────────────────────────
function CreateModal({ authorName, onClose, onCreated }) {
    const [title,       setTitle]       = useState('');
    const [content,     setContent]     = useState('');
    const [priority,    setPriority]    = useState('info');
    const [targetRoles, setTargetRoles] = useState(['scholar']);
    const [levels,      setLevels]      = useState([]);
    const [error,       setError]       = useState('');
    const [submitting,  setSubmitting]  = useState(false);
    const authorId = localStorage.getItem('id') || localStorage.getItem('user_id') || null;

    // Presentation-only: Escape closes the dialog
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const toggleRole = (role) => {
        setTargetRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
    };

    const handleSubmit = async () => {
        if (!title.trim())       { setError('Title is required.');          return; }
        if (!content.trim())     { setError('Content is required.');        return; }
        if (!targetRoles.length) { setError('Please select an audience.'); return; }
        setError('');
        setSubmitting(true);

        try {
            await axios.post(`${API}/officer/announcements`, {
                title:         title.trim(),
                content:       content.trim(),
                priority,
                created_by:    authorId,
                target_roles:  targetRoles,
                target_levels: targetRoles.includes('scholar') ? levels : [],
            }, authHeaders());
            onCreated();
            onClose();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Failed to post announcement. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const labelStyle = { ...body, fontSize: '0.74rem', fontWeight: 600, color: INK, display: 'block', marginBottom: 6 };

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            style={{ background: 'rgba(36,21,18,0.5)' }}
            role="dialog" aria-modal="true" aria-label="Create announcement"
        >
            <div className="composer w-full sm:max-w-lg overflow-hidden" style={{ background: SURFACE, border: `1px solid ${BORDER}`, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>

                <div className="flex items-center justify-between gap-3 flex-shrink-0" style={{ padding: '18px 24px', borderBottom: `1px solid ${BORDER}`, background: SURFACE }}>
                    <div className="min-w-0">
                        <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', color: GOLD }}>NEW POST</p>
                        <h2 style={{ ...display, fontSize: '1.2rem', fontWeight: 600, color: PRIMARY, marginTop: 2 }}>Communication composer</h2>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className="flex items-center justify-center flex-shrink-0" style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${BORDER}`, background: '#fff', color: MUTED, cursor: 'pointer' }}>
                        <X size={15} />
                    </button>
                </div>

                <div className="space-y-5" style={{ padding: '22px 24px', overflowY: 'auto', flex: 1 }}>
                    <div>
                        <label htmlFor="ann-title" style={labelStyle}>Title</label>
                        <input
                            id="ann-title"
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g. Deadline Reminder for Grade Submission"
                            style={fieldStyle}
                        />
                    </div>

                    <div>
                        <span style={{ ...labelStyle, marginBottom: 8 }}>Priority</span>
                        <div className="flex items-center gap-2" role="group" aria-label="Priority">
                            {['info', 'important', 'critical'].map(p => {
                                const cfg    = PRIORITY_CONFIG[p];
                                const active = priority === p;
                                return (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setPriority(p)}
                                        aria-pressed={active}
                                        className="flex-1"
                                        style={{
                                            padding: '9px 0', borderRadius: 10, cursor: 'pointer',
                                            border: `1.5px solid ${active ? cfg.color : BORDER}`,
                                            background: active ? `${cfg.color}14` : '#FCFAF5',
                                            color: active ? cfg.color : MUTED,
                                            ...body, fontSize: '0.78rem', fontWeight: 700,
                                        }}
                                    >
                                        {cfg.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <span style={{ ...labelStyle, marginBottom: 8 }}>Send to</span>
                        <div className="flex items-center gap-2" role="group" aria-label="Send to">
                            {ROLE_OPTIONS.map(opt => {
                                const active = targetRoles.includes(opt.value);
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => toggleRole(opt.value)}
                                        aria-pressed={active}
                                        className="flex-1 flex items-center justify-center gap-1.5"
                                        style={{
                                            padding: '9px 0', borderRadius: 10, cursor: 'pointer',
                                            border: `1.5px solid ${active ? PRIMARY : BORDER}`,
                                            background: active ? PRIMARY : '#FCFAF5',
                                            color: active ? '#fff' : MUTED,
                                            ...body, fontSize: '0.78rem', fontWeight: 700,
                                        }}
                                    >
                                        <Users size={13} />
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {targetRoles.includes('scholar') && (
                        <div>
                            <span style={labelStyle}>
                                Scholar year level <span style={{ color: '#B7A99E', fontWeight: 400 }}>(optional — leave blank for all)</span>
                            </span>
                            <LevelSelector value={levels} onChange={setLevels} />
                            {levels.length > 0 && (
                                <div className="flex flex-wrap gap-1.5" style={{ marginTop: 8 }}>
                                    {levels.map(a => (
                                        <span key={a} className="flex items-center gap-1" style={{ ...body, fontSize: '0.72rem', fontWeight: 600, padding: '3px 9px', borderRadius: 999, border: `1px solid ${PRIMARY}44`, color: PRIMARY, background: `${PRIMARY}0d` }}>
                                            {getLevelLabel(a)}
                                            <button type="button" aria-label={`Remove ${getLevelLabel(a)}`} onClick={() => setLevels(levels.filter(v => v !== a))}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: PRIMARY, display: 'flex' }}>
                                                <X size={10} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div>
                        <label htmlFor="ann-content" style={labelStyle}>Message</label>
                        <textarea
                            id="ann-content"
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            placeholder="Write your announcement here…"
                            rows={4}
                            style={{ ...fieldStyle, resize: 'none' }}
                        />
                    </div>

                    <p style={{ ...mono, fontSize: '0.72rem', color: MUTED }}>
                        Posting as <span style={{ color: PRIMARY, fontWeight: 700 }}>{authorName}</span>
                    </p>

                    {error && (
                        <p role="alert" style={{ ...body, fontSize: '0.8rem', fontWeight: 600, color: DANGER, borderLeft: `3px solid ${DANGER}`, borderRadius: 8, padding: '8px 12px', background: `${DANGER}0d` }}>{error}</p>
                    )}
                </div>

                <div className="flex gap-3 flex-shrink-0" style={{ padding: '16px 24px', borderTop: `1px solid ${BORDER}` }}>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1"
                        style={{ padding: '11px 0', border: `1px solid ${BORDER}`, borderRadius: 10, background: '#fff', color: MUTED, ...body, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="flex-1 flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                        style={{
                            padding: '11px 0', border: 'none', borderRadius: 10, cursor: 'pointer',
                            background: PRIMARY, color: '#fff',
                            ...body, fontSize: '0.82rem', fontWeight: 700, opacity: submitting ? 0.6 : 1,
                        }}
                    >
                        <Send size={13} />
                        {submitting ? 'Publishing…' : 'Publish announcement'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Feed row — one compact line per announcement, click to expand ──────────
function AnnouncementRow({ ann, isLatest, onNotify, notifyingId }) {
    const [open, setOpen] = useState(false);   // presentation-only
    const levels = ann.target_levels || [];
    const roles  = ann.target_roles || [];
    const src    = SOURCE_CONFIG[ann.created_by_role];
    const cfg    = PRIORITY_CONFIG[ann.priority] || PRIORITY_CONFIG.info;
    const sending = notifyingId === ann.id;
    const authorName = ann.created_by_name || ann.created_by || 'Unknown';
    const postedDate = ann.created_at
        ? new Date(ann.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
        : '';

    return (
        <article className={`ann-row ${open ? 'ann-row-open' : ''}`}>
            <div className="ann-row-main">
                <span className="ann-icon" style={{ background: `${cfg.color}18`, color: cfg.color }} aria-hidden="true">
                    <PriorityIcon priority={ann.priority} size={17} />
                </span>

                <button type="button" className="ann-row-body" onClick={() => setOpen(v => !v)} aria-expanded={open} style={body}>
                    <span className="ann-row-title">
                        <span style={{ ...display, fontSize: '1rem', fontWeight: 700, color: INK, wordBreak: 'break-word' }}>{ann.title}</span>
                        {isLatest && <span className="new-dot">New</span>}
                    </span>
                    <span className={open ? 'ann-text-open' : 'ann-text'}>{ann.content}</span>
                    <span className="ann-meta">
                        <span style={{ color: cfg.color, fontWeight: 700 }}>{cfg.label}</span>
                        <span className="ann-sep" />
                        <span style={{ color: INK, fontWeight: 600 }}>{authorName}</span>
                        {(src || ann.created_by_role) && <span>{src ? src.label : ann.created_by_role}</span>}
                        {postedDate && (
                            <>
                                <span className="ann-sep" />
                                <span>{postedDate}</span>
                            </>
                        )}
                    </span>
                </button>

                <div className="ann-actions">
                    <button type="button" onClick={() => onNotify(ann.id)} disabled={sending} className="notify-btn" style={body}>
                        <Send size={12} /> {sending ? 'Sending…' : 'Notify recipients'}
                    </button>
                    <button type="button" className="chev-btn" onClick={() => setOpen(v => !v)} aria-label={open ? 'Collapse' : 'Expand'}>
                        <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms ease' }} />
                    </button>
                </div>
            </div>

            {open && (
                <div className="ann-detail">
                    <span style={{ ...body, fontSize: '0.72rem', fontWeight: 600, color: MUTED }}>Audience</span>
                    <div className="flex flex-wrap gap-1.5">
                        {roles.length === 0 && <span className="level-chip" style={body}>Everyone</span>}
                        {roles.map(r => (
                            <span key={r} className="role-chip capitalize" style={body}>
                                <Users size={10} /> {r}
                            </span>
                        ))}
                        {roles.includes('scholar') && (levels.length > 0
                            ? levels.map(lv => <span key={lv} className="level-chip" style={body}>{getLevelLabel(lv)}</span>)
                            : <span className="level-chip" style={body}>All year levels</span>
                        )}
                    </div>
                </div>
            )}
        </article>
    );
}

// ─── Main Component ─────────────────────────────────────────────────────────
const OfficerAnnouncement = () => {
    const officerName = localStorage.getItem('name') || 'Officer';

    const [announcements, setAnnouncements] = useState([]);
    const [loading,       setLoading]       = useState(true);
    const [search,        setSearch]        = useState('');
    const [sourceFilter,   setSourceFilter]   = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [showModal,     setShowModal]     = useState(false);
    const [notifyingId, setNotifyingId] = useState(null);
    const [notifyMessage, setNotifyMessage] = useState('');
    const [notifyError, setNotifyError] = useState('');
    // Session-only running total for the "Notified This Session" tile —
    // adds up the real sent_count from each successful /notify call in this session.
    const [sessionRecipients, setSessionRecipients] = useState(0);

    const fetchAnnouncements = async () => {
        try {
            const res = await axios.get(`${API}/officer/announcements`, authHeaders());
            setAnnouncements(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAnnouncements(); }, []);

    // Presentation-only: notice banners clear themselves
    useEffect(() => {
        if (!notifyMessage && !notifyError) return;
        const t = setTimeout(() => { setNotifyMessage(''); setNotifyError(''); }, 5000);
        return () => clearTimeout(t);
    }, [notifyMessage, notifyError]);

    const handleRefresh = () => {
        setLoading(true);
        fetchAnnouncements();
    };

    const handleNotifyAnnouncement = async (id) => {
        setNotifyError('');
        setNotifyMessage('');
        setNotifyingId(id);

        try {
            const res = await axios.post(`${API}/officer/announcements/${id}/notify`, {}, authHeaders());
            const sentCount = res.data?.sent_count ?? 0;
            setNotifyMessage(`Notifications sent to ${sentCount} recipient(s).`);
            setSessionRecipients(prev => prev + sentCount);
        } catch (err) {
            setNotifyError(err.response?.data?.error || 'Failed to send notifications.');
        } finally {
            setNotifyingId(null);
        }
    };

    const filtered = announcements.filter(ann => {
        const matchesSearch =
            ann.title.toLowerCase().includes(search.toLowerCase()) ||
            ann.content.toLowerCase().includes(search.toLowerCase());
        const matchesSource   = sourceFilter === 'all' || ann.created_by_role === sourceFilter;
        const matchesPriority = priorityFilter === 'all' || ann.priority === priorityFilter;
        return matchesSearch && matchesSource && matchesPriority;
    });

    const clearFilters = () => {
        setSearch('');
        setSourceFilter('all');
        setPriorityFilter('all');
    };
    const filtersActive = search !== '' || sourceFilter !== 'all' || priorityFilter !== 'all';

    const criticalCount  = announcements.filter(a => a.priority === 'critical').length;
    const importantCount = announcements.filter(a => a.priority === 'important').length;

    return (
        <div className="officer-hub" style={{ ...body, background: BG }}>
            <div className="hub-inner">

                {/* ── Page header ── */}
                <div className="mb-5">
                    <div
                        className="staff-page-header-card flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 min-w-0"
                        style={{ ...cardWrap, padding: 'clamp(14px, 3vw, 20px)' }}
                    >
                        <div className="min-w-0">
                            <p className="staff-page-eyebrow">OFFICER PORTAL</p>
                            <h1 className="staff-page-title">Announcements</h1>
                            <p className="staff-page-description">
                                Create and manage announcements for scholars and staff.
                            </p>
                        </div>
                        <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowModal(true)}
                                className="flex items-center justify-center gap-2 hover-lift"
                                style={{ ...body, fontSize: '0.78rem', fontWeight: 700, color: '#fff', padding: '9px 18px', border: 'none', borderRadius: 10, background: PRIMARY, cursor: 'pointer' }}
                            >
                                <Plus size={14} /> Create Announcement
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── KPI cards ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-5">
                    <KPICard icon={Megaphone} label="Announcements Posted" value={announcements.length} accent={PRIMARY} />
                    <KPICard icon={AlertCircle} label="Critical Announcements" value={criticalCount} accent={DANGER} />
                    <KPICard icon={AlertTriangle} label="Important Announcements" value={importantCount} accent={WARNING} />
                    <KPICard icon={Send} label="Notified This Session" value={sessionRecipients} accent={SUCCESS} />
                </div>

                {/* ── Announcement feed ── */}
                <section style={{ ...cardWrap, padding: 'clamp(14px, 3vw, 22px)' }}>
                    <div className="feed-head">
                        <h2 style={{ ...display, fontSize: '1.15rem', fontWeight: 600, color: INK }}>Announcements</h2>
                        <div className="flex items-center gap-2">
                            <span style={{ ...body, fontSize: '0.76rem', color: MUTED }}>
                                {loading ? 'Loading…' : `Showing ${filtered.length} of ${announcements.length}`}
                            </span>
                            <button type="button" className="chev-btn" onClick={handleRefresh} disabled={loading} aria-label="Refresh announcements">
                                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    <div className="toolbar" role="search">
                        <div className="toolbar-search">
                            <Search size={15} style={{ color: MUTED, flexShrink: 0 }} aria-hidden="true" />
                            <input
                                type="text"
                                placeholder="Search announcements…"
                                aria-label="Search announcements"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none', ...body, fontSize: '0.875rem', color: INK }}
                            />
                        </div>
                        <select className="toolbar-select" aria-label="Filter by source" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} style={body}>
                            {SOURCE_TABS.map(f => <option key={f.key} value={f.key}>{f.key === 'all' ? 'All sources' : f.label}</option>)}
                        </select>
                        <select className="toolbar-select" aria-label="Filter by priority" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} style={body}>
                            {PRIORITY_TABS.map(f => <option key={f.key} value={f.key}>{f.key === 'all' ? 'All priorities' : f.label}</option>)}
                        </select>
                        {filtersActive && (
                            <button type="button" onClick={clearFilters} className="clear-filters-btn" style={body}>
                                <FilterX size={13} /> Clear
                            </button>
                        )}
                    </div>

                    {notifyMessage && <div role="status" className="notice-banner notice-success" style={body}>{notifyMessage}</div>}
                    {notifyError && <div role="alert" className="notice-banner notice-error" style={body}>{notifyError}</div>}

                    {loading ? (
                        <div className="ann-list">
                            {Array(4).fill(0).map((_, i) => (
                                <div key={i} className="animate-pulse" style={{ background: `${BORDER}66`, height: 82, borderBottom: '1px solid #fff' }} />
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon"><Megaphone size={24} style={{ color: GOLD }} /></div>
                            <p style={{ ...display, fontSize: '1.05rem', fontWeight: 700, color: INK }}>
                                {filtersActive ? 'No matching announcements' : 'No announcements yet'}
                            </p>
                            <p style={{ ...body, fontSize: '0.85rem', color: MUTED, marginTop: 4 }}>
                                {filtersActive ? 'Try a different search or clear your filters.' : 'Posts you create will appear here.'}
                            </p>
                            {filtersActive && (
                                <button type="button" onClick={clearFilters} className="clear-filters-btn" style={{ ...body, margin: '14px auto 0' }}>
                                    <FilterX size={13} /> Clear filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="ann-list">
                            {filtered.map((ann, idx) => (
                                <AnnouncementRow
                                    key={ann.id}
                                    ann={ann}
                                    isLatest={idx === 0 && !filtersActive}
                                    onNotify={handleNotifyAnnouncement}
                                    notifyingId={notifyingId}
                                />
                            ))}
                        </div>
                    )}
                </section>
            </div>

            {showModal && (
                <CreateModal authorName={officerName} onClose={() => setShowModal(false)} onCreated={fetchAnnouncements} />
            )}

            <GlobalStyle />
        </div>
    );
};

const GlobalStyle = () => (
    <style>{`
        .officer-hub { width: 100%; min-height: 100vh; overflow-x: hidden; }
        .hub-inner { box-sizing: border-box; padding: 16px 16px 48px; width: 100%; max-width: none; margin: 0; }
        @media (min-width: 640px) { .hub-inner { padding: 24px 24px 48px; } }
        @media (min-width: 1024px) { .hub-inner { padding: 32px 32px 48px; } }

        .officer-hub button:focus-visible,
        .officer-hub input:focus-visible,
        .officer-hub textarea:focus-visible {
            outline: 2px solid ${GOLD}; outline-offset: 2px;
        }
        .hover-lift { transition: opacity 160ms ease, background-color 160ms ease; }
        .hover-lift:hover:not(:disabled) { opacity: 0.9; }

        /* ── Page header ── */
        /* Same class names as StaffAnnouncement. :where() keeps these at zero specificity,
           so the shared staff-page-* styles win whenever they are loaded; otherwise this is the fallback. */
        :where(.staff-page-eyebrow) { font-family: 'Inter', 'Segoe UI', sans-serif; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em; color: ${GOLD}; }
        :where(.staff-page-title) { font-family: 'Lora', Georgia, 'Times New Roman', serif; font-size: clamp(1.6rem, 4vw, 2rem); font-weight: 700; color: ${PRIMARY}; line-height: 1.15; margin-top: 3px; }
        :where(.staff-page-description) { font-family: 'Inter', 'Segoe UI', sans-serif; font-size: 0.9rem; color: ${MUTED}; margin-top: 6px; line-height: 1.55; }

        /* ── Composer modal: bottom sheet on mobile, centered card on larger screens ── */
        .composer { border-radius: 20px 20px 0 0; }
        @media (min-width: 640px) { .composer { border-radius: 20px; } }

        /* ── Feed header + toolbar ── */
        .feed-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 14px; }
        .toolbar-search {
            display: flex; align-items: center; gap: 8px;
            flex: 1 1 260px; min-width: 200px;
            background: #fff; border: 1px solid ${BORDER}; border-radius: 10px;
            padding: 9px 12px;
        }
        .toolbar-search:focus-within { border-color: ${GOLD}; }
        .toolbar-select {
            appearance: none; -webkit-appearance: none;
            padding: 9px 32px 9px 12px; border-radius: 10px;
            border: 1px solid ${BORDER}; color: ${INK}; font-size: 0.8rem; font-weight: 600; cursor: pointer;
            background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A7A68' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 11px center;
        }
        .toolbar-select:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 2px; }
        .clear-filters-btn {
            display: flex; align-items: center; gap: 6px;
            padding: 8px 14px; border-radius: 10px;
            border: 1px solid ${BORDER}; background: #fff; color: ${PRIMARY};
            font-size: 0.76rem; font-weight: 700; cursor: pointer;
        }
        .clear-filters-btn:hover { background: ${BG}; }
        @media (max-width: 640px) { .toolbar-select { flex: 1 1 140px; } }

        .notice-banner { border-radius: 10px; padding: 10px 14px; font-size: 0.8rem; font-weight: 600; margin-top: 14px; }
        .notice-success { border-left: 3px solid ${SUCCESS}; background: #EAF6EC; color: #2F5039; }
        .notice-error { border-left: 3px solid ${DANGER}; background: #FBEAEA; color: #8E2631; }

        /* ── Announcement list: one bordered block, rows divided by hairlines ── */
        .ann-list {
            margin-top: 16px; background: #fff;
            border: 1px solid ${BORDER}; border-radius: 14px; overflow: hidden;
        }
        .ann-row { border-bottom: 1px solid ${BORDER}; transition: background-color 150ms ease; }
        .ann-row:last-child { border-bottom: none; }
        .ann-row:hover, .ann-row-open { background: #FCFAF5; }
        .ann-row-main { display: flex; align-items: center; gap: 14px; padding: 14px 16px; }
        .ann-icon {
            width: 38px; height: 38px; border-radius: 12px; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center; align-self: flex-start;
        }
        .ann-row-body {
            flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px;
            text-align: left; background: none; border: none; padding: 0; cursor: pointer;
        }
        .ann-row-body:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 4px; border-radius: 6px; }
        .ann-row-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .ann-text {
            font-size: 0.84rem; color: #5c4a3f; line-height: 1.5;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .ann-text-open { font-size: 0.86rem; color: #5c4a3f; line-height: 1.65; white-space: pre-wrap; word-break: break-word; }
        .ann-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; font-size: 0.72rem; color: ${MUTED}; margin-top: 2px; }
        .ann-sep { width: 3px; height: 3px; border-radius: 50%; background: ${BORDER}; flex-shrink: 0; }
        .ann-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .chev-btn {
            width: 30px; height: 30px; border-radius: 8px; border: none; background: none;
            color: ${MUTED}; display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .chev-btn:hover { background: ${BG}; }
        .ann-detail {
            display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
            padding: 0 16px 14px 68px;
        }
        @media (max-width: 640px) {
            .ann-row-main { flex-wrap: wrap; }
            .ann-actions { width: 100%; justify-content: space-between; padding-left: 52px; }
            .ann-detail { padding-left: 16px; }
        }

        .new-dot {
            font-size: 0.66rem; font-weight: 700; color: ${PRIMARY};
            background: ${PRIMARY}14; border-radius: 999px; padding: 2px 8px;
        }
        .level-chip {
            font-size: 0.7rem; font-weight: 500; color: ${MUTED};
            border: 1px solid ${BORDER}; border-radius: 999px; padding: 3px 10px; background: ${BG};
        }
        .role-chip {
            display: inline-flex; align-items: center; gap: 5px;
            font-size: 0.7rem; font-weight: 600; color: ${PRIMARY};
            border: 1px solid ${PRIMARY}44; border-radius: 999px; padding: 3px 10px; background: ${PRIMARY}0d;
        }
        .notify-btn {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 7px 14px; border-radius: 999px;
            border: 1px solid ${SUCCESS}66; background: transparent; color: ${SUCCESS};
            font-size: 0.76rem; font-weight: 700; cursor: pointer; white-space: nowrap;
            transition: background-color 150ms ease;
        }
        .notify-btn:hover:not(:disabled) { background: #EAF6EC; }
        .notify-btn:disabled { opacity: 0.5; cursor: default; }

        .empty-state {
            text-align: center;
            border: 1.5px dashed ${BORDER};
            background: #fff;
            border-radius: 14px;
            padding: 48px 20px;
            margin-top: 16px;
        }
        .empty-icon {
            width: 52px; height: 52px; border-radius: 16px;
            background: ${GOLD}18;
            display: flex; align-items: center; justify-content: center;
            margin: 0 auto 16px;
        }

        @media (prefers-reduced-motion: reduce) {
            .officer-hub * { transition: none !important; animation-duration: 0.01ms !important; }
        }
    `}</style>
);

export default OfficerAnnouncement;