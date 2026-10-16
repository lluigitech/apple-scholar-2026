import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { buildScholarChecklist } from '../../utils/scholarChecklist';
import {
  Calendar, Check, X as XIcon, Clock3, FileWarning,
  ClipboardList, CheckCircle2, XCircle, Circle,
  UserRound, ArrowUpRight, PartyPopper,
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
  if (status === 'missed' || status === 'missing') return { text: status === 'missing' ? 'Missing' : 'Missed', color: DANGER };
  if (status === 'pending_review') return { text: 'Pending Review', color: WARNING };
  return { text: 'Pending', color: WARNING };
};

// Icon that pairs with badgeForStatus's color, for the task card's status glyph.
const getStatusIcon = (status) => {
  if (status === 'approved' || status === 'completed') return { Icon: CheckCircle2, color: SUCCESS };
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

// ─── KPI card ─────────────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, description, accent = PRIMARY }) => (
  <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '18px 20px' }}>
    <div className="flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: 10, background: `${accent}14` }}>
      <Icon size={16} style={{ color: accent }} />
    </div>
    <p style={{ ...display, fontSize: '1.7rem', fontWeight: 600, color: INK, marginTop: 14 }}>{value}</p>
    <p style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: INK, marginTop: 2 }}>{label}</p>
    <p style={{ ...body, fontSize: '0.72rem', color: MUTED, marginTop: 2 }}>{description}</p>
  </div>
);

const KpiSkeleton = () => <div className="animate-pulse" style={{ background: `${BORDER}88`, height: 112, borderRadius: RADIUS }} />;
const TaskSkeleton = () => <div className="animate-pulse" style={{ background: `${BORDER}88`, height: 96, borderRadius: RADIUS }} />;

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
    ...mappedPortalTasks.filter((task) => !task.done && task.status !== 'missing' && task.status !== 'missed'),
  ];

  const missedTasks = [
    ...dutyTasks.filter((task) => task.status === 'missed'),
    ...mappedPortalTasks.filter((task) => task.status === 'missing' || task.status === 'missed'),
  ];

  const completedTasks = [
    ...dutyTasks.filter((task) => task.status === 'completed'),
    ...mappedPortalTasks.filter((task) => task.done || task.status === 'completed'),
  ];

  const showNoTasks = !pendingTasks.length && !missedTasks.length && !completedTasks.length;

  const pendingDutyCount = duties.filter((d) => d.computed_status === 'pending').length;
  const missedDutyCount = duties.filter((d) => d.computed_status === 'missed').length;

  const handleNavigate = (route) => {
    navigate(route);
  };

  const activeList = activeTab === 'pending' ? pendingTasks : activeTab === 'missed' ? missedTasks : completedTasks;

  const segments = [
    { key: 'pending', label: 'Pending', count: pendingTasks.length },
    { key: 'completed', label: 'Completed', count: completedTasks.length },
    { key: 'missed', label: 'Missed', count: missedTasks.length },
  ];

  return (
    <div style={{ ...body, background: BG, minHeight: '100vh' }}>
      <div className="w-full px-4 sm:px-6 lg:p-8">

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

        <div className="flex items-center gap-2 flex-wrap" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '10px 14px', marginBottom: 20 }}>
          <span style={{ ...body, fontSize: '0.72rem', fontWeight: 700, color: INK, marginRight: 4 }}>Status guide:</span>
          {[
            ['Pending', WARNING],
            ['Pending Review', WARNING],
            ['Completed', SUCCESS],
            ['Returned for Revision', DANGER],
          ].map(([label, color]) => (
            <span key={label} style={{ ...body, fontSize: '0.7rem', fontWeight: 600, color, background: `${color}14`, border: `1px solid ${color}30`, borderRadius: 999, padding: '5px 10px' }}>{label}</span>
          ))}
        </div>

        {loading ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <TaskSkeleton key={i} />)}
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-5" style={{ padding: '14px 18px', borderRadius: RADIUS, background: `${DANGER}0d`, color: DANGER, ...body, fontSize: '0.84rem', fontWeight: 600, border: `1px solid ${DANGER}33` }}>
                {error}
              </div>
            )}

            {/* ── Compliance overview: KPI cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" style={{ marginBottom: 20 }}>
              <KpiCard icon={ClipboardList} label="Assigned Tasks" value={mappedPortalTasks.length} description="from Officer/Admin" accent={PRIMARY} />
              <KpiCard icon={CheckCircle2} label="Completed" value={completedTasks.length} description="duties + tasks accepted" accent={SUCCESS} />
              <KpiCard icon={Clock3} label="Pending" value={pendingTasks.length} description={`${pendingDutyCount} duties awaiting`} accent={WARNING} />
              <KpiCard icon={XCircle} label="Missed" value={missedTasks.length} description={`${missedDutyCount} duties missed`} accent={DANGER} />
            </div>

            {/* ── Task filter: segmented control ── */}
            <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 16 }}>
              {segments.map((seg) => {
                const isActive = activeTab === seg.key;
                return (
                  <button
                    key={seg.key}
                    onClick={() => setActiveTab(seg.key)}
                    style={{
                      ...body, fontSize: '0.8rem', fontWeight: 600, borderRadius: 999,
                      padding: '9px 18px', cursor: 'pointer',
                      border: `1px solid ${isActive ? PRIMARY : BORDER}`,
                      background: isActive ? PRIMARY : SURFACE,
                      color: isActive ? '#fff' : INK,
                      transition: 'background 0.15s ease',
                    }}
                  >
                    {seg.label} ({seg.count})
                  </button>
                );
              })}
            </div>

            {/* ── Task registry ── */}
            {showNoTasks ? (
              <div className="text-center" style={{ border: `1px dashed ${BORDER}`, background: SURFACE, borderRadius: RADIUS, padding: '64px 20px' }}>
                <div className="mx-auto flex items-center justify-center" style={{ width: 52, height: 52, borderRadius: 16, background: `${BRONZE}14`, marginBottom: 16 }}>
                  <FileWarning size={22} style={{ color: BRONZE }} />
                </div>
                <p style={{ ...display, fontSize: '1.05rem', fontWeight: 600, color: INK }}>No tasks found yet</p>
                <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginTop: 4 }}>Check back once your Officer/Admin assigns a duty or task.</p>
              </div>
            ) : activeList.length === 0 ? (
              <div className="text-center" style={{ border: `1px dashed ${BORDER}`, background: SURFACE, borderRadius: RADIUS, padding: '56px 20px' }}>
                <div className="mx-auto flex items-center justify-center" style={{ width: 52, height: 52, borderRadius: 16, background: `${SUCCESS}14`, marginBottom: 16 }}>
                  <PartyPopper size={22} style={{ color: SUCCESS }} />
                </div>
                <p style={{ ...display, fontSize: '1.05rem', fontWeight: 600, color: INK }}>You're all caught up!</p>
                <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginTop: 4 }}>No pending requirements at the moment.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeList.map((task) => {
                  const badge = badgeForStatus(task.status);
                  const { Icon: StatusIcon, color: statusColor } = getStatusIcon(task.status);
                  return (
                    <div key={task.id} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '18px 22px' }}>
                      <div className="flex items-start justify-between gap-5 flex-wrap">
                        <div className="flex items-start gap-3 flex-1 min-w-[220px]">
                          <div className="flex items-center justify-center flex-shrink-0" style={{ width: 34, height: 34, borderRadius: 10, background: `${statusColor}14`, marginTop: 2 }}>
                            <StatusIcon size={16} style={{ color: statusColor }} />
                          </div>
                          <div className="min-w-0">
                            <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', color: MUTED }}>{task.type.toUpperCase()}</p>
                            <h4 style={{ ...display, fontSize: '1.05rem', fontWeight: 600, color: INK, marginTop: 2 }}>{task.title}</h4>
                            {task.description && (
                              <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginTop: 4, lineHeight: 1.5 }}>{task.description}</p>
                            )}
                            {task.staffComment && (
                              <p style={{ marginTop: 10, ...body, fontSize: '0.78rem', color: DANGER, background: `${DANGER}0d`, border: `1px solid ${DANGER}22`, padding: '9px 13px', borderRadius: 12 }}>
                                Officer feedback: {task.staffComment}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <span style={{ ...body, fontSize: '0.76rem', fontWeight: 600, color: badge.color, background: `${badge.color}14`, borderRadius: 999, padding: '4px 12px' }}>
                            {badge.text}
                          </span>
                          {task.dueDate && (
                            <p style={{ ...body, fontSize: '0.74rem', color: MUTED }}>Due {formatDate(task.dueDate)}</p>
                          )}
                          {(task.createdByName) && (
                            <p className="flex items-center gap-1" style={{ ...body, fontSize: '0.74rem', color: MUTED }}>
                              <UserRound size={11} />
                              {task.createdByName}{task.createdByRole ? ` (${task.createdByRole})` : ''}
                            </p>
                          )}
                          {task.route && !task.done && task.status !== 'completed' && (
                            (task.status !== 'missed' && task.status !== 'missing') || task.type === 'Duty Participation'
                          ) && (
                            <button
                              onClick={() => handleNavigate(task.route)}
                              className="flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                              style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: '#fff', background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`, border: 'none', borderRadius: 10, padding: '8px 16px', cursor: 'pointer', marginTop: 2 }}
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