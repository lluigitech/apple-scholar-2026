import {
  CheckCircle, AlertTriangle, XCircle, Clock,
  ThumbsUp, ThumbsDown, MessageSquare, CheckCircle2, AlertCircle,
} from "lucide-react";
import * as XLSX from "xlsx";

const normalizeApiBase = (url) => {
  const raw = (url?.trim() || "http://localhost:5000").replace(/\/+$/, "");
  const cleaned = raw.replace(/\/api\/api(\/|$)/g, "/api$1");
  return cleaned.endsWith("/api") ? cleaned : `${cleaned}/api`;
};

export const API_BASE = normalizeApiBase(import.meta.env?.VITE_API_URL);

// ── Design tokens — shared Records Office brand system ──
// This file backs every tab in the "Statistics Bureau" (Officer
// Reports): Compliance Summary, Monthly Letter Review, Export
// Reports, and the report detail modal. The color values below
// already matched the portal-wide maroon/gold/sage/clay/amber
// palette, so only the type family needed updating — from the old
// Playfair Display / DM Sans pairing to the portal's actual
// Lora / Work Sans / IBM Plex Mono system.
export const MAROON = "#7f2d3a";
export const MAROON_DEEP = "#4f1620";
export const MAROON_LIGHT = "#F5E8EA"; // kept for backward compatibility — same value as ROSE below
export const GOLD = "#b98b4e";
export const GOLD_LIGHT = "#d4af7a";
export const IVORY = "#FBF7F2";
export const BG = "#F6EFE4";
export const CARD = "#fffdf8";
export const INK = "#241512";
export const MUTED = "#a89890";
export const SAGE = "#6b8f71";
export const CLAY = "#c1666b";
export const AMBER = "#b8863f";
export const PAPER = "#F6EFE4"; // kept for backward compatibility — same value as BG above
export const RULE = "#e8dccb";
export const ROSE = "#F5E8EA";

export const display = { fontFamily: "'Lora', Georgia, 'Times New Roman', serif" };
export const body = { fontFamily: "'Work Sans', 'Segoe UI', sans-serif" };
export const mono = { fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace" };
// Old names kept as aliases so any file still importing `serif`/`sans` from
// here keeps working without a rewrite.
export const serif = display;
export const sans = body;

export const token = () => localStorage.getItem("token");
export const authHeaders = () => ({ headers: { Authorization: `Bearer ${token()}` } });
export const fmt = (v) => (v !== null && v !== undefined && v !== "" ? v : "—");

// ─── Compliance Summary badges ─────────────────────────────────────────────

export function riskBadge(status) {
  const map = {
    excellent: { bg: `${SAGE}18`, color: SAGE,  label: "Excellent" },
    good:      { bg: `${GOLD}18`, color: GOLD,  label: "Good" },
    "at-risk": { bg: `${CLAY}18`, color: CLAY,  label: "At Risk" },
  };
  return map[status] || { bg: PAPER, color: MUTED, label: status || "Unknown" };
}

// ─── Monthly Reports badges ─────────────────────────────────────────────────

export function reportStatusBadge(status) {
  const map = {
    accepted:      { bg: `${SAGE}18`,  color: SAGE,  label: "Accepted",    Icon: CheckCircle },
    "medium-risk": { bg: `${AMBER}18`, color: AMBER, label: "Medium Risk", Icon: AlertTriangle },
    "high-risk":   { bg: `${CLAY}18`,  color: CLAY,  label: "High Risk",   Icon: XCircle },
    pending:       { bg: PAPER,        color: MUTED, label: "Pending", Icon: Clock },
  };
  return map[status] || map.pending;
}

export function staffActionBadge(action) {
  if (!action) return null;
  const map = {
    approved:         { bg: `${SAGE}14`,  color: SAGE,  border: `${SAGE}55`,  label: "Approved",       Icon: ThumbsUp },
    rejected:         { bg: `${CLAY}14`,  color: CLAY,  border: `${CLAY}55`,  label: "Rejected",       Icon: ThumbsDown },
    "needs-revision": { bg: `${AMBER}14`, color: AMBER, border: `${AMBER}55`, label: "Needs Revision", Icon: MessageSquare },
  };
  return map[action];
}

export function scoreColor(score) {
  if (score >= 70) return SAGE;
  if (score >= 50) return AMBER;
  return CLAY;
}

// ─── Export tab status badges ──────────────────────────────────────────────
// Tailwind-class based (used by SharedTableBits.jsx's Badge), already on
// the shared ledger palette.

export const STATUS_CONFIG = {
  Completed:       { bg: "bg-[#6b8f71]/10",  text: "text-[#6b8f71]",  border: "border-[#6b8f71]/30",  icon: CheckCircle2 },
  Verified:        { bg: "bg-[#6b8f71]/10",  text: "text-[#6b8f71]",  border: "border-[#6b8f71]/30",  icon: CheckCircle2 },
  Present:         { bg: "bg-[#6b8f71]/10",  text: "text-[#6b8f71]",  border: "border-[#6b8f71]/30",  icon: CheckCircle2 },
  present:         { bg: "bg-[#6b8f71]/10",  text: "text-[#6b8f71]",  border: "border-[#6b8f71]/30",  icon: CheckCircle2 },
  approved:        { bg: "bg-[#6b8f71]/10",  text: "text-[#6b8f71]",  border: "border-[#6b8f71]/30",  icon: CheckCircle2 },
  Submitted:       { bg: "bg-[#b98b4e]/10",  text: "text-[#b98b4e]",  border: "border-[#b98b4e]/30",  icon: Clock },
  submitted:       { bg: "bg-[#b98b4e]/10",  text: "text-[#b98b4e]",  border: "border-[#b98b4e]/30",  icon: Clock },
  Pending:         { bg: "bg-[#b8863f]/10",  text: "text-[#b8863f]",  border: "border-[#b8863f]/30",  icon: Clock },
  pending:         { bg: "bg-[#b8863f]/10",  text: "text-[#b8863f]",  border: "border-[#b8863f]/30",  icon: Clock },
  Absent:          { bg: "bg-[#c1666b]/10",  text: "text-[#c1666b]",  border: "border-[#c1666b]/30",  icon: XCircle },
  absent:          { bg: "bg-[#c1666b]/10",  text: "text-[#c1666b]",  border: "border-[#c1666b]/30",  icon: XCircle },
  Rejected:        { bg: "bg-[#c1666b]/10",  text: "text-[#c1666b]",  border: "border-[#c1666b]/30",  icon: XCircle },
  rejected:        { bg: "bg-[#c1666b]/10",  text: "text-[#c1666b]",  border: "border-[#c1666b]/30",  icon: XCircle },
  "Not Submitted": { bg: "bg-[#F6EFE4]",     text: "text-[#a89890]",  border: "border-[#e8dccb]",     icon: AlertCircle },
};

// ─── Excel export (Export Reports tab) ─────────────────────────────────────

export const exportToExcel = (data, scholarName, reportType) => {
  const wb = XLSX.utils.book_new();
  const addSheet = (rows, name) => {
    if (!rows?.length) return;
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length, ...rows.map(r => String(r[k] ?? "").length)) + 2 }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  const addGroupedSheets = (rows, mapRow) => {
    const groups = new Map();
    rows.forEach(row => {
      const date = new Date(row.submitted_at || row.deadline || 0);
      const month = Number.isNaN(date.getTime()) ? "No Date" : date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      const type = fmt(row.type || "Other Documents");
      const key = `${month} - ${type}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
    [...groups.entries()].sort(([a], [b]) => b.localeCompare(a)).forEach(([name, groupedRows]) => {
      addSheet(groupedRows.sort((a, b) => new Date(b.submitted_at || b.deadline || 0) - new Date(a.submitted_at || a.deadline || 0)).map(mapRow), name.slice(0, 31));
    });
  };
  if (reportType === "all" || reportType === "submissions")
    addGroupedSheets(data.submissions, r => ({ Scholar: r.scholar, "Scholar ID": r.scholar_id, "Activity Type": fmt(r.type), "Service Date": r.service_date ? new Date(r.service_date).toLocaleDateString("en-PH") : "—", Hours: fmt(r.service_hours), Status: r.status, "Quality Status": fmt(r.quality_status), Deadline: r.deadline ? new Date(r.deadline).toLocaleDateString("en-PH") : "—", "Submitted At": r.submitted_at ? new Date(r.submitted_at).toLocaleDateString("en-PH") : "—", "Approved At": r.approved_at ? new Date(r.approved_at).toLocaleDateString("en-PH") : "—" }));
  if (reportType === "all" || reportType === "requirements")
    addGroupedSheets(data.requirements, r => ({ Scholar: r.scholar, "Scholar ID": r.scholar_id, Requirement: fmt(r.type), Status: r.status, "Staff Comment": fmt(r.staff_comment), Deadline: r.deadline ? new Date(r.deadline).toLocaleDateString("en-PH") : "—", "Submitted At": r.submitted_at ? new Date(r.submitted_at).toLocaleDateString("en-PH") : "—", "Approved At": r.approved_at ? new Date(r.approved_at).toLocaleDateString("en-PH") : "—" }));
  if (reportType === "all" || reportType === "activities")
    addSheet(data.activities.map(r => ({ Scholar: r.scholar, "Scholar ID": r.scholar_id, Activity: r.activity, Date: r.date ? new Date(r.date).toLocaleDateString("en-PH") : "—", Location: fmt(r.location), Attended: r.attended, Method: fmt(r.method) })), "Activity Participation");
  const filename = `SummaryReport_${scholarName}_${Date.now()}.xlsx`;
  XLSX.writeFile(wb, filename);

  // Best-effort server log of this client-generated export.
  // Use fetch with keepalive to improve delivery chance during downloads; fall back to sendBeacon.
  try {
    const title = `SummaryReport_${scholarName}_${reportType || 'export'}`;
    const payload = JSON.stringify({ log_only: true, module: 'Report Export', report_resource: 'Summary Report', spreadsheet_title: title, details: filename });
    const url = `${API_BASE}/export/google-sheets`;
    const auth = token();

    // Prefer fetch with keepalive
    if (typeof fetch === 'function') {
      try {
        fetch(url, {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, auth ? { Authorization: `Bearer ${auth}` } : {}),
          body: payload,
          keepalive: true,
        }).catch(() => {});
        return;
      } catch (e) {
        // fall through to sendBeacon
      }
    }

    // Fallback: navigator.sendBeacon (no headers support, so include token in payload if present)
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const beaconPayload = auth ? JSON.stringify({
        token: auth,
        log_only: true,
        module: 'Report Export',
        report_resource: 'Summary Report',
        spreadsheet_title: title,
        details: filename,
      }) : payload;
      try { navigator.sendBeacon(url, new Blob([beaconPayload], { type: 'application/json' })); } catch (e) {}
    }
  } catch (e) {
    // swallow errors — this is best-effort logging
  }
};