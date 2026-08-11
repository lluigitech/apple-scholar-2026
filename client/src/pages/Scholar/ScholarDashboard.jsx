import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import useComplianceStatus from '../../hooks/useComplianceStatus';
import {
    CheckCircle, XCircle, Clock, AlertTriangle,
    Megaphone, ChevronRight, FileText, Upload,
    Timer, Image, TrendingUp, RefreshCw,
} from 'lucide-react';

// ── Token system — shared across the Scholar Portal ──
const MAROON = '#7f2d3a';
const MAROON_DEEP = '#4f1620';
const GOLD = '#b98b4e';
const IVORY = '#FBF7F2';
const INK = '#241512';
const ROSE = '#F5E8EA';

const authHeader = () => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
};

// Recolored onto the shared ledger palette — four tiers instead of five
// arbitrary Tailwind hues, matching the badges used across Profile/Settings.
const getComplianceLabel = (value) => {
    if (value >= 90) return 'Excellent';
    if (value >= 80) return 'Good Standing';
    if (value >= 70) return 'Low Risk';
    if (value >= 50) return 'Medium Risk';
    return 'High Risk';
};
const getComplianceColor = (value) => {
    if (value >= 90) return '#15803d';
    if (value >= 80) return '#15803d';
    if (value >= 70) return GOLD;
    if (value >= 50) return '#92400e';
    return '#991b1b';
};
const getComplianceBg = (value) => {
    if (value >= 90) return '#EAF3EC';
    if (value >= 80) return '#EAF3EC';
    if (value >= 70) return '#F6EFE1';
    if (value >= 50) return '#FBF0DE';
    return '#FBE9E9';
};

// ── Radial gauge — a semicircle arc reading the compliance score, the
// dashboard's signature instrument. Pure SVG, no chart library needed.
const ComplianceGauge = ({ score, color }) => {
    const RADIUS = 74;
    const CIRC = Math.PI * RADIUS; // half-circumference (180° arc length)
    const pct = score === null ? 0 : Math.max(0, Math.min(100, score)) / 100;
    const dash = pct * CIRC;
    return (
        <div className="relative flex flex-col items-center">
            <svg viewBox="0 0 200 110" className="w-full max-w-[220px]">
                <path d="M18,100 A82,82 0 0 1 182,100" fill="none" stroke="#f0e6e0" strokeWidth="14" strokeLinecap="round" />
                <path
                    d="M18,100 A82,82 0 0 1 182,100"
                    fill="none"
                    stroke={color}
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${CIRC * 2}`}
                    style={{ transition: 'stroke-dasharray 0.6s ease' }}
                />
            </svg>
            <div className="absolute top-[48px] flex flex-col items-center">
                <span className="text-3xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: INK }}>
                    {score !== null ? Math.round(score) : '—'}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-widest -mt-1" style={{ color: '#a89890' }}>Credits</span>
            </div>
        </div>
    );
};

// ── Donut — completed vs missing requirements, the gauge's companion chart.
const RequirementsDonut = ({ completed, total }) => {
    const RADIUS = 40;
    const CIRC = 2 * Math.PI * RADIUS;
    const pct = total > 0 ? completed / total : 0;
    const dash = pct * CIRC;
    return (
        <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 100, height: 100 }}>
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="#f0e6e0" strokeWidth="12" />
                <circle
                    cx="50" cy="50" r={RADIUS} fill="none" stroke="#15803d" strokeWidth="12"
                    strokeDasharray={`${dash} ${CIRC}`} strokeLinecap="round"
                    style={{ transition: 'stroke-dasharray 0.6s ease' }}
                />
            </svg>
            <div className="absolute flex flex-col items-center">
                <span className="text-lg font-bold" style={{ fontFamily: "'Playfair Display', serif", color: INK }}>{completed}/{total}</span>
                <span className="text-[8px] font-bold uppercase tracking-widest" style={{ color: '#a89890' }}>Done</span>
            </div>
        </div>
    );
};

const ScholarDashboard = () => {
    const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$|\/$/g, '');
    const API = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;

    const navigate = useNavigate();
    const { data: complianceData, loading: complianceLoading, error: complianceError, refetch: refreshCompliance } = useComplianceStatus();
    const name = localStorage.getItem('name');
    const scholarId = localStorage.getItem('scholar_id');
    const [latestSubmission, setLatestSubmission] = useState(null);
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [subRes, annRes] = await Promise.allSettled([
                    axios.get(`${API}/submission/history/${scholarId}`, {
                        headers: authHeader(),
                    }),
                    axios.get(`${API}/scholar/announcements`, {
                        headers: authHeader(),
                    }),
                ]);
                if (subRes.status === 'fulfilled' && subRes.value.data.length > 0) {
                    setLatestSubmission(subRes.value.data[0]);
                }
                if (annRes.status === 'fulfilled') {
                    setAnnouncements(annRes.value.data.slice(0, 3));
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [scholarId]);

    const requirements = [
        { label: 'Monthly Letter', done: !!latestSubmission?.letter_content, icon: <FileText size={13} /> },
        { label: 'Report Card', done: !!latestSubmission?.report_card_path, icon: <Upload size={13} /> },
        { label: 'COR', done: !!latestSubmission?.cor_path, icon: <Upload size={13} /> },
        { label: 'Service Hours', done: !!latestSubmission?.service_activity, icon: <Timer size={13} /> },
        { label: 'Activity Photos', done: !!latestSubmission?.media_paths, icon: <Image size={13} /> },
    ];

    const completedCount = requirements.filter(r => r.done).length;
    const progressPercent = Math.round((completedCount / requirements.length) * 100);

    const complianceScore = complianceData?.overall_compliance ?? null;
    const complianceLabel = complianceScore !== null ? getComplianceLabel(complianceScore) : 'Loading...';
    const complianceColor = complianceScore !== null ? getComplianceColor(complianceScore) : '#a89890';
    const complianceBg = complianceScore !== null ? getComplianceBg(complianceScore) : '#f1ece8';
    const topFlags = complianceData?.flags?.slice(0, 2) ?? [];

    const serif = { fontFamily: "'Playfair Display', serif" };
    const sans = { fontFamily: "'DM Sans', sans-serif" };

    const Skeleton = ({ className }) => (
        <div className={`animate-pulse rounded-2xl ${className}`} style={{ background: '#EFE7E2' }} />
    );

    return (
        <div style={{ ...sans, background: IVORY, minHeight: '100vh' }}>

            {/* ── Hero band ─────────────────────────────────────── */}
            <div
                className="relative overflow-hidden px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-16 sm:pb-20"
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
                    Scholar Portal
                </p>
                <h1 className="relative text-2xl sm:text-3xl md:text-4xl font-bold text-white" style={serif}>Welcome, {name || 'Scholar'}.</h1>
                <p className="relative text-xs mt-2 max-w-md" style={{ color: '#e9c9a8' }}>
                    Track your compliance and manage your requirements.
                </p>
            </div>

            <div className="px-4 sm:px-6 lg:p-8 lg:pt-0">

                {loading ? (
                    <div className="relative -mt-10 sm:-mt-12 space-y-5">
                        <Skeleton className="h-40" />
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-28" />)}
                        </div>
                        <Skeleton className="h-64" />
                    </div>
                ) : (
                    <>
                        {/* ── Instrument panel — gauge + donut, floats over the hero ── */}
                        <div
                            className="relative -mt-10 sm:-mt-12 mb-6 sm:mb-8 rounded-2xl bg-white p-5 sm:p-8"
                            style={{ boxShadow: '0 12px 30px -12px rgba(79,22,32,0.25)' }}
                        >
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-5 text-center sm:text-left" style={{ color: '#c9a9b0' }}>
                                Compliance At A Glance
                            </p>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-12">
                                <div className="flex flex-col items-center flex-shrink-0">
                                    <ComplianceGauge score={complianceScore} color={complianceColor} />
                                    <span
                                        className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mt-1"
                                        style={{ color: complianceColor, background: complianceBg }}
                                    >
                                        {complianceLabel}
                                    </span>
                                    <p className="text-[10px] font-bold uppercase tracking-widest mt-2" style={{ color: '#a89890' }}>Compliance Standing</p>
                                </div>

                                <div className="hidden sm:block w-px self-stretch" style={{ background: '#f0e6e0' }} />
                                <div className="block sm:hidden w-full h-px" style={{ background: '#f0e6e0' }} />

                                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
                                    <RequirementsDonut completed={completedCount} total={requirements.length} />
                                    <div className="flex flex-col items-center sm:items-start">
                                        <p className="text-sm font-bold" style={{ ...serif, color: INK }}>Monthly Requirements</p>
                                        <p className="text-xs mt-1 text-center sm:text-left" style={{ color: '#a89890' }}>{completedCount} of {requirements.length} filed this month</p>
                                        <button
                                            onClick={() => navigate('/scholar/checklist')}
                                            className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 mt-2"
                                            style={{ color: MAROON }}
                                        >
                                            View All <ChevronRight size={11} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Stat cards — tinted, with soft depth instead of flat blocks ── */}
                        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                            <div className="relative rounded-2xl p-4 sm:p-5" style={{ background: ROSE, boxShadow: '0 8px 20px -14px rgba(127,45,58,0.35)' }}>
                                <button
                                    type="button"
                                    onClick={refreshCompliance}
                                    title="Refresh compliance"
                                    className="absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center transition-colors bg-white/70 hover:bg-white"
                                    style={{ color: MAROON }}
                                >
                                    <RefreshCw size={11} />
                                </button>
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3 bg-white/70">
                                    <TrendingUp size={15} style={{ color: MAROON }} />
                                </div>
                                <p className="text-xl sm:text-2xl font-bold" style={{ ...serif, color: MAROON }}>{complianceScore !== null ? Math.round(complianceScore) : '—'}</p>
                                <p className="text-[9px] font-bold uppercase tracking-widest mt-1" style={{ color: '#a56475' }}>Compliance Credits</p>
                            </div>
                            <div className="rounded-2xl p-4 sm:p-5" style={{ background: '#EAF3EC', boxShadow: '0 8px 20px -14px rgba(21,128,61,0.3)' }}>
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3 bg-white/70">
                                    <CheckCircle size={15} className="text-[#15803d]" />
                                </div>
                                <p className="text-xl sm:text-2xl font-bold text-[#15803d]" style={serif}>{completedCount}</p>
                                <p className="text-[9px] font-bold uppercase tracking-widest mt-1" style={{ color: '#4c9d6a' }}>Completed</p>
                            </div>
                            <div className="rounded-2xl p-4 sm:p-5" style={{ background: '#FBE9E9', boxShadow: '0 8px 20px -14px rgba(153,27,27,0.3)' }}>
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3 bg-white/70">
                                    <XCircle size={15} className="text-[#991b1b]" />
                                </div>
                                <p className="text-xl sm:text-2xl font-bold text-[#991b1b]" style={serif}>{requirements.length - completedCount}</p>
                                <p className="text-[9px] font-bold uppercase tracking-widest mt-1" style={{ color: '#c4696e' }}>Missing</p>
                            </div>
                            <div className="rounded-2xl p-4 sm:p-5" style={{ background: '#FBF0DE', boxShadow: '0 8px 20px -14px rgba(146,64,14,0.3)' }}>
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3 bg-white/70">
                                    <Clock size={15} className="text-[#92400e]" />
                                </div>
                                <p className="text-xl sm:text-2xl font-bold text-[#92400e]" style={serif}>
                                    {latestSubmission?.status === 'pending' ? '1' : '0'}
                                </p>
                                <p className="text-[9px] font-bold uppercase tracking-widest mt-1" style={{ color: '#b9822f' }}>Pending Review</p>
                            </div>
                        </section>

                        {complianceLoading ? null : complianceError ? null : topFlags.length > 0 && (
                            <div className="rounded-2xl bg-white p-5 mb-6 sm:mb-8" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)' }}>
                                <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#a56475' }}>Active Compliance Flags</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {topFlags.map((flag, index) => (
                                        <div key={index} className="rounded-xl p-3 text-xs" style={{ background: IVORY, color: INK }}>
                                            {flag.description}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left — Compliance Progress, as a mini bar chart */}
                            <div className="lg:col-span-2 space-y-6">
                                <div className="bg-white p-6 rounded-2xl" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)' }}>
                                    <div className="flex items-center justify-between mb-5">
                                        <h3 className="font-bold text-sm" style={{ ...serif, color: INK }}>Monthly Compliance Progress</h3>
                                        <button
                                            onClick={() => navigate('/scholar/checklist')}
                                            className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all"
                                            style={{ color: MAROON }}
                                        >
                                            View All <ChevronRight size={12} />
                                        </button>
                                    </div>

                                    {/* status rows — boolean checklist items read clearer as pills than fake bars */}
                                    <div className="divide-y" style={{ borderColor: '#f5eee9' }}>
                                        {requirements.map((req, i) => (
                                            <div key={i} className="flex items-center justify-between gap-3 py-2.5">
                                                <span className="flex items-center gap-2.5 min-w-0">
                                                    <span
                                                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                                                        style={{ background: req.done ? '#EAF3EC' : '#FBE9E9', color: req.done ? '#15803d' : '#c4696e' }}
                                                    >
                                                        {req.icon}
                                                    </span>
                                                    <span className="text-sm font-medium truncate" style={{ color: INK }}>{req.label}</span>
                                                </span>
                                                <span
                                                    className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full flex-shrink-0"
                                                    style={req.done ? { color: '#15803d', background: '#EAF3EC' } : { color: '#991b1b', background: '#FBE9E9' }}
                                                >
                                                    {req.done ? 'Complied' : 'Missing'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {latestSubmission && (
                                        <div className="mt-5 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid #f5eee9' }}>
                                            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#a89890' }}>Latest Submission Status</p>
                                            <span
                                                className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
                                                style={
                                                    latestSubmission.status === 'approved' ? { background: '#EAF3EC', color: '#15803d' } :
                                                    latestSubmission.status === 'rejected' ? { background: '#FBE9E9', color: '#991b1b' } :
                                                    { background: '#FBF0DE', color: '#92400e' }
                                                }
                                            >
                                                {latestSubmission.status}
                                            </span>
                                        </div>
                                    )}

                                    {completedCount < requirements.length && (
                                        <button
                                            onClick={() => navigate('/scholar/submission')}
                                            className="w-full mt-5 py-3 text-white font-bold text-xs rounded-full uppercase tracking-widest transition-opacity hover:opacity-90"
                                            style={{ background: `linear-gradient(120deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)` }}
                                        >
                                            Complete Missing Requirements
                                        </button>
                                    )}
                                </div>

                                {latestSubmission?.status === 'rejected' && latestSubmission?.staff_comment && (
                                    <div className="p-5 rounded-2xl" style={{ background: '#FBE9E9', border: '1px solid #f3c6c6' }}>
                                        <p className="text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: '#991b1b' }}>
                                            <AlertTriangle size={13} /> Staff Feedback
                                        </p>
                                        <p className="text-xs leading-relaxed" style={{ color: '#991b1b' }}>{latestSubmission.staff_comment}</p>
                                    </div>
                                )}
                            </div>

                            {/* Right — Announcements */}
                            <div className="flex flex-col gap-4">
                                <div className="bg-white p-5 rounded-2xl" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)' }}>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold text-sm flex items-center gap-2" style={{ ...serif, color: INK }}>
                                            <Megaphone size={14} style={{ color: MAROON }} />
                                            Announcements
                                        </h3>
                                        <button
                                            onClick={() => navigate('/scholar/announcements')}
                                            className="text-[10px] font-bold uppercase tracking-widest"
                                            style={{ color: MAROON }}
                                        >
                                            View All
                                        </button>
                                    </div>

                                    {announcements.length === 0 ? (
                                        <p className="text-xs text-center py-6" style={{ color: '#c9b3b8' }}>No announcements yet.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {announcements.map((ann) => (
                                                <div key={ann.id} className="p-3 rounded-xl" style={{ background: IVORY }}>
                                                    <p className="text-xs font-bold leading-snug" style={{ color: INK }}>{ann.title}</p>
                                                    <p className="text-[10px] mt-1 line-clamp-2" style={{ color: '#a89890' }}>{ann.content}</p>
                                                    <div className="flex items-center gap-1 mt-1.5">
                                                        <Clock size={9} style={{ color: '#c9b3b8' }} />
                                                        <p className="text-[10px]" style={{ color: '#c9b3b8' }}>
                                                            {new Date(ann.created_at).toLocaleDateString('en-PH', {
                                                                month: 'short', day: 'numeric'
                                                            })}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="rounded-2xl p-6 text-white" style={{ background: `linear-gradient(135deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)`, boxShadow: '0 10px 26px -14px rgba(79,22,32,0.35)' }}>
                                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: GOLD }}>Scholarship Status</p>
                                    <p className="text-lg font-bold" style={serif}>Active / Enrolled</p>
                                    <div className="flex items-center gap-2 mt-3">
                                        <div className="w-2 h-2 rounded-full" style={{ background: '#8fe0b0' }} />
                                        <p className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>Verified Scholar</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ScholarDashboard;