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
export const MAROON = "#7f2d3a";
export const MAROON_LIGHT = "#F5E8EA";

export const token = () => localStorage.getItem("token");
export const authHeaders = () => ({ headers: { Authorization: `Bearer ${token()}` } });
export const fmt = (v) => (v !== null && v !== undefined && v !== "" ? v : "—");

// ─── Compliance Summary badges ─────────────────────────────────────────────

export function riskBadge(status) {
  const map = {
    excellent: { bg: "#d1fae5", color: "#065f46", label: "Excellent" },
    good:      { bg: "#dbeafe", color: "#1e40af", label: "Good" },
    "at-risk": { bg: "#fee2e2", color: "#991b1b", label: "At Risk" },
  };
  return map[status] || { bg: "#f3f4f6", color: "#374151", label: status || "Unknown" };
}

// ─── Monthly Reports badges ─────────────────────────────────────────────────

export function reportStatusBadge(status) {
  const map = {
    accepted:      { bg: "#d1fae5", color: "#065f46", label: "Accepted",    Icon: CheckCircle },
    "medium-risk": { bg: "#fef3c7", color: "#92400e", label: "Medium Risk", Icon: AlertTriangle },
    "high-risk":   { bg: "#fee2e2", color: "#991b1b", label: "High Risk",   Icon: XCircle },
    pending:       { bg: "#f3f4f6", color: "#374151", label: "Pending",     Icon: Clock },
  };
  return map[status] || map.pending;
}

export function staffActionBadge(action) {
  if (!action) return null;
  const map = {
    approved:         { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0", label: "Approved",       Icon: ThumbsUp },
    rejected:         { bg: "#fef2f2", color: "#ef4444", border: "#fecaca", label: "Rejected",       Icon: ThumbsDown },
    "needs-revision": { bg: "#fffbeb", color: "#d97706", border: "#fde68a", label: "Needs Revision", Icon: MessageSquare },
  };
  return map[action];
}

export function scoreColor(score) {
  if (score >= 71) return "#16a34a";
  if (score >= 51) return "#d97706";
  return "#ef4444";
}

// ─── Export tab status badges ──────────────────────────────────────────────

export const STATUS_CONFIG = {
  Completed:       { bg: "bg-emerald-50",  text: "text-emerald-700",  border: "border-emerald-200", icon: CheckCircle2 },
  Verified:        { bg: "bg-emerald-50",  text: "text-emerald-700",  border: "border-emerald-200", icon: CheckCircle2 },
  Present:         { bg: "bg-emerald-50",  text: "text-emerald-700",  border: "border-emerald-200", icon: CheckCircle2 },
  present:         { bg: "bg-emerald-50",  text: "text-emerald-700",  border: "border-emerald-200", icon: CheckCircle2 },
  approved:        { bg: "bg-emerald-50",  text: "text-emerald-700",  border: "border-emerald-200", icon: CheckCircle2 },
  Submitted:       { bg: "bg-blue-50",     text: "text-blue-700",     border: "border-blue-200",    icon: Clock },
  submitted:       { bg: "bg-blue-50",     text: "text-blue-700",     border: "border-blue-200",    icon: Clock },
  Pending:         { bg: "bg-amber-50",    text: "text-amber-700",    border: "border-amber-200",   icon: Clock },
  pending:         { bg: "bg-amber-50",    text: "text-amber-700",    border: "border-amber-200",   icon: Clock },
  Absent:          { bg: "bg-red-50",      text: "text-red-700",      border: "border-red-200",     icon: XCircle },
  absent:          { bg: "bg-red-50",      text: "text-red-700",      border: "border-red-200",     icon: XCircle },
  Rejected:        { bg: "bg-red-50",      text: "text-red-700",      border: "border-red-200",     icon: XCircle },
  rejected:        { bg: "bg-red-50",      text: "text-red-700",      border: "border-red-200",     icon: XCircle },
  "Not Submitted": { bg: "bg-gray-50",     text: "text-gray-500",     border: "border-gray-200",    icon: AlertCircle },
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
  if (reportType === "all" || reportType === "submissions")
    addSheet(data.submissions.map(r => ({ Scholar: r.scholar, "Scholar ID": r.scholar_id, "Activity Type": fmt(r.type), "Service Date": r.service_date ? new Date(r.service_date).toLocaleDateString("en-PH") : "—", Hours: fmt(r.service_hours), Status: r.status, "Quality Status": fmt(r.quality_status), "Submitted At": r.submitted_at ? new Date(r.submitted_at).toLocaleDateString("en-PH") : "—" })), "Submissions");
  if (reportType === "all" || reportType === "requirements")
    addSheet(data.requirements.map(r => ({ Scholar: r.scholar, "Scholar ID": r.scholar_id, Requirement: fmt(r.type), Status: r.status, "Staff Comment": fmt(r.staff_comment), "Submitted At": r.submitted_at ? new Date(r.submitted_at).toLocaleDateString("en-PH") : "—" })), "Requirements");
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