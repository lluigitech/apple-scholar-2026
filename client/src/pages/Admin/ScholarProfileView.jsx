import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
    ArrowLeft, BookOpen, ClipboardCheck, FileText,
    MessageSquareWarning, Clock, Shield, AlertTriangle,
    CheckCircle, XCircle, Download, Edit3, Flag,
    Bell, Hash, Mail, TrendingUp, Plus, Trash2,
    Activity, Calendar, Star, Heart, ChevronDown, ChevronUp,
} from 'lucide-react';

const MAROON = '#7f2d3a';
const MAROON_LIGHT = '#F5E8EA';
const RAW_API = (import.meta.env?.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API_BASE = RAW_API.endsWith('/api') ? RAW_API : `${RAW_API}/api`;
const ADMIN_API = `${API_BASE}/admin`;
const EXPORT_API = `${API_BASE}/export`;

const badgeMap = {
    complied: { bg: '#dcfce7', color: '#15803d', Icon: CheckCircle, label: 'Complied' },
    pending:  { bg: '#fef9c3', color: '#854d0e', Icon: Clock,        label: 'Pending'  },
    missed:   { bg: '#fee2e2', color: '#991b1b', Icon: XCircle,      label: 'Missed'   },
    passed:   { bg: '#dcfce7', color: '#15803d', Icon: CheckCircle,  label: 'Passed'   },
    failed:   { bg: '#fee2e2', color: '#991b1b', Icon: XCircle,      label: 'Failed'   },
    approved: { bg: '#dcfce7', color: '#15803d', Icon: CheckCircle,  label: 'Approved' },
    rejected: { bg: '#fee2e2', color: '#991b1b', Icon: XCircle,      label: 'Rejected' },
};

const formatYearLevelLabel = (value) => {
    if (!value) return '—';
    const normalized = String(value).trim().toLowerCase().replace(/_/g, ' ');
    const aliasMap = {
        'grade 7': 'Grade 7',
        'grade 8': 'Grade 8',
        'grade 9': 'Grade 9',
        'grade 10': 'Grade 10',
        'grade 11': 'Grade 11',
        'grade 12': 'Grade 12',
        'college 1': '1st Year College',
        'college 2': '2nd Year College',
        'college 3': '3rd Year College',
        'college 4': '4th Year College',
        'college 5': '5th Year College',
        '1st year college': '1st Year College',
        '2nd year college': '2nd Year College',
        '3rd year college': '3rd Year College',
        '4th year college': '4th Year College',
        '5th year college': '5th Year College',
    };
    return aliasMap[normalized] || value;
};

const StatusBadge = ({ status }) => {
    const cfg = badgeMap[status] ?? badgeMap.pending;
    const { Icon, bg, color, label } = cfg;
    return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: bg, color }}>
            <Icon className="w-3 h-3" />{label}
        </span>
    );
};

const SEMESTERS    = ['1st Sem', '2nd Sem', 'Summer'];
const ACAD_YEARS   = ['2022-2023','2023-2024','2024-2025','2025-2026','2026-2027'];

// ─── Add Grade Modal ───────────────────────────────────────────
const AddGradeModal = ({ scholarId, onClose, onSuccess }) => {
    const [form, setForm] = useState({
        semester: '1st Sem', academic_year: '2025-2026',
        subject_name: '', units: 3, grade: '',
    });
    const [error, setError]   = useState('');
    const [loading, setLoading] = useState(false);
    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const inputCls = 'w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-700 outline-none focus:border-[#7f2d3a] focus:ring-2 focus:ring-[#7f2d3a]/10 transition-all';

    const handleSubmit = async () => {
        setError('');
        if (!form.subject_name || !form.grade) { setError('Subject name and grade are required.'); return; }
        const g = parseFloat(form.grade);
        if (isNaN(g) || g < 1.00 || g > 5.00) { setError('Grade must be between 1.00 and 5.00.'); return; }
        try {
            setLoading(true);
            await axios.post(`${API}/scholars/${scholarId}/grades`, { ...form, grade: g, units: parseInt(form.units) });
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.error || 'Error saving grade.');
        } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            style={{ backgroundColor: 'rgba(10,10,20,0.55)', backdropFilter: 'blur(8px)' }}>
            <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden"
                style={{ boxShadow: '0 40px 80px -20px rgba(0,0,0,0.35)' }}>
                <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${MAROON}, #c97080)` }} />
                <div className="px-6 pt-5 pb-4 flex items-center justify-between">
                    <div>
                        <h3 className="text-[15px] font-bold text-slate-800">Add Subject Grade</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">Enter grade for one subject</p>
                    </div>
                    <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100">
                        <XCircle size={14} />
                    </button>
                </div>
                <div className="h-px bg-slate-100 mx-6" />
                <div className="px-6 py-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">Semester</label>
                            <select className={inputCls} value={form.semester} onChange={e => set('semester', e.target.value)}>
                                {SEMESTERS.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">Academic Year</label>
                            <select className={inputCls} value={form.academic_year} onChange={e => set('academic_year', e.target.value)}>
                                {ACAD_YEARS.map(y => <option key={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">Subject Name <span className="text-rose-400">*</span></label>
                        <input className={inputCls} placeholder="e.g. Mathematics 101"
                            value={form.subject_name} onChange={e => set('subject_name', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">Units</label>
                            <input className={inputCls} type="number" min="1" max="6"
                                value={form.units} onChange={e => set('units', e.target.value)} />
                        </div>
                        <div>
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">Grade <span className="text-rose-400">*</span></label>
                            <input className={inputCls} type="number" min="1.00" max="5.00" step="0.25"
                                placeholder="1.00 – 5.00"
                                value={form.grade} onChange={e => set('grade', e.target.value)} />
                        </div>
                    </div>
                    {error && (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-100 px-3.5 py-2.5 rounded-xl">
                            <AlertTriangle size={13} className="text-red-400 shrink-0" />
                            <p className="text-xs text-red-600 font-medium">{error}</p>
                        </div>
                    )}
                </div>
                <div className="px-6 pb-6 pt-3 border-t border-slate-100 flex gap-2.5">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button>
                    <button onClick={handleSubmit} disabled={loading}
                        className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60"
                        style={{ background: `linear-gradient(135deg, ${MAROON}, #a63d4d)` }}>
                        {loading ? 'Saving...' : 'Add Grade'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Main ──────────────────────────────────────────────────────
const ScholarProfileView = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [activeTab, setActiveTab]         = useState('overview');
    const [profile, setProfile]             = useState(null);
    const [submissions, setSubmissions]     = useState([]);
    const [attendance, setAttendance]       = useState([]);
    const [grades, setGrades]               = useState([]);
    const [compliance, setCompliance]       = useState(null);
    const [loading, setLoading]             = useState(true);
    const [expandedSem, setExpandedSem]     = useState(null);
    const [showAddGrade, setShowAddGrade]   = useState(false);
    const [deletingGrade, setDeletingGrade] = useState(null);

    const fetchAll = async () => {
        setProfile(null); setSubmissions([]); setAttendance([]);
        setGrades([]); setCompliance(null);
        setLoading(true); setActiveTab('overview');
        try {
            const [pR, sR, aR, gR, cR] = await Promise.allSettled([
                axios.get(`${ADMIN_API}/scholars/${id}/profile`),
                axios.get(`${ADMIN_API}/scholars/${id}/submissions`),
                axios.get(`${ADMIN_API}/scholars/${id}/attendance`),
                axios.get(`${ADMIN_API}/scholars/${id}/grades`),
                axios.get(`${ADMIN_API}/scholars/${id}/compliance-summary`),
            ]);
            if (pR.status === 'fulfilled') setProfile(pR.value.data);
            if (sR.status === 'fulfilled') setSubmissions(sR.value.data);
            if (aR.status === 'fulfilled') setAttendance(aR.value.data);
            if (gR.status === 'fulfilled') setGrades(gR.value.data);
            if (cR.status === 'fulfilled') setCompliance(cR.value.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchAll(); }, [id]);

    const handleDeleteGrade = async (gradeId) => {
        setDeletingGrade(gradeId);
        try { await axios.delete(`${ADMIN_API}/scholars/${id}/grades/${gradeId}`); fetchAll(); }
        catch (e) { console.error(e); }
        finally { setDeletingGrade(null); }
    };

    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{
            'Scholar ID': profile?.scholar_id, 'Full Name': profile?.full_name,
            'Email': profile?.email, 'Year Level': formatYearLevelLabel(profile?.year_level), 'Status': profile?.status,
        }]), 'Profile');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
            grades.flatMap(sem => sem.subjects.map(s => ({
                Semester: sem.semester, 'Acad Year': sem.academic_year,
                Subject: s.subject_name, Units: s.units, Grade: s.grade, GWA: sem.gwa, Status: sem.status,
            })))
        ), 'Grades');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
            submissions.map(s => ({
                Date: new Date(s.submitted_at).toLocaleDateString('en-PH'),
                'Quality Score': s.quality_score, Status: s.status,
                'Staff Comment': s.staff_comment || '', 'Service Hours': s.service_hours || 0,
            }))
        ), 'Submissions');
        XLSX.writeFile(wb, `${profile?.scholar_id}_profile.xlsx`);
        axios.post(`${EXPORT_API}/google-sheets`, { log_only: true, module: 'Scholar Profile', report_resource: 'Scholar Profile Export', spreadsheet_title: 'Scholar Profile Export', details: `${profile?.scholar_id}_profile.xlsx` }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).catch(() => {});
    };

    const getRiskLevel = () => {
        const neg = submissions.filter(s => s.sentiment_label?.includes('Negative')).length;
        const rej = submissions.filter(s => s.status === 'rejected').length;
        const avg = profile?.avg_quality_score || 0;
        if (neg >= 2 || rej >= 2 || avg < 50) return { level: 'High Risk',     color: 'text-red-500',    bg: 'bg-red-50',     border: 'border-red-100'     };
        if (neg >= 1 || rej >= 1 || avg < 70) return { level: 'Moderate Risk', color: 'text-amber-500',  bg: 'bg-amber-50',   border: 'border-amber-100'   };
        return                                        { level: 'Low Risk',      color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' };
    };

    const getStatusBadge = (s) => {
        if (s === 'approved') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
        if (s === 'rejected') return 'bg-red-50 text-red-500 border-red-100';
        return 'bg-amber-50 text-amber-600 border-amber-100';
    };

    const getSentimentColor = (label) => {
        if (!label) return 'bg-slate-100 text-slate-400';
        if (label.includes('Positive')) return 'bg-emerald-50 text-emerald-600';
        if (label === 'Neutral') return 'bg-blue-50 text-blue-600';
        return 'bg-red-50 text-red-500';
    };

    const totalService    = compliance?.community_service?.total_hours || 0;
    const reqService      = compliance?.community_service?.required_hours || 32;
    const svcProgress     = compliance?.community_service?.progress || 0;
    const attRate         = compliance?.attendance?.rate || 0;
    const passedSems      = compliance?.academic?.passed_sems || 0;
    const totalSems       = compliance?.academic?.total_sems || 0;
    const approvedSubs    = compliance?.report_submissions?.approved || 0;
    const totalSubs       = compliance?.report_submissions?.total || 0;

    const complianceRate = compliance ? Math.round(
        (approvedSubs / Math.max(totalSubs, 1)) * 25 +
        attRate * 0.25 +
        svcProgress * 0.25 +
        (passedSems / Math.max(totalSems, 1)) * 25
    ) : 0;

    const risk = getRiskLevel();

    const tabs = [
        { id: 'overview',       label: 'Overview',         icon: <Activity size={14} />            },
        { id: 'academic',       label: 'Academic',         icon: <BookOpen size={14} />             },
        { id: 'compliance',     label: 'Compliance',       icon: <ClipboardCheck size={14} />       },
        { id: 'submissions',    label: 'Progress Reports', icon: <FileText size={14} />             },
        { id: 'correspondence', label: 'Correspondence',   icon: <MessageSquareWarning size={14} /> },
        { id: 'attendance',     label: 'Attendance',       icon: <Calendar size={14} />             },
        { id: 'risk',           label: 'Risk Monitor',     icon: <Shield size={14} />               },
    ];

    if (loading) return (
        <div className="p-6 space-y-4">
            {[40, 64, 48].map((h, i) => <div key={i} className={`h-${h} animate-pulse bg-slate-100 rounded-2xl`} />)}
        </div>
    );
    if (!profile) return <div className="p-6 text-center text-slate-400">Scholar not found.</div>;

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 font-sans">

            <button onClick={() => navigate('/admin/users')}
                className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-[#7f2d3a] transition-colors mb-4">
                <ArrowLeft size={14} /> Back to User Management
            </button>

            {/* Profile Header */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-6">
                <div className="flex flex-col sm:flex-row items-start gap-5">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ background: MAROON, boxShadow: `0 8px 24px ${MAROON}30` }}>
                        <span className="text-white text-2xl font-black">
                            {profile.full_name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h1 className="text-xl font-black text-slate-800">{profile.full_name}</h1>
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase ${
                                profile.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                profile.status === 'flagged' ? 'bg-red-50 text-red-500 border-red-100' :
                                'bg-slate-100 text-slate-500 border-slate-200'
                            }`}>{profile.status}</span>
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase ${risk.bg} ${risk.color} ${risk.border}`}>
                                {risk.level}
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                            {[
                                [Hash, profile.scholar_id || '—'],
                                [Mail, profile.email],
                                [BookOpen, formatYearLevelLabel(profile.year_level)],
                            ].map(([Icon, val], i) => (
                                <span key={i} className="flex items-center gap-1.5 text-xs text-slate-400">
                                    <Icon size={11} style={{ color: MAROON }} />{val}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                        <button onClick={() => navigate('/admin/users')}
                            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-50">
                            <Edit3 size={13} /> Edit
                        </button>
                        <button onClick={handleExportExcel}
                            className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 border border-emerald-200 px-3 py-2 rounded-xl hover:bg-emerald-50">
                            <Download size={13} /> Export
                        </button>
                        <button className="flex items-center gap-1.5 text-xs font-bold text-red-500 border border-red-200 px-3 py-2 rounded-xl hover:bg-red-50">
                            <Flag size={13} /> Flag
                        </button>
                        <button className="flex items-center gap-1.5 text-xs font-bold border px-3 py-2 rounded-xl"
                            style={{ color: MAROON, borderColor: `${MAROON}30` }}
                            onMouseEnter={e => e.currentTarget.style.background = `${MAROON}08`}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <Bell size={13} /> Remind
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)}
                        className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                            activeTab === t.id ? 'text-white shadow-md' : 'bg-white border border-slate-100 text-slate-500 hover:text-slate-700'
                        }`}
                        style={activeTab === t.id ? { background: MAROON, boxShadow: `0 4px 12px ${MAROON}30` } : {}}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* ── OVERVIEW ── */}
            {activeTab === 'overview' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {[
                            { label: 'Overall Compliance', value: `${complianceRate}%`,                             icon: <TrendingUp size={18} />, bg: MAROON_LIGHT, color: MAROON    },
                            { label: 'Attendance Rate',    value: `${attRate}%`,                                    icon: <Calendar size={18} />,   bg: '#dcfce7',    color: '#16a34a' },
                            { label: 'Service Hours',      value: `${totalService} hrs`,                            icon: <Heart size={18} />,      bg: '#dbeafe',    color: '#2563eb' },
                            { label: 'Avg Quality Score',  value: `${Math.round(profile.avg_quality_score || 0)}%`, icon: <Star size={18} />,       bg: '#fef9c3',    color: '#d97706' },
                        ].map(s => (
                            <div key={s.label} className="bg-white p-5 rounded-[1.75rem] border border-slate-100 shadow-sm">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                                    style={{ backgroundColor: s.bg, color: s.color }}>{s.icon}</div>
                                <p className="text-2xl font-black text-slate-800">{s.value}</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{s.label}</p>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* Academic summary */}
                        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <BookOpen size={15} style={{ color: MAROON }} />
                                    <h3 className="font-black text-slate-800 text-sm">Academic Record</h3>
                                </div>
                                <button onClick={() => setActiveTab('academic')}
                                    className="text-[10px] font-bold px-2 py-1 rounded-lg"
                                    style={{ color: MAROON, background: MAROON_LIGHT }}>
                                    View All
                                </button>
                            </div>
                            {grades.length === 0
                                ? <p className="text-xs text-slate-300 text-center py-6">No grades recorded yet.</p>
                                : grades.slice(0, 4).map((sem, i) => (
                                    <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-700">{sem.semester} AY {sem.academic_year}</p>
                                            <p className="text-xs text-slate-400">{sem.total_units} units</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-black" style={{ color: MAROON }}>
                                                {sem.gwa ? sem.gwa.toFixed(2) : 'TBA'}
                                            </span>
                                            <StatusBadge status={sem.status} />
                                        </div>
                                    </div>
                                ))
                            }
                        </div>

                        {/* Community Service */}
                        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Heart size={15} style={{ color: MAROON }} />
                                <h3 className="font-black text-slate-800 text-sm">Community Service</h3>
                            </div>
                            <div className="mb-4">
                                <div className="flex justify-between text-sm mb-1.5">
                                    <span className="font-bold text-slate-700">{totalService} hrs</span>
                                    <span className="text-slate-400">{reqService} required</span>
                                </div>
                                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${svcProgress}%`, backgroundColor: '#22c55e' }} />
                                </div>
                                <p className="text-xs text-slate-400 mt-1">{Math.max(reqService - totalService, 0)} hrs remaining</p>
                            </div>
                            {compliance?.community_service?.items?.length > 0
                                ? compliance.community_service.items.slice(0, 3).map((s, i) => (
                                    <div key={i} className="flex justify-between py-2 border-b border-slate-50 last:border-0">
                                        <p className="text-sm font-semibold text-slate-700">{s.name}</p>
                                        <span className="text-sm font-black text-emerald-600">{s.hours} hrs</span>
                                    </div>
                                ))
                                : <p className="text-xs text-slate-300 text-center py-4">No service activities yet.</p>
                            }
                        </div>
                    </div>

                    {/* Recent Submissions */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                        <h3 className="font-black text-slate-800 text-sm mb-4">Recent Submissions</h3>
                        {submissions.length === 0
                            ? <p className="text-xs text-slate-300 text-center py-4">No submissions yet.</p>
                            : submissions.slice(0, 3).map((sub) => (
                                <div key={sub.id} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                                    <div>
                                        <p className="text-xs font-bold text-slate-700">Monthly Compliance Submission</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                            {new Date(sub.submitted_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${getSentimentColor(sub.sentiment_label)}`}>
                                            {sub.sentiment_label || 'N/A'}
                                        </span>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${getStatusBadge(sub.status)}`}>
                                            {sub.status}
                                        </span>
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                </div>
            )}

            {/* ── ACADEMIC TAB ── */}
            {activeTab === 'academic' && (
                <div className="space-y-5">
                    <div className="flex items-center justify-between">
                        <h3 className="font-black text-slate-800">Academic Record</h3>
                        <button onClick={() => setShowAddGrade(true)}
                            className="flex items-center gap-1.5 text-xs font-bold text-white px-3.5 py-2 rounded-xl"
                            style={{ background: `linear-gradient(135deg, ${MAROON}, #a63d4d)` }}>
                            <Plus size={13} /> Add Grade
                        </button>
                    </div>

                    {grades.length === 0 ? (
                        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-16 text-center">
                            <BookOpen size={40} className="mx-auto mb-3 text-slate-200" />
                            <p className="text-sm font-bold text-slate-300">No grades recorded yet.</p>
                            <button onClick={() => setShowAddGrade(true)}
                                className="mt-4 text-xs font-bold px-4 py-2 rounded-xl text-white"
                                style={{ background: MAROON }}>
                                Add First Grade
                            </button>
                        </div>
                    ) : grades.map((sem, si) => {
                        const key    = `${sem.semester}|${sem.academic_year}`;
                        const isOpen = expandedSem === key;
                        return (
                            <div key={si} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                                <button onClick={() => setExpandedSem(isOpen ? null : key)}
                                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                    <div className="flex items-center gap-4">
                                        <div className="text-left">
                                            <p className="text-sm font-black text-slate-800">{sem.semester} AY {sem.academic_year}</p>
                                            <p className="text-xs text-slate-400 mt-0.5">{sem.total_units} total units</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-black" style={{ color: MAROON }}>
                                                {sem.gwa ? sem.gwa.toFixed(2) : 'TBA'}
                                            </span>
                                            <span className="text-[10px] text-slate-400">GWA</span>
                                            <StatusBadge status={sem.status} />
                                        </div>
                                    </div>
                                    {isOpen ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
                                </button>
                                {isOpen && (
                                    <div className="border-t border-slate-100">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest border-b border-slate-100"
                                                    style={{ color: MAROON }}>
                                                    <th className="px-6 py-3">Subject</th>
                                                    <th className="px-6 py-3">Units</th>
                                                    <th className="px-6 py-3">Grade</th>
                                                    <th className="px-6 py-3 text-center">Del</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {sem.subjects.map((subj, ji) => (
                                                    <tr key={ji} className="hover:bg-slate-50/50">
                                                        <td className="px-6 py-3 text-sm font-semibold text-slate-700">{subj.subject_name}</td>
                                                        <td className="px-6 py-3 text-sm text-slate-500">{subj.units}</td>
                                                        <td className="px-6 py-3">
                                                            <span className={`text-sm font-black px-2.5 py-0.5 rounded-lg ${
                                                                subj.grade <= 3.00 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                                                            }`}>{subj.grade.toFixed(2)}</span>
                                                        </td>
                                                        <td className="px-6 py-3 text-center">
                                                            <button onClick={() => handleDeleteGrade(subj.id)}
                                                                disabled={deletingGrade === subj.id}
                                                                className="p-1.5 rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-400 transition-all disabled:opacity-40">
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── COMPLIANCE TAB ── */}
            {activeTab === 'compliance' && compliance && (
                <div className="space-y-5">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {[
                            { label: 'Overall',       value: `${complianceRate}%`,                    color: MAROON,    bg: MAROON_LIGHT },
                            { label: 'Reports',       value: `${approvedSubs}/${totalSubs}`,           color: '#16a34a', bg: '#dcfce7'    },
                            { label: 'Attendance',    value: `${attRate}%`,                           color: '#2563eb', bg: '#dbeafe'    },
                            { label: 'Service',       value: `${totalService}/${reqService} hrs`,      color: '#d97706', bg: '#fef9c3'    },
                        ].map(s => (
                            <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center">
                                <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{s.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Reports */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <FileText size={15} style={{ color: MAROON }} />
                            <h3 className="font-black text-slate-800 text-sm">Report Submissions</h3>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            {[
                                { label: 'Approved', value: compliance.report_submissions.approved, color: '#16a34a', bg: '#dcfce7' },
                                { label: 'Pending',  value: compliance.report_submissions.pending,  color: '#d97706', bg: '#fef9c3' },
                                { label: 'Rejected', value: compliance.report_submissions.rejected, color: '#dc2626', bg: '#fee2e2' },
                            ].map(s => (
                                <div key={s.label} className="text-center p-3 rounded-xl" style={{ background: s.bg }}>
                                    <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
                                    <p className="text-[10px] font-bold text-slate-500 mt-0.5">{s.label}</p>
                                </div>
                            ))}
                        </div>
                        {compliance.report_submissions.items.map((item, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 mb-2 last:mb-0">
                                <p className="text-xs text-slate-600 font-medium">
                                    {new Date(item.submitted_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                                </p>
                                <StatusBadge status={item.status} />
                            </div>
                        ))}
                        {compliance.report_submissions.items.length === 0 && (
                            <p className="text-xs text-slate-300 text-center py-4">No submissions yet.</p>
                        )}
                    </div>

                    {/* Attendance */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <Calendar size={15} style={{ color: MAROON }} />
                            <h3 className="font-black text-slate-800 text-sm">Duty Attendance</h3>
                        </div>
                        <div className="flex justify-between text-sm mb-2">
                            <span className="font-bold text-slate-700">{compliance.attendance.present} of {compliance.attendance.total} duties</span>
                            <span className="font-black" style={{ color: MAROON }}>{attRate}%</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mb-4">
                            <div className="h-full rounded-full" style={{ width: `${attRate}%`, backgroundColor: '#22c55e' }} />
                        </div>
                        <div className="flex gap-3">
                            {[
                                { label: 'Present', value: compliance.attendance.present, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                { label: 'Absent',  value: compliance.attendance.absent,  color: 'text-red-500',    bg: 'bg-red-50'     },
                                { label: 'Excused', value: compliance.attendance.excused, color: 'text-amber-600',  bg: 'bg-amber-50'   },
                            ].map(s => (
                                <div key={s.label} className={`flex-1 text-center p-3 rounded-xl ${s.bg}`}>
                                    <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                                    <p className="text-[10px] font-bold text-slate-500 mt-0.5">{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Service */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <Heart size={15} style={{ color: MAROON }} />
                            <h3 className="font-black text-slate-800 text-sm">Community Service</h3>
                        </div>
                        <div className="flex justify-between text-sm mb-2">
                            <span className="font-bold text-slate-700">{totalService} / {reqService} hrs</span>
                            <span className="font-black text-emerald-600">{svcProgress}%</span>
                        </div>
                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-4">
                            <div className="h-full rounded-full" style={{ width: `${svcProgress}%`, backgroundColor: '#22c55e' }} />
                        </div>
                        {compliance.community_service.items.length === 0
                            ? <p className="text-xs text-slate-300 text-center py-4">No service activities yet.</p>
                            : compliance.community_service.items.map((s, i) => (
                                <div key={i} className="flex justify-between py-2.5 border-b border-slate-50 last:border-0">
                                    <p className="text-sm font-semibold text-slate-700">{s.name}</p>
                                    <span className="text-sm font-black text-emerald-600">{s.hours} hrs</span>
                                </div>
                            ))
                        }
                    </div>
                </div>
            )}

            {/* ── SUBMISSIONS TAB ── */}
            {activeTab === 'submissions' && (
                <div className="space-y-4">
                    {submissions.length === 0
                        ? <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-16 text-center">
                            <FileText size={40} className="mx-auto mb-3 text-slate-200" />
                            <p className="text-sm font-bold text-slate-300">No progress reports submitted yet.</p>
                          </div>
                        : submissions.map((sub) => (
                            <div key={sub.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <div>
                                        <p className="font-black text-slate-800">Monthly Compliance Report</p>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            {new Date(sub.submitted_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${
                                            sub.quality_status === 'accepted' ? 'bg-emerald-50 text-emerald-600' :
                                            sub.quality_status === 'medium_risk' ? 'bg-amber-50 text-amber-600' :
                                            'bg-red-50 text-red-500'
                                        }`}>{sub.quality_score}%</span>
                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${getStatusBadge(sub.status)}`}>{sub.status}</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                                    {[
                                        { label: 'Report Card',   value: sub.report_card_path },
                                        { label: 'COR',           value: sub.cor_path },
                                        { label: 'Service Hours', value: sub.service_activity ? `${sub.service_hours} hrs` : null },
                                        { label: 'Photos',        value: sub.media_paths ? 'Uploaded' : null },
                                    ].map(doc => (
                                        <div key={doc.label} className={`p-2.5 rounded-xl border text-center ${doc.value ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                                            <p className="text-[10px] font-black text-slate-400 uppercase">{doc.label}</p>
                                            <p className={`text-xs font-bold mt-0.5 ${doc.value ? 'text-emerald-600' : 'text-red-300'}`}>{doc.value || '❌ Missing'}</p>
                                        </div>
                                    ))}
                                </div>
                                {sub.staff_comment && (
                                    <div className={`p-3 rounded-xl text-xs font-medium ${sub.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                        <span className="font-black">Staff Feedback: </span>{sub.staff_comment}
                                    </div>
                                )}
                            </div>
                        ))
                    }
                </div>
            )}

            {/* ── CORRESPONDENCE TAB ── */}
            {activeTab === 'correspondence' && (
                <div className="space-y-4">
                    {submissions.filter(s => s.letter_content).length === 0
                        ? <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-16 text-center">
                            <MessageSquareWarning size={40} className="mx-auto mb-3 text-slate-200" />
                            <p className="text-sm font-bold text-slate-300">No letters submitted yet.</p>
                          </div>
                        : submissions.filter(s => s.letter_content).map((sub) => (
                            <div key={sub.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <div>
                                        <p className="font-black text-slate-800 text-sm">Monthly Report Letter</p>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            {new Date(sub.submitted_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                                        </p>
                                    </div>
                                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${getSentimentColor(sub.sentiment_label)}`}>
                                        {sub.sentiment_label || 'Not analyzed'}
                                    </span>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-4">
                                    <p className="text-xs text-slate-600 leading-relaxed italic">"{sub.letter_content}"</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { label: 'Sentiment Score', value: sub.sentiment_score || '0', color: sub.sentiment_score > 0 ? 'text-emerald-600' : sub.sentiment_score < 0 ? 'text-red-500' : 'text-blue-500' },
                                        { label: 'Quality Score',   value: `${sub.quality_score}%`,    color: sub.quality_score >= 71 ? 'text-emerald-600' : sub.quality_score >= 50 ? 'text-amber-500' : 'text-red-500' },
                                    ].map(s => (
                                        <div key={s.label} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
                                            <p className={`text-lg font-black mt-1 ${s.color}`}>{s.value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    }
                </div>
            )}

            {/* ── ATTENDANCE TAB ── */}
            {activeTab === 'attendance' && (
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-black text-slate-800 text-sm">Duty Attendance History</h3>
                        <div className="flex gap-2">
                            <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-lg">{compliance?.attendance?.present || 0} Present</span>
                            <span className="text-[10px] font-black bg-red-50 text-red-500 px-2.5 py-1 rounded-lg">{compliance?.attendance?.absent || 0} Absent</span>
                        </div>
                    </div>
                    {attendance.length === 0
                        ? <p className="text-xs text-slate-300 text-center py-8">No attendance records yet.</p>
                        : attendance.map((att, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-3 last:mb-0">
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">{att.title}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        {new Date(att.duty_date).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                                        {att.location ? ` · ${att.location}` : ''}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase ${
                                        att.status === 'present' ? 'bg-emerald-50 text-emerald-600' :
                                        att.status === 'excused' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'
                                    }`}>{att.status}</span>
                                    <span className="text-[10px] text-slate-400">via {att.method}</span>
                                </div>
                            </div>
                        ))
                    }
                </div>
            )}

            {/* ── RISK TAB ── */}
            {activeTab === 'risk' && (
                <div className="space-y-6">
                    <div className={`p-6 rounded-[2rem] border ${risk.bg} ${risk.border}`}>
                        <div className="flex items-center gap-4">
                            <div className={`p-4 rounded-2xl ${risk.bg}`}><Shield size={28} className={risk.color} /></div>
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Current Risk Level</p>
                                <p className={`text-3xl font-black ${risk.color}`}>{risk.level}</p>
                                <p className="text-xs text-slate-400 mt-1">Based on submission history, sentiment analysis, and quality scores</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                        <h3 className="font-black text-slate-800 text-sm mb-4">Risk Factors</h3>
                        <div className="space-y-3">
                            {[
                                { label: 'Negative Sentiment Letters', value: submissions.filter(s => s.sentiment_label?.includes('Negative')).length, threshold: 1, weight: '25%' },
                                { label: 'Rejected Submissions',        value: submissions.filter(s => s.status === 'rejected').length,                  threshold: 1, weight: '35%' },
                                { label: 'Low Quality Score (< 70%)',   value: submissions.filter(s => s.quality_score < 70).length,                    threshold: 1, weight: '40%' },
                            ].map(f => (
                                <div key={f.label} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div>
                                        <p className="text-sm font-bold text-slate-700">{f.label}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Weight: {f.weight}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-lg font-black ${f.value >= f.threshold ? 'text-red-500' : 'text-emerald-600'}`}>{f.value}</p>
                                        <p className="text-[10px] text-slate-400">instances</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Add Grade Modal */}
            {showAddGrade && (
                <AddGradeModal
                    scholarId={id}
                    onClose={() => setShowAddGrade(false)}
                    onSuccess={() => { setShowAddGrade(false); fetchAll(); }}
                />
            )}
        </div>
    );
};

export default ScholarProfileView;