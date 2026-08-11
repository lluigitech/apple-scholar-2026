import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Megaphone, Trash2, ToggleLeft, ToggleRight, Clock, Plus, Users,
    ChevronDown, X, AlertCircle, AlertTriangle, Info, Search, Send,
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
    critical:  { dot: '#dc2626', text: '#991b1b', border: '#7f2d3a', label: 'Critical'  },
    important: { dot: '#d97706', text: '#92400e', border: '#d97706', label: 'Important' },
    info:      { dot: '#2563eb', text: '#1e40af', border: '#93c5fd', label: 'Info'      },
};
function PriorityIcon({ priority, size = 12 }) {
    if (priority === 'critical')  return <AlertCircle size={size} />;
    if (priority === 'important') return <AlertTriangle size={size} />;
    return <Info size={size} />;
}

const ROLE_OPTIONS = [
    { value: 'scholar', label: 'Scholars' },
    { value: 'staff',   label: 'Staff'    },
    { value: 'officer', label: 'Officers' },
];

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
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 text-sm outline-none focus:border-[#7f2d3a] transition-all"
            >
                <span className={value.length ? 'text-slate-800' : 'text-slate-400'}>{displayLabel()}</span>
                <ChevronDown size={14} className="text-slate-400 flex-shrink-0 ml-2" />
            </button>
            {open && (
                <>
                    <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-auto" style={{ maxHeight: 260 }}>
                        {AUDIENCE_GROUPS.map(group => (
                            <div key={group.label}>
                                <p className="px-3.5 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{group.label}</p>
                                {group.options.map(opt => {
                                    const selected = value.includes(opt.value);
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => toggle(opt.value)}
                                            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-slate-50 transition-colors text-sm text-slate-700"
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

    const [search, setSearch] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('all');

    const createdBy = localStorage.getItem('id') || localStorage.getItem('user_id') || null;

    const fetchAnnouncements = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API}/admin/announcements`);
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
        if (roles.length === 3) return 'All Users';
        return roles.map(r => ROLE_OPTIONS.find(o => o.value === r)?.label || r).join(', ');
    };

    const handleBroadcast = async () => {
        setError('');
        setSuccess('');

        if (!title.trim() || !content.trim()) {
            setError('Title and message are required.');
            return;
        }
        if (!targetRoles.length) {
            setError('Please select at least one audience.');
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
            });
            setTitle('');
            setContent('');
            setPriority('info');
            setTargetRoles(['scholar', 'staff', 'officer']);
            setTargetLevels([]);
            setSuccess('Announcement broadcasted successfully!');
            fetchAnnouncements();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.error || 'Error broadcasting announcement.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleNotifyAnnouncement = async (id) => {
        setNotifyError('');
        setNotifyMessage('');
        setNotifyingId(id);

        try {
            const res = await axios.post(`${API}/admin/announcements/${id}/notify`);
            const sentCount = res.data?.sent_count ?? 0;
            setNotifyMessage(`Notifications sent to ${sentCount} recipient(s).`);
        } catch (err) {
            setNotifyError(err.response?.data?.error || 'Failed to send notifications.');
        } finally {
            setNotifyingId(null);
        }
    };

    const handleDelete = async () => {
        try {
            await axios.delete(`${API}/admin/announcements/${selectedAnn.id}`);
            setShowDeleteModal(false);
            fetchAnnouncements();
        } catch (err) {
            console.error('Error deleting:', err);
        }
    };

    const handleToggle = async (id) => {
        try {
            await axios.put(`${API}/admin/announcements/${id}/toggle`);
            fetchAnnouncements();
        } catch (err) {
            console.error('Error toggling:', err);
        }
    };

    const CheckBox = ({ label, checked, onChange }) => (
        <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:border-[#7f2d3a]/30 hover:bg-[#7f2d3a]/[0.02] transition-all">
            <div
                onClick={onChange}
                className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all cursor-pointer shrink-0 ${
                    checked ? 'bg-[#7f2d3a] border-[#7f2d3a]' : 'border-slate-300 bg-white'
                }`}
            >
                {checked && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                )}
            </div>
            <span className="text-sm font-medium text-slate-700">{label}</span>
        </label>
    );

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

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 font-sans">

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-6 font-serif">
                <span className="text-[10px] bg-[#7f2d3a]/10 text-[#7f2d3a] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full font-sans">
                    Foundation Wide Communication
                </span>
                <h1 className="text-3xl font-black text-slate-800 mt-2 tracking-tight">Global Announcements</h1>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-6 items-start">

                {/* ── LEFT: Create Form ─────────────────────── */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 md:p-8">
                    <h3 className="font-bold text-slate-800 text-base mb-6 flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-[#7f2d3a]/10 flex items-center justify-center">
                            <Plus size={15} className="text-[#7f2d3a]" />
                        </span>
                        Create Announcement
                    </h3>

                    <div className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Title</label>
                            <input
                                type="text"
                                value={title}
                                placeholder="e.g., Scholarship Renewal Period"
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-slate-50/60 border border-slate-200 p-3.5 rounded-xl text-sm text-slate-800 outline-none focus:border-[#7f2d3a] focus:bg-white focus:ring-2 focus:ring-[#7f2d3a]/10 transition-all placeholder:text-slate-300"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Message</label>
                            <textarea
                                rows="5"
                                value={content}
                                placeholder="Enter your announcement message..."
                                onChange={(e) => setContent(e.target.value)}
                                className="w-full bg-slate-50/60 border border-slate-200 p-3.5 rounded-xl text-sm text-slate-800 outline-none focus:border-[#7f2d3a] focus:bg-white focus:ring-2 focus:ring-[#7f2d3a]/10 transition-all placeholder:text-slate-300 resize-none"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Priority</label>
                            <div className="flex gap-2">
                                {['info', 'important', 'critical'].map(p => {
                                    const cfg = PRIORITY_CONFIG[p];
                                    const active = priority === p;
                                    return (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => setPriority(p)}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-bold transition-all capitalize"
                                            style={{
                                                background:  active ? '#7f2d3a' : '#fff',
                                                color:       active ? '#fff'    : '#64748b',
                                                borderColor: active ? '#7f2d3a' : '#e2e8f0',
                                            }}
                                        >
                                            <PriorityIcon priority={p} />
                                            {cfg.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Broadcast To</label>
                            <CheckBox label="All Scholars" checked={targetRoles.includes('scholar')} onChange={() => toggleRole('scholar')} />
                            <CheckBox label="Staff" checked={targetRoles.includes('staff')} onChange={() => toggleRole('staff')} />
                            <CheckBox label="Officers" checked={targetRoles.includes('officer')} onChange={() => toggleRole('officer')} />
                        </div>

                        {targetRoles.includes('scholar') && (
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">
                                    Scholar Year Level <span className="text-slate-400 font-normal">(optional)</span>
                                </label>
                                <LevelSelector value={targetLevels} onChange={setTargetLevels} />
                                {targetLevels.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                        {targetLevels.map(lv => (
                                            <span key={lv} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: '#F5E8EA', color: '#7f2d3a' }}>
                                                {getLevelLabel(lv)}
                                                <button type="button" onClick={() => setTargetLevels(targetLevels.filter(v => v !== lv))}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#7f2d3a' }}>
                                                    <X size={10} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {error && <p className="text-xs text-red-600 font-semibold bg-red-50 px-3.5 py-2.5 rounded-xl">{error}</p>}
                        {success && <p className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-3.5 py-2.5 rounded-xl">{success}</p>}

                        <button
                            onClick={handleBroadcast}
                            disabled={submitting}
                            className="w-full bg-[#7f2d3a] hover:bg-[#63232d] text-white disabled:opacity-50 font-bold text-sm px-6 py-3.5 rounded-xl uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-300 shadow-sm shadow-[#7f2d3a]/20"
                        >
                            <Megaphone size={15} />
                            {submitting ? 'Broadcasting...' : 'Broadcast Announcement'}
                        </button>
                    </div>
                </div>

                {/* ── RIGHT: Manage Announcements ───────────── */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 md:p-8">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="font-bold text-slate-800 text-base">Your Announcements</h3>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                            {counts.total} total
                        </span>
                    </div>

                    {/* Compact stat strip */}
                    <div className="flex items-center gap-4 mb-5 px-1">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-xs font-bold text-slate-600">{counts.critical} Critical</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            <span className="text-xs font-bold text-slate-600">{counts.important} Important</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="text-xs font-bold text-slate-600">{counts.total - counts.critical - counts.important} Info</span>
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

                    {/* Search + Priority */}
                    <div className="flex gap-2.5 mb-5">
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-3 text-slate-300" size={15} />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full bg-slate-50/60 border border-slate-200 pl-9 pr-3 py-2.5 text-xs rounded-xl outline-none focus:border-[#7f2d3a] focus:bg-white focus:ring-2 focus:ring-[#7f2d3a]/10 transition-all placeholder:text-slate-300"
                            />
                        </div>
                        <div className="relative w-36 shrink-0">
                            <select
                                value={priorityFilter}
                                onChange={e => setPriorityFilter(e.target.value)}
                                className="w-full appearance-none bg-slate-50/60 border border-slate-200 pl-3 pr-8 py-2.5 text-xs font-bold rounded-xl outline-none focus:border-[#7f2d3a] focus:bg-white focus:ring-2 focus:ring-[#7f2d3a]/10 transition-all cursor-pointer text-slate-600"
                            >
                                <option value="all">All Priorities</option>
                                <option value="critical">Critical</option>
                                <option value="important">Important</option>
                                <option value="info">Info</option>
                            </select>
                            <ChevronDown size={13} className="absolute right-2.5 top-3 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    {loading ? (
                        <div className="space-y-3">
                            {Array(3).fill(0).map((_, i) => (
                                <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-16 text-slate-300">
                            <Megaphone size={36} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm font-bold text-slate-400">
                                {announcements.length === 0 ? "You haven't posted any announcements yet." : 'No results found.'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2.5 overflow-y-auto max-h-[440px] pr-1 -mr-1">
                            {filtered.map((ann) => {
                                const cfg = PRIORITY_CONFIG[ann.priority] || PRIORITY_CONFIG.info;
                                return (
                                    <div
                                        key={ann.id}
                                        className={`p-4 rounded-2xl border transition-all group ${
                                            ann.is_active ? 'bg-white border-slate-100 hover:border-slate-200' : 'bg-slate-50/60 border-slate-100 opacity-60'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className="w-1.5 self-stretch rounded-full shrink-0" style={{ background: cfg.dot }} />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-[10px] font-bold flex items-center gap-1" style={{ color: cfg.text }}>
                                                            <PriorityIcon priority={ann.priority} size={11} />
                                                            {cfg.label}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleNotifyAnnouncement(ann.id)}
                                                            disabled={notifyingId === ann.id}
                                                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all disabled:opacity-50"
                                                        >
                                                            {notifyingId === ann.id ? 'Sending...' : 'Notify'}
                                                        </button>
                                                        <button onClick={() => handleToggle(ann.id)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title={ann.is_active ? 'Deactivate' : 'Activate'}>
                                                            {ann.is_active ? <ToggleRight size={15} className="text-emerald-500" /> : <ToggleLeft size={15} className="text-slate-400" />}
                                                        </button>
                                                        <button onClick={() => { setSelectedAnn(ann); setShowDeleteModal(true); }} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                                                            <Trash2 size={13} className="text-slate-300 hover:text-red-500 transition-colors" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <h4 className="font-bold text-slate-800 text-sm leading-snug mt-1">{ann.title}</h4>
                                                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{ann.content}</p>
                                                <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-slate-50">
                                                    <Clock size={10} className="text-slate-300" />
                                                    <p className="text-[10px] text-slate-400">
                                                        {new Date(ann.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </p>
                                                    <span className="text-slate-200">•</span>
                                                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                        <Users size={9} />
                                                        {getAudienceLabel(ann)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {showDeleteModal && selectedAnn && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center">
                        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash2 size={24} className="text-red-500" />
                        </div>
                        <h3 className="font-black text-slate-800 text-lg">Delete Announcement?</h3>
                        <p className="text-xs text-slate-400 mt-2 mb-6">
                            Are you sure you want to delete <span className="font-bold text-slate-700">"{selectedAnn.title}"</span>? This cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all">
                                Cancel
                            </button>
                            <button onClick={handleDelete} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-xs hover:bg-red-600 transition-all">
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminAnnouncement;