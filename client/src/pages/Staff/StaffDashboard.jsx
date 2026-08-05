import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, CalendarCheck, Users, TrendingUp,
  Megaphone, Calendar, MapPin, Clock, Zap,
  ChevronRight, CheckCircle, XCircle, AlertTriangle,
  FileSpreadsheet, AlertCircle, Info, BarChart3, PieChart
} from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────────────

const API = 'http://localhost:5000/api';
const MAROON = '#7f2d3a';
const MAROON_LIGHT = '#fcf8f8';
const token = () => localStorage.getItem('token');
const authHeaders = () => ({ headers: { Authorization: `Bearer ${token()}` } });

const PRIORITY_CFG = {
  critical:  { bg: '#fee2e2', text: '#991b1b', icon: <AlertCircle size={12} /> },
  important: { bg: '#fef3c7', text: '#92400e', icon: <AlertTriangle size={12} /> },
  info:      { bg: '#dbeafe', text: '#1e40af', icon: <Info size={12} /> },
};

const STATUS_CFG = {
  present: { label: 'Present', icon: <CheckCircle size={11} />, cls: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  absent:  { label: 'Absent',  icon: <XCircle size={11} />,     cls: 'bg-red-50 text-red-500 border-red-100' },
  excused: { label: 'Excused', icon: <AlertTriangle size={11} />, cls: 'bg-amber-50 text-amber-600 border-amber-100' },
};

const DUTY_STATUS_COLORS = {
  upcoming:  '#3b82f6',
  ongoing:   '#16a34a',
  completed: '#94a3b8',
  cancelled: '#ef4444',
};

function SkeletonBox({ h = 'h-4', w = 'w-full', rounded = 'rounded' }) {
  return <div className={`${h} ${w} ${rounded} bg-gray-100 animate-pulse`} />;
}

// ─── StatisticsCards ───────────────────────────────────────────────────────

function StatisticsCards({ loading, totalDuties, upcoming, ongoing, totalGroups, attendanceRate, announcements }) {
  const cards = [
    { label: 'Total Duties',     value: totalDuties,   icon: <ClipboardList size={18} />, color: '#3b82f6', bg: '#eff6ff' },
    { label: 'Upcoming',         value: upcoming,      icon: <Calendar size={18} />,       color: '#d97706', bg: '#fffbeb' },
    { label: 'Ongoing',          value: ongoing,       icon: <CalendarCheck size={18} />,  color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Scholar Groups',   value: totalGroups,   icon: <Users size={18} />,          color: MAROON,    bg: MAROON_LIGHT },
    { label: 'Attendance Rate',  value: `${attendanceRate}%`, icon: <TrendingUp size={18} />, color: '#8b5cf6', bg: '#f5f3ff' },
    { label: 'Announcements',    value: announcements, icon: <Megaphone size={18} />,      color: '#0ea5e9', bg: '#f0f9ff' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      {cards.map((card) => (
        <div key={card.label}
          className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
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

// ─── WeeklyAttendanceChart (pure CSS bar chart, no extra deps) ─────────────

function WeeklyAttendanceChart({ loading, records }) {
  // Build last 7 days buckets
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const buckets = days.map((d) => {
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const dayRecords = records.filter(r => {
      const rd = new Date(r.marked_at || r.date);
      return rd >= d && rd < next;
    });
    return {
      date: d,
      present: dayRecords.filter(r => r.status === 'present').length,
      absent: dayRecords.filter(r => r.status === 'absent').length,
      excused: dayRecords.filter(r => r.status === 'excused').length,
    };
  });

  const maxVal = Math.max(1, ...buckets.map(b => b.present + b.absent + b.excused));

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} style={{ color: MAROON }} />
          <h2 className="text-sm font-black text-gray-700 uppercase tracking-wide">Weekly Attendance Trend</h2>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Present</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Absent</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Excused</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-end gap-3 h-44">
          {Array(7).fill(0).map((_, i) => (
            <SkeletonBox key={i} h="h-full" w="w-full" rounded="rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="flex items-end justify-between gap-3 h-44">
          {buckets.map((b, i) => {
            const total = b.present + b.absent + b.excused;
            const heightPct = (total / maxVal) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group">
                <div className="w-full flex flex-col-reverse rounded-t-lg overflow-hidden transition-all"
                  style={{ height: `${Math.max(heightPct, total > 0 ? 4 : 0)}%`, minHeight: total > 0 ? 6 : 0 }}
                  title={`${b.present} present, ${b.absent} absent, ${b.excused} excused`}>
                  {b.excused > 0 && <div className="w-full bg-amber-400" style={{ flex: b.excused }} />}
                  {b.absent > 0 && <div className="w-full bg-red-400" style={{ flex: b.absent }} />}
                  {b.present > 0 && <div className="w-full bg-emerald-500" style={{ flex: b.present }} />}
                </div>
                {total === 0 && <div className="w-full h-1 bg-gray-100 rounded-full" />}
                <p className="text-[10px] text-gray-400 font-bold mt-2">
                  {b.date.toLocaleDateString('en-PH', { weekday: 'short' })}
                </p>
                <p className="text-[9px] text-gray-300">{b.date.getDate()}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── DutyStatusDonut (pure SVG donut chart, no extra deps) ─────────────────

function DutyStatusDonut({ loading, duties }) {
  const counts = {
    upcoming:  duties.filter(d => d.status === 'upcoming').length,
    ongoing:   duties.filter(d => d.status === 'ongoing').length,
    completed: duties.filter(d => d.status === 'completed').length,
    cancelled: duties.filter(d => d.status === 'cancelled').length,
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  let offsetAcc = 0;

  const segments = Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => {
      const pct = total > 0 ? value / total : 0;
      const dash = pct * circumference;
      const seg = {
        key,
        color: DUTY_STATUS_COLORS[key],
        dash,
        gap: circumference - dash,
        offset: -offsetAcc,
        value,
        pct: Math.round(pct * 100),
      };
      offsetAcc += dash;
      return seg;
    });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <PieChart size={16} style={{ color: MAROON }} />
        <h2 className="text-sm font-black text-gray-700 uppercase tracking-wide">Duty Status Breakdown</h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <div className="w-28 h-28 rounded-full bg-gray-100 animate-pulse" />
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <ClipboardList size={28} className="text-gray-200 mb-2" />
          <p className="text-xs text-gray-400 font-semibold">No duties yet</p>
        </div>
      ) : (
        <div className="flex items-center gap-6">
          <svg width="112" height="112" viewBox="0 0 112 112" className="shrink-0 -rotate-90">
            <circle cx="56" cy="56" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="14" />
            {segments.map((s) => (
              <circle
                key={s.key}
                cx="56" cy="56" r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth="14"
                strokeDasharray={`${s.dash} ${s.gap}`}
                strokeDashoffset={s.offset}
                strokeLinecap="butt"
                style={{ transition: 'stroke-dasharray 0.6s ease' }}
              />
            ))}
            <text x="56" y="56" textAnchor="middle" dominantBaseline="middle"
              className="rotate-90" style={{ transform: 'rotate(90deg)', transformOrigin: '56px 56px' }}>
            </text>
          </svg>
          <div className="flex-1 space-y-2">
            {Object.entries(counts).filter(([, v]) => v > 0).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: DUTY_STATUS_COLORS[key] }} />
                  <span className="font-bold text-gray-600 capitalize">{key}</span>
                </div>
                <span className="font-black text-gray-800">{value}</span>
              </div>
            ))}
            <div className="pt-2 mt-2 border-t border-gray-50 flex items-center justify-between text-xs">
              <span className="font-bold text-gray-400">Total</span>
              <span className="font-black" style={{ color: MAROON }}>{total}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── UpcomingDuties ─────────────────────────────────────────────────────────

function UpcomingDuties({ loading, duties, navigate }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar size={16} style={{ color: MAROON }} />
          <h2 className="text-sm font-black text-gray-700 uppercase tracking-wide">Upcoming Duties</h2>
        </div>
        <button onClick={() => navigate('/staff/task-assignment')}
          className="text-[10px] font-black uppercase tracking-widest hover:opacity-70 transition-opacity"
          style={{ color: MAROON }}>
          View All
        </button>
      </div>
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <SkeletonBox key={i} h="h-14" rounded="rounded-xl" />)}</div>
      ) : duties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Calendar size={28} className="text-gray-200 mb-2" />
          <p className="text-xs text-gray-400 font-semibold">No upcoming duties</p>
        </div>
      ) : (
        <div className="space-y-2">
          {duties.slice(0, 5).map((d) => (
            <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-[#fcf8f8] transition-colors">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: MAROON_LIGHT, color: MAROON }}>
                <ClipboardList size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-gray-700 truncate">{d.title}</p>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-gray-400">
                    {new Date(d.duty_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                  </span>
                  {d.time_start && (
                    <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                      <Clock size={9} /> {d.time_start}
                    </span>
                  )}
                  {d.location && (
                    <span className="flex items-center gap-0.5 text-[10px] text-gray-400 truncate">
                      <MapPin size={9} /> {d.location}
                    </span>
                  )}
                </div>
              </div>
              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg shrink-0 ${
                d.status === 'ongoing' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
              }`}>
                {d.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── RecentAttendance ───────────────────────────────────────────────────────

function RecentAttendance({ loading, records, navigate }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarCheck size={16} style={{ color: MAROON }} />
          <h2 className="text-sm font-black text-gray-700 uppercase tracking-wide">Recent Attendance</h2>
        </div>
        <button onClick={() => navigate('/staff/attendance-reports')}
          className="text-[10px] font-black uppercase tracking-widest hover:opacity-70 transition-opacity"
          style={{ color: MAROON }}>
          Full Report
        </button>
      </div>
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <SkeletonBox key={i} h="h-12" rounded="rounded-xl" />)}</div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <FileSpreadsheet size={28} className="text-gray-200 mb-2" />
          <p className="text-xs text-gray-400 font-semibold">No attendance records yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.slice(0, 5).map((r, i) => {
            const badge = STATUS_CFG[r.status] || STATUS_CFG.absent;
            return (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-[#fcf8f8] transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-black shrink-0"
                    style={{ background: `linear-gradient(135deg, ${MAROON}bb, #a63d4d)` }}>
                    {r.scholar?.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-700 truncate">{r.scholar}</p>
                    <p className="text-[10px] text-gray-400 truncate">{r.duty}</p>
                  </div>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide border ${badge.cls}`}>
                  {badge.icon} {badge.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── RecentAnnouncements ────────────────────────────────────────────────────

function RecentAnnouncements({ loading, announcements, navigate }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Megaphone size={16} style={{ color: MAROON }} />
          <h2 className="text-sm font-black text-gray-700 uppercase tracking-wide">Recent Announcements</h2>
        </div>
        <button onClick={() => navigate('/staff/announcements')}
          className="text-[10px] font-black uppercase tracking-widest hover:opacity-70 transition-opacity"
          style={{ color: MAROON }}>
          View All
        </button>
      </div>
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <SkeletonBox key={i} h="h-14" rounded="rounded-xl" />)}</div>
      ) : announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Megaphone size={28} className="text-gray-200 mb-2" />
          <p className="text-xs text-gray-400 font-semibold">No announcements yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {announcements.slice(0, 5).map((a) => {
            const cfg = PRIORITY_CFG[a.priority] || PRIORITY_CFG.info;
            return (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 hover:bg-[#fcf8f8] transition-colors">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: cfg.bg, color: cfg.text }}>
                  {cfg.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-700 truncate">{a.title}</p>
                  <p className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">{a.content}</p>
                  <p className="text-[9px] text-gray-300 mt-1">
                    {new Date(a.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} • {a.created_by}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── QuickActions ──────────────────────────────────────────────────────────

function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    { label: 'Task Assignment', icon: <ClipboardList size={18} />, path: '/staff/duty-assignment', color: '#3b82f6', bg: '#eff6ff' },
    { label: 'Duty Attendance', icon: <CalendarCheck size={18} />, path: '/staff/duty-attendance', color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Attendance Reports', icon: <FileSpreadsheet size={18} />, path: '/staff/attendance-reports', color: MAROON, bg: MAROON_LIGHT },
    { label: 'Announcements', icon: <Megaphone size={18} />, path: '/staff/announcements', color: '#0ea5e9', bg: '#f0f9ff' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Zap size={16} style={{ color: MAROON }} />
        <h2 className="text-sm font-black text-gray-700 uppercase tracking-wide">Quick Actions</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

// ─── Main StaffDashboard ───────────────────────────────────────────────────

const StaffDashboard = () => {
  const name = localStorage.getItem('name');
  const navigate = useNavigate();

  const [duties, setDuties] = useState([]);
  const [groups, setGroups] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dutiesRes, groupsRes, attendanceRes, announcementsRes] =
          await Promise.allSettled([
            axios.get(`${API}/duties`, authHeaders()),
            axios.get(`${API}/staff/groups`, authHeaders()),
            axios.get(`${API}/staff/reports/duty-attendance`),
            axios.get(`${API}/staff/announcements`),
          ]);

        if (dutiesRes.status === 'fulfilled') setDuties(dutiesRes.value.data);
        if (groupsRes.status === 'fulfilled') setGroups(groupsRes.value.data);
        if (attendanceRes.status === 'fulfilled') setAttendanceRecords(attendanceRes.value.data);
        if (announcementsRes.status === 'fulfilled') setAnnouncements(announcementsRes.value.data);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const upcoming = duties.filter(d => d.status === 'upcoming').length;
  const ongoing = duties.filter(d => d.status === 'ongoing').length;

  const upcomingDutiesSorted = [...duties]
    .filter(d => d.status === 'upcoming' || d.status === 'ongoing')
    .sort((a, b) => new Date(a.duty_date) - new Date(b.duty_date));

  const recentAttendanceSorted = [...attendanceRecords]
    .sort((a, b) => new Date(b.marked_at || b.date) - new Date(a.marked_at || a.date));

  const recentAnnouncementsSorted = [...announcements]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
  const attendanceRate = attendanceRecords.length > 0
    ? Math.round((presentCount / attendanceRecords.length) * 100)
    : 0;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="min-h-screen bg-slate-50/40 p-4 sm:p-6 lg:p-10 font-sans">

      {/* Header */}
      <div className="mb-7 bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex items-center justify-between flex-wrap gap-4"
        style={{ background: `linear-gradient(135deg, #ffffff 0%, ${MAROON_LIGHT} 100%)` }}>
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            {new Date().toLocaleDateString('en-PH', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-800 mt-1 tracking-tight">
            {getGreeting()}, <span style={{ color: MAROON }}>{name || 'Staff'}</span> 👋
          </h1>
          <p className="text-xs text-gray-400 mt-1">Here's what's happening across the scholar program today.</p>
        </div>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
          style={{ background: MAROON }}>
          <Zap size={24} className="text-white" />
        </div>
      </div>

      {/* Row 1: Statistics */}
      <StatisticsCards
        loading={loading}
        totalDuties={duties.length}
        upcoming={upcoming}
        ongoing={ongoing}
        totalGroups={groups.length}
        attendanceRate={attendanceRate}
        announcements={announcements.length}
      />

      {/* Row 2: Analytics — Weekly Trend + Duty Status Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <WeeklyAttendanceChart loading={loading} records={attendanceRecords} />
        </div>
        <DutyStatusDonut loading={loading} duties={duties} />
      </div>

      {/* Row 3: Upcoming Duties + Recent Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <UpcomingDuties loading={loading} duties={upcomingDutiesSorted} navigate={navigate} />
        <RecentAttendance loading={loading} records={recentAttendanceSorted} navigate={navigate} />
      </div>

      {/* Row 4: Announcements */}
      <div className="grid grid-cols-1 gap-6 mb-6">
        <RecentAnnouncements loading={loading} announcements={recentAnnouncementsSorted} navigate={navigate} />
      </div>

      {/* Row 5: Quick Actions */}
      <QuickActions />

    </div>
  );
};

export default StaffDashboard;