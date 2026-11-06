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

const cardShadow = '0 1px 2px rgba(36,21,18,0.03), 0 6px 20px rgba(36,21,18,0.04)';

// Inline line-clamp (does not depend on a Tailwind plugin being installed).
const clamp = (lines) => ({
    display: '-webkit-box',
    WebkitLineClamp: lines,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
});

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
            style={{ ...body, fontSize: '0.72rem', fontWeight: 600, color: cfg.color, background: `${cfg.color}14`, border: `1px solid ${cfg.color}30`, borderRadius: 999, padding: '4px 11px', whiteSpace: 'nowrap' }}
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
    const cfg = PRIORITY_CONFIG[ann.priority] || PRIORITY_CONFIG.info;
    const isCritical = ann.priority === 'critical';

    return (
        <div
            className="sa-card min-w-0 h-full flex flex-col"
            style={{
                background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '18px 20px',
                boxShadow: cardShadow,
                ...(isCritical ? { borderLeft: `3px solid ${DANGER}` } : {}),
            }}
        >
            <div className="flex items-start justify-between gap-3" style={{ marginBottom: 12 }}>
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <PriorityBadge priority={ann.priority} />
                    {src && (
                        <span className="flex items-center gap-1" style={{ ...body, fontSize: '0.72rem', color: MUTED }}>
                            <UserRound size={11} />
                            {src.label}
                        </span>
                    )}
                </div>
                <div className="flex items-center justify-center flex-shrink-0" style={{ width: 30, height: 30, borderRadius: 9, background: `${cfg.color}12`, border: `1px solid ${cfg.color}22` }}>
                    <Megaphone size={13} style={{ color: cfg.color }} />
                </div>
            </div>

            <h4 style={{ ...display, fontSize: '1.08rem', fontWeight: 600, color: INK, lineHeight: 1.3, marginBottom: 6, overflowWrap: 'anywhere', ...clamp(2) }}>
                {ann.title}
            </h4>

            <p style={{ ...body, fontSize: '0.82rem', color: MUTED, lineHeight: 1.6, overflowWrap: 'anywhere', ...clamp(3) }}>
                {ann.content}
            </p>

            <div className="flex items-center gap-2 flex-wrap mt-auto" style={{ marginTop: 'auto', paddingTop: 12 }}>
                <div className="w-full" style={{ height: 1, background: BG, marginBottom: 2 }} />
                <span className="min-w-0 truncate" style={{ ...body, fontSize: '0.72rem', color: MUTED, maxWidth: '100%' }}>
                    {ann.created_by_name || ann.created_by || 'Unknown'}
                </span>
                <span style={{ color: BORDER }}>·</span>
                <span className="flex items-center gap-1" style={{ ...body, fontSize: '0.72rem', color: MUTED, whiteSpace: 'nowrap' }}>
                    <Clock3 size={11} />
                    {new Date(ann.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
            </div>
        </div>
    );
}

// Skeletons that mirror the real layout.
const SummarySkeleton = () => (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '16px 18px' }}>
        <div className="animate-pulse" style={{ width: 34, height: 34, borderRadius: 10, background: `${BORDER}99` }} />
        <div className="animate-pulse" style={{ width: 36, height: 22, borderRadius: 8, background: `${BORDER}99`, marginTop: 12 }} />
        <div className="animate-pulse" style={{ width: '60%', height: 9, borderRadius: 999, background: `${BORDER}66`, marginTop: 10 }} />
    </div>
);

const FeaturedSkeleton = () => (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '26px 28px' }}>
        <div className="flex gap-2">
            <div className="animate-pulse" style={{ width: 64, height: 22, borderRadius: 999, background: `${BORDER}99` }} />
            <div className="animate-pulse" style={{ width: 84, height: 22, borderRadius: 999, background: `${BORDER}99` }} />
        </div>
        <div className="animate-pulse" style={{ width: '60%', height: 24, borderRadius: 8, background: `${BORDER}99`, marginTop: 18 }} />
        <div className="animate-pulse" style={{ width: '32%', height: 10, borderRadius: 999, background: `${BORDER}66`, marginTop: 14 }} />
        <div className="animate-pulse" style={{ width: '90%', height: 10, borderRadius: 999, background: `${BORDER}66`, marginTop: 22 }} />
        <div className="animate-pulse" style={{ width: '82%', height: 10, borderRadius: 999, background: `${BORDER}66`, marginTop: 10 }} />
        <div className="animate-pulse" style={{ width: '56%', height: 10, borderRadius: 999, background: `${BORDER}66`, marginTop: 10 }} />
    </div>
);

const CardSkeleton = () => (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '18px 20px' }}>
        <div className="flex items-center justify-between">
            <div className="animate-pulse" style={{ width: 76, height: 22, borderRadius: 999, background: `${BORDER}99` }} />
            <div className="animate-pulse" style={{ width: 30, height: 30, borderRadius: 9, background: `${BORDER}99` }} />
        </div>
        <div className="animate-pulse" style={{ width: '70%', height: 15, borderRadius: 8, background: `${BORDER}99`, marginTop: 16 }} />
        <div className="animate-pulse" style={{ width: '95%', height: 9, borderRadius: 999, background: `${BORDER}66`, marginTop: 14 }} />
        <div className="animate-pulse" style={{ width: '75%', height: 9, borderRadius: 999, background: `${BORDER}66`, marginTop: 8 }} />
    </div>
);

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

    const controlBox = { height: 42, borderRadius: 12, border: `1px solid ${BORDER}`, background: BG };

    return (
        <div className="w-full min-w-0 max-w-full overflow-x-hidden" style={{ ...body, background: BG, minHeight: '100vh' }}>
            <style>{`
                .sa-kpi { transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
                .sa-kpi:hover { transform: translateY(-2px); border-color: #d8c4ad; box-shadow: 0 2px 4px rgba(36,21,18,0.04), 0 12px 28px rgba(36,21,18,0.07); }
                .sa-card { transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
                .sa-card:hover { transform: translateY(-2px); border-color: #d8c4ad; box-shadow: 0 2px 4px rgba(36,21,18,0.04), 0 12px 28px rgba(36,21,18,0.07); }
                .sa-control:focus-within { border-color: ${PRIMARY}66 !important; box-shadow: 0 0 0 4px ${PRIMARY}1a; }
                .sa-tab { transition: background .2s ease, color .2s ease, box-shadow .2s ease; }
                .sa-tab:not(.is-active):hover { background: #F3ECE0; }
            `}</style>

            <div className="w-full min-w-0 px-4 sm:px-6 lg:p-8">

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
                <div className="grid grid-cols-3 gap-2.5 sm:gap-4" style={{ marginBottom: 20 }}>
                    {loading
                        ? Array(3).fill(0).map((_, i) => <SummarySkeleton key={i} />)
                        : [
                            { label: 'Critical',  value: counts.critical,  color: DANGER,  icon: AlertCircle,   hint: 'need immediate attention' },
                            { label: 'Important', value: counts.important, color: WARNING, icon: AlertTriangle, hint: 'worth your attention' },
                            { label: 'Total',     value: counts.total,     color: PRIMARY, icon: Megaphone,     hint: 'notices on file' },
                        ].map((item) => (
                            <div key={item.label} className="sa-kpi min-w-0 p-3.5 sm:p-5" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: cardShadow }}>
                                <div className="flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: 10, background: `${item.color}14`, border: `1px solid ${item.color}22` }}>
                                    <item.icon size={16} style={{ color: item.color }} />
                                </div>
                                <p style={{ ...display, fontVariantNumeric: 'tabular-nums', fontSize: '1.9rem', fontWeight: 600, color: INK, marginTop: 12, lineHeight: 1 }}>{item.value}</p>
                                <p style={{ ...body, fontSize: '0.8rem', fontWeight: 600, color: INK, marginTop: 8 }}>{item.label}</p>
                                <p className="hidden sm:block" style={{ ...body, fontSize: '0.72rem', color: MUTED, marginTop: 2 }}>{item.hint}</p>
                            </div>
                        ))
                    }
                </div>

                {/* ── Filter toolbar ── */}
                <div className="min-w-0" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '14px 16px', marginBottom: 20, boxShadow: cardShadow }}>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-2.5 sm:gap-3">
                        <div className="sa-control flex items-center gap-2 min-w-0" style={{ ...controlBox, padding: '0 14px' }}>
                            <Search size={15} style={{ color: MUTED, flexShrink: 0 }} />
                            <input
                                type="text"
                                placeholder="Search announcements"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ width: '100%', minWidth: 0, border: 'none', outline: 'none', background: 'none', ...body, fontSize: '0.82rem', color: INK }}
                            />
                        </div>
                        <div className="sa-control relative flex items-center" style={{ ...controlBox, padding: '0 12px' }}>
                            <select
                                value={priorityFilter}
                                onChange={e => setPriorityFilter(e.target.value)}
                                aria-label="Filter by priority"
                                className="appearance-none cursor-pointer"
                                style={{
                                    width: '100%', height: '100%', border: 'none', outline: 'none', background: 'transparent', paddingRight: 22,
                                    ...body, fontSize: '0.8rem', fontWeight: 500,
                                    color: priorityFilter === 'all' ? INK : PRIORITY_CONFIG[priorityFilter]?.color,
                                }}
                            >
                                <option value="all">All Priorities</option>
                                <option value="critical">Critical</option>
                                <option value="important">Important</option>
                                <option value="info">Info</option>
                            </select>
                            <ChevronDown size={13} className="absolute pointer-events-none" style={{ right: 12, color: MUTED }} />
                        </div>
                    </div>

                    {/* Sender segmented control — full width */}
                    <div
                        className="grid grid-cols-2 sm:grid-cols-4 gap-1 w-full"
                        style={{ background: '#F1EADD', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 4, marginTop: 12 }}
                    >
                        {SOURCE_TABS.map(f => {
                            const isActive = sourceFilter === f.key;
                            return (
                                <button
                                    key={f.key}
                                    onClick={() => setSourceFilter(f.key)}
                                    className={`sa-tab ${isActive ? 'is-active' : ''}`}
                                    style={{
                                        ...body, fontSize: '0.78rem', fontWeight: 600, borderRadius: 10,
                                        padding: '9px 14px', cursor: 'pointer', border: 'none',
                                        background: isActive ? PRIMARY : 'transparent',
                                        color: isActive ? '#fff' : INK,
                                        boxShadow: isActive ? '0 4px 12px rgba(109,33,64,0.25)' : 'none',
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
                        <FeaturedSkeleton />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Array(4).fill(0).map((_, i) => <CardSkeleton key={i} />)}
                        </div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center" style={{ border: `1px dashed ${BORDER}`, background: SURFACE, borderRadius: RADIUS, padding: '48px 20px' }}>
                        <div className="mx-auto flex items-center justify-center" style={{ width: 68, height: 68, borderRadius: '50%', background: `${BRONZE}0f`, marginBottom: 14 }}>
                            <div className="flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: 14, background: `${BRONZE}1c`, border: `1px solid ${BRONZE}30` }}>
                                <Megaphone size={20} style={{ color: BRONZE }} />
                            </div>
                        </div>
                        <p style={{ ...display, fontSize: '1.05rem', fontWeight: 600, color: INK }}>No announcements found</p>
                        <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginTop: 4 }}>Check back later, or try a different filter.</p>
                    </div>
                ) : (
                    <div className="pb-10 min-w-0">
                        {/* Lead story — full width featured card */}
                        {(() => {
                            const cfg = PRIORITY_CONFIG[leadStory.priority] || PRIORITY_CONFIG.info;
                            const normalizedRole = String(leadStory.created_by_role || '').trim().toLowerCase();
                            const src = SOURCE_CONFIG[normalizedRole];
                            const published = new Date(leadStory.created_at);
                            return (
                                <div className="min-w-0 p-5 sm:p-7" style={{ background: '#FCF6F1', border: `1px solid ${BORDER}`, borderRadius: RADIUS, marginBottom: 20, position: 'relative', overflow: 'hidden', boxShadow: cardShadow }}>
                                    {/* Burgundy accent line */}
                                    <span aria-hidden="true" className="absolute top-0 bottom-0 left-0" style={{ width: 4, background: PRIMARY }} />
                                    {/* Decorative megaphone */}
                                    <Megaphone aria-hidden="true" size={150} strokeWidth={1.2} className="absolute pointer-events-none hidden sm:block" style={{ right: -18, top: -14, color: PRIMARY, opacity: 0.055, transform: 'rotate(-12deg)' }} />

                                    <div className="relative">
                                        <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 14 }}>
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

                                        <h4 className="text-[1.3rem] sm:text-[1.7rem]" style={{ ...display, fontWeight: 600, color: INK, lineHeight: 1.25, overflowWrap: 'anywhere', maxWidth: 720 }}>
                                            {leadStory.title}
                                        </h4>

                                        <div className="flex items-center gap-x-2 gap-y-1 flex-wrap" style={{ marginTop: 10, marginBottom: 16 }}>
                                            <span style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: INK }}>
                                                {leadStory.created_by_name || leadStory.created_by || 'Unknown'}
                                            </span>
                                            <span style={{ color: BORDER }}>·</span>
                                            <span className="flex items-center gap-1" style={{ ...body, fontSize: '0.76rem', color: MUTED }}>
                                                <Clock3 size={11} />
                                                {published.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                                                {!Number.isNaN(published.getTime()) && `, ${published.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}`}
                                            </span>
                                        </div>

                                        <div style={{ height: 1, background: BORDER, maxWidth: 720, marginBottom: 16 }} />

                                        <p style={{ ...body, fontSize: '0.92rem', color: '#5c4a3f', lineHeight: 1.8, maxWidth: 720, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
                                            {leadStory.content}
                                        </p>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Remaining notices */}
                        {restStories.length > 0 && (
                            <>
                                <p style={{ ...body, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: MUTED, marginBottom: 14 }}>
                                    MORE ANNOUNCEMENTS
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
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