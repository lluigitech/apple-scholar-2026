import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Megaphone, Clock, Search, Pin, Users, X,
    ChevronDown, AlertCircle, AlertTriangle, Info, Send, RefreshCw, FilterX,
} from 'lucide-react';

const API = 'http://localhost:5000/api';
const token = () => localStorage.getItem('token');
const authHeaders = () => ({ headers: { Authorization: `Bearer ${token()}` } });

// ── Apple Scholar design system — same tokens as Scholar Portfolio,
// Staff Duty Assignment and Staff Attendance. ──
const PRIMARY = '#6D2140';
const PRIMARY_DARK = '#4A1730';
const GOLD = '#A9784E';
const BG = '#F3EEE6';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const INK = '#241512';
const MUTED = '#8A7A68';
const SUCCESS = '#3F8A55';
const WARNING = '#B8863F';
const DANGER = '#C1666B';

const display = { fontFamily: "'Lora', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace" };

const fieldStyle = {
    width: '100%', padding: '11px 14px', border: `1px solid ${BORDER}`, borderRadius: 10,
    background: '#FCFAF5', ...body, fontSize: '0.875rem', color: INK, outline: 'none',
};

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

const getInitial = (name) => (name ? name.trim().charAt(0).toUpperCase() : '?');

function PriorityIcon({ priority, size = 12 }) {
    if (priority === 'critical')  return <AlertCircle  size={size} />;
    if (priority === 'important') return <AlertTriangle size={size} />;
    return <Info size={size} />;
}

function PriorityBadge({ priority }) {
    const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.info;
    return (
        <span className="priority-badge" style={{ background: `${cfg.color}18`, color: cfg.color }}>
            <PriorityIcon priority={priority} size={11} /> {cfg.label}
        </span>
    );
}

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
                className="w-full flex items-center justify-between"
                style={{ ...fieldStyle, cursor: 'pointer', color: value.length ? INK : '#B7A99E' }}
            >
                <span>{displayLabel()}</span>
                <ChevronDown size={14} style={{ color: MUTED, flexShrink: 0, marginLeft: 8 }} />
            </button>
            {open && (
                <>
                    <div
                        className="absolute z-50 top-full left-0 right-0 mt-2 overflow-auto"
                        style={{ maxHeight: 260, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: '0 16px 32px -18px rgba(36,21,18,0.3)' }}
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

// Compose modal — the "Communication Composer".
function CreateModal({ authorName, onClose, onCreated }) {
    const [title, setTitle]       = useState('');
    const [content, setContent]   = useState('');
    const [priority, setPriority] = useState('info');
    const [levels, setLevels]     = useState([]);
    const [error, setError]       = useState('');
    const [submitting, setSubmitting] = useState(false);
    const authorId = localStorage.getItem('id') || localStorage.getItem('user_id') || null;

    const handleSubmit = async () => {
        if (!title.trim())   { setError('Title is required.');   return; }
        if (!content.trim()) { setError('Content is required.'); return; }
        setError('');
        setSubmitting(true);
        try {
            await axios.post(`${API}/staff/announcements`, {
                title: title.trim(),
                content: content.trim(),
                priority,
                created_by: authorId,
                target_levels: levels,
            });
            onCreated();
            onClose();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || 'Failed to post announcement. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(36,21,18,0.5)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full sm:max-w-lg overflow-hidden" style={{ background: SURFACE, borderRadius: '24px 24px 0 0', border: `1px solid ${BORDER}`, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>

                <div className="flex items-center justify-between flex-shrink-0" style={{ padding: '24px 26px', background: `linear-gradient(120deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)` }}>
                    <div>
                        <p style={{ ...body, fontSize: '0.68rem', fontWeight: 600, color: '#E7CFA5', marginBottom: 4 }}>New post</p>
                        <h2 style={{ ...display, fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>Communication composer</h2>
                    </div>
                    <button onClick={onClose} className="flex items-center justify-center" style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid rgba(255,255,255,0.25)`, background: 'transparent', color: '#fff', cursor: 'pointer' }}>
                        <X size={15} />
                    </button>
                </div>

                <div className="space-y-5" style={{ padding: '24px 26px', overflowY: 'auto', flex: 1 }}>
                    <div>
                        <label style={{ ...body, fontSize: '0.74rem', fontWeight: 600, color: INK, display: 'block', marginBottom: 6 }}>Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g. Duty Schedule Update"
                            style={fieldStyle}
                        />
                    </div>

                    <div>
                        <label style={{ ...body, fontSize: '0.74rem', fontWeight: 600, color: INK, display: 'block', marginBottom: 8 }}>Priority</label>
                        <div className="flex items-center gap-2">
                            {['info', 'important', 'critical'].map(p => {
                                const cfg    = PRIORITY_CONFIG[p];
                                const active = priority === p;
                                return (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setPriority(p)}
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
                        <label style={{ ...body, fontSize: '0.74rem', fontWeight: 600, color: INK, display: 'block', marginBottom: 6 }}>
                            Target audience <span style={{ color: '#B7A99E', fontWeight: 400 }}>(optional — leave blank for all)</span>
                        </label>
                        <LevelSelector value={levels} onChange={setLevels} />
                        {levels.length > 0 && (
                            <div className="flex flex-wrap gap-1.5" style={{ marginTop: 8 }}>
                                {levels.map(a => (
                                    <span key={a} className="flex items-center gap-1" style={{ ...body, fontSize: '0.72rem', fontWeight: 600, padding: '3px 9px', borderRadius: 999, border: `1px solid ${PRIMARY}44`, color: PRIMARY, background: `${PRIMARY}0d` }}>
                                        {getLevelLabel(a)}
                                        <button type="button" onClick={() => setLevels(levels.filter(v => v !== a))}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: PRIMARY, display: 'flex' }}>
                                            <X size={10} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <label style={{ ...body, fontSize: '0.74rem', fontWeight: 600, color: INK, display: 'block', marginBottom: 6 }}>Message</label>
                        <textarea
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
                        <p style={{ ...body, fontSize: '0.8rem', fontWeight: 600, color: DANGER, borderLeft: `3px solid ${DANGER}`, borderRadius: 8, padding: '8px 12px', background: `${DANGER}0d` }}>{error}</p>
                    )}
                </div>

                <div className="flex gap-3 flex-shrink-0" style={{ padding: '18px 26px', borderTop: `1px solid ${BORDER}` }}>
                    <button
                        onClick={onClose}
                        className="flex-1"
                        style={{ padding: '11px 0', border: `1px solid ${BORDER}`, borderRadius: 10, background: 'none', color: MUTED, ...body, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="flex-1 flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                        style={{
                            padding: '11px 0', border: 'none', borderRadius: 10, cursor: 'pointer',
                            background: `linear-gradient(120deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`, color: '#fff',
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

// Feed card — used inside the main bento feed column.
function AnnouncementCard({ ann, isLatest, onNotify, notifyingId }) {
    const levels = ann.target_levels || [];
    const src    = SOURCE_CONFIG[ann.created_by_role];
    const cfg    = PRIORITY_CONFIG[ann.priority] || PRIORITY_CONFIG.info;
    const authorName = ann.created_by_name || ann.created_by || 'Unknown';

    return (
        <div className="feed-card" style={{ borderLeftColor: cfg.color }}>
            <div className="feed-card-head">
                <div className="ann-avatar" style={display}>{getInitial(authorName)}</div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                        <h4 style={{ ...display, fontSize: '1.02rem', fontWeight: 700, color: INK }}>{ann.title}</h4>
                        {isLatest && <span className="new-dot" style={body}>Newest</span>}
                    </div>
                    <p style={{ ...mono, fontSize: '0.7rem', color: MUTED, marginTop: 2 }}>
                        {src ? `${src.label} · ` : ''}{authorName}{' '}
                        <span style={{ color: '#C6B8AE' }}>—</span>{' '}
                        {new Date(ann.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: '2-digit' })}
                    </p>
                </div>
                <PriorityBadge priority={ann.priority} />
            </div>

            <p style={{ ...body, fontSize: '0.85rem', color: '#5c4a3f', lineHeight: 1.6, marginTop: 12 }}>{ann.content}</p>

            <div className="feed-card-foot">
                <div className="flex flex-wrap gap-1.5">
                    {levels.length > 0 ? levels.map(lv => (
                        <span key={lv} className="level-chip" style={mono}>{getLevelLabel(lv)}</span>
                    )) : (
                        <span className="level-chip" style={mono}>All levels</span>
                    )}
                </div>
                <button
                    onClick={() => onNotify(ann.id)}
                    disabled={notifyingId === ann.id}
                    className="notify-btn"
                    style={body}
                >
                    {notifyingId === ann.id ? 'Sending…' : 'Notify scholars'}
                </button>
            </div>
        </div>
    );
}

const StaffAnnouncement = () => {
    const staffName = localStorage.getItem('name') || 'Staff';

    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading]     = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch]       = useState('');
    const [sourceFilter, setSourceFilter]     = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [showModal, setShowModal] = useState(false);
    const [notifyingId, setNotifyingId] = useState(null);
    const [notifyMessage, setNotifyMessage] = useState('');
    const [notifyError, setNotifyError] = useState('');
    // Session-only running total for the "Notified this session" tile —
    // the API doesn't persist a cumulative recipient count, so this simply
    // adds up the real sent_count from each successful /notify call made in
    // this session.
    const [sessionRecipients, setSessionRecipients] = useState(0);

    const fetchAnnouncements = async (isManualRefresh = false) => {
        if (isManualRefresh) setRefreshing(true);
        try {
            const res = await axios.get(`${API}/staff/announcements`, authHeaders());
            setAnnouncements(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
            if (isManualRefresh) setRefreshing(false);
        }
    };

    useEffect(() => { fetchAnnouncements(); }, []);

    const handleNotifyAnnouncement = async (id) => {
        setNotifyError('');
        setNotifyMessage('');
        setNotifyingId(id);

        try {
            const res = await axios.post(`${API}/staff/announcements/${id}/notify`, {}, authHeaders());
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

    // Spotlight tile — the thing a staff member most needs to see right now:
    // the newest critical post, or the newest important one, or just the newest.
    const spotlight = announcements.find(a => a.priority === 'critical')
        || announcements.find(a => a.priority === 'important')
        || announcements[0]
        || null;
    const spotlightLabel = !spotlight ? 'Nothing pinned'
        : spotlight.priority === 'critical' ? 'Needs attention'
        : spotlight.priority === 'important' ? 'Worth a look'
        : 'Latest post';

    return (
        <div className="staff-hub" style={{ ...body, background: BG }}>
            <div className="hub-inner">

                <div className="hub-topbar">
                    <div>
                        <h1 style={{ ...display, fontSize: '1.7rem', fontWeight: 700, color: INK }}>Communication Hub</h1>
                        <p style={{ ...body, fontSize: '0.85rem', color: MUTED, marginTop: 4 }}>Post announcements and notify scholars across every year level.</p>
                    </div>
                    <button
                        onClick={() => fetchAnnouncements(true)}
                        className="icon-refresh"
                        aria-label="Refresh announcements"
                        title="Refresh"
                    >
                        <RefreshCw size={16} style={{ animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }} />
                    </button>
                </div>

                {/* Bento block: compose tile + four stat tiles */}
                <div className="bento-grid">
                    <button className="bento-tile tile-compose" onClick={() => setShowModal(true)}>
                        <span className="tile-compose-icon"><Megaphone size={20} /></span>
                        <h2 style={{ ...display, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>Post an announcement</h2>
                        <p style={{ ...body, fontSize: '0.82rem', color: '#F3E7DE', marginTop: 6, maxWidth: '32ch' }}>
                            Share duty updates, reminders, or urgent notices with the scholars who need them.
                        </p>
                        <span className="tile-compose-cta" style={body}>Open composer</span>
                    </button>

                    <div className="bento-tile tile-stat" style={{ borderTopColor: PRIMARY }}>
                        <span style={{ ...display, fontSize: '2rem', fontWeight: 700, color: INK }}>{announcements.length}</span>
                        <span style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 4 }}>Announcements posted</span>
                    </div>
                    <div className="bento-tile tile-stat" style={{ borderTopColor: DANGER }}>
                        <span style={{ ...display, fontSize: '2rem', fontWeight: 700, color: INK }}>{criticalCount}</span>
                        <span style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 4 }}>Critical right now</span>
                    </div>
                    <div className="bento-tile tile-stat" style={{ borderTopColor: WARNING }}>
                        <span style={{ ...display, fontSize: '2rem', fontWeight: 700, color: INK }}>{importantCount}</span>
                        <span style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 4 }}>Important posts</span>
                    </div>
                    <div className="bento-tile tile-stat" style={{ borderTopColor: GOLD }}>
                        <span style={{ ...display, fontSize: '2rem', fontWeight: 700, color: INK }}>{sessionRecipients}</span>
                        <span style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 4 }}>Notified this session</span>
                    </div>
                </div>

                {/* Filter tile */}
                <div className="bento-tile tile-filters">
                    <div className="toolbar-search">
                        <Search size={15} style={{ color: MUTED, flexShrink: 0 }} />
                        <input
                            type="text"
                            placeholder="Search announcements…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ flex: 1, border: 'none', outline: 'none', background: 'none', ...body, fontSize: '0.875rem', color: INK }}
                        />
                    </div>
                    <div className="toolbar-pills">
                        {SOURCE_TABS.map(f => (
                            <button
                                key={f.key}
                                onClick={() => setSourceFilter(f.key)}
                                className={`pill ${sourceFilter === f.key ? 'pill-active' : ''}`}
                                style={body}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <div className="toolbar-pills">
                        {PRIORITY_TABS.map(f => (
                            <button
                                key={f.key}
                                onClick={() => setPriorityFilter(f.key)}
                                className={`pill ${priorityFilter === f.key ? 'pill-active' : ''}`}
                                style={body}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    {filtersActive && (
                        <button onClick={clearFilters} className="clear-filters-btn" style={body}>
                            <FilterX size={13} /> Clear
                        </button>
                    )}
                </div>

                {notifyMessage && <div className="notice-banner notice-success" style={body}>{notifyMessage}</div>}
                {notifyError && <div className="notice-banner notice-error" style={body}>{notifyError}</div>}

                {/* Feed + spotlight */}
                <div className="feed-layout">
                    <div className="feed-main">
                        {loading ? (
                            <div className="space-y-4">
                                {Array(3).fill(0).map((_, i) => (
                                    <div key={i} className="animate-pulse" style={{ background: SURFACE, border: `1px solid ${BORDER}`, height: 130, borderRadius: 16 }} />
                                ))}
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon"><Megaphone size={26} style={{ color: GOLD }} /></div>
                                <p style={{ ...display, fontSize: '1.05rem', fontWeight: 700, color: INK }}>No announcements yet</p>
                                <p style={{ ...body, fontSize: '0.85rem', color: MUTED, marginTop: 4 }}>Posts you create will appear here.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {filtered.map((ann, idx) => (
                                    <AnnouncementCard
                                        key={ann.id}
                                        ann={ann}
                                        isLatest={idx === 0}
                                        onNotify={handleNotifyAnnouncement}
                                        notifyingId={notifyingId}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <aside className="feed-side">
                        <div className="spotlight-tile">
                            <span className="spotlight-kicker" style={body}><Pin size={11} /> {spotlightLabel}</span>
                            {spotlight ? (
                                <>
                                    <h3 style={{ ...display, fontSize: '1.05rem', fontWeight: 700, color: INK, marginTop: 10 }}>{spotlight.title}</h3>
                                    <p style={{ ...body, fontSize: '0.8rem', color: '#5c4a3f', lineHeight: 1.55, marginTop: 8 }}>
                                        {spotlight.content.length > 140 ? `${spotlight.content.slice(0, 140)}…` : spotlight.content}
                                    </p>
                                    <p className="flex items-center gap-1" style={{ ...mono, fontSize: '0.68rem', color: MUTED, marginTop: 12 }}>
                                        <Clock size={11} />
                                        {new Date(spotlight.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: '2-digit' })}
                                    </p>
                                </>
                            ) : (
                                <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginTop: 10 }}>Nothing to highlight yet — post your first announcement.</p>
                            )}
                        </div>

                        <div className="tips-tile">
                            <span className="flex items-center gap-1.5" style={{ ...body, fontSize: '0.78rem', fontWeight: 700, color: PRIMARY }}>
                                <Users size={13} /> Reaching scholars
                            </span>
                            <p style={{ ...body, fontSize: '0.78rem', color: MUTED, lineHeight: 1.55, marginTop: 8 }}>
                                Leave the target audience blank to post to every year level, or narrow it down when a duty applies to a specific batch only.
                            </p>
                        </div>
                    </aside>
                </div>
            </div>

            {showModal && (
                <CreateModal authorName={staffName} onClose={() => setShowModal(false)} onCreated={fetchAnnouncements} />
            )}

            <GlobalStyle />
        </div>
    );
};

const GlobalStyle = () => (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,600;0,700;1,600&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .staff-hub { min-height: 100vh; }
        .hub-inner { padding: 28px 20px 48px; max-width: 1140px; margin: 0 auto; }

        .hub-topbar {
            display: flex; align-items: flex-start; justify-content: space-between;
            gap: 16px; margin-bottom: 20px;
        }
        .icon-refresh {
            width: 38px; height: 38px; border-radius: 12px; flex-shrink: 0;
            background: ${SURFACE}; border: 1px solid ${BORDER}; color: ${GOLD};
            display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .icon-refresh:hover { background: ${BG}; color: ${PRIMARY}; }

        .bento-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            grid-template-rows: repeat(2, 1fr);
            gap: 14px;
            margin-bottom: 14px;
        }
        .bento-tile {
            background: ${SURFACE};
            border: 1px solid ${BORDER};
            border-radius: 18px;
            box-shadow: 0 10px 24px -18px rgba(36,21,18,0.28);
        }
        .tile-compose {
            grid-column: span 2; grid-row: span 2;
            background: linear-gradient(150deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%);
            border: none;
            padding: 26px;
            text-align: left;
            cursor: pointer;
            display: flex; flex-direction: column; justify-content: space-between;
        }
        .tile-compose-icon {
            width: 40px; height: 40px; border-radius: 12px;
            background: rgba(255,255,255,0.16); color: #fff;
            display: flex; align-items: center; justify-content: center;
        }
        .tile-compose-cta {
            align-self: flex-start; margin-top: 20px;
            padding: 9px 16px; border-radius: 999px;
            background: #fff; color: ${PRIMARY};
            font-size: 0.78rem; font-weight: 700;
        }
        .tile-stat {
            grid-column: span 1; grid-row: span 1;
            padding: 18px 20px;
            border-top: 3px solid;
            display: flex; flex-direction: column; justify-content: center;
        }

        .tile-filters {
            padding: 14px 18px;
            display: flex; flex-wrap: wrap; align-items: center; gap: 14px;
            margin-bottom: 20px;
        }
        .toolbar-search {
            display: flex; align-items: center; gap: 8px;
            flex: 1; min-width: 200px;
            border-bottom: 1px solid ${BORDER};
            padding-bottom: 8px;
        }
        .toolbar-pills { display: flex; flex-wrap: wrap; gap: 6px; }
        .pill {
            padding: 6px 13px; border-radius: 999px;
            border: 1px solid ${BORDER}; background: ${BG}; color: ${MUTED};
            font-size: 0.74rem; font-weight: 600; cursor: pointer;
        }
        .pill-active { background: ${PRIMARY}; border-color: ${PRIMARY}; color: #fff; }
        .clear-filters-btn {
            display: flex; align-items: center; gap: 6px;
            padding: 6px 13px; border-radius: 999px;
            border: 1px dashed ${MUTED}88; background: none; color: ${MUTED};
            font-size: 0.74rem; font-weight: 600; cursor: pointer; margin-left: auto;
        }

        .notice-banner { border-radius: 10px; padding: 11px 16px; font-size: 0.82rem; font-weight: 600; margin-bottom: 16px; }
        .notice-success { border-left: 3px solid ${SUCCESS}; background: #EAF3EC; color: #2F5039; }
        .notice-error { border-left: 3px solid ${DANGER}; background: #FBEAEA; color: #8E2631; }

        .feed-layout {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 18px;
            align-items: start;
        }

        .feed-card {
            position: relative;
            background: ${SURFACE};
            border: 1px solid ${BORDER};
            border-left: 4px solid;
            border-radius: 14px;
            padding: 20px 22px;
            box-shadow: 0 10px 24px -18px rgba(36,21,18,0.25);
        }
        .feed-card-head { display: flex; align-items: flex-start; gap: 12px; }
        .ann-avatar {
            width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
            background: linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%);
            color: #fff; display: flex; align-items: center; justify-content: center;
            font-size: 0.92rem; font-weight: 700;
        }
        .new-dot {
            flex-shrink: 0; font-size: 0.66rem; font-weight: 700; color: ${PRIMARY};
            background: ${PRIMARY}14; border-radius: 999px; padding: 2px 9px;
        }
        .priority-badge {
            display: inline-flex; align-items: center; gap: 5px;
            padding: 4px 10px; border-radius: 999px;
            font-size: 0.72rem; font-weight: 700; flex-shrink: 0; white-space: nowrap;
        }
        .feed-card-foot {
            display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
            gap: 12px; margin-top: 16px; padding-top: 14px; border-top: 1px solid ${BORDER};
        }
        .level-chip {
            font-size: 0.68rem; color: ${MUTED};
            border: 1px solid ${BORDER}; border-radius: 999px; padding: 3px 10px; background: ${BG};
        }
        .notify-btn {
            padding: 7px 16px; border-radius: 999px;
            border: 1px solid ${SUCCESS}66; background: transparent; color: ${SUCCESS};
            font-size: 0.76rem; font-weight: 700; cursor: pointer;
        }
        .notify-btn:disabled { opacity: 0.5; cursor: default; }

        .feed-side { display: flex; flex-direction: column; gap: 14px; position: sticky; top: 20px; }
        .spotlight-tile {
            background: ${INK};
            border-radius: 18px;
            padding: 22px;
            color: #fff;
        }
        .spotlight-kicker {
            display: inline-flex; align-items: center; gap: 6px;
            font-size: 0.68rem; font-weight: 700; color: #E0C6A6;
        }
        .tips-tile {
            background: ${SURFACE};
            border: 1px solid ${BORDER};
            border-radius: 18px;
            padding: 20px;
        }

        .empty-state {
            text-align: center;
            border: 1.5px dashed ${BORDER};
            background: ${SURFACE};
            border-radius: 16px;
            padding: 64px 20px;
        }
        .empty-icon {
            width: 52px; height: 52px; border-radius: 16px;
            background: ${GOLD}18;
            display: flex; align-items: center; justify-content: center;
            margin: 0 auto 16px;
        }

        @media (max-width: 1024px) {
            .bento-grid { grid-template-columns: repeat(2, 1fr); grid-template-rows: auto; }
            .tile-compose { grid-column: span 2; grid-row: span 1; }
            .feed-layout { grid-template-columns: 1fr; }
            .feed-side { position: static; }
        }
        @media (max-width: 640px) {
            .bento-grid { grid-template-columns: 1fr; }
            .tile-compose { grid-column: span 1; }
            .hub-topbar { flex-wrap: wrap; }
        }
    `}</style>
);
 
export default StaffAnnouncement;