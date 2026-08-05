import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    CalendarDays, MapPin, Clock, Users, Plus,
    Trash2, Edit3, X, CheckCircle, Loader2
} from 'lucide-react';

const DutyManagement = () => {
    const createdBy = localStorage.getItem('name') || 'Admin';
    const [duties, setDuties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedDuty, setSelectedDuty] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    const yearLevels = [
        'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10',
        'Grade 11', 'Grade 12',
        '1st Year College', '2nd Year College', '3rd Year College',
        '4th Year College', '5th Year College'
    ];

    const [form, setForm] = useState({
        title: '',
        description: '',
        location: '',
        duty_date: '',
        time_start: '',
        time_end: '',
        target_audience: ['all'],
        status: 'upcoming'
    });

    const fetchDuties = async () => {
        try {
            setLoading(true);
            const res = await axios.get('http://localhost:5000/api/duties');
            setDuties(res.data);
        } catch (err) {
            console.error('Error fetching duties:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchDuties(); }, []);

    const handleTargetToggle = (level) => {
        if (level === 'all') {
            setForm(p => ({ ...p, target_audience: ['all'] }));
            return;
        }
        setForm(prev => {
            const current = prev.target_audience.filter(t => t !== 'all');
            if (current.includes(level)) {
                const updated = current.filter(t => t !== level);
                return { ...prev, target_audience: updated.length === 0 ? ['all'] : updated };
            } else {
                return { ...prev, target_audience: [...current, level] };
            }
        });
    };

    const handleSubmit = async () => {
        setError('');
        if (!form.title || !form.duty_date) {
            setError('Title and date are required.');
            return;
        }
        try {
            setSubmitting(true);
            if (selectedDuty) {
                await axios.put(`http://localhost:5000/api/duties/${selectedDuty.id}`, { ...form, created_by: createdBy });
            } else {
                await axios.post('http://localhost:5000/api/duties', { ...form, created_by: createdBy });
            }
            setSuccess(selectedDuty ? 'Duty updated!' : 'Duty created!');
            setShowModal(false);
            resetForm();
            fetchDuties();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.error || 'Error saving duty.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        try {
            await axios.delete(`http://localhost:5000/api/duties/${selectedDuty.id}`);
            setShowDeleteModal(false);
            fetchDuties();
        } catch (err) {
            console.error('Error deleting duty:', err);
        }
    };

    const openEdit = (duty) => {
        setSelectedDuty(duty);
        setForm({
            title: duty.title,
            description: duty.description || '',
            location: duty.location || '',
            duty_date: duty.duty_date?.split('T')[0] || '',
            time_start: duty.time_start || '',
            time_end: duty.time_end || '',
            target_audience: duty.target_audience || ['all'],
            status: duty.status
        });
        setShowModal(true);
    };

    const resetForm = () => {
        setForm({
            title: '', description: '', location: '',
            duty_date: '', time_start: '', time_end: '',
            target_audience: ['all'], status: 'upcoming'
        });
        setSelectedDuty(null);
        setError('');
    };

    const getStatusStyle = (status) => {
        if (status === 'upcoming') return 'bg-blue-50 text-blue-600';
        if (status === 'ongoing') return 'bg-emerald-50 text-emerald-600';
        if (status === 'completed') return 'bg-slate-100 text-slate-500';
        return 'bg-red-50 text-red-500';
    };

    const inputClass = "w-full bg-white border border-slate-200 p-3 rounded-xl text-sm text-slate-800 outline-none focus:border-[#7f2d3a] focus:ring-2 focus:ring-[#7f2d3a]/10 transition-all placeholder:text-slate-300";

    const Skeleton = () => (
        <div className="animate-pulse bg-slate-100 rounded-2xl h-32" />
    );

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 font-sans">

            {/* Header */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-6 font-serif">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <span className="text-[10px] bg-[#7f2d3a]/10 text-[#7f2d3a] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full font-sans">
                            Scholar Duty Management
                        </span>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 mt-2 tracking-tight">Duty & Participation</h1>
                    </div>
                    <button
                        onClick={() => { resetForm(); setShowModal(true); }}
                        className="shrink-0 bg-[#7f2d3a] hover:bg-[#63232d] text-white font-bold text-xs px-5 py-3 rounded-xl uppercase tracking-wider flex items-center gap-2 shadow-md shadow-[#7f2d3a]/20 transition-all"
                    >
                        <Plus size={14} /> Create Duty
                    </button>
                </div>
            </div>

            {success && (
                <div className="mb-4 flex items-center gap-2 bg-emerald-50 text-emerald-600 text-xs font-bold px-4 py-3 rounded-2xl border border-emerald-100">
                    <CheckCircle size={14} /> {success}
                </div>
            )}

            {/* Duties List */}
            {loading ? (
                <div className="space-y-4">
                    {Array(3).fill(0).map((_, i) => <Skeleton key={i} />)}
                </div>
            ) : duties.length === 0 ? (
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-16 text-center">
                    <CalendarDays size={40} className="mx-auto mb-3 text-slate-200" />
                    <p className="text-sm font-bold text-slate-300">No duties created yet.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {duties.map((duty) => (
                        <div key={duty.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${getStatusStyle(duty.status)}`}>
                                            {duty.status}
                                        </span>
                                        {duty.target_audience?.includes('all') ? (
                                            <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                                                All Scholars
                                            </span>
                                        ) : (
                                            duty.target_audience?.slice(0, 2).map((t, i) => (
                                                <span key={i} className="text-[10px] font-black bg-[#7f2d3a]/10 text-[#7f2d3a] px-2.5 py-1 rounded-lg">
                                                    {t}
                                                </span>
                                            ))
                                        )}
                                        {!duty.target_audience?.includes('all') && duty.target_audience?.length > 2 && (
                                            <span className="text-[10px] text-slate-400 font-bold">
                                                +{duty.target_audience.length - 2} more
                                            </span>
                                        )}
                                    </div>
                                    <h4 className="font-black text-slate-800 text-base">{duty.title}</h4>
                                    {duty.description && (
                                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{duty.description}</p>
                                    )}
                                    <div className="flex flex-wrap items-center gap-4 mt-3">
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                            <CalendarDays size={12} className="text-[#7f2d3a]" />
                                            {new Date(duty.duty_date).toLocaleDateString('en-PH', {
                                                year: 'numeric', month: 'long', day: 'numeric'
                                            })}
                                        </div>
                                        {duty.time_start && (
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                <Clock size={12} className="text-[#7f2d3a]" />
                                                {duty.time_start} — {duty.time_end}
                                            </div>
                                        )}
                                        {duty.location && (
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                <MapPin size={12} className="text-[#7f2d3a]" />
                                                {duty.location}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={() => openEdit(duty)}
                                        className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition-colors"
                                    >
                                        <Edit3 size={15} />
                                    </button>
                                    <button
                                        onClick={() => { setSelectedDuty(duty); setShowDeleteModal(true); }}
                                        className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-colors"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── CREATE/EDIT MODAL ─────────────────────────── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 sticky top-0 bg-white z-10">
                            <h3 className="font-black text-slate-800 text-lg">
                                {selectedDuty ? 'Edit Duty' : 'Create Duty'}
                            </h3>
                            <button onClick={() => { setShowModal(false); resetForm(); }}
                                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="px-6 py-5 space-y-4">
                            {/* Title */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-[#7f2d3a] uppercase tracking-widest">Title *</label>
                                <input className={inputClass} placeholder="e.g., Library Assistance"
                                    value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                            </div>

                            {/* Description */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-[#7f2d3a] uppercase tracking-widest">Description</label>
                                <textarea className={`${inputClass} resize-none`} rows={3}
                                    placeholder="Describe the duty or activity..."
                                    value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                            </div>

                            {/* Location */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-[#7f2d3a] uppercase tracking-widest">Location</label>
                                <input className={inputClass} placeholder="e.g., Main Library, 2nd Floor"
                                    value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
                            </div>

                            {/* Date & Time */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-[#7f2d3a] uppercase tracking-widest">Date *</label>
                                    <input type="date" className={inputClass}
                                        value={form.duty_date} onChange={e => setForm({ ...form, duty_date: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-[#7f2d3a] uppercase tracking-widest">Start Time</label>
                                    <input type="time" className={inputClass}
                                        value={form.time_start} onChange={e => setForm({ ...form, time_start: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-[#7f2d3a] uppercase tracking-widest">End Time</label>
                                    <input type="time" className={inputClass}
                                        value={form.time_end} onChange={e => setForm({ ...form, time_end: e.target.value })} />
                                </div>
                            </div>

                            {/* Status (edit only) */}
                            {selectedDuty && (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-[#7f2d3a] uppercase tracking-widest">Status</label>
                                    <select className={inputClass} value={form.status}
                                        onChange={e => setForm({ ...form, status: e.target.value })}>
                                        <option value="upcoming">Upcoming</option>
                                        <option value="ongoing">Ongoing</option>
                                        <option value="completed">Completed</option>
                                        <option value="cancelled">Cancelled</option>
                                    </select>
                                </div>
                            )}

                            {/* Target Audience */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-[#7f2d3a] uppercase tracking-widest">Target Audience</label>

                                {/* All Scholars toggle */}
                                <button
                                    onClick={() => handleTargetToggle('all')}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-sm font-bold transition-all ${
                                        form.target_audience.includes('all')
                                            ? 'bg-[#7f2d3a] text-white border-[#7f2d3a]'
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    <Users size={15} />
                                    All Scholars
                                </button>

                                {/* Individual year levels */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                                    {yearLevels.map((level) => (
                                        <button
                                            key={level}
                                            onClick={() => handleTargetToggle(level)}
                                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                                                form.target_audience.includes(level)
                                                    ? 'bg-[#7f2d3a] text-white border-[#7f2d3a]'
                                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                            }`}
                                        >
                                            {level}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {error && (
                                <p className="text-xs text-red-500 font-bold bg-red-50 px-3 py-2 rounded-xl">{error}</p>
                            )}
                        </div>

                        <div className="px-6 pb-6">
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="w-full py-3.5 bg-[#7f2d3a] hover:bg-[#63232d] text-white font-black text-xs rounded-2xl uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {submitting ? <Loader2 size={13} className="animate-spin" /> : null}
                                {submitting ? 'Saving...' : selectedDuty ? 'Update Duty' : 'Create Duty'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── DELETE MODAL ──────────────────────────────── */}
            {showDeleteModal && selectedDuty && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center">
                        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash2 size={24} className="text-red-500" />
                        </div>
                        <h3 className="font-black text-slate-800 text-lg">Delete Duty?</h3>
                        <p className="text-xs text-slate-400 mt-2 mb-6">
                            Are you sure you want to delete <span className="font-bold text-slate-700">"{selectedDuty.title}"</span>?
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDeleteModal(false)}
                                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all">
                                Cancel
                            </button>
                            <button onClick={handleDelete}
                                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-xs hover:bg-red-600 transition-all">
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DutyManagement;