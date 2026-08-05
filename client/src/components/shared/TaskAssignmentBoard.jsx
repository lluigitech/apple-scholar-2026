import { useEffect, useMemo, useState } from 'react';
import { Eye, PencilLine, Plus, X } from 'lucide-react';

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

// A scholar only counts toward "submitted" progress once their LATEST
// submission for that task type has actually been Accepted by the officer.
// While it's still under review (pending) or was sent back (rejected), it
// does not count yet - this is what makes the progress bar/count actually
// move when an officer clicks Accept, instead of counting the moment a
// scholar merely uploads something.
const isApprovedForScholar = (scholar, type) => {
  const latest = getLatestItem(scholar, type);
  return !!latest && latest.status === 'approved';
};

// Human-readable status for a scholar's latest submission of a given type,
// used in the "View Submissions" breakdown modal.
const getLatestStatusInfo = (scholar, type) => {
  const latest = getLatestItem(scholar, type);
  if (!latest) return { key: 'none', label: 'Not submitted yet' };
  if (latest.status === 'approved') return { key: 'approved', label: 'Accepted' };
  if (latest.status === 'rejected') return { key: 'rejected', label: 'Returned for Revision' };
  return { key: 'pending', label: 'Under Review' };
};

const STATUS_BADGE = {
  approved: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700' },
  pending: { bg: 'bg-amber-100', text: 'text-amber-700' },
  none: { bg: 'bg-gray-100', text: 'text-gray-500' },
};

const TaskAssignmentBoard = ({ title, subtitle, role, storageKey }) => {
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

  useEffect(() => {
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
          ? portal.map((t) => {
              const submitted = scholars.filter((s) => isApprovedForScholar(s, t.type)).length;
              return {
                id: `portal-${t.id}`,
                title: t.title,
                type: t.type,
                dueDate: t.due_date || '',
                recurring: t.recurring || 'None',
                submitted,
                total: totalScholars,
                source: 'portal',
                instructions: t.instructions || '',
              };
            })
          : [];

        // If backend returns nothing, fall back to any stored manual tasks (offline/dev)
        const storedTasks = getStoredTasks(storageKey) || [];
        const manualStored = Array.isArray(storedTasks) ? storedTasks.filter((task) => task.source === 'manual' || (typeof task.id === 'string' && task.id.startsWith('custom-'))) : [];

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

    loadTasks();
  }, [storageKey]);

  const summary = useMemo(() => {
    const total = tasks.reduce((sum, task) => sum + Number(task.total || 0), 0);
    const submitted = tasks.reduce((sum, task) => sum + Number(task.submitted || 0), 0);
    return { total, submitted, remaining: Math.max(total - submitted, 0) };
  }, [tasks]);

  const openViewModal = (task) => {
    const rows = scholarData.map((scholar) => {
      const key = getTaskKeyForType(task.type);
      const items = Array.isArray(scholar[key]) ? scholar[key] : [];
      const latest = getLatestItem(scholar, task.type);
      const statusInfo = getLatestStatusInfo(scholar, task.type);

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

    setSelectedTask(task);
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
      };
      const updatedTasks = [createdTaskLocal, ...tasks];
      setTasks(updatedTasks);
      saveStoredTasks(storageKey, updatedTasks);
      setNewTask({ title: '', type: 'Monthly Report', dueDate: '', recurring: 'None', instructions: '' });
      setShowCreateModal(false);
    })();
  };

  const handleSaveEdit = () => {
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

  return (
    <div className="p-6 sm:p-8" style={{ position: 'relative' }}>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="mb-2" style={{ fontFamily: "'Playfair Display', serif", fontSize: '2rem', fontWeight: 700, color: '#1a1a1a' }}>
            {title}
          </h1>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.95rem', color: '#6b7280' }}>
            {subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg transition-all hover:opacity-90"
          style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.95rem', fontWeight: 600, backgroundColor: '#802B36', color: '#ffffff' }}
        >
          <Plus className="w-5 h-5" />
          Create Task
        </button>
      </div>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4 text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          <span className="font-semibold text-gray-700">Overall progress</span>
          <span className="rounded-full bg-[#F5E8EA] px-3 py-1 text-[#802B36]">{summary.submitted}/{summary.total} accepted</span>
          <span className="text-gray-500">{summary.remaining} still pending / not accepted</span>
          <span className="text-gray-400">Portal: {role}</span>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading scholar submission progress...</div>
      ) : (
        <>
          {tasks.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
              <p className="mb-3 font-semibold">No tasks have been created yet.</p>
              <p className="mb-4">Create a task to track scholar submissions. Progress will be calculated based on actual uploaded files.</p>
              <div className="flex">
                <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 rounded-lg bg-[#802B36] text-white font-semibold">Create Task</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {tasks.map((task) => {
                const percentage = task.total > 0 ? Math.round((task.submitted / task.total) * 100) : 0;
                return (
                  <div key={task.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.25rem', fontWeight: 700, color: '#1a1a1a' }}>
                            {task.title}
                          </h3>
                          <span className="px-3 py-1 rounded-full text-xs" style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, backgroundColor: '#F5E8EA', color: '#802B36' }}>
                            {task.type}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          <p style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151' }}>
                            <strong>Due:</strong> {task.dueDate || 'No due date'}
                          </p>
                          <p style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151' }}>
                            <strong>Recurring:</strong> {task.recurring}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
                          Progress (Accepted)
                        </span>
                        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600, color: '#802B36' }}>
                          {task.submitted}/{task.total} ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full transition-all duration-500 rounded-full" style={{ width: `${percentage}%`, backgroundColor: percentage >= 80 ? '#10b981' : percentage >= 50 ? '#f59e0b' : '#ef4444' }}></div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => openEditModal(task)}
                        className="px-4 py-2 rounded-lg transition-all hover:opacity-90"
                        style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600, backgroundColor: '#F5E8EA', color: '#802B36' }}
                      >
                        Edit Task
                      </button>
                      <button
                        type="button"
                        onClick={() => openViewModal(task)}
                        className="px-4 py-2 rounded-lg border transition-all hover:bg-gray-50"
                        style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600, borderColor: '#e5e7eb', color: '#374151' }}
                      >
                        View Submissions
                      </button>
                      {task.instructions ? (
                        <span className="rounded-full bg-gray-100 px-3 py-2 text-xs text-gray-600" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                          {task.instructions}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-6">
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', fontWeight: 700, color: '#1a1a1a' }}>Create New Task</h2>
              <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-lg p-2 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-2 block" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>Task Title</label>
                <input type="text" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Enter task title" className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition-all focus:ring-2" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem' }} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>Task Type</label>
                  <select value={newTask.type} onChange={(e) => setNewTask({ ...newTask, type: e.target.value })} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition-all focus:ring-2" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem' }}>
                    <option>Monthly Report</option>
                    <option>Report Card</option>
                    <option>COR Upload</option>
                    <option>Duty Participation</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>Due Date</label>
                  <input type="date" value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition-all focus:ring-2" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem' }} />
                </div>
              </div>
              <div>
                <label className="mb-2 block" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>Recurring Schedule</label>
                <select value={newTask.recurring} onChange={(e) => setNewTask({ ...newTask, recurring: e.target.value })} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition-all focus:ring-2" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem' }}>
                  <option>None</option>
                  <option>Monthly</option>
                  <option>Quarterly</option>
                  <option>Semestral</option>
                  <option>Annual</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>Instructions</label>
                <textarea rows={4} value={newTask.instructions} onChange={(e) => setNewTask({ ...newTask, instructions: e.target.value })} placeholder="Enter task instructions..." className="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 outline-none transition-all focus:ring-2" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem' }} />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 p-6">
              <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-lg border px-5 py-3 transition-all hover:bg-gray-50" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.95rem', fontWeight: 600, borderColor: '#e5e7eb', color: '#374151' }}>Cancel</button>
              <button type="button" onClick={handleCreateTask} className="rounded-lg px-5 py-3 transition-all hover:opacity-90" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.95rem', fontWeight: 600, backgroundColor: '#802B36', color: '#ffffff' }}>Create Task</button>
            </div>
          </div>
        </div>
      )}

      {showViewModal && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-6">
              <div>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', fontWeight: 700, color: '#1a1a1a' }}>{selectedTask.title}</h2>
                <p className="text-sm text-gray-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>Real scholar submission breakdown for this task</p>
              </div>
              <button type="button" onClick={() => setShowViewModal(false)} className="rounded-lg p-2 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-6">
              {viewRows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 p-6 text-sm text-gray-500">No scholar submission data is available yet.</div>
              ) : (
                <div className="space-y-3">
                  {viewRows.map((row) => {
                    const badge = STATUS_BADGE[row.statusKey] || STATUS_BADGE.none;
                    return (
                      <div key={row.scholar_id} className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-semibold text-gray-800">{row.fullName}</p>
                            <p className="text-sm text-gray-500">{row.count} submission{row.count === 1 ? '' : 's'} recorded</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.bg} ${badge.text}`}>
                              {row.statusLabel}
                            </span>
                            {row.latestSubmittedAt ? <span className="text-xs text-gray-500">{new Date(row.latestSubmittedAt).toLocaleString()}</span> : null}
                          </div>
                        </div>
                        {row.staffComment && (
                          <p className="text-xs text-gray-500 italic">Officer feedback: "{row.staffComment}"</p>
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

      {showEditModal && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-6">
              <div>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', fontWeight: 700, color: '#1a1a1a' }}>Edit Task</h2>
                <p className="text-sm text-gray-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>Update the task details shown to the portal.</p>
              </div>
              <button type="button" onClick={() => setShowEditModal(false)} className="rounded-lg p-2 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-2 block" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>Task Title</label>
                <input type="text" value={editData.title} onChange={(e) => setEditData({ ...editData, title: e.target.value })} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition-all focus:ring-2" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem' }} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>Task Type</label>
                  <select value={editData.type} onChange={(e) => setEditData({ ...editData, type: e.target.value })} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition-all focus:ring-2" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem' }}>
                    <option>Monthly Report</option>
                    <option>Report Card</option>
                    <option>COR Upload</option>
                    <option>Duty Participation</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>Due Date</label>
                  <input type="date" value={editData.dueDate} onChange={(e) => setEditData({ ...editData, dueDate: e.target.value })} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition-all focus:ring-2" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem' }} />
                </div>
              </div>
              <div>
                <label className="mb-2 block" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>Recurring Schedule</label>
                <select value={editData.recurring} onChange={(e) => setEditData({ ...editData, recurring: e.target.value })} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition-all focus:ring-2" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem' }}>
                  <option>None</option>
                  <option>Monthly</option>
                  <option>Quarterly</option>
                  <option>Semestral</option>
                  <option>Annual</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>Instructions</label>
                <textarea rows={4} value={editData.instructions} onChange={(e) => setEditData({ ...editData, instructions: e.target.value })} className="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 outline-none transition-all focus:ring-2" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem' }} />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 p-6">
              <button type="button" onClick={() => setShowEditModal(false)} className="rounded-lg border px-5 py-3 transition-all hover:bg-gray-50" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.95rem', fontWeight: 600, borderColor: '#e5e7eb', color: '#374151' }}>Cancel</button>
              <button type="button" onClick={handleSaveEdit} className="rounded-lg px-5 py-3 transition-all hover:opacity-90" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.95rem', fontWeight: 600, backgroundColor: '#802B36', color: '#ffffff' }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskAssignmentBoard;