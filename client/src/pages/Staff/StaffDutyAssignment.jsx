import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    ClipboardList, CalendarDays, MapPin, Clock,
    Plus, X, Save, Loader2,
    CheckSquare, Square, AlertCircle
} from 'lucide-react';

const API = 'http://localhost:5000/api';
const token = () => localStorage.getItem('token');
const authHeaders = () => ({ headers: { Authorization: `Bearer ${token()}` } });

const getStatusStyle = (status) => {
    if (status === 'upcoming')  return 'bg-blue-50 text-blue-600 border-blue-100';
    if (status === 'ongoing')   return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (status === 'completed') return 'bg-slate-100 text-slate-500 border-slate-200';
    return 'bg-red-50 text-red-500 border-red-100';
};

const EMPTY_FORM = {
    title: '',
    description: '',
    location: '',
    duty_date: '',
    time_start: '',
    time_end: '',
    group_ids: [],
};

// ─── Checkbox group ───────────────────────────────────────────────────────────
const AudienceCheckbox = ({ value, label, checked, onChange }) => (
    <button type="button" onClick={() => onChange(value)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
            checked
                ? 'bg-[#7f2d3a] text-white border-[#7f2d3a]'
                : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-[#7f2d3a]/30 hover:text-[#7f2d3a]'
        }`}>
        {checked ? <CheckSquare size={12} /> : <Square size={12} />}
        {label}
    </button>
);

const Skeleton = () => <div className="animate-pulse bg-slate-100 rounded-2xl h-28" />;

const StaffDutyAssignment = () => {
    const staffId   = localStorage.getItem('user_id') || localStorage.getItem('id');

    const [duties, setDuties]         = useState([]);
    const [groups, setGroups]         = useState([]);
    const [loading, setLoading]       = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm]             = useState(EMPTY_FORM);
    const [saving, setSaving]         = useState(false);
    const [formError, setFormError]   = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [notifyingId, setNotifyingId] = useState(null);
    const [notifyMessage, setNotifyMessage] = useState('');
    const [notifyError, setNotifyError] = useState('');


    const fetchDuties = async () => {
        try {
            const res = await axios.get(`${API}/duties`, authHeaders());
            setDuties(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchGroups = async () => {
        try {
            const res = await axios.get(`${API}/staff/groups`, authHeaders());
            setGroups(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => { fetchDuties(); fetchGroups(); }, []);

    // ─── Duty Form handlers ───────────────────────────────────────────────────
    const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const toggleGroup = (groupId) => {
        setForm(f => ({
            ...f,
            group_ids: f.group_ids.includes(groupId)
                ? f.group_ids.filter(g => g !== groupId)
                : [...f.group_ids, groupId],
        }));
    };

    const handleCreate = async () => {
        setFormError('');
        if (!form.title)                  return setFormError('Title is required.');
        if (!form.duty_date)              return setFormError('Date is required.');
        if (!form.group_ids.length)       return setFormError('Select at least one group.');

        setSaving(true);
        try {
            await axios.post(`${API}/duties`, {
                ...form,
                created_by: staffId,
            }, authHeaders());

            setSuccessMsg('Task created successfully!');
            setShowCreate(false);
            setForm(EMPTY_FORM);
            await fetchDuties();
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            setFormError(err.response?.data?.error || 'Failed to create task. Please try again.');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleNotifyDuty = async (dutyId) => {
        setNotifyError('');
        setNotifyMessage('');
        setNotifyingId(dutyId);

        try {
            const res = await axios.post(`${API}/staff/duties/${dutyId}/notify`, {}, authHeaders());
            const sentCount = res.data?.sent_count ?? 0;
            setNotifyMessage(`Notifications sent to ${sentCount} scholar(s).`);
        } catch (err) {
            setNotifyError(err.response?.data?.error || 'Failed to send notifications.');
        } finally {
            setNotifyingId(null);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 font-sans">

            {/* Header */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <span className="text-[10px] bg-[#7f2d3a]/10 text-[#7f2d3a] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full">
                            Staff — Task Management
                        </span>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 mt-2 tracking-tight font-serif">
                            Duty Assignments
                        </h1>
                        <p className="text-xs text-slate-400 mt-1">
                            View and create duties and compliance tasks for scholars.
                        </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <button onClick={() => { setShowCreate(true); setFormError(''); }}
                            className="flex items-center gap-2 bg-[#7f2d3a] text-white text-xs font-black px-4 py-2.5 rounded-2xl hover:bg-[#63232d] transition-all shadow-md">
                            <Plus size={14} /> Create Duty
                        </button>
                    </div>
                </div>

                {successMsg && (
                    <div className="mt-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold px-4 py-2.5 rounded-xl">
                        ✓ {successMsg}
                    </div>
                )}
                {notifyMessage && (
                    <div className="mt-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold px-4 py-2.5 rounded-xl">
                        ✓ {notifyMessage}
                    </div>
                )}
                {notifyError && (
                    <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold px-4 py-2.5 rounded-xl">
                        {notifyError}
                    </div>
                )}
            </div>

            {/* Task list */}
            {loading ? (
                <div className="space-y-4">{Array(3).fill(0).map((_, i) => <Skeleton key={i} />)}</div>
            ) : duties.length === 0 ? (
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-16 text-center">
                    <ClipboardList size={40} className="mx-auto mb-3 text-slate-200" />
                    <p className="text-sm font-bold text-slate-300">No tasks yet.</p>
                    <p className="text-xs text-slate-300 mt-1">Click <strong>Create Task</strong> to add one.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {duties.map((duty) => {
                        return (
                            <div key={duty.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${getStatusStyle(duty.status)}`}>
                                                {duty.status}
                                            </span>
                                        </div>
                                        <h4 className="font-black text-slate-800">{duty.title}</h4>
                                        {duty.description && (
                                            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{duty.description}</p>
                                        )}
                                        <div className="flex flex-wrap gap-3 mt-3">
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                <CalendarDays size={12} className="text-[#7f2d3a]" />
                                                {new Date(duty.duty_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
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
                                    <div className="shrink-0">
                                        <button
                                            onClick={() => handleNotifyDuty(duty.id)}
                                            disabled={notifyingId === duty.id}
                                            className="px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all disabled:opacity-50"
                                        >
                                            {notifyingId === duty.id ? 'Sending...' : 'Notify Scholars'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── CREATE TASK MODAL ── */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 sticky top-0 bg-white z-10">
                            <div>
                                <h3 className="font-black text-slate-800 text-lg">Create New Task</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Fill in the details for the scholar task.</p>
                            </div>
                            <button onClick={() => setShowCreate(false)}
                                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {formError && (
                                <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold px-4 py-3 rounded-xl flex items-center gap-2">
                                    <AlertCircle size={13} /> {formError}
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                                    Task Title *
                                </label>
                                <input type="text" value={form.title} onChange={e => setField('title', e.target.value)}
                                    placeholder="e.g. Library Duty — May 2025"
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7f2d3a]/30 transition-all" />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                                    Description
                                </label>
                                <textarea value={form.description} onChange={e => setField('description', e.target.value)}
                                    placeholder="Optional details about this task..."
                                    rows={3}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7f2d3a]/30 transition-all resize-none" />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Date *</label>
                                    <input type="date" value={form.duty_date} onChange={e => setField('duty_date', e.target.value)}
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7f2d3a]/30" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Time Start</label>
                                    <input type="time" value={form.time_start} onChange={e => setField('time_start', e.target.value)}
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7f2d3a]/30" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Time End</label>
                                    <input type="time" value={form.time_end} onChange={e => setField('time_end', e.target.value)}
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7f2d3a]/30" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Location</label>
                                <input type="text" value={form.location} onChange={e => setField('location', e.target.value)}
                                    placeholder="e.g. School Library, Covered Court..."
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7f2d3a]/30" />
                            </div>

                            {/* Target Group */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    Assign to Group(s) * <span className="text-slate-300 font-normal normal-case">(makikita LANG ng members ng napiling group)</span>
                                </label>
                                {groups.length === 0 ? (
                                    <p className="text-xs text-slate-400 bg-slate-50 rounded-xl p-3 border border-slate-100">
                                        Wala pang groups. Ipa-manage sa administrator ang scholar groups.
                                    </p>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {groups.map(g => (
                                            <AudienceCheckbox
                                                key={g.id}
                                                value={g.id}
                                                label={`${g.group_name} (${g.member_count ?? 0})`}
                                                checked={form.group_ids.includes(g.id)}
                                                onChange={() => toggleGroup(g.id)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="px-6 pb-6 flex justify-end gap-3">
                            <button onClick={() => setShowCreate(false)}
                                className="px-5 py-2.5 text-sm font-bold text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">
                                Cancel
                            </button>
                            <button onClick={handleCreate} disabled={saving}
                                className="flex items-center gap-2 px-6 py-2.5 text-sm font-black text-white rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 disabled:opacity-60"
                                style={{ background: '#7f2d3a' }}>
                                {saving
                                    ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                                    : <><Save size={14} /> Create Task</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default StaffDutyAssignment;