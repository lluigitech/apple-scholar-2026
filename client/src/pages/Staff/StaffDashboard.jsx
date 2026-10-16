import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, CalendarCheck, Users, TrendingUp,
  Megaphone, Calendar, MapPin, Clock, Zap,
  ChevronRight, CheckCircle, XCircle, AlertTriangle,
  FileSpreadsheet, AlertCircle, Info, BarChart3, PieChart
} from 'lucide-react';

// ── Design tokens — shared Records Office brand system ──
// This page's flavor: "The Desk Blotter" — a registrar's desk pad that
// gathers the day's numbers at a glance. Distinct from Time-Card Ledger
// (filing), Corkboard & Pin (notices) and Duty Docket (scheduling).
const MAROON = '#6D2140';
const MAROON_DEEP = '#4A1730';
const GOLD = '#A9784E';
const GOLD_LIGHT = '#C9A47A';
const BG = '#F3EEE6';
const CARD = '#FFFDF9';
const RULE = '#E7D8C7';
const INK = '#241512';
const MUTED = '#8A7A68';
const SAGE = '#6b8f71';
const CLAY = '#c1666b';
const SLATE = '#5c7487';
const GRAPHITE = '#6b625c';

const API = 'http://localhost:5000/api';
const token = () => localStorage.getItem('token');
const authHeaders = () => ({ headers: { Authorization: `Bearer ${token()}` } });

const display = { fontFamily: "'Lora', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Work Sans', 'Segoe UI', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace" };

// Faint graph-paper grid — this theme's signature chart surface.
const graphPaper = {
  backgroundImage: `linear-gradient(${RULE}99 1px, transparent 1px), linear-gradient(90deg, ${RULE}99 1px, transparent 1px)`,
  backgroundSize: '18px 18px',
};

const cardBase = { background: CARD, border: `1px solid ${RULE}`, borderRadius: 4, boxShadow: '0 6px 16px -12px rgba(36,21,18,0.25)' };

const PRIORITY_CFG = {
  critical:  { color: CLAY,  icon: <AlertCircle size={12} /> },
  important: { color: GOLD,  icon: <AlertTriangle size={12} /> },
  info:      { color: SLATE, icon: <Info size={12} /> },
};

const STATUS_CFG = {
  present: { label: 'Present', icon: <CheckCircle size={11} />, color: SAGE },
  absent:  { label: 'Absent',  icon: <XCircle size={11} />,     color: CLAY },
  excused: { label: 'Excused', icon: <AlertTriangle size={11} />, color: GOLD },
};

const DUTY_STATUS_COLORS = {
  upcoming:  SLATE,
  ongoing:   SAGE,
  completed: GRAPHITE,
  cancelled: CLAY,
};

function SkeletonBox({ h = 'h-4', w = 'w-full', rounded = 'rounded' }) {
  return <div className={`${h} ${w} ${rounded} animate-pulse`} style={{ background: `${RULE}99` }} />;
}

function SectionHeading({ icon, children }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color: MAROON }}>{icon}</span>
      <h2 style={{ ...mono, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.07em', color: '#5c4a3f' }}>
        {children}
      </h2>
    </div>
  );
}

// ─── StatisticsCards — index cards, each with a colored top edge ──────────

function StatisticsCards({ loading, totalDuties, upcoming, ongoing, totalGroups, attendanceRate, announcements }) {
  const cards = [
    { label: 'Total Duties',    value: totalDuties,           icon: <ClipboardList size={16} />, color: MAROON },
    { label: 'Upcoming',        value: upcoming,               icon: <Calendar size={16} />,      color: SLATE  },
    { label: 'Ongoing',         value: ongoing,                icon: <CalendarCheck size={16} />, color: SAGE   },
    { label: 'Scholar Groups',  value: totalGroups,            icon: <Users size={16} />,          color: GOLD   },
    { label: 'Attendance Rate', value: `${attendanceRate}%`,   icon: <TrendingUp size={16} />,     color: MAROON_DEEP },
    { label: 'Announcements',   value: announcements,          icon: <Megaphone size={16} />,      color: GRAPHITE },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      {cards.map((card) => (
        <div key={card.label} className="relative overflow-hidden"
          style={{ ...cardBase, padding: '16px 16px 14px' }}>
          <span aria-hidden="true" className="absolute top-0 left-0 right-0" style={{ height: 3, background: card.color }} />
          <div className="flex items-center justify-between mb-3">
            <span style={{ color: card.color }}>{card.icon}</span>
          </div>
          {loading
            ? <><SkeletonBox h="h-6" w="w-14" rounded="rounded" /><SkeletonBox h="h-2.5" w="w-20" rounded="rounded mt-2" /></>
            : <>
              <p style={{ ...display, fontSize: '1.5rem', fontWeight: 700, color: card.color, lineHeight: 1.1 }}>{card.value}</p>
              <p style={{ ...mono, fontSize: '0.64rem', color: MUTED, marginTop: 4, letterSpacing: '0.04em' }}>{card.label.toUpperCase()}</p>
            </>
          }
        </div>
      ))}
    </div>
  );
}

// ─── WeeklyAttendanceChart (pure CSS bar chart, on graph paper) ────────────

function WeeklyAttendanceChart({ loading, records }) {
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
    <div style={{ ...cardBase, padding: 20 }}>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <SectionHeading icon={<BarChart3 size={15} />}>Weekly Attendance Trend</SectionHeading>
        <div className="flex items-center gap-3" style={{ ...mono, fontSize: '0.62rem', color: MUTED }}>
          <span className="flex items-center gap-1"><span style={{ width: 7, height: 7, borderRadius: '50%', background: SAGE, display: 'inline-block' }} /> Present</span>
          <span className="flex items-center gap-1"><span style={{ width: 7, height: 7, borderRadius: '50%', background: CLAY, display: 'inline-block' }} /> Absent</span>
          <span className="flex items-center gap-1"><span style={{ width: 7, height: 7, borderRadius: '50%', background: GOLD, display: 'inline-block' }} /> Excused</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-end gap-3 h-44">
          {Array(7).fill(0).map((_, i) => (
            <SkeletonBox key={i} h="h-full" w="w-full" rounded="rounded" />
          ))}
        </div>
      ) : (
        <div className="flex items-end justify-between gap-3 h-44" style={{ ...graphPaper, borderRadius: 4, padding: '10px 8px 0' }}>
          {buckets.map((b, i) => {
            const total = b.present + b.absent + b.excused;
            const heightPct = (total / maxVal) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center h-full justify-end">
                <div className="w-full flex flex-col-reverse overflow-hidden transition-all"
                  style={{ height: `${Math.max(heightPct, total > 0 ? 4 : 0)}%`, minHeight: total > 0 ? 6 : 0, borderRadius: '3px 3px 0 0' }}
                  title={`${b.present} present, ${b.absent} absent, ${b.excused} excused`}>
                  {b.excused > 0 && <div className="w-full" style={{ flex: b.excused, background: GOLD }} />}
                  {b.absent > 0 && <div className="w-full" style={{ flex: b.absent, background: CLAY }} />}
                  {b.present > 0 && <div className="w-full" style={{ flex: b.present, background: SAGE }} />}
                </div>
                {total === 0 && <div className="w-full" style={{ height: 3, background: RULE, borderRadius: 2 }} />}
                <p style={{ ...mono, fontSize: '0.64rem', color: MUTED, marginTop: 8, fontWeight: 700 }}>
                  {b.date.toLocaleDateString('en-PH', { weekday: 'short' })}
                </p>
                <p style={{ ...mono, fontSize: '0.6rem', color: '#c6b8ae' }}>{b.date.getDate()}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── DutyStatusDonut (pure SVG donut chart, on graph paper) ────────────────

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
    <div style={{ ...cardBase, padding: 20 }}>
      <div className="mb-5">
        <SectionHeading icon={<PieChart size={15} />}>Duty Status Breakdown</SectionHeading>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <div className="w-28 h-28 rounded-full animate-pulse" style={{ background: `${RULE}99` }} />
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <ClipboardList size={26} style={{ color: RULE, marginBottom: 8 }} />
          <p style={{ ...body, fontSize: '0.78rem', color: MUTED, fontWeight: 600 }}>No duties yet</p>
        </div>
      ) : (
        <div className="flex items-center gap-6" style={{ ...graphPaper, borderRadius: 4, padding: '10px 12px' }}>
          <svg width="112" height="112" viewBox="0 0 112 112" className="shrink-0 -rotate-90">
            <circle cx="56" cy="56" r={radius} fill="none" stroke={CARD} strokeWidth="14" />
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
          </svg>
          <div className="flex-1 space-y-2">
            {Object.entries(counts).filter(([, v]) => v > 0).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between" style={{ fontSize: '0.78rem' }}>
                <div className="flex items-center gap-2">
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: DUTY_STATUS_COLORS[key], display: 'inline-block' }} />
                  <span style={{ ...body, fontWeight: 600, color: '#5c4a3f', textTransform: 'capitalize' }}>{key}</span>
                </div>
                <span style={{ ...display, fontWeight: 700, color: INK }}>{value}</span>
              </div>
            ))}
            <div className="flex items-center justify-between" style={{ paddingTop: 8, marginTop: 6, borderTop: `1px solid ${RULE}`, fontSize: '0.78rem' }}>
              <span style={{ ...body, fontWeight: 600, color: MUTED }}>Total</span>
              <span style={{ ...display, fontWeight: 700, color: MAROON }}>{total}</span>
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
    <div style={{ ...cardBase, padding: 20 }}>
      <div className="flex items-center justify-between mb-4">
        <SectionHeading icon={<Calendar size={15} />}>Upcoming Duties</SectionHeading>
        <button onClick={() => navigate('/staff/task-assignment')}
          className="hover:opacity-70 transition-opacity"
          style={{ ...mono, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.05em', color: MAROON, background: 'none', border: 'none', cursor: 'pointer' }}>
          VIEW ALL
        </button>
      </div>
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <SkeletonBox key={i} h="h-14" rounded="rounded" />)}</div>
      ) : duties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Calendar size={26} style={{ color: RULE, marginBottom: 8 }} />
          <p style={{ ...body, fontSize: '0.78rem', color: MUTED, fontWeight: 600 }}>No upcoming duties</p>
        </div>
      ) : (
        <div className="space-y-2">
          {duties.slice(0, 5).map((d) => {
            const color = DUTY_STATUS_COLORS[d.status] || SLATE;
            return (
              <div key={d.id} className="flex items-center gap-3 transition-colors"
                style={{ padding: '10px 12px', borderRadius: 3, background: BG, borderLeft: `3px solid ${color}` }}>
                <div className="w-8 h-8 flex items-center justify-center shrink-0"
                  style={{ borderRadius: 3, background: `${MAROON}12`, color: MAROON }}>
                  <ClipboardList size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p style={{ ...body, fontSize: '0.8rem', fontWeight: 700, color: '#3f2f28' }} className="truncate">{d.title}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span style={{ ...mono, fontSize: '0.66rem', color: MUTED }}>
                      {new Date(d.duty_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                    </span>
                    {d.time_start && (
                      <span className="flex items-center gap-0.5" style={{ ...mono, fontSize: '0.66rem', color: MUTED }}>
                        <Clock size={9} /> {d.time_start}
                      </span>
                    )}
                    {d.location && (
                      <span className="flex items-center gap-0.5 truncate" style={{ ...mono, fontSize: '0.66rem', color: MUTED }}>
                        <MapPin size={9} /> {d.location}
                      </span>
                    )}
                  </div>
                </div>
                <span className="shrink-0" style={{ ...mono, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.04em', color, textTransform: 'uppercase' }}>
                  {d.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── RecentAttendance ───────────────────────────────────────────────────────

function RecentAttendance({ loading, records, navigate }) {
  return (
    <div style={{ ...cardBase, padding: 20 }}>
      <div className="flex items-center justify-between mb-4">
        <SectionHeading icon={<CalendarCheck size={15} />}>Recent Attendance</SectionHeading>
        <button onClick={() => navigate('/staff/attendance-reports')}
          className="hover:opacity-70 transition-opacity"
          style={{ ...mono, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.05em', color: MAROON, background: 'none', border: 'none', cursor: 'pointer' }}>
          FULL REPORT
        </button>
      </div>
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <SkeletonBox key={i} h="h-12" rounded="rounded" />)}</div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <FileSpreadsheet size={26} style={{ color: RULE, marginBottom: 8 }} />
          <p style={{ ...body, fontSize: '0.78rem', color: MUTED, fontWeight: 600 }}>No attendance records yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.slice(0, 5).map((r, i) => {
            const badge = STATUS_CFG[r.status] || STATUS_CFG.absent;
            return (
              <div key={i} className="flex items-center justify-between" style={{ padding: '10px 12px', borderRadius: 3, background: BG }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 flex items-center justify-center text-white shrink-0"
                    style={{ ...mono, fontSize: '0.68rem', fontWeight: 700, borderRadius: 3, background: `linear-gradient(135deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)` }}>
                    {r.scholar?.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p style={{ ...body, fontSize: '0.8rem', fontWeight: 700, color: '#3f2f28' }} className="truncate">{r.scholar}</p>
                    <p style={{ ...mono, fontSize: '0.66rem', color: MUTED }} className="truncate">{r.duty}</p>
                  </div>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1"
                  style={{ padding: '3px 9px', borderRadius: 3, border: `1px solid ${badge.color}55`, ...mono, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.03em', color: badge.color, textTransform: 'uppercase' }}>
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
    <div style={{ ...cardBase, padding: 20 }}>
      <div className="flex items-center justify-between mb-4">
        <SectionHeading icon={<Megaphone size={15} />}>Recent Announcements</SectionHeading>
        <button onClick={() => navigate('/staff/announcements')}
          className="hover:opacity-70 transition-opacity"
          style={{ ...mono, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.05em', color: MAROON, background: 'none', border: 'none', cursor: 'pointer' }}>
          VIEW ALL
        </button>
      </div>
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <SkeletonBox key={i} h="h-14" rounded="rounded" />)}</div>
      ) : announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Megaphone size={26} style={{ color: RULE, marginBottom: 8 }} />
          <p style={{ ...body, fontSize: '0.78rem', color: MUTED, fontWeight: 600 }}>No announcements yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {announcements.slice(0, 5).map((a) => {
            const cfg = PRIORITY_CFG[a.priority] || PRIORITY_CFG.info;
            return (
              <div key={a.id} className="flex items-start gap-3" style={{ padding: '10px 12px', borderRadius: 3, background: BG }}>
                <div className="w-8 h-8 flex items-center justify-center shrink-0" style={{ marginTop: 2, borderRadius: 3, background: `${cfg.color}14`, color: cfg.color }}>
                  {cfg.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p style={{ ...body, fontSize: '0.8rem', fontWeight: 700, color: '#3f2f28' }} className="truncate">{a.title}</p>
                  <p style={{ ...body, fontSize: '0.72rem', color: MUTED }} className="line-clamp-1 mt-0.5">{a.content}</p>
                  <p style={{ ...mono, fontSize: '0.62rem', color: '#c6b8ae', marginTop: 4 }}>
                    {new Date(a.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} · {a.created_by}
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

// ─── QuickActions — rolodex-style index tabs ───────────────────────────────

function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    { label: 'Task Assignment',     icon: <ClipboardList size={17} />,   path: '/staff/duty-assignment',      color: MAROON },
    { label: 'Duty Attendance',     icon: <CalendarCheck size={17} />,   path: '/staff/duty-attendance',      color: SAGE   },
    { label: 'Attendance Reports',  icon: <FileSpreadsheet size={17} />, path: '/staff/attendance-reports',   color: SLATE  },
    { label: 'Announcements',       icon: <Megaphone size={17} />,       path: '/staff/announcements',        color: GOLD   },
  ];

  return (
    <div style={{ ...cardBase, padding: 20 }}>
      <div className="mb-4">
        <SectionHeading icon={<Zap size={15} />}>Quick Actions</SectionHeading>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {actions.map((a) => (
          <button key={a.path} onClick={() => navigate(a.path)}
            className="relative flex flex-col items-center gap-2 transition-all group text-center hover:-translate-y-0.5"
            style={{
              padding: '18px 12px 14px', background: BG, border: `1px solid ${RULE}`, borderTop: 'none',
              clipPath: 'polygon(0 10px, 30% 10px, 38% 0, 62% 0, 70% 10px, 100% 10px, 100% 100%, 0 100%)',
              cursor: 'pointer',
            }}>
            <div className="w-9 h-9 flex items-center justify-center transition-transform group-hover:scale-110"
              style={{ borderRadius: 3, background: `${a.color}14`, color: a.color }}>
              {a.icon}
            </div>
            <span style={{ ...body, fontSize: '0.72rem', fontWeight: 700, color: '#3f2f28', lineHeight: 1.25 }}>{a.label}</span>
            <ChevronRight size={11} style={{ color: RULE }} className="group-hover:text-[#8A7A68] transition-colors" />
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
            axios.get(`${API}/staff/reports/duty-attendance`, authHeaders()),
            axios.get(`${API}/staff/announcements`, authHeaders()),
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

  const now = new Date();

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-10" style={{ ...body, background: BG }}>

      {/* Header — a desk calendar block beside the day's greeting */}
      <div className="mb-7 flex items-center gap-5 flex-wrap" style={{ ...cardBase, padding: 22 }}>
        <div className="flex flex-col items-center justify-center shrink-0" style={{ width: 68, background: MAROON, borderRadius: 3, padding: '10px 0 8px', boxShadow: '0 4px 10px rgba(36,21,18,0.25)' }}>
          <span style={{ ...mono, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', color: '#e9c9b8' }}>
            {now.toLocaleDateString('en-PH', { month: 'short' }).toUpperCase()}
          </span>
          <span style={{ ...display, fontSize: '1.7rem', fontWeight: 700, color: '#fff', lineHeight: 1.05 }}>
            {now.getDate()}
          </span>
          <span style={{ ...mono, fontSize: '0.56rem', color: '#e9c9b8', letterSpacing: '0.06em' }}>
            {now.toLocaleDateString('en-PH', { weekday: 'short' }).toUpperCase()}
          </span>
        </div>

        <div className="flex-1 min-w-[220px]">
          <p style={{ ...mono, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.06em', color: MUTED }}>
            {now.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()}
          </p>
          <h1 style={{ ...display, fontSize: '1.7rem', fontWeight: 600, color: INK, marginTop: 3, letterSpacing: '-0.01em' }}>
            {getGreeting()}, <span style={{ color: MAROON }}>{name || 'Staff'}</span>
          </h1>
          <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginTop: 3 }}>Here's what's happening across the scholar program today.</p>
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