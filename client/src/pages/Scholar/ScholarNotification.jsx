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
const MAROON = '#7f2d3a'; // aligned with the rest of the portals (Admin/Officer/Staff)

const token = () => localStorage.getItem('token');
const authHeaders = () => ({ headers: { Authorization: `Bearer ${token()}` } });
const scholarId = () => localStorage.getItem('scholar_id');
const yearLevel = () => localStorage.getItem('year_level') || '';

/* ── Card "look" config, keyed by type — same palette family used in
   PRIORITY_CONFIG across the Announcement pages ──────────────────────── */
const typeConfig = {
  task:      { icon: ClipboardCheck, bg: '#fef3c7', text: '#92400e', border: '#fcd34d', label: 'Task'            },
  deadline:  { icon: Clock,          bg: '#fef9c3', text: '#b45309', border: '#fde68a', label: 'Deadline'        },
  reminder:  { icon: Bell,           bg: '#dbeafe', text: '#1e40af', border: '#93c5fd', label: 'Reminder'        },
  approved:  { icon: CheckCircle,    bg: '#dcfce7', text: '#15803d', border: '#bbf7d0', label: 'Approved'        },
  rejected:  { icon: XCircle,        bg: '#fee2e2', text: '#991b1b', border: '#fecaca', label: 'Returned'        },
  pending:   { icon: Clock,          bg: '#fef9c3', text: '#854d0e', border: '#fde68a', label: 'Pending Review'  },
  critical:  { icon: AlertCircle,    bg: '#fee2e2', text: '#991b1b', border: '#fca5a5', label: 'Critical'        },
  important: { icon: AlertTriangle,  bg: '#fef3c7', text: '#92400e', border: '#fcd34d', label: 'Important'       },
  info:      { icon: Info,           bg: '#dbeafe', text: '#1e40af', border: '#93c5fd', label: 'Info'            },
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

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 font-sans">

      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-6">
        <span
          className="text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full"
          style={{ background: '#F5E8EA', color: MAROON }}
        >
          Scholar Portal
        </span>
        <div className="flex items-start justify-between mt-2 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight font-serif">
              Notifications
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Tasks, deadline alerts, and updates — all in one place.
            </p>
          </div>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-500 text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-slate-50 transition-all"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="rounded-2xl p-4 text-center" style={{ background: '#fee2e2' }}>
          <p className="text-2xl font-black font-serif" style={{ color: '#991b1b' }}>{counts.critical}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: '#991b1b' }}>Critical</p>
        </div>
        <div className="rounded-2xl p-4 text-center" style={{ background: '#fef3c7' }}>
          <p className="text-2xl font-black font-serif" style={{ color: '#92400e' }}>{counts.tasks}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: '#92400e' }}>Open Tasks</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4 text-center">
          <p className="text-2xl font-black font-serif text-slate-700">{unread}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Unread</p>
        </div>
      </div>

      {/* Upcoming Deadlines */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={15} style={{ color: MAROON }} />
          <h3 className="text-sm font-bold text-slate-800">Upcoming Deadlines</h3>
        </div>
        {deadlines.length === 0 ? (
          <p className="text-xs text-slate-400">No upcoming deadlines. 🎉</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {deadlines.map((d, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-xl gap-2"
                style={{ background: d.urgent ? '#fef9c3' : '#f8fafc' }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={13} className="flex-shrink-0" style={{ color: d.urgent ? '#b45309' : '#94a3b8' }} />
                  <span className="text-xs font-bold text-slate-700 truncate">{d.task}</span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider flex-shrink-0" style={{ color: d.urgent ? '#b45309' : '#64748b' }}>
                  {d.daysLeft >= 0 ? `${d.daysLeft}d left` : 'Overdue'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Search + Source Tabs */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-3.5 text-slate-300" size={16} />
          <input
            type="text"
            placeholder="Search notifications..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 pl-11 pr-4 py-3 text-sm rounded-2xl outline-none focus:border-[#7f2d3a] focus:ring-2 focus:ring-[#7f2d3a]/10 transition-all placeholder:text-slate-300 shadow-sm"
          />
        </div>
        <div className="relative sm:w-56 shrink-0">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="w-full appearance-none bg-white border border-slate-200 pl-4 pr-9 py-3 text-sm font-bold rounded-2xl outline-none focus:border-[#7f2d3a] focus:ring-2 focus:ring-[#7f2d3a]/10 transition-all shadow-sm cursor-pointer capitalize text-slate-700"
          >
            {TYPE_FILTERS.map(f => (
              <option key={f} value={f} className="capitalize">{f === 'all' ? 'All Types' : f}</option>
            ))}
          </select>
          <ChevronDown size={15} className="absolute right-3.5 top-3.5 text-slate-400 pointer-events-none" />
        </div>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {SOURCE_TABS.map(f => (
          <button
            key={f.key}
            onClick={() => setSourceFilter(f.key)}
            className="text-xs px-4 py-1.5 rounded-xl border font-bold capitalize transition-all"
            style={{
              background:  sourceFilter === f.key ? MAROON : '#fff',
              color:       sourceFilter === f.key ? '#fff' : '#64748b',
              borderColor: sourceFilter === f.key ? MAROON : '#e2e8f0',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {loading ? (
        <div className="space-y-3">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="animate-pulse bg-slate-100 rounded-2xl h-24" />
          ))}
        </div>
      ) : feed.length === 0 ? (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-16 text-center">
          <Bell size={40} className="mx-auto mb-3 text-slate-200" />
          <p className="text-sm font-bold text-slate-300">No notifications for this filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {feed.map((item) => {
            if (item.category === 'task') {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm"
                  style={{ borderLeft: `4px solid ${item.urgent ? '#d97706' : MAROON}` }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="p-2.5 rounded-xl mt-0.5 flex-shrink-0" style={{ background: '#F5E8EA', color: MAROON }}>
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-black text-slate-800 text-sm">{item.title}</span>
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase tracking-wider"
                            style={{ background: item.urgent ? '#fef3c7' : '#F5E8EA', color: item.urgent ? '#92400e' : MAROON }}
                          >
                            {item.urgent ? 'Due Soon' : 'Task'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(item.route)}
                      className="w-full sm:w-auto flex-shrink-0 px-5 py-2.5 rounded-xl text-white text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all"
                      style={{ background: MAROON }}
                    >
                      {item.actionLabel}
                    </button>
                  </div>
                </div>
              );
            }

            const cfg = typeConfig[item.type];
            const Icon = cfg.icon;
            const src = sourceConfig[item.source];
            const SrcIcon = src.icon;

            return (
              <div
                key={item.id}
                onClick={() => markRead(item.id)}
                className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm cursor-pointer hover:border-slate-200 transition-all"
                style={{ borderLeft: `4px solid ${item.read ? '#e2e8f0' : cfg.border}` }}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl mt-0.5 flex-shrink-0" style={{ background: cfg.bg, color: cfg.text }}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-black text-slate-800 text-sm">{item.title}</span>
                      {!item.read && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: MAROON }} />}
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase tracking-wider"
                        style={{ background: cfg.bg, color: cfg.text }}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed mb-2 break-words">{item.message}</p>
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-50">
                      <Clock size={10} className="text-slate-300" />
                      <span className="text-[10px] text-slate-400">{timeAgo(item.date)}</span>
                      <span className="text-slate-200">•</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: MAROON }}>
                        <SrcIcon size={9} /> {src.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

export default ScholarNotification;