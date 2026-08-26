import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import OfficerNotifications from '../../components/Officer/OfficerNotifications';
import {
  Users, Clock, CheckCircle, XCircle, TrendingUp,
  AlertTriangle, Calendar, Activity, Zap,
  FileCheck,
  ChevronRight, ShieldAlert, Mail, BarChart3, FileText,
  ArrowUpRight, LayoutDashboard
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

function SkeletonBox({ h = 16, w = '100%', radius = 6 }) {
  return <div className="animate-pulse" style={{ height: h, width: w, borderRadius: radius, background: PAPER }} />;
}

// ── Compliance Seal — the dashboard's signature visual. A large wax-seal
// style ring giving the officer one glanceable "how are we doing today".
function ComplianceSeal({ loading, rate, submitted, missing, late }) {
  const color = rate >= 80 ? SAGE : rate >= 50 ? AMBER : CLAY;
  const radius = 46, stroke = 9;
  const c = 2 * Math.PI * radius;
  const pct = Math.min(100, Math.max(0, rate));
  const offset = c - (pct / 100) * c;

  return (
    <div className="rounded-xl p-5 flex items-center gap-5 flex-wrap sm:flex-nowrap" style={{ background: '#fff', border: `1px solid ${RULE}` }}>
      <div className="relative flex-shrink-0" style={{ width: 108, height: 108 }}>
        <svg width={108} height={108} viewBox="0 0 108 108">
          <circle cx={54} cy={54} r={radius} fill="none" stroke={RULE} strokeWidth={stroke} />
          {!loading && (
            <circle cx={54} cy={54} r={radius} fill="none" stroke={color} strokeWidth={stroke}
              strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
              transform="rotate(-90 54 54)" style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {loading ? <SkeletonBox h={22} w={36} /> : (
            <>
              <span style={{ ...serif, fontSize: '1.6rem', fontWeight: 800, color, lineHeight: 1 }}>{rate}%</span>
              <span style={{ ...sans, fontSize: '0.52rem', fontWeight: 800, color: '#a89890', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>compliant</span>
            </>
          )}
        </div>
      </div>
      <div className="flex-1 min-w-[220px]">
        <p style={{ ...sans, fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#a89890', marginBottom: 4 }}>Today's Docket</p>
        <p style={{ ...serif, fontSize: '1.1rem', fontWeight: 700, color: INK, marginBottom: 12 }}>Overall Scholar Compliance</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Submitted', value: submitted, color: SAGE },
            { label: 'Missing', value: missing, color: CLAY },
            { label: 'Late', value: late, color: AMBER },
          ].map(s => (
            <div key={s.label} className="rounded-lg px-3 py-2.5 text-center" style={{ background: `${s.color}12`, border: `1px solid ${s.color}30` }}>
              {loading ? <SkeletonBox h={20} w={28} /> : <p style={{ ...serif, fontSize: '1.2rem', fontWeight: 700, color: s.color }}>{s.value}</p>}
              <p style={{ ...sans, fontSize: '0.6rem', fontWeight: 800, color: s.color, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl p-4" style={{ background: '#fff', border: `1px solid ${RULE}`, boxShadow: '0 8px 24px -16px rgba(36,21,18,0.2)' }}>
          <div className="flex items-center justify-between mb-2">
            <p style={{ ...sans, fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a89890' }}>{card.label}</p>
            <card.icon size={14} style={{ color: card.color }} />
          </div>
          {loading ? <SkeletonBox h={26} w={44} /> : <p style={{ ...serif, fontSize: '1.7rem', fontWeight: 700, color: card.color, lineHeight: 1 }}>{card.value}</p>}
        </div>
      ))}
    </div>
  );
}

// ─── NeedsAttention ───────────────────────────────────────────────────────

function NeedsAttention({ loading, pending, flagged, deadlines, onNavigate }) {
  const items = [
    { label: 'Pending reviews', value: pending, note: 'Submissions waiting for action', path: '/officer/validation', icon: Clock, color: AMBER },
    { label: 'Flagged scholars', value: flagged.length, note: 'Records that need follow-up', path: '/officer/flagged', icon: ShieldAlert, color: CLAY },
    { label: 'Upcoming tasks', value: deadlines.length, note: 'Active deadlines to monitor', path: '/officer/task-assignment', icon: Calendar, color: MAROON },
  ];

  return (
    <div className="rounded-xl p-5 mb-4" style={{ background: '#fff', border: `1px solid ${RULE}` }}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Zap size={14} style={{ color: MAROON }} />
          <h2 style={{ ...sans, fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: INK }}>Needs Attention</h2>
        </div>
        <span style={{ ...sans, fontSize: '0.62rem', fontWeight: 700, color: '#c9b9b0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Officer queue</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {items.map(item => (
          <button key={item.path} onClick={() => onNavigate(item.path)}
            className="flex items-center gap-3 p-3 rounded-lg text-left transition-colors hover:bg-[#faf6ee]"
            style={{ border: `1px solid ${RULE}`, background: '#fff', cursor: 'pointer' }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${item.color}14`, color: item.color }}>
              <item.icon size={17} />
            </div>
            <div className="min-w-0 flex-1">
              {loading ? <SkeletonBox h={20} w={30} /> : <p style={{ ...serif, fontSize: '1.15rem', fontWeight: 700, color: item.color, lineHeight: 1 }}>{item.value}</p>}
              <p style={{ ...sans, fontSize: '0.72rem', fontWeight: 700, color: INK, marginTop: 3 }} className="truncate">{item.label}</p>
              <p style={{ ...sans, fontSize: '0.64rem', color: '#a89890' }} className="truncate">{item.note}</p>
            </div>
            <ArrowUpRight size={14} style={{ color: '#c9b9b0', flexShrink: 0 }} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── ComplianceOverview ────────────────────────────────────────────────────
// (kept as a compact secondary view — the big picture now lives in the seal above)

function ComplianceOverview({ loading, submitted, missing, late, total }) {
  const rate = total > 0 ? Math.round((submitted / total) * 100) : 0;

  return (
    <div className="rounded-xl p-5" style={{ background: '#fff', border: `1px solid ${RULE}` }}>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={14} style={{ color: MAROON }} />
        <h2 style={{ ...sans, fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: INK }}>Compliance Breakdown</h2>
      </div>
      {loading ? (
        <div className="space-y-3">
          <SkeletonBox h={14} /><SkeletonBox h={14} /><SkeletonBox h={14} />
        </div>
      ) : (
        <>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span style={{ ...sans, fontSize: '0.74rem', fontWeight: 700, color: '#6b6058' }}>Overall Compliance</span>
              <span style={{ ...mono, fontSize: '0.78rem', fontWeight: 800, color: MAROON }}>{rate}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: RULE }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${rate}%`, background: MAROON }} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Submitted', value: submitted, color: SAGE },
              { label: 'Missing', value: missing, color: CLAY },
              { label: 'Late', value: late, color: AMBER },
            ].map(s => (
              <div key={s.label} className="rounded-lg p-3 text-center" style={{ background: `${s.color}12` }}>
                <p style={{ ...serif, fontSize: '1.15rem', fontWeight: 700, color: s.color }}>{s.value}</p>
                <p style={{ ...sans, fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: s.color }}>{s.label}</p>
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
    <div className="rounded-xl p-5" style={{ background: '#fff', border: `1px solid ${RULE}` }}>
      <div className="flex items-center gap-2 mb-4">
        <Calendar size={14} style={{ color: MAROON }} />
        <h2 style={{ ...sans, fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: INK }}>Upcoming Deadlines</h2>
      </div>
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map(i => <SkeletonBox key={i} h={44} radius={10} />)}
        </div>
      ) : deadlines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Calendar size={26} style={{ color: '#e9d9dc' }} className="mb-2" />
          <p style={{ ...sans, fontSize: '0.76rem', color: '#a89890' }}>No upcoming deadlines</p>
        </div>
      ) : (
        <div className="space-y-2">
          {deadlines.slice(0, 5).map((d, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-[#faf6ee]" style={{ background: PAPER }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: ROSE, color: MAROON }}>
                <Calendar size={13} />
              </div>
              <div className="min-w-0">
                <p style={{ ...sans, fontSize: '0.76rem', fontWeight: 700, color: INK }} className="truncate">{d.title || d.name}</p>
                <p style={{ ...mono, fontSize: '0.66rem', color: '#a89890' }}>{d.date || d.due_date}</p>
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
    <div className="rounded-xl p-5" style={{ background: '#fff', border: `1px solid ${RULE}` }}>
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle size={14} style={{ color: CLAY }} />
        <h2 style={{ ...sans, fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: INK }}>Flagged Scholars</h2>
        {!loading && flagged.length > 0 && (
          <span className="ml-auto rounded-full px-2 py-0.5" style={{ background: `${CLAY}16`, color: CLAY, ...sans, fontSize: '0.62rem', fontWeight: 800 }}>{flagged.length}</span>
        )}
      </div>
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map(i => <SkeletonBox key={i} h={44} radius={10} />)}
        </div>
      ) : flagged.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CheckCircle size={26} style={{ color: `${SAGE}55` }} className="mb-2" />
          <p style={{ ...sans, fontSize: '0.76rem', color: '#a89890' }}>No flagged scholars</p>
        </div>
      ) : (
        <div className="space-y-2">
          {flagged.slice(0, 5).map((s, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:opacity-90" style={{ background: `${CLAY}0d` }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${CLAY}18` }}>
                <span style={{ ...sans, fontSize: '0.66rem', fontWeight: 800, color: CLAY }}>
                  {(s.name || s.scholar_name || '?').split(' ').map(n => n[0]).slice(0, 2).join('')}
                </span>
              </div>
              <div className="min-w-0">
                <p style={{ ...sans, fontSize: '0.76rem', fontWeight: 700, color: INK }} className="truncate">{s.name || s.scholar_name}</p>
                <p style={{ ...sans, fontSize: '0.66rem', fontWeight: 700, color: CLAY }} className="truncate">{s.reason || s.flag_reason || 'Compliance issue'}</p>
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
    <div className="rounded-xl p-5" style={{ background: '#fff', border: `1px solid ${RULE}` }}>
      <div className="flex items-center gap-2 mb-4">
        <Activity size={14} style={{ color: MAROON }} />
        <h2 style={{ ...sans, fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: INK }}>Recent Activities</h2>
      </div>
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3, 4].map(i => <SkeletonBox key={i} h={36} radius={10} />)}
        </div>
      ) : activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Activity size={26} style={{ color: '#e9d9dc' }} className="mb-2" />
          <p style={{ ...sans, fontSize: '0.76rem', color: '#a89890' }}>No recent activities</p>
        </div>
      ) : (
        <div className="space-y-1">
          {activities.slice(0, 6).map((a, i) => (
            <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg transition-colors hover:bg-[#faf6ee]">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: GOLD, marginTop: 6 }} />
              <div className="min-w-0">
                <p style={{ ...sans, fontSize: '0.76rem', fontWeight: 600, color: '#4b3f38', lineHeight: 1.4 }}>{a.description || a.action}</p>
                <p style={{ ...mono, fontSize: '0.64rem', color: '#c9b9b0', marginTop: 2 }}>{a.created_at || a.date}</p>
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
    { label: 'Manual Validation', icon: FileCheck, path: '/officer/validation', color: MAROON },
    { label: 'Flagged Scholars', icon: ShieldAlert, path: '/officer/flagged', color: CLAY },
    { label: 'Correspondence', icon: Mail, path: '/officer/correspondence-review', color: AMBER },
    { label: 'Reports', icon: BarChart3, path: '/officer/reports', color: GOLD },
    { label: 'Summary Report', icon: FileText, path: '/officer/summary-report', color: SAGE },
  ];

  return (
    <div className="rounded-xl p-5" style={{ background: '#fff', border: `1px solid ${RULE}` }}>
      <div className="flex items-center gap-2 mb-4">
        <Zap size={14} style={{ color: MAROON }} />
        <h2 style={{ ...sans, fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: INK }}>Quick Actions</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {actions.map((a) => (
          <button key={a.path} onClick={() => navigate(a.path)}
            className="flex flex-col items-center gap-2 p-4 rounded-lg text-center transition-colors hover:bg-[#faf6ee] group"
            style={{ border: `1px solid ${RULE}`, background: '#fff', cursor: 'pointer' }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: `${a.color}14`, color: a.color }}>
              <a.icon size={18} />
            </div>
            <span style={{ ...sans, fontSize: '0.7rem', fontWeight: 700, color: '#6b6058', lineHeight: 1.2 }}>{a.label}</span>
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
  const navigate = useNavigate();

  const [submissions, setSubmissions] = useState([]);
  const [scholars, setScholars] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [activities, setActivities] = useState([]);
  const [flagged, setFlagged] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [subRes, scholarsRes, deadlinesRes, activitiesRes, flaggedRes, announcementsRes] =
          await Promise.allSettled([
            axios.get('http://localhost:5000/api/submission/all', { headers: authHeader() }),
            axios.get('http://localhost:5000/api/staff/pending', { headers: authHeader() }),
            axios.get('http://localhost:5000/api/staff/deadlines', { headers: authHeader() }),
            axios.get('http://localhost:5000/api/staff/reports/activities', { headers: authHeader() }),
            axios.get('http://localhost:5000/api/flagged/scholars', { headers: authHeader() }),
            axios.get('http://localhost:5000/api/officer/announcements', { headers: authHeader() }),
          ]);

        if (subRes.status === 'fulfilled') setSubmissions(subRes.value.data);
        if (scholarsRes.status === 'fulfilled') setScholars(scholarsRes.value.data);
        if (deadlinesRes.status === 'fulfilled') setDeadlines(deadlinesRes.value.data);
        if (activitiesRes.status === 'fulfilled') setActivities(activitiesRes.value.data);
        if (flaggedRes.status === 'fulfilled') setFlagged(flaggedRes.value.data);
        if (announcementsRes.status === 'fulfilled') setAnnouncements(announcementsRes.value.data || []);
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
  const approved = submissions.filter(s => s.status === 'approved').length;
  const rejected = submissions.filter(s => s.status === 'rejected').length;
  const active = scholars.filter(s => s.status === 'active').length;
  const submitted = approved;
  const missing = Math.max(0, scholars.length - submitted);
  const late = submissions.filter(s => s.is_late).length;
  const complianceRate = scholars.length > 0 ? Math.round((submitted / scholars.length) * 100) : 0;

  return (
    <div className="min-h-screen" style={{ background: IVORY, ...sans }}>

      {/* ── Ledger header band — same family as the rest of the portal ── */}
      <div className="relative px-5 sm:px-8 pt-8 pb-11" style={{ background: `linear-gradient(135deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)` }}>
        {/* Decorative pattern clipped in its own layer — must NOT wrap the
            notification bell below, or its dropdown gets clipped too. */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <svg className="absolute -right-6 -top-10 w-56 h-56 opacity-[0.12]" viewBox="0 0 200 200" fill="none">
            <rect x="30" y="30" width="140" height="140" rx="14" fill="none" stroke={GOLD} strokeWidth="6" />
            <rect x="55" y="55" width="90" height="90" rx="8" fill="none" stroke={GOLD} strokeWidth="6" />
          </svg>
        </div>
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ border: `1.5px solid ${GOLD}` }}>
                <LayoutDashboard size={12} style={{ color: GOLD }} />
              </div>
              <span style={{ ...sans, fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.28em', textTransform: 'uppercase', color: GOLD_LIGHT }}>Officer Portal</span>
            </div>
            <p style={{ ...mono, fontSize: '0.72rem', color: '#e9c9a8' }}>
              {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <h1 style={{ ...serif, fontSize: '1.9rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em', marginTop: 4 }}>
              Welcome back, {name || 'Officer'}
            </h1>
            {lastUpdated && (
              <p style={{ ...sans, fontSize: '0.7rem', color: '#d9b8a0', marginTop: 6 }}>
                Updated {lastUpdated.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <OfficerNotifications loading={loading} pending={pending} flagged={flagged} deadlines={deadlines} announcements={announcements} onNavigate={navigate} />
          </div>
        </div>
      </div>

      <div className="relative z-10 px-5 sm:px-8 -mt-6 pb-10">

        {/* Hero — compliance seal */}
        <div className="mb-4">
          <ComplianceSeal loading={loading} rate={complianceRate} submitted={submitted} missing={missing} late={late} />
        </div>

        <StatisticsCards
          loading={loading}
          totalScholars={scholars.length}
          pending={pending}
          approved={approved}
          rejected={rejected}
          active={active}
        />

        <NeedsAttention
          loading={loading}
          pending={pending}
          flagged={flagged}
          deadlines={deadlines}
          onNavigate={path => navigate(path)}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <ComplianceOverview loading={loading} submitted={submitted} missing={missing} late={late} total={scholars.length} />
          <UpcomingDeadlines loading={loading} deadlines={deadlines} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <FlaggedScholarCard loading={loading} flagged={flagged} />
          <RecentActivities loading={loading} activities={activities} />
        </div>

        <QuickActions />

      </div>
    </div>
  );
};

export default OfficerDashboard;