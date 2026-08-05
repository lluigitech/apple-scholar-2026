import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Megaphone, Clock, Search, Plus, X, Send, ChevronDown, Users } from 'lucide-react';

const API = 'http://localhost:5000/api';

const YEAR_LEVELS = [
    { value: 'grade_7',    label: 'Grade 7' },
    { value: 'grade_8',    label: 'Grade 8' },
    { value: 'grade_9',    label: 'Grade 9' },
    { value: 'grade_10',   label: 'Grade 10' },
    { value: 'grade_11',   label: 'Grade 11' },
    { value: 'grade_12',   label: 'Grade 12' },
    { value: 'college_1',  label: '1st Year College' },
    { value: 'college_2',  label: '2nd Year College' },
    { value: 'college_3',  label: '3rd Year College' },
    { value: 'college_4',  label: '4th Year College' },
    { value: 'college_5',  label: '5th Year College' },
];

const StaffCommunication = () => {
    const staffName = localStorage.getItem('name') || 'Staff';

    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // modal
    const [showModal, setShowModal] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [targetAll, setTargetAll] = useState(true);
    const [selectedLevels, setSelectedLevels] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');

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

    const toggleLevel = (val) => {
        setSelectedLevels(prev =>
            prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
        );
    };

    const resetModal = () => {
        setTitle('');
        setContent('');
        setTargetAll(true);
        setSelectedLevels([]);
        setFormError('');
        setShowModal(false);
    };

    const handleSubmit = async () => {
        if (!title.trim()) { setFormError('Title is required.'); return; }
        if (!content.trim()) { setFormError('Content is required.'); return; }
        if (!targetAll && selectedLevels.length === 0) {
            setFormError('Please select at least one year level.'); return;
        }
        setFormError('');
        setSubmitting(true);
        try {
            await axios.post(`${API}/staff/announcements`, {
                title: title.trim(),
                content: content.trim(),
                created_by: staffName,
                target_levels: targetAll ? YEAR_LEVELS.map(y => y.value) : selectedLevels,
            });
            await fetchAnnouncements();
            resetModal();
        } catch (err) {
            console.error(err);
            setFormError('Failed to post announcement. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const filtered = announcements.filter(ann =>
        ann.title.toLowerCase().includes(search.toLowerCase()) ||
        ann.content.toLowerCase().includes(search.toLowerCase())
    );

    const getLevelLabel = (val) => YEAR_LEVELS.find(y => y.value === val)?.label || val;

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 font-sans">

            {/* Header */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-6 font-serif">
                <span className="text-[10px] bg-blue-100 text-blue-700 font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full font-sans">
                    Foundation Updates
                </span>
                <div className="flex items-start justify-between mt-2 gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Communication</h1>
                        <p className="text-xs text-slate-400 mt-1 font-sans">Post and view announcements for scholars.</p>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-[#7f2d3a] text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-[#63232d] transition-all"
                    >
                        <Plus size={13} /> New
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="relative mb-6">
                <Search className="absolute left-4 top-3.5 text-slate-300" size={16} />
                <input
                    type="text"
                    placeholder="Search announcements..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full bg-white border border-slate-200 pl-11 pr-4 py-3 text-sm rounded-2xl outline-none focus:border-[#7f2d3a] focus:ring-2 focus:ring-[#7f2d3a]/10 transition-all placeholder:text-slate-300 shadow-sm"
                />
            </div>

            {/* List */}
            {loading ? (
                <div className="space-y-4">
                    {Array(3).fill(0).map((_, i) => (
                        <div key={i} className="animate-pulse bg-slate-100 rounded-2xl h-24" />
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
                        <div key={ann.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm border-l-4 border-l-[#7f2d3a]">
                            {idx === 0 && (
                                <span className="text-[10px] bg-[#7f2d3a] text-white font-black uppercase tracking-wider px-2 py-0.5 rounded-lg mb-2 inline-block">
                                    Latest
                                </span>
                            )}
                            <h4 className="font-black text-slate-800 text-sm">{ann.title}</h4>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{ann.content}</p>

                            {/* Target levels */}
                            {ann.target_levels && ann.target_levels.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-3">
                                    {ann.target_levels.length === YEAR_LEVELS.length ? (
                                        <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 font-bold px-2 py-0.5 rounded-lg flex items-center gap-1">
                                            <Users size={9} /> All Scholars
                                        </span>
                                    ) : (
                                        ann.target_levels.map(lv => (
                                            <span key={lv} className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-lg">
                                                {getLevelLabel(lv)}
                                            </span>
                                        ))
                                    )}
                                </div>
                            )}

                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-50">
                                <Clock size={10} className="text-slate-300" />
                                <p className="text-[10px] text-slate-300">
                                    {new Date(ann.created_at).toLocaleDateString('en-PH', {
                                        year: 'numeric', month: 'long', day: 'numeric'
                                    })}
                                </p>
                                <span className="text-[10px] text-slate-300">•</span>
                                <span className="text-[10px] font-bold text-[#7f2d3a] uppercase tracking-wider">{ann.created_by}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── CREATE MODAL ── */}
            {showModal && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-xl overflow-hidden">

                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
                            <div>
                                <h2 className="font-black text-slate-800 text-base">New Announcement</h2>
                                <p className="text-[11px] text-slate-400 mt-0.5">Visible to scholars only</p>
                            </div>
                            <button
                                onClick={resetModal}
                                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Modal body */}
                        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">

                            {/* Title */}
                            <div>
                                <label className="text-[10px] font-black text-[#7f2d3a] uppercase tracking-widest block mb-1.5">
                                    Title *
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="e.g. Deadline Reminder for Grade Submission"
                                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm outline-none focus:border-[#7f2d3a] transition-all"
                                />
                            </div>

                            {/* Content */}
                            <div>
                                <label className="text-[10px] font-black text-[#7f2d3a] uppercase tracking-widest block mb-1.5">
                                    Content *
                                </label>
                                <textarea
                                    value={content}
                                    onChange={e => setContent(e.target.value)}
                                    placeholder="Write your announcement here..."
                                    rows={4}
                                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm outline-none focus:border-[#7f2d3a] transition-all resize-none"
                                />
                            </div>

                            {/* Target */}
                            <div>
                                <label className="text-[10px] font-black text-[#7f2d3a] uppercase tracking-widest block mb-2">
                                    Target Year Level *
                                </label>

                                {/* All toggle */}
                                <button
                                    onClick={() => { setTargetAll(true); setSelectedLevels([]); }}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-bold transition-all mb-3 ${
                                        targetAll
                                            ? 'bg-[#7f2d3a] text-white border-[#7f2d3a]'
                                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <Users size={14} />
                                    All Scholars (Grade 7 — 5th Year College)
                                </button>

                                {/* Specific levels */}
                                <button
                                    onClick={() => setTargetAll(false)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-bold transition-all mb-3 ${
                                        !targetAll
                                            ? 'bg-[#7f2d3a]/10 text-[#7f2d3a] border-[#7f2d3a]/30'
                                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <ChevronDown size={14} />
                                    Select specific year levels
                                </button>

                                {!targetAll && (
                                    <div className="grid grid-cols-2 gap-2">
                                        {YEAR_LEVELS.map(lv => {
                                            const selected = selectedLevels.includes(lv.value);
                                            return (
                                                <button
                                                    key={lv.value}
                                                    onClick={() => toggleLevel(lv.value)}
                                                    className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all text-left ${
                                                        selected
                                                            ? 'bg-[#7f2d3a] text-white border-[#7f2d3a]'
                                                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-[#7f2d3a]/30 hover:text-[#7f2d3a]'
                                                    }`}
                                                >
                                                    {selected ? '✓ ' : ''}{lv.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {formError && (
                                <p className="text-xs text-red-500 font-bold bg-red-50 px-4 py-2.5 rounded-xl">
                                    {formError}
                                </p>
                            )}
                        </div>

                        {/* Modal footer */}
                        <div className="px-6 pb-6 pt-4 border-t border-slate-100 flex gap-3">
                            <button
                                onClick={resetModal}
                                className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-500 text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="flex-1 py-3 rounded-2xl bg-[#7f2d3a] text-white text-xs font-black uppercase tracking-widest hover:bg-[#63232d] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                            >
                                <Send size={12} /> {submitting ? 'Posting...' : 'Post Announcement'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffCommunication;