import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
    ArrowLeft, BookOpen, ClipboardCheck, FileText,
    MessageSquareWarning, Clock, Shield,
    CheckCircle, XCircle, Download, Edit3,
    Bell, Hash, Mail, TrendingUp,
    Activity, Calendar, Star, Heart, ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react';
import FilePreviewModal from '../../components/Officer/ManualValidation/FilePreviewModal';
import { fileKind } from '../../utils/submissionHelpers';
import { formatAdminDate, formatAdminMonth } from '../../utils/adminPreferences';
import AdminPageHeader from '../../components/Admin/AdminPageHeader';

// ── Executive design tokens ──────────────────────────────────────
const BG           = '#F7F4EE';
const SURFACE      = '#FFFDF9';
const BORDER       = '#E7D8C7';
const PRIMARY      = '#6D2140';
const PRIMARY_DEEP = '#4A1730';
const INK          = '#241512';
const MUTED        = '#8A7A68';
const BRONZE       = '#A9784E';
const SUCCESS      = '#6B8F71';
const WARNING      = '#C08A3E';
const DANGER       = '#A24A4A';
const RADIUS       = 16;
const SHADOW       = '0 1px 2px rgba(74, 23, 48, 0.04), 0 6px 18px rgba(74, 23, 48, 0.04)';

const serif = { fontFamily: "'Playfair Display', serif" };
const sans  = { fontFamily: "'Inter', sans-serif" };

const cardStyle = { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: SHADOW };

const RAW_API = (import.meta.env?.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API_BASE = RAW_API.endsWith('/api') ? RAW_API : `${RAW_API}/api`;
const ADMIN_API = `${API_BASE}/admin`;
const EXPORT_API = `${API_BASE}/export`;

const badgeMap = {
    complied: { color: SUCCESS, Icon: CheckCircle, label: 'Complied' },
    pending:  { color: WARNING, Icon: Clock,        label: 'Pending'  },
    missed:   { color: DANGER,  Icon: XCircle,      label: 'Missed'   },
    passed:   { color: SUCCESS, Icon: CheckCircle,  label: 'Passed'   },
    failed:   { color: DANGER,  Icon: XCircle,      label: 'Failed'   },
    approved: { color: SUCCESS, Icon: CheckCircle,  label: 'Approved' },
    rejected: { color: DANGER,  Icon: XCircle,      label: 'Rejected' },
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
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full whitespace-nowrap"
            style={{ backgroundColor: `${color}14`, border: `1px solid ${color}35`, ...sans, fontSize: '0.66rem', fontWeight: 600, color }}>
            <Icon className="w-3 h-3" />{label}
        </span>
    );
};

// ── Surface card — the base building block of the portfolio ──────
const Panel = ({ icon: Icon, title, subtitle, action, children, padded = true }) => (
    <div className="h-full min-w-0 overflow-hidden" style={cardStyle}>
        {title && (
            <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pt-5 pb-4">
                <div className="flex items-center gap-3 min-w-0">
                    {Icon && (
                        <span className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 32, height: 32, background: `${PRIMARY}0F`, color: PRIMARY }}>
                            <Icon size={15} />
                        </span>
                    )}
                    <div className="min-w-0">
                        <h3 style={{ ...serif, fontSize: '1.02rem', fontWeight: 600, color: INK }}>{title}</h3>
                        {subtitle && <p style={{ ...sans, fontSize: '0.74rem', color: MUTED, marginTop: 2 }}>{subtitle}</p>}
                    </div>
                </div>
                {action}
            </div>
        )}
        <div className={padded ? `px-5 sm:px-6 pb-6 ${title ? '' : 'pt-6'}` : ''}>{children}</div>
    </div>
);

// ── KPI card — Playfair number, icon top-right ───────────────────
const KpiCard = ({ icon: Icon, label, value, color }) => (
    <div className="p-5 min-w-0" style={cardStyle}>
        <div className="flex items-center justify-between gap-3">
            <p style={{ ...sans, fontSize: '0.8rem', fontWeight: 500, color: MUTED }}>{label}</p>
            <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${color}14`, color }}>
                <Icon size={16} />
            </span>
        </div>
        <p style={{ ...serif, fontSize: '1.9rem', fontWeight: 600, color: INK, lineHeight: 1.1, marginTop: 14 }}>{value}</p>
    </div>
);

// ── Horizontal progress bar for factors / breakdowns ──────────────
const ProgressRow = ({ label, sub, value, max = 100, color }) => {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    return (
        <div>
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <span className="min-w-0 break-words" style={{ ...sans, fontSize: '0.8rem', fontWeight: 600, color: INK }}>{label}</span>
                {sub && <span className="text-right" style={{ ...sans, fontSize: '0.7rem', color: MUTED }}>{sub}</span>}
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: `${color}18` }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
        </div>
    );
};

const ViewAllButton = ({ onClick }) => (
    <button onClick={onClick}
        className="rounded-full transition-opacity hover:opacity-75 flex-shrink-0"
        style={{ ...sans, fontSize: '0.68rem', fontWeight: 700, color: PRIMARY, background: `${PRIMARY}0F`, padding: '6px 14px', border: 'none', cursor: 'pointer' }}>
        View All
    </button>
);

const EmptyNote = ({ children }) => (
    <p style={{ ...sans, fontSize: '0.78rem', color: MUTED, fontStyle: 'italic', textAlign: 'center', padding: '18px 0' }}>{children}</p>
);

const EmptyCard = ({ icon: Icon, children }) => (
    <div className="p-14 text-center" style={cardStyle}>
        <Icon size={38} className="mx-auto mb-3" style={{ color: `${BRONZE}66` }} />
        <p style={{ ...sans, fontSize: '0.85rem', fontWeight: 600, color: MUTED }}>{children}</p>
    </div>
);

const MiniLabel = ({ children }) => (
    <p style={{ ...sans, fontSize: '0.7rem', fontWeight: 600, color: MUTED }}>{children}</p>
);

const getSentimentColor = (label) => {
    if (!label) return MUTED;
    const l = label.toLowerCase();
    if (l.includes('positive')) return SUCCESS;
    if (l.includes('negative')) return DANGER;
    return WARNING;
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
    const [gradePreview, setGradePreview] = useState(null);
    const [reminding, setReminding] = useState(false);
    const [flaggedRecord, setFlaggedRecord] = useState(null);
    const [profileError, setProfileError]   = useState('');
    const [failedSections, setFailedSections] = useState([]);

    const fetchAll = async () => {
        setProfile(null); setSubmissions([]); setAttendance([]);
        setGrades([]); setCompliance(null);
        setProfileError(''); setFailedSections([]);
        setLoading(true); setActiveTab('overview');
        try {
            const [pR, sR, aR, gR, cR] = await Promise.allSettled([
                axios.get(`${ADMIN_API}/scholars/${id}/profile`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
                axios.get(`${ADMIN_API}/scholars/${id}/submissions`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
                axios.get(`${ADMIN_API}/scholars/${id}/attendance`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
                axios.get(`${ADMIN_API}/scholars/${id}/grades`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
                axios.get(`${ADMIN_API}/scholars/${id}/compliance-summary`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
            ]);
            if (pR.status === 'fulfilled') setProfile(pR.value.data);
            if (sR.status === 'fulfilled') setSubmissions(sR.value.data);
            if (aR.status === 'fulfilled') setAttendance(aR.value.data);
            if (gR.status === 'fulfilled') setGrades(gR.value.data);
            if (cR.status === 'fulfilled') setCompliance(cR.value.data);

            // Surface failures (display only; requests are unchanged)
            if (pR.status === 'rejected') {
                setProfileError(pR.reason?.response?.data?.error || pR.reason?.message || 'The profile request failed.');
            }
            setFailedSections([
                sR.status === 'rejected' && 'Submissions',
                aR.status === 'rejected' && 'Attendance',
                gR.status === 'rejected' && 'Grades',
                cR.status === 'rejected' && 'Compliance summary',
            ].filter(Boolean));

            if (pR.status === 'fulfilled') {
                const token = localStorage.getItem('token');
                const flaggedResponse = await axios.get(`${API_BASE}/flagged/scholars`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const scholarId = pR.value.data.scholar_id;
                setFlaggedRecord((flaggedResponse.data || []).find(item => item.scholar_id === scholarId) || null);
            }
        } catch (e) {
            console.error(e);
            setFailedSections(prev => (prev.includes('Flagged risk record') ? prev : [...prev, 'Flagged risk record']));
        }
        finally { setLoading(false); }
    };

    useEffect(() => {
        // Refresh the selected scholar's profile whenever the route changes.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{
            'Scholar ID': profile?.scholar_id, 'Full Name': profile?.full_name,
            'Email': profile?.email, 'Year Level': formatYearLevelLabel(profile?.year_level), 'Status': profile?.status,
        }]), 'Profile');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
            grades.flatMap(sem => (sem.subjects || []).map(s => ({
                Semester: sem.semester, 'Acad Year': sem.academic_year,
                Subject: s.subject_name, Units: s.units, Grade: s.grade, GWA: sem.gwa, Status: sem.status,
            })))
        ), 'Grades');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
            submissions.map(s => ({
                Date: formatAdminDate(s.submitted_at),
                'Quality Score': s.quality_score, Status: s.status,
                'Staff Comment': s.staff_comment || '', 'Service Hours': s.service_hours || 0,
            }))
        ), 'Submissions');
        XLSX.writeFile(wb, `${profile?.scholar_id}_profile.xlsx`);
        axios.post(`${EXPORT_API}/google-sheets`, { log_only: true, module: 'Scholar Profile', report_resource: 'Scholar Profile Export', spreadsheet_title: 'Scholar Profile Export', details: `${profile?.scholar_id}_profile.xlsx` }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).catch(() => {});
    };

    const handleRemind = async () => {
        setReminding(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(`${API_BASE}/flagged/scholars/${profile.scholar_id}/remind`, {}, {
                headers: { Authorization: `Bearer ${token}` },
            });
            alert(response.data.message || 'Reminder sent successfully.');
        } catch (error) {
            alert(error.response?.data?.error || 'Unable to send reminder.');
        } finally {
            setReminding(false);
        }
    };

    const getRiskLevel = () => {
        if (flaggedRecord) {
            return {
                level: flaggedRecord.risk_level === 'high' ? 'High Risk' : 'Moderate Risk',
                color: flaggedRecord.risk_level === 'high' ? DANGER : WARNING,
            };
        }
        const neg = submissions.filter(s => s.sentiment_label?.includes('Negative')).length;
        const rej = submissions.filter(s => s.status === 'rejected').length;
        const avg = profile?.avg_quality_score || 0;
        if (neg >= 2 || rej >= 2 || avg < 50) return { level: 'High Risk', color: DANGER };
        if (neg >= 1 || rej >= 1 || avg < 70) return { level: 'Moderate Risk', color: WARNING };
        return { level: 'Low Risk', color: SUCCESS };
    };

    // Safe views of the compliance payload (empty objects when missing)
    const repSummary = compliance?.report_submissions || {};
    const attSummary = compliance?.attendance || {};
    const svcSummary = compliance?.community_service || {};
    const repItems   = repSummary.items || [];
    const svcItems   = svcSummary.items || [];

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
    const liveFlags = flaggedRecord?.flags || [];

    const tabs = [
        { id: 'overview',       label: 'Overview',         icon: <Activity size={14} />            },
        { id: 'academic',       label: 'Academic',         icon: <BookOpen size={14} />             },
        { id: 'compliance',     label: 'Compliance',       icon: <ClipboardCheck size={14} />       },
        { id: 'submissions',    label: 'Reports',          icon: <FileText size={14} />             },
        { id: 'correspondence', label: 'Letters',          icon: <MessageSquareWarning size={14} /> },
        { id: 'attendance',     label: 'Attendance',       icon: <Calendar size={14} />             },
        { id: 'risk',           label: 'Risk',             icon: <Shield size={14} />               },
    ];

    // ── Loading skeleton ──
    if (loading) {
        const block = { background: '#EFE6D8', borderRadius: RADIUS };
        return (
            <div className="min-h-screen overflow-x-hidden" style={{ background: BG, ...sans }}>
                <div className="px-5 sm:px-8 pt-8 pb-8 flex flex-col gap-5">
                    <div>
                        <div className="animate-pulse h-3 w-28 rounded-full mb-3" style={{ background: `${BRONZE}30` }} />
                        <div className="animate-pulse h-8 w-64 max-w-full rounded-lg" style={{ background: `${PRIMARY}14` }} />
                    </div>
                    <div className="animate-pulse h-44" style={block} />
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[0, 1, 2, 3].map(i => <div key={i} className="animate-pulse h-28" style={block} />)}
                    </div>
                    <div className="animate-pulse h-11 w-full max-w-xl rounded-full" style={{ background: '#EFE6D8' }} />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div className="animate-pulse h-64" style={block} />
                        <div className="animate-pulse h-64" style={block} />
                    </div>
                </div>
            </div>
        );
    }

    // ── Profile could not be loaded ──
    if (!profile) {
        return (
            <div className="min-h-screen flex items-center justify-center px-5" style={{ background: BG, ...sans }}>
                <div className="w-full max-w-md text-center p-8" style={cardStyle}>
                    <span className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: `${DANGER}14`, color: DANGER }}>
                        <AlertTriangle size={20} />
                    </span>
                    <h1 style={{ ...serif, fontSize: '1.3rem', fontWeight: 600, color: INK }}>
                        {profileError ? 'Unable to load this profile' : 'Scholar not found'}
                    </h1>
                    <p className="break-words" style={{ ...sans, fontSize: '0.84rem', color: MUTED, marginTop: 8, lineHeight: 1.6 }}>
                        {profileError
                            ? `${profileError} Please try again or return to User Management.`
                            : 'This scholar record is not available. Return to User Management and select another scholar.'}
                    </p>
                    <div className="flex flex-wrap justify-center gap-2.5 mt-6">
                        <button onClick={() => navigate('/admin/users')}
                            className="flex items-center gap-2 rounded-full transition-opacity hover:opacity-90"
                            style={{ ...sans, fontSize: '0.78rem', fontWeight: 700, color: '#fff', background: PRIMARY, border: 'none', padding: '10px 18px', cursor: 'pointer' }}>
                            <ArrowLeft size={14} /> Back to User Management
                        </button>
                        {profileError && (
                            <button onClick={fetchAll}
                                className="rounded-full transition-opacity hover:opacity-75"
                                style={{ ...sans, fontSize: '0.78rem', fontWeight: 600, color: PRIMARY, background: 'transparent', border: `1px solid ${PRIMARY}`, padding: '10px 18px', cursor: 'pointer' }}>
                                Try again
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const statusColor = profile.status === 'active' ? SUCCESS : profile.status === 'flagged' ? DANGER : MUTED;

    return (
        <div className="min-h-screen overflow-x-hidden" style={{ background: BG, ...sans }}>
            <div className="w-full px-4 sm:px-6 lg:px-8 pb-14 flex flex-col gap-5">

                {/* ── Page header: back + title on the left, actions on the right (desktop); actions grid below (mobile/tablet) ── */}
                {(() => {
                    const actions = [
                        { key: 'export', full: 'Export Excel', short: 'Export', Icon: Download, onClick: handleExportExcel },
                        { key: 'remind', full: reminding ? 'Sending…' : 'Send Reminder', short: reminding ? 'Sending…' : 'Remind', Icon: Bell, onClick: handleRemind, disabled: reminding },
                        { key: 'edit', full: 'Edit Profile', short: 'Edit', Icon: Edit3, onClick: () => navigate('/admin/users') },
                    ];
                    const pill = {
                        ...sans, fontSize: '0.78rem', fontWeight: 600, color: PRIMARY,
                        background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 999,
                        height: 40, whiteSpace: 'nowrap',
                    };
                    return (
                        <AdminPageHeader
                            title="Scholar Portfolio"
                            description="Academic, compliance, attendance, submission, and risk records for this scholar."
                            leading={
                                <button onClick={() => navigate('/admin/users')}
                                    aria-label="Back to User Management" title="Back to User Management"
                                    className="flex items-center justify-center flex-shrink-0 rounded-full transition-colors hover:bg-[rgba(109,33,64,0.08)]"
                                    style={{ ...pill, width: 40, padding: 0, cursor: 'pointer', marginTop: 2 }}>
                                    <ArrowLeft size={16} />
                                </button>
                            }
                            actions={
                            <>
                                {/* Desktop actions */}
                                <div className="hidden lg:flex flex-shrink-0 gap-2.5 self-center">
                                    {actions.map(({ key, full, Icon, onClick, disabled }) => (
                                        <button key={key} onClick={onClick} disabled={disabled}
                                            className="flex items-center gap-2 transition-colors hover:bg-[rgba(109,33,64,0.08)]"
                                            style={{ ...pill, padding: '0 16px', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
                                            <Icon size={14} /> {full}
                                        </button>
                                    ))}
                                </div>

                            {/* Mobile / tablet actions: equal-width row */}
                            <div className="grid grid-cols-3 gap-2 mt-4 lg:hidden">
                                {actions.map(({ key, full, short, Icon, onClick, disabled }) => (
                                    <button key={key} onClick={onClick} disabled={disabled} aria-label={full}
                                        className="flex items-center justify-center gap-1.5 min-w-0 transition-colors hover:bg-[rgba(109,33,64,0.08)]"
                                        style={{ ...pill, padding: '0 8px', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
                                        <Icon size={14} className="flex-shrink-0" />
                                        <span className="sm:hidden truncate">{short}</span>
                                        <span className="hidden sm:inline truncate">{full}</span>
                                    </button>
                                ))}
                            </div>
                            </>
                            }
                        />
                    );
                })()}

                {/* ── Partial-load warning ── */}
                {failedSections.length > 0 && (
                    <div role="alert" className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ background: `${WARNING}14`, border: `1px solid ${WARNING}45` }}>
                        <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: WARNING }} />
                        <p style={{ ...sans, fontSize: '0.8rem', color: '#8a6423', lineHeight: 1.5 }}>
                            Some records could not be loaded: {failedSections.join(', ')}. The related sections may be incomplete.
                            <button onClick={fetchAll} style={{ ...sans, fontSize: '0.8rem', fontWeight: 700, color: PRIMARY, background: 'none', border: 'none', cursor: 'pointer', marginLeft: 8, padding: 0 }}>Reload</button>
                        </p>
                    </div>
                )}

                {/* ── Scholar identity card ── */}
                <div style={cardStyle}>
                    <div className="p-5 sm:p-7 flex flex-col md:flex-row md:items-start gap-5 md:gap-6">
                        <div className="flex items-start gap-4 sm:gap-5 flex-1 min-w-0">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DEEP} 100%)` }}>
                                <span style={{ ...serif, color: '#fff', fontSize: '1.5rem', fontWeight: 600 }}>
                                    {profile.full_name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                                </span>
                            </div>
                            <div className="min-w-0">
                                <h2 className="break-words" style={{ ...serif, fontSize: '1.45rem', fontWeight: 600, color: INK, lineHeight: 1.2 }}>{profile.full_name}</h2>
                                <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2.5">
                                    {[
                                        [Hash, profile.scholar_id || '—'],
                                        [Mail, profile.email],
                                        [BookOpen, formatYearLevelLabel(profile.year_level)],
                                    ].map(([Icon, val], i) => (
                                        <span key={i} className="flex items-center gap-1.5 min-w-0" style={{ ...sans, fontSize: '0.8rem', color: MUTED }}>
                                            <Icon size={13} className="flex-shrink-0" style={{ color: BRONZE }} />
                                            <span className="break-all">{val}</span>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex flex-wrap gap-2 mt-3.5">
                                    <span className="px-3 py-1.5 rounded-full" style={{
                                        ...sans, fontSize: '0.68rem', fontWeight: 700,
                                        background: `${statusColor}14`, color: statusColor, border: `1px solid ${statusColor}35`,
                                    }}>{(profile.status || 'unknown').replace(/^./, c => c.toUpperCase())}</span>
                                    <span className="px-3 py-1.5 rounded-full" style={{ ...sans, fontSize: '0.68rem', fontWeight: 700, background: `${BRONZE}14`, color: BRONZE, border: `1px solid ${BRONZE}35` }}>
                                        {profile.scholarship_status || 'Full Scholarship'}
                                    </span>
                                    <span className="px-3 py-1.5 rounded-full" style={{ ...sans, fontSize: '0.68rem', fontWeight: 700, background: `${risk.color}14`, color: risk.color, border: `1px solid ${risk.color}35` }}>
                                        {risk.level}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4" style={{ borderTop: `1px solid ${BORDER}` }}>
                        {[
                            { label: 'Average quality score', value: `${Math.round(profile.avg_quality_score || 0)}%` },
                            { label: 'GWA', value: grades[0]?.gwa ? grades[0].gwa.toFixed(2) : '—' },
                            { label: 'Service hours', value: `${totalService} hrs` },
                            { label: 'Attendance', value: `${attRate}%` },
                        ].map((chip, i) => (
                            <div key={chip.label}
                                className={`px-5 sm:px-7 py-4 min-w-0 ${i % 2 === 1 ? 'border-l' : ''} ${i >= 2 ? 'border-t sm:border-t-0' : ''} ${i > 0 ? 'sm:border-l' : ''}`}
                                style={{ borderColor: BORDER }}>
                                <MiniLabel>{chip.label}</MiniLabel>
                                <p style={{ ...serif, fontSize: '1.3rem', fontWeight: 600, color: INK, marginTop: 3 }}>{chip.value}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── KPI row ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard icon={TrendingUp} label="Compliance Rate"   value={`${complianceRate}%`} color={PRIMARY} />
                    <KpiCard icon={Calendar}   label="Attendance Rate"   value={`${attRate}%`}        color={SUCCESS} />
                    <KpiCard icon={Heart}      label="Community Service" value={`${totalService} hrs`} color={BRONZE} />
                    <KpiCard icon={Star}       label="Average Quality"   value={`${Math.round(profile.avg_quality_score || 0)}%`} color={WARNING} />
                </div>

                {/* ── Segmented navigation ── */}
                <div role="tablist" aria-label="Scholar portfolio sections"
                    className="flex gap-1.5 overflow-x-auto p-1.5 rounded-full w-fit max-w-full"
                    style={{ background: SURFACE, border: `1px solid ${BORDER}`, scrollbarWidth: 'none' }}>
                    {tabs.map(t => {
                        const activeState = activeTab === t.id;
                        return (
                            <button key={t.id} role="tab" aria-selected={activeState} onClick={() => setActiveTab(t.id)}
                                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full transition-all whitespace-nowrap"
                                style={{
                                    ...sans, fontSize: '0.76rem', fontWeight: 600,
                                    color: activeState ? '#fff' : MUTED,
                                    background: activeState ? PRIMARY : 'transparent',
                                    border: 'none', cursor: 'pointer',
                                }}>
                                {t.icon} {t.label}
                            </button>
                        );
                    })}
                </div>

                {/* ── OVERVIEW ── */}
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                        <div className="flex flex-col gap-5 min-w-0">
                            <Panel icon={BookOpen} title="Academic Summary" subtitle="Most recent semesters." action={<ViewAllButton onClick={() => setActiveTab('academic')} />}>
                                {grades.length === 0
                                    ? <EmptyNote>No grades recorded yet.</EmptyNote>
                                    : grades.slice(0, 4).map((sem, i) => (
                                        <div key={i} className="flex flex-wrap items-center justify-between gap-2 py-3" style={{ borderBottom: i < Math.min(grades.length, 4) - 1 ? `1px solid ${BORDER}` : 'none' }}>
                                            <div className="min-w-0">
                                                <p style={{ ...sans, fontSize: '0.84rem', fontWeight: 600, color: INK }}>{sem.semester} AY {sem.academic_year}</p>
                                                <p style={{ ...sans, fontSize: '0.7rem', color: MUTED }}>{sem.total_units} units</p>
                                            </div>
                                            <div className="flex items-center gap-2.5">
                                                <span style={{ ...serif, fontSize: '1rem', fontWeight: 600, color: PRIMARY }}>{sem.gwa ? sem.gwa.toFixed(2) : 'TBA'}</span>
                                                <StatusBadge status={sem.status} />
                                            </div>
                                        </div>
                                    ))
                                }
                            </Panel>

                            <Panel icon={Heart} title="Community Service" subtitle="Hours completed toward the requirement.">
                                <div className="mb-4">
                                    <div className="flex flex-wrap justify-between gap-x-3 mb-1.5" style={{ ...sans, fontSize: '0.78rem' }}>
                                        <span style={{ fontWeight: 600, color: INK }}>{totalService} hrs completed</span>
                                        <span style={{ color: MUTED }}>{Math.max(reqService - totalService, 0)} hrs remaining</span>
                                    </div>
                                    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: `${BRONZE}18` }}>
                                        <div className="h-full rounded-full" style={{ width: `${svcProgress}%`, backgroundColor: BRONZE }} />
                                    </div>
                                </div>
                                {svcItems.length > 0
                                    ? svcItems.slice(0, 3).map((s, i) => (
                                        <div key={i} className="flex items-center justify-between gap-3 py-2.5" style={{ borderTop: `1px solid ${BORDER}` }}>
                                            <p className="min-w-0 break-words" style={{ ...sans, fontSize: '0.82rem', fontWeight: 500, color: INK }}>{s.name}</p>
                                            <span className="flex-shrink-0" style={{ ...serif, fontSize: '0.88rem', fontWeight: 600, color: BRONZE }}>{s.hours} hrs</span>
                                        </div>
                                    ))
                                    : <EmptyNote>No service activities yet.</EmptyNote>
                                }
                            </Panel>
                        </div>

                        <Panel icon={FileText} title="Recent Reports" subtitle="Latest submissions." action={<ViewAllButton onClick={() => setActiveTab('submissions')} />}>
                            {submissions.length === 0
                                ? <EmptyNote>No submissions yet.</EmptyNote>
                                : submissions.slice(0, 5).map((sub, i) => (
                                    <div key={sub.id} className="relative pl-5 pb-5 last:pb-0" style={{ borderLeft: i < submissions.slice(0, 5).length - 1 ? `1px solid ${BORDER}` : '1px solid transparent' }}>
                                        <span className="absolute rounded-full" style={{ width: 8, height: 8, left: -4.5, top: 4, background: getSentimentColor(sub.sentiment_label) }} />
                                        <p style={{ ...sans, fontSize: '0.7rem', color: MUTED, marginBottom: 4 }}>
                                            {formatAdminDate(sub.submitted_at)}
                                        </p>
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span style={{ ...sans, fontSize: '0.84rem', fontWeight: 600, color: INK }}>Quality {sub.quality_score}%</span>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="px-2 py-0.5 rounded-full" style={{ ...sans, fontSize: '0.62rem', fontWeight: 700, background: `${getSentimentColor(sub.sentiment_label)}14`, color: getSentimentColor(sub.sentiment_label) }}>
                                                    {sub.sentiment_label || 'N/A'}
                                                </span>
                                                <StatusBadge status={sub.status} />
                                            </div>
                                        </div>
                                    </div>
                                ))
                            }
                        </Panel>
                    </div>
                )}

                {/* ── ACADEMIC TAB ── */}
                {activeTab === 'academic' && (
                    <div className="flex flex-col gap-4">
                        {grades.length === 0 ? (
                            <EmptyCard icon={BookOpen}>No grades recorded yet.</EmptyCard>
                        ) : grades.map((sem, si) => {
                            const key    = `${sem.semester}|${sem.academic_year}`;
                            const isOpen = expandedSem === key;
                            const subjects = sem.subjects || [];
                            return (
                                <div key={si} className="overflow-hidden" style={cardStyle}>
                                    <button onClick={() => setExpandedSem(isOpen ? null : key)}
                                        aria-expanded={isOpen}
                                        className="w-full flex items-center justify-between gap-4 px-5 sm:px-6 py-4 transition-colors text-left"
                                        style={{ background: isOpen ? BG : SURFACE, border: 'none', cursor: 'pointer' }}>
                                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 min-w-0">
                                            <div>
                                                <p style={{ ...serif, fontSize: '0.98rem', fontWeight: 600, color: INK }}>{sem.semester} AY {sem.academic_year}</p>
                                                <p style={{ ...sans, fontSize: '0.72rem', color: MUTED, marginTop: 2 }}>{sem.total_units} total units</p>
                                            </div>
                                            <div className="flex items-center gap-2.5">
                                                <span style={{ ...serif, fontSize: '1.15rem', fontWeight: 600, color: PRIMARY }}>{sem.gwa ? sem.gwa.toFixed(2) : 'TBA'}</span>
                                                <span style={{ ...sans, fontSize: '0.66rem', color: MUTED }}>GWA</span>
                                                <StatusBadge status={sem.status} />
                                            </div>
                                        </div>
                                        {isOpen ? <ChevronUp size={16} className="flex-shrink-0" style={{ color: BRONZE }} /> : <ChevronDown size={16} className="flex-shrink-0" style={{ color: BRONZE }} />}
                                    </button>
                                    {isOpen && (
                                        <div style={{ borderTop: `1px solid ${BORDER}` }}>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left" style={{ minWidth: 360 }}>
                                                    <thead>
                                                        <tr style={{ borderBottom: `1px solid ${BORDER}`, background: BG }}>
                                                            {['Subject', 'Units', 'Grade'].map((h) => (
                                                                <th key={h} className="px-5 sm:px-6 py-3"
                                                                    style={{ ...sans, fontSize: '0.72rem', fontWeight: 600, color: MUTED }}>{h}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {subjects.map((subj, ji) => (
                                                            <tr key={ji} style={{ borderBottom: ji < subjects.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                                                                <td className="px-5 sm:px-6 py-3" style={{ ...sans, fontSize: '0.82rem', fontWeight: 500, color: INK }}>{subj.subject_name}</td>
                                                                <td className="px-5 sm:px-6 py-3" style={{ ...sans, fontSize: '0.8rem', color: MUTED }}>{subj.units}</td>
                                                                <td className="px-5 sm:px-6 py-3">
                                                                    <span className="px-2.5 py-0.5 rounded-full" style={{
                                                                        ...sans, fontSize: '0.8rem', fontWeight: 700,
                                                                        color: subj.grade <= 3.00 ? SUCCESS : DANGER,
                                                                        background: `${subj.grade <= 3.00 ? SUCCESS : DANGER}14`,
                                                                    }}>{Number(subj.grade).toFixed(2)}</span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            {sem.proof_path && (
                                                <div className="px-5 sm:px-6 py-4" style={{ borderTop: `1px solid ${BORDER}` }}>
                                                    <button type="button" onClick={() => setGradePreview({ url: `${API_BASE}/submission/preview?url=${encodeURIComponent(sem.proof_path)}`, kind: fileKind(sem.proof_path), label: `Grade Proof - ${sem.semester} AY ${sem.academic_year}` })}
                                                        className="rounded-full transition-opacity hover:opacity-75"
                                                        style={{ ...sans, fontSize: '0.74rem', fontWeight: 700, color: PRIMARY, background: 'transparent', border: `1px solid ${PRIMARY}40`, padding: '8px 16px', cursor: 'pointer' }}>
                                                        View submitted grade proof
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── COMPLIANCE TAB ── */}
                {activeTab === 'compliance' && (
                    !compliance ? (
                        <EmptyCard icon={ClipboardCheck}>Compliance data is not available for this scholar yet.</EmptyCard>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
                            <Panel icon={FileText} title="Report Compliance" subtitle="Submission review status.">
                                <div className="space-y-4 mb-5">
                                    <ProgressRow label="Approved" sub={`${repSummary.approved || 0} of ${totalSubs}`} value={repSummary.approved || 0} max={Math.max(totalSubs, 1)} color={SUCCESS} />
                                    <ProgressRow label="Pending"  sub={`${repSummary.pending || 0} of ${totalSubs}`}  value={repSummary.pending || 0}  max={Math.max(totalSubs, 1)} color={WARNING} />
                                    <ProgressRow label="Rejected" sub={`${repSummary.rejected || 0} of ${totalSubs}`} value={repSummary.rejected || 0} max={Math.max(totalSubs, 1)} color={DANGER} />
                                </div>
                                {repItems.length === 0
                                    ? <EmptyNote>No submissions yet.</EmptyNote>
                                    : repItems.map((item, i) => (
                                        <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-xl mb-2 last:mb-0" style={{ background: BG, border: `1px solid ${BORDER}` }}>
                                            <p style={{ ...sans, fontSize: '0.78rem', color: INK }}>
                                                {formatAdminDate(item.submitted_at)}
                                            </p>
                                            <StatusBadge status={item.status} />
                                        </div>
                                    ))
                                }
                            </Panel>

                            <Panel icon={Calendar} title="Attendance" subtitle="Duty attendance record.">
                                <div className="flex items-end justify-between gap-3 mb-3">
                                    <span style={{ ...serif, fontSize: '2.1rem', fontWeight: 600, color: INK, lineHeight: 1 }}>{attRate}%</span>
                                    <span style={{ ...sans, fontSize: '0.78rem', color: MUTED }}>{attSummary.present || 0} of {attSummary.total || 0} duties</span>
                                </div>
                                <div className="w-full h-1.5 rounded-full overflow-hidden mb-5" style={{ background: `${SUCCESS}18` }}>
                                    <div className="h-full rounded-full" style={{ width: `${attRate}%`, backgroundColor: SUCCESS }} />
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { label: 'Present', value: attSummary.present || 0, color: SUCCESS },
                                        { label: 'Absent',  value: attSummary.absent || 0,  color: DANGER },
                                        { label: 'Excused', value: attSummary.excused || 0, color: WARNING },
                                    ].map(s => (
                                        <div key={s.label} className="text-center p-3 rounded-xl" style={{ background: `${s.color}0C` }}>
                                            <p style={{ ...serif, fontSize: '1.3rem', fontWeight: 600, color: s.color }}>{s.value}</p>
                                            <p style={{ ...sans, fontSize: '0.7rem', fontWeight: 600, color: MUTED, marginTop: 2 }}>{s.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </Panel>

                            <Panel icon={Heart} title="Community Service" subtitle="Progress toward required hours.">
                                <div className="flex items-end justify-between gap-3 mb-3">
                                    <span style={{ ...serif, fontSize: '2.1rem', fontWeight: 600, color: INK, lineHeight: 1 }}>{svcProgress}%</span>
                                    <span style={{ ...sans, fontSize: '0.78rem', color: MUTED }}>{totalService} / {reqService} hrs</span>
                                </div>
                                <div className="w-full h-1.5 rounded-full overflow-hidden mb-5" style={{ background: `${BRONZE}18` }}>
                                    <div className="h-full rounded-full" style={{ width: `${svcProgress}%`, backgroundColor: BRONZE }} />
                                </div>
                                {svcItems.length === 0
                                    ? <EmptyNote>No service activities yet.</EmptyNote>
                                    : (
                                        <div className="grid grid-cols-1 gap-2.5">
                                            {svcItems.map((s, i) => (
                                                <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: BG, border: `1px solid ${BORDER}` }}>
                                                    <span className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 32, height: 32, background: `${BRONZE}14`, color: BRONZE }}>
                                                        <Heart size={14} />
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="break-words" style={{ ...sans, fontSize: '0.8rem', fontWeight: 600, color: INK }}>{s.name}</p>
                                                        <p style={{ ...sans, fontSize: '0.72rem', color: BRONZE, fontWeight: 600 }}>{s.hours} hrs</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                }
                            </Panel>
                        </div>
                    )
                )}

                {/* ── SUBMISSIONS TAB ── */}
                {activeTab === 'submissions' && (
                    <div className="flex flex-col gap-4">
                        {submissions.length === 0
                            ? <EmptyCard icon={FileText}>No progress reports submitted yet.</EmptyCard>
                            : submissions.map((sub) => {
                                const qColor = sub.quality_status === 'accepted' ? SUCCESS : sub.quality_status === 'medium_risk' ? WARNING : DANGER;
                                return (
                                    <div key={sub.id} className="p-5 sm:p-6 min-w-0" style={cardStyle}>
                                        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                                            <div>
                                                <p style={{ ...serif, fontSize: '0.98rem', fontWeight: 600, color: INK }}>
                                                    {formatAdminMonth(sub.submitted_at)}
                                                </p>
                                                <p style={{ ...sans, fontSize: '0.72rem', color: MUTED, marginTop: 2 }}>
                                                    Submitted {formatAdminDate(sub.submitted_at)}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <span className="px-2.5 py-1 rounded-full" style={{ ...sans, fontSize: '0.66rem', fontWeight: 700, background: `${qColor}14`, color: qColor }}>
                                                    Quality {sub.quality_score}%
                                                </span>
                                                <StatusBadge status={sub.status} />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                            {[
                                                { label: 'Report Card',   value: sub.report_card_path ? 'Submitted' : null },
                                                { label: 'COR',           value: sub.cor_path ? 'Submitted' : null },
                                                { label: 'Service Hours', value: sub.service_activity ? `${sub.service_hours} hrs` : null },
                                                { label: 'Photos',        value: sub.media_paths ? 'Uploaded' : null },
                                            ].map(doc => (
                                                <div key={doc.label} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl min-w-0"
                                                    style={{ background: doc.value ? `${SUCCESS}0C` : BG, border: `1px solid ${doc.value ? SUCCESS + '30' : BORDER}` }}>
                                                    {doc.value
                                                        ? <CheckCircle size={14} className="flex-shrink-0" style={{ color: SUCCESS }} />
                                                        : <XCircle size={14} className="flex-shrink-0" style={{ color: `${MUTED}99` }} />}
                                                    <div className="min-w-0">
                                                        <p style={{ ...sans, fontSize: '0.68rem', fontWeight: 600, color: MUTED }}>{doc.label}</p>
                                                        <p className="break-words" style={{ ...sans, fontSize: '0.76rem', fontWeight: 600, color: doc.value ? SUCCESS : MUTED }}>{doc.value || 'Missing'}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {sub.staff_comment && (
                                            <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
                                                <MiniLabel>Staff feedback</MiniLabel>
                                                <p className="break-words" style={{ ...sans, fontSize: '0.82rem', color: INK, lineHeight: 1.55, marginTop: 4 }}>{sub.staff_comment}</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        }
                    </div>
                )}

                {/* ── CORRESPONDENCE TAB ── */}
                {activeTab === 'correspondence' && (() => {
                    const letters = submissions.filter(s => s.letter_content);
                    const posCount = letters.filter(s => s.sentiment_label?.toLowerCase().includes('positive')).length;
                    const negCount = letters.filter(s => s.sentiment_label?.toLowerCase().includes('negative')).length;
                    const neuCount = letters.length - posCount - negCount;
                    const avgSentiment = letters.length
                        ? (letters.reduce((sum, s) => sum + (Number(s.sentiment_score) || 0), 0) / letters.length).toFixed(2)
                        : '0.00';
                    return (
                        <div className="flex flex-col gap-4">
                            {letters.length === 0
                                ? <EmptyCard icon={MessageSquareWarning}>No letters submitted yet.</EmptyCard>
                                : <>
                                    <div className="flex flex-wrap gap-2.5">
                                        {[
                                            { label: `${posCount} Positive`, color: SUCCESS },
                                            { label: `${neuCount} Neutral`,  color: WARNING },
                                            { label: `${negCount} Negative`, color: DANGER },
                                            { label: `Avg Sentiment ${avgSentiment}`, color: PRIMARY },
                                        ].map(chip => (
                                            <span key={chip.label} className="px-3 py-1.5 rounded-full" style={{ ...sans, fontSize: '0.72rem', fontWeight: 600, background: `${chip.color}12`, color: chip.color, border: `1px solid ${chip.color}30` }}>
                                                {chip.label}
                                            </span>
                                        ))}
                                    </div>
                                    {letters.map((sub) => {
                                        const sColor = getSentimentColor(sub.sentiment_label);
                                        return (
                                            <div key={sub.id} className="p-5 sm:p-7 min-w-0" style={{ ...cardStyle, borderLeft: `3px solid ${sColor}` }}>
                                                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                                    <p style={{ ...sans, fontSize: '0.74rem', color: MUTED }}>
                                                        {formatAdminDate(sub.submitted_at)}
                                                    </p>
                                                    <span className="px-2.5 py-1 rounded-full" style={{ ...sans, fontSize: '0.66rem', fontWeight: 700, background: `${sColor}14`, color: sColor }}>
                                                        {sub.sentiment_label || 'Not analyzed'}
                                                    </span>
                                                </div>
                                                <div className="relative pl-6 mb-5">
                                                    <span aria-hidden style={{ position: 'absolute', left: 0, top: -6, ...serif, fontSize: '2.6rem', color: `${BRONZE}45`, lineHeight: 1 }}>"</span>
                                                    <p className="break-words" style={{ ...serif, fontSize: '0.96rem', fontStyle: 'italic', color: INK, lineHeight: 1.7 }}>{sub.letter_content}</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
                                                    <div>
                                                        <MiniLabel>Sentiment score</MiniLabel>
                                                        <p style={{ ...serif, fontSize: '1.15rem', fontWeight: 600, marginTop: 2, color: sub.sentiment_score > 0 ? SUCCESS : sub.sentiment_score < 0 ? DANGER : WARNING }}>{sub.sentiment_score || '0'}</p>
                                                    </div>
                                                    <div>
                                                        <MiniLabel>Quality score</MiniLabel>
                                                        <p style={{ ...serif, fontSize: '1.15rem', fontWeight: 600, marginTop: 2, color: sub.quality_score >= 70 ? SUCCESS : sub.quality_score >= 50 ? WARNING : DANGER }}>{sub.quality_score}%</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                  </>
                            }
                        </div>
                    );
                })()}

                {/* ── ATTENDANCE TAB ── */}
                {activeTab === 'attendance' && (
                    <Panel icon={Calendar} title="Attendance History" subtitle="Duty attendance records." padded={false} action={
                        <div className="flex gap-2">
                            <span className="px-2.5 py-1 rounded-full" style={{ ...sans, fontSize: '0.66rem', fontWeight: 700, background: `${SUCCESS}14`, color: SUCCESS }}>{compliance?.attendance?.present || 0} Present</span>
                            <span className="px-2.5 py-1 rounded-full" style={{ ...sans, fontSize: '0.66rem', fontWeight: 700, background: `${DANGER}14`, color: DANGER }}>{compliance?.attendance?.absent || 0} Absent</span>
                        </div>
                    }>
                        {attendance.length === 0
                            ? <div className="px-6 pb-6"><EmptyNote>No attendance records yet.</EmptyNote></div>
                            : (
                                <div style={{ borderTop: `1px solid ${BORDER}` }}>
                                    <div className="hidden sm:grid gap-4 px-6 py-2.5 sm:grid-cols-[130px_minmax(0,1fr)_110px_96px]" style={{ background: BG, borderBottom: `1px solid ${BORDER}` }}>
                                        {['Duty date', 'Duty', 'Method', 'Status'].map(h => (
                                            <span key={h} style={{ ...sans, fontSize: '0.72rem', fontWeight: 600, color: MUTED }}>{h}</span>
                                        ))}
                                    </div>
                                    {attendance.map((att, i) => {
                                        const aColor = att.status === 'present' ? SUCCESS : att.status === 'excused' ? WARNING : DANGER;
                                        return (
                                            <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[130px_minmax(0,1fr)_110px_96px] gap-x-4 gap-y-1 items-center px-6 py-3.5"
                                                style={{ borderBottom: i < attendance.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                                                <p className="col-span-2 sm:col-span-1" style={{ ...sans, fontSize: '0.74rem', color: MUTED }}>{formatAdminDate(att.duty_date)}</p>
                                                <p className="break-words" style={{ ...sans, fontSize: '0.84rem', fontWeight: 600, color: INK }}>{att.title}{att.location ? ` · ${att.location}` : ''}</p>
                                                <span className="hidden sm:block" style={{ ...sans, fontSize: '0.74rem', color: MUTED }}>via {att.method}</span>
                                                <span className="justify-self-end sm:justify-self-start inline-flex px-2.5 py-1 rounded-full" style={{
                                                    ...sans, fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase',
                                                    background: `${aColor}14`, color: aColor, width: 'fit-content',
                                                }}>{att.status}</span>
                                                <span className="sm:hidden col-span-2" style={{ ...sans, fontSize: '0.7rem', color: MUTED }}>via {att.method}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                        }
                    </Panel>
                )}

                {/* ── RISK TAB ── */}
                {activeTab === 'risk' && (() => {
                    const riskPct = risk.level === 'High Risk' ? 85 : risk.level === 'Moderate Risk' ? 50 : 15;
                    const circumference = 2 * Math.PI * 54;
                    const dashOffset = circumference * (1 - riskPct / 100);
                    const renderFactor = (f) => (
                        <ProgressRow key={f.label}
                            label={f.label}
                            sub={f.description || (f.weight ? `Weight: ${f.weight}` : `${f.value} instances`)}
                            value={f.value} max={Math.max(f.threshold * 2, f.value, 1)}
                            color={f.value >= f.threshold ? DANGER : SUCCESS} />
                    );
                    const flagFactors = liveFlags.map(flag => ({ label: flag.type, description: flag.description, value: 1, threshold: 1 }));
                    const calcFactors = !flaggedRecord ? [
                        { label: 'Negative Sentiment Letters', value: submissions.filter(s => s.sentiment_label?.includes('Negative')).length, threshold: 1, weight: '25%' },
                        { label: 'Rejected Submissions',        value: submissions.filter(s => s.status === 'rejected').length,                  threshold: 1, weight: '35%' },
                        { label: 'Low Quality Score (< 70%)',   value: submissions.filter(s => s.quality_score < 70).length,                    threshold: 1, weight: '40%' },
                    ] : [];
                    return (
                        <div className="flex flex-col gap-5">
                            <div className="p-6 sm:p-7 flex flex-col sm:flex-row items-center gap-6 sm:gap-8" style={cardStyle}>
                                <div className="relative flex-shrink-0" style={{ width: 132, height: 132 }}>
                                    <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label={`Risk indicator ${riskPct}%`}>
                                        <circle cx="66" cy="66" r="54" fill="none" stroke={`${risk.color}18`} strokeWidth="10" />
                                        <circle cx="66" cy="66" r="54" fill="none" stroke={risk.color} strokeWidth="10" strokeLinecap="round"
                                            strokeDasharray={circumference} strokeDashoffset={dashOffset}
                                            transform="rotate(-90 66 66)" />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span style={{ ...serif, fontSize: '1.5rem', fontWeight: 600, color: risk.color }}>{riskPct}%</span>
                                    </div>
                                </div>
                                <div className="text-center sm:text-left">
                                    <MiniLabel>Current risk level</MiniLabel>
                                    <p style={{ ...serif, fontSize: '1.7rem', fontWeight: 600, color: risk.color, marginTop: 2 }}>{risk.level}</p>
                                    <p style={{ ...sans, fontSize: '0.8rem', color: MUTED, marginTop: 6, maxWidth: 400, lineHeight: 1.55 }}>
                                        {flaggedRecord
                                            ? 'Level taken from this scholar\u2019s live flagged record. The gauge is a visual indicator of that level.'
                                            : 'Calculated from submission history, sentiment analysis, and quality scores. The gauge is a visual indicator of that level.'}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                                <Panel icon={Shield} title="Risk Factors" subtitle={flaggedRecord ? 'Flags from the live record.' : 'Calculated from submissions.'}>
                                    {flagFactors.length > 0 && (
                                        <div className="space-y-4">
                                            <MiniLabel>Flagged record</MiniLabel>
                                            {flagFactors.map(renderFactor)}
                                        </div>
                                    )}
                                    {calcFactors.length > 0 && (
                                        <div className="space-y-4" style={{ marginTop: flagFactors.length ? 20 : 0 }}>
                                            <MiniLabel>Calculated indicators</MiniLabel>
                                            {calcFactors.map(renderFactor)}
                                        </div>
                                    )}
                                    {flagFactors.length === 0 && calcFactors.length === 0 && (
                                        <EmptyNote>No active risk flags.</EmptyNote>
                                    )}
                                </Panel>

                                {flaggedRecord ? (
                                    <div className="p-5 sm:p-6" style={{ background: `${risk.color}0A`, border: `1px solid ${risk.color}35`, borderRadius: RADIUS }}>
                                        <div className="flex items-center justify-between gap-3 mb-4">
                                            <h3 style={{ ...serif, fontSize: '1.02rem', fontWeight: 600, color: INK }}>Live Flagged Record</h3>
                                            <StatusBadge status={flaggedRecord.risk_level === 'high' ? 'rejected' : 'pending'} />
                                        </div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <MiniLabel>Risk score</MiniLabel>
                                                <p style={{ ...serif, fontSize: '1.7rem', fontWeight: 600, color: risk.color, lineHeight: 1.2 }}>{Math.round(flaggedRecord.risk_score)}</p>
                                            </div>
                                            <div>
                                                <MiniLabel>Generated</MiniLabel>
                                                <p style={{ ...sans, fontSize: '0.82rem', fontWeight: 600, color: INK, marginTop: 4 }}>
                                                    {flaggedRecord.generated_at ? formatAdminDate(flaggedRecord.generated_at) : '—'}
                                                </p>
                                            </div>
                                            <div>
                                                <MiniLabel>Active flags</MiniLabel>
                                                <p style={{ ...sans, fontSize: '0.82rem', fontWeight: 600, color: INK, marginTop: 4 }}>{liveFlags.length}</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <Panel icon={Shield} title="Live Flagged Record" subtitle="Actual flagged records for this scholar.">
                                        <EmptyNote>No live flagged record. The risk level above is calculated from submissions.</EmptyNote>
                                    </Panel>
                                )}
                            </div>
                        </div>
                    );
                })()}

                {gradePreview && (
                    <FilePreviewModal
                        preview={gradePreview}
                        onClose={() => setGradePreview(null)}
                    />
                )}
            </div>
        </div>
    );
};

export default ScholarProfileView;