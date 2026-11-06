import { useState, useEffect } from "react";
import axios from "axios";
import { BarChart3, FileText, ChevronRight } from "lucide-react";
import { API_BASE, authHeaders } from "../../components/Officer/Reports/ReportsHelpers";
import MonthlyReportsTab from "../../components/Officer/Reports/MonthlyReportsTab";
import SubmissionRecordsTab from "../../components/Officer/Reports/SubmissionRecordsTab";

// ── Design tokens — shared Apple Scholar brand system (unchanged) ──
const MAROON_DEEP = '#6D2140';
const GOLD = '#A9784E';
const BG = '#F7F4EE';
const CARD = '#FFFDF9';
const RULE = '#E5D8CA';
const INK = '#241512';
const MUTED = '#8A7A68';

const display = { fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };
// Shared bento tile: one radius, one border, one shadow for every card.
const tile = {
  background: CARD,
  border: `1px solid ${RULE}`,
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(36,21,18,0.04)',
};

const tabItems = [
  { key: "compliance", label: "Compliance Reports", sub: "All requirements and document submissions", Icon: FileText },
  { key: "monthly-reports", label: "Monthly Letter Review", sub: "Review monthly letter submissions", Icon: BarChart3 },
];

export default function OfficerReports() {
  const [activeTab, setActiveTab] = useState("compliance");
  const [assignedYearLevels, setAssignedYearLevels] = useState([]);
  const [assignedYearLevelsLoading, setAssignedYearLevelsLoading] = useState(true);
  const [assignedYearLevelsError, setAssignedYearLevelsError] = useState("");

  useEffect(() => {
    let active = true;
    const loadAssignedYearLevels = async () => {
      setAssignedYearLevelsLoading(true);
      setAssignedYearLevelsError("");
      try {
        const response = await axios.get(`${API_BASE}/officer/assigned-year-levels`, authHeaders());
        if (!Array.isArray(response.data) || response.data.some(level => typeof level !== "string")) {
          throw new Error("The assigned year levels response is invalid.");
        }
        if (active) setAssignedYearLevels([...new Set(response.data)]);
      } catch (error) {
        if (!active) return;
        console.error("Could not load officer assigned year levels:", error);
        setAssignedYearLevels([]);
        setAssignedYearLevelsError(error.response?.data?.error || "Could not load your assigned year levels. Please refresh and try again.");
      } finally {
        if (active) setAssignedYearLevelsLoading(false);
      }
    };
    loadAssignedYearLevels();
    return () => { active = false; };
  }, []);

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ ...body, background: BG }}>
      <style>{`
        .or-tabs-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        .or-tabs-scroll::-webkit-scrollbar { display: none; }
        .or-tab:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 2px; }
      `}</style>

      {/* ── Reports header ── */}
      <header className="mb-4">
        <div style={{ ...tile, flex: 1, minWidth: 0, padding: '20px 24px' }}>
          <span style={{ ...body, display: 'block', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: GOLD, marginBottom: 6 }}>
            Officer Portal
          </span>
          <h1 style={{ ...display, fontSize: 'clamp(1.7rem, 3.4vw, 2.3rem)', fontWeight: 600, lineHeight: 1.1, letterSpacing: '-0.01em', color: MAROON_DEEP, margin: 0 }}>
            Reports &amp; Analytics
          </h1>
          <p style={{ ...body, fontSize: '0.88rem', color: '#7a6a62', marginTop: 8, maxWidth: 560, lineHeight: 1.5 }}>
            View submission summaries and generate reports for your assigned scholars.
          </p>
        </div>

      </header>

      <nav aria-label="Report sections" className="mb-4">
        <div role="tablist" className="grid gap-3 md:grid-cols-2">
          {tabItems.map(({ key, label, sub, Icon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(key)}
                className="or-tab flex items-center gap-3.5"
                style={{
                  ...tile,
                  minWidth: 0,
                  textAlign: 'left',
                  padding: '15px 18px',
                  border: `1px solid ${isActive ? MAROON_DEEP : RULE}`,
                  background: isActive ? MAROON_DEEP : CARD,
                  cursor: 'pointer',
                  transition: 'background 120ms ease, color 120ms ease',
                }}
              >
                <span className="flex shrink-0 items-center justify-center rounded-full" style={{ width: 40, height: 40, background: isActive ? 'rgba(255,255,255,0.16)' : `${MAROON_DEEP}0f`, color: isActive ? '#fff' : MAROON_DEEP }}>
                  <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block" style={{ ...display, fontSize: '1rem', fontWeight: 600, color: isActive ? '#fff' : INK }}>{label}</span>
                  <span className="mt-0.5 block" style={{ ...body, fontSize: '0.76rem', color: isActive ? '#EBD9E0' : MUTED }}>{sub}</span>
                </span>
                <span className="flex shrink-0 items-center justify-center rounded-full" style={{ width: 28, height: 28, background: isActive ? '#fff' : `${MAROON_DEEP}0f`, color: MAROON_DEEP }}>
                  <ChevronRight size={16} />
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Content surface ── */}
      <div style={{ minWidth: 0 }}>
          {assignedYearLevelsError && (
            <div role="alert" className="mb-3 rounded-xl px-4 py-3" style={{ ...tile, borderColor: "#A24A4A", color: "#A24A4A", ...body, fontSize: "0.82rem" }}>
              {assignedYearLevelsError}
            </div>
          )}
          {activeTab === "compliance" && (
            <SubmissionRecordsTab assignedYearLevels={assignedYearLevels} assignedYearLevelsLoading={assignedYearLevelsLoading || Boolean(assignedYearLevelsError)} />
          )}

          {activeTab === "monthly-reports" && (
            <MonthlyReportsTab assignedYearLevels={assignedYearLevels} assignedYearLevelsLoading={assignedYearLevelsLoading || Boolean(assignedYearLevelsError)} />
          )}
      </div>

    </div>
  );
}