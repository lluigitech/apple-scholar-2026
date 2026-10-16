import {
  Filter, Users, FileText, Loader2, RefreshCw,
  BarChart2, FileSpreadsheet, ClipboardList, GraduationCap, Activity,
} from "lucide-react";
import { MAROON } from "./ReportsHelpers";
import {
  SelectField, DateField, StatCard, Section,
  DutyTable, SubmissionsTable, RequirementsTable, ActivitiesTable,
} from "./ExportTables";

// ── Design tokens — shared Records Office brand system ──
// This tab lives inside the "Statistics Bureau" page: a ruled filter
// worksheet ("Form B"), a results table ("Table 2"), and an empty
// state that reads like an unfiled request slip.
const MAROON_DEEP = '#4f1620';
const GOLD = '#b98b4e';
const BG = '#F6EFE4';
const CARD = '#fffdf8';
const RULE = '#e8dccb';
const INK = '#241512';
const MUTED = '#a89890';
const CLAY = '#c1666b';

const display = { fontFamily: "'Lora', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Work Sans', 'Segoe UI', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace" };

const outlineBtn = { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', border: `1.5px solid ${MAROON}`, borderRadius: 4, background: CARD, color: MAROON, ...body, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' };
const filledBtn = { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', border: 'none', borderRadius: 4, background: `linear-gradient(120deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)`, color: '#fff', ...body, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' };

export default function ExportReportsTab({
  filters, setField, scholars, data, loading, fetched, error,
  onGenerate, onDownload,
  onDownloadPdf,
}) {
  const totalRecords = data.submissions.length + data.requirements.length;
  const documentTypeLabels = { "monthly-letter": "Monthly Letter", grades: "Grades", cor: "COR", other: "Other Documents" };
  const selectedDocumentType = documentTypeLabels[filters.report_type];
  const requirementGroups = filters.report_type === "all-requirements"
    ? ["Monthly Letter", "COR", "Grades", "Other Documents"].map(type => ({ type, rows: data.requirements.filter(row => row.type === type) }))
    : [];

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2" style={{ borderLeft: `3px solid ${CLAY}`, background: `${CLAY}0d`, padding: '10px 14px', ...body, fontSize: '0.78rem', fontWeight: 600, color: CLAY }}>
          <BarChart2 size={15} /> {error}
        </div>
      )}

      {/* ── Filter worksheet — same ruled-panel treatment as the
            Compliance tab's "Form A" ── */}
      <div style={{ background: CARD, border: `1px solid ${RULE}`, borderLeft: `3px solid ${GOLD}`, borderRadius: 4, padding: 20 }}>
        <div className="flex items-baseline gap-3 mb-5">
          <span style={{ ...mono, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', color: GOLD }}>FORM B</span>
          <div className="flex items-center gap-1.5">
            <Filter size={12} style={{ color: MAROON }} />
            <h2 style={{ ...display, fontSize: '1.1rem', fontWeight: 600, color: INK }}>Export Filters</h2>
          </div>
          <span style={{ flex: 1, borderBottom: `1px dashed ${RULE}` }} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SelectField label="Scholar" icon={Users} value={filters.scholar_id} onChange={e => setField("scholar_id", e.target.value)}>
            <option value="">All Scholars</option>
            {scholars.map(s => <option key={s.id || s.scholar_id} value={s.scholar_id}>{s.full_name}</option>)}
          </SelectField>
          <DateField label="Month From" type="month" value={filters.date_from} onChange={e => setField("date_from", e.target.value)} />
          <DateField label="Month To" type="month" value={filters.date_to} onChange={e => setField("date_to", e.target.value)} />
          <SelectField label="Submission Type" icon={FileText} value={filters.report_type} onChange={e => setField("report_type", e.target.value)}>
            <option value="monthly-letter">Monthly Letter</option>
            <option value="grades">Grades</option>
            <option value="cor">COR</option>
            <option value="other">Other Documents</option>
            <option value="all-requirements">All Requirements</option>
          </SelectField>
        </div>
        <div className="mt-4 pt-4 flex justify-end" style={{ borderTop: `1px dashed ${RULE}` }}>
          <button onClick={onGenerate} disabled={loading} style={{ ...filledBtn, opacity: loading ? 0.6 : 1, cursor: loading ? 'default' : 'pointer' }}>
            {loading
              ? <><Loader2 size={15} className="animate-spin" /> Generating…</>
              : <><RefreshCw size={15} /> Generate Report</>}
          </button>
        </div>
      </div>

      {fetched && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
          <StatCard label="Submissions"  count={data.submissions.length}  icon={FileText}      color="text-[#7f2d3a]" bg="bg-white" border="border-[#e8dccb]" />
          <StatCard label="Requirements" count={data.requirements.length} icon={GraduationCap} color="text-[#b8863f]" bg="bg-white" border="border-[#e8dccb]" />
        </div>
      )}

      {fetched && (
        <div className="space-y-4">
          {selectedDocumentType && (
            <Section title={`${selectedDocumentType} Submissions`} count={data.submissions.length}>
              <SubmissionsTable rows={data.submissions} />
            </Section>
          )}
          {filters.report_type === "all-requirements" && (
            requirementGroups.map(group => (
              <Section key={group.type} title={group.type} count={group.rows.length}>
                <RequirementsTable rows={group.rows} />
              </Section>
            ))
          )}
          {totalRecords > 0 && (
            <div className="flex flex-wrap justify-end gap-2.5 pt-1">
              <button onClick={onDownload} disabled={exportOnHold} style={{ ...filledBtn, opacity: exportOnHold ? 0.5 : 1, cursor: exportOnHold ? 'not-allowed' : 'pointer' }}>
                <FileSpreadsheet size={15} /> Export to Excel ({totalRecords} records)
              </button>
              <button onClick={onDownloadPdf} disabled={exportOnHold} style={{ ...outlineBtn, opacity: exportOnHold ? 0.5 : 1, cursor: exportOnHold ? 'not-allowed' : 'pointer' }}>
                <FileText size={15} /> Export PDF ({totalRecords} records)
              </button>
            </div>
          )}
        </div>
      )}

      {!fetched && !loading && !error && (
        <div className="py-20 text-center" style={{ background: CARD, border: `1px dashed ${RULE}`, borderRadius: 4 }}>
          <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center" style={{ borderRadius: 4, background: BG, border: `1.5px dashed ${MAROON}44` }}>
            <BarChart2 size={26} style={{ color: MAROON, opacity: 0.55 }} />
          </div>
          <p style={{ ...display, fontSize: '1rem', fontWeight: 600, color: MUTED }}>No report generated yet</p>
          <p style={{ ...mono, fontSize: '0.72rem', color: '#c9b9b0', marginTop: 6 }}>Set your filters above and click GENERATE REPORT</p>
        </div>
      )}
    </div>
  );
}