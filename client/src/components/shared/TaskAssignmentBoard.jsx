import { useEffect, useMemo, useState } from 'react';
import { Eye, PencilLine, Plus, X, ClipboardList, ArrowUpRight, FileDown } from 'lucide-react';

// ── Token system — shared across the whole portal (Scholar + Officer/Staff/Admin) ──
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

const normalizeApiBase = (url) => {
  const raw = (url?.trim() || 'http://localhost:5000').replace(/\/+$/, '');
  const cleaned = raw.replace(/\/api\/api(\/|$)/g, '/api$1');
  return cleaned.endsWith('/api') ? cleaned : `${cleaned}/api`;
};

const API_BASE = normalizeApiBase(import.meta.env?.VITE_API_URL);

const getStoredTasks = (storageKey) => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveStoredTasks = (storageKey, tasks) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey, JSON.stringify(tasks));
};

const BOARD_TASK_TYPES = ['Monthly Report', 'Report Card', 'COR Upload'];

const isBoardTaskType = (type) => BOARD_TASK_TYPES.includes(type);

const getTaskKeyForType = (type) => {
  switch (type) {
    case 'Monthly Report':
      return 'monthly_letters';
    case 'Report Card':
      return 'report_cards';
    case 'COR Upload':
      return 'cors';
    default:
      return 'other_documents';
  }
};

// Returns the most recent submission item (by submitted_at) for a given
// scholar + task type, or null if nothing has been submitted at all.
// A scholar can have multiple items per type now (rejected -> resubmitted
// creates a new row instead of overwriting the old one), so we always need
// the latest one to know the real current status.
const getLatestItem = (scholar, type) => {
  if (!scholar || typeof scholar !== 'object') return null;
  const key = getTaskKeyForType(type);
  const items = Array.isArray(scholar[key]) ? scholar[key] : [];
  if (items.length === 0) return null;
  return items
    .slice()
    .sort((a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0))[0];
};

const getLatestItemForTask = (scholar, type, task) => {
  if (!scholar || !task) return null;
  const key = getTaskKeyForType(type);
  const createdAt = new Date(task.createdAt || 0).getTime();
  const items = (Array.isArray(scholar[key]) ? scholar[key] : []).filter((item) => {
    const submittedAt = new Date(item.submitted_at || 0).getTime();
    return !task.createdAt || Number.isNaN(createdAt) || submittedAt >= createdAt;
  });
  if (items.length === 0) return null;
  return items.slice().sort((a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0))[0];
};

// A scholar only counts toward "submitted" progress once their LATEST
// submission for that task type has actually been Accepted by the officer.
// While it's still under review (pending) or was sent back (rejected), it
// does not count yet - this is what makes the progress bar/count actually
// move when an officer clicks Accept, instead of counting the moment a
// scholar merely uploads something.
const isApprovedForScholar = (scholar, type, task) => {
  const latest = getLatestItemForTask(scholar, type, task);
  return !!latest && latest.status === 'approved';
};

// Human-readable status for a scholar's latest submission of a given type,
// used in the "View Submissions" breakdown modal.
const getLatestStatusInfo = (scholar, type, task) => {
  const latest = getLatestItemForTask(scholar, type, task);
  if (!latest) return { key: 'none', label: 'Not submitted yet' };
  if (latest.status === 'approved') return { key: 'approved', label: 'Accepted' };
  if (latest.status === 'rejected') return { key: 'rejected', label: 'Returned for Revision' };
  return { key: 'pending', label: 'Under Review' };
};

// Recolored onto the shared ledger palette used everywhere else in the portal.
const STATUS_BADGE = {
  approved: { bg: `${SAGE}18`, text: SAGE },
  rejected: { bg: `${CLAY}18`, text: CLAY },
  pending: { bg: `${AMBER}18`, text: AMBER },
  none: { bg: PAPER, text: '#a89890' },
  done: { bg: `${SAGE}18`, text: SAGE },
};

const isPastDue = (dueDate) => {
  if (!dueDate) return false;

  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) {
    const fallback = new Date(`${dueDate}T23:59:59`);
    if (Number.isNaN(fallback.getTime())) return false;
    return new Date() > fallback;
  }

  return new Date() > parsed;
};

const formatDisplayDate = (value) => {
  if (!value) return 'No due date';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date(`${value}T00:00:00`);
    if (Number.isNaN(fallback.getTime())) return value;
    return fallback.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
};

// Shared field styles for the modal forms — underline ledger inputs,
// consistent with the rest of the portal, instead of boxed grey inputs.
const fieldLabelStyle = { ...sans, fontSize: '0.72rem', fontWeight: 700, color: '#a56475', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 };
const fieldInputStyle = { ...sans, fontSize: '0.9rem', color: INK, width: '100%', background: IVORY, border: `1px solid ${RULE}`, borderRadius: 10, padding: '11px 14px', outline: 'none' };

// ── Postmark-style due-date stamp — this board's signature visual.
// A circular "stamp" showing the day/month, ringed in the color that
// matters most here: whether the clock is still running.
const DueStamp = ({ dueDate, status }) => {
  const color = status === 'done' ? SAGE : status === 'overdue' ? CLAY : GOLD;
  const date = dueDate && dueDate !== 'No due date' ? new Date(dueDate) : null;
  const valid = date && !Number.isNaN(date.getTime());
  return (
    <div className="flex flex-col items-center justify-center rounded-full flex-shrink-0" style={{
      width: 56, height: 56, border: `2px solid ${color}`, background: `${color}0f`,
    }}>
      {valid ? (
        <>
          <span style={{ ...serif, fontSize: '1.15rem', fontWeight: 800, color, lineHeight: 1 }}>{date.getDate()}</span>
          <span style={{ ...sans, fontSize: '0.52rem', fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>
            {date.toLocaleDateString('en-PH', { month: 'short' })}
          </span>
        </>
      ) : (
        <span style={{ ...sans, fontSize: '0.5rem', fontWeight: 800, color, textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.2 }}>No<br />Date</span>
      )}
    </div>
  );
};

const TaskAssignmentBoard = ({ title, subtitle, role, storageKey, canManageTasks = false }) => {
  const [tasks, setTasks] = useState(() => getStoredTasks(storageKey) || []);
  const [scholarData, setScholarData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [viewRows, setViewRows] = useState([]);
  const [newTask, setNewTask] = useState({ title: '', type: 'Monthly Report', dueDate: '', recurring: 'None', instructions: '' });
  const [editData, setEditData] = useState({ title: '', type: 'Monthly Report', dueDate: '', recurring: 'None', instructions: '' });

  // Refetch logic - wrapped so it can be reused for both initial load and visibility change
  const loadTasks = async () => {
    try {
      const token = localStorage.getItem('token');

      // Load scholar submission summaries (used to compute submitted/total)
      const resp = await fetch(`${API_BASE}/submission/scholar-view`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) throw new Error('Unable to load submissions');
      const scholarsData = await resp.json();
      const scholars = Array.isArray(scholarsData) ? scholarsData : [];
      setScholarData(scholars);

      const totalScholars = scholars.length;

      // Load portal tasks from backend (shows tasks created by admin/officer/staff)
      const tasksResp = await fetch(`${API_BASE}/tasks`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      let portal = [];
      if (tasksResp.ok) {
        portal = await tasksResp.json();
      } else {
        console.warn('Failed to fetch portal tasks, falling back to local storage');
      }

      // Map server tasks to board shape and compute submitted counts.
      // "submitted" here means the scholar's LATEST submission for this
      // task type has been Accepted by the officer - see isApprovedForScholar.
      const mapped = Array.isArray(portal)
        ? portal
            .filter((t) => isBoardTaskType(t.type))
            .map((t) => {
              const submitted = scholars.filter((s) => isApprovedForScholar(s, t.type, t)).length;
              return {
                id: `portal-${t.id}`,
                title: t.title,
                type: t.type,
                dueDate: t.due_date || '',
                recurring: t.recurring || 'None',
                createdByName: t.created_by_name || t.created_by || 'System',
                createdByRole: t.created_by_role || '',
                targetYearLevels: Array.isArray(t.target_year_levels) ? t.target_year_levels : [],
                createdAt: t.created_at || '',
                submitted,
                total: totalScholars,
                source: 'portal',
                instructions: t.instructions || '',
              };
            })
        : [];

      // If backend returns nothing, fall back to any stored manual tasks (offline/dev)
      const storedTasks = getStoredTasks(storageKey) || [];
      const manualStored = Array.isArray(storedTasks)
        ? storedTasks.filter(
            (task) =>
              (task.source === 'manual' || (typeof task.id === 'string' && task.id.startsWith('custom-'))) &&
              isBoardTaskType(task.type)
          )
        : [];

      const final = [...mapped, ...manualStored];
      setTasks(final);
      // keep local copy for offline use
      saveStoredTasks(storageKey, final);
    } catch (error) {
      console.error('Task board load error', error);
      const storedTasks = getStoredTasks(storageKey) || [];
      setTasks(storedTasks);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadTasks();
  }, [storageKey]);

  // Refetch when page/tab comes back into focus (fixes stale data after approval)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // User switched back to this tab - refresh the data
        loadTasks();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [storageKey]);

  const summary = useMemo(() => {
    const total = tasks.reduce((sum, task) => sum + Number(task.total || 0), 0);
    const submitted = tasks.reduce((sum, task) => sum + Number(task.submitted || 0), 0);
    return { total, submitted, remaining: Math.max(total - submitted, 0) };
  }, [tasks]);

  const [activeTab, setActiveTab] = useState('pending');

  const taskGroups = useMemo(() => {
    const pending = [];
    const overdue = [];
    const done = [];

    tasks.forEach((task) => {
      const isComplete = task.total > 0 && task.submitted >= task.total;
      const isOverdue = !isComplete && isPastDue(task.dueDate);

      if (isComplete) {
        done.push(task);
      } else if (isOverdue) {
        overdue.push(task);
      } else {
        pending.push(task);
      }
    });

    return { pending, overdue, done };
  }, [tasks]);

  const visibleTasks = taskGroups[activeTab] || [];

  const exportTaskCompliance = (task) => {
    const rows = viewRows.map((row) => ({
      scholar_id: row.scholar_id,
      scholar_name: row.fullName,
      latest_status: row.statusLabel,
      submission_count: row.count,
      latest_submitted_at: row.latestSubmittedAt ? new Date(row.latestSubmittedAt).toISOString() : '',
      officer_feedback: row.staffComment || '',
    }));

    const csv = [
      ['scholar_id', 'scholar_name', 'latest_status', 'submission_count', 'latest_submitted_at', 'officer_feedback'],
      ...rows.map((row) => [
        row.scholar_id,
        row.scholar_name,
        row.latest_status,
        row.submission_count,
        row.latest_submitted_at,
        row.officer_feedback,
      ]),
    ]
      .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(task.title || 'task').toLowerCase().replace(/[^a-z0-9]+/g, '_')}_compliance.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportTaskCompliancePdf = async (task) => {
    if (!task || typeof task.id !== 'string' || !task.id.startsWith('portal-')) return;
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/tasks/${task.id.replace('portal-', '')}/export-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        rows: viewRows.map(row => ({
          scholar_id: row.scholar_id,
          scholar_name: row.fullName,
          latest_status: row.statusLabel,
          submission_count: row.count,
          latest_submitted_at: row.latestSubmittedAt ? new Date(row.latestSubmittedAt).toLocaleString() : '',
          officer_feedback: row.staffComment || '',
        })),
      }),
    });
    if (!response.ok) throw new Error('Unable to generate PDF');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(task.title || 'task').toLowerCase().replace(/[^a-z0-9]+/g, '_')}_compliance.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openViewModal = (task) => {
    const rows = scholarData.map((scholar) => {
      const key = getTaskKeyForType(task.type);
      const items = Array.isArray(scholar[key])
        ? scholar[key].filter((item) => {
            if (!task.createdAt) return true;
            return new Date(item.submitted_at || 0).getTime() >= new Date(task.createdAt).getTime();
          })
        : [];
      const latest = getLatestItemForTask(scholar, task.type, task);
      const statusInfo = getLatestStatusInfo(scholar, task.type, task);

      return {
        scholar_id: scholar.scholar_id,
        fullName: scholar.full_name || scholar.scholar_id,
        count: items.length,
        statusKey: statusInfo.key,
        statusLabel: statusInfo.label,
        latestSubmittedAt: latest?.submitted_at || null,
        staffComment: statusInfo.key === 'rejected' ? (latest?.staff_comment || null) : null,
      };
    }).sort((a, b) => Number(b.count) - Number(a.count));

    const completedRows = rows.filter((row) => row.statusKey === 'approved');
    const selected = {
      ...task,
      completedCount: completedRows.length,
      isPastDue: isPastDue(task.dueDate),
    };

    setSelectedTask(selected);
    setViewRows(rows);
    setShowViewModal(true);
  };

  const openEditModal = (task) => {
    setSelectedTask(task);
    setEditData({
      title: task.title,
      type: task.type,
      dueDate: task.dueDate || '',
      recurring: task.recurring || 'None',
      instructions: task.instructions || '',
    });
    setShowEditModal(true);
  };

  const handleCreateTask = () => {
    if (!canManageTasks) return;
    if (!newTask.title.trim()) return;
    const token = localStorage.getItem('token');
    const payload = {
      title: newTask.title.trim(),
      type: newTask.type,
      dueDate: newTask.dueDate || null,
      recurring: newTask.recurring || null,
      instructions: newTask.instructions || null,
      source: 'manual',
    };

    // Try POSTing to backend; fall back to localStorage if offline
    (async () => {
      try {
        if (token) {
          const resp = await fetch(`${API_BASE}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload),
          });
          if (resp.ok) {
            const created = await resp.json();
            const createdTask = {
              id: `portal-${created.id}`,
              title: created.title,
              type: created.type,
              dueDate: created.due_date || 'No due date',
              recurring: created.recurring || 'None',
              createdByName: created.created_by_name || created.created_by || 'You',
              createdByRole: created.created_by_role || role.toLowerCase(),
              targetYearLevels: Array.isArray(created.target_year_levels) ? created.target_year_levels : [],
              createdAt: created.created_at || new Date().toISOString(),
              submitted: 0,
              total: scholarData.length || 0,
              source: 'portal',
              instructions: created.instructions || '',
            };
            const updatedTasks = [createdTask, ...tasks];
            setTasks(updatedTasks);
            saveStoredTasks(storageKey, updatedTasks);
            setNewTask({ title: '', type: 'Monthly Report', dueDate: '', recurring: 'None', instructions: '' });
            setShowCreateModal(false);
            return;
          }
        }
      } catch (e) {
        console.warn('Failed to create task on server, saving locally', e.message || e);
      }

      // fallback local create
      const createdTaskLocal = {
        id: `custom-${Date.now()}`,
        title: newTask.title.trim(),
        type: newTask.type,
        dueDate: newTask.dueDate || 'No due date',
        recurring: newTask.recurring,
        submitted: 0,
        total: scholarData.length || 0,
        source: 'manual',
        instructions: newTask.instructions,
        createdAt: new Date().toISOString(),
      };
      const updatedTasks = [createdTaskLocal, ...tasks];
      setTasks(updatedTasks);
      saveStoredTasks(storageKey, updatedTasks);
      setNewTask({ title: '', type: 'Monthly Report', dueDate: '', recurring: 'None', instructions: '' });
      setShowCreateModal(false);
    })();
  };

  const handleSaveEdit = () => {
    if (!canManageTasks) return;
    if (!selectedTask) return;
    const token = localStorage.getItem('token');
    const doUpdateLocal = (patched) => {
      const updatedTasks = tasks.map((task) => (task.id === selectedTask.id ? { ...task, ...patched, dueDate: patched.dueDate || 'No due date' } : task));
      setTasks(updatedTasks);
      saveStoredTasks(storageKey, updatedTasks);
      setShowEditModal(false);
      setSelectedTask(null);
    };

    // If this is a portal-backed task, call API
    if (typeof selectedTask.id === 'string' && selectedTask.id.startsWith('portal-')) {
      const numericId = selectedTask.id.replace('portal-', '');
      (async () => {
        try {
          if (token) {
            const resp = await fetch(`${API_BASE}/tasks/${numericId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ ...editData, is_active: true }),
            });
            if (resp.ok) {
              doUpdateLocal(editData);
              return;
            }
          }
        } catch (e) {
          console.warn('Failed to update task on server, updating locally', e.message || e);
        }

        doUpdateLocal(editData);
      })();
    } else {
      // local/custom task
      doUpdateLocal(editData);
    }
  };

  const handleDeleteTask = (task) => {
    if (!canManageTasks || !task) return;
    if (!window.confirm(`Delete task "${task.title}"? Scholars will no longer see it.`)) return;

    const removeLocally = () => {
      const updatedTasks = tasks.filter((item) => item.id !== task.id);
      setTasks(updatedTasks);
      saveStoredTasks(storageKey, updatedTasks);
      if (selectedTask?.id === task.id) {
        setSelectedTask(null);
        setShowViewModal(false);
        setShowEditModal(false);
      }
    };

    if (typeof task.id === 'string' && task.id.startsWith('portal-')) {
      const numericId = task.id.replace('portal-', '');
      const token = localStorage.getItem('token');
      (async () => {
        try {
          const resp = await fetch(`${API_BASE}/tasks/${numericId}`, {
            method: 'DELETE',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (!resp.ok) throw new Error('Delete request failed');
        } catch (error) {
          console.error('Failed to delete task:', error);
          return;
        }
        removeLocally();
      })();
      return;
    }

    removeLocally();
  };

  return (
    <div className="min-h-screen" style={{ background: IVORY, ...sans }}>

      {/* ── Ledger header band — same family as the rest of the portal ── */}
      <div className="relative overflow-hidden px-5 sm:px-8 pt-8 pb-11" style={{ background: `linear-gradient(135deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)` }}>
        <svg className="absolute -right-8 -top-8 w-56 h-56 opacity-[0.12] pointer-events-none" viewBox="0 0 200 200" fill="none">
          <circle cx="100" cy="100" r="70" stroke={GOLD} strokeWidth="6" fill="none" strokeDasharray="10 8" />
          <circle cx="100" cy="100" r="40" stroke={GOLD} strokeWidth="6" fill="none" />
        </svg>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ border: `1.5px solid ${GOLD}` }}>
            <ClipboardList size={12} style={{ color: GOLD }} />
          </div>
          <span style={{ ...sans, fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.28em', textTransform: 'uppercase', color: GOLD_LIGHT }}>{role} Portal</span>
        </div>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 style={{ ...serif, fontSize: '2rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>{title}</h1>
            <p style={{ ...sans, fontSize: '0.82rem', color: '#e9c9a8', marginTop: 4 }}>{subtitle}</p>
          </div>
          {canManageTasks && (
            <button type="button" onClick={() => setShowCreateModal(true)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-full transition-colors hover:opacity-90 flex-shrink-0"
              style={{ ...sans, fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.04em', background: GOLD, color: MAROON_DEEP, border: 'none', cursor: 'pointer' }}>
              <Plus size={15} /> Create Task
            </button>
          )}
        </div>
      </div>

      <div className="relative z-10 px-5 sm:px-8 -mt-6 pb-10">

        {/* Summary docket */}
        <div className="mb-6 rounded-xl overflow-hidden" style={{ background: '#fff', border: `1px solid ${RULE}`, boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)' }}>
          <div className="grid grid-cols-2 sm:grid-cols-4">
            <div className="p-4" style={{ borderRight: `1px solid ${RULE}` }}>
              <p style={{ ...sans, fontSize: '0.62rem', fontWeight: 800, color: '#a56475', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Overall Progress</p>
              <p style={{ ...serif, fontSize: '1.5rem', fontWeight: 700, color: MAROON, marginTop: 6 }}>
                {summary.submitted}<span style={{ fontSize: '1rem', color: '#c9b3b8' }}>/{summary.total}</span>
              </p>
              <p style={{ ...sans, fontSize: '0.68rem', color: '#a89890' }}>accepted</p>
            </div>
            <div className="p-4" style={{ borderRight: `1px solid ${RULE}` }}>
              <p style={{ ...sans, fontSize: '0.62rem', fontWeight: 800, color: '#a56475', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Pending</p>
              <p style={{ ...serif, fontSize: '1.5rem', fontWeight: 700, color: AMBER, marginTop: 6 }}>{summary.remaining}</p>
              <p style={{ ...sans, fontSize: '0.68rem', color: '#a89890' }}>not accepted yet</p>
            </div>
            <div className="p-4 col-span-2" style={{ borderTop: `1px solid ${RULE}`, marginTop: -1 }}>
              <p style={{ ...sans, fontSize: '0.62rem', fontWeight: 800, color: '#a56475', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Active Tasks</p>
              <p style={{ ...serif, fontSize: '1.5rem', fontWeight: 700, color: INK, marginTop: 6 }}>{tasks.length}</p>
              <p style={{ ...sans, fontSize: '0.68rem', color: '#a89890' }}>Portal: {role}</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl p-6" style={{ background: '#fff', border: `1px solid ${RULE}`, color: '#a89890', ...sans, fontSize: '0.85rem' }}>
            Loading scholar submission progress...
          </div>
        ) : (
          <>
            {tasks.length === 0 ? (
              <div className="rounded-xl p-8 text-center" style={{ background: '#fff', border: `1px dashed ${RULE}` }}>
                <ClipboardList size={32} className="mx-auto mb-3" style={{ color: '#e9d9dc' }} />
                <p style={{ ...serif, fontSize: '1.1rem', fontWeight: 700, color: INK, marginBottom: 6 }}>No tasks have been created yet.</p>
                <p style={{ ...sans, fontSize: '0.82rem', color: '#a89890', marginBottom: 18 }}>Create a task to track scholar submissions. Progress will be calculated based on actual uploaded files.</p>
                {canManageTasks && (
                  <button onClick={() => setShowCreateModal(true)}
                    className="px-5 py-2.5 rounded-full transition-opacity hover:opacity-90"
                    style={{ background: MAROON, color: '#fff', ...sans, fontSize: '0.8rem', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                    Create Task
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-5" style={{ borderBottom: `1px solid ${RULE}` }}>
                  {[
                    { key: 'pending', label: `Pending (${taskGroups.pending.length})` },
                    { key: 'overdue', label: `Overdue (${taskGroups.overdue.length})` },
                    { key: 'done', label: `Done (${taskGroups.done.length})` },
                  ].map((tab) => (
                    <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
                      className="pb-2.5 transition-colors"
                      style={{
                        ...sans, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
                        color: activeTab === tab.key ? MAROON : '#c9b3b8',
                        borderBottom: activeTab === tab.key ? `2px solid ${MAROON}` : '2px solid transparent',
                        background: 'none', cursor: 'pointer',
                      }}>
                      {tab.label}
                    </button>
                  ))}
                </div>

                {visibleTasks.length === 0 ? (
                  <div className="rounded-xl p-8 text-center" style={{ background: '#fff', border: `1px dashed ${RULE}` }}>
                    <ClipboardList size={28} className="mx-auto mb-3" style={{ color: '#e9d9dc' }} />
                    <p style={{ ...serif, fontSize: '1rem', fontWeight: 700, color: INK }}>No tasks found.</p>
                  </div>
                ) : (
                  visibleTasks.map((task) => {
                    const percentage = task.total > 0 ? Math.round((task.submitted / task.total) * 100) : 0;
                    const taskComplete = task.total > 0 ? task.submitted >= task.total : false;
                    const taskPastDue = isPastDue(task.dueDate);
                    const taskDone = taskPastDue && taskComplete;
                    const taskOverdue = taskPastDue && !taskComplete;
                    const stampStatus = taskComplete ? 'done' : taskOverdue ? 'overdue' : 'pending';
                    const taskStatusText = taskDone ? 'Done' : taskOverdue ? 'Overdue' : 'In Progress';
                    const taskStatusStyle = taskDone ? STATUS_BADGE.done : taskOverdue ? STATUS_BADGE.rejected : STATUS_BADGE.pending;
                    const barColor = percentage >= 80 ? SAGE : percentage >= 50 ? AMBER : CLAY;
                    const progressLabel = taskDone ? 'Completed' : taskOverdue ? `Overdue — ${Math.max(task.total - task.submitted, 0)} still pending` : 'Progress (Accepted)';

                    return (
                      <div key={task.id} className="rounded-xl p-5 flex gap-4 flex-col sm:flex-row" style={{ background: '#fff', border: `1px solid ${RULE}` }}>
                        <DueStamp dueDate={task.dueDate} status={stampStatus} />

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h3 style={{ ...serif, fontSize: '1.1rem', fontWeight: 700, color: INK }}>{task.title}</h3>
                            <span className="px-2.5 py-1 rounded-full" style={{ ...sans, fontSize: '0.62rem', fontWeight: 800, background: ROSE, color: MAROON }}>{task.type}</span>
                            <span className="px-2.5 py-1 rounded-full" style={{ ...sans, fontSize: '0.62rem', fontWeight: 800, background: taskStatusStyle.bg, color: taskStatusStyle.text }}>{taskStatusText}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 mb-3.5">
                            <p style={{ ...sans, fontSize: '0.78rem', color: '#6b6058' }}>
                              <span style={{ color: '#a56475', fontWeight: 700 }}>Due:</span> {formatDisplayDate(task.dueDate)}
                            </p>
                            <p style={{ ...sans, fontSize: '0.78rem', color: '#6b6058' }}>
                              <span style={{ color: '#a56475', fontWeight: 700 }}>Recurring:</span> {task.recurring}
                            </p>
                            <p style={{ ...sans, fontSize: '0.78rem', color: '#6b6058' }}>
                              <span style={{ color: '#a56475', fontWeight: 700 }}>Created by:</span> {task.createdByName || 'System'}{task.createdByRole ? ` (${task.createdByRole})` : ''}
                            </p>
                          </div>

                          <div className="mb-1.5 flex items-center justify-between">
                            <span style={{ ...sans, fontSize: '0.72rem', fontWeight: 700, color: '#6b6058' }}>{progressLabel}</span>
                            <span style={{ ...mono, fontSize: '0.74rem', fontWeight: 700, color: barColor }}>{task.submitted}/{task.total} ({percentage}%)</span>
                          </div>
                          <div className="w-full h-2 rounded-full overflow-hidden mb-4" style={{ background: RULE }}>
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%`, background: barColor }} />
                          </div>

                          <div className="flex flex-wrap items-center gap-2.5">
                            {canManageTasks && (
                              <>
                                <button type="button" onClick={() => openEditModal(task)}
                                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-opacity hover:opacity-85"
                                  style={{ ...sans, fontSize: '0.72rem', fontWeight: 700, background: ROSE, color: MAROON, border: 'none', cursor: 'pointer' }}>
                                  <PencilLine size={12} /> Edit Task
                                </button>
                                <button type="button" onClick={() => handleDeleteTask(task)}
                                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-opacity hover:opacity-85"
                                  style={{ ...sans, fontSize: '0.72rem', fontWeight: 700, background: '#FBE9E9', color: '#991b1b', border: 'none', cursor: 'pointer' }}>
                                  <X size={12} /> Delete Task
                                </button>
                              </>
                            )}
                            <button type="button" onClick={() => openViewModal(task)}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-colors hover:bg-[#f6efe4]"
                              style={{ ...sans, fontSize: '0.72rem', fontWeight: 700, border: `1.5px solid ${MAROON}`, color: MAROON, background: '#fff', cursor: 'pointer' }}>
                              <Eye size={12} /> View Submissions
                            </button>
                            {task.instructions ? (
                              <span className="rounded-full px-3 py-1.5" style={{ ...sans, fontSize: '0.68rem', background: PAPER, color: '#a89890' }}>{task.instructions}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>

      {canManageTasks && showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl overflow-hidden" style={{ background: '#fff', boxShadow: '0 20px 60px -20px rgba(36,21,18,0.4)' }}>
            <div style={{ height: 4, background: `linear-gradient(90deg, ${MAROON} 0%, ${GOLD} 100%)` }} />
            <div className="flex items-center justify-between p-6" style={{ borderBottom: `1px solid ${RULE}` }}>
              <h2 style={{ ...serif, fontSize: '1.4rem', fontWeight: 700, color: INK }}>Create New Task</h2>
              <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-full p-2 hover:bg-[#f6efe4]" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X className="h-5 w-5" style={{ color: '#a89890' }} />
              </button>
            </div>
            <div className="space-y-5 p-6">
              <div>
                <label style={fieldLabelStyle}>Task Title</label>
                <input type="text" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Enter task title" style={fieldInputStyle} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label style={fieldLabelStyle}>Task Type</label>
                  <select value={newTask.type} onChange={(e) => setNewTask({ ...newTask, type: e.target.value })} style={fieldInputStyle}>
                    {BOARD_TASK_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={fieldLabelStyle}>Due Date</label>
                  <input type="date" value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} style={fieldInputStyle} />
                </div>
              </div>
              <div>
                <label style={fieldLabelStyle}>Recurring Schedule</label>
                <select value={newTask.recurring} onChange={(e) => setNewTask({ ...newTask, recurring: e.target.value })} style={fieldInputStyle}>
                  <option>None</option>
                  <option>Monthly</option>
                  <option>Quarterly</option>
                  <option>Semestral</option>
                  <option>Annual</option>
                </select>
              </div>
              <div>
                <label style={fieldLabelStyle}>Instructions</label>
                <textarea rows={4} value={newTask.instructions} onChange={(e) => setNewTask({ ...newTask, instructions: e.target.value })} placeholder="Enter task instructions..." style={{ ...fieldInputStyle, resize: 'none' }} />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6" style={{ borderTop: `1px solid ${RULE}` }}>
              <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-full px-5 py-2.5 transition-colors hover:bg-[#f6efe4]" style={{ ...sans, fontSize: '0.85rem', fontWeight: 700, border: `1.5px solid ${RULE}`, color: '#6b6058', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={handleCreateTask} className="rounded-full px-5 py-2.5 transition-opacity hover:opacity-90" style={{ ...sans, fontSize: '0.85rem', fontWeight: 700, background: MAROON, color: '#fff', border: 'none', cursor: 'pointer' }}>Create Task</button>
            </div>
          </div>
        </div>
      )}

      {showViewModal && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-xl overflow-hidden" style={{ background: '#fff', boxShadow: '0 20px 60px -20px rgba(36,21,18,0.4)' }}>
            <div style={{ height: 4, background: `linear-gradient(90deg, ${MAROON} 0%, ${GOLD} 100%)` }} />
            <div className="flex items-center justify-between p-6" style={{ borderBottom: `1px solid ${RULE}` }}>
              <div>
                <h2 style={{ ...serif, fontSize: '1.3rem', fontWeight: 700, color: INK }}>{selectedTask.title}</h2>
                <p style={{ ...sans, fontSize: '0.8rem', color: '#a89890' }}>
                  {selectedTask.isPastDue ? 'Due date has passed — final compliance list' : 'Real scholar submission breakdown for this task'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => exportTaskCompliancePdf(selectedTask)}
                  className="flex items-center gap-1.5 rounded-full px-4 py-2 transition-colors hover:bg-[#f6efe4]"
                  style={{ ...sans, fontSize: '0.78rem', fontWeight: 700, border: `1.5px solid ${MAROON}`, color: MAROON, background: '#fff', cursor: 'pointer' }}>
                  <FileDown size={13} /> Export PDF
                </button>
                <button type="button" onClick={() => exportTaskCompliance(selectedTask)}
                  className="flex items-center gap-1.5 rounded-full px-4 py-2 transition-colors hover:bg-[#f6efe4]"
                  style={{ ...sans, fontSize: '0.78rem', fontWeight: 700, border: `1.5px solid ${MAROON}`, color: MAROON, background: '#fff', cursor: 'pointer' }}>
                  <ArrowUpRight size={13} /> Export CSV
                </button>
                <button type="button" onClick={() => setShowViewModal(false)} className="rounded-full p-2 hover:bg-[#f6efe4]" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                  <X className="h-5 w-5" style={{ color: '#a89890' }} />
                </button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-6">
              {viewRows.length === 0 ? (
                <div className="rounded-lg p-6" style={{ background: PAPER, color: '#a89890', ...sans, fontSize: '0.82rem' }}>No scholar submission data is available yet.</div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg p-3.5" style={{ background: `${SAGE}18`, color: SAGE, ...sans, fontSize: '0.82rem', fontWeight: 700 }}>
                    {viewRows.filter((row) => row.statusKey === 'approved').length} scholar{viewRows.filter((row) => row.statusKey === 'approved').length === 1 ? '' : 's'} complied.
                  </div>
                  {viewRows.map((row) => {
                    const badge = STATUS_BADGE[row.statusKey] || STATUS_BADGE.none;
                    return (
                      <div key={row.scholar_id} className="flex flex-col gap-2 rounded-lg p-4" style={{ background: PAPER }}>
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p style={{ ...sans, fontSize: '0.85rem', fontWeight: 700, color: INK }}>{row.fullName}</p>
                            <p style={{ ...sans, fontSize: '0.76rem', color: '#a89890' }}>{row.count} submission{row.count === 1 ? '' : 's'} recorded</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="rounded-full px-3 py-1" style={{ ...sans, fontSize: '0.68rem', fontWeight: 800, background: badge.bg, color: badge.text }}>{row.statusLabel}</span>
                            {row.latestSubmittedAt ? <span style={{ ...mono, fontSize: '0.66rem', color: '#a89890' }}>{new Date(row.latestSubmittedAt).toLocaleString()}</span> : null}
                          </div>
                        </div>
                        {row.staffComment && (
                          <p style={{ ...sans, fontSize: '0.74rem', fontStyle: 'italic', color: '#a89890' }}>Officer feedback: "{row.staffComment}"</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {canManageTasks && showEditModal && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl overflow-hidden" style={{ background: '#fff', boxShadow: '0 20px 60px -20px rgba(36,21,18,0.4)' }}>
            <div style={{ height: 4, background: `linear-gradient(90deg, ${MAROON} 0%, ${GOLD} 100%)` }} />
            <div className="flex items-center justify-between p-6" style={{ borderBottom: `1px solid ${RULE}` }}>
              <div>
                <h2 style={{ ...serif, fontSize: '1.3rem', fontWeight: 700, color: INK }}>Edit Task</h2>
                <p style={{ ...sans, fontSize: '0.8rem', color: '#a89890' }}>Update the task details shown to the portal.</p>
              </div>
              <button type="button" onClick={() => setShowEditModal(false)} className="rounded-full p-2 hover:bg-[#f6efe4]" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X className="h-5 w-5" style={{ color: '#a89890' }} />
              </button>
            </div>
            <div className="space-y-5 p-6">
              <div>
                <label style={fieldLabelStyle}>Task Title</label>
                <input type="text" value={editData.title} onChange={(e) => setEditData({ ...editData, title: e.target.value })} style={fieldInputStyle} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label style={fieldLabelStyle}>Task Type</label>
                  <select value={editData.type} onChange={(e) => setEditData({ ...editData, type: e.target.value })} style={fieldInputStyle}>
                    {BOARD_TASK_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={fieldLabelStyle}>Due Date</label>
                  <input type="date" value={editData.dueDate} onChange={(e) => setEditData({ ...editData, dueDate: e.target.value })} style={fieldInputStyle} />
                </div>
              </div>
              <div>
                <label style={fieldLabelStyle}>Recurring Schedule</label>
                <select value={editData.recurring} onChange={(e) => setEditData({ ...editData, recurring: e.target.value })} style={fieldInputStyle}>
                  <option>None</option>
                  <option>Monthly</option>
                  <option>Quarterly</option>
                  <option>Semestral</option>
                  <option>Annual</option>
                </select>
              </div>
              <div>
                <label style={fieldLabelStyle}>Instructions</label>
                <textarea rows={4} value={editData.instructions} onChange={(e) => setEditData({ ...editData, instructions: e.target.value })} style={{ ...fieldInputStyle, resize: 'none' }} />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6" style={{ borderTop: `1px solid ${RULE}` }}>
              <button type="button" onClick={() => setShowEditModal(false)} className="rounded-full px-5 py-2.5 transition-colors hover:bg-[#f6efe4]" style={{ ...sans, fontSize: '0.85rem', fontWeight: 700, border: `1.5px solid ${RULE}`, color: '#6b6058', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={handleSaveEdit} className="rounded-full px-5 py-2.5 transition-opacity hover:opacity-90" style={{ ...sans, fontSize: '0.85rem', fontWeight: 700, background: MAROON, color: '#fff', border: 'none', cursor: 'pointer' }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskAssignmentBoard;