import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Megaphone, Clock, Search, Plus, X, Send,
    ChevronDown, AlertCircle, AlertTriangle, Info, User,
} from 'lucide-react';

const API = 'http://localhost:5000/api';

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

function PriorityIcon({ priority, size = 14 }) {
    if (priority === 'critical')  return <AlertCircle  size={size} />;
    if (priority === 'important') return <AlertTriangle size={size} />;
    return <Info size={size} />;
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
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-[#7f2d3a] transition-all"
            >
                <span className={value.length ? 'text-slate-800' : 'text-slate-400'}>{displayLabel()}</span>
                <ChevronDown size={14} className="text-slate-400 flex-shrink-0 ml-2" />
            </button>
            {open && (
                <>
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-auto" style={{ maxHeight: 260 }}>
                        {AUDIENCE_GROUPS.map(group => (
                            <div key={group.label}>
                                <p className="px-3 pt-2.5 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{group.label}</p>
                                {group.options.map(opt => {
                                    const selected = value.includes(opt.value);
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => toggle(opt.value)}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 transition-colors text-sm text-slate-700"
                                        >
                                            <span
                                                className="w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center"
                                                style={{ borderColor: selected ? '#7f2d3a' : '#d1d5db', backgroundColor: selected ? '#7f2d3a' : '#fff' }}
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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-xl overflow-hidden">

                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100" style={{ background: '#F5E8EA' }}>
                    <div>
                        <h2 className="font-black text-[#7f2d3a] text-base font-serif">New Announcement</h2>
                        <p className="text-[11px] text-slate-500 mt-0.5">Visible to scholars</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-white/60 transition-all">
                        <X size={16} />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div>
                        <label className="text-[10px] font-black text-[#7f2d3a] uppercase tracking-widest block mb-1.5">Title *</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g. Duty Schedule Update"
                            className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm outline-none focus:border-[#7f2d3a] transition-all"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-[#7f2d3a] uppercase tracking-widest block mb-1.5">Priority *</label>
                        <div className="flex gap-2">
                            {['info', 'important', 'critical'].map(p => {
                                const cfg    = PRIORITY_CONFIG[p];
                                const active = priority === p;
                                return (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setPriority(p)}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-bold transition-all capitalize"
                                        style={{ background: active ? cfg.bg : '#f8fafc', color: active ? cfg.text : '#94a3b8', borderColor: active ? cfg.border : '#e2e8f0' }}
                                    >
                                        <PriorityIcon priority={p} size={13} />
                                        {cfg.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-[#7f2d3a] uppercase tracking-widest block mb-1.5">
                            Scholar Year Level <span className="text-slate-400 normal-case font-medium">(optional — leave blank for all)</span>
                        </label>
                        <LevelSelector value={levels} onChange={setLevels} />
                        {levels.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {levels.map(a => (
                                    <span key={a} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: '#F5E8EA', color: '#7f2d3a' }}>
                                        {getLevelLabel(a)}
                                        <button type="button" onClick={() => setLevels(levels.filter(v => v !== a))}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#7f2d3a' }}>
                                            <X size={10} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-[#7f2d3a] uppercase tracking-widest block mb-1.5">Message *</label>
                        <textarea
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            placeholder="Write your announcement here..."
                            rows={4}
                            className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm outline-none focus:border-[#7f2d3a] transition-all resize-none"
                        />
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 px-4 py-2.5 rounded-xl">
                        <User size={12} />
                        <span>Posting as <span className="font-bold text-[#7f2d3a]">{authorName}</span></span>
                    </div>

                    {error && <p className="text-xs text-red-500 font-bold bg-red-50 px-4 py-2.5 rounded-xl">{error}</p>}
                </div>

                <div className="px-6 pb-6 pt-4 border-t border-slate-100 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-500 text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all">
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="flex-1 py-3 rounded-2xl bg-[#7f2d3a] text-white text-xs font-black uppercase tracking-widest hover:bg-[#63232d] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        <Send size={12} />
                        {submitting ? 'Posting...' : 'Post Announcement'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function AnnouncementCard({ ann, isLatest, onNotify, notifyingId }) {
    const cfg    = PRIORITY_CONFIG[ann.priority] || PRIORITY_CONFIG.info;
    const levels = ann.target_levels || [];
    const src    = SOURCE_CONFIG[ann.created_by_role];

    return (
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm" style={{ borderLeft: `4px solid ${cfg.border}` }}>
            <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl mt-0.5 flex-shrink-0" style={{ background: cfg.bg, color: cfg.text }}>
                    <PriorityIcon priority={ann.priority} size={14} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        {isLatest && (
                            <span className="text-[10px] bg-[#7f2d3a] text-white font-black uppercase tracking-wider px-2 py-0.5 rounded-lg">Latest</span>
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg capitalize" style={{ background: cfg.bg, color: cfg.text }}>{cfg.label}</span>
                        {src && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 uppercase tracking-wider">
                                {src.label}
                            </span>
                        )}
                    </div>
                    <h4 className="font-black text-slate-800 text-sm mb-1">{ann.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{ann.content}</p>
                    {levels.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                            {levels.map(lv => (
                                <span key={lv} className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-lg">{getLevelLabel(lv)}</span>
                            ))}
                        </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-50">
                        <Clock size={10} className="text-slate-300" />
                        <span className="text-[10px] text-slate-300">
                            {new Date(ann.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                        <span className="text-[10px] text-slate-300">•</span>
                        <span className="text-[10px] font-bold text-[#7f2d3a] uppercase tracking-wider">{ann.created_by}</span>
                        <button
                            onClick={() => onNotify(ann.id)}
                            disabled={notifyingId === ann.id}
                            className="ml-auto px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all disabled:opacity-50"
                        >
                            {notifyingId === ann.id ? 'Sending...' : 'Notify'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

const StaffAnnouncement = () => {
    const staffName = localStorage.getItem('name') || 'Staff';

    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading]     = useState(true);
    const [search, setSearch]       = useState('');
    const [sourceFilter, setSourceFilter]     = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [showModal, setShowModal] = useState(false);
    const [notifyingId, setNotifyingId] = useState(null);
    const [notifyMessage, setNotifyMessage] = useState('');
    const [notifyError, setNotifyError] = useState('');

    const fetchAnnouncements = async () => {
        try {
            const res = await axios.get(`${API}/staff/announcements`);
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
            const res = await axios.post(`${API}/staff/announcements/${id}/notify`);
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
        <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 font-sans">

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-6">
                <span className="text-[10px] bg-blue-100 text-blue-700 font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full">
                    Staff Portal
                </span>
                <div className="flex items-start justify-between mt-2 gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight font-serif">Announcements</h1>
                        <p className="text-xs text-slate-400 mt-1">Post to scholars, and view announcements sent to staff.</p>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-[#7f2d3a] text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-[#63232d] transition-all"
                    >
                        <Plus size={13} /> New
                    </button>
                </div>
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
                        style={{ color: priorityFilter === 'all' ? '#334155' : PRIORITY_CONFIG[priorityFilter]?.text }}
                    >
                        <option value="all">All Priorities</option>
                        <option value="critical">Critical</option>
                        <option value="important">Important</option>
                        <option value="info">Info</option>
                    </select>
                    <ChevronDown size={15} className="absolute right-3.5 top-3.5 text-slate-400 pointer-events-none" />
                </div>
            </div>

            {notifyMessage && (
                <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                    {notifyMessage}
                </div>
            )}
            {notifyError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
                    {notifyError}
                </div>
            )}

            {/* Sender Filter */}
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
                    {filtered.map((ann, idx) => (
                        <AnnouncementCard key={ann.id} ann={ann} isLatest={idx === 0} onNotify={handleNotifyAnnouncement} notifyingId={notifyingId} />
                    ))}
                </div>
            )}

            {showModal && (
                <CreateModal authorName={staffName} onClose={() => setShowModal(false)} onCreated={fetchAnnouncements} />
            )}
        </div>
    );
};

export default StaffAnnouncement;