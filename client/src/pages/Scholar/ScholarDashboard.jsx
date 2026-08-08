import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import useComplianceStatus from '../../hooks/useComplianceStatus';
import {
    CheckCircle, XCircle, Clock, AlertTriangle,
    Megaphone, ChevronRight, FileText, Upload,
    Timer, Image, TrendingUp
} from 'lucide-react';

const authHeader = () => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
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
        { label: 'Monthly Letter', done: !!latestSubmission?.letter_content, icon: <FileText size={14} /> },
        { label: 'Report Card', done: !!latestSubmission?.report_card_path, icon: <Upload size={14} /> },
        { label: 'COR', done: !!latestSubmission?.cor_path, icon: <Upload size={14} /> },
        { label: 'Service Hours', done: !!latestSubmission?.service_activity, icon: <Timer size={14} /> },
        { label: 'Activity Photos', done: !!latestSubmission?.media_paths, icon: <Image size={14} /> },
    ];

    const completedCount = requirements.filter(r => r.done).length;
    const progressPercent = Math.round((completedCount / requirements.length) * 100);

    const getProgressColor = (p) => {
        if (p >= 80) return 'bg-emerald-500';
        if (p >= 50) return 'bg-amber-400';
        return 'bg-red-400';
    };

    const getComplianceLabel = (value) => {
        if (value >= 90) return 'Excellent';
        if (value >= 80) return 'Good Standing';
        if (value >= 70) return 'Low Risk';
        if (value >= 50) return 'Medium Risk';
        return 'High Risk';
    };

    const getComplianceBadge = (value) => {
        if (value >= 90) return 'bg-emerald-50 text-emerald-700';
        if (value >= 80) return 'bg-sky-50 text-sky-700';
        if (value >= 70) return 'bg-amber-50 text-amber-700';
        if (value >= 50) return 'bg-orange-50 text-orange-700';
        return 'bg-red-50 text-red-700';
    };

    const complianceScore = complianceData?.overall_compliance ?? null;
    const complianceLabel = complianceScore !== null ? getComplianceLabel(complianceScore) : 'Loading...';
    const complianceBadgeClass = complianceScore !== null ? getComplianceBadge(complianceScore) : 'bg-slate-100 text-slate-500';
    const topFlags = complianceData?.flags?.slice(0, 2) ?? [];

    const Skeleton = ({ className }) => (
        <div className={`animate-pulse bg-slate-100 rounded-2xl ${className}`} />
    );

    return (
        <div className="p-4 sm:p-6 lg:p-10">
            {/* Header */}
            <header className="mb-8 font-serif">
                <p className="text-xs font-black text-[#7f2d3a] uppercase tracking-[0.3em] mb-1">Scholar Portal</p>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tighter">
                    Welcome, {name || 'Scholar'}.
                </h2>
                <p className="text-slate-400 font-sans font-medium mt-1 text-sm border-l-4 border-[#7f2d3a] pl-4">
                    Track your compliance and manage your requirements.
                </p>
            </header>

            {loading ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <Skeleton className="h-28" />
                        <div className="grid grid-cols-2 gap-4">
                            {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-28" />)}
                        </div>
                    </div>
                    <Skeleton className="h-40" />
                </div>
            ) : (
                <>
                    {/* Stat Cards */}
                    <section className="grid grid-cols-1 xl:grid-cols-4 gap-3 sm:gap-4 mb-8 font-sans">
                        <div className="bg-white border border-slate-100 rounded-[1.75rem] p-5 shadow-sm">
                            <div className="w-9 h-9 bg-[#7f2d3a]/10 text-[#7f2d3a] rounded-xl flex items-center justify-center mb-4">
                                <TrendingUp size={18} />
                            </div>
                            <p className="text-2xl font-black text-slate-900">{complianceScore !== null ? `${Math.round(complianceScore)}%` : '—'}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Compliance Credits</p>
                            <div className={`inline-flex items-center gap-2 mt-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${complianceBadgeClass}`}>
                                <span>{complianceLabel}</span>
                            </div>
                            <div className="mt-4 space-y-2">
                                {complianceLoading ? (
                                    <p className="text-xs text-slate-400">Loading compliance details…</p>
                                ) : complianceError ? (
                                    <p className="text-xs text-red-500">Unable to load compliance status.</p>
                                ) : topFlags.length ? (
                                    topFlags.map((flag, index) => (
                                        <div key={index} className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">
                                            {flag.description}
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-slate-400">No active compliance flags. Keep it up!</p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={refreshCompliance}
                                className="mt-4 inline-flex items-center justify-center rounded-full border border-[#7f2d3a] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#7f2d3a] hover:bg-[#7f2d3a]/5 transition"
                            >
                                Refresh
                            </button>
                        </div>
                        <div className="bg-white border border-slate-100 rounded-[1.75rem] p-5 shadow-sm">
                            <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
                                <CheckCircle size={18} />
                            </div>
                            <p className="text-2xl font-black text-slate-900">{completedCount}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Completed</p>
                        </div>
                        <div className="bg-white border border-slate-100 rounded-[1.75rem] p-5 shadow-sm">
                            <div className="w-9 h-9 bg-red-50 text-red-500 rounded-xl flex items-center justify-center mb-4">
                                <XCircle size={18} />
                            </div>
                            <p className="text-2xl font-black text-slate-900">{requirements.length - completedCount}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Missing</p>
                        </div>
                        <div className="bg-white border border-slate-100 rounded-[1.75rem] p-5 shadow-sm">
                            <div className="w-9 h-9 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center mb-4">
                                <Clock size={18} />
                            </div>
                            <p className="text-2xl font-black text-slate-900">
                                {latestSubmission?.status === 'pending' ? '1' : '0'}
                            </p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Pending Review</p>
                        </div>
                    </section>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left — Compliance Progress */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm font-sans">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-black text-slate-800 text-sm tracking-tight">Monthly Compliance Progress</h3>
                                    <button
                                        onClick={() => navigate('/scholar/checklist')}
                                        className="text-[10px] font-black text-[#7f2d3a] uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all"
                                    >
                                        View All <ChevronRight size={12} />
                                    </button>
                                </div>

                                <div className="w-full bg-slate-100 rounded-full h-3 mb-4">
                                    <div
                                        className={`h-3 rounded-full transition-all duration-700 ${getProgressColor(progressPercent)}`}
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>

                                <div className="space-y-2">
                                    {requirements.map((req, i) => (
                                        <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                                            <div className="flex items-center gap-2.5">
                                                <span className={`${req.done ? 'text-emerald-500' : 'text-slate-300'}`}>
                                                    {req.icon}
                                                </span>
                                                <span className="text-xs font-medium text-slate-600">{req.label}</span>
                                            </div>
                                            {req.done
                                                ? <CheckCircle size={14} className="text-emerald-500" />
                                                : <XCircle size={14} className="text-red-300" />
                                            }
                                        </div>
                                    ))}
                                </div>

                                {latestSubmission && (
                                    <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Latest Submission Status</p>
                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${
                                            latestSubmission.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                                            latestSubmission.status === 'rejected' ? 'bg-red-50 text-red-500' :
                                            'bg-amber-50 text-amber-600'
                                        }`}>
                                            {latestSubmission.status}
                                        </span>
                                    </div>
                                )}

                                {completedCount < requirements.length && (
                                    <button
                                        onClick={() => navigate('/scholar/submission')}
                                        className="w-full mt-4 py-3 bg-[#7f2d3a] text-white font-black text-xs rounded-2xl uppercase tracking-widest hover:bg-[#63232d] transition-all"
                                    >
                                        Complete Missing Requirements
                                    </button>
                                )}
                            </div>

                            {latestSubmission?.status === 'rejected' && latestSubmission?.staff_comment && (
                                <div className="bg-red-50 border border-red-100 p-5 rounded-2xl font-sans">
                                    <p className="text-xs font-black text-red-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        <AlertTriangle size={13} /> Staff Feedback
                                    </p>
                                    <p className="text-xs text-red-700 leading-relaxed">{latestSubmission.staff_comment}</p>
                                </div>
                            )}
                        </div>

                        {/* Right — Announcements */}
                        <div className="flex flex-col gap-4 font-sans">
                            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
                                        <Megaphone size={14} className="text-[#7f2d3a]" />
                                        Announcements
                                    </h3>
                                    <button
                                        onClick={() => navigate('/scholar/announcements')}
                                        className="text-[10px] font-black text-[#7f2d3a] uppercase tracking-widest"
                                    >
                                        View All
                                    </button>
                                </div>

                                {announcements.length === 0 ? (
                                    <p className="text-xs text-slate-300 text-center py-6">No announcements yet.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {announcements.map((ann) => (
                                            <div key={ann.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                <p className="text-xs font-bold text-slate-700 leading-snug">{ann.title}</p>
                                                <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{ann.content}</p>
                                                <div className="flex items-center gap-1 mt-1.5">
                                                    <Clock size={9} className="text-slate-300" />
                                                    <p className="text-[10px] text-slate-300">
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

                            <div className="bg-[#7f2d3a] p-6 rounded-[2rem] text-white shadow-md shadow-[#7f2d3a]/20">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-2">Scholarship Status</p>
                                <p className="text-lg font-black tracking-tight">Active / Enrolled</p>
                                <div className="flex items-center gap-2 mt-3">
                                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                                    <p className="text-[10px] font-bold opacity-80">Verified Scholar</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ScholarDashboard;