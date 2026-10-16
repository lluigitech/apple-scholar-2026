import { AlertCircle } from "lucide-react";
import { STATUS_CONFIG, MAROON } from "./ReportsHelpers";

// ── Design tokens — shared Records Office brand system ──
// These are the smallest primitives shared by every table in the
// "Statistics Bureau" (Officer Reports): a square status badge, mono
// uppercase column headers, hairline cells, and a Lora initials chip.
const RULE = "#e8dccb";
const MUTED = "#a89890";
const mono = { fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace" };
const body = { fontFamily: "'Work Sans', 'Segoe UI', sans-serif" };
const display = { fontFamily: "'Lora', Georgia, 'Times New Roman', serif" };

export const Badge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || { bg: "bg-[#F6EFE4]", text: "text-[#a89890]", border: "border-[#e8dccb]", icon: AlertCircle };
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 border ${cfg.bg} ${cfg.text} ${cfg.border}`}
      style={{ ...mono, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', borderRadius: 3 }}
    >
      <Icon size={10} />{status}
    </span>
  );
};

export const Th = ({ children }) => (
  <th className="px-4 py-3 text-left whitespace-nowrap" style={{ ...mono, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTED }}>
    {children}
  </th>
);

export const Td = ({ children, className = "" }) => (
  <td className={`px-4 py-3 ${className}`} style={{ ...body, fontSize: '0.85rem', borderTop: `1px solid ${RULE}` }}>
    {children}
  </td>
);

export const Avatar = ({ name }) => {
  const initials = name?.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() || "?";
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: MAROON, ...display, fontSize: '0.68rem', fontWeight: 700 }}>
      {initials}
    </div>
  );
};