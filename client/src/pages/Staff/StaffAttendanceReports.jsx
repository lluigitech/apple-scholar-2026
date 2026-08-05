import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    CalendarDays, Search, Download, ChevronDown,
    CheckCircle, XCircle, AlertTriangle, Users,
    FileSpreadsheet, Filter, Clock
} from 'lucide-react';

const API = 'http://localhost:5000/api';
const MAROON = '#7f2d3a';

function SkeletonRow() {
    return (
        <tr className="border-b border-slate-50">
            {[40, 30, 25, 20, 15].map((w, i) => (
                <td key={i} className="px-5 py-4">
                    <div className="h-3 bg-slate-100 rounded-full animate-pulse" style={{ width: `${w}%` }} />
                </td>
            ))}
        </tr>
    );
}

const STATUS_CFG = {
    present: { label: 'Present', icon: <CheckCircle size={11} />, cls: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    absent:  { label: 'Absent',  icon: <XCircle size={11} />,     cls: 'bg-red-50 text-red-500 border-red-100' },
    excused: { label: 'Excused', icon: <AlertTriangle size={11} />, cls: 'bg-amber-50 text-amber-600 border-amber-100' },
};

const StaffAttendanceReports = () => {
    const [records, setRecords]       = useState([]);
    const [duties, setDuties]         = useState([]);
    const [loading, setLoading]       = useState(true);
    const [search, setSearch]         = useState('');
    const [dutyFilter, setDutyFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [dateFrom, setDateFrom]     = useState('');
    const [dateTo, setDateTo]         = useState('');

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [attendRes, dutiesRes] = await Promise.allSettled([
                axios.get(`${API}/staff/reports/duty-attendance`),
                axios.get(`${API}/duties`),
            ]);
            if (attendRes.status === 'fulfilled') setRecords(attendRes.value.data);
            if (dutiesRes.status === 'fulfilled') setDuties(dutiesRes.value.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchFiltered = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (dateFrom) params.append('date_from', dateFrom);
            if (dateTo)   params.append('date_to', dateTo);
            const res = await axios.get(`${API}/staff/reports/duty-attendance?${params}`);
            setRecords(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
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
        const headers = ['Scholar', 'Scholar ID', 'Year Level', 'Duty', 'Date', 'Location', 'Status', 'Method', 'Marked At'];
        const rows = filtered.map(r => [
            r.scholar, r.scholar_id, r.year_level, r.duty,
            r.date ? new Date(r.date).toLocaleDateString('en-PH') : '',
            r.location || '',
            r.status, r.method,
            r.marked_at ? new Date(r.marked_at).toLocaleString('en-PH') : '',
        ]);
        const csv = [headers, ...rows].map(row => row.map(v => `"${v ?? ''}"`).join(',')).join('\n');
        const encoded = encodeURIComponent(csv);
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
        });
    };

    const uniqueDuties = [...new Set(records.map(r => r.duty).filter(Boolean))];

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 font-sans">

            {/* Header */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <span className="text-[10px] bg-[#7f2d3a]/10 text-[#7f2d3a] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full">
                            Staff — Reports
                        </span>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 mt-2 tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
                            Attendance Reports
                        </h1>
                        <p className="text-xs text-slate-400 mt-1">
                            View scholar duty attendance records and export data.
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <button onClick={exportCSV}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all">
                            <Download size={13} /> Export CSV
                        </button>
                        <button onClick={exportGoogleSheets}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-bold hover:opacity-90 transition-all"
                            style={{ background: '#0f9d58' }}>
                            <FileSpreadsheet size={13} /> Google Sheets
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Total Records', value: stats.total,   color: '#3b82f6', bg: '#eff6ff' },
                    { label: 'Present',       value: stats.present, color: '#16a34a', bg: '#f0fdf4' },
                    { label: 'Absent',        value: stats.absent,  color: '#ef4444', bg: '#fef2f2' },
                    { label: 'Attendance Rate', value: `${rate}%`,  color: MAROON,    bg: '#fcf8f8' },
                ].map(c => (
                    <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3"
                            style={{ background: c.bg }}>
                            <Users size={15} style={{ color: c.color }} />
                        </div>
                        {loading
                            ? <div className="h-6 w-16 bg-slate-100 rounded animate-pulse mb-1" />
                            : <p className="text-2xl font-black" style={{ color: c.color }}>{c.value}</p>
                        }
                        <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide">{c.label}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                    <Filter size={13} style={{ color: MAROON }} />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filters</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    {/* Search */}
                    <div className="relative flex-1 min-w-48">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" placeholder="Search scholar name or ID..."
                            value={search} onChange={e => setSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#7f2d3a] focus:ring-2 focus:ring-[#7f2d3a]/10 transition-all" />
                    </div>

                    {/* Duty filter */}
                    <div className="relative">
                        <select value={dutyFilter} onChange={e => setDutyFilter(e.target.value)}
                            className="appearance-none pl-3 pr-8 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#7f2d3a] transition-all bg-white text-slate-600">
                            <option value="">All Duties</option>
                            {uniqueDuties.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Status filter */}
                    <div className="relative">
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                            className="appearance-none pl-3 pr-8 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#7f2d3a] transition-all bg-white text-slate-600">
                            <option value="">All Status</option>
                            <option value="present">Present</option>
                            <option value="absent">Absent</option>
                            <option value="excused">Excused</option>
                        </select>
                        <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Date range */}
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                        className="px-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#7f2d3a] transition-all text-slate-600" />
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                        className="px-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#7f2d3a] transition-all text-slate-600" />
                    <button onClick={fetchFiltered}
                        className="px-4 py-2.5 text-xs font-black text-white rounded-xl hover:opacity-90 transition-all"
                        style={{ background: MAROON }}>
                        Apply
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[640px]">
                        <thead>
                            <tr style={{ background: 'linear-gradient(180deg, #fafafa, #f5f5f7)' }}
                                className="border-b border-slate-100">
                                {['Scholar', 'Duty', 'Date', 'Location', 'Status', 'Method'].map((h, i) => (
                                    <th key={h} className="px-5 py-3 text-[10px] font-black uppercase tracking-widest"
                                        style={{ color: i === 0 ? MAROON : '#94a3b8' }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading
                                ? Array(6).fill(0).map((_, i) => <SkeletonRow key={i} />)
                                : filtered.length === 0
                                    ? (
                                        <tr>
                                            <td colSpan={6} className="py-16 text-center">
                                                <Users size={28} className="mx-auto mb-2 text-slate-200" />
                                                <p className="text-sm font-bold text-slate-300">No records found</p>
                                                <p className="text-xs text-slate-300 mt-1">Try adjusting your filters</p>
                                            </td>
                                        </tr>
                                    )
                                    : filtered.map((r, i) => {
                                        const badge = STATUS_CFG[r.status] || STATUS_CFG.absent;
                                        return (
                                            <tr key={i} className="border-b border-slate-50 hover:bg-[#fcf8f8]/50 transition-colors">
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-black shrink-0"
                                                            style={{ background: `linear-gradient(135deg, ${MAROON}bb, #a63d4d)` }}>
                                                            {r.scholar?.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-700">{r.scholar}</p>
                                                            <p className="text-[10px] text-slate-400 font-mono">{r.scholar_id}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <p className="text-xs font-semibold text-slate-700">{r.duty}</p>
                                                    {r.year_level && <p className="text-[10px] text-slate-400 mt-0.5">{r.year_level}</p>}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                        <CalendarDays size={11} style={{ color: MAROON }} />
                                                        {r.date ? new Date(r.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5 text-xs text-slate-400">
                                                    {r.location || '—'}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide border ${badge.cls}`}>
                                                        {badge.icon} {badge.label}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium capitalize">
                                                        <Clock size={10} />
                                                        {r.method || '—'}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                            }
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between"
                    style={{ background: 'linear-gradient(180deg, #fafafa, white)' }}>
                    <span className="text-[11px] text-slate-400">
                        Showing <span className="font-bold text-slate-600">{filtered.length}</span> of{' '}
                        <span className="font-bold text-slate-600">{records.length}</span> records
                    </span>
                    <span className="text-[10px] text-slate-300 font-mono uppercase tracking-widest hidden sm:block">
                        Scholar Attendance Log
                    </span>
                </div>
            </div>
        </div>
    );
};

export default StaffAttendanceReports;