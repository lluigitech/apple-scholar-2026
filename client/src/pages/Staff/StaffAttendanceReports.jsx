import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
    CalendarDays, Search, Download, ChevronDown, ChevronLeft, ChevronRight,
    CheckCircle2, XCircle, Clock,
    FileText, Inbox, MapPin, RotateCcw, UserX, Users,
} from 'lucide-react';
import { buildSummaryRows, currentPeriodLabel, downloadReportSummaryPdf } from '../../utils/reportPdfExport';
import {
    DEFAULT_STAFF_WORK_PREFERENCES,
    readStaffWorkPreferences,
} from '../../utils/staffWorkPreferences';

const API = 'http://localhost:5000/api';
const authHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
});

// ── Apple Scholar design system (tokens unchanged) ──
const PRIMARY = '#6D2140';
const PRIMARY_DARK = '#4A1730';
const GOLD = '#A9784E';
const BG = '#F3EEE6';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const INK = '#241512';
const MUTED = '#8A7A68';
const SUCCESS = '#3F8A55';
const WARNING = '#B8863F';
const DANGER = '#C1666B';

const body = { fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif" };

const STATUS_CONFIG = {
    present: { label: 'Present', icon: CheckCircle2, color: SUCCESS },
    late:    { label: 'Late',    icon: Clock,         color: WARNING },
    absent:  { label: 'Absent',  icon: XCircle,       color: DANGER },
};

// Raw year-level codes → readable labels, per the required conversion table.
const YEAR_LEVEL_LABELS = {
    grade_7: 'Grade 7', grade_8: 'Grade 8', grade_9: 'Grade 9', grade_10: 'Grade 10',
    grade_11: 'Grade 11', grade_12: 'Grade 12',
    college_1: '1st Year College', college_2: '2nd Year College',
    college_3: '3rd Year College', college_4: '4th Year College', college_5: '5th Year College',
};
const formatYearLevelLabel = (value) => YEAR_LEVEL_LABELS[value] || value || 'Unassigned';

const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const getGroupDutyKey = (record) => JSON.stringify([
    record.group_name || 'Unassigned',
    record.duty || 'Duty',
]);

const getGroupDutyLabel = (record) =>
    `${record.group_name || 'Unassigned'} / ${record.duty || 'Duty'}`;

const getAttendanceMethodLabel = (method) => {
    const normalizedMethod = String(method || 'manual').trim().toLowerCase();
    if (normalizedMethod === 'qr') return 'QR Code';
    if (normalizedMethod === 'manual') return 'Manual';
    return normalizedMethod ? normalizedMethod.replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()) : 'Manual';
};

// Date-only strings (YYYY-MM-DD) are read as LOCAL dates so they never shift a day.
const parseRecordDate = (value) => {
    if (!value) return null;
    const text = String(value).trim();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T00:00:00`) : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const formatDay = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const formatClock = (date) => date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};
const formatAttendanceClock = (value) => {
    const date = parseRecordDate(value);
    return date ? formatClock(date) : '—';
};

const StatusBadge = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.absent;
    const Icon = cfg.icon;
    return (
        <span className="status-badge" style={{ color: cfg.color, background: `${cfg.color}16` }}>
            <Icon size={12} />
            {cfg.label}
        </span>
    );
};

// One table row for a single attendance record.
const AttendanceRow = ({ record, index }) => {
    const day = parseRecordDate(record.date || record.duty_date || record.marked_at);
    const checkedIn = record.status === 'present' || record.status === 'late';
    const inTime = checkedIn ? parseRecordDate(record.marked_at) : null;
    const outAt = parseRecordDate(record.check_out_at);

    return (
        <tr>
            <td className="col-num">{index}</td>
            <td>
                <div className="scholar-cell">
                    <span className="duty-avatar"><span>{getInitials(record.scholar)}</span></span>
                    <div className="min-w-0">
                        <p className="cell-title truncate" title={record.scholar || 'Unknown Scholar'}>{record.scholar || 'Unknown Scholar'}</p>
                        <p className="cell-sub truncate">{record.scholar_id || '—'}</p>
                    </div>
                </div>
            </td>
            <td className="cell-text">{formatYearLevelLabel(record.year_level)}</td>
            <td className="cell-text">
                <span className="clamp-2" title={getGroupDutyLabel(record)}>{getGroupDutyLabel(record)}</span>
            </td>
            <td className="cell-text">{getAttendanceMethodLabel(record.method)}</td>
            <td className="cell-text">
                <span className="loc-cell">
                    <MapPin size={13} style={{ color: GOLD, flexShrink: 0 }} />
                    <span className="clamp-2">{record.location || 'No location'}</span>
                </span>
            </td>
            <td className="cell-text">
                {day ? formatDay(day) : 'No date'}
            </td>
            <td className="cell-text">
                {inTime
                    ? `${formatClock(inTime)} - ${outAt ? formatClock(outAt) : '—'}`
                    : '—'}
            </td>
            <td><StatusBadge status={record.status} /></td>
        </tr>
    );
};

const StaffAttendanceReports = () => {
    const navigate = useNavigate();
    const [workPreferenceState] = useState(() => {
        try {
            return { preferences: readStaffWorkPreferences(), error: '' };
        } catch (error) {
            console.error('Failed to read Staff work preferences:', error);
            return {
                preferences: { ...DEFAULT_STAFF_WORK_PREFERENCES },
                error: 'Saved report preferences could not be loaded from this browser. The report is using its default view.',
            };
        }
    });
    const workPreferences = workPreferenceState.preferences;
    const [records, setRecords]       = useState([]);
    const [duties, setDuties]         = useState([]);
    const [loading, setLoading]       = useState(true);
    const [search, setSearch]         = useState('');
    const [groupDutyFilter, setGroupDutyFilter] = useState('');
    const [methodFilter, setMethodFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState(workPreferences.attendanceStatus);
    const [monthFilter, setMonthFilter] = useState(getCurrentMonth);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [page, setPage]             = useState(1);
    const [pageSize, setPageSize]     = useState(workPreferences.pageSize);

    useEffect(() => {
        if (!localStorage.getItem('token')) {
            navigate('/login', { replace: true });
            return;
        }
        fetchAll();
    }, [navigate]);

    // Presentation-only: return to page 1 whenever any filter changes.
    useEffect(() => {
        setPage(1);
    }, [search, groupDutyFilter, methodFilter, statusFilter, monthFilter]);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [attendRes, dutiesRes] = await Promise.allSettled([
                axios.get(`${API}/staff/reports/duty-attendance`, authHeaders()),
                axios.get(`${API}/duties`, authHeaders()),
            ]);
            if (attendRes.status === 'fulfilled') {
                setRecords(attendRes.value.data.map(record => ({
                    ...record,
                    status: record.status === 'excused' ? 'absent' : record.status,
                })));
            }
            if (dutiesRes.status === 'fulfilled') setDuties(dutiesRes.value.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // All filters are applied locally to the full attendance dataset.
    const resetFilters = () => {
        setSearch('');
        setGroupDutyFilter('');
        setMethodFilter('');
        setStatusFilter(workPreferences.attendanceStatus);
        setMonthFilter(getCurrentMonth());
    };

    // ── Client-side filters ──────────────────────────────────
    const filtered = records.filter(r => {
        const matchSearch = !search ||
            r.scholar?.toLowerCase().includes(search.toLowerCase()) ||
            r.scholar_id?.toLowerCase().includes(search.toLowerCase());
        const matchGroupDuty = !groupDutyFilter || getGroupDutyKey(r) === groupDutyFilter;
        const matchMethod = !methodFilter || getAttendanceMethodLabel(r.method) === methodFilter;
        const matchStatus = statusFilter === 'all' || !statusFilter || r.status === statusFilter;
        const recordMonth = String(r.date || r.marked_at || r.duty_date || '').slice(0, 7);
        const matchMonth = !monthFilter || recordMonth === monthFilter;
        return matchSearch && matchGroupDuty && matchMethod && matchStatus && matchMonth;
    });

    // ── Stats ────────────────────────────────────────────────
    const stats = {
        total:   filtered.length,
        present: filtered.filter(r => r.status === 'present').length,
        absent:  filtered.filter(r => r.status === 'absent').length,
    };

    const rate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;

    // Scholars with the most absences in the current filtered view.
    const followUp = useMemo(() => {
        const counts = new Map();
        filtered.forEach(r => {
            if (r.status !== 'absent') return;
            const key = `${r.scholar || 'Unknown'}::${r.scholar_id || '—'}`;
            if (!counts.has(key)) counts.set(key, { name: r.scholar || 'Unknown Scholar', scholarId: r.scholar_id || '—', count: 0 });
            counts.get(key).count += 1;
        });
        return Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, 4);
    }, [filtered]);

    // ── Export to CSV (opens in Excel) ───────────────────────
    const exportCSV = () => {
        const headers = ['Scholar', 'Scholar ID', 'Year Level', 'Group / Duties', 'Check-in Method', 'Date', 'Time In - Out', 'Location', 'Status'];
        const rows = filtered.map(r => [
            r.scholar, r.scholar_id, r.year_level, getGroupDutyLabel(r), getAttendanceMethodLabel(r.method),
            r.date ? new Date(r.date).toLocaleDateString('en-PH') : '',
            (r.status === 'present' || r.status === 'late') && r.marked_at
                ? `${formatAttendanceClock(r.marked_at)} - ${r.check_out_at ? formatAttendanceClock(r.check_out_at) : '—'}`
                : '',
            r.location || '',
            r.status,
        ]);
        const csv = [headers, ...rows].map(row => row.map(v => `"${v ?? ''}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_report_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        // best-effort server log
        axios.post(`${API}/export/google-sheets`, { log_only: true, module: 'Attendance Report', report_resource: 'Staff Attendance', spreadsheet_title: `Attendance_Report_${new Date().toISOString().slice(0,10)}`, details: `attendance_report_${new Date().toISOString().split('T')[0]}.csv` }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).catch(() => {});
    };

    const exportPDF = async () => {
        setPdfLoading(true);
        try {
            const rows = buildSummaryRows(filtered, row => row.status === 'present');
            await downloadReportSummaryPdf({ role: 'staff', reportTitle: 'Attendance Reports', periodLabel: currentPeriodLabel(), rows });
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || 'Failed to generate the PDF report.');
        } finally {
            setPdfLoading(false);
        }
    };

    const uniqueGroupDuties = [...new Map(records.map(record => [
        getGroupDutyKey(record),
        { key: getGroupDutyKey(record), label: getGroupDutyLabel(record) },
    ])).values()].sort((a, b) => a.label.localeCompare(b.label));
    const uniqueMethods = [...new Set(records.map(record => getAttendanceMethodLabel(record.method)))]
        .sort((a, b) => a.localeCompare(b));

    // ── Presentation-only: pagination over the full `filtered` array ──
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage   = Math.min(page, totalPages);
    const startIdx   = (safePage - 1) * pageSize;
    const pageRecords = filtered.slice(startIdx, startIdx + pageSize);
    const rangeStart = filtered.length === 0 ? 0 : startIdx + 1;
    const rangeEnd   = Math.min(startIdx + pageSize, filtered.length);

    const pageNumbers = (() => {
        const windowSize = 5;
        let start = Math.max(1, safePage - Math.floor(windowSize / 2));
        let end = Math.min(totalPages, start + windowSize - 1);
        start = Math.max(1, end - windowSize + 1);
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    })();

    const pct = (n) => (stats.total > 0 ? `${((n / stats.total) * 100).toFixed(1)}% of total` : '0.0% of total');
    const kpis = [
        { key: 'total',   label: 'Total Records', value: stats.total,   sub: 'Across all filtered data', icon: FileText,      color: PRIMARY },
        { key: 'present', label: 'Present',       value: stats.present, sub: pct(stats.present),        icon: CheckCircle2,  color: SUCCESS },
        { key: 'absent',  label: 'Absent',        value: stats.absent,  sub: pct(stats.absent),         icon: XCircle,       color: DANGER },
    ];

    return (
        <div className="reports-hub" style={{ background: BG, ...body }}>
            <div className="hub-inner">

                {/* ── Standard Staff header ── */}
                <div className="hub-header hub-header-single">
                    <div className="hub-card hub-title-card staff-page-header-card">
                        <div className="hub-title-text">
                            <span className="staff-page-eyebrow">STAFF PORTAL</span>
                            <h1 className="staff-page-title">Attendance Reports</h1>
                            <p className="staff-page-description">Monitor scholar attendance and export institutional records.</p>
                        </div>
                    </div>
                </div>

                {workPreferenceState.error && (
                    <div role="alert" style={{
                        marginBottom: 14,
                        padding: '10px 14px',
                        color: DANGER,
                        background: `${DANGER}10`,
                        border: `1px solid ${DANGER}40`,
                        borderRadius: 12,
                        fontSize: '0.82rem',
                    }}>
                        {workPreferenceState.error}
                    </div>
                )}

                {/* ── KPI cards ── */}
                <div className="kpi-grid">
                    {kpis.map(({ key, label, value, sub, icon: Icon, color }) => (
                        <div key={key} className="hub-card kpi-card">
                            <span className="kpi-icon" style={{ background: `${color}14`, color }}>
                                <Icon size={22} />
                            </span>
                            <div className="min-w-0">
                                <span className="kpi-value">{loading ? '—' : value}</span>
                                <span className="kpi-label">{label}</span>
                                <span className="kpi-sub">{loading ? 'Loading…' : sub}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Filter toolbar ── */}
                <div className="hub-card filter-card">
                    <div className="filter-bar">
                        <div className="field">
                            <label htmlFor="att-month" className="field-label">Month</label>
                            <div className="input-wrap">
                                <CalendarDays size={14} className="lead-icon" />
                                <input id="att-month" type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} />
                            </div>
                        </div>
                        <div className="field">
                            <label htmlFor="att-group-duty" className="field-label">Group / Duties</label>
                            <div className="input-wrap">
                                <select id="att-group-duty" value={groupDutyFilter} onChange={e => setGroupDutyFilter(e.target.value)}>
                                    <option value="">All Groups / Duties</option>
                                    {uniqueGroupDuties.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
                                </select>
                                <ChevronDown size={14} className="select-chevron" />
                            </div>
                        </div>
                        <div className="field">
                            <label htmlFor="att-status" className="field-label">Status</label>
                            <div className="input-wrap">
                                <select id="att-status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                                    <option value="all">All Statuses</option>
                                    <option value="present">Present</option>
                                    <option value="late">Late</option>
                                    <option value="absent">Absent</option>
                                </select>
                                <ChevronDown size={14} className="select-chevron" />
                            </div>
                        </div>
                        <div className="field">
                            <label htmlFor="att-method" className="field-label">Check-in Method</label>
                            <div className="input-wrap">
                                <select id="att-method" value={methodFilter} onChange={e => setMethodFilter(e.target.value)}>
                                    <option value="">All Methods</option>
                                    {uniqueMethods.map(method => <option key={method} value={method}>{method}</option>)}
                                </select>
                                <ChevronDown size={14} className="select-chevron" />
                            </div>
                        </div>
                        <div className="field field-search">
                            <label htmlFor="att-search" className="field-label">Search Scholar</label>
                            <div className="input-wrap">
                                <Search size={14} className="lead-icon" />
                                <input id="att-search" type="text" placeholder="Search scholar name or ID…" value={search} onChange={e => setSearch(e.target.value)} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Attendance Records ── */}
                <div className="hub-card records-card">
                    <div className="records-head">
                        <div>
                            <h2>Attendance Records</h2>
                            <p>Records matching the selected filters.{!loading && stats.total > 0 && <> {rate}% present.</>}</p>
                        </div>
                        <div className="export-toolbar" role="group" aria-label="Export actions">
                            <button onClick={exportCSV} className="btn-outline">
                                <Download size={14} /> Export CSV
                            </button>
                            <button onClick={exportPDF} disabled={pdfLoading} className="btn-filled">
                                <FileText size={14} /> {pdfLoading ? 'Generating…' : 'Export PDF'}
                            </button>
                        </div>
                    </div>

                    <div className="table-shell">
                        <div className="table-scroll">
                            <table className={`att-table${workPreferences.density === 'compact' ? ' att-table-compact' : ''}`}>
                                <thead>
                                    <tr>
                                        <th className="col-num">#</th>
                                        <th>Scholar</th>
                                        <th>Year Level</th>
                                        <th>Group / Duties</th>
                                        <th>Check-in Method</th>
                                        <th>Location</th>
                                        <th>Date</th>
                                        <th>Time In - Out</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        Array(5).fill(0).map((_, i) => (
                                            <tr key={`sk-${i}`} className="skeleton-tr">
                                                <td colSpan={9}><div className="animate-pulse skeleton-bar" /></td>
                                            </tr>
                                        ))
                                    ) : pageRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="empty-cell">
                                                <div className="empty-state">
                                                    <div className="empty-icon"><Inbox size={22} style={{ color: GOLD }} /></div>
                                                    <p className="empty-title">No attendance records</p>
                                                    <p className="empty-text">Adjust or reset the filters to see more records.</p>
                                                    <button onClick={resetFilters} className="btn-outline" style={{ marginTop: 14 }}>
                                                        <RotateCcw size={13} /> Reset filters
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        pageRecords.map((record, i) => (
                                            <AttendanceRow
                                                key={record.id ?? `${record.scholar_id || 'x'}-${record.duty || 'd'}-${startIdx + i}`}
                                                record={record}
                                                index={startIdx + i + 1}
                                            />
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="pager">
                        <div className="pager-left">
                            <span className="pager-info">
                                Showing {rangeStart}–{rangeEnd} of {filtered.length} record{filtered.length === 1 ? '' : 's'}
                            </span>
                            <label className="pager-size">
                                <span>Rows</span>
                                <select
                                    value={pageSize}
                                    onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                                    aria-label="Rows per page"
                                >
                                    {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </label>
                        </div>
                        <nav className="pager-controls" aria-label="Pagination">
                            <button className="page-btn" onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage <= 1} aria-label="Previous page">
                                <ChevronLeft size={15} />
                            </button>
                            {pageNumbers.map(n => (
                                <button
                                    key={n}
                                    className={`page-btn${n === safePage ? ' page-btn-active' : ''}`}
                                    onClick={() => setPage(n)}
                                    aria-current={n === safePage ? 'page' : undefined}
                                >
                                    {n}
                                </button>
                            ))}
                            <button className="page-btn" onClick={() => setPage(Math.min(totalPages, safePage + 1))} disabled={safePage >= totalPages} aria-label="Next page">
                                <ChevronRight size={15} />
                            </button>
                            <span className="page-of">Page {safePage} of {totalPages}</span>
                        </nav>
                    </div>
                </div>

                {/* ── Needs follow-up (secondary) ── */}
                <div className="hub-card followup-card">
                    <div className="followup-head">
                        <span className="followup-kicker"><UserX size={14} /> Needs follow-up</span>
                        <span className="followup-note">Scholars with the most absences in the current filtered records.</span>
                    </div>
                    {followUp.length === 0 ? (
                        <p className="followup-empty">No repeat absences in the current view.</p>
                    ) : (
                        <div className="followup-list">
                            {followUp.map((s, i) => (
                                <div key={i} className="followup-row">
                                    <div className="min-w-0">
                                        <p className="cell-title truncate">{s.name}</p>
                                        <p className="cell-sub truncate">{s.scholarId}</p>
                                    </div>
                                    <span className="followup-count">{s.count}× absent</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <GlobalStyle />
        </div>
    );
};

const GlobalStyle = () => (
    <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .reports-hub { min-height: 100vh; overflow-x: hidden; }
        .reports-hub *, .reports-hub *::before, .reports-hub *::after { box-sizing: border-box; }
        .hub-inner { padding: 24px 20px 48px; width: 100%; }

        .hub-card {
            background: ${SURFACE};
            border: 1px solid ${BORDER};
            border-radius: 16px;
            box-shadow: 0 8px 20px -16px rgba(36,21,18,0.28);
        }

        /* ── Header ── */
        .hub-header { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 14px; margin-bottom: 14px; }
        .hub-header-single { grid-template-columns: minmax(0, 1fr); }
        .hub-title-card { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 24px; }
        .hub-title-text { min-width: 0; }
        .hub-title-text p { margin: 4px 0 0; }
        /* ── Buttons ── */
        .btn-outline, .btn-filled {
            display: inline-flex; align-items: center; justify-content: center; gap: 8px;
            height: 40px; padding: 0 16px; border-radius: 12px;
            font-family: 'Inter', sans-serif; font-size: 0.8rem; font-weight: 600; cursor: pointer; white-space: nowrap;
        }
        .btn-outline { background: ${SURFACE}; border: 1px solid ${PRIMARY}; color: ${PRIMARY}; flex-shrink: 0; }
        .btn-outline:hover:not(:disabled) { background: ${PRIMARY}0F; }
        .btn-filled { border: 1px solid ${PRIMARY}; color: #fff; background: linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%); }
        .btn-filled:hover:not(:disabled) { filter: brightness(1.1); }
        .btn-outline:disabled, .btn-filled:disabled { opacity: 0.6; cursor: default; }
        .btn-outline:focus-visible, .btn-filled:focus-visible, .page-btn:focus-visible { outline: 2px solid ${PRIMARY}; outline-offset: 2px; }

        /* ── KPI ── */
        .kpi-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-bottom: 14px; }
        .kpi-card { display: flex; align-items: center; gap: 16px; padding: 18px 20px; height: 100%; }
        .kpi-icon { width: 52px; height: 52px; border-radius: 14px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .kpi-value { display: block; font-family: 'Lora', Georgia, serif; font-size: 1.8rem; line-height: 1.1; font-weight: 700; color: ${PRIMARY}; }
        .kpi-label { display: block; font-size: 0.86rem; color: ${INK}; margin-top: 3px; }
        .kpi-sub { display: block; font-size: 0.74rem; color: ${MUTED}; margin-top: 2px; }

        /* ── Filters ── */
        .filter-card { padding: 16px 20px; margin-bottom: 14px; }
        .filter-bar { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
        .field { min-width: 0; flex: 1 1 150px; }
        .field-search { flex: 1.6 1 220px; }
        .field-label { display: block; font-size: 0.74rem; font-weight: 600; color: ${INK}; margin-bottom: 6px; }
        .input-wrap {
            position: relative; display: flex; align-items: center; gap: 8px;
            height: 42px; padding: 0 12px; background: #fff; border: 1px solid ${BORDER}; border-radius: 12px;
        }
        .input-wrap:focus-within { border-color: ${PRIMARY}; box-shadow: 0 0 0 3px ${PRIMARY}1F; }
        .lead-icon { color: ${MUTED}; flex-shrink: 0; }
        .input-wrap input, .input-wrap select {
            flex: 1; min-width: 0; width: 100%; height: 100%;
            border: none; outline: none; background: none; appearance: none; -webkit-appearance: none;
            font-family: 'Inter', sans-serif; font-size: 0.84rem; color: ${INK};
        }
        .input-wrap select { cursor: pointer; padding-right: 20px; }
        .select-chevron { position: absolute; right: 12px; color: ${MUTED}; pointer-events: none; }
        /* ── Records ── */
        .records-card { padding: 20px 22px; margin-bottom: 14px; }
        .records-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
        .records-head h2 { font-family: 'Lora', Georgia, serif; font-size: 1.4rem; font-weight: 700; color: ${PRIMARY}; margin: 0; }
        .records-head p { font-size: 0.82rem; color: ${MUTED}; margin: 3px 0 0; }
        .export-toolbar { display: flex; gap: 10px; flex-wrap: wrap; }

        .table-shell { border: 1px solid ${BORDER}; border-radius: 14px; overflow: hidden; background: ${SURFACE}; }
        .table-scroll { overflow-x: auto; }
        /* Keep the time range and status columns readable at all table widths. */
        .att-table { width: 100%; min-width: 1250px; border-collapse: collapse; table-layout: fixed; }
        .att-table thead th {
            background: ${BG}; color: ${INK}; font-size: 0.78rem; font-weight: 600; text-align: left;
            padding: 13px 14px; border-bottom: 1px solid ${BORDER}; white-space: nowrap;
        }
        .att-table tbody td { padding: 12px 14px; border-bottom: 1px solid ${BORDER}; vertical-align: middle; }
        .att-table-compact thead th { padding-top: 8px; padding-bottom: 8px; }
        .att-table-compact tbody td { padding-top: 6px; padding-bottom: 6px; }
        .att-table-compact .duty-avatar { width: 28px; height: 28px; }
        .att-table tbody tr:last-child td { border-bottom: none; }
        .att-table tbody tr:hover { background: ${BG}55; }
        .att-table th:nth-child(1), .att-table td:nth-child(1) { width: 52px; }
        .att-table th:nth-child(2) { width: 220px; }
        .att-table th:nth-child(3) { width: 140px; }
        .att-table th:nth-child(4) { width: 190px; }
        .att-table th:nth-child(5) { width: 140px; }
        .att-table th:nth-child(6) { width: 150px; }
        .att-table th:nth-child(7) { width: 130px; }
        .att-table th:nth-child(8) { width: 160px; }
        .att-table th:nth-child(9) { width: 118px; }
        .col-num { color: ${MUTED}; font-size: 0.8rem; }
        .scholar-cell { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .duty-avatar {
            width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
            background: ${PRIMARY}1A; display: flex; align-items: center; justify-content: center;
        }
        .duty-avatar span { color: ${PRIMARY}; font-size: 0.68rem; font-weight: 700; }
        .cell-title { font-size: 0.84rem; font-weight: 600; color: ${INK}; margin: 0; }
        .cell-sub { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 0.68rem; color: ${MUTED}; margin: 2px 0 0; }
        .cell-text { font-size: 0.82rem; color: ${INK}; }
        .clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
        .loc-cell { display: flex; align-items: center; gap: 6px; min-width: 0; }
        .dt-line { display: block; line-height: 1.4; }
        .dt-time { color: ${MUTED}; }
        .status-badge {
            display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
            font-size: 0.74rem; font-weight: 600; border-radius: 999px; padding: 5px 12px;
        }

        /* ── Loading / empty ── */
        .skeleton-tr td { padding: 10px 14px; }
        .skeleton-bar { height: 40px; background: ${BG}; border-radius: 10px; }
        .empty-cell { padding: 0 !important; }
        .empty-state { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 44px 20px; }
        .empty-icon { width: 52px; height: 52px; border-radius: 16px; background: ${GOLD}16; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
        .empty-title { font-family: 'Lora', Georgia, serif; font-size: 1.05rem; font-weight: 700; color: ${INK}; margin: 0; }
        .empty-text { font-size: 0.8rem; color: ${MUTED}; margin: 4px 0 0; }

        /* ── Pagination ── */
        .pager { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-top: 14px; }
        .pager-left { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
        .pager-info { font-size: 0.8rem; color: ${MUTED}; }
        .pager-size { display: flex; align-items: center; gap: 6px; font-size: 0.78rem; color: ${MUTED}; }
        .pager-size select {
            height: 32px; padding: 0 8px; border: 1px solid ${BORDER}; border-radius: 10px; background: #fff;
            font-family: 'Inter', sans-serif; font-size: 0.8rem; color: ${INK}; cursor: pointer;
        }
        .pager-controls { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .page-btn {
            min-width: 34px; height: 34px; padding: 0 8px; border-radius: 10px;
            background: ${SURFACE}; border: 1px solid ${BORDER}; color: ${INK};
            font-family: 'Inter', sans-serif; font-size: 0.8rem; font-weight: 600; cursor: pointer;
            display: inline-flex; align-items: center; justify-content: center;
        }
        .page-btn:hover:not(:disabled) { background: ${BG}; }
        .page-btn:disabled { opacity: 0.45; cursor: default; }
        .page-btn-active, .page-btn-active:hover:not(:disabled) { background: ${PRIMARY}; border-color: ${PRIMARY}; color: #fff; }
        .page-of { font-size: 0.76rem; color: ${MUTED}; margin-left: 8px; white-space: nowrap; }

        /* ── Follow-up ── */
        .followup-card { padding: 16px 20px; }
        .followup-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
        .followup-kicker { display: inline-flex; align-items: center; gap: 6px; font-size: 0.82rem; font-weight: 700; color: ${WARNING}; }
        .followup-note { font-size: 0.76rem; color: ${MUTED}; }
        .followup-empty { font-size: 0.8rem; color: ${MUTED}; margin: 6px 0 0; }
        .followup-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 28px; }
        .followup-row {
            display: flex; align-items: center; justify-content: space-between; gap: 12px;
            padding: 10px 0; border-top: 1px solid ${BORDER};
        }
        .followup-count {
            flex-shrink: 0; font-size: 0.72rem; font-weight: 700; color: ${DANGER};
            background: ${DANGER}16; border-radius: 999px; padding: 4px 10px;
        }

        /* ── Responsive ── */
        @media (max-width: 1100px) {
            .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 900px) {
            .hub-header { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
            .hub-inner { padding: 16px 12px 40px; }
            .kpi-grid { grid-template-columns: 1fr; }
            .hub-title-card { flex-wrap: wrap; padding: 16px; }
            .field { flex: 1 1 100%; }
            .records-card { padding: 14px; }
            .export-toolbar { width: 100%; }
            .export-toolbar .btn-outline, .export-toolbar .btn-filled { flex: 1 1 auto; }
            .followup-list { grid-template-columns: 1fr; }
            .page-of { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
            .reports-hub * { animation-duration: 0.01ms !important; }
        }
    `}</style>
);

export default StaffAttendanceReports;