import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Megaphone, Clock, Search, AlertCircle, AlertTriangle, Info, ChevronDown } from 'lucide-react';

// ── Token system — shared across the Scholar Portal ──
const MAROON = '#7f2d3a';
const MAROON_DEEP = '#4f1620';
const GOLD = '#b98b4e';
const IVORY = '#FBF7F2';
const INK = '#241512';

const PRIORITY_CONFIG = {
    critical:  { bg: '#FBE9E9', text: '#991b1b', pin: '#991b1b', label: 'Critical'  },
    important: { bg: '#FBF0DE', text: '#92400e', pin: '#92400e', label: 'Important' },
    info:      { bg: '#F6EFE1', text: '#8a6a3a', pin: GOLD,       label: 'Info'      },
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

    const serif = { fontFamily: "'Playfair Display', serif" };
    const sans = { fontFamily: "'DM Sans', sans-serif" };

    return (
        <div style={{ ...sans, background: IVORY, minHeight: '100vh' }}>

            {/* ── Hero band ─────────────────────────────────────── */}
            <div
                className="relative overflow-hidden px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-14 sm:pb-16"
                style={{ background: `linear-gradient(135deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)` }}
            >
                <svg
                    className="absolute -right-8 -top-10 w-52 h-52 sm:-right-6 sm:-top-8 sm:w-64 sm:h-64 opacity-[0.14] pointer-events-none"
                    viewBox="0 0 200 200"
                    fill="none"
                >
                    <path
                        d="M100 62c-6-14-20-24-36-24-4 0-8 1-8 1s-2 10 4 22c5 10 15 18 26 19-4 12-6 26-6 38 0 34 18 62 40 62 8 0 12-4 20-4s12 4 20 4c22 0 40-30 40-64 0-24-12-42-30-42-8 0-14 4-20 4s-10-3-16-6c2-11 8-20 16-25-2-1-6-2-10-2-16 0-30 8-40 17z"
                        fill={GOLD}
                    />
                    <path d="M100 62c2-16 10-30 22-38" stroke={GOLD} strokeWidth="6" strokeLinecap="round" />
                </svg>

                <p className="relative text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.25em] mb-2" style={{ color: GOLD }}>
                    Foundation Updates
                </p>
                <h1 className="relative text-2xl sm:text-3xl md:text-4xl font-bold text-white" style={serif}>Announcements</h1>
                <p className="relative text-xs mt-2 max-w-md" style={{ color: '#e9c9a8' }}>
                    Stay updated with the latest from Kalinga Foundation.
                </p>
            </div>

            <div className="px-4 sm:px-6 lg:p-8 lg:pt-0">

                {/* ── Priority strip — floats over the hero ──────────── */}
                <div
                    className="relative -mt-8 sm:-mt-10 mb-6 sm:mb-8 rounded-2xl bg-white overflow-hidden"
                    style={{ boxShadow: '0 12px 30px -12px rgba(79,22,32,0.25)' }}
                >
                    <div className="grid grid-cols-3 divide-x divide-slate-100">
                        <div className="p-4 sm:p-5 text-center">
                            <p className="text-2xl sm:text-3xl font-bold" style={{ ...serif, color: '#991b1b' }}>{counts.critical}</p>
                            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: '#c9a9b0' }}>Critical</p>
                        </div>
                        <div className="p-4 sm:p-5 text-center">
                            <p className="text-2xl sm:text-3xl font-bold" style={{ ...serif, color: '#92400e' }}>{counts.important}</p>
                            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: '#c9a9b0' }}>Important</p>
                        </div>
                        <div className="p-4 sm:p-5 text-center">
                            <p className="text-2xl sm:text-3xl font-bold" style={{ ...serif, color: MAROON }}>{counts.total}</p>
                            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: '#c9a9b0' }}>Total</p>
                        </div>
                    </div>
                </div>

                {/* Search + Priority Dropdown */}
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-3.5" size={16} style={{ color: '#c9b3b8' }} />
                        <input
                            type="text"
                            placeholder="Search announcements..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-white pl-11 pr-4 py-3 text-sm rounded-2xl outline-none transition-all placeholder:text-slate-300"
                            style={{ border: '1px solid #f0e6e0', boxShadow: '0 8px 24px -16px rgba(36,21,18,0.15)' }}
                            onFocus={e => (e.target.style.borderColor = MAROON)}
                            onBlur={e => (e.target.style.borderColor = '#f0e6e0')}
                        />
                    </div>

                    <div className="relative sm:w-52 shrink-0">
                        <select
                            value={priorityFilter}
                            onChange={e => setPriorityFilter(e.target.value)}
                            className="w-full appearance-none bg-white pl-4 pr-9 py-3 text-sm font-bold rounded-2xl outline-none transition-all cursor-pointer"
                            style={{
                                border: '1px solid #f0e6e0',
                                boxShadow: '0 8px 24px -16px rgba(36,21,18,0.15)',
                                color: priorityFilter === 'all' ? '#374151' : PRIORITY_CONFIG[priorityFilter]?.text,
                            }}
                        >
                            <option value="all">All Priorities</option>
                            <option value="critical">Critical</option>
                            <option value="important">Important</option>
                            <option value="info">Info</option>
                        </select>
                        <ChevronDown size={15} className="absolute right-3.5 top-3.5 pointer-events-none" style={{ color: '#c9b3b8' }} />
                    </div>
                </div>

                {/* Sender Filter — underline tabs */}
                <div className="flex gap-6 mb-6 flex-wrap border-b" style={{ borderColor: '#f0e6e0' }}>
                    {SOURCE_TABS.map(f => (
                        <button
                            key={f.key}
                            onClick={() => setSourceFilter(f.key)}
                            className="text-xs pb-2.5 font-bold uppercase tracking-wider transition-colors"
                            style={{
                                color: sourceFilter === f.key ? MAROON : '#c9b3b8',
                                borderBottom: sourceFilter === f.key ? `2px solid ${MAROON}` : '2px solid transparent',
                                marginBottom: -1,
                            }}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Announcements — pinned notice cards */}
                {loading ? (
                    <div className="space-y-5 pt-2">
                        {Array(4).fill(0).map((_, i) => (
                            <div key={i} className="animate-pulse rounded-2xl h-28" style={{ background: '#EFE7E2' }} />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="bg-white rounded-[2rem] p-16 text-center" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)' }}>
                        <Megaphone size={40} className="mx-auto mb-3" style={{ color: '#e9d9dc' }} />
                        <p className="text-sm font-bold" style={{ color: '#c9b3b8' }}>No announcements found.</p>
                    </div>
                ) : (
                    <div className="space-y-6 pb-8">
                        {filtered.map((ann, idx) => {
                            const cfg = PRIORITY_CONFIG[ann.priority] || PRIORITY_CONFIG.info;
                            const src = SOURCE_CONFIG[ann.created_by_role];
                            return (
                                <div key={ann.id} className="relative">
                                    {/* push-pin — overlaps the card's top edge, like a notice pinned to a board */}
                                    <span
                                        className="absolute left-6 -top-2 w-4 h-4 rounded-full z-10"
                                        style={{ background: cfg.pin, boxShadow: '0 2px 4px rgba(36,21,18,0.35)', border: '2px solid #fff' }}
                                    />

                                    <div
                                        className="relative bg-white rounded-2xl overflow-hidden pt-5 px-5 pb-5"
                                        style={{ boxShadow: '0 10px 26px -16px rgba(36,21,18,0.22)' }}
                                    >
                                        {/* folded-corner ribbon — priority colour, top-right */}
                                        <div
                                            className="absolute top-0 right-0 w-0 h-0"
                                            style={{ borderStyle: 'solid', borderWidth: '0 34px 34px 0', borderColor: `transparent ${cfg.pin} transparent transparent` }}
                                        />
                                        <span className="absolute top-1.5 right-1 z-10" style={{ color: '#fff' }}>
                                            <PriorityIcon priority={ann.priority} size={11} />
                                        </span>

                                        <div className="flex items-center gap-2 mb-2 flex-wrap pr-8">
                                            {idx === 0 && (
                                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white" style={{ background: MAROON }}>
                                                    Latest
                                                </span>
                                            )}
                                            <span
                                                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                                style={{ background: cfg.bg, color: cfg.text }}
                                            >
                                                {cfg.label}
                                            </span>
                                            {src && (
                                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                                                    {src.label}
                                                </span>
                                            )}
                                        </div>

                                        <h4 className="font-bold text-base" style={{ ...serif, color: INK }}>{ann.title}</h4>
                                        <p className="text-xs mt-2 leading-relaxed text-slate-500">{ann.content}</p>

                                        <div className="flex items-center gap-2 mt-4 pt-3" style={{ borderTop: '1px solid #f5eee9' }}>
                                            <Clock size={10} style={{ color: '#c9b3b8' }} />
                                            <p className="text-[10px]" style={{ color: '#c9b3b8' }}>
                                                {new Date(ann.created_at).toLocaleDateString('en-PH', {
                                                    year: 'numeric', month: 'long', day: 'numeric',
                                                })}
                                            </p>
                                            <span className="text-[10px]" style={{ color: '#c9b3b8' }}>•</span>
                                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: MAROON }}>
                                                {ann.created_by}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScholarAnnouncements;