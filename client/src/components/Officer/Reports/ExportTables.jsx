import {
  GraduationCap, Clock, Calendar, ChevronDown,
  BarChart2, Search, Activity, FileText, ClipboardList,
} from "lucide-react";
import { fmt } from "./ReportsHelpers";
import { Badge, Th, Td, Avatar } from "./SharedTableBits";

// ── Design tokens — shared Records Office brand system ──
// These tables live inside the "Statistics Bureau" page (Officer
// Reports → Export Reports), so they carry the same ledger look as
// the Compliance Summary and Monthly Letter Review tables: mono
// headers, hairline row rules, and section headers styled as bound
// statistical-return tables rather than plain white cards.
const MAROON = '#7f2d3a';
const GOLD = '#b98b4e';
const BG = '#F6EFE4';
const CARD = '#fffdf8';
const RULE = '#e8dccb';
const INK = '#241512';
const MUTED = '#a89890';
const SAGE = '#6b8f71';
const CLAY = '#c1666b';
const AMBER = '#b8863f';
const SLATE = '#5c7487';

const display = { fontFamily: "'Lora', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Work Sans', 'Segoe UI', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace" };

const headRowStyle = { background: `${MAROON}0a`, borderBottom: `1.5px solid ${RULE}` };
const rowStyle = { borderTop: `1px solid ${RULE}` };
const rowHover = 'hover:bg-[#F6EFE4]';

// ─── Data tables ────────────────────────────────────────────────────────────

export const DutyTable = ({ rows }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full" style={{ fontSize: '0.85rem' }}>
      <thead><tr style={headRowStyle}>
        <Th>Scholar</Th><Th>Scholar ID</Th><Th>Date</Th><Th>Duty / Activity</Th><Th>Location</Th><Th>Status</Th><Th>Method</Th>
      </tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={`transition-colors ${rowHover}`} style={rowStyle}>
            <Td><div className="flex items-center gap-2.5"><Avatar name={r.scholar} /><span style={{ ...body, fontWeight: 700, color: INK }}>{r.scholar}</span></div></Td>
            <Td><span style={{ ...mono, fontSize: '0.72rem', color: MUTED }}>{r.scholar_id}</span></Td>
            <Td><span style={{ ...mono, fontSize: '0.74rem', color: '#6b6058' }}>{r.date ? new Date(r.date).toLocaleDateString("en-PH") : "—"}</span></Td>
            <Td><span className="inline-flex items-center gap-1.5" style={{ ...body, color: '#3f2f28' }}><ClipboardList size={13} style={{ color: MUTED }} />{r.duty}</span></Td>
            <Td><span style={{ ...body, fontSize: '0.76rem', color: '#6b6058' }}>{fmt(r.location)}</span></Td>
            <Td><Badge status={r.status} /></Td>
            <Td><span style={{ ...mono, fontSize: '0.7rem', color: MUTED, textTransform: 'capitalize' }}>{fmt(r.method)}</span></Td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const SubmissionsTable = ({ rows }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full" style={{ fontSize: '0.85rem' }}>
      <thead><tr style={headRowStyle}>
        <Th>Scholar</Th><Th>Scholar ID</Th><Th>Submission Type</Th><Th>Deadline</Th><Th>Submitted At</Th><Th>Approved At</Th><Th>Status</Th><Th>Quality Status</Th>
      </tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={`transition-colors ${rowHover}`} style={rowStyle}>
            <Td><div className="flex items-center gap-2.5"><Avatar name={r.scholar} /><span style={{ ...body, fontWeight: 700, color: INK }}>{r.scholar}</span></div></Td>
            <Td><span style={{ ...mono, fontSize: '0.72rem', color: MUTED }}>{r.scholar_id}</span></Td>
            <Td><span style={{ ...body, fontSize: '0.78rem', color: '#3f2f28' }}>{fmt({ letter: "Monthly Letter", report_card: "Report Card", cor: "COR", other: "Other Document" }[r.type || r.submission_type] || r.type || r.submission_type)}</span></Td>
            <Td><span style={{ ...mono, fontSize: '0.72rem', color: '#6b6058' }}>{r.deadline ? new Date(r.deadline).toLocaleDateString("en-PH") : "—"}</span></Td>
            <Td><span style={{ ...mono, fontSize: '0.72rem', color: '#6b6058' }}>{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString("en-PH") : "—"}</span></Td>
            <Td><span style={{ ...mono, fontSize: '0.72rem', color: '#6b6058' }}>{r.approved_at ? new Date(r.approved_at).toLocaleDateString("en-PH") : "—"}</span></Td>
            <Td><Badge status={r.status} /></Td>
            <Td><span style={{ ...mono, fontSize: '0.7rem', color: MUTED, textTransform: 'capitalize' }}>{fmt(r.quality_status)}</span></Td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const RequirementsTable = ({ rows }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full" style={{ fontSize: '0.85rem' }}>
      <thead><tr style={headRowStyle}>
        <Th>Scholar</Th><Th>Scholar ID</Th><Th>Requirement</Th><Th>Status</Th><Th>Deadline</Th><Th>Submitted At</Th><Th>Approved At</Th>
      </tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={`transition-colors ${rowHover}`} style={rowStyle}>
            <Td><div className="flex items-center gap-2.5"><Avatar name={r.scholar} /><span style={{ ...body, fontWeight: 700, color: INK }}>{r.scholar}</span></div></Td>
            <Td><span style={{ ...mono, fontSize: '0.72rem', color: MUTED }}>{r.scholar_id}</span></Td>
            <Td><span className="inline-flex items-center gap-1.5" style={{ ...body, fontWeight: 600, color: '#3f2f28' }}><GraduationCap size={13} style={{ color: MUTED }} />{fmt(r.type)}</span></Td>
            <Td><Badge status={r.status} /></Td>
            <Td><span style={{ ...mono, fontSize: '0.7rem', color: '#6b6058' }}>{r.deadline ? new Date(r.deadline).toLocaleDateString("en-PH") : "—"}</span></Td>
            <Td><span style={{ ...mono, fontSize: '0.7rem', color: '#6b6058' }}>{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString("en-PH") : "—"}</span></Td>
            <Td><span style={{ ...mono, fontSize: '0.7rem', color: '#6b6058' }}>{r.approved_at ? new Date(r.approved_at).toLocaleDateString("en-PH") : "—"}</span></Td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const ActivitiesTable = ({ rows }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full" style={{ fontSize: '0.85rem' }}>
      <thead><tr style={headRowStyle}>
        <Th>Scholar</Th><Th>Scholar ID</Th><Th>Activity</Th><Th>Date</Th><Th>Location</Th><Th>Attended</Th><Th>Method</Th>
      </tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={`transition-colors ${rowHover}`} style={rowStyle}>
            <Td><div className="flex items-center gap-2.5"><Avatar name={r.scholar} /><span style={{ ...body, fontWeight: 700, color: INK }}>{r.scholar}</span></div></Td>
            <Td><span style={{ ...mono, fontSize: '0.72rem', color: MUTED }}>{r.scholar_id}</span></Td>
            <Td><span style={{ ...body, fontWeight: 600, color: '#3f2f28' }}>{r.activity}</span></Td>
            <Td><span style={{ ...mono, fontSize: '0.74rem', color: '#6b6058' }}>{r.date ? new Date(r.date).toLocaleDateString("en-PH") : "—"}</span></Td>
            <Td><span style={{ ...body, fontSize: '0.76rem', color: '#6b6058' }}>{fmt(r.location)}</span></Td>
            <Td><Badge status={r.attended} /></Td>
            <Td><span style={{ ...mono, fontSize: '0.7rem', color: MUTED, textTransform: 'capitalize' }}>{fmt(r.method)}</span></Td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── Section wrapper — a bound sub-table header, mono eyebrow + count ──────

const SECTION_CONFIG = {
  "Duty Attendance":                    { icon: ClipboardList, color: SLATE },
  "Monthly Letter Submissions":         { icon: FileText,      color: MAROON },
  "Requirements (COR / Grades / Card)": { icon: GraduationCap, color: AMBER },
  "Activity Participation":             { icon: Activity,      color: SAGE },
};

export const Section = ({ title, count, children }) => {
  const cfg = SECTION_CONFIG[title] || { icon: BarChart2, color: MUTED };
  const Icon = cfg.icon;
  return (
    <div style={{ background: CARD, border: `1px solid ${RULE}`, borderRadius: 4, overflow: 'hidden', boxShadow: '0 6px 16px -12px rgba(36,21,18,0.2)' }}>
      <div className="flex items-center px-5 py-3.5" style={{ borderBottom: `1.5px solid ${RULE}`, background: `${cfg.color}0a` }}>
        <div className="flex items-center justify-center flex-shrink-0" style={{ width: 26, height: 26, borderRadius: 4, background: CARD, border: `1px solid ${cfg.color}33`, marginRight: 10 }}>
          <Icon size={13} style={{ color: cfg.color }} />
        </div>
        <span style={{ ...display, fontSize: '0.95rem', fontWeight: 600, color: INK }}>{title}</span>
        <span className="ml-2" style={{ ...mono, fontSize: '0.62rem', fontWeight: 700, padding: '2px 9px', borderRadius: 3, background: CARD, color: cfg.color, border: `1px solid ${cfg.color}44` }}>{count}</span>
      </div>
      {count > 0 ? children : (
        <div className="py-10 text-center">
          <Search size={24} className="mx-auto mb-2" style={{ color: RULE }} />
          <p style={{ ...body, fontSize: '0.85rem', color: MUTED }}>No records found</p>
        </div>
      )}
    </div>
  );
};

// ─── Stat card — an index card, top rule colored by category ──────────────

export const StatCard = ({ label, count, icon: Icon, color, bg, border }) => (
  <div className="relative overflow-hidden flex items-center gap-3" style={{ background: CARD, border: `1px solid ${RULE}`, borderRadius: 4, padding: 16 }}>
    <span aria-hidden="true" className="absolute top-0 left-0 right-0" style={{ height: 3, background: MAROON }} />
    <div className="flex items-center justify-center flex-shrink-0" style={{ width: 38, height: 38, borderRadius: 4, background: `${MAROON}0f`, border: `1px solid ${MAROON}22` }}>
      <Icon size={16} style={{ color: MAROON }} />
    </div>
    <div>
      <div style={{ ...display, fontSize: '1.4rem', fontWeight: 700, color: MAROON, lineHeight: 1 }}>{count}</div>
      <div style={{ ...mono, fontSize: '0.62rem', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 3 }}>{label}</div>
    </div>
  </div>
);

// ─── Filter form fields — underline ledger inputs ──────────────────────────

export const SelectField = ({ label, icon: Icon, value, onChange, children }) => (
  <div>
    <label style={{ ...mono, fontSize: '0.6rem', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>{label}</label>
    <div className="relative flex items-center gap-2" style={{ borderBottom: `1.5px solid ${RULE}`, padding: '6px 2px' }}>
      {Icon && <Icon size={13} style={{ color: MUTED, flexShrink: 0 }} />}
      <select value={value} onChange={onChange}
        className="w-full appearance-none outline-none"
        style={{ ...body, fontSize: '0.85rem', color: INK, background: 'none', border: 'none' }}>
        {children}
      </select>
      <ChevronDown size={13} style={{ color: MUTED, flexShrink: 0 }} />
    </div>
  </div>
);

export const DateField = ({ label, value, onChange, type = "date" }) => (
  <div>
    <label style={{ ...mono, fontSize: '0.6rem', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>{label}</label>
    <div className="flex items-center gap-2" style={{ borderBottom: `1.5px solid ${RULE}`, padding: '6px 2px' }}>
      <Calendar size={13} style={{ color: MUTED, flexShrink: 0 }} />
      <input type={type} value={value} onChange={onChange}
        className="w-full outline-none"
        style={{ ...body, fontSize: '0.85rem', color: INK, background: 'none', border: 'none' }} />
    </div>
  </div>
);