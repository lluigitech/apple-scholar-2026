import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  Users, Clock, CheckCircle, XCircle, TrendingUp,
  AlertTriangle, Calendar, Activity, Zap,
  FileCheck, MessageCircle,
  ChevronRight, ShieldAlert, Mail, BarChart3, FileText
} from 'lucide-react';

const MAROON = '#7f2d3a';
const MAROON_LIGHT = '#fcf8f8';

function SkeletonBox({ h = 'h-4', w = 'w-full', rounded = 'rounded' }) {
  return <div className={`${h} ${w} ${rounded} bg-gray-100 animate-pulse`} />;
}

// ─── StatisticsCards ───────────────────────────────────────────────────────

function StatisticsCards({ loading, totalScholars, pending, approved, rejected, active, complianceRate }) {
  const cards = [
    { label: 'Total Scholars', value: totalScholars, icon: <Users size={18} />, color: '#3b82f6', bg: '#eff6ff' },
    { label: 'Pending Review', value: pending, icon: <Clock size={18} />, color: '#d97706', bg: '#fffbeb' },
    { label: 'Approved', value: approved, icon: <CheckCircle size={18} />, color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Rejected', value: rejected, icon: <XCircle size={18} />, color: '#ef4444', bg: '#fef2f2' },
    { label: 'Active Scholars', value: active, icon: <Users size={18} />, color: MAROON, bg: MAROON_LIGHT },
    { label: 'Compliance Rate', value: `${complianceRate}%`, icon: <TrendingUp size={18} />, color: '#8b5cf6', bg: '#f5f3ff' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      {cards.map((card) => (
        <div key={card.label}
          className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: card.bg, color: card.color }}>
              {card.icon}
            </div>
          </div>
          {loading
            ? <><SkeletonBox h="h-7" w="w-16" rounded="rounded-lg" /><SkeletonBox h="h-3" w="w-20" rounded="rounded mt-2" /></>
            : <>
              <p className="text-2xl font-black" style={{ color: card.color }}>{card.value}</p>
              <p className="text-[11px] text-gray-400 font-semibold mt-0.5 uppercase tracking-wide">{card.label}</p>
            </>
          }
        </div>
      ))}
    </div>
  );
}

// ─── ComplianceOverview ────────────────────────────────────────────────────

function ComplianceOverview({ loading, submitted, missing, late, total }) {
  const rate = total > 0 ? Math.round((submitted / total) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={16} style={{ color: MAROON }} />
        <h2 className="text-sm font-black text-gray-700 uppercase tracking-wide">Compliance Overview</h2>
      </div>
      {loading ? (
        <div className="space-y-3">
          <SkeletonBox h="h-4" /><SkeletonBox h="h-4" /><SkeletonBox h="h-4" />
        </div>
      ) : (
        <>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-500 font-semibold">Overall Compliance</span>
              <span className="text-xs font-black" style={{ color: MAROON }}>{rate}%</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${rate}%`, background: MAROON }} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Submitted', value: submitted, color: '#16a34a', bg: '#f0fdf4' },
              { label: 'Missing', value: missing, color: '#ef4444', bg: '#fef2f2' },
              { label: 'Late', value: late, color: '#d97706', bg: '#fffbeb' },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: s.bg }}>
                <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: s.color }}>{s.label}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── UpcomingDeadlines ─────────────────────────────────────────────────────

function UpcomingDeadlines({ loading, deadlines }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Calendar size={16} style={{ color: MAROON }} />
        <h2 className="text-sm font-black text-gray-700 uppercase tracking-wide">Upcoming Deadlines</h2>
      </div>
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <SkeletonBox key={i} h="h-12" rounded="rounded-xl" />)}
        </div>
      ) : deadlines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Calendar size={28} className="text-gray-200 mb-2" />
          <p className="text-xs text-gray-400 font-semibold">No upcoming deadlines</p>
        </div>
      ) : (
        <div className="space-y-2">
          {deadlines.slice(0, 5).map((d, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-[#fcf8f8] transition-colors">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: MAROON_LIGHT, color: MAROON }}>
                <Calendar size={14} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-700 truncate">{d.title || d.name}</p>
                <p className="text-[10px] text-gray-400">{d.date || d.due_date}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── FlaggedScholarCard ────────────────────────────────────────────────────

function FlaggedScholarCard({ loading, flagged }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle size={16} className="text-red-500" />
        <h2 className="text-sm font-black text-gray-700 uppercase tracking-wide">Flagged Scholars</h2>
        {!loading && flagged.length > 0 && (
          <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-black bg-red-50 text-red-500">
            {flagged.length}
          </span>
        )}
      </div>
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <SkeletonBox key={i} h="h-12" rounded="rounded-xl" />)}
        </div>
      ) : flagged.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CheckCircle size={28} className="text-green-200 mb-2" />
          <p className="text-xs text-gray-400 font-semibold">No flagged scholars</p>
        </div>
      ) : (
        <div className="space-y-2">
          {flagged.slice(0, 5).map((s, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-red-50 hover:bg-red-100/60 transition-colors">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-black text-red-500">
                  {(s.name || s.scholar_name || '?').split(' ').map(n => n[0]).slice(0,2).join('')}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-700 truncate">{s.name || s.scholar_name}</p>
                <p className="text-[10px] text-red-400 font-semibold">{s.reason || s.flag_reason || 'Compliance issue'}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── RecentActivities ─────────────────────────────────────────────────────

function RecentActivities({ loading, activities }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Activity size={16} style={{ color: MAROON }} />
        <h2 className="text-sm font-black text-gray-700 uppercase tracking-wide">Recent Activities</h2>
      </div>
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <SkeletonBox key={i} h="h-10" rounded="rounded-xl" />)}
        </div>
      ) : activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Activity size={28} className="text-gray-200 mb-2" />
          <p className="text-xs text-gray-400 font-semibold">No recent activities</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activities.slice(0, 6).map((a, i) => (
            <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
              <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: MAROON }} />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-700 leading-snug">{a.description || a.action}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{a.created_at || a.date}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── QuickActions ──────────────────────────────────────────────────────────

function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    { label: 'Manual Validation', icon: <FileCheck size={18} />, path: '/officer/validation', color: '#3b82f6', bg: '#eff6ff' },
    { label: 'Flagged Scholars', icon: <ShieldAlert size={18} />, path: '/officer/flagged', color: MAROON, bg: MAROON_LIGHT },
    { label: 'Correspondence', icon: <Mail size={18} />, path: '/officer/correspondence-review', color: '#d97706', bg: '#fffbeb' },
    { label: 'Reports', icon: <BarChart3 size={18} />, path: '/officer/reports', color: '#8b5cf6', bg: '#f5f3ff' },
    { label: 'Summary Report', icon: <FileText size={18} />, path: '/officer/summary-report', color: '#ef4444', bg: '#fef2f2' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Zap size={16} style={{ color: MAROON }} />
        <h2 className="text-sm font-black text-gray-700 uppercase tracking-wide">Quick Actions</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {actions.map((a) => (
          <button key={a.path} onClick={() => navigate(a.path)}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all group text-center">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
              style={{ background: a.bg, color: a.color }}>
              {a.icon}
            </div>
            <span className="text-[11px] font-bold text-gray-600 leading-tight">{a.label}</span>
            <ChevronRight size={12} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main OfficerDashboard ─────────────────────────────────────────────────

const authHeader = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

const OfficerDashboard = () => {
  const name = localStorage.getItem('name');

  const [submissions, setSubmissions] = useState([]);
  const [scholars, setScholars] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [activities, setActivities] = useState([]);
  const [flagged, setFlagged] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [subRes, scholarsRes, deadlinesRes, activitiesRes, flaggedRes] =
          await Promise.allSettled([
            axios.get('http://localhost:5000/api/submission/all', { headers: authHeader() }),
            axios.get('http://localhost:5000/api/staff/pending', { headers: authHeader() }),
            axios.get('http://localhost:5000/api/staff/deadlines', { headers: authHeader() }),
            axios.get('http://localhost:5000/api/staff/reports/activities', { headers: authHeader() }),
            axios.get('http://localhost:5000/api/flagged/scholars', { headers: authHeader() }),
          ]);

        if (subRes.status === 'fulfilled') setSubmissions(subRes.value.data);
        if (scholarsRes.status === 'fulfilled') setScholars(scholarsRes.value.data);
        if (deadlinesRes.status === 'fulfilled') setDeadlines(deadlinesRes.value.data);
        if (activitiesRes.status === 'fulfilled') setActivities(activitiesRes.value.data);
        if (flaggedRes.status === 'fulfilled') setFlagged(flaggedRes.value.data);
      } catch (err) {
        console.error('Error fetching officer dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const pending = submissions.filter(s => s.status === 'pending').length;
  const approved = submissions.filter(s => s.status === 'approved').length;
  const rejected = submissions.filter(s => s.status === 'rejected').length;
  const active = scholars.filter(s => s.status === 'active').length;
  const submitted = approved;
  const missing = Math.max(0, scholars.length - submitted);
  const late = submissions.filter(s => s.is_late).length;
  const complianceRate = scholars.length > 0 ? Math.round((submitted / scholars.length) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-10 font-sans">

      {/* Header */}
      <div className="mb-6">
        <p className="text-sm text-gray-400">
          {new Date().toLocaleDateString('en-PH', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })}
        </p>
        <h1 className="text-2xl font-bold text-gray-800">
          Welcome back, <span style={{ color: MAROON }}>{name || 'Officer'}</span> 👋
        </h1>
        <p className="text-xs text-gray-400 mt-1 font-medium uppercase tracking-widest">Officer Portal</p>
      </div>

      {/* Row 1: Statistics */}
      <StatisticsCards
        loading={loading}
        totalScholars={scholars.length}
        pending={pending}
        approved={approved}
        rejected={rejected}
        active={active}
        complianceRate={complianceRate}
      />

      {/* Row 2: Compliance + Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ComplianceOverview
          loading={loading}
          submitted={submitted}
          missing={missing}
          late={late}
          total={scholars.length}
        />
        <UpcomingDeadlines loading={loading} deadlines={deadlines} />
      </div>

      {/* Row 3: Flagged + Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <FlaggedScholarCard loading={loading} flagged={flagged} />
        <RecentActivities loading={loading} activities={activities} />
      </div>

      {/* Row 4: Quick Actions */}
      <QuickActions />

    </div>
  );
};

export default OfficerDashboard;