import {
  GraduationCap, Clock, Calendar, ChevronDown,
  BarChart2, Search, Activity, FileText, ClipboardList,
} from "lucide-react";
import { fmt } from "./ReportsHelpers";
import { Badge, Th, Td, Avatar } from "./SharedTableBits";

// ─── Data tables ────────────────────────────────────────────────────────────

export const DutyTable = ({ rows }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full">
      <thead><tr className="border-b border-slate-100">
        <Th>Scholar</Th><Th>Scholar ID</Th><Th>Date</Th><Th>Duty / Activity</Th><Th>Location</Th><Th>Status</Th><Th>Method</Th>
      </tr></thead>
      <tbody className="divide-y divide-slate-50">
        {rows.map((r, i) => (
          <tr key={i} className="hover:bg-[#fcf8f8] transition-colors">
            <Td><div className="flex items-center gap-2.5"><Avatar name={r.scholar} /><span className="font-semibold text-slate-800">{r.scholar}</span></div></Td>
            <Td className="text-slate-400 text-xs font-mono">{r.scholar_id}</Td>
            <Td className="text-slate-500">{r.date ? new Date(r.date).toLocaleDateString("en-PH") : "—"}</Td>
            <Td><span className="inline-flex items-center gap-1.5 text-slate-600"><ClipboardList size={13} className="text-slate-400" />{r.duty}</span></Td>
            <Td className="text-slate-500 text-xs">{fmt(r.location)}</Td>
            <Td><Badge status={r.status} /></Td>
            <Td className="text-slate-400 text-xs capitalize">{fmt(r.method)}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const SubmissionsTable = ({ rows }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full">
      <thead><tr className="border-b border-slate-100">
        <Th>Scholar</Th><Th>Scholar ID</Th><Th>Activity Type</Th><Th>Service Date</Th><Th>Hours</Th><Th>Status</Th><Th>Quality</Th><Th>Submitted At</Th>
      </tr></thead>
      <tbody className="divide-y divide-slate-50">
        {rows.map((r, i) => (
          <tr key={i} className="hover:bg-[#fcf8f8] transition-colors">
            <Td><div className="flex items-center gap-2.5"><Avatar name={r.scholar} /><span className="font-semibold text-slate-800">{r.scholar}</span></div></Td>
            <Td className="text-slate-400 text-xs font-mono">{r.scholar_id}</Td>
            <Td className="text-slate-600">{fmt(r.type)}</Td>
            <Td className="text-slate-500">{r.service_date ? new Date(r.service_date).toLocaleDateString("en-PH") : "—"}</Td>
            <Td><span className="inline-flex items-center gap-1 font-semibold text-slate-700"><Clock size={12} className="text-slate-400" />{fmt(r.service_hours)}h</span></Td>
            <Td><Badge status={r.status} /></Td>
            <Td className="text-slate-400 text-xs capitalize">{fmt(r.quality_status)}</Td>
            <Td className="text-slate-500 text-xs">{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString("en-PH") : "—"}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const RequirementsTable = ({ rows }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full">
      <thead><tr className="border-b border-slate-100">
        <Th>Scholar</Th><Th>Scholar ID</Th><Th>Requirement</Th><Th>Status</Th><Th>Staff Comment</Th><Th>Submitted At</Th>
      </tr></thead>
      <tbody className="divide-y divide-slate-50">
        {rows.map((r, i) => (
          <tr key={i} className="hover:bg-[#fcf8f8] transition-colors">
            <Td><div className="flex items-center gap-2.5"><Avatar name={r.scholar} /><span className="font-semibold text-slate-800">{r.scholar}</span></div></Td>
            <Td className="text-slate-400 text-xs font-mono">{r.scholar_id}</Td>
            <Td><span className="inline-flex items-center gap-1.5 font-medium text-slate-700"><GraduationCap size={13} className="text-slate-400" />{fmt(r.type)}</span></Td>
            <Td><Badge status={r.status} /></Td>
            <Td className="text-slate-500 text-xs max-w-[200px] truncate">{fmt(r.staff_comment)}</Td>
            <Td className="text-slate-500 text-xs">{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString("en-PH") : "—"}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const ActivitiesTable = ({ rows }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full">
      <thead><tr className="border-b border-slate-100">
        <Th>Scholar</Th><Th>Scholar ID</Th><Th>Activity</Th><Th>Date</Th><Th>Location</Th><Th>Attended</Th><Th>Method</Th>
      </tr></thead>
      <tbody className="divide-y divide-slate-50">
        {rows.map((r, i) => (
          <tr key={i} className="hover:bg-[#fcf8f8] transition-colors">
            <Td><div className="flex items-center gap-2.5"><Avatar name={r.scholar} /><span className="font-semibold text-slate-800">{r.scholar}</span></div></Td>
            <Td className="text-slate-400 text-xs font-mono">{r.scholar_id}</Td>
            <Td className="font-medium text-slate-700">{r.activity}</Td>
            <Td className="text-slate-500">{r.date ? new Date(r.date).toLocaleDateString("en-PH") : "—"}</Td>
            <Td className="text-slate-500 text-xs">{fmt(r.location)}</Td>
            <Td><Badge status={r.attended} /></Td>
            <Td className="text-slate-400 text-xs capitalize">{fmt(r.method)}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── Section wrapper (collapsible-looking header + count badge) ───────────

const SECTION_CONFIG = {
  "Duty Attendance":                    { icon: ClipboardList, color: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-100" },
  "Monthly Report Submissions":         { icon: FileText,      color: "text-violet-600",  bg: "bg-violet-50",  border: "border-violet-100" },
  "Requirements (COR / Grades / Card)": { icon: GraduationCap, color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-100" },
  "Activity Participation":             { icon: Activity,      color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
};

export const Section = ({ title, count, children }) => {
  const cfg = SECTION_CONFIG[title] || { icon: BarChart2, color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-100" };
  const Icon = cfg.icon;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className={`flex items-center px-5 py-3.5 border-b ${cfg.border} ${cfg.bg}`}>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-white shadow-sm border ${cfg.border} mr-2.5`}>
          <Icon size={14} className={cfg.color} />
        </div>
        <span className="font-bold text-slate-700 text-sm">{title}</span>
        <span className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>{count}</span>
      </div>
      {count > 0 ? children : (
        <div className="py-10 text-center">
          <Search size={24} className="mx-auto text-slate-200 mb-2" />
          <p className="text-slate-400 text-sm">No records found</p>
        </div>
      )}
    </div>
  );
};

// ─── Stat card ──────────────────────────────────────────────────────────────

export const StatCard = ({ label, count, icon: Icon, color, bg, border }) => (
  <div className={`${bg} border ${border} rounded-2xl p-4 flex items-center gap-3`}>
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-sm border ${border}`}>
      <Icon size={16} className={color} />
    </div>
    <div>
      <div className={`text-2xl font-black ${color}`}>{count}</div>
      <div className="text-xs text-slate-500 font-medium">{label}</div>
    </div>
  </div>
);

// ─── Filter form fields ─────────────────────────────────────────────────────

export const SelectField = ({ label, icon: Icon, value, onChange, children }) => (
  <div>
    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</label>
    <div className="relative">
      {Icon && <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />}
      <select value={value} onChange={onChange}
        className={`w-full border border-slate-200 rounded-xl text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:border-transparent transition-all appearance-none pr-8 py-2.5 ${Icon ? "pl-8" : "pl-3"}`}>
        {children}
      </select>
      <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  </div>
);

export const DateField = ({ label, value, onChange }) => (
  <div>
    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</label>
    <div className="relative">
      <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <input type="date" value={value} onChange={onChange}
        className="w-full border border-slate-200 rounded-xl pl-8 pr-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:border-transparent transition-all" />
    </div>
  </div>
);