import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Megaphone, Clock, Search, Plus, X, Send,
    ChevronDown, Users, AlertCircle, AlertTriangle,
    Info, Calendar, RefreshCw, User,
} from 'lucide-react';

const API = 'http://localhost:5000/api';

// ── Design tokens — shared Records Office brand system ──
const MAROON = '#7f2d3a';
const MAROON_DEEP = '#4f1620';
const GOLD = '#b98b4e';
const GOLD_LIGHT = '#d4af7a';
const BG = '#F6EFE4';
const CARD = '#fffdf8';
const RULE = '#e8dccb';
const INK = '#241512';
const MUTED = '#a89890';
const SAGE = '#6b8f71';
const CLAY = '#c1666b';
const AMBER = '#b8863f';

const display = { fontFamily: "'Lora', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Work Sans', 'Segoe UI', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace" };

const surface = { background: CARD, border: `1px solid ${RULE}`, borderRadius: 14, boxShadow: '0 8px 20px -16px rgba(36,21,18,0.35)' };

const fieldBase = {
    width: '100%', height: 42, padding: '0 12px', border: `1px solid ${RULE}`, borderRadius: 10,
    background: '#fff', ...body, fontSize: '0.875rem', color: INK, outline: 'none',
};
const fieldLabel = { ...mono, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', color: MAROON, display: 'block', marginBottom: 8, textTransform: 'uppercase' };
const outlineBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 42, padding: '0 16px', border: `1px solid ${RULE}`, borderRadius: 10, background: CARD, color: INK, ...body, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' };
const filledBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 42, padding: '0 18px', border: 'none', borderRadius: 10, background: `linear-gradient(120deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)`, color: '#fff', ...body, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' };

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

const SOURCE_CONFIG = {
    admin:   { label: 'Admin'   },
    officer: { label: 'Officer' },
};

const SOURCE_TABS = [
    { key: 'all',     label: 'All Senders' },
    { key: 'admin',   label: 'Admin'       },
    { key: 'officer', label: 'Officer'     },
];

// ─── Priority Config ─────────────────────────────────────────────────────
const PRIORITY_CONFIG = {
    critical:  { color: CLAY,  label: 'Critical'  },
    important: { color: AMBER, label: 'Important' },
    info:      { color: SAGE,  label: 'Info'      },
};

function PriorityIcon({ priority, size = 14 }) {
    if (priority === 'critical')  return <AlertCircle  size={size} />;
    if (priority === 'important') return <AlertTriangle size={size} />;
    return <Info size={size} />;
}

// Compact priority badge with icon
function PriorityBadge({ priority }) {
    const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.info;
    return (
        <span
            className="inline-flex items-center gap-1.5 flex-shrink-0"
            style={{ ...body, fontSize: '0.72rem', fontWeight: 700, color: cfg.color, background: `${cfg.color}14`, border: `1px solid ${cfg.color}33`, padding: '3px 9px', borderRadius: 999 }}
        >
            <PriorityIcon priority={priority} size={12} />
            {cfg.label}
        </span>
    );
}

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
                className="flex items-center justify-between"
                style={{ ...fieldBase, cursor: 'pointer', color: value.length ? INK : MUTED, textAlign: 'left' }}
            >
                <span className="truncate">{displayLabel()}</span>
                <ChevronDown size={14} style={{ color: MUTED, flexShrink: 0, marginLeft: 8 }} />
            </button>
            {open && (
                <>
                    <div className="absolute z-50 top-full left-0 right-0 mt-2 overflow-auto" style={{ maxHeight: 260, background: CARD, border: `1px solid ${RULE}`, borderRadius: 10, boxShadow: '0 12px 28px -14px rgba(36,21,18,0.35)' }}>
                        {AUDIENCE_GROUPS.map(group => (
                            <div key={group.label}>
                                <p style={{ ...mono, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTED, padding: '10px 14px 4px' }}>{group.label}</p>
                                {group.options.map(opt => {
                                    const selected = value.includes(opt.value);
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => toggle(opt.value)}
                                            className="w-full flex items-center gap-2.5 transition-colors hover:bg-[#F6EFE4]"
                                            style={{ padding: '9px 14px', textAlign: 'left', ...body, fontSize: '0.875rem', color: INK, border: 'none', background: 'none', cursor: 'pointer' }}
                                        >
                                            <span className="flex items-center justify-center flex-shrink-0" style={{ width: 15, height: 15, borderRadius: 3, border: `1.5px solid ${selected ? MAROON : RULE}`, background: selected ? MAROON : '#fff' }}>
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

// ─── Create Modal ───────────────────────────────────────────────────────────

function CreateModal({ authorName, onClose, onCreated }) {
    const [title,       setTitle]       = useState('');
    const [content,     setContent]     = useState('');
    const [priority,    setPriority]    = useState('info');
    const [targetRoles, setTargetRoles] = useState(['scholar']);
    const [levels,      setLevels]      = useState([]);
    const [error,       setError]       = useState('');
    const [submitting,  setSubmitting]  = useState(false);
    const authorId = localStorage.getItem('id') || localStorage.getItem('user_id') || null;

    const toggleRole = (role) => {
        setTargetRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
    };

    const handleSubmit = async () => {
        if (!title.trim())      { setError('Title is required.');          return; }
        if (!content.trim())    { setError('Content is required.');        return; }
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
            });
            onCreated();
            onClose();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Failed to post announcement. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden" style={{ background: 'rgba(36,21,18,0.5)' }}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-announcement-title"
                className="w-full max-w-lg overflow-y-auto"
                style={{ maxHeight: 'calc(100vh - 32px)', background: CARD, borderRadius: 16, border: `1px solid ${RULE}`, boxShadow: '0 24px 60px -24px rgba(36,21,18,0.55)' }}
            >
                <div className="flex items-start justify-between gap-3 sticky top-0 z-10" style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${RULE}`, background: CARD, borderRadius: '16px 16px 0 0' }}>
                    <div className="min-w-0">
                        <p style={{ ...mono, fontSize: '0.64rem', color: GOLD, fontWeight: 700, letterSpacing: '0.06em' }}>PRESS RUN ORDER</p>
                        <h3 id="create-announcement-title" style={{ ...display, fontSize: '1.15rem', fontWeight: 600, color: INK, marginTop: 2 }}>New Announcement</h3>
                        <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 3 }}>Circulate to scholars and/or staff</p>
                    </div>
                    <button onClick={onClose} aria-label="Close" style={{ padding: 8, borderRadius: 8, border: 'none', background: 'none', color: MUTED, cursor: 'pointer' }}>
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-5" style={{ padding: 24 }}>
                    <div>
                        <label style={fieldLabel}>Headline *</label>
                        <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                            placeholder="e.g. Deadline Reminder for Grade Submission"
                            style={fieldBase} />
                    </div>

                    <div>
                        <label style={fieldLabel}>Priority Stamp *</label>
                        <div className="flex gap-2">
                            {['info', 'important', 'critical'].map(p => {
                                const cfg = PRIORITY_CONFIG[p];
                                const active = priority === p;
                                return (
                                    <button key={p} type="button" onClick={() => setPriority(p)}
                                        className="flex-1 flex items-center justify-center gap-1.5"
                                        style={{ height: 40, borderRadius: 10, ...body, fontSize: '0.76rem', fontWeight: 700, background: active ? `${cfg.color}14` : '#fff', color: active ? cfg.color : MUTED, border: `1px solid ${active ? cfg.color : RULE}`, cursor: 'pointer' }}>
                                        <PriorityIcon priority={p} size={13} />
                                        {cfg.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label style={fieldLabel}>Circulation *</label>
                        <div className="flex gap-2">
                            {ROLE_OPTIONS.map(opt => {
                                const active = targetRoles.includes(opt.value);
                                return (
                                    <button key={opt.value} type="button" onClick={() => toggleRole(opt.value)}
                                        className="flex-1 flex items-center justify-center gap-1.5"
                                        style={{ height: 40, borderRadius: 10, ...body, fontSize: '0.76rem', fontWeight: 700, background: active ? MAROON : '#fff', color: active ? '#fff' : MUTED, border: `1px solid ${active ? MAROON : RULE}`, cursor: 'pointer' }}>
                                        <Users size={13} />
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {targetRoles.includes('scholar') && (
                        <div>
                            <label style={fieldLabel}>
                                Scholar Year Level <span style={{ color: MUTED, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional — leave blank for all)</span>
                            </label>
                            <LevelSelector value={levels} onChange={setLevels} />
                            {levels.length > 0 && (
                                <div className="flex flex-wrap gap-1.5" style={{ marginTop: 8 }}>
                                    {levels.map(a => (
                                        <span key={a} className="flex items-center gap-1" style={{ ...body, fontSize: '0.72rem', fontWeight: 600, padding: '3px 9px', border: `1px solid ${MAROON}55`, color: MAROON, borderRadius: 999 }}>
                                            {getLevelLabel(a)}
                                            <button type="button" aria-label={`Remove ${getLevelLabel(a)}`} onClick={() => setLevels(levels.filter(v => v !== a))}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: MAROON, display: 'flex' }}>
                                                <X size={10} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div>
                        <label style={fieldLabel}>Copy *</label>
                        <textarea value={content} onChange={e => setContent(e.target.value)}
                            placeholder="Write your announcement here…" rows={4}
                            style={{ width: '100%', padding: '10px 12px', border: `1px solid ${RULE}`, borderRadius: 10, background: '#fff', ...body, fontSize: '0.875rem', color: INK, outline: 'none', resize: 'none' }} />
                    </div>

                    <p style={{ ...mono, fontSize: '0.72rem', color: MUTED }}>
                        Filed by <span style={{ color: MAROON, fontWeight: 700 }}>{authorName}</span>
                    </p>

                    {error && (
                        <p role="alert" style={{ ...body, fontSize: '0.8rem', fontWeight: 600, color: CLAY, borderLeft: `3px solid ${CLAY}`, padding: '8px 12px', background: `${CLAY}0d`, borderRadius: '0 8px 8px 0' }}>{error}</p>
                    )}
                </div>

                <div className="flex gap-3" style={{ padding: '18px 24px', borderTop: `1px solid ${RULE}` }}>
                    <button onClick={onClose} style={{ ...outlineBtn, flex: 1 }}>Cancel</button>
                    <button onClick={handleSubmit} disabled={submitting}
                        style={{ ...filledBtn, flex: 1, opacity: submitting ? 0.6 : 1 }}>
                        <Send size={13} />
                        {submitting ? 'Publishing…' : 'Publish Bulletin'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Announcement Card — compact management row ─────────────────────────────

function AnnouncementCard({ ann, isLatest, onNotify, notifyingId }) {
    const levels = ann.target_levels || [];
    const roles  = ann.target_roles || [];
    const src    = SOURCE_CONFIG[ann.created_by_role];
    const isNotifying = notifyingId === ann.id;
    const postedDate = ann.created_at
        ? new Date(ann.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
        : '';

    return (
        <article className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-5" style={{ padding: '18px 22px', borderTop: `1px solid ${RULE}` }}>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 8 }}>
                    <PriorityBadge priority={ann.priority} />
                    {isLatest && (
                        <span style={{ ...mono, fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: MAROON, color: '#fff', padding: '3px 9px', borderRadius: 999 }}>Latest Edition</span>
                    )}
                    {src && (
                        <span style={{ ...mono, fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: BG, color: MUTED, padding: '3px 9px', borderRadius: 999 }}>
                            {src.label} Desk
                        </span>
                    )}
                </div>

                <h4 className="break-words" style={{ ...display, fontSize: '1.05rem', fontWeight: 600, color: INK, lineHeight: 1.3 }}>{ann.title}</h4>
                <p className="break-words" style={{ ...body, fontSize: '0.84rem', color: '#6b6058', lineHeight: 1.6, marginTop: 4, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{ann.content}</p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5" style={{ marginTop: 12 }}>
                    <span className="inline-flex items-center gap-1.5" style={{ ...mono, fontSize: '0.66rem', color: MUTED }}>
                        <Clock size={12} /> {postedDate}
                    </span>
                    <span className="inline-flex items-center gap-1.5 min-w-0" style={{ ...body, fontSize: '0.74rem', color: '#8a7a70' }}>
                        <User size={12} style={{ flexShrink: 0 }} />
                        <span className="truncate">
                            {ann.created_by_name || ann.created_by || 'Unknown'}{ann.created_by_role ? ` (${ann.created_by_role})` : ''}
                        </span>
                    </span>
                </div>

                {(roles.length > 0 || (roles.includes('scholar') && levels.length > 0)) && (
                    <div className="flex flex-wrap gap-1.5" style={{ marginTop: 10 }}>
                        {roles.map(r => (
                            <span key={r} className="inline-flex items-center gap-1 capitalize" style={{ ...mono, fontSize: '0.6rem', fontWeight: 700, border: `1px solid ${MAROON}55`, color: MAROON, padding: '2px 8px', borderRadius: 999 }}>
                                <Users size={9} /> To: {r}
                            </span>
                        ))}
                        {roles.includes('scholar') && levels.map(lv => (
                            <span key={lv} style={{ ...mono, fontSize: '0.6rem', fontWeight: 700, border: `1px solid ${RULE}`, color: MUTED, padding: '2px 8px', borderRadius: 999 }}>
                                {getLevelLabel(lv)}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex-shrink-0">
                <button
                    onClick={() => onNotify(ann.id)}
                    disabled={isNotifying}
                    style={{
                        height: 34, padding: '0 14px', border: `1px solid ${SAGE}88`, background: 'transparent', color: SAGE,
                        ...mono, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                        borderRadius: 8, cursor: isNotifying ? 'default' : 'pointer', opacity: isNotifying ? 0.5 : 1, whiteSpace: 'nowrap',
                    }}
                >
                    {isNotifying ? 'Circulating…' : 'Circulate'}
                </button>
            </div>
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

    const fetchAnnouncements = async () => {
        try {
            const res = await axios.get(`${API}/officer/announcements`);
            setAnnouncements(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAnnouncements(); }, []);

    const handleRefresh = () => {
        setLoading(true);
        fetchAnnouncements();
    };

    const handleNotifyAnnouncement = async (id) => {
        setNotifyError('');
        setNotifyMessage('');
        setNotifyingId(id);

        try {
            const res = await axios.post(`${API}/officer/announcements/${id}/notify`);
            const sentCount = res.data?.sent_count ?? 0;
            setNotifyMessage(`Notifications sent to ${sentCount} recipient(s).`);
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

    const counts = {
        critical:  announcements.filter(a => a.priority === 'critical').length,
        important: announcements.filter(a => a.priority === 'important').length,
        total:     announcements.length,
    };

    const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

    const summaryCards = [
        { label: 'Total Announcements', value: counts.total,     color: MAROON, Icon: Megaphone },
        { label: 'Critical',            value: counts.critical,  color: CLAY,   Icon: AlertCircle },
        { label: 'Important',           value: counts.important, color: AMBER,  Icon: AlertTriangle },
    ];

    return (
        <div className="min-h-screen p-4 sm:p-6 overflow-x-hidden" style={{ ...body, background: BG }}>

            {/* Standard Officer header */}
            <div className="flex flex-col lg:flex-row gap-4 mb-4">
                <div className="flex-1 min-w-0" style={{ ...surface, padding: '22px 26px' }}>
                    <span style={{ ...mono, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD }}>Officer Portal</span>
                    <h1 style={{ ...display, fontSize: '2rem', fontWeight: 700, color: MAROON, letterSpacing: '-0.01em', lineHeight: 1.15, marginTop: 4 }}>Announcements</h1>
                    <p style={{ ...body, fontSize: '0.9rem', color: '#6b6058', marginTop: 6 }}>Create and manage announcements for scholars and staff.</p>
                </div>
                <div className="flex items-center gap-3.5 lg:w-72 flex-shrink-0" style={{ ...surface, padding: '22px 24px' }}>
                    <div className="flex items-center justify-center flex-shrink-0" style={{ width: 44, height: 44, borderRadius: 12, background: BG, color: MAROON }}>
                        <Calendar size={20} />
                    </div>
                    <div className="min-w-0">
                        <p style={{ ...body, fontSize: '0.7rem', color: MUTED }}>Today</p>
                        <p style={{ ...body, fontSize: '0.95rem', fontWeight: 600, color: INK, marginTop: 2 }}>{todayLabel}</p>
                    </div>
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                {summaryCards.map(({ label, value, color, Icon }) => (
                    <div key={label} className="flex items-center gap-4 h-full" style={{ ...surface, padding: '16px 20px' }}>
                        <div className="flex items-center justify-center flex-shrink-0" style={{ width: 44, height: 44, borderRadius: '50%', background: `${color}14`, color }}>
                            <Icon size={20} />
                        </div>
                        <div className="min-w-0">
                            <div style={{ ...display, fontSize: '1.6rem', fontWeight: 700, color: INK, lineHeight: 1 }}>{value}</div>
                            <div style={{ ...body, fontSize: '0.78rem', color: MUTED, marginTop: 5 }}>{label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Toolbar */}
            <div className="flex flex-col gap-4 mb-4" style={{ ...surface, padding: 16 }}>
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0" style={{ ...fieldBase, padding: '0 12px' }}>
                        <Search size={14} style={{ color: MUTED, flexShrink: 0 }} />
                        <input type="text" aria-label="Search announcements" placeholder="Search announcements…" value={search} onChange={e => setSearch(e.target.value)}
                            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none', ...body, fontSize: '0.875rem', color: INK }} />
                    </div>
                    <select aria-label="Filter by priority" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
                        className="md:w-48" style={{ ...fieldBase, cursor: 'pointer' }}>
                        <option value="all">All Priorities</option>
                        <option value="critical">Critical</option>
                        <option value="important">Important</option>
                        <option value="info">Info</option>
                    </select>
                    <button onClick={handleRefresh} disabled={loading} style={{ ...outlineBtn, opacity: loading ? 0.6 : 1 }}>
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                    <button onClick={() => setShowModal(true)} style={filledBtn}>
                        <Plus size={14} /> New Announcement
                    </button>
                </div>

                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by sender">
                    {SOURCE_TABS.map(f => {
                        const active = sourceFilter === f.key;
                        return (
                            <button key={f.key} role="tab" aria-selected={active} onClick={() => setSourceFilter(f.key)}
                                style={{
                                    height: 36, padding: '0 16px', cursor: 'pointer', borderRadius: 10,
                                    ...body, fontSize: '0.82rem', fontWeight: active ? 600 : 500,
                                    color: active ? '#fff' : MUTED,
                                    background: active ? `linear-gradient(120deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)` : 'transparent',
                                    border: `1px solid ${active ? 'transparent' : RULE}`,
                                }}>
                                {f.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {notifyMessage && (
                <div role="status" style={{ marginBottom: 16, borderLeft: `3px solid ${SAGE}`, background: `${SAGE}12`, padding: '10px 16px', borderRadius: '0 10px 10px 0', ...body, fontSize: '0.8rem', fontWeight: 600, color: SAGE }}>
                    {notifyMessage}
                </div>
            )}
            {notifyError && (
                <div role="alert" style={{ marginBottom: 16, borderLeft: `3px solid ${CLAY}`, background: `${CLAY}12`, padding: '10px 16px', borderRadius: '0 10px 10px 0', ...body, fontSize: '0.8rem', fontWeight: 600, color: CLAY }}>
                    {notifyError}
                </div>
            )}

            {/* Announcement list */}
            <div style={{ ...surface, overflow: 'hidden' }}>
                <div className="flex items-center justify-between gap-3" style={{ padding: '16px 22px' }}>
                    <div className="min-w-0">
                        <h2 style={{ ...display, fontSize: '1.1rem', fontWeight: 600, color: MAROON }}>Announcement List</h2>
                        <p style={{ ...body, fontSize: '0.78rem', color: MUTED, marginTop: 2 }}>View and manage all announcements posted to scholars and staff.</p>
                    </div>
                    {!loading && (
                        <span className="flex-shrink-0" style={{ ...mono, fontSize: '0.68rem', color: MUTED }}>
                            {filtered.length} of {announcements.length}
                        </span>
                    )}
                </div>

                {loading ? (
                    <div>
                        {Array(3).fill(0).map((_, i) => (
                            <div key={i} className="animate-pulse" style={{ padding: '18px 22px', borderTop: `1px solid ${RULE}` }}>
                                <div style={{ background: `${RULE}99`, height: 18, width: 80, borderRadius: 999, marginBottom: 10 }} />
                                <div style={{ background: `${RULE}99`, height: 16, width: '45%', borderRadius: 6, marginBottom: 8 }} />
                                <div style={{ background: `${RULE}66`, height: 12, width: '80%', borderRadius: 6 }} />
                            </div>
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center" style={{ borderTop: `1px solid ${RULE}`, padding: '56px 20px' }}>
                        <Megaphone size={34} style={{ margin: '0 auto 14px', color: RULE }} />
                        <p style={{ ...body, fontSize: '0.88rem', fontWeight: 600, color: MUTED }}>No announcements found.</p>
                    </div>
                ) : (
                    <div>
                        {filtered.map((ann, idx) => (
                            <AnnouncementCard key={ann.id} ann={ann} isLatest={idx === 0} onNotify={handleNotifyAnnouncement} notifyingId={notifyingId} />
                        ))}
                    </div>
                )}
            </div>

            {showModal && (
                <CreateModal authorName={officerName} onClose={() => setShowModal(false)} onCreated={fetchAnnouncements} />
            )}
        </div>
    );
};

export default OfficerAnnouncement;