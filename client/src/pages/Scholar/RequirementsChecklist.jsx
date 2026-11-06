import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { buildScholarChecklist } from '../../utils/scholarChecklist';
import {
  AlertTriangle, Sparkles, Inbox,
  ClipboardList, CheckCircle2, XCircle, Circle, Clock3,
  UserRound, ArrowUpRight, PartyPopper, Lock, CalendarDays,
} from 'lucide-react';

const RAW_API_BASE = (import.meta.env?.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API_BASE = RAW_API_BASE.endsWith('/api') ? RAW_API_BASE : `${RAW_API_BASE}/api`;
const SUBMISSION_API = `${API_BASE}/submission`;

// ── Scholar Portal design system ──
// Same tokens as the rest of the Scholar module (dashboard, duty &
// participation, etc.) so this page reads as one continuous workspace.
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const PRIMARY = '#6D2140';
const PRIMARY_DARK = '#4A1730';
const BRONZE = '#A9784E';
const SUCCESS = '#6B8F71';
const WARNING = '#C08A3E';
const DANGER = '#C0473F';
const INK = '#241512';
const MUTED = '#8A7A68';
const RADIUS = 18;

const display = { fontFamily: "'Playfair Display', Georgia, serif" };
const body = { fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif" };

const cardShadow = '0 1px 2px rgba(36,21,18,0.03), 0 6px 20px rgba(36,21,18,0.04)';

const authHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Matches TaskAssignmentBoard.jsx's STATUS_BADGE styling/labels so the
// scholar's checklist and the officer's task board tell the same story.
const badgeForStatus = (status) => {
  if (status === 'approved') return { text: 'Accepted', color: SUCCESS };
  if (status === 'submitted') return { text: 'Pending Review', color: WARNING };
  if (status === 'rejected') return { text: 'Returned for Revision', color: DANGER };
  if (status === 'completed') return { text: 'Completed', color: SUCCESS };
  if (status === 'closed') return { text: 'Closed', color: DANGER };
  if (status === 'missed' || status === 'missing') return { text: status === 'missing' ? 'Missing' : 'Missed', color: DANGER };
  if (status === 'pending_review') return { text: 'Pending Review', color: WARNING };
  return { text: 'Pending', color: WARNING };
};

// Icon that pairs with badgeForStatus's color, for the task card's status glyph.
const getStatusIcon = (status) => {
  if (status === 'approved' || status === 'completed') return { Icon: CheckCircle2, color: SUCCESS };
  if (status === 'closed') return { Icon: Lock, color: DANGER };
  if (status === 'rejected' || status === 'missed' || status === 'missing') return { Icon: XCircle, color: DANGER };
  if (status === 'submitted' || status === 'pending_review') return { Icon: Clock3, color: WARNING };
  return { Icon: Circle, color: MUTED };
};

const formatDate = (value) => {
  if (!value) return 'TBA';
  try {
    return new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return value;
  }
};

// Per-tab empty states (UI only).
const EMPTY_STATES = {
  pending:   { Icon: PartyPopper,  color: SUCCESS, title: "You're all caught up!",   text: 'No pending requirements at the moment.' },
  completed: { Icon: CheckCircle2, color: SUCCESS, title: 'No completed tasks yet',  text: 'Accepted duties and tasks will show up here.' },
  closed:    { Icon: Lock,         color: MUTED,   title: 'No closed tasks',         text: 'Tasks that are past their closing date will be listed here.' },
  missed:    { Icon: Sparkles,     color: BRONZE,  title: 'Nothing missed',          text: 'Great job — no task has slipped through.' },
};

// ─── Empty state (icon composition, kept small) ──────────────────────────
const EmptyState = ({ Icon, color, title, text }) => (
  <div className="text-center" style={{ border: `1px dashed ${BORDER}`, background: SURFACE, borderRadius: RADIUS, padding: '44px 20px' }}>
    <div className="mx-auto flex items-center justify-center" style={{ width: 68, height: 68, borderRadius: '50%', background: `${color}0f`, marginBottom: 14 }}>
      <div className="flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: 14, background: `${color}1c`, border: `1px solid ${color}30` }}>
        <Icon size={20} style={{ color }} />
      </div>
    </div>
    <p style={{ ...display, fontSize: '1.05rem', fontWeight: 600, color: INK }}>{title}</p>
    <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginTop: 4 }}>{text}</p>
  </div>
);

// ─── KPI card ─────────────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, description, accent = PRIMARY }) => (
  <div className="rc-kpi min-w-0" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '18px 20px', boxShadow: cardShadow }}>
    <div className="flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: 11, background: `${accent}14`, border: `1px solid ${accent}22` }}>
      <Icon size={17} style={{ color: accent }} />
    </div>
    <p style={{ ...display, fontVariantNumeric: 'tabular-nums', fontSize: '2rem', fontWeight: 600, color: INK, marginTop: 14, lineHeight: 1 }}>{value}</p>
    <p style={{ ...body, fontSize: '0.8rem', fontWeight: 600, color: INK, marginTop: 8 }}>{label}</p>
    <p style={{ ...body, fontSize: '0.72rem', color: MUTED, marginTop: 2 }}>{description}</p>
  </div>
);

const KpiSkeleton = () => (
  <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '18px 20px' }}>
    <div className="animate-pulse" style={{ width: 36, height: 36, borderRadius: 11, background: `${BORDER}99` }} />
    <div className="animate-pulse" style={{ width: 48, height: 26, borderRadius: 8, background: `${BORDER}99`, marginTop: 14 }} />
    <div className="animate-pulse" style={{ width: '60%', height: 10, borderRadius: 999, background: `${BORDER}99`, marginTop: 12 }} />
    <div className="animate-pulse" style={{ width: '40%', height: 8, borderRadius: 999, background: `${BORDER}66`, marginTop: 8 }} />
  </div>
);

const TaskSkeleton = () => (
  <div className="flex items-start gap-4" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '20px 22px' }}>
    <div className="animate-pulse flex-shrink-0" style={{ width: 40, height: 40, borderRadius: 12, background: `${BORDER}99` }} />
    <div className="flex-1 min-w-0">
      <div className="animate-pulse" style={{ width: '22%', height: 8, borderRadius: 999, background: `${BORDER}66` }} />
      <div className="animate-pulse" style={{ width: '55%', height: 14, borderRadius: 8, background: `${BORDER}99`, marginTop: 10 }} />
      <div className="animate-pulse" style={{ width: '80%', height: 9, borderRadius: 999, background: `${BORDER}66`, marginTop: 10 }} />
    </div>
    <div className="animate-pulse hidden sm:block flex-shrink-0" style={{ width: 96, height: 24, borderRadius: 999, background: `${BORDER}99` }} />
  </div>
);

const RequirementsChecklist = () => {
  const navigate = useNavigate();
  const scholarId = localStorage.getItem('scholar_id');
  const [activeTab, setActiveTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [duties, setDuties] = useState([]);
  const [history, setHistory] = useState([]);
  const [gradesHistory, setGradesHistory] = useState([]);
  const [portalTasks, setPortalTasks] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!scholarId) {
        setError('Scholar ID not found. Please log in again.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const [dutiesRes, historyRes, gradesRes] = await Promise.allSettled([
          axios.get(`${API_BASE}/scholar/my-duties`, { headers: authHeader() }),
          axios.get(`${SUBMISSION_API}/history/${scholarId}`, { headers: authHeader() }),
          axios.get(`${SUBMISSION_API}/grades/${scholarId}`, { headers: authHeader() }),
        ]);

        if (dutiesRes.status === 'fulfilled') {
          setDuties(dutiesRes.value.data || []);
        } else {
          console.error('Failed to load duties', dutiesRes.reason);
          setDuties([]);
        }

        if (historyRes.status === 'fulfilled') {
          setHistory(historyRes.value.data || []);
        } else {
          console.error('Failed to load submission history', historyRes.reason);
          setHistory([]);
        }

        if (gradesRes.status === 'fulfilled') {
          setGradesHistory(gradesRes.value.data || []);
        } else {
          console.error('Failed to load grades history', gradesRes.reason);
          setGradesHistory([]);
        }

        // Load portal tasks from backend (admin/officer created tasks)
        try {
          const tasksRes = await axios.get(`${API_BASE}/tasks`, { headers: authHeader() });
          setPortalTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
        } catch (tErr) {
          console.error('Failed to load portal tasks', tErr);
          setPortalTasks([]);
        }
      } catch (err) {
        console.error('Task page load error', err);
        setError('Unable to load your tasks and checklist. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [scholarId]);

  const checklistItems = buildScholarChecklist({ duties, history, grades: gradesHistory, tasks: portalTasks });
  const dutyTasks = checklistItems.filter((task) => task.id.startsWith('duty-'));
  const mappedPortalTasks = checklistItems.filter((task) => task.id.startsWith('portal-'));

  const pendingTasks = [
    ...dutyTasks.filter((task) => task.status !== 'completed' && task.status !== 'missed'),
    ...mappedPortalTasks.filter((task) => !task.done && !['closed', 'missing', 'missed'].includes(task.status)),
  ];

  const closedTasks = mappedPortalTasks.filter((task) => task.status === 'closed');

  const missedTasks = [
    ...dutyTasks.filter((task) => task.status === 'missed'),
    ...mappedPortalTasks.filter((task) => task.status === 'missing' || task.status === 'missed'),
  ];

  const completedTasks = [
    ...dutyTasks.filter((task) => task.status === 'completed'),
    ...mappedPortalTasks.filter((task) => task.done || task.status === 'completed'),
  ];

  const showNoTasks = !pendingTasks.length && !closedTasks.length && !missedTasks.length && !completedTasks.length;

  const pendingDutyCount = duties.filter((d) => d.computed_status === 'pending').length;
  const missedDutyCount = duties.filter((d) => d.computed_status === 'missed').length;

  const handleNavigate = (route) => {
    navigate(route);
  };

  const activeList = activeTab === 'pending' ? pendingTasks
    : activeTab === 'closed' ? closedTasks
      : activeTab === 'missed' ? missedTasks : completedTasks;

  const segments = [
    { key: 'pending', label: 'Pending', count: pendingTasks.length },
    { key: 'completed', label: 'Completed', count: completedTasks.length },
    { key: 'closed', label: 'Closed', count: closedTasks.length },
    { key: 'missed', label: 'Missed', count: missedTasks.length },
  ];

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden" style={{ ...body, background: BG, minHeight: '100vh' }}>
      <style>{`
        .rc-kpi { transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
        .rc-kpi:hover { transform: translateY(-2px); border-color: #d8c4ad; box-shadow: 0 2px 4px rgba(36,21,18,0.04), 0 12px 28px rgba(36,21,18,0.07); }
        .rc-task { transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
        .rc-task:hover { border-color: #d8c4ad; box-shadow: 0 2px 4px rgba(36,21,18,0.04), 0 12px 28px rgba(36,21,18,0.07); }
        .rc-tab { transition: background .2s ease, color .2s ease, box-shadow .2s ease; }
        .rc-tab:not(.is-active):hover { background: #F3ECE0; }
        .rc-open { transition: background .15s ease, transform .1s ease; }
        .rc-open:hover { background: ${PRIMARY_DARK} !important; }
        .rc-open:active { transform: scale(0.98); }
      `}</style>

      <div className="w-full min-w-0 px-4 sm:px-6 lg:p-8">

        {/* ── Personal header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '22px 26px', marginBottom: 20 }}>
          <div>
            <p style={{ ...body, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: BRONZE }}>SCHOLAR PORTAL</p>
            <h1 style={{ ...display, fontSize: '1.7rem', fontWeight: 600, color: INK, marginTop: 4 }}>My Tasks &amp; Compliance</h1>
            <p style={{ ...body, fontSize: '0.84rem', color: MUTED, marginTop: 6, maxWidth: 480 }}>
              Complete assigned requirements, submit documents, and monitor your compliance progress.
            </p>
          </div>
          <span style={{ ...body, fontSize: '0.76rem', fontWeight: 600, color: PRIMARY, background: `${PRIMARY}12`, border: `1px solid ${BORDER}`, borderRadius: 999, padding: '7px 16px', flexShrink: 0 }}>
            1st Semester, AY 2026–2027
          </span>
        </div>

        {loading ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <TaskSkeleton key={i} />)}
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-5 flex items-start gap-3" style={{ padding: '14px 18px', borderRadius: RADIUS, background: `${DANGER}0d`, color: DANGER, ...body, fontSize: '0.84rem', fontWeight: 600, border: `1px solid ${DANGER}33` }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span className="min-w-0">{error}</span>
              </div>
            )}

            {/* ── Compliance overview: KPI cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" style={{ marginBottom: 20 }}>
              <KpiCard icon={ClipboardList} label="Assigned Tasks" value={mappedPortalTasks.length} description="from Officer/Admin" accent={PRIMARY} />
              <KpiCard icon={CheckCircle2} label="Completed" value={completedTasks.length} description="duties + tasks accepted" accent={SUCCESS} />
              <KpiCard icon={Clock3} label="Pending" value={pendingTasks.length} description={`${pendingDutyCount} duties awaiting`} accent={WARNING} />
              <KpiCard icon={XCircle} label="Missed" value={missedTasks.length} description={`${missedDutyCount} duties missed`} accent={DANGER} />
            </div>

            {/* ── Task filter: segmented control ── */}
            <div
              className="grid grid-cols-2 sm:grid-cols-4 gap-1 w-full"
              style={{ background: '#F1EADD', border: `1px solid ${BORDER}`, borderRadius: 16, padding: 4, marginBottom: 16 }}
            >
              {segments.map((seg) => {
                const isActive = activeTab === seg.key;
                return (
                  <button
                    key={seg.key}
                    onClick={() => setActiveTab(seg.key)}
                    className={`rc-tab flex items-center justify-center gap-2 ${isActive ? 'is-active' : ''}`}
                    style={{
                      ...body, fontSize: '0.8rem', fontWeight: 600, borderRadius: 12,
                      padding: '9px 16px', cursor: 'pointer', border: 'none',
                      background: isActive ? PRIMARY : 'transparent',
                      color: isActive ? '#fff' : INK,
                      boxShadow: isActive ? '0 4px 12px rgba(109,33,64,0.25)' : 'none',
                    }}
                  >
                    {seg.label}
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                      minWidth: 20, textAlign: 'center', borderRadius: 999, padding: '1px 7px',
                      background: isActive ? 'rgba(255,255,255,0.2)' : `${PRIMARY}12`,
                      color: isActive ? '#fff' : PRIMARY,
                    }}>
                      {seg.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ── Task registry ── */}
            {showNoTasks ? (
              <EmptyState
                Icon={Inbox}
                color={BRONZE}
                title="No tasks found yet"
                text="Check back once your Officer/Admin assigns a duty or task."
              />
            ) : activeList.length === 0 ? (
              <EmptyState {...EMPTY_STATES[activeTab]} />
            ) : (
              <div className="space-y-3">
                {activeList.map((task) => {
                  const badge = badgeForStatus(task.status);
                  const { Icon: StatusIcon, color: statusColor } = getStatusIcon(task.status);
                  const showOpen = task.route && !task.done && task.status !== 'completed' && (
                    (!['closed', 'missed', 'missing'].includes(task.status)) || task.type === 'Duty Participation'
                  );
                  return (
                    <div
                      key={task.id}
                      className="rc-task min-w-0"
                      style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '20px 22px', boxShadow: cardShadow }}
                    >
                      <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-6">

                        {/* Left: status icon + type label */}
                        <div className="flex md:flex-col items-center md:items-start gap-3 md:gap-2 md:w-[104px] flex-shrink-0">
                          <div className="flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, borderRadius: 12, background: `${statusColor}14`, border: `1px solid ${statusColor}26` }}>
                            <StatusIcon size={18} style={{ color: statusColor }} />
                          </div>
                          <p style={{ ...body, fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.06em', color: MUTED, lineHeight: 1.3 }}>
                            {task.type.toUpperCase()}
                          </p>
                        </div>

                        {/* Center: title, description, feedback, creator */}
                        <div className="flex-1 min-w-0">
                          <h4 style={{ ...display, fontSize: '1.08rem', fontWeight: 600, color: INK, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{task.title}</h4>
                          {task.description && (
                            <p style={{ ...body, fontSize: '0.82rem', color: MUTED, marginTop: 5, lineHeight: 1.55, overflowWrap: 'anywhere' }}>{task.description}</p>
                          )}
                          {task.staffComment && (
                            <p style={{ marginTop: 12, ...body, fontSize: '0.78rem', lineHeight: 1.5, color: DANGER, background: `${DANGER}0d`, border: `1px solid ${DANGER}22`, padding: '9px 13px', borderRadius: 12, overflowWrap: 'anywhere' }}>
                              <span style={{ fontWeight: 700 }}>Officer feedback:</span> {task.staffComment}
                            </p>
                          )}
                          {task.createdByName && (
                            <p className="flex items-center gap-1.5" style={{ ...body, fontSize: '0.74rem', color: MUTED, marginTop: 10 }}>
                              <UserRound size={12} style={{ flexShrink: 0 }} />
                              <span className="min-w-0" style={{ overflowWrap: 'anywhere' }}>
                                {task.createdByName}{task.createdByRole ? ` (${task.createdByRole})` : ''}
                              </span>
                            </p>
                          )}
                        </div>

                        {/* Right: badge, due date, action */}
                        <div
                          className="flex flex-row flex-wrap md:flex-col items-center md:items-end justify-between md:justify-start gap-2.5 md:gap-2 pt-4 md:pt-0 border-t md:border-t-0 md:w-[176px] flex-shrink-0"
                          style={{ borderColor: BORDER }}
                        >
                          <span style={{ ...body, fontSize: '0.74rem', fontWeight: 600, color: badge.color, background: `${badge.color}14`, border: `1px solid ${badge.color}30`, borderRadius: 999, padding: '4px 12px', whiteSpace: 'nowrap' }}>
                            {badge.text}
                          </span>
                          {task.dueDate && (
                            <p className="flex items-center gap-1.5" style={{ ...body, fontSize: '0.74rem', color: MUTED }}>
                              <CalendarDays size={12} style={{ flexShrink: 0 }} />
                              Due {formatDate(task.dueDate)}
                            </p>
                          )}
                          {showOpen && (
                            <button
                              onClick={() => handleNavigate(task.route)}
                              className="rc-open flex items-center justify-center gap-1.5 w-full md:w-auto"
                              style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: '#fff', background: PRIMARY, border: 'none', borderRadius: 10, padding: '9px 16px', cursor: 'pointer', marginTop: 2, boxShadow: '0 4px 12px rgba(109,33,64,0.22)' }}
                            >
                              Open Task
                              <ArrowUpRight size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default RequirementsChecklist;