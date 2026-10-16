import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import OfficerNotifications from '../../components/Officer/OfficerNotifications';
import {
  Users, Clock, CheckCircle, XCircle, TrendingUp,
  Calendar, Activity, Zap,
  FileCheck, AlertTriangle, FileText, CalendarDays,
  ArrowUpRight, BarChart3
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

// Shared panel shell: icon chip + serif title + optional description.
function Panel({ icon: Icon, title, description, children, className = '', style = {} }) {
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
      </div>
      {children}
    </section>
  );
}

// ── Overall Scholar Compliance (ring + Submitted / Missing / Late + breakdown bar) ──
function ComplianceSeal({ loading, rate, submitted, missing, late }) {
  const color = rate >= 80 ? SAGE : rate >= 50 ? AMBER : CLAY;
  const radius = 58, stroke = 12, size = 140;
  const c = 2 * Math.PI * radius;
  const pct = Math.min(100, Math.max(0, rate));
  const offset = c - (pct / 100) * c;

  const stats = [
    { label: 'Submitted', value: submitted, color: SAGE, icon: CheckCircle },
    { label: 'Missing', value: missing, color: CLAY, icon: AlertTriangle },
    { label: 'Late', value: late, color: AMBER, icon: Clock },
  ];
  // The bar shows the relative size of the three counts shown above.
  const barTotal = submitted + missing + late;

  return (
    <Panel icon={TrendingUp} title="Overall Scholar Compliance" description="Today's docket for all assigned scholars.">
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
                <span style={{ ...serif, fontSize: '2rem', fontWeight: 800, color: INK, lineHeight: 1 }}>{rate}%</span>
                <span style={{ ...sans, fontSize: '0.6rem', fontWeight: 700, color: '#a89890', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4 }}>Compliant</span>
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
              <div className="flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: RULE }} role="img" aria-label="Submitted, missing, and late breakdown">
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

function StatisticsCards({ loading, totalScholars, pending, approved, rejected, active }) {
  const cards = [
    { label: 'Total Scholars', value: totalScholars, icon: Users, color: MAROON },
    { label: 'Pending Review', value: pending, icon: Clock, color: AMBER },
    { label: 'Approved', value: approved, icon: CheckCircle, color: SAGE },
    { label: 'Rejected', value: rejected, icon: XCircle, color: CLAY },
    { label: 'Active Scholars', value: active, icon: Users, color: GOLD },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
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
    <Panel icon={Zap} title="Needs Attention" description="Items waiting in your officer queue.">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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

// ─── ComplianceOverview (Compliance Breakdown) ─────────────────────────────

function ComplianceOverview({ loading, submitted, missing, late, total }) {
  const rate = total > 0 ? Math.round((submitted / total) * 100) : 0;

  return (
    <Panel icon={TrendingUp} title="Compliance Breakdown" description="Submitted, missing, and late counts." className="h-full">
      {loading ? (
        <div className="space-y-3">
          <SkeletonBox h={14} /><SkeletonBox h={14} /><SkeletonBox h={14} />
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <div className="mb-1.5 flex items-center justify-between">
              <span style={{ ...sans, fontSize: '0.78rem', fontWeight: 600, color: '#6b6058' }}>Overall Compliance</span>
              <span style={{ ...mono, fontSize: '0.8rem', fontWeight: 800, color: MAROON }}>{rate}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full" style={{ background: RULE }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${rate}%`, background: MAROON }} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Submitted', value: submitted, color: SAGE },
              { label: 'Missing', value: missing, color: CLAY },
              { label: 'Late', value: late, color: AMBER },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: `${s.color}12`, border: `1px solid ${s.color}30` }}>
                <p style={{ ...serif, fontSize: '1.2rem', fontWeight: 700, color: s.color }}>{s.value}</p>
                <p style={{ ...sans, fontSize: '0.68rem', fontWeight: 700, color: s.color, marginTop: 2 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </>
      )}
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

// ─── RecentActivities ─────────────────────────────────────────────────────

function RecentActivities({ loading, activities }) {
  return (
    <Panel icon={Activity} title="Recent Activities" description="Latest updates and actions.">
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3, 4].map(i => <SkeletonBox key={i} h={36} radius={10} />)}
        </div>
      ) : activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Activity size={26} style={{ color: '#e9d9dc' }} className="mb-2" />
          <p style={{ ...sans, fontSize: '0.78rem', color: '#a89890' }}>No recent activities</p>
        </div>
      ) : (
        <ol>
          {activities.slice(0, 6).map((a, i, arr) => (
            <li key={i} className="od-row relative flex items-start gap-3 rounded-lg px-2.5 py-2.5 transition-colors">
              <div className="relative flex flex-shrink-0 flex-col items-center self-stretch" style={{ width: 10 }}>
                <span className="rounded-full" style={{ width: 9, height: 9, background: GOLD, marginTop: 5 }} />
                {i < arr.length - 1 && <span className="flex-1" style={{ width: 1, background: RULE, marginTop: 4 }} />}
              </div>
              <div className="min-w-0 flex-1" style={{ borderBottom: i < arr.length - 1 ? 'none' : 'none' }}>
                <p style={{ ...sans, fontSize: '0.8rem', fontWeight: 600, color: '#4b3f38', lineHeight: 1.45 }}>{a.description || a.action}</p>
                <p style={{ ...mono, fontSize: '0.68rem', color: '#a89890', marginTop: 2 }}>{a.created_at || a.date}</p>
              </div>
            </li>
          ))}
        </ol>
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
    <Panel icon={Zap} title="Quick Actions" description="Common tasks and navigation.">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {actions.map((a) => (
          <button key={a.path} type="button" onClick={() => navigate(a.path)}
            className="od-card group flex items-center gap-3 rounded-xl p-4 text-left transition-colors"
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

// ─── Main OfficerDashboard ─────────────────────────────────────────────────

const authHeader = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

const OfficerDashboard = () => {
  const name = localStorage.getItem('name');
  const navigate = useNavigate();

  const [submissions, setSubmissions] = useState([]);
  const [scholars, setScholars] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [activities, setActivities] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [notificationPreferences, setNotificationPreferences] = useState({
    new_submissions: true,
    pending_reviews: true,
    deadlines: true,
    returned_submissions: true,
    announcements: true,
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [subRes, scholarsRes, deadlinesRes, activitiesRes, announcementsRes, preferencesRes] =
          await Promise.allSettled([
            axios.get('http://localhost:5000/api/submission/all', { headers: authHeader() }),
            axios.get('http://localhost:5000/api/staff/pending', { headers: authHeader() }),
            axios.get('http://localhost:5000/api/staff/deadlines', { headers: authHeader() }),
            axios.get('http://localhost:5000/api/staff/reports/activities', { headers: authHeader() }),
            axios.get('http://localhost:5000/api/officer/announcements', { headers: authHeader() }),
            axios.get('http://localhost:5000/api/officer/settings/notifications', { headers: authHeader() }),
          ]);

        if (subRes.status === 'fulfilled') setSubmissions(subRes.value.data);
        if (scholarsRes.status === 'fulfilled') setScholars(scholarsRes.value.data);
        if (deadlinesRes.status === 'fulfilled') setDeadlines(deadlinesRes.value.data);
        if (activitiesRes.status === 'fulfilled') setActivities(activitiesRes.value.data);
        if (announcementsRes.status === 'fulfilled') setAnnouncements(announcementsRes.value.data || []);
        if (preferencesRes.status === 'fulfilled') {
          setNotificationPreferences(preferencesRes.value.data);
        } else {
          console.error('Error fetching officer notification preferences:', preferencesRes.reason);
        }
      } catch (err) {
        console.error('Error fetching officer dashboard data:', err);
      } finally {
        setLoading(false);
        setLastUpdated(new Date());
      }
    };
    fetchData();
  }, []);

  const pending = submissions.filter(s => s.status === 'pending').length;
  const pendingReviews = submissions.filter(s => s.status === 'under_review').length;
  const returnedSubmissions = submissions.filter(s => s.status === 'returned' || s.status === 'rejected').length;
  const approved = submissions.filter(s => s.status === 'approved').length;
  const rejected = submissions.filter(s => s.status === 'rejected').length;
  const active = scholars.filter(s => s.status === 'active').length;
  const submitted = approved;
  const missing = Math.max(0, scholars.length - submitted);
  const late = submissions.filter(s => s.is_late).length;
  const complianceRate = scholars.length > 0 ? Math.round((submitted / scholars.length) * 100) : 0;

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
            <div className="flex items-center gap-3" style={{ ...tile, padding: '16px 24px' }}>
              <span className="inline-flex flex-shrink-0 items-center justify-center" style={{ width: 42, height: 42, borderRadius: 12, background: `${MAROON}10` }}>
                <CalendarDays size={19} style={{ color: MAROON }} />
              </span>
              <div>
                <p style={{ ...sans, fontSize: '0.68rem', color: '#a89890' }}>Today</p>
                <p style={{ ...sans, fontSize: '0.92rem', fontWeight: 600, color: INK, whiteSpace: 'nowrap' }}>{todayLabel}</p>
              </div>
            </div>
            <div className="flex items-center" style={{ ...tile, padding: '0 14px', position: 'relative' }}>
              <OfficerNotifications
                loading={loading}
                pending={pending}
                pendingReviews={pendingReviews}
                returnedSubmissions={returnedSubmissions}
                deadlines={deadlines}
                announcements={announcements}
                preferences={notificationPreferences}
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
          active={active}
        />

        {/* ── Overall Scholar Compliance ── */}
        <ComplianceSeal loading={loading} rate={complianceRate} submitted={submitted} missing={missing} late={late} />

        {/* ── Needs Attention ── */}
        <NeedsAttention
          loading={loading}
          pending={pending}
          deadlines={deadlines}
          onNavigate={path => navigate(path)}
        />

        {/* ── Compliance Breakdown + Upcoming Deadlines ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ComplianceOverview loading={loading} submitted={submitted} missing={missing} late={late} total={scholars.length} />
          <UpcomingDeadlines loading={loading} deadlines={deadlines} />
        </div>

        {/* ── Recent Activities ── */}
        <RecentActivities loading={loading} activities={activities} />

        {/* ── Quick Actions ── */}
        <QuickActions />
      </div>
    </div>
  );
};

export default OfficerDashboard;