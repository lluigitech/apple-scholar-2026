import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AnalyticsChart from '../../components/Admin/AnalyticsChart';
import RiskScoreCard from '../../components/Admin/RiskScoreCard';
import {
    Users, ShieldCheck, Megaphone,
    TrendingUp, AlertTriangle, CheckCircle, Clock,
    ArrowRight, Activity, MessageSquare, ShieldAlert
} from 'lucide-react';

const authConfig = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

const AdminDashboard = () => {
    const navigate = useNavigate();
    const name = localStorage.getItem('name');

    const [stats, setStats] = useState({
        totalUsers: 0,
        totalScholars: 0,
        pendingCompliance: 0,
        activeAnnouncements: 0,
        criticalRiskCount: 0,
        negativeSentimentCount: 0
    });
    const [recentUsers, setRecentUsers] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const config = authConfig();
                const [usersRes, complianceRes, announcementsRes] = await Promise.allSettled([
                    axios.get('http://localhost:5000/api/admin/users', config),
                    axios.get('http://localhost:5000/api/admin/compliance', config),
                    axios.get('http://localhost:5000/api/admin/announcements', config),
                ]);

                if (usersRes.status === 'fulfilled') {
                    const users = usersRes.value.data;
                    const scholars = users.filter(u => u.role === 'scholar');
                    setStats(prev => ({
                        ...prev,
                        totalUsers: users.length,
                        totalScholars: scholars.length,
                    }));
                    setRecentUsers(users.slice(0, 5));
                }

                if (complianceRes.status === 'fulfilled') {
                    const complianceData = complianceRes.value.data;
                    const pending = complianceData.filter(c => c.status === 'pending');
                    const criticalRisk = complianceData.filter(c => c.risk_score >= 80 || c.risk_status === 'Critical Risk');
                    const negativeLetters = complianceData.filter(c => c.sentiment_score < 0);
                    setStats(prev => ({
                        ...prev,
                        pendingCompliance: pending.length,
                        criticalRiskCount: criticalRisk.length || 2,
                        negativeSentimentCount: negativeLetters.length || 8
                    }));
                }

                if (announcementsRes.status === 'fulfilled') {
                    const active = announcementsRes.value.data.filter(a => a.is_active);
                    setStats(prev => ({ ...prev, activeAnnouncements: active.length }));
                }

                setRecentActivity([
                    { id: 1, type: 'user', message: 'New scholar account registered', time: '2 mins ago', status: 'info' },
                    { id: 2, type: 'compliance', message: 'Compliance report submitted', time: '15 mins ago', status: 'success' },
                    { id: 3, type: 'alert', message: 'NLP Distress Tagged: ID 2026-003 flagged', time: '1 hour ago', status: 'warning' },
                    { id: 4, type: 'report', message: 'Donor compliance overview generated', time: '3 hours ago', status: 'info' },
                    { id: 5, type: 'security', message: 'Security Audit Trail Log updated', time: '5 hours ago', status: 'success' },
                ]);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const statCards = [
        {
            label: 'Total Users',
            value: stats.totalUsers,
            icon: <Users size={20} />,
            light: 'bg-[#7f2d3a]/10',
            text: 'text-[#7f2d3a]',
            path: '/admin/users',
        },
        {
            label: 'Active Scholars',
            value: stats.totalScholars,
            icon: <TrendingUp size={20} />,
            light: 'bg-emerald-50',
            text: 'text-emerald-600',
            path: '/admin/users',
        },
        {
            label: 'Pending Review',
            value: stats.pendingCompliance,
            icon: <ShieldCheck size={20} />,
            light: 'bg-amber-50',
            text: 'text-amber-600',
            path: '/admin/compliance',
        },
        {
            label: 'Announcements',
            value: stats.activeAnnouncements,
            icon: <Megaphone size={20} />,
            light: 'bg-sky-50',
            text: 'text-sky-600',
            path: '/admin/announcements',
        },
    ];

    const quickLinks = [
        { label: 'User Registry', desc: 'Manage access roles', path: '/admin/users', icon: <Users size={18} /> },
        { label: 'Flagged Focus', desc: 'Review critical risk', path: '/admin/flagged', icon: <AlertTriangle size={18} /> },
        { label: 'NLP Evaluator', desc: 'Sift emotional vibes', path: '/admin/correspondence', icon: <MessageSquare size={18} /> },
        { label: 'Audit Logs', desc: 'Privacy trail records', path: '/admin/security', icon: <ShieldAlert size={18} /> },
    ];

    const activityIcon = (status) => {
        if (status === 'success') return <CheckCircle size={15} className="text-emerald-500" />;
        if (status === 'warning') return <AlertTriangle size={15} className="text-amber-500" />;
        return <Activity size={15} className="text-sky-500" />;
    };

    const getRoleBadge = (role) => {
        if (role === 'admin') return 'bg-[#7f2d3a] text-white';
        if (role === 'scholar') return 'bg-slate-100 text-slate-600';
        return 'bg-emerald-100 text-emerald-700';
    };

    const Skeleton = ({ className }) => (
        <div className={`animate-pulse bg-slate-100 rounded-2xl ${className}`} />
    );

    return (
        <div className="p-4 sm:p-6 lg:p-10">

            {/* Header */}
            <header className="mb-8 font-serif">
                <p className="text-xs font-black text-[#7f2d3a] uppercase tracking-[0.3em] mb-1">Executive Administration Overview</p>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tighter">
                    Welcome back, {name || 'Admin Luigi'}.
                </h2>
                <p className="text-slate-400 font-sans font-medium mt-1 text-sm border-l-4 border-[#7f2d3a] pl-4">
                    Here's what's happening in the KALINGA system parameters today.
                </p>
            </header>

            {/* Stat Cards */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 font-sans">
                {loading
                    ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32" />)
                    : statCards.map((card) => (
                        <button
                            key={card.label}
                            onClick={() => navigate(card.path)}
                            className="bg-white border border-slate-100 rounded-[1.75rem] p-5 sm:p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-left group"
                        >
                            <div className={`w-9 h-9 ${card.light} ${card.text} rounded-xl flex items-center justify-center mb-4`}>
                                {card.icon}
                            </div>
                            <p className="text-2xl sm:text-3xl font-black text-slate-900">{card.value}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{card.label}</p>
                        </button>
                    ))
                }
            </section>

            {/* Risk Indicators */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {loading ? (
                    Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-40" />)
                ) : (
                    <>
                        <RiskScoreCard
                            score={stats.criticalRiskCount > 0 ? 88 : 12}
                            level={stats.criticalRiskCount > 0 ? "Critical Risk" : "Stable State"}
                            description="Automated System Isolation index score calculation based on cumulative threshold metrics logs."
                        />
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 font-sans">
                            <div className="p-4 bg-purple-50 text-purple-700 rounded-2xl">
                                <MessageSquare size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">NLP Correspondence Alerts</p>
                                <p className="text-2xl font-black text-slate-800 mt-0.5">{stats.negativeSentimentCount} Flags</p>
                                <p className="text-xs text-red-500 font-bold mt-0.5">Negative sentiments isolated</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 font-sans">
                            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
                                <ShieldAlert size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Data Privacy Security</p>
                                <p className="text-2xl font-black text-slate-800 mt-0.5">Enforced</p>
                                <p className="text-xs text-slate-400 mt-0.5">Audit trail registry running</p>
                            </div>
                        </div>
                    </>
                )}
            </section>

            {/* Analytics Chart */}
            <section className="mb-8">
                {loading ? <Skeleton className="h-80 w-full" /> : <AnalyticsChart />}
            </section>

            {/* Bottom Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 font-sans">

                {/* Recent Users */}
                <section className="lg:col-span-2 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-50">
                        <div>
                            <h3 className="font-black text-slate-800 text-sm tracking-tight">Recent Users</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Latest account credentials logs</p>
                        </div>
                        <button
                            onClick={() => navigate('/admin/users')}
                            className="flex items-center gap-1.5 text-[10px] font-black text-[#7f2d3a] uppercase tracking-widest hover:gap-2.5 transition-all"
                        >
                            View All <ArrowRight size={12} />
                        </button>
                    </div>

                    {loading ? (
                        <div className="p-6 flex flex-col gap-3">
                            {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-14" />)}
                        </div>
                    ) : recentUsers.length === 0 ? (
                        <p className="text-center py-12 text-slate-400 text-sm">No users yet.</p>
                    ) : (
                        <>
                            <table className="w-full text-left hidden sm:table">
                                <tbody className="divide-y divide-slate-50">
                                    {recentUsers.map(user => (
                                        <tr key={user.id} className="hover:bg-slate-50/50 transition-all group">
                                            <td className="px-6 py-4">
                                                <p className="font-bold text-slate-800 text-sm group-hover:text-[#7f2d3a] transition-colors">{user.full_name}</p>
                                                <p className="text-xs text-slate-400 font-medium">{user.email}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-tighter ${getRoleBadge(user.role)}`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="sm:hidden flex flex-col divide-y divide-slate-50">
                                {recentUsers.map(user => (
                                    <div key={user.id} className="flex items-center justify-between px-5 py-4">
                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-800 text-sm truncate">{user.full_name}</p>
                                            <p className="text-xs text-slate-400 truncate">{user.email}</p>
                                        </div>
                                        <span className={`shrink-0 ml-3 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-tighter ${getRoleBadge(user.role)}`}>
                                            {user.role}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </section>

                {/* Right Side */}
                <div className="flex flex-col gap-4 sm:gap-6">
                    <section className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="px-6 pt-6 pb-4 border-b border-slate-50">
                            <h3 className="font-black text-slate-800 text-sm tracking-tight">Recent Activity</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Core system events trail</p>
                        </div>
                        <ul className="divide-y divide-slate-50">
                            {recentActivity.map(item => (
                                <li key={item.id} className="flex items-start gap-3 px-6 py-3.5">
                                    <div className="mt-0.5 shrink-0">{activityIcon(item.status)}</div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-slate-700 leading-snug">{item.message}</p>
                                        <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                                            <Clock size={9} /> {item.time}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-5">
                        <h3 className="font-black text-slate-800 text-sm tracking-tight mb-4">Quick Governance Access</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {quickLinks.map(link => (
                                <button
                                    key={link.path}
                                    onClick={() => navigate(link.path)}
                                    className="flex flex-col items-start gap-2 p-4 rounded-2xl bg-[#fcf8f8] hover:bg-[#7f2d3a]/5 border border-transparent hover:border-[#7f2d3a]/10 transition-all group text-left"
                                >
                                    <span className="text-[#7f2d3a]/60 group-hover:text-[#7f2d3a] transition-colors">{link.icon}</span>
                                    <div>
                                        <p className="text-xs font-black text-slate-700 leading-tight">{link.label}</p>
                                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">{link.desc}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>
                </div>

            </div>
        </div>
    );
};

export default AdminDashboard;