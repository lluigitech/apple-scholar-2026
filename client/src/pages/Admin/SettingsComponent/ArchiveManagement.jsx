import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
    Archive, Download, Eye, RotateCcw, Trash2, Search, ShieldCheck, FileText,
    Clock3, AlertTriangle, GraduationCap, Info, RefreshCw, X, Database,
} from 'lucide-react';
import { formatAdminDate } from '../../../utils/adminPreferences';
import AdminPageHeader from '../../../components/Admin/AdminPageHeader';

const API = 'http://localhost:5000/api';

/* ════════════════════════════════════════════════════════════════
   SCHOLAR ARCHIVE — BACKEND CONTRACT (EDIT THIS BLOCK ONLY)
   I could not see the backend, so nothing here is invented as fact.
   Point these at the endpoints User Management already uses for
   "Archive Scholar". Anything left null shows a clear message
   instead of calling a made-up URL.
   ════════════════════════════════════════════════════════════════ */
const SCHOLAR_API = {
    // Existing user list endpoint (named in the spec). Archived scholars are
    // picked out client-side by isArchivedScholar() below.
    list: `${API}/admin/users`,
    // VERIFY: the restore call User Management uses, e.g. (id) => ({ method: 'put', url: `${API}/admin/users/${id}/...` })
    restore: null,
    // VERIFY: scholar profile / history endpoint, e.g. (id) => `${API}/...`
    detail: null,
    // Existing endpoint already used by the Analytics Dashboard: one row per scholar with `completionRate`.
    // Used ONLY to attach a compliance status to archived scholars (see complianceFor() below).
    complianceSummary: `${API}/admin/reports/compliance-summary`,
};

// VERIFY: map the real archive fields here. Candidates are tried in order.
const pick = (obj, keys) => {
    for (const k of keys) if (obj?.[k] !== undefined && obj?.[k] !== null && obj?.[k] !== '') return obj[k];
    return null;
};
const isArchivedScholar = (u) => {
    if ((u.role || '').toLowerCase() !== 'scholar') return false;
    if (u.is_archived === true || u.is_archived === 1 || u.archived === true || u.archived === 1) return true;
    return ['archived'].includes(String(u.status || u.lifecycle_status || '').toLowerCase());
};
const normalizeScholar = (u) => {
    const archivedAt = pick(u, ['archived_at', 'archivedAt', 'date_archived']);
    const retention = pick(u, ['retention_until', 'retentionUntil']) || (archivedAt ? addYears(archivedAt, 5) : null);
    return {
        id: u.id,
        name: pick(u, ['full_name', 'name', 'scholar_name']) || [u.first_name, u.last_name].filter(Boolean).join(' ') || null,
        email: pick(u, ['email']),
        scholarId: pick(u, ['scholar_id', 'scholarId', 'student_id']),
        yearLevel: pick(u, ['year_level', 'yearLevel', 'year']),
        archivedAt,
        retentionUntil: retention,
        status: 'Archived',
        raw: u,
    };
};

/* ── Compliance status ──
   Same vocabulary and thresholds the Analytics Dashboard already applies to
   `completionRate` from the compliance summary: >= 75 Compliant, 50–74 Pending,
   < 50 Non-compliant. A scholar with no matching summary row (or no numeric
   completionRate) has NO status — it is never defaulted to a category. */
const summaryScholarKey = (item) => {
    const v = item?.studentId ?? item?.scholar_id ?? item?.scholarId;
    return v === undefined || v === null || v === '' ? null : String(v);
};
const complianceFromRate = (rate) => {
    if (rate === undefined || rate === null || rate === '') return null;
    const n = Number(rate);
    if (!Number.isFinite(n)) return null;
    if (n >= 75) return 'compliant';
    if (n >= 50) return 'pending';
    return 'noncompliant';
};

/* ── Design tokens ── */
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const PRIMARY = '#6D2140';
const PRIMARY_DEEP = '#4A1730';
const PRIMARY_TINT = '#F3E7EC';
const INK = '#241512';
const MUTED = '#8A7A68';
const BRONZE = '#A9784E';
const BRONZE_TINT = 'rgba(169,120,78,.12)';
const SUCCESS = '#6B8F71';
const SUCCESS_TINT = 'rgba(107,143,113,.12)';
const WARNING = '#C08A3E';
const WARNING_TINT = 'rgba(192,138,62,.14)';
const DANGER = '#A24A4A';
const DANGER_TINT = 'rgba(162,74,74,.10)';
const RADIUS = 16;
const SHADOW = '0 1px 2px rgba(74,23,48,.04), 0 4px 14px rgba(74,23,48,.04)';

const display = { fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', ui-monospace, Menlo, monospace" };

const COMPLIANCE_META = {
    compliant: { label: 'Compliant', color: SUCCESS, tint: SUCCESS_TINT },
    pending: { label: 'Pending', color: WARNING, tint: WARNING_TINT },
    noncompliant: { label: 'Non-compliant', color: DANGER, tint: DANGER_TINT },
};

const PAGE_SIZE = 8;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const EXPIRING_YEARS = 0.5; // "within 6 months"

const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const formatDate = (v) => (v ? formatAdminDate(v, { month: 'short' }) : '—');
const previewUrl = (path) => `${API}/submission/preview?url=${encodeURIComponent(path)}`;
const addYears = (value, n) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    d.setFullYear(d.getFullYear() + n);
    return d.toISOString();
};
const getInitials = (name) =>
    name ? name.trim().split(/\s+/).map((n) => n[0]).slice(0, 2).join('').toUpperCase() : '?';

/* Retention: 'ok' | 'expiring' | 'expired'. "expired" = eligible for review, never auto-deleted. */
const retentionState = (retentionUntil) => {
    if (!retentionUntil) return null;
    const yrs = (new Date(retentionUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 365.25);
    if (Number.isNaN(yrs)) return null;
    if (yrs <= 0) return 'expired';
    return yrs < EXPIRING_YEARS ? 'expiring' : 'ok';
};
const RET_STYLE = {
    ok: { color: SUCCESS, tint: SUCCESS_TINT, sub: 'Within retention' },
    expiring: { color: WARNING, tint: WARNING_TINT, sub: 'Expiring soon' },
    expired: { color: DANGER, tint: DANGER_TINT, sub: 'Eligible for disposal review' },
};

const docStatusMeta = (value) => {
    const v = (value || '').toLowerCase();
    if (v === 'archived') return { label: value, color: PRIMARY, tint: PRIMARY_TINT };
    if (v === 'expired') return { label: value, color: DANGER, tint: DANGER_TINT };
    return { label: value || 'Active', color: SUCCESS, tint: SUCCESS_TINT };
};

/* VERIFY: which keys of the scholar-detail response feed each section.
   Only keys that exist in the response are shown; nothing is fabricated. */
const RECORD_SECTIONS = [
    { title: 'Scholarship', keys: ['scholarship', 'scholarship_info', 'scholarships'] },
    { title: 'Academic record', keys: ['grades', 'academic_records', 'academics'] },
    { title: 'Attendance', keys: ['attendance', 'attendance_records'] },
    { title: 'Service hours', keys: ['service_hours', 'serviceHours', 'duty_logs'] },
    { title: 'Compliance', keys: ['compliance', 'compliance_records', 'compliance_history'] },
    { title: 'Reports / history', keys: ['reports', 'history', 'correspondence', 'activity'] },
];
const asRows = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? [v] : []);
const summarize = (row) => Object.entries(row || {})
    .filter(([k, v]) => v !== null && v !== '' && typeof v !== 'object' && !/(^id$|_id$|password|token)/i.test(k))
    .slice(0, 4).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join('  ·  ');

/* ── Small shared pieces ── */
const fieldStyle = {
    ...body, fontSize: '0.85rem', color: INK, background: SURFACE, border: `1px solid ${BORDER}`,
    borderRadius: 12, padding: '0 14px', height: 44, outline: 'none', width: '100%',
};
const Skeleton = ({ style }) => (
    <div className="skeleton-pulse" style={{ background: '#EFE7D8', borderRadius: 8, ...style }} />
);
const Pill = ({ color, tint, children, dot }) => (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1"
        style={{ ...body, fontSize: '0.72rem', fontWeight: 600, color, background: tint, borderRadius: 999, whiteSpace: 'nowrap' }}>
        {dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />}
        {children}
    </span>
);
const CompliancePill = ({ status }) => {
    const meta = COMPLIANCE_META[status];
    return meta
        ? <Pill color={meta.color} tint={meta.tint} dot>{meta.label}</Pill>
        : <span style={{ ...body, fontSize: '0.78rem', color: MUTED }}>—</span>;
};
const Avatar = ({ name, size = 34 }) => (
    <div className="flex items-center justify-center shrink-0"
        style={{ width: size, height: size, borderRadius: '50%', background: PRIMARY_TINT, color: PRIMARY }}>
        <span style={{ ...body, fontSize: '0.68rem', fontWeight: 700 }}>{getInitials(name)}</span>
    </div>
);
const ActionBtn = ({ icon: Icon, label, onClick, href, target, download, danger, title }) => {
    const style = {
        ...body, display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: label ? '0 12px' : '0 9px',
        fontSize: '0.76rem', fontWeight: 600, borderRadius: 10, cursor: 'pointer',
        color: danger ? DANGER : INK, background: SURFACE, border: `1px solid ${BORDER}`,
    };
    const content = (<><Icon size={14} />{label}</>);
    return href
        ? <a href={href} target={target} download={download} title={title || label} aria-label={title || label} className="act-btn" style={style}>{content}</a>
        : <button onClick={onClick} title={title || label} aria-label={title || label} className="act-btn" style={style}>{content}</button>;
};
const KpiCard = ({ label, value, sub, icon: Icon, color, tint, valueColor }) => (
    <div className="flex items-center gap-4" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '16px 20px', boxShadow: SHADOW }}>
        <div className="flex items-center justify-center shrink-0" style={{ width: 44, height: 44, borderRadius: '50%', background: tint }}>
            <Icon size={20} strokeWidth={1.8} style={{ color }} />
        </div>
        <div className="min-w-0">
            <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color }}>{label}</p>
            <p style={{ ...display, fontSize: '1.8rem', fontWeight: 700, color: valueColor || INK, lineHeight: 1.1, marginTop: 2 }}>{value}</p>
            <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 2 }}>{sub}</p>
        </div>
    </div>
);
const Banner = ({ tone, children }) => {
    const isErr = tone === 'error';
    const Icon = isErr ? AlertTriangle : ShieldCheck;
    const c = isErr ? DANGER : SUCCESS;
    return (
        <div className="flex items-start gap-2.5 px-4 py-3" style={{ background: isErr ? DANGER_TINT : SUCCESS_TINT, border: `1px solid ${isErr ? 'rgba(162,74,74,.25)' : 'rgba(107,143,113,.25)'}`, borderRadius: 14, marginBottom: 16 }}>
            <Icon size={16} style={{ color: c, marginTop: 1, flexShrink: 0 }} />
            <span style={{ ...body, fontSize: '0.83rem', color: c }}>{children}</span>
        </div>
    );
};
const EmptyState = ({ title, text, action }) => (
    <div className="flex flex-col items-center gap-3 text-center" style={{ padding: '48px 24px' }}>
        <div className="flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: '50%', background: PRIMARY_TINT }}>
            <Archive size={22} strokeWidth={1.6} style={{ color: PRIMARY }} />
        </div>
        <p style={{ ...display, fontSize: '1.1rem', fontWeight: 600, color: INK }}>{title}</p>
        <p className="max-w-sm" style={{ ...body, fontSize: '0.84rem', lineHeight: 1.6, color: MUTED }}>{text}</p>
        {action}
    </div>
);
const TableSkeleton = () => (
    <div style={{ padding: 20 }}>
        {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4" style={{ padding: '12px 0', borderTop: i ? `1px solid ${BORDER}` : 'none' }}>
                <Skeleton style={{ width: 34, height: 34, borderRadius: '50%' }} />
                <Skeleton style={{ flex: 1, height: 14 }} />
                <Skeleton style={{ width: 90, height: 14 }} />
                <Skeleton style={{ width: 90, height: 14 }} />
            </div>
        ))}
    </div>
);
const pageWindow = (page, pages) => {
    if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
    const set = new Set([1, pages, page - 1, page, page + 1]);
    if (page <= 3) { set.add(2); set.add(3); set.add(4); }
    if (page >= pages - 2) { set.add(pages - 1); set.add(pages - 2); set.add(pages - 3); }
    const list = [...set].filter((n) => n >= 1 && n <= pages).sort((x, y) => x - y);
    return list.flatMap((n, i) => (i && n - list[i - 1] > 1 ? ['…', n] : [n]));
};
const Pagination = ({ page, pages, total, shown, noun, onChange }) => {
    const nav = (label, target, disabled) => (
        <button key={label} onClick={() => onChange(target)} disabled={disabled} aria-label={label === '‹' ? 'Previous page' : 'Next page'}
            style={{ ...body, width: 32, height: 32, borderRadius: 10, fontSize: '0.9rem', fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
                border: `1px solid ${BORDER}`, background: SURFACE, color: INK, opacity: disabled ? 0.4 : 1 }}>
            {label}
        </button>
    );
    return (
        <div className="flex flex-wrap items-center justify-between gap-3" style={{ padding: '14px 22px', borderTop: `1px solid ${BORDER}` }}>
            <p style={{ ...body, fontSize: '0.78rem', color: MUTED }}>
                Showing {shown.from}–{shown.to} of {total} {noun}
            </p>
            {pages > 1 && (
                <div className="flex flex-wrap items-center gap-1.5">
                    {nav('‹', page - 1, page <= 1)}
                    {pageWindow(page, pages).map((n, i) => n === '…'
                        ? <span key={`gap-${i}`} style={{ ...body, fontSize: '0.8rem', color: MUTED, padding: '0 4px' }}>…</span>
                        : (
                            <button key={n} onClick={() => onChange(n)} aria-current={page === n ? 'page' : undefined}
                                style={{ ...body, minWidth: 32, height: 32, padding: '0 6px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                    border: `1px solid ${page === n ? PRIMARY : BORDER}`, background: page === n ? PRIMARY : SURFACE, color: page === n ? '#fff' : INK }}>
                                {n}
                            </button>
                        ))}
                    {nav('›', page + 1, page >= pages)}
                </div>
            )}
        </div>
    );
};
const Modal = ({ title, onClose, children, footer, wide }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(36,21,18,.45)' }} onClick={onClose}>
        <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
            style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, width: '100%', maxWidth: wide ? 640 : 440, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(74,23,48,.18)' }}>
            <div className="flex items-center justify-between" style={{ padding: '18px 22px', borderBottom: `1px solid ${BORDER}` }}>
                <h3 style={{ ...display, fontSize: '1.15rem', fontWeight: 700, color: INK }}>{title}</h3>
                <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: MUTED }}><X size={18} /></button>
            </div>
            <div style={{ padding: 22, overflowY: 'auto' }}>{children}</div>
            {footer && <div className="flex justify-end gap-2" style={{ padding: '14px 22px', borderTop: `1px solid ${BORDER}` }}>{footer}</div>}
        </div>
    </div>
);
const Field = ({ label, children }) => (
    <div>
        <p style={{ ...body, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTED }}>{label}</p>
        <div style={{ ...body, fontSize: '0.88rem', color: INK, marginTop: 3 }}>{children || '—'}</div>
    </div>
);
const FilterField = ({ label, children, style }) => (
    <label className="flex flex-col gap-1.5" style={style}>
        <span style={{ ...body, fontSize: '0.7rem', fontWeight: 600, color: MUTED }}>{label}</span>
        {children}
    </label>
);

/* ════════════════════════════════════════════════════════════════ */
export default function ArchiveManagement() {
    const role = (localStorage.getItem('role') || '').toLowerCase();

    const [tab, setTab] = useState('scholars'); // 'scholars' | 'documents'
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    /* scholars */
    const [scholars, setScholars] = useState([]);
    const [scholarsLoading, setScholarsLoading] = useState(true);
    const [sSearch, setSSearch] = useState('');
    const [sYear, setSYear] = useState('');
    const [sStatus, setSStatus] = useState('');
    const [sArchYear, setSArchYear] = useState('');
    const [sCompliance, setSCompliance] = useState('');
    const [sPage, setSPage] = useState(1);
    const [viewing, setViewing] = useState(null);
    const [viewData, setViewData] = useState(null);
    const [viewLoading, setViewLoading] = useState(false);
    const [viewDocs, setViewDocs] = useState([]);
    const [viewDocsLoading, setViewDocsLoading] = useState(false);
    const [restoring, setRestoring] = useState(null);
    const [restoreBusy, setRestoreBusy] = useState(false);

    /* compliance summary (existing endpoint, used only to look up each archived scholar) */
    const [complianceRows, setComplianceRows] = useState([]);
    const [complianceLoading, setComplianceLoading] = useState(true);

    /* documents (existing behaviour preserved) */
    const docState = 1; // Archive Management only views/restores; archiving happens in System Reports
    const [docs, setDocs] = useState([]);
    const [docsLoading, setDocsLoading] = useState(false);
    const [dSearch, setDSearch] = useState('');
    const [category, setCategory] = useState('');
    const [year, setYear] = useState('');
    const [dPage, setDPage] = useState(1);
    const [dMonth, setDMonth] = useState('');
    const [dRetention, setDRetention] = useState('');
    const [archivedDocsAll, setArchivedDocsAll] = useState([]); // unfiltered, for KPIs

    const loadScholars = useCallback(async () => {
        setScholarsLoading(true);
        try {
            const res = await axios.get(SCHOLAR_API.list, auth());
            const list = Array.isArray(res.data) ? res.data : res.data?.users || [];
            setScholars(list.filter(isArchivedScholar).map(normalizeScholar));
        } catch (e) {
            setError(e.response?.data?.error || 'Unable to load archived scholars.');
        } finally {
            setScholarsLoading(false);
        }
    }, []);

    // Optional enrichment: a failure here never raises the page error banner; the
    // Compliance Status filter is simply withheld (see complianceAvailable).
    const loadCompliance = useCallback(async () => {
        setComplianceLoading(true);
        try {
            const res = await axios.get(SCHOLAR_API.complianceSummary, auth());
            setComplianceRows(Array.isArray(res.data) ? res.data : []);
        } catch {
            setComplianceRows([]);
        } finally {
            setComplianceLoading(false);
        }
    }, []);

    const loadDocs = useCallback(async () => {
        setDocsLoading(true);
        try {
            const res = await axios.get(`${API}/archive/documents`, {
                ...auth(),
                params: { archived: docState === 1, search: dSearch, category, year },
            });
            setDocs(res.data || []);
        } catch (e) {
            setError(e.response?.data?.error || 'Unable to load archive records.');
        } finally {
            setDocsLoading(false);
        }
    }, [docState, dSearch, category, year]);

    const loadArchivedDocsForKpis = useCallback(async () => {
        try {
            const res = await axios.get(`${API}/archive/documents`, { ...auth(), params: { archived: true } });
            setArchivedDocsAll(res.data || []);
        } catch {
            setArchivedDocsAll([]);
        }
    }, []);

    useEffect(() => { loadScholars(); loadCompliance(); loadArchivedDocsForKpis(); }, [loadScholars, loadCompliance, loadArchivedDocsForKpis]);
    useEffect(() => { loadDocs(); }, [loadDocs]);
    useEffect(() => { setSPage(1); }, [sSearch, sYear, sStatus, sArchYear, sCompliance]);
    useEffect(() => { setDPage(1); }, [docState, dSearch, category, year, dMonth, dRetention]);

    const refresh = () => { setError(''); setMessage(''); loadScholars(); loadCompliance(); loadDocs(); loadArchivedDocsForKpis(); };

    /* ── document actions (same endpoints as before) ── */
    const mutateDoc = async (action, id) => {
        setError(''); setMessage('');
        try {
            const row = typeof id === 'object' ? id : null;
            const recordId = row?.record_type === 'submission' ? row.record_id : row?.id || id;
            if (action === 'delete' && !window.confirm('Permanently delete this document record? The stored physical file will not be removed automatically.')) return;
            const request = row?.record_type === 'submission'
                ? axios.put(`${API}/submission/archive/${recordId}/restore`, {}, auth())
                : action === 'delete'
                    ? axios.delete(`${API}/document/${recordId}`, auth())
                    : axios.put(`${API}/${action === 'restore' ? `restore/${recordId}` : `archive/${recordId}`}`, {}, auth());
            const response = await request;
            setMessage(response.data?.message || 'Archive record updated.');
            loadDocs(); loadArchivedDocsForKpis();
        } catch (e) {
            setError(e.response?.data?.error || 'Unable to update archive record.');
        }
    };

    /* ── scholar actions ── */
    const openView = async (s) => {
        setViewing(s); setViewData(null); setViewDocs([]);

        // Documents: read-only, via the EXISTING document endpoint (no new API).
        // Scholar archiving does not touch document rows, so look at both states.
        setViewDocsLoading(true);
        try {
            const term = s.scholarId || s.name || '';
            const [a, b] = await Promise.all([false, true].map((archived) =>
                axios.get(`${API}/archive/documents`, { ...auth(), params: { archived, search: term, category: '', year: '' } })));
            const sameScholar = (d) => (s.scholarId && String(d.scholar_id) === String(s.scholarId)) || (!s.scholarId && d.scholar_name === s.name);
            const seen = new Set();
            setViewDocs([...(a.data || []), ...(b.data || [])].filter(sameScholar).filter((d) => !seen.has(d.id) && seen.add(d.id)));
        } catch {
            setViewDocs([]);
        } finally {
            setViewDocsLoading(false);
        }

        if (!SCHOLAR_API.detail) return;
        setViewLoading(true);
        try {
            const res = await axios.get(SCHOLAR_API.detail(s.id), auth());
            setViewData(res.data);
        } catch (e) {
            setError(e.response?.data?.error || 'Unable to load the full scholar record.');
        } finally {
            setViewLoading(false);
        }
    };

    const confirmRestore = async () => {
        if (!SCHOLAR_API.restore) {
            setRestoring(null);
            setError('Scholar restore is not connected yet. Set SCHOLAR_API.restore to the endpoint User Management uses.');
            return;
        }
        setRestoreBusy(true); setError(''); setMessage('');
        try {
            const { method = 'put', url, data = {} } = SCHOLAR_API.restore(restoring.id);
            const res = await axios({ method, url, data, ...auth() });
            setMessage(res.data?.message || 'Scholar restored to the active registry.');
            setRestoring(null);
            loadScholars();
        } catch (e) {
            setError(e.response?.data?.error || 'Unable to restore this scholar.');
            setRestoring(null);
        } finally {
            setRestoreBusy(false);
        }
    };

    /* ── derived: KPIs from real loaded data only ── */
    const kpis = useMemo(() => {
        const states = [
            ...scholars.map((s) => retentionState(s.retentionUntil)),
            ...archivedDocsAll.map((d) => retentionState(d.retention_until)),
        ];
        return {
            scholars: scholars.length,
            documents: archivedDocsAll.length,
            retained: states.filter((s) => s === 'ok' || s === 'expiring').length,
            expiring: states.filter((s) => s === 'expiring').length,
        };
    }, [scholars, archivedDocsAll]);

    const yearLevels = useMemo(() => [...new Set(scholars.map((s) => s.yearLevel).filter(Boolean))].sort(), [scholars]);

    const archivedYears = useMemo(() => [...new Set(scholars.map((s) => (s.archivedAt ? new Date(s.archivedAt).getFullYear() : null)).filter((y) => y && !Number.isNaN(y)))].sort((a, b) => b - a), [scholars]);

    /* Attach a compliance status to each archived scholar by Scholar ID.
       No match / no numeric completionRate => compliance stays null (never guessed). */
    const scholarRows = useMemo(() => {
        const byId = new Map();
        complianceRows.forEach((item) => {
            const key = summaryScholarKey(item);
            if (key !== null) byId.set(key, item);
        });
        return scholars.map((s) => {
            const item = s.scholarId !== null && s.scholarId !== undefined ? byId.get(String(s.scholarId)) : undefined;
            return { ...s, compliance: item ? complianceFromRate(item.completionRate) : null };
        });
    }, [scholars, complianceRows]);

    // The filter is offered only when real compliance data reaches at least one archived scholar.
    const complianceAvailable = useMemo(() => scholarRows.some((s) => s.compliance), [scholarRows]);

    const filteredScholars = useMemo(() => {
        const q = sSearch.trim().toLowerCase();
        return scholarRows.filter((s) => {
            if (sYear && s.yearLevel !== sYear) return false;
            if (sArchYear && String(s.archivedAt ? new Date(s.archivedAt).getFullYear() : '') !== sArchYear) return false;
            if (sStatus) {
                const st = retentionState(s.retentionUntil);
                if (sStatus === 'retained' && st !== 'ok') return false;
                if (sStatus === 'expiring' && st !== 'expiring') return false;
                if (sStatus === 'expired' && st !== 'expired') return false;
            }
            if (complianceAvailable && sCompliance) {
                if (sCompliance === 'none' ? s.compliance !== null : s.compliance !== sCompliance) return false;
            }
            if (!q) return true;
            return [s.name, s.email, s.scholarId, s.yearLevel].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
        });
    }, [scholarRows, sSearch, sYear, sStatus, sArchYear, sCompliance, complianceAvailable]);

    const paginate = (list, page) => {
        const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
        const start = (Math.min(page, pages) - 1) * PAGE_SIZE;
        return { items: list.slice(start, start + PAGE_SIZE), pages, from: list.length ? start + 1 : 0, to: Math.min(start + PAGE_SIZE, list.length) };
    };
    const sPaged = paginate(filteredScholars, sPage);
    // Document type options come from the real archived documents (not typed free-form).
    const docCategories = useMemo(() => [...new Set(archivedDocsAll.map((d) => d.category).filter(Boolean))].sort(), [archivedDocsAll]);
    // Month / retention are applied on the loaded rows; search, type and year still go to the server as before.
    const filteredDocs = useMemo(() => docs.filter((d) => {
        if (dMonth) {
            const t = new Date(d.uploaded_at);
            if (Number.isNaN(t.getTime()) || t.getMonth() + 1 !== Number(dMonth)) return false;
        }
        if (dRetention) {
            const st = retentionState(d.retention_until);
            if (dRetention === 'retained' && st !== 'ok') return false;
            if (dRetention === 'expiring' && st !== 'expiring') return false;
            if (dRetention === 'expired' && st !== 'expired') return false;
        }
        return true;
    }), [docs, dMonth, dRetention]);
    const dPaged = paginate(filteredDocs, dPage);
    const hasDocFilters = dSearch || category || year || dMonth || dRetention;
    const hasScholarFilters = sSearch || sYear || sStatus || sArchYear || (complianceAvailable && sCompliance);
    const showComplianceNote = !scholarsLoading && !complianceLoading && scholars.length > 0 && !complianceAvailable;

    const RetentionCell = ({ until }) => {
        const st = retentionState(until);
        const meta = st ? RET_STYLE[st] : null;
        return (
            <div>
                <p style={{ ...body, fontSize: '0.83rem', color: INK }}>{formatDate(until)}</p>
                {meta && (
                    <p className="inline-flex items-center gap-1.5" style={{ ...body, fontSize: '0.72rem', color: meta.color, marginTop: 1 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.color }} />{meta.sub}
                    </p>
                )}
            </div>
        );
    };

    const thStyle = { ...body, fontSize: '0.66rem', fontWeight: 700, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, background: BG, whiteSpace: 'nowrap' };
    const tdStyle = { padding: '12px 16px', verticalAlign: 'middle' };

    const scholarHeaders = ['#', 'Scholar', 'Scholar ID', 'Year Level', ...(complianceAvailable ? ['Compliance'] : []), 'Archived Date', 'Retention Until', 'Status', 'Action'];

    const tabBtn = (key, label, Icon) => (
        <button key={key} onClick={() => setTab(key)} className="seg-tab flex items-center gap-2" role="tab" aria-selected={tab === key}
            style={{ ...body, fontSize: '0.84rem', fontWeight: 600, padding: '10px 20px', borderRadius: '12px 12px 0 0', cursor: 'pointer',
                border: `1px solid ${tab === key ? PRIMARY : BORDER}`, borderBottom: 'none',
                background: tab === key ? PRIMARY : SURFACE, color: tab === key ? '#fff' : PRIMARY }}>
            <Icon size={15} />{label}
        </button>
    );

    const toolbarBand = { padding: '14px 22px', background: BG, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` };

    return (
        <section className="min-h-full" style={{ background: BG }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
                .exec-input:focus { border-color: ${PRIMARY} !important; box-shadow: 0 0 0 3px rgba(109,33,64,.10); }
                .rec-row { transition: background-color 150ms ease; }
                .rec-row:hover { background: #FBF7EE; }
                .act-btn { transition: background-color 150ms ease, border-color 150ms ease; text-decoration: none; }
                .act-btn:hover { background: ${BG} !important; border-color: ${BRONZE} !important; }
                .act-btn:focus-visible, .seg-tab:focus-visible { outline: 2px solid ${PRIMARY}; outline-offset: 2px; }
                .skeleton-pulse { animation: exec-pulse 1.4s ease-in-out infinite; }
                @keyframes exec-pulse { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
                @media (prefers-reduced-motion: reduce) { .skeleton-pulse { animation: none; } }
                .exec-table-scroll::-webkit-scrollbar { height: 6px; }
                .exec-table-scroll::-webkit-scrollbar-thumb { background: rgba(109,33,64,.18); border-radius: 999px; }
                .retention-aside { }
                @media (max-width: 640px) { .retention-aside { border-left: none !important; padding-left: 0 !important; text-align: left; } }
                .mobile-only { display: none; }
                .desktop-only { display: block; }
                @media (max-width: 860px) { .mobile-only { display: grid; } .desktop-only { display: none; } }
            `}</style>

            <div className="w-full px-4 sm:px-6 lg:px-8">

                <AdminPageHeader
                    title="Archive Management"
                    description="Manage historical scholar records and retained documents."
                    className="mb-5"
                    actions={
                        <button onClick={refresh} className="act-btn" style={{ ...body, display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 16px', borderRadius: 12, fontSize: '0.82rem', fontWeight: 600, color: PRIMARY, background: SURFACE, border: `1px solid ${PRIMARY}`, cursor: 'pointer' }}>
                            <RefreshCw size={14} />Refresh
                        </button>
                    }
                />

                {/* KPIs */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" style={{ marginBottom: 16 }}>
                    {scholarsLoading ? Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '16px 20px', minHeight: 92 }} className="flex items-center gap-4">
                            <Skeleton style={{ width: 44, height: 44, borderRadius: '50%' }} />
                            <div style={{ flex: 1 }}><Skeleton style={{ width: '60%', height: 11 }} /><Skeleton style={{ width: '35%', height: 24, marginTop: 8 }} /></div>
                        </div>
                    )) : (<>
                        <KpiCard label="Archived Scholars" value={kpis.scholars} sub="Scholar records archived" icon={GraduationCap} color={PRIMARY} tint={PRIMARY_TINT} valueColor={PRIMARY} />
                        <KpiCard label="Archived Documents" value={kpis.documents} sub="Submission records archived" icon={FileText} color={BRONZE} tint={BRONZE_TINT} />
                        <KpiCard label="Retained Records" value={kpis.retained} sub="Within retention period" icon={Database} color={SUCCESS} tint={SUCCESS_TINT} />
                        <KpiCard label="Expiring Soon" value={kpis.expiring} sub="Records within 6 months" icon={Clock3} color={WARNING} tint={WARNING_TINT} valueColor={WARNING} />
                    </>)}
                </div>

                {/* Retention policy */}
                <div className="flex flex-wrap items-center gap-4" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '16px 20px', marginBottom: 20, boxShadow: SHADOW }}>
                    <div className="flex items-center justify-center shrink-0" style={{ width: 44, height: 44, borderRadius: '50%', background: PRIMARY_TINT }}>
                        <Info size={20} style={{ color: PRIMARY }} />
                    </div>
                    <div className="flex-1" style={{ minWidth: 260 }}>
                        <h2 style={{ ...display, fontSize: '1.05rem', fontWeight: 700, color: INK }}>Retention Policy</h2>
                        <p style={{ ...body, fontSize: '0.83rem', lineHeight: 1.55, color: MUTED, marginTop: 2 }}>
                            All archived scholar records and documents are retained for 5 years from the date of archive.
                        </p>
                        <p style={{ ...body, fontSize: '0.83rem', lineHeight: 1.55, color: MUTED }}>
                            After 5 years, records become eligible for disposal review according to the organization's policy.
                        </p>
                    </div>
                    <div className="retention-aside text-center" style={{ minWidth: 140, paddingLeft: 22, borderLeft: `1px solid ${BORDER}` }}>
                        <p style={{ ...display, fontSize: '1.5rem', fontWeight: 700, color: PRIMARY, lineHeight: 1.1 }}>5 YEARS</p>
                        <p className="inline-flex items-center gap-1.5 mt-1" style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: SUCCESS }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: SUCCESS }} />Policy Active
                        </p>
                    </div>
                </div>

                {error && <Banner tone="error">{error}</Banner>}
                {message && <Banner tone="success">{message}</Banner>}

                {/* Tabs */}
                <div className="flex gap-1.5" role="tablist">
                    {tabBtn('scholars', 'Archived Scholars', GraduationCap)}
                    {tabBtn('documents', 'Archived Documents', FileText)}
                </div>

                <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: `0 ${RADIUS}px ${RADIUS}px ${RADIUS}px`, boxShadow: SHADOW, overflow: 'hidden', marginBottom: 32 }}>

                    {/* ═════════ ARCHIVED SCHOLARS ═════════ */}
                    {tab === 'scholars' && (<>
                        <div style={{ padding: '20px 22px 16px' }}>
                            <h2 style={{ ...display, fontSize: '1.25rem', fontWeight: 700, color: INK }}>Archived Scholars</h2>
                            <p style={{ ...body, fontSize: '0.84rem', color: MUTED, marginTop: 2 }}>Historical scholar records retained after scholarship completion.</p>
                        </div>
                        <div className="flex flex-wrap items-end gap-3" style={toolbarBand}>
                            <FilterField label="Search" style={{ flex: '1 1 260px', minWidth: 220 }}>
                                <div className="relative">
                                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
                                    <input className="exec-input" style={{ ...fieldStyle, height: 42, paddingLeft: 36 }} type="text"
                                        placeholder="Name, ID, or email…" aria-label="Search archived scholars"
                                        value={sSearch} onChange={(e) => setSSearch(e.target.value)} />
                                </div>
                            </FilterField>
                            <FilterField label="Year level" style={{ flex: '0 1 160px', minWidth: 140 }}>
                                <select className="exec-input filter-select" style={{ ...fieldStyle, height: 42 }} value={sYear} onChange={(e) => setSYear(e.target.value)} aria-label="Year level">
                                    <option value="">All Year Levels</option>
                                    {yearLevels.map((y) => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </FilterField>
                            {complianceAvailable && (
                                <FilterField label="Compliance status" style={{ flex: '0 1 180px', minWidth: 150 }}>
                                    <select className="exec-input filter-select" style={{ ...fieldStyle, height: 42 }} value={sCompliance} onChange={(e) => setSCompliance(e.target.value)} aria-label="Compliance status">
                                        <option value="">All Compliance Statuses</option>
                                        <option value="compliant">Compliant</option>
                                        <option value="pending">Pending</option>
                                        <option value="noncompliant">Non-compliant</option>
                                        <option value="none">No compliance data</option>
                                    </select>
                                </FilterField>
                            )}
                            <FilterField label="Retention status" style={{ flex: '0 1 190px', minWidth: 160 }}>
                                <select className="exec-input filter-select" style={{ ...fieldStyle, height: 42 }} value={sStatus} onChange={(e) => setSStatus(e.target.value)} aria-label="Retention status">
                                    <option value="">All Retention Statuses</option>
                                    <option value="retained">Within retention</option>
                                    <option value="expiring">Expiring soon</option>
                                    <option value="expired">Eligible for disposal</option>
                                </select>
                            </FilterField>
                            <FilterField label="Archived year" style={{ flex: '0 1 160px', minWidth: 140 }}>
                                <select className="exec-input filter-select" style={{ ...fieldStyle, height: 42 }} value={sArchYear} onChange={(e) => setSArchYear(e.target.value)} aria-label="Archived year">
                                    <option value="">All Archived Years</option>
                                    {archivedYears.map((y) => <option key={y} value={String(y)}>{y}</option>)}
                                </select>
                            </FilterField>
                            <button className="act-btn" disabled={!hasScholarFilters}
                                onClick={() => { setSSearch(''); setSYear(''); setSStatus(''); setSArchYear(''); setSCompliance(''); }}
                                style={{ ...body, display: 'inline-flex', alignItems: 'center', gap: 6, height: 42, padding: '0 18px', borderRadius: 12, fontSize: '0.82rem', fontWeight: 600, color: PRIMARY, background: SURFACE, border: `1px solid ${PRIMARY}`, cursor: hasScholarFilters ? 'pointer' : 'default', opacity: hasScholarFilters ? 1 : 0.5 }}>
                                Reset Filters
                            </button>
                        </div>
                        {showComplianceNote && (
                            <p style={{ ...body, fontSize: '0.76rem', color: MUTED, padding: '10px 22px 0' }}>
                                Compliance Status filter is unavailable: the compliance summary returned no rows matching these archived scholars.
                            </p>
                        )}

                        {scholarsLoading ? <TableSkeleton /> : !filteredScholars.length ? (
                            <EmptyState
                                title={hasScholarFilters ? 'No matching scholars' : 'No archived scholars'}
                                text={hasScholarFilters ? 'Try adjusting your search or filters.' : 'There are currently no scholars in the archive.'}
                                action={!hasScholarFilters && (
                                    <a href="/admin/users" className="act-btn" style={{ ...body, display: 'inline-flex', alignItems: 'center', height: 36, padding: '0 16px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 600, color: '#fff', background: PRIMARY, border: `1px solid ${PRIMARY}` }}>
                                        View Active Scholars
                                    </a>
                                )} />
                        ) : (<>
                            <div className="desktop-only exec-table-scroll overflow-x-auto">
                                <table className="w-full text-left" style={{ borderCollapse: 'collapse', minWidth: complianceAvailable ? 1020 : 900 }}>
                                    <thead><tr style={{ background: BG }}>
                                        {scholarHeaders.map((h) => <th key={h} style={thStyle}>{h}</th>)}
                                    </tr></thead>
                                    <tbody>
                                        {sPaged.items.map((s, idx) => (
                                            <tr key={s.id} className="rec-row" style={{ borderTop: `1px solid ${BORDER}` }}>
                                                <td style={{ ...tdStyle, ...body, fontSize: '0.8rem', color: MUTED, width: 44 }}>{sPaged.from + idx}</td>
                                                <td style={tdStyle}>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar name={s.name} />
                                                        <div className="min-w-0">
                                                            <p style={{ ...body, fontSize: '0.86rem', fontWeight: 600, color: INK }}>{s.name || '—'}</p>
                                                            <p style={{ ...body, fontSize: '0.74rem', color: MUTED }}>{s.email || ''}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ ...tdStyle, ...mono, fontSize: '0.78rem', color: INK }}>{s.scholarId || '—'}</td>
                                                <td style={{ ...tdStyle, ...body, fontSize: '0.83rem', color: INK }}>{s.yearLevel || '—'}</td>
                                                {complianceAvailable && <td style={tdStyle}><CompliancePill status={s.compliance} /></td>}
                                                <td style={{ ...tdStyle, ...body, fontSize: '0.83rem', color: INK }}>{formatDate(s.archivedAt)}</td>
                                                <td style={tdStyle}><RetentionCell until={s.retentionUntil} /></td>
                                                <td style={tdStyle}><Pill color={PRIMARY} tint={PRIMARY_TINT} dot>Archived</Pill></td>
                                                <td style={tdStyle}>
                                                    <div className="flex items-center gap-2">
                                                        <ActionBtn icon={Eye} label="View" onClick={() => openView(s)} />
                                                        <ActionBtn icon={RotateCcw} title="Restore scholar" onClick={() => setRestoring(s)} />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mobile-only gap-3" style={{ padding: 14 }}>
                                {sPaged.items.map((s) => (
                                    <div key={s.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16 }}>
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <Avatar name={s.name} />
                                                <div className="min-w-0">
                                                    <p className="truncate" style={{ ...body, fontSize: '0.86rem', fontWeight: 600, color: INK }}>{s.name || '—'}</p>
                                                    <p className="truncate" style={{ ...body, fontSize: '0.72rem', color: MUTED }}>{s.email || ''}</p>
                                                </div>
                                            </div>
                                            <Pill color={PRIMARY} tint={PRIMARY_TINT} dot>Archived</Pill>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 mt-3">
                                            <Field label="Scholar ID"><span style={mono}>{s.scholarId}</span></Field>
                                            <Field label="Year Level">{s.yearLevel}</Field>
                                            {complianceAvailable && <Field label="Compliance">{s.compliance ? <CompliancePill status={s.compliance} /> : null}</Field>}
                                            <Field label="Archived">{formatDate(s.archivedAt)}</Field>
                                            <Field label="Retention Until">{formatDate(s.retentionUntil)}</Field>
                                        </div>
                                        <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                                            <ActionBtn icon={Eye} label="View" onClick={() => openView(s)} />
                                            <ActionBtn icon={RotateCcw} label="Restore" onClick={() => setRestoring(s)} />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <Pagination page={Math.min(sPage, sPaged.pages)} pages={sPaged.pages} total={filteredScholars.length}
                                shown={{ from: sPaged.from, to: sPaged.to }} noun="archived scholars" onChange={setSPage} />
                        </>)}
                    </>)}

                    {/* ═════════ ARCHIVED DOCUMENTS (existing functionality) ═════════ */}
                    {tab === 'documents' && (<>
                        <div style={{ padding: '20px 22px 16px' }}>
                            <h2 style={{ ...display, fontSize: '1.25rem', fontWeight: 700, color: INK }}>Archived Documents</h2>
                            <p style={{ ...body, fontSize: '0.84rem', color: MUTED, marginTop: 2 }}>Retained files and archived submission records.</p>
                        </div>
                        <div className="flex flex-wrap items-end gap-3" style={toolbarBand}>
                            <FilterField label="Search" style={{ flex: '1 1 240px', minWidth: 200 }}>
                                <div className="relative">
                                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
                                    <input className="exec-input" style={{ ...fieldStyle, height: 42, paddingLeft: 36 }} type="text" placeholder="Scholar name, ID, or document…"
                                        aria-label="Search documents" value={dSearch} onChange={(e) => setDSearch(e.target.value)} />
                                </div>
                            </FilterField>
                            <FilterField label="Month uploaded" style={{ flex: '0 1 160px', minWidth: 140 }}>
                                <select className="exec-input filter-select" style={{ ...fieldStyle, height: 42 }} value={dMonth} onChange={(e) => setDMonth(e.target.value)} aria-label="Month uploaded">
                                    <option value="">All Months</option>
                                    {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
                                </select>
                            </FilterField>
                            <FilterField label="Year" style={{ flex: '0 1 110px', minWidth: 96 }}>
                                <input className="exec-input" style={{ ...fieldStyle, height: 42 }} type="text" inputMode="numeric" placeholder="e.g. 2026" aria-label="Year"
                                    value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} />
                            </FilterField>
                            <FilterField label="Document type" style={{ flex: '0 1 170px', minWidth: 140 }}>
                                <select className="exec-input filter-select" style={{ ...fieldStyle, height: 42 }} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Document type">
                                    <option value="">All Types</option>
                                    {category && !docCategories.includes(category) && <option value={category}>{category}</option>}
                                    {docCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </FilterField>
                            <FilterField label="Retention status" style={{ flex: '0 1 190px', minWidth: 160 }}>
                                <select className="exec-input filter-select" style={{ ...fieldStyle, height: 42 }} value={dRetention} onChange={(e) => setDRetention(e.target.value)} aria-label="Retention status">
                                    <option value="">All Retention Statuses</option>
                                    <option value="retained">Within retention</option>
                                    <option value="expiring">Expiring soon</option>
                                    <option value="expired">Eligible for disposal</option>
                                </select>
                            </FilterField>
                            <button className="act-btn" disabled={!hasDocFilters}
                                onClick={() => { setDSearch(''); setCategory(''); setYear(''); setDMonth(''); setDRetention(''); }}
                                style={{ ...body, display: 'inline-flex', alignItems: 'center', gap: 6, height: 42, padding: '0 18px', borderRadius: 12, fontSize: '0.82rem', fontWeight: 600, color: PRIMARY, background: SURFACE, border: `1px solid ${PRIMARY}`, cursor: hasDocFilters ? 'pointer' : 'default', opacity: hasDocFilters ? 1 : 0.5 }}>
                                Reset Filters
                            </button>
                        </div>

                        {docsLoading ? <TableSkeleton /> : !filteredDocs.length ? (
                            <EmptyState title={hasDocFilters ? 'No matching documents' : 'No archived documents'}
                                text={hasDocFilters ? 'Try adjusting your search or filters.' : 'There are currently no individually archived documents.'} />
                        ) : (<>
                            <div className="desktop-only exec-table-scroll overflow-x-auto">
                                <table className="w-full min-w-[900px] text-left" style={{ borderCollapse: 'collapse' }}>
                                    <thead><tr style={{ background: BG }}>
                                        {['Scholar', 'Document', 'Type', 'Uploaded', 'Retention', 'Status', 'Actions'].map((h) => <th key={h} style={thStyle}>{h}</th>)}
                                    </tr></thead>
                                    <tbody>
                                        {dPaged.items.map((row) => {
                                            const st = docStatusMeta(row.status);
                                            return (
                                                <tr key={`${row.record_type || 'document'}-${row.id}`} className="rec-row" style={{ borderTop: `1px solid ${BORDER}` }}>
                                                    <td style={tdStyle}>
                                                        <div className="flex items-center gap-3">
                                                            <Avatar name={row.scholar_name} size={32} />
                                                            <div>
                                                                <p style={{ ...body, fontSize: '0.85rem', fontWeight: 600, color: INK }}>{row.scholar_name || '—'}</p>
                                                                {row.scholar_id && <p style={{ ...mono, fontSize: '0.68rem', color: MUTED, marginTop: 1 }}>{row.scholar_id}</p>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={tdStyle}>
                                                        <div className="flex items-center gap-2">
                                                            <FileText size={14} style={{ color: BRONZE, flexShrink: 0 }} />
                                                            <span className="truncate" style={{ ...body, fontSize: '0.84rem', color: INK }}>{row.file_name || '—'}</span>
                                                        </div>
                                                    </td>
                                                    <td style={tdStyle}>
                                                        <span className="inline-flex items-center px-2.5 py-1" style={{ ...body, fontSize: '0.72rem', fontWeight: 600, color: BRONZE, border: `1px solid ${BRONZE}55`, borderRadius: 999 }}>{row.category || '—'}</span>
                                                    </td>
                                                    <td style={{ ...tdStyle, ...body, fontSize: '0.83rem', color: MUTED }}>{formatDate(row.uploaded_at)}</td>
                                                    <td style={tdStyle}><RetentionCell until={row.retention_until} /></td>
                                                    <td style={tdStyle}><Pill color={st.color} tint={st.tint}>{st.label}</Pill></td>
                                                    <td style={tdStyle}>
                                                        <div className="flex items-center gap-1.5">
                                                            {row.file_path && (<>
                                                                <ActionBtn icon={Eye} href={previewUrl(row.file_path)} target="_blank" title="View" />
                                                                <ActionBtn icon={Download} href={previewUrl(row.file_path)} target="_blank" download title="Download" />
                                                            </>)}
                                                            {docState === 1 && <ActionBtn icon={RotateCcw} onClick={() => mutateDoc('restore', row)} title="Restore" />}
                                                            {role === 'admin' && row.record_type !== 'submission' && <ActionBtn icon={Trash2} onClick={() => mutateDoc('delete', row)} title="Delete" danger />}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mobile-only gap-3" style={{ padding: 14 }}>
                                {dPaged.items.map((row) => {
                                    const st = docStatusMeta(row.status);
                                    return (
                                        <div key={`${row.record_type || 'document'}-${row.id}`} style={{ border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16 }}>
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <Avatar name={row.scholar_name} />
                                                    <div className="min-w-0">
                                                        <p className="truncate" style={{ ...body, fontSize: '0.86rem', fontWeight: 600, color: INK }}>{row.scholar_name || '—'}</p>
                                                        <p className="truncate" style={{ ...body, fontSize: '0.72rem', color: MUTED }}>{row.file_name || '—'}</p>
                                                    </div>
                                                </div>
                                                <Pill color={st.color} tint={st.tint}>{st.label}</Pill>
                                            </div>
                                            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3">
                                                <p style={{ ...body, fontSize: '0.74rem', color: MUTED }}>Uploaded {formatDate(row.uploaded_at)}</p>
                                                <p style={{ ...body, fontSize: '0.74rem', color: MUTED }}>Retention {formatDate(row.retention_until)}</p>
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                                                {row.file_path && (<>
                                                    <ActionBtn icon={Eye} href={previewUrl(row.file_path)} target="_blank" title="View" />
                                                    <ActionBtn icon={Download} href={previewUrl(row.file_path)} target="_blank" download title="Download" />
                                                </>)}
                                                {docState === 1 && <ActionBtn icon={RotateCcw} onClick={() => mutateDoc('restore', row)} title="Restore" />}
                                                {role === 'admin' && row.record_type !== 'submission' && <ActionBtn icon={Trash2} onClick={() => mutateDoc('delete', row)} title="Delete" danger />}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <Pagination page={Math.min(dPage, dPaged.pages)} pages={dPaged.pages} total={filteredDocs.length}
                                shown={{ from: dPaged.from, to: dPaged.to }} noun="documents" onChange={setDPage} />
                        </>)}
                    </>)}
                </div>
            </div>

            {/* Restore confirmation */}
            {restoring && (
                <Modal title="Restore scholar?" onClose={() => !restoreBusy && setRestoring(null)}
                    footer={<>
                        <button className="act-btn" onClick={() => setRestoring(null)} disabled={restoreBusy}
                            style={{ ...body, height: 38, padding: '0 16px', borderRadius: 10, fontSize: '0.82rem', fontWeight: 600, color: INK, background: SURFACE, border: `1px solid ${BORDER}`, cursor: 'pointer' }}>Cancel</button>
                        <button onClick={confirmRestore} disabled={restoreBusy}
                            style={{ ...body, height: 38, padding: '0 16px', borderRadius: 10, fontSize: '0.82rem', fontWeight: 600, color: '#fff', background: PRIMARY, border: `1px solid ${PRIMARY}`, cursor: 'pointer', opacity: restoreBusy ? 0.7 : 1 }}>
                            {restoreBusy ? 'Restoring…' : 'Restore Scholar'}
                        </button>
                    </>}>
                    <div className="flex flex-col items-center text-center">
                        <Avatar name={restoring.name} size={52} />
                        <p style={{ ...display, fontSize: '1.15rem', fontWeight: 700, color: INK, marginTop: 12 }}>{restoring.name || 'This scholar'}</p>
                        <p style={{ ...body, fontSize: '0.8rem', color: MUTED }}>{restoring.email}</p>
                        <p className="mt-4" style={{ ...body, fontSize: '0.86rem', lineHeight: 1.6, color: INK }}>
                            This scholar will return to the active scholar registry and appear again in User Management.
                        </p>
                        <p className="mt-2" style={{ ...body, fontSize: '0.8rem', lineHeight: 1.6, color: MUTED }}>
                            No account is recreated and no historical records are removed.
                        </p>
                    </div>
                </Modal>
            )}

            {/* Scholar historical record */}
            {viewing && (
                <Modal title="Historical scholar record" wide onClose={() => setViewing(null)}
                    footer={<button className="act-btn" onClick={() => setViewing(null)}
                        style={{ ...body, height: 38, padding: '0 16px', borderRadius: 10, fontSize: '0.82rem', fontWeight: 600, color: INK, background: SURFACE, border: `1px solid ${BORDER}`, cursor: 'pointer' }}>Close</button>}>
                    <div className="flex items-center gap-3" style={{ marginBottom: 18 }}>
                        <Avatar name={viewing.name} size={44} />
                        <div>
                            <p style={{ ...display, fontSize: '1.1rem', fontWeight: 700, color: INK }}>{viewing.name || '—'}</p>
                            <p style={{ ...body, fontSize: '0.8rem', color: MUTED }}>{viewing.email}</p>
                        </div>
                        <div className="ml-auto"><Pill color={PRIMARY} tint={PRIMARY_TINT} dot>Archived</Pill></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Scholar ID"><span style={mono}>{viewing.scholarId}</span></Field>
                        <Field label="Year Level">{viewing.yearLevel}</Field>
                        <Field label="Archived Date">{formatDate(viewing.archivedAt)}</Field>
                        <Field label="Retention Until">{formatDate(viewing.retentionUntil)}</Field>
                    </div>

                    <div className="flex items-start gap-2.5 px-3.5 py-3" style={{ background: BG, borderRadius: 12, marginTop: 18 }}>
                        <Info size={15} style={{ color: BRONZE, marginTop: 2, flexShrink: 0 }} />
                        <p style={{ ...body, fontSize: '0.8rem', lineHeight: 1.55, color: MUTED }}>
                            This is an archived, read-only historical record. Documents and related records are preserved with the scholar and were not individually archived.
                        </p>
                    </div>

                    {/* Documents: existing document records, read-only */}
                    <div style={{ marginTop: 20 }}>
                        <p style={{ ...body, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTED, marginBottom: 8 }}>Documents</p>
                        {viewDocsLoading ? <Skeleton style={{ height: 14, width: '70%' }} /> : !viewDocs.length ? (
                            <p style={{ ...body, fontSize: '0.82rem', color: MUTED }}>No documents found for this scholar.</p>
                        ) : (
                            <div className="grid gap-2">
                                {viewDocs.map((d) => (
                                    <div key={d.id} className="flex items-center gap-3" style={{ padding: '10px 14px', background: BG, borderRadius: 12 }}>
                                        <FileText size={14} style={{ color: BRONZE, flexShrink: 0 }} />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate" style={{ ...body, fontSize: '0.84rem', color: INK }}>{d.file_name || '—'}</p>
                                            <p style={{ ...body, fontSize: '0.72rem', color: MUTED }}>{[d.category, formatDate(d.uploaded_at)].filter(Boolean).join('  ·  ')}</p>
                                        </div>
                                        {d.file_path && <ActionBtn icon={Eye} href={previewUrl(d.file_path)} target="_blank" title="View document" />}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Other historical sections: only what the backend returns */}
                    {!SCHOLAR_API.detail ? (
                        <p style={{ ...body, fontSize: '0.82rem', lineHeight: 1.6, color: MUTED, marginTop: 20 }}>
                            Scholarship, academic, attendance, service hour, compliance and report history are preserved. Connect <code style={mono}>SCHOLAR_API.detail</code> to the existing scholar profile endpoint to display them here.
                        </p>
                    ) : viewLoading ? (
                        <div style={{ marginTop: 20 }}><Skeleton style={{ height: 14, width: '80%' }} /><Skeleton style={{ height: 14, width: '60%', marginTop: 10 }} /></div>
                    ) : viewData && RECORD_SECTIONS.map(({ title, keys }) => {
                        const key = keys.find((k) => viewData[k] !== undefined && viewData[k] !== null);
                        const rows = key ? asRows(viewData[key]) : [];
                        return (
                            <div key={title} style={{ marginTop: 20 }}>
                                <p style={{ ...body, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTED, marginBottom: 8 }}>
                                    {title}{rows.length > 1 ? ` (${rows.length})` : ''}
                                </p>
                                {!rows.length ? <p style={{ ...body, fontSize: '0.82rem', color: MUTED }}>No records on file.</p> : (
                                    <div className="grid gap-2">
                                        {rows.slice(0, 20).map((r, i) => (
                                            <p key={r?.id ?? i} style={{ ...body, fontSize: '0.8rem', color: INK, padding: '9px 14px', background: BG, borderRadius: 12 }}>{summarize(r) || '—'}</p>
                                        ))}
                                        {rows.length > 20 && <p style={{ ...body, fontSize: '0.74rem', color: MUTED }}>Showing 20 of {rows.length}.</p>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </Modal>
            )}
        </section>
    );
}