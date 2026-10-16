import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download, FileText, Search, ChevronLeft, ChevronRight, CalendarCheck, List, Calendar as CalendarIcon, ChevronDown,
} from 'lucide-react';
import { formatYearLevelLabel } from '../../../utils/yearLevelLabels';
import { formatAdminDate, formatAdminMonth, getAdminLocale, getAdminTimezone } from '../../../utils/adminPreferences';

// ── Design tokens — "Apple Scholar Executive" system ──
const PRIMARY = '#6D2140';
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E5D8CA';
const INK = '#241512';
const MUTED = '#8A7A68';
const DANGER = '#A24A4A';
const RADIUS = 16;
const PAGE_SIZE = 10;

const display = { fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };
const mono = { fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, monospace" };

const surfaceCard = {
  background: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: RADIUS,
  boxShadow: '0 1px 2px rgba(36,21,18,0.04)',
};

const fieldStyle = {
  width: '100%', height: 44, padding: '0 14px', borderRadius: 12,
  border: `1px solid ${BORDER}`, background: '#fff', ...body, fontSize: '0.85rem', color: INK, outline: 'none',
};
const labelStyle = { ...body, fontSize: '0.72rem', fontWeight: 700, color: PRIMARY, display: 'block', marginBottom: 6 };

const STATUS_TONE = {
  present: { bg: '#EAF3EB', color: '#4F7656', label: 'Present' },
  absent: { bg: '#FBEAE8', color: DANGER, label: 'Absent' },
  excused: { bg: '#FBF1DF', color: '#9A6B1F', label: 'Excused' },
};

const statusKeyOf = (r) => (r.status === 'present' ? 'present' : r.status === 'absent' ? 'absent' : 'excused');
const dateValueOf = (r) => r.date || r.marked_at || r.duty_date || '';
const monthKeyOf = (value) => {
  if (/^\d{4}-\d{2}/.test(String(value))) return String(value).slice(0, 7);
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : '';
};
const dayOf = (value) => {
  if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) return Number(String(value).slice(8, 10));
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d.getDate() : null;
};
const parseDate = (value) => {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};
const fmtDutyDate = (r) => {
  const d = parseDate(r.date || r.duty_date || r.marked_at);
  return d ? formatAdminDate(d, { month: 'short' }) : '—';
};
const fmtDutyTime = (r) => {
  const d = r.marked_at ? new Date(r.marked_at) : null;
  return d && !Number.isNaN(d.getTime()) ? new Intl.DateTimeFormat(getAdminLocale(), { timeZone: getAdminTimezone(), hour: 'numeric', minute: '2-digit' }).format(d) : '—';
};
const sortStamp = (r) => (parseDate(r.date || r.duty_date || r.marked_at)?.getTime() || 0);
const yearLevelOf = (r) => r.year_level || r.yearLevel || r.year || '';

const pageList = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const sorted = [...new Set([1, total, current - 1, current, current + 1])].filter(p => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => { if (i && p - sorted[i - 1] > 1) out.push('gap-' + p); out.push(p); });
  return out;
};

const Skeleton = () => (
  <div style={{ ...surfaceCard, padding: '1.4rem' }}>
    <div style={{ height: 14, width: 200, borderRadius: 8, background: '#EFE3D4', marginBottom: 18 }} />
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} style={{ height: 36, borderRadius: 10, background: '#F2E9DC', marginBottom: 10 }} />
    ))}
  </div>
);

const EmptyState = () => (
  <div className="text-center" style={{ padding: '3rem 1rem', border: `1px dashed ${BORDER}`, borderRadius: 14 }}>
    <div style={{ width: 52, height: 52, borderRadius: '50%', background: `${PRIMARY}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: PRIMARY }}>
      <CalendarCheck size={24} />
    </div>
    <h3 style={{ ...display, fontSize: '1.1rem', color: INK }}>No attendance records found</h3>
    <p style={{ ...body, fontSize: '0.84rem', color: MUTED, marginTop: 4 }}>Try changing the search, month, group, or status.</p>
  </div>
);

const Pill = ({ tone, children }) => (
  <span style={{ ...body, fontSize: '0.74rem', fontWeight: 600, color: tone.color, background: tone.bg, borderRadius: 8, padding: '4px 10px', whiteSpace: 'nowrap' }}>
    {children}
  </span>
);

export default function AttendanceReportsTab({
  data = [],
  loading,
  error,
  filters,
  setFilters,
  onFetch,
  onExport,
  onExportPdf,
}) {
  const handleFilterChange = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));

  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [view, setView] = useState('table');
  const [page, setPage] = useState(1);
  const previousMonth = useRef(filters.month);

  const availableGroups = useMemo(() => {
    const groups = new Map();
    data.forEach(record => {
      const groupName = record.group_name || 'Unassigned';
      if (!groups.has(groupName)) groups.set(groupName, record.assigned_staff || 'Unassigned');
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

  // Year level only filters if the API sends it on attendance records.
  const hasYearData = useMemo(() => data.some(r => yearLevelOf(r)), [data]);

  // Existing record-level filters (month, group, search) + year level.
  const filteredData = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.filter(r => {
      if (filters.month && monthKeyOf(dateValueOf(r)) !== filters.month) return false;
      if (groupFilter !== 'all' && r.group_name !== groupFilter) return false;
      if (yearFilter !== 'all' && formatYearLevelLabel(yearLevelOf(r)) !== formatYearLevelLabel(yearFilter)) return false;
      if (!term) return true;
      const haystack = `${r.scholar || ''} ${r.scholar_id || ''} ${r.group_name || ''} ${r.assigned_staff || ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [data, search, groupFilter, yearFilter, filters.month]);

  // One row per attendance record. The status filter applies to records.
  const visibleRecords = useMemo(() => {
    const list = statusFilter === 'all' ? filteredData : filteredData.filter(r => statusKeyOf(r) === statusFilter);
    return [...list].sort((x, y) => sortStamp(y) - sortStamp(x) || String(x.scholar || '').localeCompare(String(y.scholar || '')));
  }, [filteredData, statusFilter]);

  useEffect(() => { setPage(1); }, [search, groupFilter, yearFilter, statusFilter, filters.month, data.length]);

  const totalPages = Math.max(1, Math.ceil(visibleRecords.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = visibleRecords.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    if (previousMonth.current === filters.month) return;
    previousMonth.current = filters.month;
    onFetch();
  }, [filters.month, onFetch]);

  const hasActiveFilters = Boolean(search || groupFilter !== 'all' || yearFilter !== 'all' || statusFilter !== 'all');
  const resetFilters = () => { setSearch(''); setGroupFilter('all'); setYearFilter('all'); setStatusFilter('all'); };

  // Calendar view data: per-day present / absent / excused counts.
  const calendar = useMemo(() => {
    const monthKey = filters.month || monthKeyOf(dateValueOf(visibleRecords[0] || {}));
    if (!monthKey) return null;
    const [y, m] = monthKey.split('-').map(Number);
    const days = new Date(y, m, 0).getDate();
    const offset = new Date(y, m - 1, 1).getDay();
    const counts = {};
    visibleRecords.forEach(r => {
      if (monthKeyOf(dateValueOf(r)) !== monthKey) return;
      const d = dayOf(dateValueOf(r));
      if (!d) return;
      counts[d] = counts[d] || { present: 0, absent: 0, excused: 0 };
      counts[d][STATUS_TONE[r.status] ? r.status : 'excused'] += 1;
    });
    return { y, m, days, offset, counts, label: formatAdminMonth(new Date(y, m - 1, 1)) };
  }, [visibleRecords, filters.month]);

  if (error) {
    return (
      <div className="text-center" style={{ ...surfaceCard, padding: '3rem 1.5rem' }}>
        <p style={{ ...body, fontSize: '0.9rem', color: DANGER, marginBottom: 16 }}>{error}</p>
        <button
          onClick={onFetch}
          style={{ padding: '10px 22px', borderRadius: 10, background: PRIMARY, color: '#fff', ...body, fontWeight: 700, fontSize: '0.85rem', border: 'none', cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    );
  }

  const focus = (e) => { e.target.style.borderColor = PRIMARY; };
  const blur = (e) => { e.target.style.borderColor = BORDER; };
  const th = { ...body, fontSize: '0.74rem', fontWeight: 700, color: INK, textAlign: 'left', padding: '11px 14px', whiteSpace: 'nowrap', borderBottom: `1px solid ${BORDER}`, background: BG };
  const td = { ...body, fontSize: '0.82rem', color: INK, padding: '10px 14px', whiteSpace: 'nowrap', borderBottom: `1px solid ${BORDER}66` };

  const toggleBtn = (active) => ({
    ...body, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 600, padding: '7px 14px', borderRadius: 10, cursor: 'pointer',
    border: `1px solid ${active ? PRIMARY : BORDER}`, background: active ? PRIMARY : '#fff', color: active ? '#fff' : PRIMARY,
  });
  return (
    <div className="flex flex-col gap-4">

      {/* ── Filter bar ── */}
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_1.4fr_auto] items-end" style={surfaceCard}>
        <div>
          <label style={labelStyle}>Month</label>
          <input type="month" value={filters.month} onChange={e => handleFilterChange('month', e.target.value)} style={fieldStyle} onFocus={focus} onBlur={blur} />
        </div>
        <div>
          <label style={labelStyle}>Assigned Group</label>
          <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }} onFocus={focus} onBlur={blur}>
            <option value="all">All Groups</option>
            {availableGroups.map(([groupName, staffName]) => (
              <option key={groupName} value={groupName}>{groupName} · {staffName}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Year Level</label>
          <select
            value={yearFilter}
            onChange={e => setYearFilter(e.target.value)}
            disabled={!hasYearData}
            title={hasYearData ? undefined : 'Year level is not included in the attendance data'}
            style={{ ...fieldStyle, cursor: hasYearData ? 'pointer' : 'not-allowed', opacity: hasYearData ? 1 : 0.6 }}
            onFocus={focus}
            onBlur={blur}
          >
            <option value="all">All Year Levels</option>
            <option value="1st Year College">1st Year College</option>
            <option value="2nd Year College">2nd Year College</option>
            <option value="3rd Year College">3rd Year College</option>
            <option value="4th Year College">4th Year College</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }} onFocus={focus} onBlur={blur}>
            <option value="all">All Statuses</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="excused">Excused</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Search Scholar</label>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: MUTED }} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search scholar name or ID..." style={{ ...fieldStyle, paddingLeft: 38 }} onFocus={focus} onBlur={blur} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <details className="relative">
            <summary
              className="flex items-center justify-center gap-2 cursor-pointer"
              style={{ ...body, fontSize: '0.85rem', fontWeight: 700, color: '#fff', background: PRIMARY, borderRadius: 12, padding: '0 16px', height: 44, listStyle: 'none', whiteSpace: 'nowrap' }}
            >
              <Download size={15} /> Export <ChevronDown size={15} />
            </summary>
            <div className="absolute right-0 top-full z-20 mt-2 flex min-w-40 flex-col gap-1 rounded-xl p-1.5 shadow-lg" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
              <button type="button" onClick={() => onExport(visibleRecords)} disabled={!visibleRecords.length} className="flex items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-[#F7F4EE] disabled:opacity-50" style={{ ...body, color: INK, fontSize: '0.82rem' }}>
                <Download size={14} style={{ color: PRIMARY }} /> Download CSV
              </button>
              <button type="button" onClick={() => onExportPdf(visibleRecords)} disabled={!visibleRecords.length} className="flex items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-[#F7F4EE] disabled:opacity-50" style={{ ...body, color: INK, fontSize: '0.82rem' }}>
                <FileText size={14} style={{ color: PRIMARY }} /> Download PDF
              </button>
            </div>
          </details>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              style={{ ...body, height: 44, padding: '0 14px', borderRadius: 12, border: `1px solid ${BORDER}`, background: '#fff', color: MUTED, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Attendance Records ── */}
      {loading ? (
        <Skeleton />
      ) : (
        <section aria-labelledby="attendance-records-title" style={{ ...surfaceCard, padding: '1.25rem 1.25rem 1rem' }}>
          <div className="flex flex-wrap items-start justify-between gap-3" style={{ marginBottom: 14 }}>
            <div>
              <h2 id="attendance-records-title" style={{ ...display, fontSize: '1.25rem', fontWeight: 600, color: INK }}>Attendance Records</h2>
              <p style={{ ...body, fontSize: '0.82rem', color: MUTED, marginTop: 2 }}>Attendance records with assigned staff, duty date, and time for the selected month.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span style={{ ...body, fontSize: '0.78rem', color: MUTED }}>View:</span>
              <button type="button" onClick={() => setView('table')} style={toggleBtn(view === 'table')}><List size={14} /> Table</button>
              <button type="button" onClick={() => setView('calendar')} style={toggleBtn(view === 'calendar')}><CalendarIcon size={14} /> Calendar</button>
            </div>
          </div>

          {visibleRecords.length === 0 ? (
            <EmptyState />
          ) : view === 'calendar' ? (
            calendar && (
              <div>
                <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                  <span style={{ ...display, fontSize: '1.05rem', color: INK }}>{calendar.label}</span>
                  <div className="flex items-center gap-3" style={{ ...body, fontSize: '0.72rem', color: MUTED }}>
                    {['present', 'absent', 'excused'].map(k => (
                      <span key={k} className="flex items-center gap-1.5">
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_TONE[k].color }} /> {STATUS_TONE[k].label}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <div style={{ minWidth: 640 }}>
                    <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} style={{ ...body, fontSize: '0.7rem', fontWeight: 700, color: MUTED, textAlign: 'center' }}>{d}</div>
                      ))}
                    </div>
                    <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                      {Array.from({ length: calendar.offset }).map((_, i) => <div key={`o-${i}`} />)}
                      {Array.from({ length: calendar.days }).map((_, i) => {
                        const day = i + 1;
                        const c = calendar.counts[day];
                        return (
                          <div key={day} style={{ minHeight: 74, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '6px 8px', background: c ? '#fff' : BG }}>
                            <div style={{ ...body, fontSize: '0.74rem', fontWeight: 700, color: c ? INK : MUTED }}>{day}</div>
                            {c && (
                              <div className="flex flex-col gap-0.5" style={{ marginTop: 4 }}>
                                {['present', 'absent', 'excused'].filter(k => c[k]).map(k => (
                                  <span key={k} style={{ ...body, fontSize: '0.68rem', fontWeight: 600, color: STATUS_TONE[k].color }}>
                                    {c[k]} {STATUS_TONE[k].label.toLowerCase()}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : (
            <>
              <div style={{ overflowX: 'auto', border: `1px solid ${BORDER}`, borderRadius: 14 }}>
                <table style={{ width: '100%', minWidth: 1000, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['#', 'Scholar Name', 'Student ID', 'Year Level', 'Group', 'Assigned Staff', 'Duty Date', 'Time', 'Status'].map(h => (
                        <th key={h} style={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((rec, i) => {
                      const tone = STATUS_TONE[rec.status] || { bg: BG, color: MUTED, label: rec.status || '—' };
                      const yl = yearLevelOf(rec);
                      return (
                        <tr key={rec.id || `${rec.scholar_id}-${rec.date || rec.marked_at}-${start + i}`}>
                          <td style={{ ...td, color: MUTED }}>{start + i + 1}</td>
                          <td style={{ ...td, fontWeight: 600 }}>{rec.scholar || 'Unknown Scholar'}</td>
                          <td style={{ ...td, ...mono, fontSize: '0.76rem' }}>{rec.scholar_id || '—'}</td>
                          <td style={td}>{yl ? formatYearLevelLabel(yl) : '—'}</td>
                          <td style={td}>{rec.group_name || 'Unassigned'}</td>
                          <td style={td}>{rec.assigned_staff || 'Unassigned'}</td>
                          <td style={td}>{fmtDutyDate(rec)}</td>
                          <td style={td}>{fmtDutyTime(rec)}</td>
                          <td style={td}><Pill tone={tone}>{tone.label}</Pill></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Pagination ── */}
              <div className="flex flex-wrap items-center justify-between gap-3" style={{ padding: '14px 4px 4px' }}>
                <span style={{ ...body, fontSize: '0.8rem', color: MUTED }}>
                  Showing {start + 1}–{Math.min(start + PAGE_SIZE, visibleRecords.length)} of {visibleRecords.length} record{visibleRecords.length === 1 ? '' : 's'}
                </span>
                <nav className="flex items-center gap-1.5" aria-label="Pagination">
                  <button
                    type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}
                    style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${BORDER}`, background: '#fff', color: INK, opacity: currentPage === 1 ? 0.4 : 1, cursor: currentPage === 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {pageList(currentPage, totalPages).map(p => (
                    typeof p === 'string' ? (
                      <span key={p} style={{ ...body, color: MUTED, padding: '0 4px' }}>…</span>
                    ) : (
                      <button
                        key={p} type="button" onClick={() => setPage(p)} aria-current={p === currentPage ? 'page' : undefined}
                        style={{ minWidth: 34, height: 34, borderRadius: 10, ...body, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', border: `1px solid ${p === currentPage ? PRIMARY : 'transparent'}`, background: p === currentPage ? PRIMARY : 'transparent', color: p === currentPage ? '#fff' : INK }}
                      >
                        {p}
                      </button>
                    )
                  ))}
                  <button
                    type="button" aria-label="Next page" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}
                    style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${BORDER}`, background: '#fff', color: INK, opacity: currentPage === totalPages ? 0.4 : 1, cursor: currentPage === totalPages ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </nav>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}