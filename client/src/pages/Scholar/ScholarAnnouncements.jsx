import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Megaphone, Clock3, Search, AlertCircle, AlertTriangle, Info, ChevronDown, UserRound } from 'lucide-react';

// ── Scholar Portal design system ──
// Same tokens as the rest of the Scholar module (dashboard, duty &
// participation, tasks & compliance) so this page reads as one continuous
// workspace rather than a separate "Gazette" experience.
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

const PRIORITY_CONFIG = {
    critical:  { color: DANGER,  label: 'Critical'  },
    important: { color: WARNING, label: 'Important' },
    info:      { color: BRONZE,  label: 'Info'      },
};

const SOURCE_CONFIG = {
    admin:   { label: 'Admin'   },
    officer: { label: 'Officer' },
    staff:   { label: 'Staff'   },
};

const SOURCE_TABS = [
    { key: 'all',     label: 'All Senders' },
    { key: 'admin',   label: 'Admin'       },
    { key: 'officer', label: 'Officer'     },
    { key: 'staff',   label: 'Staff'       },
];

function PriorityIcon({ priority, size = 12 }) {
    if (priority === 'critical')  return <AlertCircle size={size} />;
    if (priority === 'important') return <AlertTriangle size={size} />;
    return <Info size={size} />;
}

function PriorityBadge({ priority }) {
    const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.info;
    return (
        <span
            className="inline-flex items-center gap-1.5 flex-shrink-0"
            style={{ ...body, fontSize: '0.72rem', fontWeight: 600, color: cfg.color, background: `${cfg.color}14`, borderRadius: 999, padding: '4px 11px' }}
        >
            <PriorityIcon priority={priority} size={11} />
            {cfg.label}
        </span>
    );
}

// A single announcement card — used for every notice after the lead story.
function ArticleCard({ ann }) {
    const normalizedRole = String(ann.created_by_role || '').trim().toLowerCase();
    const src = SOURCE_CONFIG[normalizedRole];

    return (
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '18px 20px' }}>
            <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 10 }}>
                <PriorityBadge priority={ann.priority} />
                {src && (
                    <span className="flex items-center gap-1" style={{ ...body, fontSize: '0.72rem', color: MUTED }}>
                        <UserRound size={11} />
                        {src.label}
                    </span>
                )}
            </div>

            <h4 style={{ ...display, fontSize: '1.05rem', fontWeight: 600, color: INK, lineHeight: 1.3, marginBottom: 6 }}>
                {ann.title}
            </h4>

            <p style={{ ...body, fontSize: '0.82rem', color: MUTED, lineHeight: 1.6 }} className="line-clamp-3">
                {ann.content}
            </p>

            <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${BG}` }}>
                <span style={{ ...body, fontSize: '0.72rem', color: MUTED }}>
                    {ann.created_by_name || ann.created_by || 'Unknown'}
                </span>
                <span style={{ color: BORDER }}>·</span>
                <span className="flex items-center gap-1" style={{ ...body, fontSize: '0.72rem', color: MUTED }}>
                    <Clock3 size={11} />
                    {new Date(ann.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
            </div>
        </div>
    );
}

const ScholarAnnouncements = () => {
    const yearLevel = localStorage.getItem('year_level') || '';

    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading]             = useState(true);
    const [search, setSearch]               = useState('');
    const [sourceFilter, setSourceFilter]   = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');

    useEffect(() => {
        const fetchAnnouncements = async () => {
            try {
                const params = yearLevel ? { year_level: yearLevel } : {};
                const res = await axios.get('http://localhost:5000/api/scholar/announcements', { params });
                setAnnouncements(res.data);
            } catch (err) {
                console.error('Error fetching announcements:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchAnnouncements();
    }, []);

    const filtered = announcements.filter(ann => {
        const title = String(ann.title || '').toLowerCase();
        const content = String(ann.content || '').toLowerCase();
        const normalizedRole = String(ann.created_by_role || '').trim().toLowerCase();

        const matchesSearch =
            title.includes(search.toLowerCase()) ||
            content.includes(search.toLowerCase());
        const matchesSource = sourceFilter === 'all' || normalizedRole === sourceFilter;
        const matchesPriority = priorityFilter === 'all' || ann.priority === priorityFilter;
        return matchesSearch && matchesSource && matchesPriority;
    });

    const counts = {
        critical:  announcements.filter(a => a.priority === 'critical').length,
        important: announcements.filter(a => a.priority === 'important').length,
        total:     announcements.length,
    };

    const [leadStory, ...restStories] = filtered;

    return (
        <div style={{ ...body, background: BG, minHeight: '100vh' }}>
            <div className="w-full px-4 sm:px-6 lg:p-8">

                {/* ── Personal header ── */}
                <div className="flex items-start justify-between gap-4 flex-wrap" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '22px 26px', marginBottom: 20 }}>
                    <div>
                        <p style={{ ...body, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: BRONZE }}>SCHOLAR PORTAL</p>
                        <h1 style={{ ...display, fontSize: '1.7rem', fontWeight: 600, color: INK, marginTop: 4 }}>Announcements</h1>
                        <p style={{ ...body, fontSize: '0.84rem', color: MUTED, marginTop: 6, maxWidth: 460 }}>
                            Updates and notices from your Officer, Staff, and the Foundation Admin.
                        </p>
                    </div>
                    <span style={{ ...body, fontSize: '0.76rem', fontWeight: 600, color: PRIMARY, background: `${PRIMARY}12`, border: `1px solid ${BORDER}`, borderRadius: 999, padding: '7px 16px', flexShrink: 0 }}>
                        {announcements.length} notice{announcements.length === 1 ? '' : 's'} on file
                    </span>
                </div>

                {/* ── Priority overview ── */}
                {!loading && (
                    <div className="grid grid-cols-3 gap-4" style={{ marginBottom: 20 }}>
                        {[
                            { label: 'Critical',  value: counts.critical,  color: DANGER,  icon: AlertCircle },
                            { label: 'Important', value: counts.important, color: WARNING, icon: AlertTriangle },
                            { label: 'Total',      value: counts.total,     color: PRIMARY, icon: Megaphone },
                        ].map((item) => (
                            <div key={item.label} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '16px 18px' }}>
                                <div className="flex items-center justify-center" style={{ width: 30, height: 30, borderRadius: 9, background: `${item.color}14` }}>
                                    <item.icon size={14} style={{ color: item.color }} />
                                </div>
                                <p style={{ ...display, fontSize: '1.5rem', fontWeight: 600, color: INK, marginTop: 10 }}>{item.value}</p>
                                <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 2 }}>{item.label}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Filter bar ── */}
                <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '14px 18px', marginBottom: 16 }}>
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                            <Search size={15} style={{ color: MUTED }} />
                            <input
                                type="text"
                                placeholder="Search announcements"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ width: '100%', border: 'none', outline: 'none', background: 'none', ...body, fontSize: '0.82rem', color: INK }}
                            />
                        </div>
                        <div className="relative sm:w-52 shrink-0 flex items-center gap-2" style={{ borderTop: 'none', borderLeft: `1px solid ${BORDER}`, paddingLeft: 14 }}>
                            <select
                                value={priorityFilter}
                                onChange={e => setPriorityFilter(e.target.value)}
                                className="appearance-none cursor-pointer"
                                style={{
                                    width: '100%', border: 'none', outline: 'none', background: 'none',
                                    ...body, fontSize: '0.8rem', fontWeight: 500,
                                    color: priorityFilter === 'all' ? INK : PRIORITY_CONFIG[priorityFilter]?.color,
                                }}
                            >
                                <option value="all">All Priorities</option>
                                <option value="critical">Critical</option>
                                <option value="important">Important</option>
                                <option value="info">Info</option>
                            </select>
                            <ChevronDown size={13} className="pointer-events-none" style={{ color: MUTED, marginLeft: -18 }} />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${BG}` }}>
                        {SOURCE_TABS.map(f => {
                            const isActive = sourceFilter === f.key;
                            return (
                                <button
                                    key={f.key}
                                    onClick={() => setSourceFilter(f.key)}
                                    style={{
                                        ...body, fontSize: '0.76rem', fontWeight: 600, borderRadius: 999,
                                        padding: '7px 14px', cursor: 'pointer',
                                        border: `1px solid ${isActive ? PRIMARY : BORDER}`,
                                        background: isActive ? PRIMARY : SURFACE,
                                        color: isActive ? '#fff' : INK,
                                    }}
                                >
                                    {f.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── Announcements ── */}
                {loading ? (
                    <div className="space-y-5 pb-8">
                        <div className="animate-pulse" style={{ background: `${BORDER}88`, height: 160, borderRadius: RADIUS }} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {Array(4).fill(0).map((_, i) => (
                                <div key={i} className="animate-pulse" style={{ background: `${BORDER}88`, height: 150, borderRadius: RADIUS }} />
                            ))}
                        </div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center" style={{ border: `1px dashed ${BORDER}`, background: SURFACE, borderRadius: RADIUS, padding: '64px 20px' }}>
                        <div className="mx-auto flex items-center justify-center" style={{ width: 52, height: 52, borderRadius: 16, background: `${BRONZE}14`, marginBottom: 16 }}>
                            <Megaphone size={22} style={{ color: BRONZE }} />
                        </div>
                        <p style={{ ...display, fontSize: '1.05rem', fontWeight: 600, color: INK }}>No announcements found</p>
                        <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginTop: 4 }}>Check back later, or try a different filter.</p>
                    </div>
                ) : (
                    <div className="pb-10">
                        {/* Lead story — full width feature card */}
                        {(() => {
                            const cfg = PRIORITY_CONFIG[leadStory.priority] || PRIORITY_CONFIG.info;
                            const normalizedRole = String(leadStory.created_by_role || '').trim().toLowerCase();
                            const src = SOURCE_CONFIG[normalizedRole];
                            return (
                                <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, marginBottom: 20, padding: '26px 28px', position: 'relative', overflow: 'hidden' }}>
                                    <span aria-hidden="true" className="absolute top-0 left-0 right-0" style={{ height: 4, background: `linear-gradient(90deg, ${PRIMARY} 0%, ${cfg.color} 100%)` }} />
                                    <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 12 }}>
                                        <span style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', color: '#fff', background: PRIMARY, borderRadius: 999, padding: '4px 12px' }}>
                                            LATEST
                                        </span>
                                        <PriorityBadge priority={leadStory.priority} />
                                        {src && (
                                            <span className="flex items-center gap-1" style={{ ...body, fontSize: '0.74rem', color: MUTED }}>
                                                <UserRound size={11} />
                                                {src.label}
                                            </span>
                                        )}
                                    </div>

                                    <h4 style={{ ...display, fontSize: '1.5rem', fontWeight: 600, color: INK, lineHeight: 1.25 }}>
                                        {leadStory.title}
                                    </h4>

                                    <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 8, marginBottom: 14 }}>
                                        <span style={{ ...body, fontSize: '0.76rem', color: MUTED }}>
                                            {leadStory.created_by_name || leadStory.created_by || 'Unknown'}
                                        </span>
                                        <span style={{ color: BORDER }}>·</span>
                                        <span className="flex items-center gap-1" style={{ ...body, fontSize: '0.76rem', color: MUTED }}>
                                            <Clock3 size={11} />
                                            {new Date(leadStory.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                                        </span>
                                    </div>

                                    <p style={{ ...body, fontSize: '0.9rem', color: '#5c4a3f', lineHeight: 1.75, maxWidth: 640 }}>
                                        {leadStory.content}
                                    </p>
                                </div>
                            );
                        })()}

                        {/* Remaining notices */}
                        {restStories.length > 0 && (
                            <>
                                <p style={{ ...body, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: MUTED, marginBottom: 14 }}>
                                    MORE ANNOUNCEMENTS
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {restStories.map((ann) => <ArticleCard key={ann.id} ann={ann} />)}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScholarAnnouncements;