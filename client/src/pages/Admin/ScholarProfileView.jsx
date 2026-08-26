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

// ── Brand tokens — shared across Scholar / Officer / Staff / Admin portals ──
const MAROON      = '#7A2E3A';
const MAROON_DEEP = '#3D1219';
const GOLD        = '#B08D4F';
const IVORY       = '#FAF7F2';
const INK         = '#241512';
const LINE        = '#E8DFD6';
const TINT        = '#F6E9EA';
const SAGE  = '#15803d';
const CLAY  = '#991b1b';
const AMBER = '#92400e';

const display = { fontFamily: "'Fraunces', serif" };
const body    = { fontFamily: "'Inter', sans-serif" };
const mono    = { fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, monospace" };

const weavePattern = (color, opacity = 1) => ({
    height: 4,
    opacity,
    backgroundImage: `repeating-linear-gradient(45deg, ${color} 0 2px, transparent 2px 7px),
                       repeating-linear-gradient(-45deg, ${color} 0 2px, transparent 2px 7px)`,
});
const WeaveRule = ({ color = GOLD, opacity = 0.6 }) => <div style={weavePattern(color, opacity)} />;

const RAW_API = (import.meta.env?.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API_BASE = RAW_API.endsWith('/api') ? RAW_API : `${RAW_API}/api`;
const ADMIN_API = `${API_BASE}/admin`;
const EXPORT_API = `${API_BASE}/export`;

const badgeMap = {
    complied: { color: SAGE,  Icon: CheckCircle, label: 'Complied' },
    pending:  { color: AMBER, Icon: Clock,        label: 'Pending'  },
    missed:   { color: CLAY,  Icon: XCircle,      label: 'Missed'   },
    passed:   { color: SAGE,  Icon: CheckCircle,  label: 'Passed'   },
    failed:   { color: CLAY,  Icon: XCircle,      label: 'Failed'   },
    approved: { color: SAGE,  Icon: CheckCircle,  label: 'Approved' },
    rejected: { color: CLAY,  Icon: XCircle,      label: 'Rejected' },
};

const formatYearLevelLabel = (value) => {
    if (!value) return '—';
    const normalized = String(value).trim().toLowerCase().replace(/_/g, ' ');
    const aliasMap = {
        'grade 7': 'Grade 7', 'grade 8': 'Grade 8', 'grade 9': 'Grade 9', 'grade 10': 'Grade 10',
        'grade 11': 'Grade 11', 'grade 12': 'Grade 12',
        'college 1': '1st Year College', 'college 2': '2nd Year College', 'college 3': '3rd Year College',
        'college 4': '4th Year College', 'college 5': '5th Year College',
        '1st year college': '1st Year College', '2nd year college': '2nd Year College',
        '3rd year college': '3rd Year College', '4th year college': '4th Year College', '5th year college': '5th Year College',
    };
    return aliasMap[normalized] || value;
};

const StatusBadge = ({ status }) => {
    const cfg = badgeMap[status] ?? badgeMap.pending;
    const { Icon, color, label } = cfg;
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ backgroundColor: `${color}14`, border: `1px solid ${color}35`, ...body, fontSize: '0.66rem', fontWeight: 600, color }}>
            <Icon className="w-3 h-3" />{label}
        </span>
    );
};

// ── Titled card wrapper — flat, hairline border, woven top edge ──
const Card = ({ icon: Icon, title, action, children }) => (
    <div className="rounded-lg overflow-hidden bg-white" style={{ border: `1px solid ${LINE}` }}>
        <WeaveRule />
        <div className="p-5 sm:p-6">
            {title && (
                <div className="flex items-center justify-between mb-4 pb-2" style={{ borderBottom: `1px solid ${LINE}` }}>
                    <div className="flex items-center gap-2">
                        {Icon && <Icon className="w-3.5 h-3.5" style={{ color: GOLD }} />}
                        <h3 style={{ ...body, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: MAROON }}>{title}</h3>
                    </div>
                    {action}
                </div>
            )}
            {children}
        </div>
    </div>
);

// ── Metric card — no weave, kept quiet so the titled Cards read as primary ──
const Metric = ({ icon: Icon, label, value, color }) => (
    <div className="p-4 rounded-lg bg-white" style={{ border: `1px solid ${LINE}` }}>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: `${color}14`, color }}>
            <Icon size={17} />
        </div>
        <p style={{ ...display, fontSize: '1.4rem', fontWeight: 600, color: INK }}>{value}</p>
        <p style={{ ...body, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#a89890', marginTop: 3 }}>{label}</p>
    </div>
);

const getSentimentColor = (label) => {
    if (!label) return '#a89890';
    const l = label.toLowerCase();
    if (l.includes('positive')) return SAGE;
    if (l.includes('negative')) return CLAY;
    return AMBER;
};

const SEMESTERS  = ['1st Sem', '2nd Sem', 'Summer'];
const ACAD_YEARS = ['2022-2023', '2023-2024', '2024-2025', '2025-2026', '2026-2027'];

const inputCls = 'w-full bg-white rounded-lg px-3.5 py-2.5 text-sm outline-none transition-all duration-150 focus:ring-4';
const inputStyle = { ...body, color: INK, border: `1px solid ${LINE}` };

// ─── Add Grade Modal ───────────────────────────────────────────
const AddGradeModal = ({ scholarId, onClose, onSuccess }) => {
    const [form, setForm] = useState({
        semester: '1st Sem', academic_year: '2025-2026',
        subject_name: '', units: 3, grade: '',
    });
    const [error, setError]   = useState('');
    const [loading, setLoading] = useState(false);
    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSubmit = async () => {
        setError('');
        if (!form.subject_name || !form.grade) { setError('Subject name and grade are required.'); return; }
        const g = parseFloat(form.grade);
        if (isNaN(g) || g < 1.00 || g > 5.00) { setError('Grade must be between 1.00 and 5.00.'); return; }
        try {
            setLoading(true);
            await axios.post(`${ADMIN_API}/scholars/${scholarId}/grades`, { ...form, grade: g, units: parseInt(form.units) });
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.error || 'Error saving grade.');
        } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            style={{ backgroundColor: 'rgba(20,10,12,0.55)', backdropFilter: 'blur(6px)' }}>
            <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-xl overflow-hidden bg-white"
                style={{ boxShadow: '0 30px 60px -20px rgba(36,21,18,0.4)' }}>
                <WeaveRule color={GOLD} opacity={0.85} />
                <div className="px-6 pt-5 pb-4 flex items-center justify-between">
                    <div>
                        <h3 style={{ ...display, fontSize: '1.05rem', fontWeight: 600, color: INK }}>Add Subject Grade</h3>
                        <p style={{ ...body, fontSize: '0.72rem', color: '#a89890', marginTop: 2 }}>Enter grade for one subject</p>
                    </div>
                    <button onClick={onClose}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[#faf7f2]"
                        style={{ color: '#a89890', border: 'none', background: 'none', cursor: 'pointer' }}>
                        <XCircle size={14} />
                    </button>
                </div>
                <div style={{ height: 1, background: LINE, margin: '0 24px' }} />
                <div className="px-6 py-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label style={{ ...body, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#A15E6B', marginBottom: 6, display: 'block' }}>Semester</label>
                            <select className={inputCls} style={inputStyle} value={form.semester} onChange={e => set('semester', e.target.value)}>
                                {SEMESTERS.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ ...body, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#A15E6B', marginBottom: 6, display: 'block' }}>Academic Year</label>
                            <select className={inputCls} style={inputStyle} value={form.academic_year} onChange={e => set('academic_year', e.target.value)}>
                                {ACAD_YEARS.map(y => <option key={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label style={{ ...body, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#A15E6B', marginBottom: 6, display: 'block' }}>Subject Name <span style={{ color: CLAY }}>*</span></label>
                        <input className={inputCls} style={inputStyle} placeholder="e.g. Mathematics 101"
                            value={form.subject_name} onChange={e => set('subject_name', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label style={{ ...body, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#A15E6B', marginBottom: 6, display: 'block' }}>Units</label>
                            <input className={inputCls} style={inputStyle} type="number" min="1" max="6"
                                value={form.units} onChange={e => set('units', e.target.value)} />
                        </div>
                        <div>
                            <label style={{ ...body, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#A15E6B', marginBottom: 6, display: 'block' }}>Grade <span style={{ color: CLAY }}>*</span></label>
                            <input className={inputCls} style={inputStyle} type="number" min="1.00" max="5.00" step="0.25"
                                placeholder="1.00 – 5.00"
                                value={form.grade} onChange={e => set('grade', e.target.value)} />
                        </div>
                    </div>
                    {error && (
                        <div className="flex items-center gap-2 rounded-lg" style={{ background: `${CLAY}12`, border: `1px solid ${CLAY}40`, padding: '10px 14px' }}>
                            <AlertTriangle size={13} style={{ color: CLAY, flexShrink: 0 }} />
                            <p style={{ ...body, fontSize: '0.76rem', color: CLAY, fontWeight: 600 }}>{error}</p>
                        </div>
                    )}
                </div>
                <div className="px-6 pb-6 pt-3 flex gap-2.5" style={{ borderTop: `1px solid ${LINE}` }}>
                    <button onClick={onClose}
                        className="flex-1 py-2.5 rounded-full transition-colors hover:bg-[#faf7f2]"
                        style={{ ...body, fontSize: '0.85rem', fontWeight: 600, color: '#6b6058', border: `1px solid ${LINE}`, background: '#fff', cursor: 'pointer' }}>
                        Cancel
                    </button>
                    <button onClick={handleSubmit} disabled={loading}
                        className="flex-1 py-2.5 rounded-full disabled:opacity-60"
                        style={{ ...body, fontSize: '0.85rem', fontWeight: 600, color: '#fff', border: 'none', background: MAROON, cursor: loading ? 'default' : 'pointer' }}>
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
        if (neg >= 2 || rej >= 2 || avg < 50) return { level: 'High Risk', color: CLAY };
        if (neg >= 1 || rej >= 1 || avg < 70) return { level: 'Moderate Risk', color: AMBER };
        return { level: 'Low Risk', color: SAGE };
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
            {[0, 1, 2].map(i => <div key={i} className="animate-pulse rounded-lg h-24" style={{ background: IVORY }} />)}
        </div>
    );
    if (!profile) return <div className="p-6 text-center" style={{ ...body, color: '#a89890' }}>Scholar not found.</div>;

    return (
        <div className="min-h-screen p-4 sm:p-6" style={{ background: IVORY, ...body }}>

            <button onClick={() => navigate('/admin/users')}
                className="flex items-center gap-2 transition-colors mb-4"
                style={{ ...body, fontSize: '0.76rem', fontWeight: 700, color: '#a89890', background: 'none', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.color = MAROON}
                onMouseLeave={e => e.currentTarget.style.color = '#a89890'}>
                <ArrowLeft size={14} /> Back to User Management
            </button>

            {/* Profile Header */}
            <div className="rounded-lg overflow-hidden bg-white mb-6" style={{ border: `1px solid ${LINE}` }}>
                <WeaveRule color={GOLD} opacity={0.7} />
                <div className="p-6 flex flex-col sm:flex-row items-start gap-5">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: MAROON, border: `2px solid ${GOLD}55` }}>
                        <span style={{ ...display, color: '#fff', fontSize: '1.4rem', fontWeight: 600 }}>
                            {profile.full_name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h1 style={{ ...display, fontSize: '1.3rem', fontWeight: 600, color: INK }}>{profile.full_name}</h1>
                            <span className="px-2.5 py-1 rounded-full" style={{
                                ...body, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                                background: `${profile.status === 'active' ? SAGE : profile.status === 'flagged' ? CLAY : '#a89890'}14`,
                                color: profile.status === 'active' ? SAGE : profile.status === 'flagged' ? CLAY : '#8a7a70',
                                border: `1px solid ${profile.status === 'active' ? SAGE : profile.status === 'flagged' ? CLAY : '#a89890'}40`,
                            }}>{profile.status}</span>
                            <span className="px-2.5 py-1 rounded-full" style={{ ...body, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', background: `${risk.color}14`, color: risk.color, border: `1px solid ${risk.color}40` }}>
                                {risk.level}
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                            {[
                                [Hash, profile.scholar_id || '—'],
                                [Mail, profile.email],
                                [BookOpen, formatYearLevelLabel(profile.year_level)],
                            ].map(([Icon, val], i) => (
                                <span key={i} className="flex items-center gap-1.5" style={{ ...body, fontSize: '0.76rem', color: '#a89890' }}>
                                    <Icon size={11} style={{ color: GOLD }} />{val}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 flex-shrink-0">
                        {[
                            { label: 'Edit',   Icon: Edit3,  color: '#6b6058', onClick: () => navigate('/admin/users') },
                            { label: 'Export', Icon: Download, color: SAGE,    onClick: handleExportExcel },
                            { label: 'Flag',   Icon: Flag,   color: CLAY,    onClick: () => {} },
                            { label: 'Remind', Icon: Bell,   color: MAROON,  onClick: () => {} },
                        ].map(({ label, Icon, color, onClick }) => (
                            <button key={label} onClick={onClick}
                                className="flex items-center gap-1.5 rounded-full transition-opacity hover:opacity-80"
                                style={{ ...body, fontSize: '0.76rem', fontWeight: 600, color, border: `1px solid ${color}40`, background: '#fff', padding: '8px 13px', cursor: 'pointer' }}>
                                <Icon size={13} /> {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
                {tabs.map(t => {
                    const activeState = activeTab === t.id;
                    return (
                        <button key={t.id} onClick={() => setActiveTab(t.id)}
                            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-full transition-all"
                            style={{
                                ...body, fontSize: '0.76rem', fontWeight: 600,
                                color: activeState ? '#fff' : '#6b6058',
                                background: activeState ? MAROON : '#fff',
                                border: `1px solid ${activeState ? MAROON : LINE}`,
                                cursor: 'pointer',
                            }}>
                            {t.icon} {t.label}
                        </button>
                    );
                })}
            </div>

            {/* ── OVERVIEW ── */}
            {activeTab === 'overview' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <Metric icon={TrendingUp} label="Overall Compliance" value={`${complianceRate}%`} color={MAROON} />
                        <Metric icon={Calendar}   label="Attendance Rate"    value={`${attRate}%`}        color={SAGE} />
                        <Metric icon={Heart}      label="Service Hours"      value={`${totalService} hrs`} color={GOLD} />
                        <Metric icon={Star}       label="Avg Quality Score"  value={`${Math.round(profile.avg_quality_score || 0)}%`} color={AMBER} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <Card icon={BookOpen} title="Academic Record" action={
                            <button onClick={() => setActiveTab('academic')}
                                className="rounded-full transition-opacity hover:opacity-80"
                                style={{ ...body, fontSize: '0.62rem', fontWeight: 700, color: MAROON, background: TINT, padding: '4px 10px', border: 'none', cursor: 'pointer' }}>
                                View All
                            </button>
                        }>
                            {grades.length === 0
                                ? <p style={{ ...body, fontSize: '0.75rem', color: '#c9b9b0', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>No grades recorded yet.</p>
                                : grades.slice(0, 4).map((sem, i) => (
                                    <div key={i} className="flex items-center justify-between py-2.5" style={{ borderBottom: i < Math.min(grades.length, 4) - 1 ? `1px solid ${LINE}` : 'none' }}>
                                        <div>
                                            <p style={{ ...body, fontSize: '0.82rem', fontWeight: 500, color: INK }}>{sem.semester} AY {sem.academic_year}</p>
                                            <p style={{ ...body, fontSize: '0.68rem', color: '#a89890' }}>{sem.total_units} units</p>
                                        </div>
                                        <div className="flex items-center gap-2.5">
                                            <span style={{ ...mono, fontSize: '0.85rem', fontWeight: 700, color: MAROON }}>{sem.gwa ? sem.gwa.toFixed(2) : 'TBA'}</span>
                                            <StatusBadge status={sem.status} />
                                        </div>
                                    </div>
                                ))
                            }
                        </Card>

                        <Card icon={Heart} title="Community Service">
                            <div className="mb-4">
                                <div className="flex justify-between mb-1.5" style={{ ...body, fontSize: '0.75rem', color: '#6b5c52' }}>
                                    <span style={{ fontWeight: 600 }}>{totalService} hrs</span>
                                    <span style={{ color: '#a89890' }}>{reqService} required</span>
                                </div>
                                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: `${SAGE}20` }}>
                                    <div className="h-full rounded-full" style={{ width: `${svcProgress}%`, backgroundColor: SAGE }} />
                                </div>
                                <p style={{ ...body, fontSize: '0.68rem', color: '#a89890', marginTop: 4 }}>{Math.max(reqService - totalService, 0)} hrs remaining</p>
                            </div>
                            {compliance?.community_service?.items?.length > 0
                                ? compliance.community_service.items.slice(0, 3).map((s, i) => (
                                    <div key={i} className="flex items-center justify-between py-2.5" style={{ borderBottom: i < Math.min(compliance.community_service.items.length, 3) - 1 ? `1px solid ${LINE}` : 'none' }}>
                                        <p style={{ ...body, fontSize: '0.82rem', fontWeight: 500, color: INK }}>{s.name}</p>
                                        <span style={{ ...mono, fontSize: '0.78rem', fontWeight: 700, color: SAGE }}>{s.hours} hrs</span>
                                    </div>
                                ))
                                : <p style={{ ...body, fontSize: '0.75rem', color: '#c9b9b0', fontStyle: 'italic', textAlign: 'center', padding: '14px 0' }}>No service activities yet.</p>
                            }
                        </Card>
                    </div>

                    <Card icon={FileText} title="Recent Submissions">
                        {submissions.length === 0
                            ? <p style={{ ...body, fontSize: '0.75rem', color: '#c9b9b0', fontStyle: 'italic', textAlign: 'center', padding: '14px 0' }}>No submissions yet.</p>
                            : submissions.slice(0, 3).map((sub) => (
                                <div key={sub.id} className="flex items-center justify-between py-3" style={{ borderBottom: `1px solid ${LINE}` }}>
                                    <div>
                                        <p style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: INK }}>Monthly Compliance Submission</p>
                                        <p style={{ ...body, fontSize: '0.66rem', color: '#a89890', marginTop: 2 }}>
                                            {new Date(sub.submitted_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded-full" style={{ ...body, fontSize: '0.6rem', fontWeight: 700, background: `${getSentimentColor(sub.sentiment_label)}14`, color: getSentimentColor(sub.sentiment_label) }}>
                                            {sub.sentiment_label || 'N/A'}
                                        </span>
                                        <StatusBadge status={sub.status} />
                                    </div>
                                </div>
                            ))
                        }
                    </Card>
                </div>
            )}

            {/* ── ACADEMIC TAB ── */}
            {activeTab === 'academic' && (
                <div className="space-y-5">
                    <div className="flex items-center justify-between">
                        <h3 style={{ ...display, fontSize: '1rem', fontWeight: 600, color: INK }}>Academic Record</h3>
                        <button onClick={() => setShowAddGrade(true)}
                            className="flex items-center gap-1.5 rounded-full"
                            style={{ ...body, fontSize: '0.76rem', fontWeight: 600, color: '#fff', background: MAROON, padding: '8px 14px', border: 'none', cursor: 'pointer' }}>
                            <Plus size={13} /> Add Grade
                        </button>
                    </div>

                    {grades.length === 0 ? (
                        <div className="rounded-lg bg-white p-16 text-center" style={{ border: `1px solid ${LINE}` }}>
                            <BookOpen size={40} className="mx-auto mb-3" style={{ color: '#e9d9dc' }} />
                            <p style={{ ...body, fontSize: '0.85rem', fontWeight: 600, color: '#c9b9b0' }}>No grades recorded yet.</p>
                            <button onClick={() => setShowAddGrade(true)}
                                className="mt-4 rounded-full"
                                style={{ ...body, fontSize: '0.76rem', fontWeight: 600, padding: '8px 16px', color: '#fff', background: MAROON, border: 'none', cursor: 'pointer' }}>
                                Add First Grade
                            </button>
                        </div>
                    ) : grades.map((sem, si) => {
                        const key    = `${sem.semester}|${sem.academic_year}`;
                        const isOpen = expandedSem === key;
                        return (
                            <div key={si} className="rounded-lg overflow-hidden bg-white" style={{ border: `1px solid ${LINE}` }}>
                                <button onClick={() => setExpandedSem(isOpen ? null : key)}
                                    className="w-full flex items-center justify-between px-6 py-4 transition-colors hover:bg-[#faf7f2]"
                                    style={{ background: isOpen ? IVORY : '#fff', border: 'none', cursor: 'pointer' }}>
                                    <div className="flex items-center gap-4">
                                        <div className="text-left">
                                            <p style={{ ...display, fontSize: '0.9rem', fontWeight: 600, color: INK }}>{sem.semester} AY {sem.academic_year}</p>
                                            <p style={{ ...body, fontSize: '0.7rem', color: '#a89890', marginTop: 2 }}>{sem.total_units} total units</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span style={{ ...mono, fontSize: '1.05rem', fontWeight: 700, color: MAROON }}>{sem.gwa ? sem.gwa.toFixed(2) : 'TBA'}</span>
                                            <span style={{ ...body, fontSize: '0.62rem', color: '#a89890' }}>GWA</span>
                                            <StatusBadge status={sem.status} />
                                        </div>
                                    </div>
                                    {isOpen ? <ChevronUp size={15} style={{ color: GOLD }} /> : <ChevronDown size={15} style={{ color: GOLD }} />}
                                </button>
                                {isOpen && (
                                    <div style={{ borderTop: `1px solid ${LINE}` }}>
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr style={{ background: IVORY, borderBottom: `1px solid ${LINE}` }}>
                                                    {['Subject', 'Units', 'Grade', 'Del'].map((h, i) => (
                                                        <th key={h} className={`px-6 py-3 ${i === 3 ? 'text-center' : ''}`}
                                                            style={{ ...body, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: MAROON }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sem.subjects.map((subj, ji) => (
                                                    <tr key={ji} style={{ borderBottom: ji < sem.subjects.length - 1 ? `1px solid ${LINE}` : 'none' }} className="hover:bg-[#faf7f2]">
                                                        <td className="px-6 py-3" style={{ ...body, fontSize: '0.82rem', fontWeight: 500, color: INK }}>{subj.subject_name}</td>
                                                        <td className="px-6 py-3" style={{ ...body, fontSize: '0.8rem', color: '#8a7a70' }}>{subj.units}</td>
                                                        <td className="px-6 py-3">
                                                            <span className="px-2.5 py-0.5 rounded-full" style={{
                                                                ...mono, fontSize: '0.8rem', fontWeight: 700,
                                                                color: subj.grade <= 3.00 ? SAGE : CLAY,
                                                                background: `${subj.grade <= 3.00 ? SAGE : CLAY}14`,
                                                            }}>{subj.grade.toFixed(2)}</span>
                                                        </td>
                                                        <td className="px-6 py-3 text-center">
                                                            <button onClick={() => handleDeleteGrade(subj.id)}
                                                                disabled={deletingGrade === subj.id}
                                                                className="p-1.5 rounded-lg transition-colors disabled:opacity-40"
                                                                style={{ color: '#c9b9b0', background: 'none', border: 'none', cursor: 'pointer' }}
                                                                onMouseEnter={e => { e.currentTarget.style.background = `${CLAY}16`; e.currentTarget.style.color = CLAY; }}
                                                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#c9b9b0'; }}>
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
                        <Metric icon={TrendingUp}     label="Overall"    value={`${complianceRate}%`}                color={MAROON} />
                        <Metric icon={FileText}       label="Reports"    value={`${approvedSubs}/${totalSubs}`}      color={SAGE} />
                        <Metric icon={Calendar}       label="Attendance" value={`${attRate}%`}                       color={AMBER} />
                        <Metric icon={Heart}          label="Service"    value={`${totalService}/${reqService} hrs`} color={GOLD} />
                    </div>

                    <Card icon={FileText} title="Report Submissions">
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            {[
                                { label: 'Approved', value: compliance.report_submissions.approved, color: SAGE },
                                { label: 'Pending',  value: compliance.report_submissions.pending,  color: AMBER },
                                { label: 'Rejected', value: compliance.report_submissions.rejected, color: CLAY },
                            ].map(s => (
                                <div key={s.label} className="text-center p-3 rounded-lg" style={{ background: `${s.color}0F` }}>
                                    <p style={{ ...display, fontSize: '1.3rem', fontWeight: 600, color: s.color }}>{s.value}</p>
                                    <p style={{ ...body, fontSize: '0.64rem', fontWeight: 600, color: '#8a7a70', marginTop: 2 }}>{s.label}</p>
                                </div>
                            ))}
                        </div>
                        {compliance.report_submissions.items.length === 0
                            ? <p style={{ ...body, fontSize: '0.75rem', color: '#c9b9b0', fontStyle: 'italic', textAlign: 'center', padding: '14px 0' }}>No submissions yet.</p>
                            : compliance.report_submissions.items.map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-lg mb-2 last:mb-0" style={{ background: IVORY, border: `1px solid ${LINE}` }}>
                                    <p style={{ ...body, fontSize: '0.78rem', color: '#4b3f38' }}>
                                        {new Date(item.submitted_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                                    </p>
                                    <StatusBadge status={item.status} />
                                </div>
                            ))
                        }
                    </Card>

                    <Card icon={Calendar} title="Duty Attendance">
                        <div className="flex justify-between mb-2" style={{ ...body, fontSize: '0.8rem' }}>
                            <span style={{ fontWeight: 600, color: INK }}>{compliance.attendance.present} of {compliance.attendance.total} duties</span>
                            <span style={{ fontWeight: 700, color: MAROON }}>{attRate}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full overflow-hidden mb-4" style={{ background: `${SAGE}20` }}>
                            <div className="h-full rounded-full" style={{ width: `${attRate}%`, backgroundColor: SAGE }} />
                        </div>
                        <div className="flex gap-3">
                            {[
                                { label: 'Present', value: compliance.attendance.present, color: SAGE },
                                { label: 'Absent',  value: compliance.attendance.absent,  color: CLAY },
                                { label: 'Excused', value: compliance.attendance.excused, color: AMBER },
                            ].map(s => (
                                <div key={s.label} className="flex-1 text-center p-3 rounded-lg" style={{ background: `${s.color}0F` }}>
                                    <p style={{ ...display, fontSize: '1.3rem', fontWeight: 600, color: s.color }}>{s.value}</p>
                                    <p style={{ ...body, fontSize: '0.64rem', fontWeight: 600, color: '#8a7a70', marginTop: 2 }}>{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <Card icon={Heart} title="Community Service">
                        <div className="flex justify-between mb-2" style={{ ...body, fontSize: '0.8rem' }}>
                            <span style={{ fontWeight: 600, color: INK }}>{totalService} / {reqService} hrs</span>
                            <span style={{ fontWeight: 700, color: SAGE }}>{svcProgress}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full overflow-hidden mb-4" style={{ background: `${SAGE}20` }}>
                            <div className="h-full rounded-full" style={{ width: `${svcProgress}%`, backgroundColor: SAGE }} />
                        </div>
                        {compliance.community_service.items.length === 0
                            ? <p style={{ ...body, fontSize: '0.75rem', color: '#c9b9b0', fontStyle: 'italic', textAlign: 'center', padding: '14px 0' }}>No service activities yet.</p>
                            : compliance.community_service.items.map((s, i) => (
                                <div key={i} className="flex justify-between py-2.5" style={{ borderBottom: i < compliance.community_service.items.length - 1 ? `1px solid ${LINE}` : 'none' }}>
                                    <p style={{ ...body, fontSize: '0.82rem', fontWeight: 500, color: INK }}>{s.name}</p>
                                    <span style={{ ...mono, fontSize: '0.78rem', fontWeight: 700, color: SAGE }}>{s.hours} hrs</span>
                                </div>
                            ))
                        }
                    </Card>
                </div>
            )}

            {/* ── SUBMISSIONS TAB ── */}
            {activeTab === 'submissions' && (
                <div className="space-y-4">
                    {submissions.length === 0
                        ? <div className="rounded-lg bg-white p-16 text-center" style={{ border: `1px solid ${LINE}` }}>
                            <FileText size={40} className="mx-auto mb-3" style={{ color: '#e9d9dc' }} />
                            <p style={{ ...body, fontSize: '0.85rem', fontWeight: 600, color: '#c9b9b0' }}>No progress reports submitted yet.</p>
                          </div>
                        : submissions.map((sub) => (
                            <div key={sub.id} className="p-5 rounded-lg bg-white" style={{ border: `1px solid ${LINE}` }}>
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <div>
                                        <p style={{ ...display, fontSize: '0.9rem', fontWeight: 600, color: INK }}>Monthly Compliance Report</p>
                                        <p style={{ ...body, fontSize: '0.7rem', color: '#a89890', marginTop: 2 }}>
                                            {new Date(sub.submitted_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="px-2.5 py-1 rounded-full" style={{
                                            ...body, fontSize: '0.6rem', fontWeight: 700,
                                            background: `${sub.quality_status === 'accepted' ? SAGE : sub.quality_status === 'medium_risk' ? AMBER : CLAY}14`,
                                            color: sub.quality_status === 'accepted' ? SAGE : sub.quality_status === 'medium_risk' ? AMBER : CLAY,
                                        }}>{sub.quality_score}%</span>
                                        <StatusBadge status={sub.status} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                                    {[
                                        { label: 'Report Card',   value: sub.report_card_path },
                                        { label: 'COR',           value: sub.cor_path },
                                        { label: 'Service Hours', value: sub.service_activity ? `${sub.service_hours} hrs` : null },
                                        { label: 'Photos',        value: sub.media_paths ? 'Uploaded' : null },
                                    ].map(doc => (
                                        <div key={doc.label} className="p-2.5 rounded-lg text-center"
                                            style={{ background: doc.value ? `${SAGE}0F` : IVORY, border: `1px solid ${doc.value ? SAGE + '30' : LINE}` }}>
                                            <p style={{ ...body, fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#a89890' }}>{doc.label}</p>
                                            <p style={{ ...body, fontSize: '0.72rem', fontWeight: 600, marginTop: 2, color: doc.value ? SAGE : '#c9b9b0' }}>{doc.value || 'Missing'}</p>
                                        </div>
                                    ))}
                                </div>
                                {sub.staff_comment && (
                                    <div className="p-3 rounded-lg" style={{ ...body, fontSize: '0.76rem', fontWeight: 500, background: `${sub.status === 'rejected' ? CLAY : SAGE}0F`, color: sub.status === 'rejected' ? CLAY : SAGE }}>
                                        <span style={{ fontWeight: 700 }}>Staff Feedback: </span>{sub.staff_comment}
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
                        ? <div className="rounded-lg bg-white p-16 text-center" style={{ border: `1px solid ${LINE}` }}>
                            <MessageSquareWarning size={40} className="mx-auto mb-3" style={{ color: '#e9d9dc' }} />
                            <p style={{ ...body, fontSize: '0.85rem', fontWeight: 600, color: '#c9b9b0' }}>No letters submitted yet.</p>
                          </div>
                        : submissions.filter(s => s.letter_content).map((sub) => (
                            <div key={sub.id} className="p-6 rounded-lg bg-white" style={{ border: `1px solid ${LINE}` }}>
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <div>
                                        <p style={{ ...display, fontSize: '0.9rem', fontWeight: 600, color: INK }}>Monthly Report Letter</p>
                                        <p style={{ ...body, fontSize: '0.7rem', color: '#a89890', marginTop: 2 }}>
                                            {new Date(sub.submitted_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                                        </p>
                                    </div>
                                    <span className="px-2.5 py-1 rounded-full" style={{ ...body, fontSize: '0.6rem', fontWeight: 700, background: `${getSentimentColor(sub.sentiment_label)}14`, color: getSentimentColor(sub.sentiment_label) }}>
                                        {sub.sentiment_label || 'Not analyzed'}
                                    </span>
                                </div>
                                <div className="p-4 rounded-lg mb-4" style={{ background: IVORY, borderLeft: `3px solid ${getSentimentColor(sub.sentiment_label)}` }}>
                                    <p style={{ ...display, fontSize: '0.82rem', fontStyle: 'italic', color: '#6b5c52', lineHeight: 1.6 }}>"{sub.letter_content}"</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { label: 'Sentiment Score', value: sub.sentiment_score || '0', color: sub.sentiment_score > 0 ? SAGE : sub.sentiment_score < 0 ? CLAY : AMBER },
                                        { label: 'Quality Score',   value: `${sub.quality_score}%`,    color: sub.quality_score >= 71 ? SAGE : sub.quality_score >= 50 ? AMBER : CLAY },
                                    ].map(s => (
                                        <div key={s.label} className="p-3 rounded-lg" style={{ background: IVORY, border: `1px solid ${LINE}` }}>
                                            <p style={{ ...body, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#a89890' }}>{s.label}</p>
                                            <p style={{ ...display, fontSize: '1.1rem', fontWeight: 600, marginTop: 3, color: s.color }}>{s.value}</p>
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
                <Card icon={Calendar} title="Duty Attendance History" action={
                    <div className="flex gap-2">
                        <span className="px-2.5 py-1 rounded-full" style={{ ...body, fontSize: '0.6rem', fontWeight: 700, background: `${SAGE}14`, color: SAGE }}>{compliance?.attendance?.present || 0} Present</span>
                        <span className="px-2.5 py-1 rounded-full" style={{ ...body, fontSize: '0.6rem', fontWeight: 700, background: `${CLAY}14`, color: CLAY }}>{compliance?.attendance?.absent || 0} Absent</span>
                    </div>
                }>
                    {attendance.length === 0
                        ? <p style={{ ...body, fontSize: '0.75rem', color: '#c9b9b0', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>No attendance records yet.</p>
                        : attendance.map((att, i) => (
                            <div key={i} className="flex items-center justify-between p-4 rounded-lg mb-3 last:mb-0" style={{ background: IVORY, border: `1px solid ${LINE}` }}>
                                <div>
                                    <p style={{ ...body, fontSize: '0.82rem', fontWeight: 600, color: INK }}>{att.title}</p>
                                    <p style={{ ...body, fontSize: '0.7rem', color: '#a89890', marginTop: 2 }}>
                                        {new Date(att.duty_date).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                                        {att.location ? ` · ${att.location}` : ''}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-1 rounded-full" style={{
                                        ...body, fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
                                        background: `${att.status === 'present' ? SAGE : att.status === 'excused' ? AMBER : CLAY}14`,
                                        color: att.status === 'present' ? SAGE : att.status === 'excused' ? AMBER : CLAY,
                                    }}>{att.status}</span>
                                    <span style={{ ...body, fontSize: '0.66rem', color: '#a89890' }}>via {att.method}</span>
                                </div>
                            </div>
                        ))
                    }
                </Card>
            )}

            {/* ── RISK TAB ── */}
            {activeTab === 'risk' && (
                <div className="space-y-6">
                    <div className="p-6 rounded-lg" style={{ background: `${risk.color}0C`, border: `1px solid ${risk.color}35` }}>
                        <div className="flex items-center gap-4">
                            <div className="p-4 rounded-lg" style={{ background: `${risk.color}14` }}>
                                <Shield size={28} style={{ color: risk.color }} />
                            </div>
                            <div>
                                <p style={{ ...body, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b5c52' }}>Current Risk Level</p>
                                <p style={{ ...display, fontSize: '1.7rem', fontWeight: 600, color: risk.color }}>{risk.level}</p>
                                <p style={{ ...body, fontSize: '0.74rem', color: '#8a7a70', marginTop: 4 }}>Based on submission history, sentiment analysis, and quality scores</p>
                            </div>
                        </div>
                    </div>
                    <Card icon={Shield} title="Risk Factors">
                        <div className="space-y-3">
                            {[
                                { label: 'Negative Sentiment Letters', value: submissions.filter(s => s.sentiment_label?.includes('Negative')).length, threshold: 1, weight: '25%' },
                                { label: 'Rejected Submissions',        value: submissions.filter(s => s.status === 'rejected').length,                  threshold: 1, weight: '35%' },
                                { label: 'Low Quality Score (< 70%)',   value: submissions.filter(s => s.quality_score < 70).length,                    threshold: 1, weight: '40%' },
                            ].map(f => (
                                <div key={f.label} className="flex items-center justify-between p-4 rounded-lg" style={{ background: IVORY, border: `1px solid ${LINE}` }}>
                                    <div>
                                        <p style={{ ...body, fontSize: '0.82rem', fontWeight: 600, color: INK }}>{f.label}</p>
                                        <p style={{ ...body, fontSize: '0.66rem', color: '#a89890', marginTop: 2 }}>Weight: {f.weight}</p>
                                    </div>
                                    <div className="text-right">
                                        <p style={{ ...display, fontSize: '1.15rem', fontWeight: 600, color: f.value >= f.threshold ? CLAY : SAGE }}>{f.value}</p>
                                        <p style={{ ...body, fontSize: '0.62rem', color: '#a89890' }}>instances</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
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