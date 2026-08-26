import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Megaphone, Clock, Search, Plus, X, Send,
    ChevronDown, Users, AlertCircle, AlertTriangle,
    Info, User,
} from 'lucide-react';

const API = 'http://localhost:5000/api';

// ── Token system — shared across the whole portal ──
const MAROON = '#7f2d3a';
const MAROON_DEEP = '#4f1620';
const GOLD = '#b98b4e';
const GOLD_LIGHT = '#d4af7a';
const IVORY = '#FBF7F2';
const INK = '#241512';
const SAGE = '#6b8f71';
const CLAY = '#c1666b';
const AMBER = '#b8863f';
const PAPER = '#F6EFE4';
const RULE = '#e8dccb';
const ROSE = '#F5E8EA';

const serif = { fontFamily: "'Playfair Display', serif" };
const sans = { fontFamily: "'DM Sans', sans-serif" };
const mono = { fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, monospace" };

// ─── Year Level Config (para lang sa Scholar narrowing) ─────────────────────
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

// ─── Priority Config — recolored onto the shared ledger palette ────────────
const PRIORITY_CONFIG = {
    critical:  { color: CLAY,  bg: `${CLAY}16`,  label: 'Critical'  },
    important: { color: AMBER, bg: `${AMBER}16`, label: 'Important' },
    info:      { color: SAGE,  bg: `${SAGE}16`,  label: 'Info'      },
};

function PriorityIcon({ priority, size = 14 }) {
    if (priority === 'critical')  return <AlertCircle  size={size} />;
    if (priority === 'important') return <AlertTriangle size={size} />;
    return <Info size={size} />;
}

// ─── Year Level Multi-select ─────────────────────────────────────────────────
function LevelSelector({ value, onChange }) {
    const [open, setOpen] = useState(false);

    const toggle = (val) => {
        onChange(value.includes(val) ? value.filter(v => v !== val) : [...value, val]);
    };

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
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg outline-none transition-colors"
                style={{ ...sans, fontSize: '0.85rem', border: `1px solid ${RULE}`, background: PAPER, cursor: 'pointer' }}
            >
                <span style={{ color: value.length ? INK : '#c9b9b0' }}>{displayLabel()}</span>
                <ChevronDown size={14} style={{ color: '#a89890', flexShrink: 0, marginLeft: 8 }} />
            </button>

            {open && (
                <>
                    <div className="absolute z-50 top-full left-0 right-0 mt-1.5 overflow-auto rounded-xl" style={{ maxHeight: 260, background: '#fff', border: `1px solid ${RULE}`, boxShadow: '0 16px 40px -20px rgba(36,21,18,0.35)' }}>
                        {AUDIENCE_GROUPS.map(group => (
                            <div key={group.label}>
                                <p style={{ ...sans, fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#a89890', padding: '10px 12px 4px' }}>{group.label}</p>
                                {group.options.map(opt => {
                                    const selected = value.includes(opt.value);
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => toggle(opt.value)}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[#f6efe4]"
                                            style={{ ...sans, fontSize: '0.82rem', color: INK, background: 'none', border: 'none', cursor: 'pointer' }}
                                        >
                                            <span
                                                className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center"
                                                style={{ border: `1.5px solid ${selected ? MAROON : RULE}`, backgroundColor: selected ? MAROON : '#fff' }}
                                            >
                                                {selected && (
                                                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(20,10,12,0.5)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-lg rounded-xl overflow-hidden" style={{ background: '#fff', boxShadow: '0 20px 60px -20px rgba(36,21,18,0.4)' }}>

                <div style={{ height: 4, background: `linear-gradient(90deg, ${MAROON} 0%, ${GOLD} 100%)` }} />
                <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ background: ROSE, borderBottom: `1px solid ${RULE}` }}>
                    <div>
                        <h2 style={{ ...serif, fontSize: '1.1rem', fontWeight: 700, color: MAROON }}>New Announcement</h2>
                        <p style={{ ...sans, fontSize: '0.72rem', color: '#a56475', marginTop: 2 }}>Post to scholars and/or staff</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg transition-colors hover:bg-white/60" style={{ color: '#a56475', border: 'none', background: 'none', cursor: 'pointer' }}>
                        <X size={16} />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">

                    <div>
                        <label style={{ ...sans, fontSize: '0.62rem', fontWeight: 800, color: MAROON, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>Title *</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g. Deadline Reminder for Grade Submission"
                            className="w-full outline-none transition-colors"
                            style={{ ...sans, fontSize: '0.85rem', background: PAPER, border: `1px solid ${RULE}`, padding: '11px 14px', borderRadius: 10, color: INK }}
                        />
                    </div>

                    <div>
                        <label style={{ ...sans, fontSize: '0.62rem', fontWeight: 800, color: MAROON, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>Priority *</label>
                        <div className="flex gap-2">
                            {['info', 'important', 'critical'].map(p => {
                                const cfg    = PRIORITY_CONFIG[p];
                                const active = priority === p;
                                return (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setPriority(p)}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors capitalize"
                                        style={{ ...sans, fontSize: '0.76rem', fontWeight: 700, background: active ? cfg.bg : '#fff', color: active ? cfg.color : '#a89890', border: `1px solid ${active ? cfg.color + '66' : RULE}`, cursor: 'pointer' }}
                                    >
                                        <PriorityIcon priority={p} size={13} />
                                        {cfg.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Audience — role checkboxes */}
                    <div>
                        <label style={{ ...sans, fontSize: '0.62rem', fontWeight: 800, color: MAROON, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>Audience *</label>
                        <div className="flex gap-2">
                            {ROLE_OPTIONS.map(opt => {
                                const active = targetRoles.includes(opt.value);
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => toggleRole(opt.value)}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg transition-colors"
                                        style={{
                                            ...sans, fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer',
                                            background:  active ? MAROON : '#fff',
                                            color:       active ? '#fff' : '#a89890',
                                            border: `1px solid ${active ? MAROON : RULE}`,
                                        }}
                                    >
                                        <Users size={13} />
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Year level narrowing — lalabas lang kung kasama ang Scholars */}
                    {targetRoles.includes('scholar') && (
                        <div>
                            <label style={{ ...sans, fontSize: '0.62rem', fontWeight: 800, color: MAROON, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>
                                Scholar Year Level <span style={{ color: '#c9b9b0', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(optional — leave blank for all)</span>
                            </label>
                            <LevelSelector value={levels} onChange={setLevels} />
                            {levels.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {levels.map(a => (
                                        <span key={a} className="flex items-center gap-1 rounded-full" style={{ ...sans, fontSize: '0.62rem', fontWeight: 700, padding: '3px 9px', background: ROSE, color: MAROON }}>
                                            {getLevelLabel(a)}
                                            <button type="button" onClick={() => setLevels(levels.filter(v => v !== a))}
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
                        <label style={{ ...sans, fontSize: '0.62rem', fontWeight: 800, color: MAROON, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>Message *</label>
                        <textarea
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            placeholder="Write your announcement here..."
                            rows={4}
                            className="w-full outline-none resize-none transition-colors"
                            style={{ ...sans, fontSize: '0.85rem', background: PAPER, border: `1px solid ${RULE}`, padding: '11px 14px', borderRadius: 10, color: INK }}
                        />
                    </div>

                    <div className="flex items-center gap-2 rounded-lg" style={{ background: PAPER, padding: '10px 14px', ...sans, fontSize: '0.76rem', color: '#a89890' }}>
                        <User size={12} />
                        <span>Posting as <span style={{ fontWeight: 700, color: MAROON }}>{authorName}</span></span>
                    </div>

                    {error && (
                        <p className="rounded-lg" style={{ ...sans, fontSize: '0.76rem', fontWeight: 700, color: CLAY, background: `${CLAY}12`, padding: '10px 14px' }}>{error}</p>
                    )}
                </div>

                <div className="px-6 pb-6 pt-4 flex gap-3" style={{ borderTop: `1px solid ${RULE}` }}>
                    <button onClick={onClose} className="flex-1 py-3 rounded-full transition-colors hover:bg-[#f6efe4]"
                        style={{ ...sans, fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', border: `1.5px solid ${RULE}`, color: '#8a7a70', background: '#fff', cursor: 'pointer' }}>
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="flex-1 py-3 rounded-full transition-opacity hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-60"
                        style={{ ...sans, fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', background: MAROON, color: '#fff', border: 'none', cursor: submitting ? 'default' : 'pointer' }}
                    >
                        <Send size={12} />
                        {submitting ? 'Posting...' : 'Post Announcement'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Announcement Card — a pinned notice, corkboard style ───────────────────

function AnnouncementCard({ ann, isLatest, onNotify, notifyingId }) {
    const cfg    = PRIORITY_CONFIG[ann.priority] || PRIORITY_CONFIG.info;
    const levels = ann.target_levels || [];
    const roles  = ann.target_roles || [];
    const src    = SOURCE_CONFIG[ann.created_by_role];

    return (
        <div className="relative rounded-xl overflow-hidden" style={{ background: '#fff', border: `1px solid ${RULE}`, marginTop: 6 }}>
            {/* corkboard pin — this card's signature touch */}
            <div className="absolute rounded-full" style={{ top: -6, left: 22, width: 12, height: 12, background: `radial-gradient(circle at 35% 30%, ${GOLD_LIGHT}, ${GOLD})`, boxShadow: '0 2px 4px rgba(36,21,18,0.3)', border: '1px solid #fff' }} />
            {/* priority ribbon */}
            <div className="absolute left-0 top-0 bottom-0" style={{ width: 4, background: cfg.color }} />

            <div className="pl-6 pr-5 py-4">
                <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg mt-0.5 flex-shrink-0" style={{ background: cfg.bg, color: cfg.color }}>
                        <PriorityIcon priority={ann.priority} size={14} />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                            {isLatest && (
                                <span className="rounded-full" style={{ ...sans, fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', background: MAROON, color: '#fff', padding: '2px 8px' }}>Latest</span>
                            )}
                            <span className="rounded-full capitalize" style={{ ...sans, fontSize: '0.6rem', fontWeight: 800, background: cfg.bg, color: cfg.color, padding: '2px 8px' }}>
                                {cfg.label}
                            </span>
                            {src && (
                                <span className="rounded-full uppercase" style={{ ...sans, fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.06em', background: PAPER, color: '#a89890', padding: '2px 8px' }}>
                                    {src.label}
                                </span>
                            )}
                        </div>

                        <h4 style={{ ...serif, fontSize: '0.98rem', fontWeight: 700, color: INK, marginBottom: 4 }}>{ann.title}</h4>
                        <p style={{ ...sans, fontSize: '0.8rem', color: '#6b6058', lineHeight: 1.6 }}>{ann.content}</p>

                        <div className="flex flex-wrap gap-1.5 mt-3">
                            {roles.map(r => (
                                <span key={r} className="rounded-full flex items-center gap-1 capitalize" style={{ ...sans, fontSize: '0.6rem', fontWeight: 700, background: ROSE, color: MAROON, padding: '2px 8px' }}>
                                    <Users size={9} /> {r}
                                </span>
                            ))}
                            {roles.includes('scholar') && levels.length > 0 && levels.map(lv => (
                                <span key={lv} className="rounded-full" style={{ ...sans, fontSize: '0.6rem', fontWeight: 700, background: PAPER, color: '#a89890', padding: '2px 8px' }}>
                                    {getLevelLabel(lv)}
                                </span>
                            ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${RULE}` }}>
                            <Clock size={10} style={{ color: '#c9b9b0' }} />
                            <span style={{ ...mono, fontSize: '0.62rem', color: '#c9b9b0' }}>
                                {new Date(ann.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </span>
                            <span style={{ color: '#e8dccb' }}>•</span>
                            <span style={{ ...sans, fontSize: '0.62rem', fontWeight: 800, color: MAROON, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Announced by {ann.created_by_name || ann.created_by || 'Unknown'}{ann.created_by_role ? ` (${ann.created_by_role})` : ''}</span>
                            <button
                                onClick={() => onNotify(ann.id)}
                                disabled={notifyingId === ann.id}
                                className="ml-auto rounded-full transition-opacity hover:opacity-85 disabled:opacity-50"
                                style={{ ...sans, fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', background: `${SAGE}18`, color: SAGE, padding: '4px 10px', border: 'none', cursor: notifyingId === ann.id ? 'default' : 'pointer' }}
                            >
                                {notifyingId === ann.id ? 'Sending...' : 'Notify'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
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

    return (
        <div className="min-h-screen" style={{ background: IVORY, ...sans }}>

            {/* ── Ledger header band — same family as the rest of the portal ── */}
            <div className="relative overflow-hidden px-5 sm:px-8 pt-8 pb-11" style={{ background: `linear-gradient(135deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)` }}>
                <svg className="absolute -right-6 -top-10 w-56 h-56 opacity-[0.12] pointer-events-none" viewBox="0 0 200 200" fill="none">
                    <path d="M40 90 Q40 60 80 55 L155 45 Q165 44 165 54 L165 130 Q165 140 155 139 L80 129 Q40 124 40 94 Z" fill={GOLD} />
                    <circle cx="165" cy="92" r="10" fill={GOLD} />
                </svg>
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ border: `1.5px solid ${GOLD}` }}>
                        <Megaphone size={12} style={{ color: GOLD }} />
                    </div>
                    <span style={{ ...sans, fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.28em', textTransform: 'uppercase', color: GOLD_LIGHT }}>Officer Portal</span>
                </div>
                <div className="flex items-end justify-between gap-4 flex-wrap">
                    <div>
                        <h1 style={{ ...serif, fontSize: '2rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>Communication</h1>
                        <p style={{ ...sans, fontSize: '0.82rem', color: '#e9c9a8', marginTop: 4 }}>Post to scholars &amp; staff, and view announcements sent to you.</p>
                    </div>
                    <button onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full transition-colors hover:opacity-90 flex-shrink-0"
                        style={{ ...sans, fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.04em', background: GOLD, color: MAROON_DEEP, border: 'none', cursor: 'pointer' }}>
                        <Plus size={15} /> New
                    </button>
                </div>
            </div>

            <div className="relative z-10 px-5 sm:px-8 -mt-6 pb-10">

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-3.5 mb-6">
                    {[
                        { label: 'Critical', value: counts.critical, color: CLAY },
                        { label: 'Important', value: counts.important, color: AMBER },
                        { label: 'Total', value: counts.total, color: MAROON },
                    ].map(({ label, value, color }) => (
                        <div key={label} className="rounded-xl p-4 text-center" style={{ background: '#fff', border: `1px solid ${RULE}`, boxShadow: '0 8px 24px -16px rgba(36,21,18,0.25)' }}>
                            <p style={{ ...serif, fontSize: '1.7rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</p>
                            <p style={{ ...sans, fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a89890', marginTop: 6 }}>{label}</p>
                        </div>
                    ))}
                </div>

                {/* Search + Priority Dropdown */}
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <div className="relative flex-1">
                        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#c9b9b0' }} />
                        <input
                            type="text"
                            placeholder="Search announcements..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 rounded-full outline-none bg-white"
                            style={{ ...sans, fontSize: '0.82rem', border: `1px solid ${RULE}`, color: INK }}
                        />
                    </div>

                    <div className="relative sm:w-52 shrink-0">
                        <select
                            value={priorityFilter}
                            onChange={e => setPriorityFilter(e.target.value)}
                            className="w-full appearance-none pl-4 pr-9 py-2.5 rounded-full outline-none bg-white"
                            style={{ ...sans, fontSize: '0.82rem', fontWeight: 700, border: `1px solid ${RULE}`, color: priorityFilter === 'all' ? INK : PRIORITY_CONFIG[priorityFilter]?.color, cursor: 'pointer' }}
                        >
                            <option value="all">All Priorities</option>
                            <option value="critical">Critical</option>
                            <option value="important">Important</option>
                            <option value="info">Info</option>
                        </select>
                        <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#a89890' }} />
                    </div>
                </div>

                {notifyMessage && (
                    <div className="mb-4 rounded-lg px-4 py-2.5" style={{ background: `${SAGE}14`, border: `1px solid ${SAGE}45`, ...sans, fontSize: '0.78rem', fontWeight: 700, color: SAGE }}>
                        {notifyMessage}
                    </div>
                )}
                {notifyError && (
                    <div className="mb-4 rounded-lg px-4 py-2.5" style={{ background: `${CLAY}12`, border: `1px solid ${CLAY}45`, ...sans, fontSize: '0.78rem', fontWeight: 700, color: CLAY }}>
                        {notifyError}
                    </div>
                )}

                {/* Sender Filter */}
                <div className="flex gap-2 mb-6 flex-wrap">
                    {SOURCE_TABS.map(f => (
                        <button
                            key={f.key}
                            onClick={() => setSourceFilter(f.key)}
                            className="rounded-full transition-colors capitalize"
                            style={{
                                ...sans, fontSize: '0.72rem', fontWeight: 700, padding: '7px 16px', cursor: 'pointer',
                                background:  sourceFilter === f.key ? MAROON : '#fff',
                                color:       sourceFilter === f.key ? '#fff' : '#8a7a70',
                                border: `1px solid ${sourceFilter === f.key ? MAROON : RULE}`,
                            }}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="space-y-4">
                        {Array(3).fill(0).map((_, i) => (
                            <div key={i} className="animate-pulse rounded-xl h-28" style={{ background: '#EFE7E2' }} />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="rounded-xl p-16 text-center" style={{ background: '#fff', border: `1px dashed ${RULE}` }}>
                        <Megaphone size={40} className="mx-auto mb-3" style={{ color: '#e9d9dc' }} />
                        <p style={{ ...sans, fontSize: '0.85rem', fontWeight: 700, color: '#c9b3b8' }}>No announcements found.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filtered.map((ann, idx) => (
                            <AnnouncementCard key={ann.id} ann={ann} isLatest={idx === 0} onNotify={handleNotifyAnnouncement} notifyingId={notifyingId} />
                        ))}
                    </div>
                )}

                {showModal && (
                    <CreateModal
                        authorName={officerName}
                        onClose={() => setShowModal(false)}
                        onCreated={fetchAnnouncements}
                    />
                )}
            </div>
        </div>
    );
};

export default OfficerAnnouncement;