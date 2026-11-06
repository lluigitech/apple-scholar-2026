import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import StaffNotifications from '../../components/Staff/StaffNotifications';
import {
  ClipboardList, CalendarCheck, Users, TrendingUp,
  Megaphone, Calendar, MapPin, Clock,
  ChevronRight, CheckCircle, XCircle, AlertTriangle,
  FileSpreadsheet, AlertCircle, Info, BarChart3, PieChart
} from 'lucide-react';

// ── Design tokens — shared Records Office brand system (values unchanged) ──
const MAROON = '#6D2140';
const MAROON_DEEP = '#4A1730';
const GOLD = '#A9784E';
const BG = '#F3EEE6';
const CARD = '#FFFDF9';
const RULE = '#E7D8C7';
const INK = '#241512';
const MUTED = '#8A7A68';
const SAGE = '#6b8f71';
const CLAY = '#c1666b';
const SLATE = '#5c7487';
const GRAPHITE = '#6b625c';

const API = 'http://localhost:5000/api';
const token = () => localStorage.getItem('token');
const authHeaders = () => ({ headers: { Authorization: `Bearer ${token()}` } });

const display = { fontFamily: "'Lora', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Work Sans', 'Segoe UI', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace" };

// Faint graph-paper grid — the chart surface (kept, but subtler).
const graphPaper = {
  backgroundImage: `linear-gradient(${RULE}66 1px, transparent 1px), linear-gradient(90deg, ${RULE}66 1px, transparent 1px)`,
  backgroundSize: '18px 18px',
};

const RADIUS = 14;
const cardBase = { background: CARD, border: `1px solid ${RULE}`, borderRadius: RADIUS, boxShadow: '0 8px 20px -16px rgba(36,21,18,0.28)' };

const PRIORITY_CFG = {
  critical:  { color: CLAY,  label: 'Critical',  icon: <AlertCircle size={14} /> },
  important: { color: GOLD,  label: 'Important', icon: <AlertTriangle size={14} /> },
  info:      { color: SLATE, label: 'Info',      icon: <Info size={14} /> },
};

const STATUS_CFG = {
  present: { label: 'Present', icon: <CheckCircle size={11} />, color: SAGE },
  absent:  { label: 'Absent',  icon: <XCircle size={11} />,     color: CLAY },
};

const DUTY_STATUS_COLORS = {
  upcoming:  SLATE,
  ongoing:   SAGE,
  completed: GRAPHITE,
  cancelled: CLAY,
};

// Presentation helper — safe short date (returns '' for missing/invalid values).
const shortDate = (value, opts = { month: 'short', day: 'numeric' }) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-PH', opts);
};

function SkeletonBox({ h = 'h-4', w = 'w-full', rounded = 'rounded' }) {
  return <div className={`${h} ${w} ${rounded} animate-pulse`} style={{ background: `${RULE}99` }} />;
}

function SectionHeading({ icon, children, subtitle }) {
  return (
    <div className="flex items-start gap-3 min-w-0">
      <span className="shrink-0 flex items-center justify-center"
        style={{ width: 32, height: 32, borderRadius: 10, background: `${MAROON}12`, color: MAROON }}>
        {icon}
      </span>
      <div className="min-w-0">
        <h2 style={{ ...display, fontSize: '1.05rem', fontWeight: 700, color: INK, lineHeight: 1.25 }}>{children}</h2>
        {subtitle && <p style={{ ...body, fontSize: '0.74rem', color: MUTED, marginTop: 2 }}>{subtitle}</p>}
      </div>
    </div>
  );
}

function PanelAction({ onClick, children }) {
  return (
    <button onClick={onClick} className="sd-focus sd-action shrink-0"
      style={{ ...mono, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.05em', color: MAROON }}>
      {children} <ChevronRight size={12} />
    </button>
  );
}

function EmptyState({ icon, children }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <span style={{ color: RULE, marginBottom: 8 }}>{icon}</span>
      <p style={{ ...body, fontSize: '0.78rem', color: MUTED, fontWeight: 600 }}>{children}</p>
    </div>
  );
}

// ─── StatisticsCards ──────────────────────────────────────────────────────

function StatisticsCards({ loading, totalDuties, upcoming, ongoing, totalGroups, attendanceRate, announcements }) {
  const cards = [
    { label: 'Total Duties',    sub: 'All assigned duties',   value: totalDuties,         icon: <ClipboardList size={18} />, color: MAROON },
    { label: 'Upcoming',        sub: 'Scheduled duties',      value: upcoming,            icon: <Calendar size={18} />,      color: SLATE  },
    { label: 'Ongoing',         sub: 'Currently active',      value: ongoing,             icon: <CalendarCheck size={18} />, color: SAGE   },
    { label: 'Scholar Groups',  sub: 'Across the program',    value: totalGroups,         icon: <Users size={18} />,         color: GOLD   },
    { label: 'Attendance Rate', sub: 'Present of all records', value: `${attendanceRate}%`, icon: <TrendingUp size={18} />,   color: MAROON_DEEP },
    { label: 'Announcements',   sub: 'Posted updates',        value: announcements,       icon: <Megaphone size={18} />,     color: GRAPHITE },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
      {cards.map((card) => (
        <div key={card.label} className="flex items-center gap-3 min-w-0"
          style={{ ...cardBase, padding: '14px 14px', minHeight: 84 }}>
          <span className="shrink-0 flex items-center justify-center"
            style={{ width: 40, height: 40, borderRadius: 12, background: `${card.color}14`, color: card.color }}>
            {card.icon}
          </span>
          <div className="min-w-0 flex-1">
            {loading ? (
              <>
                <SkeletonBox h="h-6" w="w-12" rounded="rounded" />
                <div className="mt-2"><SkeletonBox h="h-2.5" w="w-full" rounded="rounded" /></div>
              </>
            ) : (
              <>
                <p style={{ ...display, fontSize: '1.45rem', fontWeight: 700, color: INK, lineHeight: 1.1 }}>{card.value}</p>
                <p style={{ ...body, fontSize: '0.76rem', fontWeight: 600, color: INK, marginTop: 3 }} className="truncate">{card.label}</p>
                <p style={{ ...body, fontSize: '0.66rem', color: MUTED, marginTop: 1 }} className="truncate">{card.sub}</p>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── WeeklyAttendanceChart (daily attendance rate, pure CSS bar chart) ─────

// Parse a value into a valid local Date, or null. Date-only strings (YYYY-MM-DD)
// are treated as LOCAL dates so they never shift to the previous/next day.
const parseAttendanceDate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value !== 'string') return null;

  const s = value.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const y = +m[1], mo = +m[2] - 1, day = +m[3];
    const d = new Date(y, mo, day);
    return d.getFullYear() === y && d.getMonth() === mo && d.getDate() === day ? d : null;
  }
  const d = new Date(/^\d{4}-\d{2}-\d{2} /.test(s) ? s.replace(' ', 'T') : s);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Use the scheduled duty date first so weekly attendance follows the duty week,
// not the time an admin later records an attendance correction.
const getAttendanceDate = (record) => {
  for (const field of ['date', 'duty_date', 'marked_at']) {
    const d = parseAttendanceDate(record?.[field]);
    if (d) return d;
  }
  return null;
};

const localDayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const rateColor = (rate) => (rate >= 75 ? SAGE : rate >= 50 ? GOLD : CLAY);

function WeeklyAttendanceChart({ loading, records }) {
  const [active, setActive] = useState(null);

  // Last 7 calendar weeks, Monday through Sunday, oldest → current week.
  const today = new Date();
  const currentWeekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  currentWeekStart.setDate(currentWeekStart.getDate() - ((currentWeekStart.getDay() + 6) % 7));
  const buckets = Array.from({ length: 7 }).map((_, i) => {
    const startDate = new Date(currentWeekStart);
    startDate.setDate(startDate.getDate() - (6 - i) * 7);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    return { startDate, endDate, key: localDayKey(startDate), present: 0, absent: 0 };
  });
  const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]));

  (Array.isArray(records) ? records : []).forEach((r) => {
    const d = getAttendanceDate(r);
    if (!d) return; // invalid / missing date → not counted
    const weekStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const bucket = byKey[localDayKey(weekStart)];
    if (!bucket) return; // outside the last 7 weeks
    const rawStatus = String(r?.status ?? '').toLowerCase();
    const status = rawStatus === 'excused' ? 'absent' : rawStatus;
    if (status === 'present' || status === 'absent') bucket[status] += 1;
  });

  buckets.forEach((b) => {
    b.total = b.present + b.absent;
    b.rate = b.total > 0 ? Math.round((b.present / b.total) * 100) : null; // null = unavailable
  });

  const hasData = buckets.some((b) => b.total > 0);
  const PLOT_H = 176;
  const colGap = 'gap-2 sm:gap-3';
  const sidePad = { padding: '0 8px' };

  return (
    <div style={{ ...cardBase, padding: 20, height: '100%' }}>
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <SectionHeading icon={<BarChart3 size={16} />} subtitle="Present ÷ total attendance records, per duty week over the last 7 weeks">
          Weekly Attendance Rate
        </SectionHeading>
        <div className="flex items-center gap-3 flex-wrap" style={{ ...body, fontSize: '0.7rem', color: MUTED }}>
          <span className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: '50%', background: SAGE, display: 'inline-block' }} /> 75%+</span>
          <span className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: '50%', background: GOLD, display: 'inline-block' }} /> 50–74%</span>
          <span className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: '50%', background: CLAY, display: 'inline-block' }} /> Below 50%</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-end gap-3 h-48">
          {Array(7).fill(0).map((_, i) => (
            <SkeletonBox key={i} h="h-full" w="w-full" rounded="rounded" />
          ))}
        </div>
      ) : !hasData ? (
        <div className="flex items-center justify-center" style={{ minHeight: 192 }}>
          <EmptyState icon={<BarChart3 size={26} />}>No attendance records in the last 7 weeks</EmptyState>
        </div>
      ) : (
        <div className="flex gap-2">
          {/* Y axis: 0–100% */}
          <div className="shrink-0 relative" style={{ width: 34, height: PLOT_H, marginTop: 16 }} aria-hidden="true">
            {[0, 25, 50, 75, 100].map((t) => (
              <span key={t} style={{ ...mono, position: 'absolute', right: 0, bottom: `${t}%`, transform: 'translateY(50%)', fontSize: '0.62rem', color: MUTED }}>
                {t}%
              </span>
            ))}
          </div>

          <div className="flex-1 min-w-0">
            {/* Plot area */}
            <div className={`relative flex items-stretch justify-between ${colGap}`}
              style={{ ...graphPaper, ...sidePad, height: PLOT_H, marginTop: 16, borderRadius: 10, borderBottom: `1px solid ${RULE}` }}>
              {[25, 50, 75, 100].map((t) => (
                <div key={t} aria-hidden="true"
                  style={{ position: 'absolute', left: 0, right: 0, bottom: `${t}%`, borderTop: `1px dashed ${RULE}`, pointerEvents: 'none' }} />
              ))}

              {buckets.map((b, i) => {
                const available = b.rate !== null;
                const color = available ? rateColor(b.rate) : RULE;
                const dateLong = `${b.startDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} – ${b.endDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`;
                const tipPos = i <= 1 ? { left: 0 } : i >= 5 ? { right: 0 } : { left: '50%', transform: 'translateX(-50%)' };
                return (
                  <div key={b.key}
                    className="flex-1 min-w-0 relative sd-focus"
                    style={{ cursor: 'default', outline: 'none' }}
                    tabIndex={0}
                    role="img"
                    aria-label={available
                      ? `${dateLong}: ${b.rate}% attendance rate, ${b.present} present, ${b.absent} absent, ${b.total} records`
                      : `${dateLong}: no attendance records`}
                    onMouseEnter={() => setActive(i)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    onClick={() => setActive((cur) => (cur === i ? null : i))}>
                    {available ? (
                      <>
                        <div className="transition-all"
                          style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 44, height: `${b.rate}%`, minHeight: b.rate > 0 ? 3 : 0, background: color, borderRadius: '6px 6px 0 0', opacity: active === null || active === i ? 1 : 0.55 }} />
                        <span style={{ ...mono, position: 'absolute', left: 0, right: 0, textAlign: 'center', bottom: `calc(${b.rate}% + 3px)`, fontSize: '0.64rem', fontWeight: 700, color: INK }}>
                          {b.rate}%
                        </span>
                      </>
                    ) : (
                      <span style={{ ...mono, position: 'absolute', left: 0, right: 0, bottom: 4, textAlign: 'center', fontSize: '0.62rem', color: MUTED }}>
                        n/a
                      </span>
                    )}

                    {active === i && (
                      <div role="tooltip"
                        style={{ ...body, position: 'absolute', top: 4, ...tipPos, zIndex: 20, width: 190, background: CARD, border: `1px solid ${RULE}`, borderRadius: 10, padding: '10px 12px', boxShadow: '0 10px 24px -12px rgba(36,21,18,0.4)', pointerEvents: 'none', fontSize: '0.72rem', color: INK }}>
                        <p style={{ fontWeight: 700, color: MAROON, marginBottom: 6 }}>{dateLong}</p>
                        {available ? (
                          <>
                            <div className="flex justify-between"><span style={{ color: MUTED }}>Attendance rate</span><b>{b.rate}%</b></div>
                            <div className="flex justify-between"><span style={{ color: SAGE }}>Present</span><b>{b.present}</b></div>
                            <div className="flex justify-between"><span style={{ color: CLAY }}>Absent</span><b>{b.absent}</b></div>
                            <div className="flex justify-between" style={{ borderTop: `1px solid ${RULE}`, marginTop: 4, paddingTop: 4 }}>
                              <span style={{ color: MUTED }}>Total records</span><b>{b.total}</b>
                            </div>
                          </>
                        ) : (
                          <p style={{ color: MUTED }}>No attendance records</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* X axis labels (same gap/padding as the plot so they align) */}
            <div className={`flex justify-between ${colGap}`} style={{ ...sidePad, marginTop: 8 }}>
              {buckets.map((b) => (
                <div key={b.key} className="flex-1 min-w-0 text-center">
                  <p style={{ ...mono, fontSize: '0.66rem', color: INK, fontWeight: 700 }}>
                    {b.startDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                  </p>
                  <p style={{ ...mono, fontSize: '0.62rem', color: MUTED }}>
                    {b.endDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DutyStatusDonut (pure SVG donut chart) ────────────────────────────────

function DutyStatusDonut({ loading, duties }) {
  const counts = {
    upcoming:  duties.filter(d => d.status === 'upcoming').length,
    ongoing:   duties.filter(d => d.status === 'ongoing').length,
    completed: duties.filter(d => d.status === 'completed').length,
    cancelled: duties.filter(d => d.status === 'cancelled').length,
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  let offsetAcc = 0;

  const segments = Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => {
      const pct = total > 0 ? value / total : 0;
      const dash = pct * circumference;
      const seg = {
        key,
        color: DUTY_STATUS_COLORS[key],
        dash,
        gap: circumference - dash,
        offset: -offsetAcc,
        value,
        pct: Math.round(pct * 100),
      };
      offsetAcc += dash;
      return seg;
    });

  return (
    <div style={{ ...cardBase, padding: 20, height: '100%' }}>
      <div className="mb-4">
        <SectionHeading icon={<PieChart size={16} />} subtitle="Duties by current status">
          Duty Status Breakdown
        </SectionHeading>
      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ minHeight: 192 }}>
          <div className="w-32 h-32 rounded-full animate-pulse" style={{ background: `${RULE}99` }} />
        </div>
      ) : total === 0 ? (
        <EmptyState icon={<ClipboardList size={26} />}>No duties yet</EmptyState>
      ) : (
        <div className="flex items-center gap-5 flex-wrap justify-center" style={{ minHeight: 192 }}>
          <div className="relative shrink-0" style={{ width: 128, height: 128 }}>
            <svg width="128" height="128" viewBox="0 0 112 112" className="-rotate-90">
              <circle cx="56" cy="56" r={radius} fill="none" stroke={BG} strokeWidth="14" />
              {segments.map((s) => (
                <circle
                  key={s.key}
                  cx="56" cy="56" r={radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="14"
                  strokeDasharray={`${s.dash} ${s.gap}`}
                  strokeDashoffset={s.offset}
                  strokeLinecap="butt"
                  style={{ transition: 'stroke-dasharray 0.6s ease' }}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span style={{ ...display, fontSize: '1.4rem', fontWeight: 700, color: INK, lineHeight: 1 }}>{total}</span>
              <span style={{ ...body, fontSize: '0.64rem', color: MUTED, marginTop: 2 }}>Duties</span>
            </div>
          </div>
          <div className="flex-1 min-w-[150px]">
            {Object.entries(counts).filter(([, v]) => v > 0).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-3"
                style={{ fontSize: '0.78rem', padding: '7px 0', borderBottom: `1px solid ${RULE}` }}>
                <div className="flex items-center gap-2">
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: DUTY_STATUS_COLORS[key], display: 'inline-block' }} />
                  <span style={{ ...body, fontWeight: 600, color: '#5c4a3f', textTransform: 'capitalize' }}>{key}</span>
                </div>
                <span style={{ ...body, color: MUTED }}>
                  <span style={{ ...display, fontWeight: 700, color: INK }}>{value}</span>
                  {' '}({segments.find(s => s.key === key)?.pct}%)
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between" style={{ paddingTop: 8, fontSize: '0.78rem' }}>
              <span style={{ ...body, fontWeight: 600, color: MUTED }}>Total</span>
              <span style={{ ...display, fontWeight: 700, color: MAROON }}>{total}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GroupAttendanceChart({ loading, groups, records }) {
  const summaries = new Map(
    groups.map(group => [group.group_name, {
      name: group.group_name,
      present: 0,
      absent: 0,
    }])
  );

  records.forEach(record => {
    const name = record.group_name || 'Unassigned';
    if (!summaries.has(name)) summaries.set(name, { name, present: 0, absent: 0 });
    const rawStatus = String(record.status || '').toLowerCase();
    const status = rawStatus === 'excused' ? 'absent' : rawStatus;
    if (status === 'present' || status === 'absent') summaries.get(name)[status] += 1;
  });

  const rows = [...summaries.values()]
    .map(group => {
      const total = group.present + group.absent;
      return { ...group, total, rate: total ? Math.round(group.present / total * 100) : null };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div style={{ ...cardBase, padding: 20 }}>
      <div className="mb-4">
        <SectionHeading icon={<Users size={16} />} subtitle="Present ÷ recorded attendance for each assigned scholar group">
          Attendance by Group
        </SectionHeading>
      </div>
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <SkeletonBox key={i} h="h-12" rounded="rounded-xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Users size={26} />}>No scholar groups assigned yet</EmptyState>
      ) : (
        <div className="space-y-4">
          {rows.map(group => (
            <div key={group.name}>
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <p className="truncate" style={{ ...body, fontSize: '0.8rem', fontWeight: 700, color: INK }}>{group.name}</p>
                <p className="shrink-0" style={{ ...mono, fontSize: '0.72rem', fontWeight: 700, color: group.rate === null ? MUTED : rateColor(group.rate) }}>
                  {group.rate === null ? 'No records' : `${group.rate}%`}
                </p>
              </div>
              <div role="img"
                aria-label={`${group.name}: ${group.present} present, ${group.absent} absent, ${group.total} total records`}
                style={{ display: 'flex', height: 10, overflow: 'hidden', borderRadius: 999, background: BG }}>
                {group.total > 0 && (
                  <>
                    <span style={{ width: `${group.present / group.total * 100}%`, background: SAGE }} />
                    <span style={{ width: `${group.absent / group.total * 100}%`, background: CLAY }} />
                  </>
                )}
              </div>
              <p style={{ ...body, fontSize: '0.68rem', color: MUTED, marginTop: 5 }}>
                {group.present} present · {group.absent} absent · {group.total} total
              </p>
            </div>
          ))}
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2" style={{ borderTop: `1px solid ${RULE}`, ...body, fontSize: '0.68rem', color: MUTED }}>
            <span className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: '50%', background: SAGE }} /> Present</span>
            <span className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: '50%', background: CLAY }} /> Absent</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── UpcomingDuties ─────────────────────────────────────────────────────────

function UpcomingDuties({ loading, duties, navigate }) {
  return (
    <div style={{ ...cardBase, padding: 20, height: '100%' }}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <SectionHeading icon={<Calendar size={16} />} subtitle="Upcoming and ongoing duties, soonest first">Upcoming Duties</SectionHeading>
        <PanelAction onClick={() => navigate('/staff/task-assignment')}>VIEW ALL</PanelAction>
      </div>
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <SkeletonBox key={i} h="h-14" rounded="rounded-xl" />)}</div>
      ) : duties.length === 0 ? (
        <EmptyState icon={<Calendar size={26} />}>No upcoming duties</EmptyState>
      ) : (
        <div>
          {duties.slice(0, 5).map((d) => {
            const color = DUTY_STATUS_COLORS[d.status] || SLATE;
            const dateText = shortDate(d.duty_date);
            return (
              <div key={d.id} className="flex items-center gap-3"
                style={{ padding: '11px 0 11px 12px', borderTop: `1px solid ${RULE}`, borderLeft: `3px solid ${color}` }}>
                <div className="min-w-0 flex-1">
                  <p style={{ ...body, fontSize: '0.82rem', fontWeight: 700, color: '#3f2f28' }} className="truncate">{d.title}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                    {dateText && (
                      <span className="flex items-center gap-1" style={{ ...mono, fontSize: '0.66rem', color: MUTED }}>
                        <Calendar size={10} /> {dateText}
                      </span>
                    )}
                    {d.time_start && (
                      <span className="flex items-center gap-1" style={{ ...mono, fontSize: '0.66rem', color: MUTED }}>
                        <Clock size={10} /> {d.time_start}
                      </span>
                    )}
                    {d.location && (
                      <span className="flex items-center gap-1 min-w-0" style={{ ...mono, fontSize: '0.66rem', color: MUTED }}>
                        <MapPin size={10} className="shrink-0" /> <span className="truncate">{d.location}</span>
                      </span>
                    )}
                  </div>
                </div>
                <span className="shrink-0"
                  style={{ ...mono, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.04em', color, background: `${color}16`, borderRadius: 999, padding: '4px 10px', textTransform: 'uppercase' }}>
                  {d.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── RecentAttendance ───────────────────────────────────────────────────────

function RecentAttendance({ loading, records, navigate }) {
  return (
    <div style={{ ...cardBase, padding: 20, height: '100%' }}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <SectionHeading icon={<CalendarCheck size={16} />} subtitle="Latest attendance records, newest first">Recent Attendance</SectionHeading>
        <PanelAction onClick={() => navigate('/staff/attendance-reports')}>FULL REPORT</PanelAction>
      </div>
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <SkeletonBox key={i} h="h-12" rounded="rounded-xl" />)}</div>
      ) : records.length === 0 ? (
        <EmptyState icon={<FileSpreadsheet size={26} />}>No attendance records yet</EmptyState>
      ) : (
        <div>
          {records.slice(0, 5).map((r, i) => {
            const badge = STATUS_CFG[r.status] || STATUS_CFG.absent;
            return (
              <div key={i} className="flex items-center justify-between gap-3" style={{ padding: '11px 0', borderTop: `1px solid ${RULE}` }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 flex items-center justify-center text-white shrink-0 rounded-full"
                    style={{ ...mono, fontSize: '0.72rem', fontWeight: 700, background: `linear-gradient(135deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)` }}>
                    {r.scholar?.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p style={{ ...body, fontSize: '0.82rem', fontWeight: 700, color: '#3f2f28' }} className="truncate">{r.scholar}</p>
                    <p style={{ ...mono, fontSize: '0.66rem', color: MUTED }} className="truncate">{r.duty}</p>
                  </div>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1"
                  style={{ padding: '4px 10px', borderRadius: 999, background: `${badge.color}16`, ...body, fontSize: '0.68rem', fontWeight: 600, color: badge.color }}>
                  {badge.icon} {badge.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── RecentAnnouncements ────────────────────────────────────────────────────

function RecentAnnouncements({ loading, announcements, navigate }) {
  return (
    <div style={{ ...cardBase, padding: 20, height: '100%' }}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <SectionHeading icon={<Megaphone size={16} />} subtitle="Latest updates, newest first">Recent Announcements</SectionHeading>
        <PanelAction onClick={() => navigate('/staff/announcements')}>VIEW ALL</PanelAction>
      </div>
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <SkeletonBox key={i} h="h-14" rounded="rounded-xl" />)}</div>
      ) : announcements.length === 0 ? (
        <EmptyState icon={<Megaphone size={26} />}>No announcements yet</EmptyState>
      ) : (
        <div>
          {announcements.slice(0, 5).map((announcement) => {
            const cfg = PRIORITY_CFG[announcement.priority] || PRIORITY_CFG.info;
            const dateText = shortDate(announcement.created_at);
            return (
              <div key={announcement.id} className="flex items-start gap-3" style={{ padding: '11px 0', borderTop: `1px solid ${RULE}` }}>
                <div className="w-9 h-9 flex items-center justify-center shrink-0"
                  style={{ borderRadius: 10, background: `${cfg.color}14`, color: cfg.color }}>
                  {cfg.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p style={{ ...body, fontSize: '0.82rem', fontWeight: 700, color: '#3f2f28' }} className="truncate">{announcement.title}</p>
                    <span className="shrink-0"
                      style={{ ...body, fontSize: '0.64rem', fontWeight: 600, color: cfg.color, background: `${cfg.color}16`, borderRadius: 999, padding: '2px 9px' }}>
                      {cfg.label}
                    </span>
                  </div>
                  <p style={{ ...body, fontSize: '0.74rem', color: MUTED, marginTop: 2, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{announcement.content}</p>
                  {(dateText || announcement.created_by) && (
                    <p style={{ ...mono, fontSize: '0.62rem', color: MUTED, marginTop: 4 }}>
                      {dateText}{dateText && announcement.created_by ? ' · ' : ''}{announcement.created_by}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main StaffDashboard ───────────────────────────────────────────────────

const StaffDashboard = () => {
  const name = localStorage.getItem('name');
  const navigate = useNavigate();
  const fetchInProgress = useRef(false);

  const [duties, setDuties] = useState([]);
  const [groups, setGroups] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [makeupSources, setMakeupSources] = useState([]);
  const [notificationPreferences, setNotificationPreferences] = useState({});
  const [notificationError, setNotificationError] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (showLoading = false) => {
    if (fetchInProgress.current) return;
    fetchInProgress.current = true;
    if (showLoading) setLoading(true);
    try {
      const endpoints = [
        ['duties', `${API}/duties`],
        ['groups', `${API}/staff/groups`],
        ['attendance', `${API}/staff/reports/duty-attendance`],
        ['announcements', `${API}/staff/announcements`],
        ['makeup', `${API}/staff/makeup-request-data`],
        ['preferences', `${API}/staff/settings/notifications`],
      ];
      const results = await Promise.allSettled(
        endpoints.map(([, url]) => axios.get(url, authHeaders()))
      );
      const data = {};
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          data[endpoints[index][0]] = result.value.data;
        } else {
          console.error(`Failed to refresh Staff dashboard ${endpoints[index][0]}:`, result.reason);
        }
      });

      setNotificationError(['duties', 'announcements', 'makeup', 'preferences']
        .some(key => results[endpoints.findIndex(([endpointKey]) => endpointKey === key)]?.status === 'rejected'));
      if (Array.isArray(data.duties)) setDuties(data.duties);
      if (Array.isArray(data.groups)) setGroups(data.groups);
      if (Array.isArray(data.attendance)) setAttendanceRecords(data.attendance);
      if (Array.isArray(data.announcements)) setAnnouncements(data.announcements);
      if (Array.isArray(data.makeup?.sources)) setMakeupSources(data.makeup.sources);
      if (data.preferences && typeof data.preferences === 'object') setNotificationPreferences(data.preferences);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      fetchInProgress.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => fetchData(true), 0);
    const refreshInterval = window.setInterval(() => fetchData(), 60_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') fetchData();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [fetchData]);

  const upcoming = duties.filter(d => d.status === 'upcoming').length;
  const ongoing = duties.filter(d => d.status === 'ongoing').length;

  const upcomingDutiesSorted = [...duties]
    .filter(d => d.status === 'upcoming' || d.status === 'ongoing')
    .sort((a, b) => new Date(a.duty_date) - new Date(b.duty_date));

  const recentAttendanceSorted = [...attendanceRecords]
    .sort((a, b) => new Date(b.marked_at || b.date) - new Date(a.marked_at || a.date));

  const recentAnnouncementsSorted = [...announcements]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
  const attendanceRate = attendanceRecords.length > 0
    ? Math.round((presentCount / attendanceRecords.length) * 100)
    : 0;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const now = new Date();
  const todayLabel = now.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8" style={{ ...body, background: BG, overflowX: 'hidden' }}>
      <div className="w-full">

        {/* Standard Staff header: title card + date card */}
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_280px] gap-3.5 mb-3.5">
          <div className="staff-page-header-card flex items-center justify-between gap-4 flex-wrap" style={{ ...cardBase, padding: '18px 24px' }}>
            <div className="min-w-0">
              <span className="staff-page-eyebrow">STAFF PORTAL</span>
              <h1 className="staff-page-title">Dashboard</h1>
              <p className="staff-page-description">Your daily overview of duties, attendance, and announcements.</p>
              <p style={{ ...body, fontSize: '0.8rem', color: INK, marginTop: 6 }}>
                {getGreeting()}, <span style={{ color: MAROON, fontWeight: 600 }}>{name || 'Staff'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4" style={{ ...cardBase, padding: '18px 22px' }}>
            <span className="shrink-0 flex items-center justify-center"
              style={{ width: 46, height: 46, borderRadius: 12, background: `${GOLD}1F`, border: `1px solid ${RULE}`, color: GOLD }}>
              <Calendar size={20} />
            </span>
            <div className="min-w-0">
              <span className="staff-page-date-label">Today</span>
              <span className="staff-page-date-value">{todayLabel}</span>
            </div>
            <div aria-hidden="true" style={{ alignSelf: 'stretch', width: 1, background: RULE, margin: '0 2px' }} />
            <StaffNotifications
              loading={loading}
              duties={duties}
              announcements={recentAnnouncementsSorted}
              makeupSources={makeupSources}
              preferences={notificationPreferences}
              error={notificationError}
              onRetry={() => fetchData(true)}
              onNavigate={navigate}
            />
          </div>
        </div>

        {/* Row 1: Statistics */}
        <StatisticsCards
          loading={loading}
          totalDuties={duties.length}
          upcoming={upcoming}
          ongoing={ongoing}
          totalGroups={groups.length}
          attendanceRate={attendanceRate}
          announcements={announcements.length}
        />

        {/* Row 2: Upcoming Duties + Recent Attendance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 mb-3.5">
          <div className="min-w-0"><UpcomingDuties loading={loading} duties={upcomingDutiesSorted} navigate={navigate} /></div>
          <div className="min-w-0"><RecentAttendance loading={loading} records={recentAttendanceSorted} navigate={navigate} /></div>
        </div>

        {/* Row 3: Attendance rate + duty attendance breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3.5">
          <div className="lg:col-span-3 min-w-0">
            <WeeklyAttendanceChart loading={loading} records={attendanceRecords} />
          </div>
          <div className="lg:col-span-2 min-w-0">
            <DutyStatusDonut loading={loading} duties={duties} />
          </div>
        </div>

        <div className="mt-3.5">
          <GroupAttendanceChart loading={loading} groups={groups} records={attendanceRecords} />
        </div>

        {/* Row 4: Recent announcements + quick actions */}
        <div className="grid grid-cols-1 gap-3.5 mt-3.5">
          <div className="min-w-0">
            <RecentAnnouncements loading={loading} announcements={recentAnnouncementsSorted} navigate={navigate} />
          </div>
        </div>
      </div>

      <style>{`

        .sd-action { display: inline-flex; align-items: center; gap: 2px; background: none; border: none; cursor: pointer; padding: 6px 4px; border-radius: 8px; white-space: nowrap; }
        .sd-action:hover { opacity: 0.7; }
        .sd-focus:focus-visible { outline: 2px solid ${MAROON}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
      `}</style>
    </div>
  );
};

export default StaffDashboard;