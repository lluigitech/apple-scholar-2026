import { useEffect, useMemo, useState } from 'react';
import {
  Eye, X, ClipboardList, ArrowUpRight, FileDown, Search, CalendarDays, SlidersHorizontal,
  RefreshCw, Clock3, AlertTriangle, CheckCircle2,
} from 'lucide-react';

// ── Apple Scholar design system — same identity as Admin/Staff/Scholar ──
const PRIMARY = '#6D2140';
const PRIMARY_DARK = '#4A1730';
const GOLD = '#A9784E';
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const INK = '#241512';
const MUTED = '#8A7A68';
const SUCCESS = '#3F8A55';
const WARNING = '#B8863F';
const DANGER = '#C1666B';
const RADIUS = 16;
const SHADOW = '0 1px 2px rgba(36,21,18,0.05), 0 6px 18px -12px rgba(109,33,64,0.18)';

const display = { fontFamily: "'Lora', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace" };

const outlineBtn = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', border: `1px solid ${BORDER}`, borderRadius: 10, background: SURFACE, color: INK, ...body, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' };

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
const normalizeYearLevel = (value) => {
  const normalized = String(value || '').trim().toLowerCase().replace(/_/g, ' ');
  const aliases = {
    'grade 7': 'grade_7', grade7: 'grade_7',
    'grade 8': 'grade_8', grade8: 'grade_8',
    'grade 9': 'grade_9', grade9: 'grade_9',
    'grade 10': 'grade_10', grade10: 'grade_10',
    'grade 11': 'grade_11', grade11: 'grade_11',
    'grade 12': 'grade_12', grade12: 'grade_12',
    'college 1': 'college_1', '1st year': 'college_1', '1st year college': 'college_1',
    'college 2': 'college_2', '2nd year': 'college_2', '2nd year college': 'college_2',
    'college 3': 'college_3', '3rd year': 'college_3', '3rd year college': 'college_3',
    'college 4': 'college_4', '4th year': 'college_4', '4th year college': 'college_4',
    'college 5': 'college_5', '5th year': 'college_5', '5th year college': 'college_5',
  };
  return aliases[normalized] || normalized;
};

const parseTargetLevels = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const scholarsForTask = (scholars, task) => {
  const targetLevels = parseTargetLevels(task?.target_year_levels).length
    ? parseTargetLevels(task?.target_year_levels)
    : parseTargetLevels(task?.targetYearLevels);
  if (!targetLevels.length) return scholars;
  const normalizedTargets = targetLevels.map(normalizeYearLevel);
  return scholars.filter(scholar => normalizedTargets.includes(normalizeYearLevel(scholar.year_level)));
};

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
// used in the submission breakdown.
const getLatestStatusInfo = (scholar, type, task) => {
  const latest = getLatestItemForTask(scholar, type, task);
  if (!latest) return { key: 'none', label: 'Not submitted yet' };
  if (latest.status === 'approved') return { key: 'approved', label: 'Accepted' };
  if (latest.status === 'rejected') return { key: 'rejected', label: 'Returned for Revision' };
  return { key: 'pending', label: 'Under Review' };
};

const STATUS_BADGE = {
  approved: { bg: `${SUCCESS}18`, text: SUCCESS },
  rejected: { bg: `${DANGER}18`, text: DANGER },
  pending: { bg: `${WARNING}18`, text: WARNING },
  none: { bg: BG, text: MUTED },
  done: { bg: `${SUCCESS}18`, text: SUCCESS },
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

// Task classification — the single rule behind taskGroups, the row status
// badges and the Status filter: complete when every eligible scholar is
// accepted; otherwise overdue once the due date has passed; else in progress.
const classifyTask = (task) => {
  const isComplete = task.total > 0 && task.submitted >= task.total;
  if (isComplete) return 'done';
  return isPastDue(task.dueDate) ? 'overdue' : 'pending';
};

const TASK_STATUS_META = {
  pending: { label: 'In Progress', color: WARNING },
  overdue: { label: 'Overdue', color: DANGER },
  done: { label: 'Completed', color: SUCCESS },
};

const TYPE_COLORS = {
  'Monthly Report': PRIMARY,
  'Report Card': GOLD,
  'COR Upload': MUTED,
};

// ── Year-level helpers (display + filtering; reuse normalizeYearLevel) ──
const YEAR_ORDER = ['grade_7', 'grade_8', 'grade_9', 'grade_10', 'grade_11', 'grade_12', 'college_1', 'college_2', 'college_3', 'college_4', 'college_5'];
const yearRank = (key) => {
  const i = YEAR_ORDER.indexOf(key);
  return i === -1 ? YEAR_ORDER.length : i;
};
const yearLevelLabel = (key) => {
  const grade = /^grade_(\d+)$/.exec(key);
  if (grade) return `Grade ${grade[1]}`;
  const college = /^college_(\d)$/.exec(key);
  if (college) {
    const n = Number(college[1]);
    const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
    return `${n}${suffix} Year College`;
  }
  return key ? String(key).replace(/_/g, ' ') : 'Unknown';
};
const getTaskTargetKeys = (task) => {
  const levels = parseTargetLevels(task?.target_year_levels).length
    ? parseTargetLevels(task?.target_year_levels)
    : parseTargetLevels(task?.targetYearLevels);
  return [...new Set(levels.map(normalizeYearLevel))].sort((a, b) => yearRank(a) - yearRank(b));
};

const PAGE_SIZE = 8;

const pageWindow = (page, pages) => {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 3) { set.add(2); set.add(3); set.add(4); }
  if (page >= pages - 2) { set.add(pages - 1); set.add(pages - 2); set.add(pages - 3); }
  const list = [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  return list.flatMap((n, i) => (i && n - list[i - 1] > 1 ? ['…', n] : [n]));
};

// ─── Small UI pieces ──────────────────────────────────────────────────────
const Card = ({ children, style = {}, className = '' }) => (
  <div className={className} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: SHADOW, ...style }}>
    {children}
  </div>
);

const KpiCard = ({ icon: Icon, label, value, color }) => (
  <Card className="min-w-0" style={{ padding: '16px 18px' }}>
    <div className="flex items-center gap-3.5">
      <span className="flex items-center justify-center flex-shrink-0 rounded-full" style={{ width: 44, height: 44, background: `${color}14`, color }}>
        <Icon size={20} strokeWidth={1.9} />
      </span>
      <div className="min-w-0">
        <p style={{ ...display, fontSize: '1.7rem', fontWeight: 700, color: INK, lineHeight: 1.1 }}>{value}</p>
        <p style={{ ...body, fontSize: '0.78rem', color: MUTED, marginTop: 1 }}>{label}</p>
      </div>
    </div>
  </Card>
);

const TypeBadge = ({ type }) => {
  const color = TYPE_COLORS[type] || MUTED;
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full whitespace-nowrap"
      style={{ ...body, fontSize: '0.7rem', fontWeight: 600, color, background: `${color}12`, border: `1px solid ${color}30` }}>
      {type}
    </span>
  );
};

const TaskStatusBadge = ({ status }) => {
  const meta = TASK_STATUS_META[status] || TASK_STATUS_META.pending;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full whitespace-nowrap"
      style={{ ...body, fontSize: '0.7rem', fontWeight: 700, color: meta.color, background: `${meta.color}14`, border: `1px solid ${meta.color}35` }}>
      <span className="rounded-full" style={{ width: 6, height: 6, background: meta.color }} />{meta.label}
    </span>
  );
};

const LevelChips = ({ keys, max = 2 }) => {
  if (keys.length === 0) {
    return <span style={{ ...body, fontSize: '0.8rem', fontWeight: 600, color: INK }}>All Levels</span>;
  }
  const shown = keys.slice(0, max);
  const extra = keys.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((k) => (
        <span key={k} className="px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{ ...body, fontSize: '0.7rem', fontWeight: 600, color: INK, background: BG, border: `1px solid ${BORDER}` }}>{yearLevelLabel(k)}</span>
      ))}
      {extra > 0 && (
        <span title={keys.slice(max).map(yearLevelLabel).join(', ')} className="px-2 py-0.5 rounded-full"
          style={{ ...mono, fontSize: '0.66rem', fontWeight: 700, color: PRIMARY, background: `${PRIMARY}10` }}>+{extra}</span>
      )}
    </div>
  );
};

const ProgressBar = ({ submitted, total, height = 6 }) => {
  const percentage = total > 0 ? Math.round((submitted / total) * 100) : 0;
  const barColor = percentage >= 80 ? SUCCESS : percentage >= 50 ? WARNING : DANGER;
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: BORDER }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%`, background: barColor }} />
    </div>
  );
};

const FilterField = ({ label, children, style }) => (
  <label className="flex flex-col gap-1.5 min-w-0" style={style}>
    <span style={{ ...body, fontSize: '0.7rem', fontWeight: 600, color: MUTED }}>{label}</span>
    {children}
  </label>
);

const controlStyle = { ...body, fontSize: '0.82rem', color: INK, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, height: 40, padding: '0 12px', outline: 'none', width: '100%' };

const TaskAssignmentBoard = ({ title, subtitle, role, storageKey }) => {
  // NOTE: `canManageTasks` is still accepted by this component's props, but no
  // edit/delete handlers exist in it, so no Edit/Delete controls are rendered.
  const [tasks, setTasks] = useState(() => getStoredTasks(storageKey) || []);
  const [scholarData, setScholarData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [viewRows, setViewRows] = useState([]);

  // Client-side filters (applied to the already-loaded `tasks`)
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [page, setPage] = useState(1);

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
              const eligibleScholars = scholarsForTask(scholars, t);
              const submitted = eligibleScholars.filter((s) => isApprovedForScholar(s, t.type, t)).length;
              return {
                id: `portal-${t.id}`,
                title: t.title,
                type: t.type,
                dueDate: t.due_date || '',
                recurring: t.recurring || 'None',
                createdByName: t.created_by_name || t.created_by || 'System',
                createdByRole: t.created_by_role || '',
                targetYearLevels: parseTargetLevels(t.target_year_levels),
                assignedOfficers: Array.isArray(t.assigned_officers) ? t.assigned_officers : [],
                assignedOfficerNames: Array.isArray(t.assigned_officer_names) ? t.assigned_officer_names : [],
                createdAt: t.created_at || '',
                submitted,
                total: eligibleScholars.length,
                source: t.source || 'portal',
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
              isBoardTaskType(task.type) &&
              !(typeof task.id === 'string' && task.id.startsWith('portal-'))
          )
        : [];

      const final = Array.from(new Map([...mapped, ...manualStored].map((task) => [task.id, task])).values());
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Escape closes the task details modal; background scroll is locked while open.
  useEffect(() => {
    if (!showViewModal) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setShowViewModal(false); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [showViewModal]);

  // Presentation-only: spins the Refresh button icon and re-runs the exact
  // same loadTasks() used everywhere else — no new request logic.
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTasks();
    setTimeout(() => setRefreshing(false), 400);
  };

  const taskGroups = useMemo(() => {
    const pending = [];
    const overdue = [];
    const done = [];

    tasks.forEach((task) => {
      const status = classifyTask(task);
      if (status === 'done') {
        done.push(task);
      } else if (status === 'overdue') {
        overdue.push(task);
      } else {
        pending.push(task);
      }
    });

    return { pending, overdue, done };
  }, [tasks]);

  // Year-level options: every level that actually has scholars or is targeted by a task.
  const yearLevelOptions = useMemo(() => {
    const set = new Set();
    scholarData.forEach((s) => { if (s.year_level) set.add(normalizeYearLevel(s.year_level)); });
    tasks.forEach((t) => getTaskTargetKeys(t).forEach((k) => set.add(k)));
    return [...set].sort((a, b) => yearRank(a) - yearRank(b));
  }, [scholarData, tasks]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (q && !`${task.title || ''} ${task.instructions || ''}`.toLowerCase().includes(q)) return false;
      if (typeFilter !== 'all' && task.type !== typeFilter) return false;
      if (statusFilter !== 'all' && classifyTask(task) !== statusFilter) return false;
      if (yearFilter !== 'all') {
        const targets = getTaskTargetKeys(task);
        // A task with no target levels applies to every year level.
        if (targets.length && !targets.includes(yearFilter)) return false;
      }
      return true;
    });
  }, [tasks, search, typeFilter, statusFilter, yearFilter]);

  // Any filter change returns to page 1.
  useEffect(() => { setPage(1); }, [search, typeFilter, statusFilter, yearFilter]);

  const hasFilters = !!search || typeFilter !== 'all' || statusFilter !== 'all' || yearFilter !== 'all';
  const resetFilters = () => { setSearch(''); setTypeFilter('all'); setStatusFilter('all'); setYearFilter('all'); };

  const pages = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageTasks = filteredTasks.slice(pageStart, pageStart + PAGE_SIZE);

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
    const rows = scholarsForTask(scholarData, task).map((scholar) => {
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

  const todayLabel = new Date().toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const detailsOpen = showViewModal && !!selectedTask;
  const approvedRowCount = viewRows.filter((row) => row.statusKey === 'approved').length;
  const totalSubmissionCount = viewRows.reduce((sum, row) => sum + Number(row.count || 0), 0);

  const thStyle = { ...body, fontSize: '0.72rem', fontWeight: 700, color: MUTED, padding: '11px 14px', textAlign: 'left', background: BG, borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' };
  const tdStyle = { padding: '13px 14px', verticalAlign: 'middle' };

  return (
    <div className="min-h-screen overflow-x-hidden p-4 sm:p-6 lg:p-8" style={{ background: BG, ...body }}>
      <GlobalStyle />
      <div className="mx-auto flex flex-col gap-5" style={{ maxWidth: 1560 }}>

        {/* ── Standard Officer header: title card + date card ── */}
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-4">
          <Card style={{ padding: '20px 24px' }}>
            <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: GOLD }}>{role ? `${role} Portal` : 'Officer Portal'}</p>
            <h1 style={{ ...display, fontSize: '1.9rem', fontWeight: 700, color: INK, marginTop: 4, lineHeight: 1.15 }}>{title || 'Task Assignment'}</h1>
            <p style={{ ...body, fontSize: '0.85rem', color: MUTED, marginTop: 6 }}>{subtitle || 'Create and manage document submission tasks for your assigned scholars.'}</p>
          </Card>
          <Card className="flex items-center gap-3.5" style={{ padding: '16px 22px', minWidth: 230 }}>
            <span className="flex items-center justify-center flex-shrink-0 rounded-full" style={{ width: 44, height: 44, background: `${PRIMARY}12`, color: PRIMARY }}>
              <CalendarDays size={20} strokeWidth={1.8} />
            </span>
            <div>
              <p style={{ ...body, fontSize: '0.7rem', color: MUTED }}>Today</p>
              <p style={{ ...body, fontSize: '0.92rem', fontWeight: 600, color: INK }}>{todayLabel}</p>
            </div>
          </Card>
        </div>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={ClipboardList} label="Total Tasks" value={tasks.length} color={PRIMARY} />
          <KpiCard icon={Clock3} label="In Progress" value={taskGroups.pending.length} color={WARNING} />
          <KpiCard icon={AlertTriangle} label="Overdue" value={taskGroups.overdue.length} color={DANGER} />
          <KpiCard icon={CheckCircle2} label="Completed" value={taskGroups.done.length} color={SUCCESS} />
        </div>

        {/* ── Task filters ── */}
        <Card style={{ padding: '16px 20px' }}>
          <div className="flex items-center gap-2.5 mb-3.5">
            <span className="flex items-center justify-center rounded-full" style={{ width: 30, height: 30, background: `${GOLD}18`, color: GOLD }}>
              <SlidersHorizontal size={14} />
            </span>
            <h2 style={{ ...display, fontSize: '1.05rem', fontWeight: 700, color: INK }}>Task Filters</h2>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <FilterField label="Search" style={{ flex: '1 1 240px' }}>
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#B8A999' }} />
                <input className="ta-input" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search tasks"
                  placeholder="Task title or description…" style={{ ...controlStyle, paddingLeft: 34 }} />
              </div>
            </FilterField>
            <FilterField label="Task type" style={{ flex: '0 1 190px' }}>
              <select className="ta-input" style={controlStyle} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Task type">
                <option value="all">All Types</option>
                {BOARD_TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </FilterField>
            <FilterField label="Status" style={{ flex: '0 1 180px' }}>
              <select className="ta-input" style={controlStyle} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status">
                <option value="all">All Statuses</option>
                <option value="pending">In Progress</option>
                <option value="overdue">Overdue</option>
                <option value="done">Completed</option>
              </select>
            </FilterField>
            <FilterField label="Assigned year level" style={{ flex: '0 1 200px' }}>
              <select className="ta-input" style={controlStyle} value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} aria-label="Assigned year level">
                <option value="all">All Year Levels</option>
                {yearLevelOptions.map((k) => <option key={k} value={k}>{yearLevelLabel(k)}</option>)}
              </select>
            </FilterField>
            <button type="button" onClick={resetFilters} disabled={!hasFilters} className="ta-btn"
              style={{ ...outlineBtn, height: 40, padding: '0 16px', color: PRIMARY, border: `1px solid ${PRIMARY}`, opacity: hasFilters ? 1 : 0.5, cursor: hasFilters ? 'pointer' : 'default' }}>
              Reset Filters
            </button>
            <button type="button" onClick={handleRefresh} className="ta-btn"
              style={{ ...outlineBtn, height: 40, padding: '0 16px', color: '#fff', background: PRIMARY, border: `1px solid ${PRIMARY}` }}>
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </Card>

        {/* ── Task list + centered task-details modal ── */}
        <div className="ta-layout">
          <Card className="min-w-0" style={{ overflow: 'hidden', alignSelf: 'start' }}>
            <div className="flex items-center gap-2.5 px-5 pt-4 pb-3.5" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <span className="flex items-center justify-center rounded-full" style={{ width: 30, height: 30, background: `${PRIMARY}10`, color: PRIMARY }}>
                <ClipboardList size={14} />
              </span>
              <h2 style={{ ...display, fontSize: '1.05rem', fontWeight: 700, color: INK }}>Task Assignment List</h2>
              {!loading && <span style={{ ...mono, fontSize: '0.68rem', fontWeight: 700, color: PRIMARY, background: `${PRIMARY}10`, borderRadius: 999, padding: '2px 9px' }}>{filteredTasks.length}</span>}
            </div>

            {loading ? (
              <div className="p-5 flex flex-col gap-3" aria-busy="true" aria-label="Loading scholar submission progress">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse flex items-center gap-4">
                    <div style={{ height: 14, flex: 2, background: '#EFE7D8', borderRadius: 6 }} />
                    <div style={{ height: 14, flex: 1, background: '#EFE7D8', borderRadius: 6 }} />
                    <div style={{ height: 14, flex: 1, background: '#EFE7D8', borderRadius: 6 }} />
                    <div style={{ height: 14, flex: 1, background: '#EFE7D8', borderRadius: 6 }} />
                  </div>
                ))}
                <p style={{ ...body, fontSize: '0.8rem', color: MUTED }}>Loading scholar submission progress...</p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center" style={{ padding: '56px 20px' }}>
                <span className="flex items-center justify-center rounded-full" style={{ width: 48, height: 48, background: `${GOLD}16`, marginBottom: 14 }}>
                  <ClipboardList size={21} style={{ color: GOLD }} />
                </span>
                <p style={{ ...display, fontSize: '1.05rem', fontWeight: 700, color: INK }}>No tasks available</p>
                <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginTop: 4, maxWidth: 340 }}>No tasks are currently assigned. Progress is calculated from actual accepted uploads.</p>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center" style={{ padding: '48px 20px' }}>
                <p style={{ ...display, fontSize: '1.05rem', fontWeight: 700, color: INK }}>No matching tasks</p>
                <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginTop: 4 }}>Try adjusting your search or filters.</p>
              </div>
            ) : (
              <>
                <div className="ta-scroll overflow-x-auto">
                  <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 880 }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Task Title</th>
                        <th style={thStyle}>Type</th>
                        <th style={thStyle}>Assigned Year Levels</th>
                        <th style={thStyle}>Deadline</th>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>Progress</th>
                        <th style={thStyle}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageTasks.map((task) => {
                        const status = classifyTask(task);
                        const percentage = task.total > 0 ? Math.round((task.submitted / task.total) * 100) : 0;
                        const barColor = percentage >= 80 ? SUCCESS : percentage >= 50 ? WARNING : DANGER;
                        const selected = detailsOpen && selectedTask.id === task.id;
                        return (
                          <tr key={task.id} className="ta-row" style={{ borderTop: `1px solid ${BORDER}`, background: selected ? `${PRIMARY}0d` : undefined, boxShadow: selected ? `inset 3px 0 0 ${PRIMARY}` : 'none' }}>
                            <td style={{ ...tdStyle, maxWidth: 280 }}>
                              <p className="break-words" style={{ ...body, fontSize: '0.86rem', fontWeight: 700, color: INK }}>{task.title}</p>
                              {task.instructions && <p className="ta-clamp break-words" style={{ ...body, fontSize: '0.74rem', color: MUTED, marginTop: 2 }}>{task.instructions}</p>}
                            </td>
                            <td style={tdStyle}><TypeBadge type={task.type} /></td>
                            <td style={tdStyle}>
                              <LevelChips keys={getTaskTargetKeys(task)} />
                              <p style={{ ...body, fontSize: '0.7rem', color: MUTED, marginTop: 3 }}>{task.total} scholar{task.total === 1 ? '' : 's'}</p>
                            </td>
                            <td style={{ ...tdStyle, whiteSpace: 'nowrap', ...body, fontSize: '0.8rem', fontWeight: 600, color: status === 'overdue' ? DANGER : INK }}>
                              {formatDisplayDate(task.dueDate)}
                            </td>
                            <td style={tdStyle}><TaskStatusBadge status={status} /></td>
                            <td style={{ ...tdStyle, minWidth: 140 }}>
                              <div className="flex items-baseline justify-between gap-2 mb-1.5">
                                <span style={{ ...mono, fontSize: '0.74rem', fontWeight: 700, color: INK }}>{task.submitted}/{task.total}</span>
                                <span style={{ ...mono, fontSize: '0.68rem', fontWeight: 700, color: barColor }}>{percentage}%</span>
                              </div>
                              <ProgressBar submitted={task.submitted} total={task.total} />
                            </td>
                            <td style={tdStyle}>
                              <button type="button" onClick={() => openViewModal(task)} className="ta-btn" aria-label={`View submissions for ${task.title}`}
                                style={{ ...outlineBtn, padding: '6px 12px', fontSize: '0.74rem', color: PRIMARY, border: `1px solid ${PRIMARY}` }}>
                                <Eye size={13} /> View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5" style={{ borderTop: `1px solid ${BORDER}` }}>
                  <p style={{ ...body, fontSize: '0.76rem', color: MUTED }}>
                    Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredTasks.length)} of {filteredTasks.length} task{filteredTasks.length === 1 ? '' : 's'}
                  </p>
                  {pages > 1 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1} aria-label="Previous page" className="ta-btn"
                        style={{ ...body, width: 32, height: 32, borderRadius: 10, border: `1px solid ${BORDER}`, background: SURFACE, color: INK, opacity: currentPage <= 1 ? 0.4 : 1, cursor: currentPage <= 1 ? 'default' : 'pointer' }}>‹</button>
                      {pageWindow(currentPage, pages).map((n, i) => n === '…'
                        ? <span key={`gap-${i}`} style={{ ...body, fontSize: '0.8rem', color: MUTED, padding: '0 4px' }}>…</span>
                        : (
                          <button key={n} type="button" onClick={() => setPage(n)} aria-current={currentPage === n ? 'page' : undefined} className="ta-btn"
                            style={{ ...body, minWidth: 32, height: 32, padding: '0 6px', borderRadius: 10, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                              border: `1px solid ${currentPage === n ? PRIMARY : BORDER}`, background: currentPage === n ? PRIMARY : SURFACE, color: currentPage === n ? '#fff' : INK }}>{n}</button>
                        ))}
                      <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pages} aria-label="Next page" className="ta-btn"
                        style={{ ...body, width: 32, height: 32, borderRadius: 10, border: `1px solid ${BORDER}`, background: SURFACE, color: INK, opacity: currentPage >= pages ? 0.4 : 1, cursor: currentPage >= pages ? 'default' : 'pointer' }}>›</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </Card>

          {/* ── Selected task details: centered modal ── */}
          {detailsOpen && (() => {
            const status = classifyTask(selectedTask);
            const targets = getTaskTargetKeys(selectedTask);
            const percentage = selectedTask.total > 0 ? Math.round((selectedTask.submitted / selectedTask.total) * 100) : 0;
            return (
              <div className="td-wrap" onClick={() => setShowViewModal(false)}>
                <aside className="td-panel" role="dialog" aria-modal="true" aria-label="Task details" onClick={(e) => e.stopPropagation()}
                  style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: SHADOW }}>
                  <div className="flex items-center justify-between gap-3 flex-shrink-0" style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, background: SURFACE }}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 30, height: 30, background: `${PRIMARY}10`, color: PRIMARY }}>
                        <ClipboardList size={14} />
                      </span>
                      <h2 style={{ ...display, fontSize: '1.05rem', fontWeight: 700, color: INK }}>Task Details</h2>
                    </div>
                    <button type="button" onClick={() => setShowViewModal(false)} aria-label="Close task details" className="ta-btn"
                      style={{ padding: 6, borderRadius: 10, border: 'none', background: 'none', color: MUTED, cursor: 'pointer' }}>
                      <X size={18} />
                    </button>
                  </div>

                  <div className="td-body" style={{ padding: 20 }}>
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="break-words" style={{ ...body, fontSize: '1rem', fontWeight: 700, color: INK, lineHeight: 1.3 }}>{selectedTask.title}</h3>
                      <TaskStatusBadge status={status} />
                    </div>
                    <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 4 }}>
                      {selectedTask.isPastDue ? 'Due date has passed — final compliance list' : 'Real scholar submission breakdown for this task'}
                    </p>

                    <dl className="mt-4 grid gap-2.5" style={{ gridTemplateColumns: 'auto minmax(0, 1fr)', columnGap: 18 }}>
                      <dt style={{ ...body, fontSize: '0.76rem', color: MUTED }}>Type</dt>
                      <dd><TypeBadge type={selectedTask.type} /></dd>
                      <dt style={{ ...body, fontSize: '0.76rem', color: MUTED }}>Assigned</dt>
                      <dd style={{ ...body, fontSize: '0.8rem', fontWeight: 600, color: INK }}>
                        <LevelChips keys={targets} max={3} />
                        <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 400, color: MUTED, marginTop: 3 }}>{selectedTask.total} scholar{selectedTask.total === 1 ? '' : 's'}</span>
                      </dd>
                      <dt style={{ ...body, fontSize: '0.76rem', color: MUTED }}>Deadline</dt>
                      <dd style={{ ...body, fontSize: '0.8rem', fontWeight: 600, color: status === 'overdue' ? DANGER : INK }}>{formatDisplayDate(selectedTask.dueDate)}</dd>
                      <dt style={{ ...body, fontSize: '0.76rem', color: MUTED }}>Recurring</dt>
                      <dd style={{ ...body, fontSize: '0.8rem', fontWeight: 600, color: INK }}>{selectedTask.recurring}</dd>
                    </dl>

                    {selectedTask.instructions && (
                      <div className="mt-4">
                        <p style={{ ...body, fontSize: '0.72rem', fontWeight: 600, color: MUTED }}>Description</p>
                        <p className="break-words" style={{ ...body, fontSize: '0.8rem', color: INK, lineHeight: 1.55, marginTop: 3 }}>{selectedTask.instructions}</p>
                      </div>
                    )}

                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span style={{ ...body, fontSize: '0.72rem', fontWeight: 600, color: MUTED }}>Progress (accepted)</span>
                        <span style={{ ...mono, fontSize: '0.74rem', fontWeight: 700, color: INK }}>{selectedTask.submitted}/{selectedTask.total} ({percentage}%)</span>
                      </div>
                      <ProgressBar submitted={selectedTask.submitted} total={selectedTask.total} height={7} />
                      <p style={{ ...body, fontSize: '0.72rem', color: MUTED, marginTop: 6 }}>{totalSubmissionCount} submission{totalSubmissionCount === 1 ? '' : 's'} recorded</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-4">
                      <button type="button" onClick={() => exportTaskCompliancePdf(selectedTask)} className="ta-btn" style={{ ...outlineBtn, padding: '7px 13px', fontSize: '0.74rem' }}>
                        <FileDown size={13} /> Export PDF
                      </button>
                      <button type="button" onClick={() => exportTaskCompliance(selectedTask)} className="ta-btn" style={{ ...outlineBtn, padding: '7px 13px', fontSize: '0.74rem' }}>
                        <ArrowUpRight size={13} /> Export CSV
                      </button>
                    </div>

                    <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
                      <p style={{ ...body, fontSize: '0.78rem', fontWeight: 700, color: INK, marginBottom: 10 }}>Submitted Scholars</p>
                      {viewRows.length === 0 ? (
                        <div className="p-4 rounded-xl" style={{ background: BG, color: MUTED, ...body, fontSize: '0.8rem' }}>No scholar submission data is available yet.</div>
                      ) : (
                        <div className="flex flex-col gap-2.5">
                          <div className="px-3.5 py-2.5 rounded-xl" style={{ background: `${SUCCESS}14`, color: SUCCESS, ...body, fontSize: '0.78rem', fontWeight: 700 }}>
                            {approvedRowCount} scholar{approvedRowCount === 1 ? '' : 's'} complied.
                          </div>
                          {viewRows.map((row) => {
                            const badge = STATUS_BADGE[row.statusKey] || STATUS_BADGE.none;
                            return (
                              <div key={row.scholar_id} className="p-3.5 rounded-xl" style={{ background: BG }}>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="break-words" style={{ ...body, fontSize: '0.82rem', fontWeight: 700, color: INK }}>{row.fullName}</p>
                                    <p style={{ ...mono, fontSize: '0.68rem', color: MUTED }}>{row.scholar_id} · {row.count} submission{row.count === 1 ? '' : 's'}</p>
                                  </div>
                                  <span className="flex-shrink-0 whitespace-nowrap" style={{ ...body, fontSize: '0.68rem', fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: badge.bg, color: badge.text }}>{row.statusLabel}</span>
                                </div>
                                {row.latestSubmittedAt && (
                                  <p style={{ ...mono, fontSize: '0.66rem', color: MUTED, marginTop: 5 }}>Latest: {new Date(row.latestSubmittedAt).toLocaleString()}</p>
                                )}
                                {row.staffComment && (
                                  <p style={{ ...body, fontSize: '0.74rem', fontStyle: 'italic', color: MUTED, marginTop: 5 }}>Officer feedback: "{row.staffComment}"</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </aside>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

const GlobalStyle = () => (
  <style>{`
    .ta-input:focus { border-color: ${PRIMARY} !important; box-shadow: 0 0 0 3px rgba(109,33,64,.10); }
    .ta-btn:focus-visible { outline: 2px solid ${PRIMARY}; outline-offset: 2px; }
    .ta-row { transition: background-color 150ms ease; }
    .ta-row:hover { background: #FBF7EE; }
    .ta-scroll::-webkit-scrollbar { height: 6px; }
    .ta-scroll::-webkit-scrollbar-thumb { background: rgba(109,33,64,.18); border-radius: 999px; }
    .ta-clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

    /* Task details: centered modal */
    .td-wrap { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(36,21,18,0.55); backdrop-filter: blur(4px); }
    .td-panel { display: flex; flex-direction: column; width: 100%; max-width: 680px; max-height: 90vh; overflow: hidden; }
    .td-body { flex: 1; min-height: 0; overflow-y: auto; }
  `}</style>
);

export default TaskAssignmentBoard;