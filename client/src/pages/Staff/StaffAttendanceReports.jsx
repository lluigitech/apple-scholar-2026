import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
    CalendarDays, Search, Download, ChevronDown, ChevronRight,
    CheckCircle2, XCircle, AlertTriangle, FileSpreadsheet, SlidersHorizontal,
    FileText, TrendingUp, Inbox, RefreshCw, MapPin, Clock3, RotateCcw, UserX,
} from 'lucide-react';
import { buildSummaryRows, currentPeriodLabel, downloadReportSummaryPdf } from '../../utils/reportPdfExport';

const API = 'http://localhost:5000/api';
const authHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
});

// ── Apple Scholar design system — same tokens as the Communication Hub,
// Scholar Portfolio and Staff Duty Assignment. ──
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
const RADIUS = 18;

const display = { fontFamily: "'Lora', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace" };

const underlineField = {
    width: '100%', padding: '8px 2px', border: 'none', borderBottom: `1.5px solid ${BORDER}`,
    background: 'none', ...body, fontSize: '0.85rem', color: INK, outline: 'none', appearance: 'none',
};
const fieldLabel = { ...mono, fontSize: '0.66rem', color: MUTED, display: 'block', marginBottom: 6, letterSpacing: '0.05em' };

const STATUS_CONFIG = {
    present: { label: 'Present', icon: CheckCircle2, color: SUCCESS },
    absent:  { label: 'Absent',  icon: XCircle,       color: DANGER },
    excused: { label: 'Excused', icon: AlertTriangle, color: WARNING },
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

const StatusBadge = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.absent;
    const Icon = cfg.icon;
    return (
        <span
            className="inline-flex items-center gap-1.5 flex-shrink-0"
            style={{ ...body, fontSize: '0.74rem', fontWeight: 600, color: cfg.color, background: `${cfg.color}16`, borderRadius: 999, padding: '5px 12px' }}
        >
            <Icon size={13} />
            {cfg.label}
        </span>
    );
};

// A single duty record — white row card: avatar / duty details / status.
const AttendanceCard = ({ record }) => {
    const dateValue = record.date || record.marked_at || record.duty_date;
    const d = dateValue ? new Date(dateValue) : null;
    const validDate = d && !Number.isNaN(d.getTime());

    return (
        <div className="duty-row">
            <div className="duty-row-who">
                <div
                    className="rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ width: 32, height: 32, background: PRIMARY }}
                >
                    <span style={{ ...body, color: '#fff', fontSize: '0.64rem', fontWeight: 700 }}>{getInitials(record.scholar)}</span>
                </div>
                <div className="min-w-0">
                    <p style={{ ...body, fontSize: '0.82rem', fontWeight: 600, color: INK }} className="truncate">{record.scholar || 'Unknown Scholar'}</p>
                    <p style={{ ...mono, fontSize: '0.62rem', color: MUTED }} className="truncate">{record.scholar_id || '—'}</p>
                </div>
            </div>

            <div className="duty-row-what min-w-0">
                <p style={{ ...body, fontSize: '0.82rem', fontWeight: 600, color: INK }} className="truncate">{record.duty || 'Duty'}</p>
                <span className="flex items-center gap-1 truncate" style={{ ...body, fontSize: '0.72rem', color: MUTED, marginTop: 3 }}>
                    <MapPin size={11} style={{ flexShrink: 0 }} /> <span className="truncate">{record.location || 'No location'}</span>
                </span>
            </div>

            <span className="duty-row-when" style={{ ...body, fontSize: '0.74rem', color: MUTED }}>
                <Clock3 size={11} style={{ flexShrink: 0 }} />
                {validDate ? d.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'No date'}
            </span>

            <div className="duty-row-status">
                <StatusBadge status={record.status} />
            </div>
        </div>
    );
};

const StaffAttendanceReports = () => {
    const navigate = useNavigate();
    const [records, setRecords]       = useState([]);
    const [duties, setDuties]         = useState([]);
    const [loading, setLoading]       = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch]         = useState('');
    const [dutyFilter, setDutyFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [dateFrom, setDateFrom]     = useState('');
    const [dateTo, setDateTo]         = useState('');
    const [pdfLoading, setPdfLoading] = useState(false);
    const [sheetsLoading, setSheetsLoading] = useState(false);

    useEffect(() => {
        if (!localStorage.getItem('token')) {
            navigate('/login', { replace: true });
            return;
        }
        fetchAll();
    }, [navigate]);

    const fetchAll = async (isManualRefresh = false) => {
        if (isManualRefresh) setRefreshing(true); else setLoading(true);
        try {
            const [attendRes, dutiesRes] = await Promise.allSettled([
                axios.get(`${API}/staff/reports/duty-attendance`, authHeaders()),
                axios.get(`${API}/duties`, authHeaders()),
            ]);
            if (attendRes.status === 'fulfilled') setRecords(attendRes.value.data);
            if (dutiesRes.status === 'fulfilled') setDuties(dutiesRes.value.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
            if (isManualRefresh) setRefreshing(false);
        }
    };

    const fetchFiltered = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (dateFrom) params.append('date_from', dateFrom);
            if (dateTo)   params.append('date_to', dateTo);
            const res = await axios.get(`${API}/staff/reports/duty-attendance?${params}`, authHeaders());
            setRecords(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Resets the local filter fields and reloads the full, unfiltered
    // dataset via the existing fetchAll() — no new request logic added.
    const resetFilters = () => {
        setSearch('');
        setDutyFilter('');
        setStatusFilter('');
        setDateFrom('');
        setDateTo('');
        fetchAll();
    };

    // ── Client-side filters ──────────────────────────────────
    const filtered = records.filter(r => {
        const matchSearch = !search ||
            r.scholar?.toLowerCase().includes(search.toLowerCase()) ||
            r.scholar_id?.toLowerCase().includes(search.toLowerCase());
        const matchDuty   = !dutyFilter || r.duty === dutyFilter;
        const matchStatus = !statusFilter || r.status === statusFilter;
        return matchSearch && matchDuty && matchStatus;
    });

    // ── Stats ────────────────────────────────────────────────
    const stats = {
        total:   filtered.length,
        present: filtered.filter(r => r.status === 'present').length,
        absent:  filtered.filter(r => r.status === 'absent').length,
        excused: filtered.filter(r => r.status === 'excused').length,
    };

    const rate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;

    // Scholars with the most absences in the current filtered view — a
    // grounded, data-driven "needs follow-up" panel instead of a decorative one.
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
        const headers = ['Scholar', 'Scholar ID', 'Year Level', 'Duty', 'Date', 'Location', 'Status', 'Method', 'Marked At'];
        const rows = filtered.map(r => [
            r.scholar, r.scholar_id, r.year_level, r.duty,
            r.date ? new Date(r.date).toLocaleDateString('en-PH') : '',
            r.location || '',
            r.status, r.method,
            r.marked_at ? new Date(r.marked_at).toLocaleString('en-PH') : '',
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

    // ── Export to Google Sheets (opens CSV in Drive) ─────────
    const exportGoogleSheets = () => {
        setSheetsLoading(true);
        const headers = ['Scholar', 'Scholar ID', 'Year Level', 'Duty', 'Date', 'Location', 'Status', 'Method', 'Marked At'];
        const rows = filtered.map(r => [
            r.scholar, r.scholar_id, r.year_level, r.duty,
            r.date ? new Date(r.date).toLocaleDateString('en-PH') : '',
            r.location || '',
            r.status, r.method,
            r.marked_at ? new Date(r.marked_at).toLocaleString('en-PH') : '',
        ]);
        const csv = [headers, ...rows].map(row => row.map(v => `"${v ?? ''}"`).join(',')).join('\n');
        window.open(`https://docs.google.com/spreadsheets/d/create?usp=sheets_home`, '_blank');
        // Copy CSV to clipboard so they can paste into Google Sheets
        navigator.clipboard.writeText(csv).then(() => {
            alert('CSV data copied to clipboard!\n\nPaste it into the Google Sheet that just opened (Ctrl+V or Cmd+V).');
        }).catch(() => {
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `attendance_report.csv`;
            a.click();
            axios.post(`${API}/export/google-sheets`, { log_only: true, module: 'Attendance Report', report_resource: 'Staff Attendance', spreadsheet_title: `Attendance_Report_${new Date().toISOString().slice(0,10)}`, details: 'attendance_report.csv' }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).catch(() => {});
        }).finally(() => setSheetsLoading(false));
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

    const uniqueDuties = [...new Set(records.map(r => r.duty).filter(Boolean))];

    const groupedAttendance = useMemo(() => {
        const months = new Map();

        filtered.forEach(record => {
            const dateValue = record.date || record.marked_at || record.duty_date;
            const date = dateValue ? new Date(dateValue) : null;
            const monthKey = date && !Number.isNaN(date.getTime())
                ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
                : 'unknown';
            const monthLabel = date && !Number.isNaN(date.getTime())
                ? date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                : 'Uncategorized';
            const yearLevel = record.year_level || 'Unassigned';
            const scholarName = record.scholar || 'Unknown Scholar';

            if (!months.has(monthKey)) {
                months.set(monthKey, {
                    key: monthKey,
                    label: monthLabel,
                    yearLevels: new Map(),
                });
            }

            const monthGroup = months.get(monthKey);
            if (!monthGroup.yearLevels.has(yearLevel)) {
                monthGroup.yearLevels.set(yearLevel, {
                    label: formatYearLevelLabel(yearLevel),
                    scholars: new Map(),
                });
            }

            const yearGroup = monthGroup.yearLevels.get(yearLevel);
            const scholarKey = `${scholarName}::${record.scholar_id || 'unknown'}`;
            if (!yearGroup.scholars.has(scholarKey)) {
                yearGroup.scholars.set(scholarKey, {
                    name: scholarName,
                    scholarId: record.scholar_id || '—',
                    records: [],
                });
            }

            yearGroup.scholars.get(scholarKey).records.push(record);
        });

        return Array.from(months.values())
            .sort((a, b) => b.key.localeCompare(a.key))
            .map(month => ({
                ...month,
                yearLevels: Array.from(month.yearLevels.values())
                    .sort((a, b) => a.label.localeCompare(b.label))
                    .map(year => ({
                        ...year,
                        scholars: Array.from(year.scholars.values()).sort((a, b) => a.name.localeCompare(b.name)),
                    })),
            }));
    }, [filtered]);

    const [expandedMonths, setExpandedMonths] = useState(new Set());
    const [expandedYearLevels, setExpandedYearLevels] = useState(new Set());

    const toggleMonth = (key) => {
        const next = new Set(expandedMonths);
        if (next.has(key)) next.delete(key); else next.add(key);
        setExpandedMonths(next);
    };

    const toggleYearLevel = (key) => {
        const next = new Set(expandedYearLevels);
        if (next.has(key)) next.delete(key); else next.add(key);
        setExpandedYearLevels(next);
    };

    const filledBtn  = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 16px', border: 'none', borderRadius: 12, background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`, color: '#fff', ...body, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' };
    const ghostSmallBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 16px', border: `1px solid ${BORDER}`, borderRadius: 12, background: 'none', color: MUTED, ...body, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' };

    return (
        <div className="reports-hub" style={{ background: BG, ...body }}>
            <div className="hub-inner">

                {/* ── Top bar ── */}
                <div className="hub-topbar">
                    <div>
                        <h1 style={{ ...display, fontSize: '1.7rem', fontWeight: 700, color: INK }}>Attendance Reports</h1>
                        <p style={{ ...body, fontSize: '0.85rem', color: MUTED, marginTop: 4 }}>Monitor scholar attendance and export institutional records.</p>
                    </div>
                    <button
                        onClick={() => fetchAll(true)}
                        className="icon-refresh"
                        aria-label="Refresh records"
                        title="Refresh"
                    >
                        <RefreshCw size={16} style={{ animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }} />
                    </button>
                </div>

                {/* ── Bento block: export tile + four stat tiles ── */}
                <div className="bento-grid">
                    <div className="bento-tile tile-export">
                        <span className="tile-export-icon"><FileSpreadsheet size={20} /></span>
                        <h2 style={{ ...display, fontSize: '1.15rem', fontWeight: 700, color: '#fff', marginTop: 12 }}>Export &amp; share</h2>
                        <p style={{ ...body, fontSize: '0.78rem', color: '#F3E7DE', marginTop: 4 }}>Based on the {filtered.length} record{filtered.length === 1 ? '' : 's'} currently in view.</p>
                        <div className="export-actions">
                            <button onClick={exportGoogleSheets} disabled={sheetsLoading} className="export-row">
                                <span className="flex items-center gap-2.5"><FileSpreadsheet size={14} /> Google Sheets</span>
                                <ChevronRight size={13} />
                            </button>
                            <button onClick={exportCSV} className="export-row">
                                <span className="flex items-center gap-2.5"><Download size={14} /> CSV file</span>
                                <ChevronRight size={13} />
                            </button>
                            <button onClick={exportPDF} disabled={pdfLoading} className="export-row">
                                <span className="flex items-center gap-2.5"><FileText size={14} /> {pdfLoading ? 'Generating…' : 'PDF summary'}</span>
                                <ChevronRight size={13} />
                            </button>
                        </div>
                    </div>

                    <div className="bento-tile tile-stat" style={{ borderTopColor: INK }}>
                        <span style={{ ...display, fontSize: '2rem', fontWeight: 700, color: INK }}>{loading ? '—' : stats.total}</span>
                        <span style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 4 }}>Total records</span>
                    </div>
                    <div className="bento-tile tile-stat" style={{ borderTopColor: SUCCESS }}>
                        <span style={{ ...display, fontSize: '2rem', fontWeight: 700, color: INK }}>{loading ? '—' : stats.present}</span>
                        <span style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 4 }}>Present</span>
                    </div>
                    <div className="bento-tile tile-stat" style={{ borderTopColor: DANGER }}>
                        <span style={{ ...display, fontSize: '2rem', fontWeight: 700, color: INK }}>{loading ? '—' : stats.absent}</span>
                        <span style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 4 }}>Absent</span>
                    </div>
                    <div className="bento-tile tile-stat" style={{ borderTopColor: PRIMARY }}>
                        <span style={{ ...display, fontSize: '2rem', fontWeight: 700, color: INK }}>{loading ? '—' : `${rate}%`}</span>
                        <span style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 4 }}>Attendance rate</span>
                    </div>
                </div>

                {/* ── Filter tile ── */}
                <div className="bento-tile tile-filters">
                    <div className="flex items-center gap-2 mb-4">
                        <SlidersHorizontal size={13} style={{ color: PRIMARY }} />
                        <span style={{ ...body, fontSize: '0.76rem', fontWeight: 600, color: INK }}>Filter the report</span>
                    </div>
                    <div className="grid gap-x-6 gap-y-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                        <div>
                            <span style={fieldLabel}>SEARCH</span>
                            <div className="flex items-center gap-2" style={{ borderBottom: `1.5px solid ${BORDER}`, padding: '8px 2px' }}>
                                <Search size={13} style={{ color: MUTED, flexShrink: 0 }} />
                                <input type="text" placeholder="Scholar name or ID…" value={search} onChange={e => setSearch(e.target.value)}
                                    style={{ flex: 1, border: 'none', outline: 'none', background: 'none', ...body, fontSize: '0.85rem', color: INK }} />
                            </div>
                        </div>
                        <div>
                            <span style={fieldLabel}>DUTY</span>
                            <select value={dutyFilter} onChange={e => setDutyFilter(e.target.value)} style={{ ...underlineField, cursor: 'pointer' }}>
                                <option value="">All duties</option>
                                {uniqueDuties.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <span style={fieldLabel}>STATUS</span>
                            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...underlineField, cursor: 'pointer' }}>
                                <option value="">All status</option>
                                <option value="present">Present</option>
                                <option value="absent">Absent</option>
                                <option value="excused">Excused</option>
                            </select>
                        </div>
                        <div>
                            <span style={fieldLabel}>FROM</span>
                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={underlineField} />
                        </div>
                        <div>
                            <span style={fieldLabel}>TO</span>
                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={underlineField} />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 flex-wrap" style={{ marginTop: 18 }}>
                        <button onClick={resetFilters} className="w-full sm:w-auto flex items-center justify-center gap-2" style={ghostSmallBtn}>
                            <RotateCcw size={13} /> Reset
                        </button>
                        <button onClick={fetchFiltered} className="w-full sm:w-auto" style={filledBtn}>Apply</button>
                    </div>
                </div>

                {/* ── Archive + follow-up ── */}
                <div className="archive-layout">
                    <div className="bento-tile archive-tile">
                        {loading ? (
                            <div className="space-y-2.5">
                                {Array(3).fill(0).map((_, i) => (
                                    <div key={i} className="animate-pulse" style={{ height: 64, background: BG, borderRadius: 12 }} />
                                ))}
                            </div>
                        ) : groupedAttendance.length === 0 ? (
                            <div className="flex flex-col items-center justify-center text-center" style={{ padding: '56px 20px' }}>
                                <div className="flex items-center justify-center" style={{ width: 52, height: 52, borderRadius: 16, background: `${GOLD}16`, marginBottom: 16 }}>
                                    <Inbox size={22} style={{ color: GOLD }} />
                                </div>
                                <p style={{ ...display, fontSize: '1.05rem', fontWeight: 700, color: INK }}>No attendance records</p>
                                <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginTop: 4 }}>Try adjusting your filters, or check back once duties are logged.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {groupedAttendance.map(month => {
                                    const monthOpen = expandedMonths.has(month.key) || expandedMonths.size === 0;
                                    const scholarCount = month.yearLevels.reduce((sum, year) => sum + year.scholars.length, 0);
                                    return (
                                        <div key={month.key} style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 10px 24px -18px rgba(36,21,18,0.3)' }}>

                                            {/* Level 1 — Month folder: the only colored level */}
                                            <button onClick={() => toggleMonth(month.key)}
                                                className="w-full flex items-center justify-between gap-2"
                                                style={{ padding: '14px 20px', background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`, border: 'none', cursor: 'pointer' }}>
                                                <span className="flex items-center gap-2.5">
                                                    {monthOpen ? <ChevronDown size={15} style={{ color: '#fff' }} /> : <ChevronRight size={15} style={{ color: '#F3E9DD' }} />}
                                                    <CalendarDays size={15} style={{ color: '#F3E9DD' }} />
                                                    <span style={{ ...display, fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>{month.label}</span>
                                                </span>
                                                <span style={{ ...body, fontSize: '0.72rem', fontWeight: 600, color: '#F3E9DD' }}>{scholarCount} scholar{scholarCount === 1 ? '' : 's'}</span>
                                            </button>

                                            {monthOpen && (
                                                <div style={{ background: BG, padding: '14px 14px 4px' }}>
                                                    {month.yearLevels.map(year => {
                                                        const yearKey = `${month.key}-${year.label}`;
                                                        const yearOpen = expandedYearLevels.has(yearKey) || expandedYearLevels.size === 0;
                                                        const yearRecords = year.scholars.flatMap(scholar => scholar.records.map((record, idx) => ({ record, cardKey: `${scholar.name}-${record.id || idx}` })));

                                                        return (
                                                            <div key={yearKey} style={{ marginBottom: 12 }}>
                                                                {/* Level 2 — Year level: slim white accordion */}
                                                                <button
                                                                    onClick={() => toggleYearLevel(yearKey)}
                                                                    className="w-full flex items-center justify-between"
                                                                    style={{ padding: '12px 14px', background: '#FFFFFF', border: `1px solid ${BORDER}`, borderRadius: 12, cursor: 'pointer' }}
                                                                >
                                                                    <span className="flex items-center gap-2.5">
                                                                        {yearOpen ? <ChevronDown size={13} style={{ color: PRIMARY }} /> : <ChevronRight size={13} style={{ color: MUTED }} />}
                                                                        <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: GOLD, flexShrink: 0 }} />
                                                                        <span style={{ ...body, fontSize: '0.85rem', fontWeight: 600, color: INK }}>{formatYearLevelLabel(year.label)}</span>
                                                                    </span>
                                                                    <span style={{ ...body, fontSize: '0.72rem', color: MUTED, fontWeight: 600 }}>
                                                                        {year.scholars.length} scholar{year.scholars.length === 1 ? '' : 's'}
                                                                    </span>
                                                                </button>

                                                                {/* Level 3 — Scholar cards, directly, no extra accordion */}
                                                                {yearOpen && (
                                                                    <div style={{ paddingTop: 12 }}>
                                                                        {yearRecords.map(({ record, cardKey }) => (
                                                                            <AttendanceCard key={cardKey} record={record} />
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <aside className="archive-side">
                        <div className="followup-tile">
                            <span className="followup-kicker" style={body}><UserX size={11} /> Needs follow-up</span>
                            {followUp.length === 0 ? (
                                <p style={{ ...body, fontSize: '0.8rem', color: '#C9B9AB', marginTop: 12 }}>No repeat absences in the current view.</p>
                            ) : (
                                <div style={{ marginTop: 12 }}>
                                    {followUp.map((s, i) => (
                                        <div key={i} className="followup-row">
                                            <div className="min-w-0">
                                                <p style={{ ...body, fontSize: '0.82rem', fontWeight: 600, color: '#fff' }} className="truncate">{s.name}</p>
                                                <p style={{ ...mono, fontSize: '0.64rem', color: '#C9B9AB' }}>{s.scholarId}</p>
                                            </div>
                                            <span className="followup-count">{s.count}×</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="tips-tile">
                            <span className="flex items-center gap-1.5" style={{ ...body, fontSize: '0.78rem', fontWeight: 700, color: PRIMARY }}>
                                <TrendingUp size={13} /> Reading the archive
                            </span>
                            <p style={{ ...body, fontSize: '0.78rem', color: MUTED, lineHeight: 1.55, marginTop: 8 }}>
                                Records are grouped by month, then year level. Collapse a month to skim the archive faster.
                            </p>
                        </div>
                    </aside>
                </div>
            </div>

            <GlobalStyle />
        </div>
    );
};

const GlobalStyle = () => (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,600;0,700;1,600&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .reports-hub { min-height: 100vh; }
        .hub-inner { padding: 28px 20px 48px; max-width: 1140px; margin: 0 auto; }

        .hub-topbar {
            display: flex; align-items: flex-start; justify-content: space-between;
            gap: 16px; margin-bottom: 20px;
        }
        .icon-refresh {
            width: 38px; height: 38px; border-radius: 12px; flex-shrink: 0;
            background: ${SURFACE}; border: 1px solid ${BORDER}; color: ${GOLD};
            display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .icon-refresh:hover { background: ${BG}; color: ${PRIMARY}; }

        .bento-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            grid-template-rows: repeat(2, 1fr);
            gap: 14px;
            margin-bottom: 14px;
        }
        .bento-tile {
            background: ${SURFACE};
            border: 1px solid ${BORDER};
            border-radius: ${RADIUS}px;
            box-shadow: 0 10px 24px -18px rgba(36,21,18,0.28);
        }
        .tile-export {
            grid-column: span 2; grid-row: span 2;
            background: linear-gradient(150deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%);
            border: none;
            padding: 24px;
            display: flex; flex-direction: column;
        }
        .tile-export-icon {
            width: 40px; height: 40px; border-radius: 12px;
            background: rgba(255,255,255,0.16); color: #fff;
            display: flex; align-items: center; justify-content: center;
        }
        .export-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
        .export-row {
            display: flex; align-items: center; justify-content: space-between;
            padding: 11px 14px; border-radius: 11px;
            background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.18);
            color: #fff; font-size: 0.82rem; font-weight: 600; cursor: pointer;
        }
        .export-row:hover { background: rgba(255,255,255,0.18); }
        .export-row:disabled { opacity: 0.6; cursor: default; }

        .tile-stat {
            grid-column: span 1; grid-row: span 1;
            padding: 18px 20px;
            border-top: 3px solid;
            display: flex; flex-direction: column; justify-content: center;
        }

        .tile-filters { padding: 20px; margin-bottom: 20px; }

        .archive-layout {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 18px;
            align-items: start;
        }
        .archive-tile { padding: 18px; }
        .archive-side { display: flex; flex-direction: column; gap: 14px; position: sticky; top: 20px; }

        .followup-tile {
            background: ${INK};
            border-radius: 18px;
            padding: 20px;
        }
        .followup-kicker {
            display: inline-flex; align-items: center; gap: 6px;
            font-size: 0.68rem; font-weight: 700; color: #E0C6A6;
        }
        .followup-row {
            display: flex; align-items: center; justify-content: space-between;
            padding: 9px 0; border-top: 1px solid rgba(255,255,255,0.08);
        }
        .followup-row:first-child { border-top: none; }
        .followup-count {
            flex-shrink: 0; font-size: 0.76rem; font-weight: 700; color: #F0A3A8;
            background: rgba(240,163,168,0.14); border-radius: 999px; padding: 3px 10px;
        }

        .tips-tile {
            background: ${SURFACE};
            border: 1px solid ${BORDER};
            border-radius: 18px;
            padding: 20px;
        }

        .duty-row {
            display: grid;
            grid-template-columns: minmax(0, 1.15fr) minmax(0, 1.35fr) minmax(0, 0.95fr) auto;
            align-items: center;
            gap: 18px;
            background: #FFFFFF;
            border: 1px solid ${BORDER};
            border-radius: 14px;
            padding: 13px 16px;
            margin-bottom: 10px;
            box-shadow: 0 6px 16px -12px rgba(36,21,18,0.16);
        }
        .duty-row-who { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .duty-row-what { min-width: 0; border-left: 1px solid ${BORDER}; padding-left: 18px; }
        .duty-row-when {
            display: flex; align-items: center; gap: 6px; white-space: nowrap;
            border-left: 1px solid ${BORDER}; padding-left: 18px;
        }
        .duty-row-status { display: flex; justify-content: flex-end; }

        @media (max-width: 720px) {
            .duty-row { grid-template-columns: 1fr auto; row-gap: 10px; }
            .duty-row-what { grid-column: 1 / -1; border-left: none; padding-left: 0; padding-top: 10px; border-top: 1px solid ${BORDER}; }
            .duty-row-when { border-left: none; padding-left: 0; }
        }

        @media (max-width: 1024px) {
            .bento-grid { grid-template-columns: repeat(2, 1fr); grid-template-rows: auto; }
            .tile-export { grid-column: span 2; grid-row: span 1; }
            .archive-layout { grid-template-columns: 1fr; }
            .archive-side { position: static; }
        }
        @media (max-width: 640px) {
            .bento-grid { grid-template-columns: 1fr; }
            .tile-export { grid-column: span 1; }
            .hub-topbar { flex-wrap: wrap; }
        }
    `}</style>
);

export default StaffAttendanceReports;