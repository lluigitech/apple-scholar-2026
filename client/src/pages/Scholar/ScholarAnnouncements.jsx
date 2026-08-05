import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Megaphone, Clock, Search, AlertCircle, AlertTriangle, Info, ChevronDown } from 'lucide-react';

const PRIORITY_CONFIG = {
    critical:  { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5', label: 'Critical'  },
    important: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d', label: 'Important' },
    info:      { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd', label: 'Info'      },
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

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 font-sans">

            {/* Header */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-6 font-serif">
                <span className="text-[10px] bg-blue-100 text-blue-700 font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full font-sans">
                    Foundation Updates
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-800 mt-2 tracking-tight">Announcements</h1>
                <p className="text-xs text-slate-400 mt-1 font-sans">Stay updated with the latest from Kalinga Foundation.</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="rounded-2xl p-4 text-center" style={{ background: '#fee2e2' }}>
                    <p className="text-2xl font-black font-serif" style={{ color: '#991b1b' }}>{counts.critical}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: '#991b1b' }}>Critical</p>
                </div>
                <div className="rounded-2xl p-4 text-center" style={{ background: '#fef3c7' }}>
                    <p className="text-2xl font-black font-serif" style={{ color: '#92400e' }}>{counts.important}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: '#92400e' }}>Important</p>
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl p-4 text-center">
                    <p className="text-2xl font-black font-serif text-slate-700">{counts.total}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Total</p>
                </div>
            </div>

            {/* Search + Priority Dropdown */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-3.5 text-slate-300" size={16} />
                    <input
                        type="text"
                        placeholder="Search announcements..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-white border border-slate-200 pl-11 pr-4 py-3 text-sm rounded-2xl outline-none focus:border-[#7f2d3a] focus:ring-2 focus:ring-[#7f2d3a]/10 transition-all placeholder:text-slate-300 shadow-sm"
                    />
                </div>

                <div className="relative sm:w-52 shrink-0">
                    <select
                        value={priorityFilter}
                        onChange={e => setPriorityFilter(e.target.value)}
                        className="w-full appearance-none bg-white border border-slate-200 pl-4 pr-9 py-3 text-sm font-bold rounded-2xl outline-none focus:border-[#7f2d3a] focus:ring-2 focus:ring-[#7f2d3a]/10 transition-all shadow-sm cursor-pointer"
                        style={{
                            color: priorityFilter === 'all' ? '#334155' : PRIORITY_CONFIG[priorityFilter]?.text,
                        }}
                    >
                        <option value="all">All Priorities</option>
                        <option value="critical">Critical</option>
                        <option value="important">Important</option>
                        <option value="info">Info</option>
                    </select>
                    <ChevronDown size={15} className="absolute right-3.5 top-3.5 text-slate-400 pointer-events-none" />
                </div>
            </div>

            {/* Sender Filter — pills */}
            <div className="flex gap-2 mb-5 flex-wrap">
                {SOURCE_TABS.map(f => (
                    <button
                        key={f.key}
                        onClick={() => setSourceFilter(f.key)}
                        className="text-xs px-4 py-1.5 rounded-xl border font-bold capitalize transition-all"
                        style={{
                            background:  sourceFilter === f.key ? '#7f2d3a' : '#fff',
                            color:       sourceFilter === f.key ? '#fff'    : '#64748b',
                            borderColor: sourceFilter === f.key ? '#7f2d3a' : '#e2e8f0',
                        }}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Announcements */}
            {loading ? (
                <div className="space-y-4">
                    {Array(4).fill(0).map((_, i) => (
                        <div key={i} className="animate-pulse bg-slate-100 rounded-2xl h-28" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-16 text-center">
                    <Megaphone size={40} className="mx-auto mb-3 text-slate-200" />
                    <p className="text-sm font-bold text-slate-300">No announcements found.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filtered.map((ann, idx) => {
                        const cfg = PRIORITY_CONFIG[ann.priority] || PRIORITY_CONFIG.info;
                        const src = SOURCE_CONFIG[ann.created_by_role];
                        return (
                            <div
                                key={ann.id}
                                className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all"
                                style={{ borderLeft: `4px solid ${cfg.border}` }}
                            >
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    {idx === 0 && (
                                        <span className="text-[10px] bg-[#7f2d3a] text-white font-black uppercase tracking-wider px-2 py-0.5 rounded-lg">
                                            Latest
                                        </span>
                                    )}
                                    <span
                                        className="text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1"
                                        style={{ background: cfg.bg, color: cfg.text }}
                                    >
                                        <PriorityIcon priority={ann.priority} />
                                        {cfg.label}
                                    </span>
                                    {src && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 uppercase tracking-wider">
                                            {src.label}
                                        </span>
                                    )}
                                </div>

                                <h4 className="font-black text-slate-800 text-sm leading-snug">{ann.title}</h4>
                                <p className="text-xs text-slate-500 mt-2 leading-relaxed">{ann.content}</p>

                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-50">
                                    <Clock size={10} className="text-slate-300" />
                                    <p className="text-[10px] text-slate-300">
                                        {new Date(ann.created_at).toLocaleDateString('en-PH', {
                                            year: 'numeric', month: 'long', day: 'numeric',
                                        })}
                                    </p>
                                    <span className="text-[10px] text-slate-300">•</span>
                                    <span className="text-[10px] font-bold text-[#7f2d3a] uppercase tracking-wider">
                                        {ann.created_by}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ScholarAnnouncements;