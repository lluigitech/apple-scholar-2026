import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Calendar, Check, X as XIcon, Clock3, FileWarning,
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';
const SUBMISSION_API = `${API_BASE}/submission`;

// ── Token system — shared with ScholarProfile / DutyParticipation ──
const MAROON = '#7f2d3a';
const MAROON_DEEP = '#4f1620';
const GOLD = '#b98b4e';
const IVORY = '#FBF7F2';
const INK = '#241512';

const authHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Matches TaskAssignmentBoard.jsx's STATUS_BADGE styling/labels so the
// scholar's checklist and the officer's task board tell the same story.
const badgeForStatus = (status) => {
  if (status === 'approved') return { text: 'Accepted', color: '#15803d', bg: '#EAF3EC' };
  if (status === 'submitted') return { text: 'Submitted', color: '#92400e', bg: '#FBF0DE' };
  if (status === 'rejected') return { text: 'Returned for Revision', color: '#991b1b', bg: '#FBE9E9' };
  if (status === 'completed') return { text: 'Completed', color: '#15803d', bg: '#EAF3EC' };
  if (status === 'missed') return { text: 'Missed', color: '#991b1b', bg: '#FBE9E9' };
  if (status === 'pending_review') return { text: 'Pending Review', color: '#92400e', bg: '#FBF0DE' };
  return { text: 'Pending', color: '#92400e', bg: '#FBF0DE' };
};

const formatDate = (value) => {
  if (!value) return 'TBA';
  try {
    return new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return value;
  }
};

// A portal task's "type" (e.g. "Monthly Report") maps to a specific
// submission_type row in the `submissions` table. Each type needs to be
// checked independently - otherwise submitting one type (e.g. COR) makes
// an already-submitted different type (e.g. Monthly Report) look "undone"
// again, since they'd both be judged off a single "latest submission overall".
const PORTAL_TYPE_TO_SUBMISSION_TYPE = {
  'Monthly Report': 'letter',
  'Report Card': 'report_card',
  'COR Upload': 'cor',
};

// Returns the most recent submission (by submitted_at) of a specific
// submission_type from the scholar's full history, or null if none exists.
const getLatestSubmissionOfType = (history, submissionType) => {
  const matches = (history || []).filter((h) => h.submission_type === submissionType);
  if (matches.length === 0) return null;
  return matches
    .slice()
    .sort((a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0))[0];
};

const getLatestGradeSubmission = (grades) => {
  if (!Array.isArray(grades)) return null;
  if (grades.length === 0) return null;
  return grades
    .slice()
    .sort((a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0))[0];
};

// ── The signature element: a checkmark that reads as a wax-seal / review
// stamp for approved items — this is a review-and-approve workflow, so the
// "stamped" idiom fits the subject rather than decorating it.
const SealCheckbox = ({ status }) => {
  if (status === 'completed' || status === 'approved') {
    return (
      <div
        className="relative w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: '#EAF3EC', border: '1.5px solid #15803d55' }}
      >
        <Check size={15} strokeWidth={3} style={{ color: '#15803d' }} />
      </div>
    );
  }
  if (status === 'rejected' || status === 'missed') {
    return (
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: '#FBE9E9', border: '1.5px solid #991b1b55' }}
      >
        <XIcon size={14} strokeWidth={3} style={{ color: '#991b1b' }} />
      </div>
    );
  }
  if (status === 'submitted' || status === 'pending_review') {
    return (
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: '#FBF0DE', border: '1.5px solid #92400e55' }}
      >
        <Clock3 size={14} style={{ color: '#92400e' }} />
      </div>
    );
  }
  return (
    <div
      className="w-8 h-8 rounded-full flex-shrink-0"
      style={{ border: `1.5px solid #d8c9c2` }}
    />
  );
};

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

  const dutyTasks = duties.map((d) => ({
    id: `duty-${d.id}`,
    title: d.title,
    type: 'Duty Participation',
    description: d.description || `Attend duty at ${d.location || 'assigned location'}`,
    Icon: Calendar,
    done: d.computed_status === 'completed',
    route: '/scholar/duties',
    status: d.computed_status,
    dueDate: d.duty_date,
    staffComment: null,
  }));

  // Map portal tasks fetched from backend into scholar-visible tasks.
  // These are the only tasks created by Officer/Admin/Staff.
  // "Completed" only when the scholar's latest submission FOR THAT SPECIFIC
  // TYPE has actually been Accepted by the officer - matches
  // TaskAssignmentBoard.jsx's isApprovedForScholar logic, so both pages agree.
  const mappedPortalTasks = Array.isArray(portalTasks)
    ? portalTasks
        .filter((t) => t && (t.source === 'manual' || (typeof t.id === 'number' || typeof t.id === 'string')))
        .map((t) => {
          const submissionType = PORTAL_TYPE_TO_SUBMISSION_TYPE[t.type];
          const latest = submissionType
            ? submissionType === 'report_card'
              ? getLatestGradeSubmission(gradesHistory)
              : getLatestSubmissionOfType(history, submissionType)
            : null;

          const rawStatus = latest?.status || null; // 'approved' | 'pending' | 'rejected' | null
          const done = rawStatus === 'approved';
          // 'submitted' means the scholar already uploaded something and is
          // waiting for officer review; it is distinct from 'pending' (not
          // submitted yet) and from 'completed' (approved by officer).
          const displayStatus = done
            ? 'completed'
            : rawStatus === 'rejected'
              ? 'rejected'
              : latest
                ? 'submitted'
                : 'pending';

          return {
            id: `portal-${t.id}`,
            title: t.title || 'Task',
            type: t.type || 'Task',
            description: t.instructions || '',
            Icon: null,
            done,
            route: t.route || '/scholar/submission',
            status: displayStatus,
            dueDate: t.due_date || null,
            staffComment: rawStatus === 'rejected' ? (latest?.staff_comment || null) : null,
          };
        })
    : [];

  const pendingTasks = [
    ...dutyTasks.filter((task) => task.status !== 'completed'),
    ...mappedPortalTasks.filter((task) => !task.done),
  ];

  const completedTasks = [
    ...dutyTasks.filter((task) => task.status === 'completed'),
    ...mappedPortalTasks.filter((task) => task.done),
  ];

  const showNoTasks = !pendingTasks.length && !completedTasks.length;

  const pendingDutyCount = duties.filter((d) => d.computed_status === 'pending').length;
  const missedDutyCount = duties.filter((d) => d.computed_status === 'missed').length;

  const handleNavigate = (route) => {
    navigate(route);
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

        <p className="relative text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.25em] mb-2" style={{ color: GOLD }}>
          Scholar Portal
        </p>
        <h1 className="relative text-2xl sm:text-3xl md:text-4xl font-bold text-white" style={serif}>My Tasks &amp; Checklist</h1>
        <p className="relative text-xs mt-2 max-w-md" style={{ color: '#e9c9a8' }}>
          See your assigned duties and tasks from your Officer/Admin, all in one place.
        </p>
      </div>

      <div className="px-4 sm:px-6 lg:p-8 lg:pt-0">

        {loading ? (
          <div className="relative -mt-8 sm:-mt-10 grid gap-4">
            <div className="h-20 rounded-2xl bg-white/70 animate-pulse" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-24 rounded-2xl bg-white/70 animate-pulse" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="relative -mt-8 sm:-mt-10 mb-6 p-4 rounded-2xl" style={{ background: '#FBE9E9', color: '#991b1b' }}>
                {error}
              </div>
            )}

            {/* ── Docket strip — floats over the hero, a filing-tab read ── */}
            <div
              className="relative -mt-8 sm:-mt-10 mb-8 sm:mb-10 rounded-2xl bg-white overflow-hidden"
              style={{ boxShadow: '0 12px 30px -12px rgba(79,22,32,0.25)' }}
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100">
                {[
                  { label: 'Assigned Tasks', value: mappedPortalTasks.length, note: 'from Officer/Admin' },
                  { label: 'Completed', value: completedTasks.length, note: 'duties + tasks accepted' },
                  { label: 'Pending Duties', value: pendingDutyCount, note: 'assigned this month' },
                  { label: 'Missed Duties', value: missedDutyCount, note: 'needs attention' },
                ].map((s) => (
                  <div key={s.label} className="p-4 sm:p-5">
                    <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400">{s.label}</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1.5" style={{ ...serif, color: MAROON }}>{s.value}</p>
                    <p className="text-[9px] sm:text-[10px] uppercase tracking-wider mt-1" style={{ color: '#c9b3b8' }}>{s.note}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Checklist ledger ─────────────────────────────── */}
            <section className="rounded-2xl bg-white p-5 sm:p-6 pb-8" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)' }}>
              <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
                <div>
                  <h2 className="text-lg font-bold" style={{ ...serif, color: INK }}>Tasks</h2>
                  <p className="text-xs text-slate-400 mt-1">Real duties and tasks assigned by your Officer/Admin.</p>
                </div>
                {/* underline tabs — quieter than a filled pill toggle */}
                <div className="flex items-center gap-5 border-b" style={{ borderColor: '#f0e6e0' }}>
                  {[
                    { key: 'pending', label: `Pending (${pendingTasks.length})` },
                    { key: 'completed', label: `Completed (${completedTasks.length})` },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className="pb-2.5 text-xs font-bold uppercase tracking-wider transition-colors"
                      style={{
                        color: activeTab === tab.key ? MAROON : '#c9b3b8',
                        borderBottom: activeTab === tab.key ? `2px solid ${MAROON}` : '2px solid transparent',
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {showNoTasks ? (
                <div className="rounded-2xl p-8 text-center" style={{ background: IVORY, color: '#c9b3b8' }}>
                  <FileWarning size={28} className="mx-auto mb-2" style={{ color: '#e9d9dc' }} />
                  No tasks found yet. Check back once your Officer/Admin assigns a duty or task.
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: '#f5eee9' }}>
                  {(activeTab === 'pending' ? pendingTasks : completedTasks).map((task) => {
                    const badge = badgeForStatus(task.status);
                    return (
                      <div key={task.id} className="flex items-start gap-4 py-4 sm:py-5 first:pt-0 last:pb-0">
                        <SealCheckbox status={task.status} />

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-sm" style={{ color: INK }}>{task.title}</p>
                              <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: '#c9a9b0' }}>{task.type}</p>
                            </div>
                            <span
                              className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full flex-shrink-0"
                              style={{ color: badge.color, background: badge.bg }}
                            >
                              {badge.text}
                            </span>
                          </div>
                          {task.description && (
                            <p className="text-xs text-slate-400 mt-2 leading-relaxed">{task.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2.5 flex-wrap">
                            {task.dueDate && (
                              <p className="text-[10px]" style={{ color: '#c9b3b8' }}>Due {formatDate(task.dueDate)}</p>
                            )}
                            <button
                              onClick={() => handleNavigate(task.route)}
                              className="text-[10px] font-bold uppercase tracking-wider pb-0.5 transition-colors"
                              style={{ color: MAROON, borderBottom: `1px solid ${MAROON}66` }}
                            >
                              Open →
                            </button>
                          </div>
                          {task.staffComment && (
                            <p className="mt-2.5 text-[11px] italic px-3 py-2 rounded-lg" style={{ color: '#991b1b', background: '#FBE9E9' }}>
                              Officer feedback: "{task.staffComment}"
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default RequirementsChecklist;