import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Bell, Clock, CheckCircle, XCircle, AlertCircle, AlertTriangle, Info,
  Calendar, CalendarDays, FileText, Upload, Megaphone,
  ClipboardCheck, Search, ChevronDown,
} from 'lucide-react';

/* ────────────────────────────────────────────────────────────────────────
   Endpoints — same ones already used by ScholarAnnouncements / Submission /
   DutyParticipation. This page only reads from them and re-shapes the data
   into cards; it does not own or duplicate their UI.
   ──────────────────────────────────────────────────────────────────────── */
const API = 'http://localhost:5000/api';
const SUBMISSION_API = `${API}/submission`;

// ── Token system — shared across the Scholar Portal ──
const MAROON = '#7f2d3a';
const MAROON_DEEP = '#4f1620';
const GOLD = '#b98b4e';
const IVORY = '#FBF7F2';
const INK = '#241512';

const token = () => localStorage.getItem('token');
const authHeaders = () => ({ headers: { Authorization: `Bearer ${token()}` } });
const scholarId = () => localStorage.getItem('scholar_id');
const yearLevel = () => localStorage.getItem('year_level') || '';

/* ── Card "look" config, keyed by type — recolored onto the shared palette ── */
const typeConfig = {
  task:      { icon: ClipboardCheck, dot: MAROON,    bg: '#F5E8EA', text: MAROON,     label: 'Task'            },
  deadline:  { icon: Clock,          dot: GOLD,       bg: '#F6EFE1', text: '#8a6a3a',  label: 'Deadline'        },
  reminder:  { icon: Bell,           dot: GOLD,       bg: '#F6EFE1', text: '#8a6a3a',  label: 'Reminder'        },
  approved:  { icon: CheckCircle,    dot: '#15803d',  bg: '#EAF3EC', text: '#15803d',  label: 'Approved'        },
  rejected:  { icon: XCircle,        dot: '#991b1b',  bg: '#FBE9E9', text: '#991b1b',  label: 'Returned'        },
  pending:   { icon: Clock,          dot: '#92400e',  bg: '#FBF0DE', text: '#92400e',  label: 'Pending Review'  },
  critical:  { icon: AlertCircle,    dot: '#991b1b',  bg: '#FBE9E9', text: '#991b1b',  label: 'Critical'        },
  important: { icon: AlertTriangle,  dot: '#92400e',  bg: '#FBF0DE', text: '#92400e',  label: 'Important'       },
  info:      { icon: Info,           dot: GOLD,       bg: '#F6EFE1', text: '#8a6a3a',  label: 'Info'            },
};

const sourceConfig = {
  task:         { icon: ClipboardCheck, label: 'To-Do'      },
  announcement: { icon: Megaphone,      label: 'Foundation' },
  duty:         { icon: CalendarDays,   label: 'Duty'       },
  submission:   { icon: FileText,       label: 'Submission' },
};

const SOURCE_TABS = [
  { key: 'all',          label: 'All' },
  { key: 'task',         label: 'To-Do' },
  { key: 'announcement', label: 'Foundation' },
  { key: 'duty',         label: 'Duty' },
  { key: 'submission',   label: 'Submission' },
];

const TYPE_FILTERS = ['all', 'task', 'deadline', 'reminder', 'approved', 'rejected', 'critical', 'important', 'info'];

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ────────────────────────────────────────────────────────────────────────
   Derive everything from real data: pending action items ("tasks") and
   read-only notifications, plus the upcoming-deadlines summary.
   Heuristic: monthly report assumed due end-of-month; adjust once the
   real requirement-period rule is confirmed on the backend.
   ──────────────────────────────────────────────────────────────────────── */
function buildFeed({ announcements, duties, history }) {
  const tasks = [];
  const notifications = [];
  const deadlines = [];
  const now = new Date();

  // Duties
  duties.forEach(d => {
    if (d.computed_status === 'pending') {
      const daysLeft = Math.ceil((new Date(d.duty_date) - now) / 86400000);
      notifications.push({
        id: `duty-${d.id}`,
        source: 'duty',
        type: 'reminder',
        title: `Duty Reminder: ${d.title}`,
        message: d.description || `Scheduled ${fmtDate(d.duty_date)}${d.location ? ` at ${d.location}` : ''}.`,
        date: d.duty_date,
      });
      deadlines.push({ task: d.title, daysLeft, urgent: daysLeft <= 7 });
    } else if (d.computed_status === 'missed') {
      notifications.push({
        id: `duty-missed-${d.id}`,
        source: 'duty',
        type: 'rejected',
        title: `Missed Duty: ${d.title}`,
        message: 'You did not check in for this duty and the makeup window has passed.',
        date: d.duty_date,
      });
    }
  });

  // Announcements
  announcements.forEach(a => {
    notifications.push({
      id: `ann-${a.id}`,
      source: 'announcement',
      type: a.priority === 'critical' ? 'critical' : a.priority === 'important' ? 'important' : 'info',
      title: a.title,
      message: a.content,
      date: a.created_at,
    });
  });

  // Submission history -> status notifications
  history.forEach(h => {
    const status = (h.quality_status || h.status || '').toLowerCase();
    const statusDate = h.reviewed_at || h.submitted_at || h.created_at;

    if (status === 'approved' || status === 'accepted') {
      notifications.push({
        id: `sub-${h.id}`, source: 'submission', type: 'approved',
        title: 'Submission Approved',
        message: h.remarks || 'Your submission was reviewed and approved by staff.',
        date: statusDate,
      });
    } else if (status === 'rejected' || status === 'returned') {
      notifications.push({
        id: `sub-${h.id}`, source: 'submission', type: 'rejected',
        title: 'Submission Needs Revision',
        message: h.remarks || 'Your submission was returned for revision. Check the details and resubmit.',
        date: statusDate,
      });
    } else if (status === 'pending' || !status) {
      notifications.push({
        id: `sub-${h.id}`, source: 'submission', type: 'pending',
        title: 'Submission Pending Review',
        message: h.remarks || 'Your submission has been sent and is awaiting review by staff.',
        date: statusDate,
      });
    }
  });

  // Submission requirements not yet filed this month
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const filedThisMonth = (type) => history.some(h => {
    const submissionType = h.type || h.submission_type || h.submissionType;
    const submittedAt = h.submitted_at || h.created_at || h.reviewed_at;
    if (!submissionType || !submittedAt) return false;
    const d = new Date(submittedAt);
    return submissionType === type && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });

  if (!filedThisMonth('monthly-report')) {
    const endOfMonth = new Date(thisYear, thisMonth + 1, 0);
    const daysLeft = Math.ceil((endOfMonth - now) / 86400000);
    tasks.push({
      id: 'task-monthly-report',
      source: 'submission',
      title: 'Monthly Report',
      description: 'Submit your monthly academic and community service letter.',
      icon: FileText,
      action: 'route',
      route: '/scholar/submission',
      actionLabel: 'Submit',
      urgent: daysLeft <= 7,
    });
    deadlines.push({ task: 'Monthly Report', daysLeft, urgent: daysLeft <= 7 });
  }

  if (!filedThisMonth('grades')) {
    tasks.push({
      id: 'task-grades',
      source: 'submission',
      title: 'Grades Submission',
      description: 'Submit your grades for the current semester.',
      icon: Upload,
      action: 'route',
      route: '/scholar/submission',
      actionLabel: 'Submit',
      urgent: false,
    });
  }

  notifications.sort((a, b) => new Date(b.date) - new Date(a.date));
  deadlines.sort((a, b) => a.daysLeft - b.daysLeft);
  tasks.sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0));

  return { tasks, notifications, deadlines };
}

/* ────────────────────────────────────────────────────────────────────────
   Main Component
   ──────────────────────────────────────────────────────────────────────── */
function ScholarNotification() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState([]);
  const [duties, setDuties] = useState([]);
  const [history, setHistory] = useState([]);

  const [readIds, setReadIds] = useState(new Set());
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const sid = scholarId();
      const results = await Promise.allSettled([
        axios.get(`${API}/scholar/announcements`, { params: yearLevel() ? { year_level: yearLevel() } : {} }),
        axios.get(`${API}/scholar/my-duties`, authHeaders()),
        sid ? axios.get(`${SUBMISSION_API}/history/${sid}`, authHeaders()) : Promise.resolve({ data: [] }),
      ]);
      setAnnouncements(results[0].status === 'fulfilled' ? results[0].value.data : []);
      setDuties(results[1].status === 'fulfilled' ? results[1].value.data : []);
      setHistory(results[2].status === 'fulfilled' ? results[2].value.data : []);
      setLoading(false);
    };

    fetchAll();
  }, []);

  const { tasks, notifications: rawNotifications, deadlines } = buildFeed({ announcements, duties, history });
  const notifications = rawNotifications.map(n => ({ ...n, read: readIds.has(n.id) }));
  const unread = notifications.filter(n => !n.read).length;

  const markAllRead = () => setReadIds(new Set(notifications.map(n => n.id)));
  const markRead = (id) => setReadIds(prev => new Set(prev).add(id));

  // Unified, filterable feed: tasks first, then notifications by recency
  const matchesSearch = (title, message = '') =>
    !search.trim() ||
    title.toLowerCase().includes(search.toLowerCase()) ||
    message.toLowerCase().includes(search.toLowerCase());

  const feed = [
    ...tasks
      .filter(t => sourceFilter === 'all' || sourceFilter === t.source)
      .filter(() => typeFilter === 'all' || typeFilter === 'task')
      .filter(t => matchesSearch(t.title, t.description))
      .map(t => ({ ...t, category: 'task' })),
    ...notifications
      .filter(n => sourceFilter === 'all' || sourceFilter === n.source)
      .filter(n => typeFilter === 'all' || typeFilter === n.type)
      .filter(n => matchesSearch(n.title, n.message))
      .map(n => ({ ...n, category: 'notification' })),
  ];

  const counts = {
    critical: notifications.filter(n => n.type === 'critical').length,
    tasks: tasks.length,
    total: feed.length,
  };

  const serif = { fontFamily: "'Playfair Display', serif" };
  const sans = { fontFamily: "'DM Sans', sans-serif" };

  return (
    <div style={{ ...sans, background: IVORY, minHeight: '100vh' }}>

      {/* ── Hero band ─────────────────────────────────────── */}
      <div
        className="relative overflow-hidden px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-14 sm:pb-16"
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

        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.25em] mb-2" style={{ color: GOLD }}>
              Scholar Portal
            </p>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white" style={serif}>Notifications</h1>
            <p className="text-xs mt-2" style={{ color: '#e9c9a8' }}>Tasks, deadline alerts, and updates — all in one place.</p>
          </div>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-full transition-colors"
              style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:p-8 lg:pt-0">

        {/* ── Summary strip — floats over the hero ────────────── */}
        <div
          className="relative -mt-8 sm:-mt-10 mb-6 sm:mb-8 rounded-2xl bg-white overflow-hidden"
          style={{ boxShadow: '0 12px 30px -12px rgba(79,22,32,0.25)' }}
        >
          <div className="grid grid-cols-3 divide-x divide-slate-100">
            <div className="p-4 sm:p-5 text-center">
              <p className="text-2xl sm:text-3xl font-bold" style={{ ...serif, color: '#991b1b' }}>{counts.critical}</p>
              <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: '#c9a9b0' }}>Critical</p>
            </div>
            <div className="p-4 sm:p-5 text-center">
              <p className="text-2xl sm:text-3xl font-bold" style={{ ...serif, color: '#92400e' }}>{counts.tasks}</p>
              <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: '#c9a9b0' }}>Open Tasks</p>
            </div>
            <div className="p-4 sm:p-5 text-center">
              <p className="text-2xl sm:text-3xl font-bold" style={{ ...serif, color: MAROON }}>{unread}</p>
              <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: '#c9a9b0' }}>Unread</p>
            </div>
          </div>
        </div>

        {/* ── Upcoming Deadlines — a horizontal countdown ribbon ── */}
        <div className="rounded-2xl bg-white p-5 mb-6" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={15} style={{ color: MAROON }} />
            <h3 className="text-sm font-bold" style={{ ...serif, color: INK }}>Upcoming Deadlines</h3>
          </div>
          {deadlines.length === 0 ? (
            <p className="text-xs text-slate-400">No upcoming deadlines.</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {deadlines.map((d, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 rounded-xl px-4 py-3 min-w-[140px]"
                  style={{ background: d.urgent ? '#FBF0DE' : IVORY, border: `1px solid ${d.urgent ? '#f3d9a6' : '#f0e6e0'}` }}
                >
                  <p className="text-2xl font-bold leading-none" style={{ ...serif, color: d.urgent ? '#92400e' : MAROON }}>
                    {d.daysLeft >= 0 ? d.daysLeft : '—'}
                  </p>
                  <p className="text-[9px] font-bold uppercase tracking-widest mt-1" style={{ color: d.urgent ? '#92400e' : '#a89890' }}>
                    {d.daysLeft >= 0 ? 'days left' : 'overdue'}
                  </p>
                  <p className="text-xs font-semibold mt-1.5 truncate" style={{ color: INK }}>{d.task}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Search + Type Dropdown */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5" size={16} style={{ color: '#c9b3b8' }} />
            <input
              type="text"
              placeholder="Search notifications..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white pl-11 pr-4 py-3 text-sm rounded-2xl outline-none transition-all placeholder:text-slate-300"
              style={{ border: '1px solid #f0e6e0', boxShadow: '0 8px 24px -16px rgba(36,21,18,0.15)' }}
              onFocus={e => (e.target.style.borderColor = MAROON)}
              onBlur={e => (e.target.style.borderColor = '#f0e6e0')}
            />
          </div>
          <div className="relative sm:w-56 shrink-0">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="w-full appearance-none bg-white pl-4 pr-9 py-3 text-sm font-bold rounded-2xl outline-none transition-all cursor-pointer capitalize"
              style={{ border: '1px solid #f0e6e0', boxShadow: '0 8px 24px -16px rgba(36,21,18,0.15)', color: '#374151' }}
            >
              {TYPE_FILTERS.map(f => (
                <option key={f} value={f} className="capitalize">{f === 'all' ? 'All Types' : f}</option>
              ))}
            </select>
            <ChevronDown size={15} className="absolute right-3.5 top-3.5 pointer-events-none" style={{ color: '#c9b3b8' }} />
          </div>
        </div>

        <div className="flex gap-6 mb-6 flex-wrap border-b" style={{ borderColor: '#f0e6e0' }}>
          {SOURCE_TABS.map(f => (
            <button
              key={f.key}
              onClick={() => setSourceFilter(f.key)}
              className="text-xs pb-2.5 font-bold uppercase tracking-wider transition-colors"
              style={{
                color: sourceFilter === f.key ? MAROON : '#c9b3b8',
                borderBottom: sourceFilter === f.key ? `2px solid ${MAROON}` : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ── Feed — a connected activity timeline ────────────── */}
        {loading ? (
          <div className="space-y-3 pt-2">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl h-20" style={{ background: '#EFE7E2' }} />
            ))}
          </div>
        ) : feed.length === 0 ? (
          <div className="bg-white rounded-[2rem] p-16 text-center" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)' }}>
            <Bell size={40} className="mx-auto mb-3" style={{ color: '#e9d9dc' }} />
            <p className="text-sm font-bold" style={{ color: '#c9b3b8' }}>No notifications for this filter.</p>
          </div>
        ) : (
          <div className="relative pb-8">
            {/* the spine — turns the feed into one continuous timeline instead of loose cards */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px" style={{ background: '#ecdfe1' }} />

            <div className="space-y-5">
              {feed.map((item) => {
                if (item.category === 'task') {
                  const Icon = item.icon;
                  const dotColor = item.urgent ? '#92400e' : MAROON;
                  return (
                    <div key={item.id} className="relative pl-9">
                      <span
                        className="absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full z-10 flex items-center justify-center"
                        style={{ background: dotColor, boxShadow: `0 0 0 3px ${dotColor}22` }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      </span>

                      <div className="bg-white p-5 rounded-2xl" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)' }}>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="p-2.5 rounded-xl mt-0.5 flex-shrink-0" style={{ background: '#F5E8EA', color: MAROON }}>
                              <Icon size={16} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-bold text-sm" style={{ color: INK }}>{item.title}</span>
                                <span
                                  className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                                  style={{ background: item.urgent ? '#FBF0DE' : '#F5E8EA', color: item.urgent ? '#92400e' : MAROON }}
                                >
                                  {item.urgent ? 'Due Soon' : 'Task'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 leading-relaxed">{item.description}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => navigate(item.route)}
                            className="w-full sm:w-auto flex-shrink-0 px-5 py-2.5 rounded-full text-white text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all"
                            style={{ background: `linear-gradient(120deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)` }}
                          >
                            {item.actionLabel}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                const cfg = typeConfig[item.type];
                const Icon = cfg.icon;
                const src = sourceConfig[item.source];
                const SrcIcon = src.icon;

                return (
                  <div key={item.id} className="relative pl-9">
                    <span
                      className="absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full z-10 flex items-center justify-center"
                      style={item.read
                        ? { background: '#fff', border: '2px solid #d8c9c2' }
                        : { background: cfg.dot, boxShadow: `0 0 0 3px ${cfg.dot}22` }}
                    >
                      {!item.read && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>

                    <div
                      onClick={() => markRead(item.id)}
                      className="bg-white p-5 rounded-2xl cursor-pointer transition-all"
                      style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)', opacity: item.read ? 0.72 : 1 }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl mt-0.5 flex-shrink-0" style={{ background: cfg.bg, color: cfg.text }}>
                          <Icon size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-bold text-sm" style={{ color: INK }}>{item.title}</span>
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                              style={{ background: cfg.bg, color: cfg.text }}
                            >
                              {cfg.label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed mb-2 break-words">{item.message}</p>
                          <div className="flex flex-wrap items-center gap-2 pt-2" style={{ borderTop: '1px solid #f5eee9' }}>
                            <Clock size={10} style={{ color: '#c9b3b8' }} />
                            <span className="text-[10px]" style={{ color: '#c9b3b8' }}>{timeAgo(item.date)}</span>
                            <span style={{ color: '#e9dfd8' }}>•</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: MAROON }}>
                              <SrcIcon size={9} /> {src.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ScholarNotification;