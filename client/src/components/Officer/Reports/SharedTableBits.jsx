import { AlertCircle } from "lucide-react";
import { STATUS_CONFIG, MAROON } from "./ReportsHelpers";

export const Badge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || { bg: "bg-gray-50", text: "text-gray-500", border: "border-gray-200", icon: AlertCircle };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <Icon size={10} />{status}
    </span>
  );
};

export const Th = ({ children }) => (
  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 whitespace-nowrap">{children}</th>
);

export const Td = ({ children, className = "" }) => (
  <td className={`px-4 py-3 text-sm ${className}`}>{children}</td>
);

export const Avatar = ({ name }) => {
  const initials = name?.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() || "?";
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0" style={{ background: MAROON }}>
      {initials}
    </div>
  );
};