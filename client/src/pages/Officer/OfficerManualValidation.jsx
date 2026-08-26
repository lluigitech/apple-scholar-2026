import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import {
  Search, ChevronDown, CheckCircle2, XCircle,
  Clock, FileText, GraduationCap, IdCard, Paperclip, ExternalLink, AlertTriangle,
  ArrowLeft, FolderOpen,
} from 'lucide-react';

// Reusing your existing shared components instead of duplicating them
import FilePreviewModal from '../../components/Officer/ManualValidation/FilePreviewModal';
import ReviewModal from '../../components/Officer/ManualValidation/ReviewModal';
import { LetterDocumentCard } from '../../components/Officer/ManualValidation/CorrespondenceTab';
import { fileKind } from '../../utils/submissionHelpers';

const API = 'http://localhost:5000/api';

// ── Registrar's Dossier token system ─────────────────────────
const MAROON = '#7f2d3a';
const MAROON_DEEP = '#4f1620';
const GOLD = '#b98b4e';
const GOLD_LIGHT = '#d4af7a';
const IVORY = '#FBF7F2';
const INK = '#241512';
const SAGE = '#6b8f71';   // approved seal ink
const CLAY = '#c1666b';   // rejected seal ink
const AMBER = '#b8863f';  // pending seal ink
const PAPER = '#F6EFE4';
const RULE = '#e8dccb';

const serif = { fontFamily: "'Playfair Display', serif" };
const sans = { fontFamily: "'DM Sans', sans-serif" };
const mono = { fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, monospace" };

const authHeader = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

// ────────────────────────────────────────────────────────────
// Signature element — wax-seal status stamp
// ────────────────────────────────────────────────────────────
const SEAL_MAP = {
  approved: { label: 'Accepted', color: SAGE },
  passed:   { label: 'Passed',   color: SAGE },
  rejected: { label: 'Rejected', color: CLAY },
  failed:   { label: 'Failed',   color: CLAY },
  pending:  { label: 'Pending',  color: AMBER },
};

const WaxSeal = ({ status, size = 26 }) => {
  const s = SEAL_MAP[status] || SEAL_MAP.pending;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full" style={{
        background: `radial-gradient(circle at 32% 28%, ${s.color}f2, ${s.color} 60%, ${s.color}dd 100%)`,
        boxShadow: `0 1px 0 rgba(0,0,0,0.15) inset, 0 2px 4px rgba(36,21,18,0.25)`,
        border: `1px solid ${s.color}`,
      }} />
      <div className="absolute rounded-full" style={{ inset: 3, border: `1px dashed rgba(255,255,255,0.55)` }} />
      <div className="absolute inset-0 flex items-center justify-center">
        {status === 'approved' || status === 'passed' ? <CheckCircle2 size={size * 0.42} color="#fff" strokeWidth={2.5} />
          : status === 'rejected' || status === 'failed' ? <XCircle size={size * 0.42} color="#fff" strokeWidth={2.5} />
          : <Clock size={size * 0.4} color="#fff" strokeWidth={2.5} />}
      </div>
    </div>
  );
};

const StatusPill = ({ status }) => {
  const s = SEAL_MAP[status] || SEAL_MAP.pending;
  return (
    <div className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full" style={{ backgroundColor: `${s.color}14`, border: `1px solid ${s.color}40` }}>
      <WaxSeal status={status} size={16} />
      <span style={{ ...sans, fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: s.color }}>{s.label}</span>
    </div>
  );
};

const ScoreChip = ({ score, status }) => {
  const color = status === 'accepted' ? SAGE : status === 'medium_risk' ? AMBER : CLAY;
  return (
    <div className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 27, height: 27, background: `${color}14`, border: `1.5px solid ${color}55` }}>
      <span style={{ ...serif, fontSize: '0.68rem', fontWeight: 800, color }}>{Math.round(score ?? 0)}</span>
    </div>
  );
};

const SentimentTag = ({ label }) => {
  const negative = label.includes('Negative');
  const positive = label.includes('Positive');
  const color = negative ? CLAY : positive ? SAGE : GOLD;
  return (
    <span className="flex items-center gap-1.5" style={{ ...sans, fontSize: '0.68rem', fontWeight: 700, color }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      {label}
    </span>
  );
};

const EmptyRow = ({ label }) => (
  <div className="rounded-md px-4 py-3 mb-1" style={{ background: 'repeating-linear-gradient(135deg, #faf6ee, #faf6ee 10px, #f5efe3 10px, #f5efe3 20px)', border: `1px dashed ${RULE}` }}>
    <span style={{ ...sans, fontSize: '0.72rem', color: '#a89890', fontStyle: 'italic' }}>No {label} filed yet.</span>
  </div>
);

// Accept/reject control used on every item across all 4 sections.
const ReviewControls = ({ item, onReview, onOpenReject, busy }) => {
  if (item.status === 'approved' || item.status === 'rejected') {
    return (
      <div className="flex items-center gap-2">
        <StatusPill status={item.status} />
        {item.status === 'rejected' && item.staff_comment && (
          <span style={{ ...sans, fontSize: '0.68rem', color: '#a89890', fontStyle: 'italic', maxWidth: 200 }} className="truncate" title={item.staff_comment}>
            "{item.staff_comment}"
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button disabled={busy}
        onClick={() => onReview(item, 'approved', '')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-opacity hover:opacity-85 disabled:opacity-40"
        style={{ ...sans, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', backgroundColor: SAGE, color: '#fff', border: 'none', cursor: 'pointer' }}>
        <CheckCircle2 size={12} /> Accept
      </button>
      <button disabled={busy}
        onClick={() => onOpenReject(item)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-opacity hover:opacity-85 disabled:opacity-40"
        style={{ ...sans, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', backgroundColor: '#fff', color: CLAY, border: `1.5px solid ${CLAY}55`, cursor: 'pointer' }}>
        <XCircle size={12} /> Reject
      </button>
    </div>
  );
};

// Scholar letters sometimes come in with markdown-style bold/heading
// syntax from copy-pasted text; this is a plain letter view, not a
// markdown renderer, so we strip the symbols instead of showing raw "**".
const stripMarkdown = (text) => {
  if (!text) return text;
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/`{1,3}([^`]*)`{1,3}/g, '$1');
};

// ────────────────────────────────────────────────────────────
// Letter item — 2 clean zones: header (month + score + tone)
// and body+actions, instead of 3 separately-tinted bands.
// ────────────────────────────────────────────────────────────
const LetterItem = ({ item, onReview, onOpenReject, busy, onPreview, onGeneratePdf, generatingPdfId }) => {
  const [open, setOpen] = useState(false);
  const pdfBusy = generatingPdfId === item.id;
  const submitted = new Date(item.submitted_at);

  return (
    <div className="rounded-lg mb-3 overflow-hidden" style={{ background: '#fff', border: `1px solid ${RULE}` }}>

      {/* header — which month, how it scored, how it read */}
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-2.5 flex-wrap">
        <div className="flex items-baseline gap-1.5">
          <span style={{ ...serif, fontSize: '0.88rem', fontWeight: 700, color: INK }}>
            {submitted.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}
          </span>
          <span style={{ ...mono, fontSize: '0.62rem', color: '#a89890' }}>
            filed {submitted.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
          </span>
        </div>
        <div className="flex-1" />
        <ScoreChip score={item.quality_score} status={item.quality_status} />
        {item.sentiment_label && <SentimentTag label={item.sentiment_label} />}
      </div>

      {/* body — plain, readable, no heavy decoration */}
      <div className="px-4 pb-3">
        {open ? (
          <LetterDocumentCard sub={item} />
        ) : (
          <>
            <p style={{
              ...sans, fontSize: '0.82rem', lineHeight: 1.65, color: '#4b3f38',
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
              overflow: 'hidden', wordBreak: 'break-word',
            }}>
              {stripMarkdown(item.letter_content) || <span style={{ color: '#c9b9b0', fontStyle: 'italic' }}>No letter content.</span>}
            </p>
            {item.media?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2.5">
                {item.media.map((m, i) => (
                  <button key={m.id} onClick={() => onPreview(m.file_path, 'Letter Photo')}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded transition-opacity hover:opacity-80"
                    style={{ backgroundColor: PAPER, border: `1px solid ${RULE}`, color: '#8a7a70', ...sans, fontSize: '0.62rem', fontWeight: 600, cursor: 'pointer' }}>
                    <Paperclip size={10} />
                    <span>Photo {item.media.length > 1 ? i + 1 : ''}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {item.letter_content && item.letter_content.length > 140 && (
          <button onClick={() => setOpen(o => !o)}
            className="mt-2" style={{ ...sans, fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: MAROON, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            {open ? '— Show less' : 'Read full letter →'}
          </button>
        )}
      </div>

      {/* footer — PDF and review controls together, both are actions */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5" style={{ borderTop: `1px solid ${RULE}` }}>
        {item.generated_pdf_path ? (
          <button onClick={() => onPreview(item.generated_pdf_path, 'Generated PDF')}
            className="inline-flex items-center gap-1 transition-opacity hover:opacity-80"
            style={{ ...sans, fontSize: '0.66rem', fontWeight: 700, color: SAGE, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <FileText size={11} /> PDF filed <ExternalLink size={10} />
          </button>
        ) : (
          <button onClick={() => onGeneratePdf(item.id)}
            disabled={pdfBusy}
            className="inline-flex items-center gap-1 transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ ...sans, fontSize: '0.66rem', fontWeight: 700, color: GOLD, background: 'none', border: 'none', cursor: pdfBusy ? 'default' : 'pointer', padding: 0 }}>
            <FileText size={11} /> {pdfBusy ? 'Generating…' : 'Generate PDF'}
          </button>
        )}
        <ReviewControls item={item} onReview={onReview} onOpenReject={onOpenReject} busy={busy} />
      </div>
    </div>
  );
};

const GradesItem = ({ item, onReview, onOpenReject, busy, onPreview }) => (
  <div className="rounded-lg mb-3 overflow-hidden" style={{ background: '#fff', border: `1px solid ${RULE}` }}>
    <div className="flex items-center gap-3 px-4 pt-3.5 pb-2.5 flex-wrap">
      <span style={{ ...serif, fontSize: '0.88rem', fontWeight: 700, color: INK }}>{item.semester} · AY {item.academic_year}</span>
      <span style={{ ...mono, fontSize: '0.68rem', fontWeight: 700, color: item.academic_status === 'passed' ? SAGE : CLAY }}>
        GWA {item.gwa ?? '—'}
      </span>
      <div className="flex-1" />
      <StatusPill status={item.academic_status} />
    </div>
    <div className="px-4 pb-3">
      <p style={{ ...sans, fontSize: '0.76rem', color: '#a89890' }}>{item.subjects.length} subject{item.subjects.length !== 1 ? 's' : ''} on record</p>
    </div>
    <div className="flex items-center justify-between gap-2 px-4 py-2.5" style={{ borderTop: `1px solid ${RULE}` }}>
      {item.proof_path ? (
        <button onClick={() => onPreview(item.proof_path, `Grade Proof — ${item.semester} AY ${item.academic_year}`)}
          className="inline-flex items-center gap-1 transition-opacity hover:opacity-80"
          style={{ ...sans, fontSize: '0.66rem', fontWeight: 700, color: MAROON, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <ExternalLink size={11} /> View proof photo
        </button>
      ) : <span />}
      <ReviewControls item={item} onReview={onReview} onOpenReject={onOpenReject} busy={busy} />
    </div>
  </div>
);

const FileItem = ({ item, label, path, onReview, onOpenReject, busy, onPreview }) => (
  <div className="rounded-lg mb-3 overflow-hidden" style={{ background: '#fff', border: `1px solid ${RULE}` }}>
    <div className="flex items-center gap-3 px-4 pt-3.5 pb-2.5 flex-wrap">
      <span style={{ ...serif, fontSize: '0.88rem', fontWeight: 700, color: INK }}>{label}</span>
      <span style={{ ...mono, fontSize: '0.62rem', color: '#a89890' }}>
        {new Date(item.submitted_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
      </span>
    </div>
    <div className="px-4 pb-3">
      {path ? (
        <button onClick={() => onPreview(path, label)}
          className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-80"
          style={{ ...sans, fontSize: '0.76rem', fontWeight: 700, color: MAROON, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <ExternalLink size={12} /> View file
        </button>
      ) : item.media?.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {item.media.map(m => (
            <button key={m.id} onClick={() => onPreview(m.file_path, label, m.description)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded transition-opacity hover:opacity-80"
              style={{ backgroundColor: PAPER, border: `1px solid ${RULE}`, color: '#8a7a70', ...sans, fontSize: '0.62rem', fontWeight: 600, cursor: 'pointer' }}>
              <Paperclip size={10} />
              <span className="max-w-[140px] truncate">{m.description || 'File'}</span>
            </button>
          ))}
        </div>
      ) : (
        <span style={{ ...sans, fontSize: '0.76rem', color: '#c9b9b0', fontStyle: 'italic' }}>No file attached</span>
      )}
    </div>
    <div className="flex items-center justify-end px-4 py-2.5" style={{ borderTop: `1px solid ${RULE}` }}>
      <ReviewControls item={item} onReview={onReview} onOpenReject={onOpenReject} busy={busy} />
    </div>
  </div>
);

// ────────────────────────────────────────────────────────────
// Compact scholar row — this is what makes 40 scholars scannable
// without scrolling through expanded cards.
// ────────────────────────────────────────────────────────────
const ScholarRow = ({ scholar, selected, onSelect }) => (
  <button onClick={() => onSelect(scholar.scholar_id)}
    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-left transition-colors"
    style={{
      background: selected ? `${MAROON}0d` : 'transparent',
      borderLeft: `3px solid ${selected ? MAROON : 'transparent'}`,
      cursor: 'pointer',
    }}
    onMouseEnter={e => { if (!selected) e.currentTarget.style.background = '#fff'; }}
    onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
  >
    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{
      background: selected ? `linear-gradient(135deg, ${MAROON}, ${MAROON_DEEP})` : PAPER,
      color: selected ? GOLD_LIGHT : '#a89890',
      ...serif, fontWeight: 700, fontSize: '0.78rem',
    }}>
      {(scholar.full_name || scholar.scholar_id || '?').charAt(0).toUpperCase()}
    </div>
    <div className="flex-1 min-w-0">
      <p className="truncate" style={{ ...serif, fontSize: '0.82rem', fontWeight: 700, color: selected ? MAROON : INK }}>
        {scholar.full_name || 'Unnamed Scholar'}
      </p>
      <p style={{ ...mono, fontSize: '0.62rem', color: '#a89890' }}>{scholar.scholar_id}</p>
    </div>
    <div className="flex flex-col items-end gap-1 flex-shrink-0">
      {scholar.pendingCount > 0 && (
        <span className="px-2 py-0.5 rounded-full" style={{ ...sans, fontSize: '0.6rem', fontWeight: 800, backgroundColor: `${AMBER}18`, color: AMBER }}>
          {scholar.pendingCount}
        </span>
      )}
      {scholar.hasNegative && <AlertTriangle size={11} style={{ color: CLAY }} />}
    </div>
  </button>
);

// ────────────────────────────────────────────────────────────
// Dossier detail — the selected scholar's full record, split
// into tabs so each category (letter / grades / COR / other)
// is its own clean, short view instead of one long stacked page.
// ────────────────────────────────────────────────────────────
const DOSSIER_TABS = [
  { key: 'letters', label: 'Monthly Letter', icon: FileText },
  { key: 'grades', label: 'Grades', icon: GraduationCap },
  { key: 'cor', label: 'COR', icon: IdCard },
  { key: 'docs', label: 'Other Documents', icon: Paperclip },
];

const ScholarDossier = ({ scholar, onBack, onReview, onOpenReject, busyId, onPreview, onGeneratePdf, generatingPdfId }) => {
  const [activeTab, setActiveTab] = useState('letters');

  const withScholarMeta = (item, extra = {}) => ({
    ...item, full_name: scholar.full_name, scholar_id: scholar.scholar_id, ...extra,
  });

  const counts = {
    letters: scholar.monthly_letters.length,
    grades: scholar.grades.length,
    cor: scholar.cors.length,
    docs: scholar.other_documents.length,
  };
  const pendingByTab = {
    letters: scholar.monthly_letters.filter(x => !x.status || x.status === 'pending').length,
    grades: scholar.grades.filter(g => (g.status || 'pending') === 'pending').length,
    cor: scholar.cors.filter(x => !x.status || x.status === 'pending').length,
    docs: scholar.other_documents.filter(x => !x.status || x.status === 'pending').length,
  };

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="sticky top-0 z-10" style={{ background: '#fff', borderBottom: `1px solid ${RULE}` }}>
        <div className="flex items-center gap-3 px-5 pt-4 pb-3">
          <button onClick={onBack} className="md:hidden flex-shrink-0" style={{ color: MAROON, background: 'none', border: 'none', cursor: 'pointer' }}>
            <ArrowLeft size={18} />
          </button>
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{
            background: `linear-gradient(135deg, ${MAROON}, ${MAROON_DEEP})`,
            color: GOLD_LIGHT, ...serif, fontWeight: 700, fontSize: '0.95rem',
            border: `2px solid ${GOLD}55`,
          }}>
            {(scholar.full_name || scholar.scholar_id || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate" style={{ ...serif, fontSize: '1.05rem', fontWeight: 700, color: INK }}>{scholar.full_name || 'Unnamed Scholar'}</p>
            <p style={{ ...mono, fontSize: '0.68rem', color: '#a89890' }}>Case No. {scholar.scholar_id}</p>
          </div>
        </div>

        {/* tab bar — one category at a time, cleaner than one long stack */}
        <div className="flex px-5 overflow-x-auto">
          {DOSSIER_TABS.map(t => {
            const active = activeTab === t.key;
            const pending = pendingByTab[t.key];
            return (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className="relative flex items-center gap-1.5 px-3 py-2.5 flex-shrink-0 transition-colors"
                style={{ ...sans, fontSize: '0.72rem', fontWeight: 700, color: active ? MAROON : '#a89890', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <t.icon size={13} style={{ color: active ? GOLD : '#c9b9b0' }} />
                {t.label}
                <span style={{ ...mono, fontSize: '0.62rem', color: '#b3a89a' }}>{counts[t.key]}</span>
                {pending > 0 && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: AMBER }} />}
                {active && <span className="absolute left-0 right-0" style={{ bottom: -1, height: 2, background: MAROON }} />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 py-5">
        {activeTab === 'letters' && (
          scholar.monthly_letters.length === 0
            ? <EmptyRow label="monthly letter" />
            : scholar.monthly_letters.map(item => (
                <LetterItem key={item.id} item={withScholarMeta(item)} onReview={onReview} onOpenReject={onOpenReject}
                  busy={busyId === item.id} onPreview={onPreview}
                  onGeneratePdf={onGeneratePdf} generatingPdfId={generatingPdfId} />
              ))
        )}

        {activeTab === 'grades' && (
          scholar.grades.length === 0
            ? <EmptyRow label="grades" />
            : scholar.grades.map((item, i) => (
                <GradesItem key={i}
                  item={withScholarMeta(item, { is_grades: true })}
                  onReview={onReview} onOpenReject={onOpenReject}
                  busy={busyId === `grades-${scholar.scholar_id}-${item.semester}-${item.academic_year}`}
                  onPreview={onPreview} />
              ))
        )}

        {activeTab === 'cor' && (
          scholar.cors.length === 0
            ? <EmptyRow label="COR" />
            : scholar.cors.map(item => (
                <FileItem key={item.id} item={withScholarMeta(item)} label="COR" path={item.cor_path}
                  onReview={onReview} onOpenReject={onOpenReject} busy={busyId === item.id} onPreview={onPreview} />
              ))
        )}

        {activeTab === 'docs' && (
          scholar.other_documents.length === 0
            ? <EmptyRow label="other documents" />
            : scholar.other_documents.map(item => (
                <FileItem key={item.id} item={withScholarMeta(item)} label="Document" path={null}
                  onReview={onReview} onOpenReject={onOpenReject} busy={busyId === item.id} onPreview={onPreview} />
              ))
        )}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────────

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Needs Review' },
  { key: 'flagged', label: 'Flagged' },
];

const OfficerManualValidation = () => {
  const [scholars, setScholars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const [modal, setModal] = useState(null);
  const [decision, setDecision] = useState('rejected');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  const [filePreview, setFilePreview] = useState(null);
  const [generatingPdfId, setGeneratingPdfId] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/submission/scholar-view`, { headers: authHeader() });
      setScholars(res.data);
    } catch (e) {
      console.error('Error fetching scholar view:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => { await fetchData(); })();
  }, [fetchData]);

  // Precompute per-scholar stats once per fetch instead of on every render/row.
  const scholarStats = useMemo(() => scholars.map(s => {
    const flatItems = [...s.monthly_letters, ...s.cors, ...s.other_documents];
    const gradesPending = s.grades.filter(g => (g.status || 'pending') === 'pending').length;
    const pendingCount = flatItems.filter(x => x.status === 'pending' || !x.status).length + gradesPending;
    const hasNegative = s.monthly_letters.some(l => l.sentiment_label?.includes('Negative'));
    return { ...s, pendingCount, hasNegative };
  }), [scholars]);

  const stats = useMemo(() => {
    let pending = 0, approved = 0, rejected = 0, negative = 0;
    scholars.forEach(s => {
      [s.monthly_letters, s.cors, s.other_documents].forEach(arr => {
        (arr || []).forEach(item => {
          if (item.status === 'approved') approved++;
          else if (item.status === 'rejected') rejected++;
          else pending++;
        });
      });
      (s.grades || []).forEach(g => {
        const st = g.status || 'pending';
        if (st === 'approved') approved++;
        else if (st === 'rejected') rejected++;
        else pending++;
      });
      (s.monthly_letters || []).forEach(l => {
        if (l.sentiment_label?.includes('Negative')) negative++;
      });
    });
    return { pending, approved, rejected, negative };
  }, [scholars]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = scholarStats.filter(s => {
      if (!q) return true;
      return (s.full_name || '').toLowerCase().includes(q) || (s.scholar_id || '').toLowerCase().includes(q);
    });
    if (activeFilter === 'pending') list = list.filter(s => s.pendingCount > 0);
    if (activeFilter === 'flagged') list = list.filter(s => s.hasNegative);
    // Scholars needing action float to the top so officers work the queue, not hunt for it.
    return [...list].sort((a, b) => b.pendingCount - a.pendingCount || (a.full_name || '').localeCompare(b.full_name || ''));
  }, [scholarStats, search, activeFilter]);

  const selectedScholar = useMemo(() => scholarStats.find(s => s.scholar_id === selectedId) || null, [scholarStats, selectedId]);

  const handleReview = async (item, status, staff_comment) => {
    const busyKey = item.is_grades
      ? `grades-${item.scholar_id}-${item.semester}-${item.academic_year}`
      : item.id;
    setBusyId(busyKey);
    try {
      if (item.is_grades) {
        await axios.put(`${API}/submission/grades/review`, {
          scholar_id: item.scholar_id, semester: item.semester, academic_year: item.academic_year,
          status, staff_comment,
        }, { headers: authHeader() });
      } else {
        await axios.put(`${API}/submission/review/${item.id}`, { status, staff_comment }, { headers: authHeader() });
      }
      await fetchData();
    } catch (e) {
      console.error('Review error:', e);
    } finally {
      setBusyId(null);
    }
  };

  const handleOpenReject = (item) => {
    setModal(item);
    setDecision('rejected');
    setFeedback('');
  };

  const submitReview = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      if (modal.is_grades) {
        await axios.put(`${API}/submission/grades/review`, {
          scholar_id: modal.scholar_id, semester: modal.semester, academic_year: modal.academic_year,
          status: decision, staff_comment: feedback,
        }, { headers: authHeader() });
      } else {
        await axios.put(`${API}/submission/review/${modal.id}`, { status: decision, staff_comment: feedback }, { headers: authHeader() });
      }
      setModal(null);
      await fetchData();
    } catch (e) {
      console.error('Review error:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePdf = async (submissionId) => {
    setGeneratingPdfId(submissionId);
    try {
      await axios.get(`${API}/submission/generate-pdf/${submissionId}`, { headers: authHeader() });
      await fetchData();
    } catch (e) {
      console.error('Error generating PDF:', e);
    } finally {
      setGeneratingPdfId(null);
    }
  };

  const handlePreview = (path, label = 'File Preview', description = null) => {
    if (!path) return;
    const backendRoot = API.replace(/\/api$/, '');
    const normalized = path.startsWith('/') ? `${backendRoot}${path}` : path;
    const proxied = normalized.includes('res.cloudinary.com')
      ? `${API}/submission/preview?url=${encodeURIComponent(normalized)}`
      : normalized;
    setFilePreview({ url: proxied, kind: fileKind(normalized), label, description });
  };

  return (
    <div className="min-h-screen" style={{ background: IVORY, ...sans }}>

      {/* ── Ledger header band ─────────────────────────────── */}
      <div className="relative overflow-hidden px-5 sm:px-8 pt-8 pb-11" style={{ background: `linear-gradient(135deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)` }}>
        <svg className="absolute -right-6 -top-8 w-56 h-56 opacity-[0.12] pointer-events-none" viewBox="0 0 200 200" fill="none">
          <path d="M100 62c-6-14-20-24-36-24-4 0-8 1-8 1s-2 10 4 22c5 10 15 18 26 19-4 12-6 26-6 38 0 34 18 62 40 62 8 0 12-4 20-4s12 4 20 4c22 0 40-30 40-64 0-24-12-42-30-42-8 0-14 4-20 4s-10-3-16-6c2-11 8-20 16-25-2-1-6-2-10-2-16 0-30 8-40 17z" fill={GOLD} />
        </svg>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ border: `1.5px solid ${GOLD}` }}>
            <IdCard size={12} style={{ color: GOLD }} />
          </div>
          <span style={{ ...sans, fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.28em', textTransform: 'uppercase', color: GOLD_LIGHT }}>Registrar's Office</span>
        </div>
        <h1 style={{ ...serif, fontSize: '2rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>Submission Dossier</h1>
        <p style={{ ...sans, fontSize: '0.82rem', color: '#e9c9a8', marginTop: 4 }}>Every scholar's record, reviewed and sealed here.</p>
      </div>

      <div className="relative z-10 px-5 sm:px-8 -mt-4 pb-10">

        {/* ── Slim stat strip ──────────────────────────────── */}
        {!loading && (
          <div className="flex flex-wrap gap-2.5 mb-5">
            {[
              { label: 'Pending', value: stats.pending, color: AMBER, icon: Clock },
              { label: 'Accepted', value: stats.approved, color: SAGE, icon: CheckCircle2 },
              { label: 'Rejected', value: stats.rejected, color: CLAY, icon: XCircle },
              { label: 'Negative Tone', value: stats.negative, color: MAROON, icon: AlertTriangle },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="flex items-center gap-2 rounded-full px-3.5 py-2" style={{ background: '#fff', border: `1px solid ${RULE}`, boxShadow: '0 6px 16px -12px rgba(36,21,18,0.25)' }}>
                <Icon size={13} style={{ color }} />
                <span style={{ ...serif, fontSize: '1.05rem', fontWeight: 700, color }}>{value}</span>
                <span style={{ ...sans, fontSize: '0.66rem', fontWeight: 700, color: '#a89890', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Search + quick filters ───────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#c9b9b0' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by scholar name or case no..."
              className="w-full pl-9 pr-4 py-2.5 rounded-full outline-none bg-white"
              style={{ ...sans, fontSize: '0.82rem', border: `1px solid ${RULE}`, color: INK }}
            />
          </div>
          <div className="flex items-center gap-2">
            {FILTERS.map(f => (
              <button key={f.key} onClick={() => setActiveFilter(f.key)}
                className="px-3.5 py-2 rounded-full transition-colors"
                style={{
                  ...sans, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                  background: activeFilter === f.key ? MAROON : '#fff',
                  color: activeFilter === f.key ? '#fff' : '#8a7a70',
                  border: `1px solid ${activeFilter === f.key ? MAROON : RULE}`,
                }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: '#a89890', ...sans }}>
            <Clock size={14} className="animate-spin" /> Retrieving records...
          </div>
        ) : (
          /* ── Master-detail split view — list stays compact and scrolls
             on its own, so finding a scholar never means scrolling the page. ── */
          <div className="rounded-xl overflow-hidden flex flex-col md:flex-row" style={{ border: `1px solid ${RULE}`, background: '#fff', boxShadow: '0 10px 30px -18px rgba(36,21,18,0.25)', height: 'min(74vh, 780px)' }}>

            {/* list panel */}
            <div className={`${selectedScholar ? 'hidden md:flex' : 'flex'} md:w-[340px] flex-shrink-0 flex-col`} style={{ borderRight: `1px solid ${RULE}`, background: PAPER }}>
              <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${RULE}` }}>
                <span style={{ ...sans, fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a89890' }}>
                  {filtered.length} scholar{filtered.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto px-2 py-2">
                {filtered.length === 0 ? (
                  <div className="px-3 py-8 text-center" style={{ ...sans, fontSize: '0.78rem', color: '#a89890' }}>
                    No matching case files found.
                  </div>
                ) : (
                  filtered.map(s => (
                    <ScholarRow key={s.scholar_id} scholar={s} selected={s.scholar_id === selectedId} onSelect={setSelectedId} />
                  ))
                )}
              </div>
            </div>

            {/* detail panel */}
            <div className={`${selectedScholar ? 'flex' : 'hidden md:flex'} flex-1 min-w-0`}>
              {selectedScholar ? (
                <ScholarDossier
                  key={selectedScholar.scholar_id}
                  scholar={selectedScholar}
                  onBack={() => setSelectedId(null)}
                  onReview={handleReview} onOpenReject={handleOpenReject}
                  busyId={busyId} onPreview={handlePreview}
                  onGeneratePdf={handleGeneratePdf} generatingPdfId={generatingPdfId}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 px-6 text-center">
                  <FolderOpen size={28} style={{ color: '#d9cbb8' }} />
                  <p style={{ ...serif, fontSize: '0.95rem', fontWeight: 700, color: '#a89890' }}>Select a scholar</p>
                  <p style={{ ...sans, fontSize: '0.75rem', color: '#c9b9b0' }}>Pick a case from the list to review their dossier.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* REJECT / REVIEW MODAL - shared component */}
      <ReviewModal
        modal={modal}
        decision={decision}
        setDecision={setDecision}
        feedback={feedback}
        setFeedback={setFeedback}
        saving={saving}
        onClose={() => setModal(null)}
        onSubmit={submitReview}
      />

      {/* IN-PAGE FILE PREVIEW - shared component */}
      {filePreview && (
        <FilePreviewModal preview={filePreview} onClose={() => setFilePreview(null)} />
      )}
    </div>
  );
};

export default OfficerManualValidation;