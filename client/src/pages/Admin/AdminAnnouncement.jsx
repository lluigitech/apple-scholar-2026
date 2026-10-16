import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Trash2, ToggleRight, Clock, Users,
    ChevronDown, X, Search, Send, RefreshCw,
    Archive, SlidersHorizontal, Megaphone, AlertCircle, AlertTriangle, Info, List,
} from 'lucide-react';
import { formatAdminDate } from '../../utils/adminPreferences';
import AdminPageHeader from '../../components/Admin/AdminPageHeader';

const API_BASE = (import.meta.env?.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
const authHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
});

// ── Design tokens — single source of truth for this page ──
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const PRIMARY = '#6D2140';
const PRIMARY_DEEP = '#4A1730';
const PRIMARY_TINT = 'rgba(109, 33, 64, 0.08)';
const INK = '#241512';
const MUTED = '#8A7A68';
const BRONZE = '#A9784E';
const SUCCESS = '#6B8F71';
const SUCCESS_TINT = 'rgba(107,143,113,.12)';
const WARNING = '#C08A3E';
const WARNING_TINT = 'rgba(192,138,62,.12)';
const DANGER = '#A24A4A';
const DANGER_TINT = 'rgba(162,74,74,.12)';
const NEUTRAL_TINT = 'rgba(138,122,104,.12)';
const RADIUS = 16;
const SHADOW = '0 1px 2px rgba(74, 23, 48, 0.04), 0 6px 18px rgba(74, 23, 48, 0.04)';

const display = { fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };

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

const PRIORITY_ORDER = ['critical', 'important', 'info'];
const PRIORITY_CONFIG = {
    critical:  { color: DANGER,  tint: DANGER_TINT,  label: 'Critical',  icon: AlertTriangle },
    important: { color: WARNING, tint: WARNING_TINT, label: 'Important', icon: AlertCircle   },
    info:      { color: MUTED,   tint: NEUTRAL_TINT, label: 'Info',      icon: Info          },
};
const cfgFor = (p) => PRIORITY_CONFIG[p] || PRIORITY_CONFIG.info;

const ROLE_OPTIONS = [
    { value: 'scholar', label: 'Scholars' },
    { value: 'staff',   label: 'Staff'    },
    { value: 'officer', label: 'Officers' },
];

const formatDate = (d) => formatAdminDate(d, { month: 'short' });

const labelStyle = {
    ...body,
    display: 'block',
    fontSize: '0.74rem',
    fontWeight: 600,
    color: MUTED,
};

const fieldStyle = {
    ...body,
    fontSize: '0.85rem',
    color: INK,
    background: SURFACE,
    border: `1px solid ${BORDER}`,
    borderRadius: 10,
    padding: '10px 13px',
    outline: 'none',
    width: '100%',
};

const cardStyle = { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: SHADOW };

const Skeleton = ({ style }) => (
    <div className="skeleton-pulse" style={{ background: '#EFE7D8', borderRadius: 8, ...style }} />
);

// Small section heading used inside the composer
const SectionLabel = ({ children }) => (
    <p style={{ ...body, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: BRONZE }}>{children}</p>
);

const IconBadge = ({ icon: Icon, color = PRIMARY, tint = PRIMARY_TINT, size = 40 }) => (
    <span className="flex items-center justify-center shrink-0" style={{ width: size, height: size, borderRadius: '50%', background: tint, color }}>
        <Icon size={Math.round(size * 0.45)} strokeWidth={2} />
    </span>
);

const Tick = ({ label, checked, onChange }) => (
    <button type="button" role="checkbox" aria-checked={checked} onClick={onChange}
        className="exec-focus flex items-center gap-2.5 select-none text-left"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
        <span className="w-[18px] h-[18px] rounded flex items-center justify-center shrink-0 transition-all"
            style={{ border: `2px solid ${checked ? PRIMARY : BORDER}`, background: checked ? PRIMARY : '#fff' }}>
            {checked && (
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={3.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
            )}
        </span>
        <span style={{ ...body, fontSize: '0.84rem', fontWeight: 500, color: INK }}>{label}</span>
    </button>
);

function LevelSelector({ value, onChange }) {
    const [open, setOpen] = useState(false);
    const toggle = (val) => onChange(value.includes(val) ? value.filter(v => v !== val) : [...value, val]);
    const displayLabel = () => {
        if (!value.length) return 'Any year level';
        if (value.length <= 2) return value.map(getLevelLabel).join(', ');
        return `${getLevelLabel(value[0])} +${value.length - 1} more`;
    };
    return (
        <div className="relative">
            <button type="button" onClick={() => setOpen(v => !v)}
                aria-haspopup="listbox" aria-expanded={open}
                className="exec-focus w-full flex items-center justify-between"
                style={{ ...fieldStyle, height: 44, color: value.length ? INK : MUTED, cursor: 'pointer' }}>
                <span className="truncate">{displayLabel()}</span>
                <ChevronDown size={14} style={{ color: MUTED, flexShrink: 0, marginLeft: 8 }} />
            </button>
            {open && (
                <>
                    <div className="absolute z-50 top-full left-0 right-0 mt-1.5 overflow-auto" style={{ maxHeight: 260, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, boxShadow: '0 16px 40px -18px rgba(36,21,18,0.35)' }}>
                        {AUDIENCE_GROUPS.map(group => (
                            <div key={group.label}>
                                <p className="px-3.5 pt-3 pb-1" style={{ ...body, fontSize: '0.68rem', fontWeight: 600, color: MUTED }}>{group.label}</p>
                                {group.options.map(opt => {
                                    const selected = value.includes(opt.value);
                                    return (
                                        <button key={opt.value} type="button" onClick={() => toggle(opt.value)}
                                            role="checkbox" aria-checked={selected}
                                            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors"
                                            style={{ ...body, fontSize: '0.82rem', color: INK, background: 'none', border: 'none', cursor: 'pointer' }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = BG}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                                            <span className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center" style={{ border: `1.5px solid ${selected ? PRIMARY : BORDER}`, backgroundColor: selected ? PRIMARY : '#fff' }}>
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

const AdminAnnouncement = () => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [priority, setPriority] = useState('info');
    const [targetRoles, setTargetRoles] = useState(['scholar', 'staff', 'officer']);
    const [targetLevels, setTargetLevels] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedAnn, setSelectedAnn] = useState(null);
    const [notifyingId, setNotifyingId] = useState(null);
    const [notifyMessage, setNotifyMessage] = useState('');
    const [notifyError, setNotifyError] = useState('');
    const [notifyFeedbackId, setNotifyFeedbackId] = useState(null); // which card the notify feedback belongs to

    const [search, setSearch] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('all');

    const createdBy = localStorage.getItem('id') || localStorage.getItem('user_id') || null;

    const fetchAnnouncements = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API}/admin/announcements`, authHeaders());
            setAnnouncements(res.data);
        } catch (err) {
            console.error('Error fetching announcements:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAnnouncements(); }, []);

    const toggleRole = (role) => {
        setTargetRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
    };

    const getAudienceLabel = (ann) => {
        const roles = ann.target_roles || [];
        if (roles.length === 3) return 'Everyone';
        return roles.map(r => ROLE_OPTIONS.find(o => o.value === r)?.label || r).join(', ');
    };

    const handleBroadcast = async () => {
        setError('');
        setSuccess('');

        if (!title.trim() || !content.trim()) {
            setError('Write a subject and a message before sending it out.');
            return;
        }
        if (!targetRoles.length) {
            setError('Pick at least one audience to route this to.');
            return;
        }

        try {
            setSubmitting(true);
            await axios.post(`${API}/admin/announcements`, {
                title,
                content,
                priority,
                target_roles: targetRoles,
                target_levels: targetRoles.includes('scholar') ? targetLevels : [],
                created_by: createdBy,
            }, authHeaders());
            setTitle('');
            setContent('');
            setPriority('info');
            setTargetRoles(['scholar', 'staff', 'officer']);
            setTargetLevels([]);
            setSuccess('Announcement published.');
            fetchAnnouncements();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.error || 'Could not publish this announcement.');
        } finally {
            setSubmitting(false);
        }
    };

    // UI-only: resets the composer fields to their initial values (no request is made)
    const handleClear = () => {
        setTitle('');
        setContent('');
        setPriority('info');
        setTargetRoles(['scholar', 'staff', 'officer']);
        setTargetLevels([]);
        setError('');
        setSuccess('');
    };

    const handleNotifyAnnouncement = async (id) => {
        setNotifyError('');
        setNotifyMessage('');
        setNotifyFeedbackId(id);
        setNotifyingId(id);

        try {
            const res = await axios.post(`${API}/admin/announcements/${id}/notify`, {}, authHeaders());
            const sentCount = res.data?.sent_count ?? 0;
            setNotifyMessage(`Sent to ${sentCount} recipient(s).`);
        } catch (err) {
            setNotifyError(err.response?.data?.error || 'Could not send notifications.');
        } finally {
            setNotifyingId(null);
        }
    };

    const handleDelete = async () => {
        try {
            await axios.delete(`${API}/admin/announcements/${selectedAnn.id}`, authHeaders());
            setShowDeleteModal(false);
            fetchAnnouncements();
        } catch (err) {
            console.error('Error deleting:', err);
        }
    };

    const handleToggle = async (id) => {
        try {
            await axios.put(`${API}/admin/announcements/${id}/toggle`, {}, authHeaders());
            fetchAnnouncements();
        } catch (err) {
            console.error('Error toggling:', err);
        }
    };

    const filtered = announcements.filter(ann => {
        const matchesSearch =
            ann.title.toLowerCase().includes(search.toLowerCase()) ||
            ann.content.toLowerCase().includes(search.toLowerCase());
        const matchesPriority = priorityFilter === 'all' || ann.priority === priorityFilter;
        return matchesSearch && matchesPriority;
    });

    const counts = {
        critical:  announcements.filter(a => a.priority === 'critical').length,
        important: announcements.filter(a => a.priority === 'important').length,
        total:     announcements.length,
    };
    counts.info = counts.total - counts.critical - counts.important;
    const activeCount = announcements.filter(a => a.is_active).length;

    const kpiCards = [
        { key: 'total',     label: 'Total',     value: counts.total,     icon: Megaphone,     color: PRIMARY,                    tint: PRIMARY_TINT },
        { key: 'critical',  label: 'Critical',  value: counts.critical,  icon: AlertTriangle, color: PRIORITY_CONFIG.critical.color,  tint: PRIORITY_CONFIG.critical.tint },
        { key: 'important', label: 'Important', value: counts.important, icon: AlertCircle,   color: PRIORITY_CONFIG.important.color, tint: PRIORITY_CONFIG.important.tint },
        { key: 'info',      label: 'Info',      value: counts.info,      icon: Info,          color: PRIORITY_CONFIG.info.color,      tint: PRIORITY_CONFIG.info.tint },
    ];

    return (
        <section className="min-h-full overflow-x-hidden" style={{ background: BG }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Inter:wght@400;500;600;700&display=swap');

                .exec-input:focus, .exec-select:focus, textarea:focus {
                    border-color: ${PRIMARY} !important;
                    box-shadow: 0 0 0 3px ${PRIMARY_TINT};
                }
                .exec-focus:focus-visible, .exec-switch:focus-visible {
                    outline: 2px solid ${PRIMARY};
                    outline-offset: 2px;
                    border-radius: 8px;
                }
                .exec-filter:focus-within { border-color: ${PRIMARY} !important; box-shadow: 0 0 0 3px ${PRIMARY_TINT}; }

                .ann-card { transition: box-shadow 200ms ease; }
                .ann-card:hover { box-shadow: 0 10px 24px -16px rgba(36,21,18,0.22); }

                .priority-pill { transition: all 150ms ease; cursor: pointer; }
                .priority-pill:focus-visible { outline: 2px solid ${PRIMARY}; outline-offset: 2px; }

                .refresh-btn:hover { background: ${PRIMARY_TINT}; }
                .action-link:hover { background: ${PRIMARY_TINT}; }
                .danger-link:hover { background: ${DANGER_TINT}; }

                .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

                .skeleton-pulse { animation: exec-pulse 1.4s ease-in-out infinite; }
                @keyframes exec-pulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
                @media (prefers-reduced-motion: reduce) { .skeleton-pulse { animation: none; } }
            `}</style>

            <div className="w-full px-4 sm:px-6 lg:px-8 flex flex-col" style={{ gap: 24 }}>

                <AdminPageHeader
                    title="Communication Center"
                    description="Create, publish, and manage announcements across Scholars, Staff, and Officers."
                    actions={
                    <div className="flex flex-wrap gap-3">
                        <div className="flex items-center gap-3 px-4 flex-1 sm:flex-none" style={{ ...cardStyle, borderRadius: RADIUS - 2, height: 60, minWidth: 180 }}>
                            <IconBadge icon={ToggleRight} color={SUCCESS} tint={SUCCESS_TINT} size={34} />
                            <div>
                                <p style={{ ...body, fontSize: '0.7rem', fontWeight: 600, color: MUTED }}>Active Broadcasts</p>
                                <p style={{ ...display, fontSize: '1.05rem', fontWeight: 700, color: INK, lineHeight: 1.2 }}>{loading ? '—' : activeCount}</p>
                            </div>
                        </div>
                    </div>
                            }
                        />

                {/* ── 2. KPI statistics ──────────────────────────────────── */}
                <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                    {loading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} style={{ ...cardStyle, padding: 20 }}>
                                <Skeleton style={{ width: '55%', height: 12 }} />
                                <Skeleton style={{ width: '35%', height: 28, marginTop: 14 }} />
                            </div>
                        ))
                    ) : (
                        kpiCards.map(({ key, label, value, icon: Icon, color, tint }) => (
                            <div key={key} className="min-w-0" style={{ ...cardStyle, padding: 20 }}>
                                <div className="flex items-center justify-between gap-3">
                                    <p style={{ ...body, fontSize: '0.8rem', fontWeight: 500, color: MUTED }}>{label}</p>
                                    <IconBadge icon={Icon} color={color} tint={tint} size={36} />
                                </div>
                                <p style={{ ...display, fontSize: '2rem', fontWeight: 700, color: INK, lineHeight: 1.1, marginTop: 14 }}>
                                    {value}
                                </p>
                            </div>
                        ))
                    )}
                </div>

                {/* ── Workspace: composer (40%) + list (60%) ─────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6 items-start">

                    {/* ── 3. Create announcement ────────────────────────── */}
                    {loading ? (
                        <div style={{ ...cardStyle, padding: 22 }}>
                            <Skeleton style={{ width: '60%', height: 18 }} />
                            <Skeleton style={{ width: '100%', height: 44, marginTop: 20 }} />
                            <Skeleton style={{ width: '100%', height: 110, marginTop: 14 }} />
                            <Skeleton style={{ width: '100%', height: 44, marginTop: 20 }} />
                        </div>
                    ) : (
                        <div className="min-w-0" style={{ ...cardStyle, padding: 22 }}>
                            <div className="flex items-center gap-3 pb-5" style={{ borderBottom: `1px solid ${BORDER}` }}>
                                <IconBadge icon={Megaphone} />
                                <div className="min-w-0">
                                    <h2 style={{ ...display, fontSize: '1.2rem', fontWeight: 700, color: INK }}>Create Announcement</h2>
                                    <p style={{ ...body, fontSize: '0.78rem', color: MUTED, marginTop: 2 }}>Send important updates to scholars, staff, and officers.</p>
                                </div>
                            </div>

                            {/* Announcement details */}
                            <div className="pt-5 space-y-4">
                                <SectionLabel>Announcement Details</SectionLabel>
                                <div>
                                    <label htmlFor="ann-subject" style={labelStyle}>Subject</label>
                                    <input
                                        id="ann-subject"
                                        type="text"
                                        value={title}
                                        placeholder="Subject of this announcement…"
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="exec-input mt-1.5"
                                        style={{ ...fieldStyle, height: 44 }}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="ann-message" style={labelStyle}>Message</label>
                                    <textarea
                                        id="ann-message"
                                        rows="5"
                                        value={content}
                                        placeholder="What should people know?"
                                        onChange={(e) => setContent(e.target.value)}
                                        className="mt-1.5 resize-none"
                                        style={{ ...fieldStyle, lineHeight: 1.6 }}
                                    />
                                </div>
                            </div>

                            {/* Priority */}
                            <div className="mt-5 pt-5 space-y-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                                <SectionLabel>Priority</SectionLabel>
                                <div className="flex gap-2" role="group" aria-label="Priority">
                                    {PRIORITY_ORDER.map(p => {
                                        const cfg = cfgFor(p);
                                        const active = priority === p;
                                        return (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => setPriority(p)}
                                                aria-pressed={active}
                                                className="priority-pill flex-1 flex items-center justify-center gap-1.5"
                                                style={{
                                                    ...body, fontSize: '0.78rem', fontWeight: 600,
                                                    padding: '10px 0', borderRadius: 999,
                                                    border: `1px solid ${active ? PRIMARY : BORDER}`,
                                                    background: active ? PRIMARY : BG,
                                                    color: active ? '#fff' : MUTED,
                                                }}
                                            >
                                                <span className="rounded-full" style={{ width: 7, height: 7, background: active ? '#fff' : cfg.color }} />
                                                {cfg.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Audience */}
                            <div className="mt-5 pt-5 space-y-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                                <SectionLabel>Audience</SectionLabel>
                                <div className="flex flex-wrap gap-x-6 gap-y-2.5">
                                    <Tick label="Scholars" checked={targetRoles.includes('scholar')} onChange={() => toggleRole('scholar')} />
                                    <Tick label="Staff" checked={targetRoles.includes('staff')} onChange={() => toggleRole('staff')} />
                                    <Tick label="Officers" checked={targetRoles.includes('officer')} onChange={() => toggleRole('officer')} />
                                </div>
                            </div>

                            {/* Year level */}
                            {targetRoles.includes('scholar') && (
                                <div className="mt-5 pt-5 space-y-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                                    <SectionLabel>Year Level</SectionLabel>
                                    <div>
                                        <label style={labelStyle}>Year level (optional)</label>
                                        <div className="mt-1.5">
                                            <LevelSelector value={targetLevels} onChange={setTargetLevels} />
                                        </div>
                                    </div>
                                    {targetLevels.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {targetLevels.map(lv => (
                                                <span key={lv} className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ ...body, fontSize: '0.68rem', fontWeight: 600, background: PRIMARY_TINT, color: PRIMARY }}>
                                                    {getLevelLabel(lv)}
                                                    <button type="button" aria-label={`Remove ${getLevelLabel(lv)}`} onClick={() => setTargetLevels(targetLevels.filter(v => v !== lv))} className="exec-focus" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: PRIMARY, display: 'flex' }}>
                                                        <X size={11} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Feedback + actions */}
                            <div className="mt-5 pt-5" style={{ borderTop: `1px solid ${BORDER}` }}>
                                {error && <p role="alert" className="mb-3" style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: DANGER }}>{error}</p>}
                                {success && <p role="status" className="mb-3" style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: SUCCESS }}>{success}</p>}

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={handleClear}
                                        disabled={submitting}
                                        className="refresh-btn exec-focus disabled:opacity-60"
                                        style={{
                                            ...body, fontSize: '0.85rem', fontWeight: 600, height: 46, borderRadius: 12, padding: '0 20px',
                                            background: 'transparent', color: PRIMARY, border: `1px solid ${PRIMARY}`, cursor: 'pointer',
                                        }}
                                    >
                                        Clear
                                    </button>
                                    <button
                                        onClick={handleBroadcast}
                                        disabled={submitting}
                                        className="exec-focus flex-1 flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
                                        style={{
                                            ...body, fontSize: '0.85rem', fontWeight: 700, height: 46, borderRadius: 12,
                                            background: PRIMARY, color: '#fff', border: 'none',
                                            cursor: submitting ? 'wait' : 'pointer',
                                        }}
                                    >
                                        <Send size={15} /> {submitting ? 'Publishing…' : 'Publish Announcement'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── RIGHT: announcements list ─────────────────────── */}
                    <div className="min-w-0" style={{ ...cardStyle, padding: 22 }}>
                        <div className="flex items-center gap-3 pb-5" style={{ borderBottom: `1px solid ${BORDER}` }}>
                            <IconBadge icon={List} />
                            <div className="min-w-0">
                                <h2 style={{ ...display, fontSize: '1.2rem', fontWeight: 700, color: INK }}>Announcements List</h2>
                                <p style={{ ...body, fontSize: '0.78rem', color: MUTED, marginTop: 2 }}>View and manage all announcements.</p>
                            </div>
                        </div>

                        {/* ── 4. Toolbar ──────────────────────────────────── */}
                        {loading ? (
                            <div className="flex flex-wrap gap-3 pt-5">
                                <Skeleton style={{ flex: 1, minWidth: 200, height: 40 }} />
                                <Skeleton style={{ width: 150, height: 40 }} />
                            </div>
                        ) : (
                            <div className="flex flex-wrap items-center gap-3 pt-5">
                                <div className="relative flex-1" style={{ minWidth: 200 }}>
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: MUTED }} aria-hidden="true" />
                                    <input
                                        type="text"
                                        aria-label="Search announcements"
                                        placeholder="Search announcements…"
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        className="exec-input"
                                        style={{ ...fieldStyle, paddingLeft: 34, height: 40 }}
                                    />
                                </div>

                                <div className="exec-filter flex items-center gap-1.5 px-3" style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, height: 40 }}>
                                    <SlidersHorizontal size={13} style={{ color: MUTED }} aria-hidden="true" />
                                    <select
                                        aria-label="Filter by priority"
                                        value={priorityFilter}
                                        onChange={e => setPriorityFilter(e.target.value)}
                                        className="exec-select appearance-none outline-none"
                                        style={{ ...body, fontSize: '0.8rem', fontWeight: 500, color: INK, background: 'none', border: 'none', cursor: 'pointer' }}
                                    >
                                        <option value="all">All priorities</option>
                                        <option value="critical">Critical</option>
                                        <option value="important">Important</option>
                                        <option value="info">Info</option>
                                    </select>
                                </div>

                                <button
                                    onClick={fetchAnnouncements}
                                    className="refresh-btn exec-focus flex items-center gap-2 sm:ml-auto"
                                    style={{
                                        ...body, fontSize: '0.8rem', fontWeight: 600, color: PRIMARY,
                                        background: 'transparent', border: `1px solid ${PRIMARY}`,
                                        borderRadius: 10, height: 40, padding: '0 14px', cursor: 'pointer',
                                    }}
                                >
                                    <RefreshCw size={14} /> Refresh
                                </button>
                            </div>
                        )}

                        {/* ── 5. Announcement feed ────────────────────────── */}
                        <div className="grid gap-3.5 mt-5">
                            {loading && Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: RADIUS - 2, padding: 18 }}>
                                    <div className="flex justify-between">
                                        <Skeleton style={{ width: 90, height: 18, borderRadius: 999 }} />
                                        <Skeleton style={{ width: 70, height: 12 }} />
                                    </div>
                                    <Skeleton style={{ width: '45%', height: 16, marginTop: 16 }} />
                                    <Skeleton style={{ width: '85%', height: 12, marginTop: 10 }} />
                                    <Skeleton style={{ width: '65%', height: 12, marginTop: 6 }} />
                                </div>
                            ))}

                            {!loading && filtered
                                .slice()
                                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                                .map((ann) => {
                                    const cfg = cfgFor(ann.priority);
                                    const PriorityIcon = cfg.icon;
                                    const isNotifying = notifyingId === ann.id;
                                    const showFeedback = notifyFeedbackId === ann.id && (notifyMessage || notifyError);
                                    return (
                                        <article
                                            key={ann.id}
                                            className="ann-card"
                                            style={{
                                                background: ann.is_active ? SURFACE : BG,
                                                border: `1px solid ${BORDER}`,
                                                borderLeft: `3px solid ${ann.is_active ? cfg.color : BORDER}`,
                                                borderRadius: RADIUS - 2,
                                                padding: 18,
                                                opacity: ann.is_active ? 1 : 0.8,
                                            }}
                                        >
                                            <div className="flex gap-3.5">
                                                <IconBadge icon={PriorityIcon} color={cfg.color} tint={cfg.tint} size={38} />

                                                <div className="min-w-0 flex-1">
                                                    {/* top: badges + date */}
                                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span
                                                                className="inline-flex items-center px-2.5 py-1"
                                                                style={{ ...body, fontSize: '0.68rem', fontWeight: 700, color: cfg.color, background: cfg.tint, borderRadius: 999 }}
                                                            >
                                                                {cfg.label}
                                                            </span>
                                                            <span
                                                                className="inline-flex items-center px-2.5 py-1"
                                                                style={{
                                                                    ...body, fontSize: '0.68rem', fontWeight: 700, borderRadius: 999,
                                                                    color: ann.is_active ? SUCCESS : MUTED,
                                                                    background: ann.is_active ? SUCCESS_TINT : NEUTRAL_TINT,
                                                                }}
                                                            >
                                                                {ann.is_active ? 'Published' : 'Withdrawn'}
                                                            </span>
                                                        </div>
                                                        <span className="flex items-center gap-1" style={{ ...body, fontSize: '0.72rem', color: MUTED }}>
                                                            <Clock size={11} aria-hidden="true" /> {formatDate(ann.created_at)}
                                                        </span>
                                                    </div>

                                                    {/* middle: title + preview */}
                                                    <h3 className="mt-2.5 break-words" style={{ ...display, fontSize: '1.05rem', fontWeight: 700, color: INK }}>
                                                        {ann.title}
                                                    </h3>
                                                    <p className="mt-1 line-clamp-2 break-words" style={{ ...body, fontSize: '0.84rem', lineHeight: 1.6, color: MUTED }}>
                                                        {ann.content}
                                                    </p>

                                                    {/* bottom: audience + actions */}
                                                    <div className="flex items-center flex-wrap gap-x-3 gap-y-2 mt-3.5 pt-3.5" style={{ borderTop: `1px solid ${BORDER}` }}>
                                                        <span className="flex items-center gap-1.5" style={{ ...body, fontSize: '0.74rem', fontWeight: 600, color: BRONZE }}>
                                                            <Users size={13} aria-hidden="true" /> {getAudienceLabel(ann)}
                                                        </span>

                                                        <div className="flex items-center gap-1.5 ml-auto">
                                                            <button
                                                                onClick={() => handleNotifyAnnouncement(ann.id)}
                                                                disabled={isNotifying}
                                                                aria-label={`Notify recipients about ${ann.title}`}
                                                                className="action-link exec-focus"
                                                                style={{ ...body, fontSize: '0.76rem', fontWeight: 700, color: PRIMARY, background: 'none', border: 'none', cursor: isNotifying ? 'wait' : 'pointer', opacity: isNotifying ? 0.5 : 1, padding: '6px 10px', borderRadius: 8 }}
                                                            >
                                                                {isNotifying ? 'Sending…' : 'Notify'}
                                                            </button>

                                                            <button
                                                                type="button"
                                                                role="switch"
                                                                aria-checked={!!ann.is_active}
                                                                aria-label={`${ann.is_active ? 'Withdraw' : 'Publish'} ${ann.title}`}
                                                                title={ann.is_active ? 'Withdraw announcement' : 'Publish announcement'}
                                                                onClick={() => handleToggle(ann.id)}
                                                                className="exec-switch flex items-center gap-2"
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px' }}
                                                            >
                                                                <span className="relative inline-block" style={{ width: 36, height: 20, borderRadius: 999, background: ann.is_active ? SUCCESS : '#D8CCBB', transition: 'background 150ms ease' }}>
                                                                    <span className="absolute" style={{ top: 2, left: ann.is_active ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(36,21,18,0.25)', transition: 'left 150ms ease' }} />
                                                                </span>
                                                                <span style={{ ...body, fontSize: '0.76rem', fontWeight: 600, color: ann.is_active ? MUTED : SUCCESS }}>
                                                                    {ann.is_active ? 'Withdraw' : 'Publish'}
                                                                </span>
                                                            </button>

                                                            <button
                                                                onClick={() => { setSelectedAnn(ann); setShowDeleteModal(true); }}
                                                                aria-label={`Delete ${ann.title}`}
                                                                title="Delete announcement"
                                                                className="danger-link exec-focus"
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', lineHeight: 0, color: DANGER, padding: 8, borderRadius: 8 }}
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {showFeedback && (
                                                        <p
                                                            role={notifyError ? 'alert' : 'status'}
                                                            className="mt-2.5"
                                                            style={{ ...body, fontSize: '0.76rem', fontWeight: 600, color: notifyError ? DANGER : SUCCESS }}
                                                        >
                                                            {notifyError || notifyMessage}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}

                            {!loading && filtered.length === 0 && (
                                <div className="flex flex-col items-center gap-3 text-center" style={{ padding: '48px 24px' }}>
                                    <IconBadge icon={Archive} size={46} />
                                    <p style={{ ...display, fontSize: '1.05rem', fontWeight: 600, color: INK }}>
                                        {announcements.length === 0 ? 'No announcements yet' : 'Nothing matches that search'}
                                    </p>
                                    <p className="max-w-sm" style={{ ...body, fontSize: '0.83rem', lineHeight: 1.6, color: MUTED }}>
                                        {announcements.length === 0
                                            ? 'Compose your first announcement to get started.'
                                            : 'Try a different search term or priority filter.'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── 7. Delete modal ──────────────────────────────────── */}
            {showDeleteModal && selectedAnn && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(36,21,18,0.5)' }}>
                    <div role="dialog" aria-modal="true" aria-labelledby="delete-ann-title"
                        className="w-full max-w-sm overflow-hidden text-center"
                        style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 20, boxShadow: '0 24px 64px -20px rgba(36,21,18,0.4)' }}>
                        <div className="p-8">
                            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: DANGER_TINT }}>
                                <Trash2 size={22} style={{ color: DANGER }} />
                            </div>
                            <h3 id="delete-ann-title" style={{ ...display, fontSize: '1.15rem', fontWeight: 700, color: INK }}>Delete this announcement?</h3>
                            <p className="break-words" style={{ ...body, fontSize: '0.83rem', color: MUTED, marginTop: 8, marginBottom: 24, lineHeight: 1.55 }}>
                                "{selectedAnn.title}" will be permanently removed. This can't be undone.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    className="exec-focus flex-1"
                                    style={{ ...body, fontSize: '0.82rem', fontWeight: 600, height: 46, borderRadius: 12, border: `1.5px solid ${BORDER}`, color: MUTED, background: '#fff', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="exec-focus flex-1"
                                    style={{ ...body, fontSize: '0.82rem', fontWeight: 700, height: 46, borderRadius: 12, background: DANGER, color: '#fff', border: 'none', cursor: 'pointer' }}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

export default AdminAnnouncement;