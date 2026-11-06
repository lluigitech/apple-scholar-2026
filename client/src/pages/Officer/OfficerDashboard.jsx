import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import OfficerNotifications from '../../components/Officer/OfficerNotifications';
import { API_BASE } from '../../components/Officer/Reports/ReportsHelpers';
import {
  Users, Clock, CheckCircle, XCircle, TrendingUp,
  Calendar, Zap,
  FileCheck, AlertTriangle, FileText, CalendarDays,
  ArrowUpRight, BarChart3, Megaphone, ChevronRight
} from 'lucide-react';

// ── Token system — shared across the whole portal ──
const MAROON = '#7f2d3a';
const MAROON_DEEP = '#4f1620';
const GOLD = '#b98b4e';
const GOLD_LIGHT = '#d4af7a';
const IVORY = '#FBF7F2';
const INK = '#241512';
const SAGE = '#6b8f71';
const CLAY = '#c1666b';
const AMBER = '#b8863f';
const PAPER = '#F6EFE4';
const RULE = '#e8dccb';
const ROSE = '#F5E8EA';

// Existing Officer Announcements route — must match the path registered in your router.
const OFFICER_ANNOUNCEMENTS_PATH = '/officer/announcements';

const serif = { fontFamily: "'Playfair Display', serif" };
const sans = { fontFamily: "'DM Sans', sans-serif" };
const mono = { fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, monospace" };

const tile = {
  background: '#fff',
  border: `1px solid ${RULE}`,
  borderRadius: 14,
  boxShadow: '0 8px 20px -16px rgba(36,21,18,0.35)',
};

function SkeletonBox({ h = 16, w = '100%', radius = 6 }) {
  return <div className="animate-pulse" style={{ height: h, width: w, borderRadius: radius, background: PAPER }} />;
}

const normalizeLevel = value => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[_-]/g, ' ')
  .replace(/\s+/g, ' ')
  .replace(/^grade\s*(\d+)$/, 'grade $1')
  .replace(/^(1st|2nd|3rd|4th|5th)\s+year(?:\s+college)?$/, (_, year) => `college ${{ '1st': 1, '2nd': 2, '3rd': 3, '4th': 4, '5th': 5 }[year]}`);

const dateKey = value => {
  if (!value) return '';
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  return String(value).slice(0, 10);
};

const parseTargetLevels = value => {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getMonthlyCompliance = (scholars, tasks, submissions, today = new Date()) => {
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const todayKey = dateKey(today);
  const metrics = { submitted: 0, missing: 0, late: 0, total: 0 };
  const taskDeadlinesByScholar = new Map();
  const monthlyTasks = tasks.filter(task => (
    String(task.type || '').trim().toLowerCase() === 'monthly report'
    && dateKey(task.due_date).startsWith(monthKey)
    && dateKey(task.due_date) <= todayKey
  ));

  scholars.forEach(scholar => {
    const assignedTaskDeadlines = monthlyTasks
      .filter(task => {
        const levels = parseTargetLevels(task.target_year_levels).map(normalizeLevel);
        return !levels.length || levels.includes(normalizeLevel(scholar.year_level));
      })
      .map(task => dateKey(task.due_date))
      .sort();
    if (assignedTaskDeadlines.length) {
      taskDeadlinesByScholar.set(scholar.scholar_id, assignedTaskDeadlines[assignedTaskDeadlines.length - 1]);
    }
  });

  const monthlySubmissionsByScholar = new Map();
  submissions.forEach(submission => {
    const submissionDate = dateKey(submission.submitted_at);
    const scholarId = submission.scholar_id || submission.sid;
    if (
      String(submission.submission_type || '').toLowerCase() !== 'letter'
      || !submissionDate.startsWith(monthKey)
      || submissionDate > todayKey
      || !scholarId
    ) return;
    if (!monthlySubmissionsByScholar.has(scholarId)) monthlySubmissionsByScholar.set(scholarId, []);
    monthlySubmissionsByScholar.get(scholarId).push(submissionDate);
  });

  scholars.forEach(scholar => {
    metrics.total += 1;
    const submittedDates = monthlySubmissionsByScholar.get(scholar.scholar_id) || [];
    if (!submittedDates.length) {
      metrics.missing += 1;
      return;
    }

    const deadline = taskDeadlinesByScholar.get(scholar.scholar_id);
    if (!deadline || submittedDates.some(submittedDate => submittedDate <= deadline)) metrics.submitted += 1;
    else metrics.late += 1;
  });

  return {
    ...metrics,
    rate: metrics.total ? Math.min(100, Math.round((metrics.submitted / metrics.total) * 100)) : null,
    monthLabel: today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  };
};

// Shared panel shell: icon chip + serif title + optional description.
function Panel({ icon: Icon, title, description, children, className = '', style = {}, action = null }) {
  return (
    <section className={`min-w-0 ${className}`} style={{ ...tile, padding: '18px 20px', ...style }}>
      <div className="flex items-start gap-3" style={{ marginBottom: 14 }}>
        <span className="inline-flex flex-shrink-0 items-center justify-center rounded-lg" style={{ width: 34, height: 34, background: `${GOLD}1a` }}>
          <Icon size={17} strokeWidth={1.75} style={{ color: GOLD }} />
        </span>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ ...serif, fontSize: '1.02rem', fontWeight: 700, color: MAROON, lineHeight: 1.25 }}>{title}</h2>
          {description && <p style={{ ...sans, fontSize: '0.76rem', color: '#a89890', marginTop: 2 }}>{description}</p>}
        </div>
        {action && <div className="ml-auto flex-shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

// ── Monthly Scholar Compliance (ring + monthly report status breakdown) ──
function ComplianceSeal({ loading, rate, submitted, missing, late, monthLabel }) {
  const color = rate === null || rate >= 80 ? SAGE : rate >= 50 ? AMBER : CLAY;
  const radius = 58, stroke = 12, size = 140;
  const c = 2 * Math.PI * radius;
  const pct = Math.min(100, Math.max(0, rate || 0));
  const offset = c - (pct / 100) * c;

  const stats = [
    { label: 'On time', value: submitted, color: SAGE, icon: CheckCircle },
    { label: 'Missing', value: missing, color: CLAY, icon: AlertTriangle },
    { label: 'Late', value: late, color: AMBER, icon: Clock },
  ];
  // The bar shows the relative size of the three counts shown above.
  const barTotal = submitted + missing + late;

  return (
    <Panel icon={TrendingUp} title="Overall Scholar Compliance" description={`Monthly Report compliance for ${monthLabel}.`} className="h-full">
      <div className="flex flex-col items-center gap-6 md:flex-row md:items-center">
        <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Compliance rate ${rate}%`}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={RULE} strokeWidth={stroke} />
            {!loading && (
              <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {loading ? <SkeletonBox h={26} w={52} /> : (
              <>
                <span style={{ ...serif, fontSize: '2rem', fontWeight: 800, color: INK, lineHeight: 1 }}>{rate === null ? '—' : `${rate}%`}</span>
                <span style={{ ...sans, fontSize: '0.6rem', fontWeight: 700, color: '#a89890', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4 }}>
                  {rate === null ? 'No tasks due' : 'On time'}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="w-full min-w-0 flex-1">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {stats.map(s => (
              <div key={s.label} className="flex items-center gap-3 rounded-xl p-3.5" style={{ background: `${s.color}12`, border: `1px solid ${s.color}30` }}>
                <span className="inline-flex flex-shrink-0 items-center justify-center rounded-lg" style={{ width: 34, height: 34, background: `${s.color}1f`, color: s.color }}>
                  <s.icon size={16} />
                </span>
                <div style={{ minWidth: 0 }}>
                  {loading ? <SkeletonBox h={22} w={32} /> : <p style={{ ...serif, fontSize: '1.4rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</p>}
                  <p style={{ ...sans, fontSize: '0.72rem', fontWeight: 600, color: '#6b6058', marginTop: 3 }}>{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            {loading ? <SkeletonBox h={10} radius={999} /> : (
              <div className="flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: RULE }} role="img" aria-label="Monthly Report on-time, missing, and late breakdown">
                {barTotal > 0 && stats.map(s => s.value > 0 && (
                  <div key={s.label} style={{ width: `${(s.value / barTotal) * 100}%`, background: s.color }} />
                ))}
              </div>
            )}
            <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1">
              {stats.map(s => (
                <span key={s.label} className="inline-flex items-center gap-1.5" style={{ ...sans, fontSize: '0.74rem', color: '#6b6058' }}>
                  <span className="rounded-full" style={{ width: 9, height: 9, background: s.color }} />
                  {s.label} <span style={{ ...mono, fontWeight: 700, color: s.color }}>{loading ? '—' : s.value}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

// ─── StatisticsCards ───────────────────────────────────────────────────────

function StatisticsCards({ loading, totalScholars, pending, approved, rejected }) {
  const cards = [
    { label: 'Total Scholars', value: totalScholars, icon: Users, color: MAROON },
    { label: 'Pending Review', value: pending, icon: Clock, color: AMBER },
    { label: 'Approved', value: approved, icon: CheckCircle, color: SAGE },
    { label: 'Rejected', value: rejected, icon: XCircle, color: CLAY },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="flex h-full items-center gap-3.5" style={{ ...tile, padding: '16px 18px', minWidth: 0 }}>
          <span className="inline-flex flex-shrink-0 items-center justify-center rounded-full" style={{ width: 46, height: 46, background: `${card.color}1a` }}>
            <card.icon size={20} strokeWidth={1.75} style={{ color: card.color }} />
          </span>
          <div style={{ minWidth: 0 }}>
            <p className="truncate" style={{ ...sans, fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a89890' }}>{card.label}</p>
            {loading ? <div style={{ marginTop: 6 }}><SkeletonBox h={26} w={44} /></div>
              : <p style={{ ...serif, fontSize: '1.75rem', fontWeight: 700, color: INK, lineHeight: 1.15 }}>{card.value}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── NeedsAttention ───────────────────────────────────────────────────────

function NeedsAttention({ loading, pending, deadlines, onNavigate }) {
  const items = [
    { label: 'Pending reviews', value: pending, note: 'Submissions waiting for action', path: '/officer/validation', icon: Clock, color: AMBER },
    { label: 'Upcoming tasks', value: deadlines.length, note: 'Active deadlines to monitor', path: '/officer/task-assignment', icon: Calendar, color: MAROON },
  ];

  return (
    <Panel icon={Zap} title="Needs Attention" description="Items waiting in your officer queue." className="h-full">
      <div className="grid grid-cols-1 gap-3">
        {items.map(item => (
          <button key={item.path} type="button" onClick={() => onNavigate(item.path)}
            className="od-card flex items-center gap-3 rounded-xl p-3.5 text-left transition-colors"
            style={{ border: `1px solid ${RULE}`, borderLeft: `3px solid ${item.color}`, background: '#fff', cursor: 'pointer' }}>
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: `${item.color}14`, color: item.color }}>
              <item.icon size={17} />
            </div>
            <div className="min-w-0 flex-1">
              {loading ? <SkeletonBox h={20} w={30} /> : <p style={{ ...serif, fontSize: '1.2rem', fontWeight: 700, color: item.color, lineHeight: 1 }}>{item.value}</p>}
              <p className="truncate" style={{ ...sans, fontSize: '0.78rem', fontWeight: 700, color: INK, marginTop: 3 }}>{item.label}</p>
              <p className="truncate" style={{ ...sans, fontSize: '0.7rem', color: '#a89890' }}>{item.note}</p>
            </div>
            <ArrowUpRight size={15} style={{ color: '#c9b9b0', flexShrink: 0 }} />
          </button>
        ))}
      </div>
    </Panel>
  );
}

// ─── UpcomingDeadlines ─────────────────────────────────────────────────────

function UpcomingDeadlines({ loading, deadlines }) {
  return (
    <Panel icon={Calendar} title="Upcoming Deadlines" description="Next tasks due for your scholars." className="h-full">
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map(i => <SkeletonBox key={i} h={44} radius={10} />)}
        </div>
      ) : deadlines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Calendar size={26} style={{ color: '#e9d9dc' }} className="mb-2" />
          <p style={{ ...sans, fontSize: '0.78rem', color: '#a89890' }}>No upcoming deadlines</p>
        </div>
      ) : (
        <div className="space-y-2">
          {deadlines.slice(0, 5).map((d, i) => (
            <div key={i} className="od-row flex items-center gap-3 rounded-lg p-3 transition-colors" style={{ background: PAPER }}>
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: ROSE, color: MAROON }}>
                <Calendar size={13} />
              </div>
              <div className="min-w-0">
                <p className="truncate" style={{ ...sans, fontSize: '0.8rem', fontWeight: 700, color: INK }}>{d.title || d.name}</p>
                <p style={{ ...mono, fontSize: '0.68rem', color: '#a89890' }}>{d.date || d.due_date}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ─── QuickActions ──────────────────────────────────────────────────────────

function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    { label: 'Manual Validation', icon: FileCheck, path: '/officer/validation', color: MAROON },
    { label: 'Reports', icon: BarChart3, path: '/officer/reports', color: GOLD },
    { label: 'Summary Report', icon: FileText, path: '/officer/summary-report', color: SAGE },
  ];

  return (
    <Panel icon={Zap} title="Quick Actions" description="Common tasks and navigation." className="h-full">
      <div className="flex flex-col gap-2.5">
        {actions.map((a) => (
          <button key={a.path} type="button" onClick={() => navigate(a.path)}
            className="od-card group flex items-center gap-3 rounded-xl p-3.5 text-left transition-colors"
            style={{ border: `1px solid ${RULE}`, background: '#fff', cursor: 'pointer' }}>
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105" style={{ background: `${a.color}14`, color: a.color }}>
              <a.icon size={18} />
            </span>
            <span className="flex-1" style={{ ...sans, fontSize: '0.82rem', fontWeight: 700, color: '#4b3f38', lineHeight: 1.25 }}>{a.label}</span>
            <ArrowUpRight size={14} style={{ color: '#c9b9b0', flexShrink: 0 }} />
          </button>
        ))}
      </div>
    </Panel>
  );
}

// ─── RecentAnnouncements ───────────────────────────────────────────────────

const PRIORITY_STYLES = {
  critical: { label: 'Critical', color: CLAY },
  important: { label: 'Important', color: AMBER },
  info: { label: 'Info', color: GOLD },
};

const getRecentAnnouncements = (list, limit = 3) => {
  const time = item => {
    const t = new Date(item?.created_at).getTime();
    return Number.isNaN(t) ? -Infinity : t;
  };
  return [...list].sort((a, b) => time(b) - time(a)).slice(0, limit);
};

const formatAnnouncementDate = value => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
};

const roleLabel = role => {
  const text = String(role || '').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
};

function RecentAnnouncements({ loading, error, announcements, onNavigate, onRetry }) {
  const recent = getRecentAnnouncements(announcements);
  const goToAnnouncements = () => onNavigate(OFFICER_ANNOUNCEMENTS_PATH);

  return (
    <Panel
      icon={Megaphone}
      title="Recent Announcements"
      description="Latest updates from the administration and staff."
      action={(
        <button type="button" onClick={goToAnnouncements} className="od-card inline-flex items-center gap-1 rounded-lg"
          style={{ ...sans, fontSize: '0.74rem', fontWeight: 700, color: MAROON, padding: '6px 10px', border: `1px solid ${RULE}`, background: '#fff', cursor: 'pointer' }}>
          View All <ChevronRight size={14} />
        </button>
      )}
    >
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map(i => <SkeletonBox key={i} h={64} radius={10} />)}
        </div>
      ) : error && recent.length === 0 ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg p-3"
          style={{ borderLeft: `3px solid ${CLAY}`, background: `${CLAY}0d`, ...sans, fontSize: '0.78rem', fontWeight: 600, color: CLAY }}>
          <span className="flex items-center gap-2"><AlertTriangle size={14} className="flex-shrink-0" />Announcements could not be loaded.</span>
          <button type="button" onClick={onRetry} style={{ ...sans, fontSize: '0.74rem', fontWeight: 700, color: CLAY, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}>Retry</button>
        </div>
      ) : recent.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Megaphone size={26} style={{ color: '#e9d9dc' }} className="mb-2" />
          <p style={{ ...sans, fontSize: '0.82rem', fontWeight: 700, color: INK }}>No announcements yet.</p>
          <p style={{ ...sans, fontSize: '0.74rem', color: '#a89890', marginTop: 2 }}>New announcements will appear here when they are published.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2.5">
            {recent.map((a, i) => {
              const priority = PRIORITY_STYLES[String(a.priority || '').toLowerCase()];
              const accent = priority ? priority.color : GOLD;
              const source = [a.created_by_name, roleLabel(a.created_by_role)].filter(Boolean).join(' · ');
              const date = formatAnnouncementDate(a.created_at);
              return (
                <button key={a.id ?? i} type="button" onClick={goToAnnouncements}
                  className="od-card flex w-full items-center gap-3 rounded-xl p-3.5 text-left transition-colors"
                  style={{ border: `1px solid ${RULE}`, borderLeft: `3px solid ${accent}`, background: '#fff', cursor: 'pointer', minWidth: 0 }}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p style={{ ...sans, fontSize: '0.84rem', fontWeight: 700, color: INK, overflowWrap: 'anywhere' }}>{a.title || 'Untitled announcement'}</p>
                      {priority && (
                        <span style={{ ...sans, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: priority.color, background: `${priority.color}1a`, border: `1px solid ${priority.color}40`, borderRadius: 999, padding: '2px 8px' }}>
                          {priority.label}
                        </span>
                      )}
                    </div>
                    {a.content && (
                      <p style={{ ...sans, fontSize: '0.76rem', color: '#6b6058', marginTop: 3, lineHeight: 1.5, overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {a.content}
                      </p>
                    )}
                    {(source || date) && (
                      <p style={{ ...sans, fontSize: '0.7rem', color: '#a89890', marginTop: 5 }}>
                        {source}{source && date ? ' · ' : ''}{date && <span style={mono}>{date}</span>}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={15} style={{ color: '#c9b9b0', flexShrink: 0 }} />
                </button>
              );
            })}
          </div>
          {error && (
            <p style={{ ...sans, fontSize: '0.7rem', color: '#a89890', marginTop: 8 }}>Couldn&apos;t refresh announcements. Showing the last loaded ones.</p>
          )}
        </>
      )}
    </Panel>
  );
}

// ─── Main OfficerDashboard ─────────────────────────────────────────────────

const authHeader = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

const OfficerDashboard = () => {
  const name = localStorage.getItem('name');
  const navigate = useNavigate();
  const fetchInProgress = useRef(false);

  const [submissions, setSubmissions] = useState([]);
  const [validationCounts, setValidationCounts] = useState({ newSubmissions: 0, pendingReviews: 0 });
  const [scholars, setScholars] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [complianceReminders, setComplianceReminders] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsError, setAnnouncementsError] = useState(false);
  const [notificationDataError, setNotificationDataError] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState({
    new_submissions: true,
    pending_reviews: true,
    deadlines: true,
    announcements: true,
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async (showLoading = false) => {
    if (fetchInProgress.current) return;
    fetchInProgress.current = true;
    if (showLoading) setLoading(true);

    try {
      const endpoints = [
        ['submissions', `${API_BASE}/submission/all`],
        ['validationQueue', `${API_BASE}/submission/scholar-view`],
        ['scholars', `${API_BASE}/staff/pending`],
        ['tasks', `${API_BASE}/tasks`],
        ['complianceReminders', `${API_BASE}/officer/notifications/compliance-due`],
        ['announcements', `${API_BASE}/officer/announcements`],
        ['preferences', `${API_BASE}/officer/settings/notifications`],
      ];
      const results = await Promise.allSettled(
        endpoints.map(([, url]) => axios.get(url, { headers: authHeader() }))
      );
      const data = {};
      results.forEach((result, index) => {
        const [key] = endpoints[index];
        if (result.status === 'fulfilled') {
          data[key] = result.value.data;
        } else {
          console.error(`Failed to refresh Officer dashboard ${key}:`, result.reason);
        }
      });

      const announcementsIndex = endpoints.findIndex(([key]) => key === 'announcements');
      setAnnouncementsError(results[announcementsIndex]?.status === 'rejected');
      setNotificationDataError(
        ['validationQueue', 'complianceReminders', 'announcements', 'preferences']
          .some(key => results[endpoints.findIndex(([endpointKey]) => endpointKey === key)]?.status === 'rejected')
      );

      if (Array.isArray(data.submissions)) setSubmissions(data.submissions);
      if (Array.isArray(data.scholars)) setScholars(data.scholars);
      if (Array.isArray(data.announcements)) setAnnouncements(data.announcements);
      if (data.preferences && typeof data.preferences === 'object') setNotificationPreferences(data.preferences);

      if (Array.isArray(data.validationQueue)) {
        const items = data.validationQueue.flatMap(scholar =>
          ['monthly_letters', 'report_cards', 'cors', 'other_documents', 'grades']
            .flatMap(category => Array.isArray(scholar[category]) ? scholar[category] : [])
        );
        setValidationCounts({
          newSubmissions: items.filter(item => String(item.status || '').toLowerCase() === 'pending').length,
          pendingReviews: items.filter(item => String(item.status || '').toLowerCase() === 'under_review').length,
        });
      }

      if (Array.isArray(data.complianceReminders)) setComplianceReminders(data.complianceReminders);
      if (Array.isArray(data.tasks)) {
        setTasks(data.tasks);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        setDeadlines(data.tasks.filter(task => {
          if (!task.due_date) return false;
          const dueDate = task.due_date instanceof Date
            ? new Date(task.due_date.getFullYear(), task.due_date.getMonth(), task.due_date.getDate())
            : new Date(`${String(task.due_date).slice(0, 10)}T00:00:00`);
          return !Number.isNaN(dueDate.getTime()) && dueDate >= today;
        }));
      }
    } catch (error) {
      console.error('Failed to process Officer dashboard refresh:', error);
    } finally {
      fetchInProgress.current = false;
      setLoading(false);
      setLastUpdated(new Date());
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => fetchData(true), 0);
    const refreshInterval = window.setInterval(() => fetchData(), 60_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') fetchData();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [fetchData]);

  const pending = submissions.filter(s => s.status === 'pending').length;
  const approved = submissions.filter(s => s.status === 'approved').length;
  const rejected = submissions.filter(s => s.status === 'rejected').length;
  const monthlyCompliance = getMonthlyCompliance(scholars, tasks, submissions);
  const { submitted, missing, late, rate: complianceRate, monthLabel } = monthlyCompliance;

  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="min-h-screen" style={{ background: IVORY, ...sans }}>
      <style>{`
        .od-card:hover, .od-row:hover { background: #faf6ee !important; }
        .od-card:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 2px; }
      `}</style>

      <div className="flex flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8" style={{ minWidth: 0 }}>

        {/* ── Standard Officer header: title card + date card (+ notifications) ──
            No overflow:hidden anywhere here so the notifications dropdown is never clipped. */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]" style={{ position: 'relative', zIndex: 30 }}>
          <div style={{ ...tile, padding: '20px 24px' }}>
            <p style={{ ...sans, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', color: GOLD }}>OFFICER PORTAL</p>
            <h1 style={{ ...serif, fontSize: '1.75rem', fontWeight: 700, color: MAROON_DEEP, marginTop: 4, lineHeight: 1.2 }}>Dashboard</h1>
            <p style={{ ...sans, fontSize: '0.84rem', color: '#a89890', marginTop: 6, maxWidth: 640 }}>
              Here&apos;s an overview of your assigned scholars, submissions, and compliance.
            </p>
            <p style={{ ...sans, fontSize: '0.76rem', color: '#7a6a62', marginTop: 8 }}>
              Welcome back, <strong style={{ color: INK }}>{name || 'Officer'}</strong>
              {lastUpdated && (
                <span style={{ ...mono, color: '#a89890' }}> · Updated {lastUpdated.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</span>
              )}
            </p>
          </div>

          <div className="flex items-stretch gap-3">
            <div className="flex items-center gap-4" style={{ ...tile, padding: '16px 18px', position: 'relative' }}>
              <span className="inline-flex flex-shrink-0 items-center justify-center" style={{ width: 42, height: 42, borderRadius: 12, background: `${MAROON}10` }}>
                <CalendarDays size={19} style={{ color: MAROON }} />
              </span>
              <div>
                <p style={{ ...sans, fontSize: '0.68rem', color: '#a89890' }}>Today</p>
                <p style={{ ...sans, fontSize: '0.92rem', fontWeight: 600, color: INK, whiteSpace: 'nowrap' }}>{todayLabel}</p>
              </div>
              <div aria-hidden="true" style={{ alignSelf: 'stretch', width: 1, background: RULE, margin: '0 2px' }} />
              <OfficerNotifications
                loading={loading}
                pending={validationCounts.newSubmissions}
                pendingReviews={validationCounts.pendingReviews}
                deadlines={complianceReminders}
                announcements={announcements}
                preferences={notificationPreferences}
                error={notificationDataError}
                onRetry={() => fetchData(true)}
                onNavigate={navigate}
              />
            </div>
          </div>
        </div>

        {/* ── KPI cards ── */}
        <StatisticsCards
          loading={loading}
          totalScholars={scholars.length}
          pending={pending}
          approved={approved}
          rejected={rejected}
        />

        {/* ── Overall Scholar Compliance (left) + Quick Actions (right) ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <ComplianceSeal loading={loading} rate={complianceRate} submitted={submitted} missing={missing} late={late} monthLabel={monthLabel} />
          <QuickActions />
        </div>

        {/* ── Needs Attention + Upcoming Deadlines ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <NeedsAttention
            loading={loading}
            pending={pending}
            deadlines={deadlines}
            onNavigate={path => navigate(path)}
          />
          <UpcomingDeadlines loading={loading} deadlines={deadlines} />
        </div>

        {/* ── Recent Announcements (full width) ── */}
        <RecentAnnouncements
          loading={loading}
          error={announcementsError}
          announcements={announcements}
          onNavigate={path => navigate(path)}
          onRetry={() => fetchData(true)}
        />
      </div>
    </div>
  );
};

export default OfficerDashboard;