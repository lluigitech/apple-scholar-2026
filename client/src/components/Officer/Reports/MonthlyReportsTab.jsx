// Monthly letter review queue and decision workflow.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Mail, CheckCircle2, XCircle, Clock3, AlertTriangle, ChevronLeft, ChevronRight,
  Download, CheckSquare, Square, RefreshCw, Search, FilterX, FileText, Eye, X,
} from 'lucide-react';
import axios from 'axios';
import { formatYearLevelLabel } from '../../../utils/yearLevelLabels';
import { API_BASE as REPORTS_API_BASE, scoreColor } from './ReportsHelpers';

/* ───────── CONTRACT: i-match ito sa backend ─────────
 * GET  LIST_PATH?month=YYYY-MM  -> array ng rows (o { data: [...] })
 *   Mga field na binabasa (snake_case o camelCase): id, scholar_id|studentId, full_name|scholarName,
 *   year_level|year, course, school, submitted_at|submittedAt, quality_score|qualityScore,
 *   quality_status|status ('accepted'|'medium_risk'|'high_risk'), review_status|staff_action|staffAction
 *   ('pending'|'approved'|'returned'|'rejected'), staff_comment, letter_content, content_breakdown
 *   (JSON/object: paragraph, academic, self_improvement, family, difficulty), sentiment_label, sentiment_score
 * POST ACTION_PATH(id) body: { action: 'approve' | 'return', comment }
 */
const LIST_PATH = '/officer/reports/monthly-submissions';
const ACTION_PATH = id => `/officer/reports/monthly-submissions/${encodeURIComponent(id)}/action`;
const LOG_PATH = '/export/google-sheets';

const API_BASE = REPORTS_API_BASE;
const authConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

// ── Officer design tokens ──
const MAROON = '#6D2140', MAROON_DEEP = '#4f1620', GOLD = '#b98b4e', BG = '#F6EFE4', CARD = '#fffdf8';
const RULE = '#e8dccb', INK = '#241512', MUTED = '#a89890', SAGE = '#3F8A55', AMBER = '#b8863f', CLAY = '#C1666B';
const display = { fontFamily: "'Lora', Georgia, serif" };
const body = { fontFamily: "'Work Sans', 'Segoe UI', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', ui-monospace, Menlo, monospace" };
const tile = { background: CARD, border: `1px solid ${RULE}`, borderRadius: 14, boxShadow: '0 8px 20px -16px rgba(36,21,18,0.35)' };
const fieldLabel = { ...body, display: 'block', fontSize: '0.72rem', fontWeight: 500, color: '#7a6a62', marginBottom: 5 };
const boxField = { height: 40, padding: '0 10px', border: `1px solid ${RULE}`, borderRadius: 8, background: CARD, ...body, fontSize: '0.84rem', color: INK, outline: 'none', minWidth: 140 };
const outlineBtn = { display: 'inline-flex', alignItems: 'center', gap: 8, height: 38, padding: '0 14px', border: `1px solid ${RULE}`, borderRadius: 8, background: CARD, color: MAROON_DEEP, ...body, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' };
const filledBtn = c => ({ ...outlineBtn, justifyContent: 'center', background: c, color: '#fff', border: 'none' });

// ── Config ──
const sentimentCfg = {
  positive: { color: SAGE, label: 'Positive' },
  neutral: { color: AMBER, label: 'Neutral' },
  negative: { color: CLAY, label: 'Negative' },
};
const reviewCfg = {
  pending: { color: AMBER, icon: Clock3, label: 'Pending' },
  approved: { color: SAGE, icon: CheckCircle2, label: 'Approved' },
  returned: { color: CLAY, icon: XCircle, label: 'Returned' },
};
const qualityCfg = {
  accepted: { color: SAGE, label: 'Quality Accepted' },
  medium_risk: { color: AMBER, label: 'Quality Medium Risk' },
  high_risk: { color: CLAY, label: 'Quality High Risk' },
};
const RUBRIC = [
  { key: 'paragraph', label: 'Paragraph Structure', max: 7 },
  { key: 'academic', label: 'Academic Updates', max: 21 },
  { key: 'self_improvement', label: 'Self-Improvement', max: 14 },
  { key: 'family', label: 'Family Situation', max: 7 },
  { key: 'difficulty', label: 'Socio-Economic Difficulty', max: 21 },
];

// ── Adapter (isang lugar para sa response shape) ──
const pick = (row, ...keys) => { for (const k of keys) if (row[k] !== undefined && row[k] !== null) return row[k]; return undefined; };
const normReview = v => {
  const s = String(v || '').toLowerCase();
  if (s === 'approved') return 'approved';
  if (['returned', 'rejected', 'needs_revision', 'revision'].includes(s)) return 'returned';
  return 'pending';
};
const normQuality = v => {
  const s = String(v || '').toLowerCase().replace(/-/g, '_');
  return qualityCfg[s] ? s : null; // walang imbento
};
const formatDate = v => (v ? new Date(v).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
const wordCountOf = t => String(t || '').trim().split(/\s+/).filter(Boolean).length;
const getSentiment = (label, score) => {
  const l = String(label || '').toLowerCase();
  const n = score === undefined || score === null || score === '' ? null : Number(score);
  const s100 = n === null || Number.isNaN(n) ? null : (n >= -1 && n <= 1 ? Math.round((n + 1) * 50) : Math.round(Math.max(0, Math.min(100, n))));
  const sentiment = ['positive', 'negative', 'neutral'].includes(l) ? l
    : s100 === null ? null : s100 >= 70 ? 'positive' : s100 < 40 ? 'negative' : 'neutral';
  return { sentiment, score: s100 };
};

const mapRow = row => {
  const fullText = pick(row, 'letter_content', 'letterContent') || '';
  let cb = pick(row, 'content_breakdown', 'contentBreakdown');
  try { if (typeof cb === 'string') cb = JSON.parse(cb); } catch { cb = null; }
  const rubric = cb && typeof cb === 'object' ? RUBRIC.map(r => ({ label: r.label, max: r.max, score: Number(cb[r.key] ?? 0) })) : [];
  const q = pick(row, 'quality_score', 'qualityScore');
  const score = q === undefined ? null : Number(q);
  const { sentiment, score: sScore } = getSentiment(pick(row, 'sentiment_label', 'sentimentLabel'), pick(row, 'sentiment_score', 'sentimentScore'));
  const quality = normQuality(pick(row, 'quality_status', 'qualityStatus', 'status'));
  const yl = pick(row, 'year_level', 'year');
  return {
    id: row.id, // totoong ID ng submission
    scholarId: pick(row, 'scholar_id', 'studentId', 'student_id') || '—',
    scholarName: pick(row, 'full_name', 'scholarName') || 'Unknown scholar',
    yearLevel: yl ? formatYearLevelLabel(yl) : '—',
    course: row.course || '', school: row.school || '',
    submittedRaw: pick(row, 'submitted_at', 'submittedAt'),
    submittedDate: formatDate(pick(row, 'submitted_at', 'submittedAt')),
    type: 'Monthly Progress Report',
    score, quality, sentiment, sentimentScore: sScore,
    sentimentKeywords: Array.isArray(row.sentiment_keywords) ? row.sentiment_keywords : [],
    review: normReview(pick(row, 'review_status', 'staff_action', 'staffAction')),
    comment: pick(row, 'staff_comment', 'staffComment') || null,
    fullText, excerpt: fullText.slice(0, 240), wordCount: wordCountOf(fullText), rubric,
    bodyScore: rubric.reduce((s, r) => s + r.score, 0),
    checklist: [
      { label: 'Letter body provided', met: wordCountOf(fullText) > 0 },
      { label: 'Minimum word count (300+)', met: wordCountOf(fullText) >= 300 },
      { label: 'Quality evaluation available', met: score !== null },
    ],
    riskFlag: sentiment === 'negative' || quality === 'high_risk',
  };
};

// ── Small shared UI ──
const AlertStrip = ({ color, children, action }) => (
  <div className="flex items-center justify-between gap-3" style={{ ...tile, borderLeft: `3px solid ${color}`, background: `${color}0d`, padding: '11px 16px', ...body, fontSize: '0.8rem', fontWeight: 600, color }} role="alert">
    <span className="flex items-center gap-2"><AlertTriangle size={14} style={{ flexShrink: 0 }} />{children}</span>{action}
  </div>
);
const StatusBadge = ({ status, size = 'md' }) => {
  const c = reviewCfg[status] || reviewCfg.pending; const Icon = c.icon; const big = size === 'lg';
  return (<span className="inline-flex items-center gap-1.5" style={{ ...body, fontSize: big ? '0.78rem' : '0.72rem', fontWeight: 600, color: c.color, background: `${c.color}16`, borderRadius: 999, padding: big ? '6px 14px' : '4px 10px', whiteSpace: 'nowrap' }}><Icon size={big ? 14 : 12} />{c.label}</span>);
};
const Pill = ({ color, children }) => (<span style={{ ...body, fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: `${color}16`, color, whiteSpace: 'nowrap' }}>{children}</span>);
const MetricCard = ({ label, children, accent = MAROON }) => (
  <div style={{ background: BG, border: `1px solid ${RULE}`, borderRadius: 12, padding: '14px 16px' }}>
    <p style={{ ...body, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.05em', color: accent, marginBottom: 10 }}>{label}</p>{children}
  </div>
);
const DetailField = ({ label, children }) => (
  <div><p style={{ ...body, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.05em', color: MUTED, textTransform: 'uppercase', marginBottom: 3 }}>{label}</p>
    <div style={{ ...body, fontSize: '0.84rem', color: INK }}>{children}</div></div>
);
const SentimentGauge = ({ score, color }) => (
  <div>
    <div className="relative" style={{ height: 14, marginBottom: 2 }}>
      <div className="absolute inset-x-0 bottom-0 overflow-hidden rounded-full" style={{ height: 6, background: RULE }}>
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
      <div className="absolute" style={{ left: `calc(${score}% - 5px)`, bottom: 4, width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `6px solid ${color}` }} />
    </div>
    <div className="flex justify-between" style={{ ...body, fontSize: '0.62rem', color: MUTED }}><span>0</span><span>50</span><span>100</span></div>
  </div>
);
// ── Isang centered Review modal ──
function ReviewModal({ letter, onClose, onDecide }) {
  const [viewFull, setViewFull] = useState(false);
  const [comment, setComment] = useState(letter.comment || '');
  const [mode, setMode] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const sc = letter.sentiment ? sentimentCfg[letter.sentiment] : null;
  const qColor = letter.score === null ? MUTED : scoreColor(letter.score);
  const reasonMissing = mode === 'return' && !comment.trim();

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && !submitting) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  const submit = async () => {
    if (!mode || reasonMissing || submitting) return;
    setSubmitting(true); setErr('');
    try { await onDecide(letter.id, mode, comment.trim()); onClose(); }
    catch (e) { setErr(e.response?.data?.error || e.response?.data?.message || 'Could not save the review decision.'); setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" style={{ background: 'rgba(36,21,18,0.55)' }} onClick={() => !submitting && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="mlr-title" onClick={e => e.stopPropagation()} className="flex w-full flex-col"
        style={{ maxWidth: 860, maxHeight: '90vh', background: CARD, border: `1px solid ${RULE}`, borderRadius: 16, boxShadow: '0 28px 60px -24px rgba(36,21,18,0.5)', overflow: 'hidden' }}>
        <div className="flex flex-shrink-0 items-start justify-between gap-4" style={{ padding: '18px 22px', borderBottom: `1px solid ${RULE}` }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ ...body, fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.08em', color: GOLD }}>SUBMISSION DETAILS</p>
            <h2 id="mlr-title" style={{ ...display, fontSize: '1.2rem', fontWeight: 700, color: INK }}>{letter.scholarName}</h2>
            <p style={{ ...mono, fontSize: '0.7rem', color: MUTED, marginTop: 2 }}>{letter.scholarId} · {letter.yearLevel}</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-3">
            <StatusBadge status={letter.review} />
            <button onClick={onClose} disabled={submitting} aria-label="Close review" style={{ ...outlineBtn, padding: 0, width: 38, justifyContent: 'center' }}><X size={16} /></button>
          </div>
        </div>

        <div className="space-y-6 overflow-y-auto p-5 sm:p-6" style={{ flex: 1 }}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3" style={{ background: BG, border: `1px solid ${RULE}`, borderRadius: 12, padding: '14px 16px' }}>
            <DetailField label="Scholar ID"><span style={mono}>{letter.scholarId}</span></DetailField>
            <DetailField label="Year Level">{letter.yearLevel}</DetailField>
            <DetailField label="Submitted">{letter.submittedDate}</DetailField>
            <DetailField label="Review Status"><StatusBadge status={letter.review} /></DetailField>
            {letter.quality && <DetailField label="AI Quality"><Pill color={qualityCfg[letter.quality].color}>{qualityCfg[letter.quality].label}</Pill></DetailField>}
            {letter.riskFlag && <DetailField label="Risk"><Pill color={CLAY}>Risk Flag</Pill></DetailField>}
          </div>

          <div>
            <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', color: GOLD, marginBottom: 8 }}>LETTER PREVIEW</p>
            {letter.fullText ? (<>
              <p style={{ ...body, fontSize: '0.92rem', color: '#3f2f28', lineHeight: 1.8 }}>{letter.excerpt}{letter.fullText.length > 240 && !viewFull ? '…' : ''}</p>
              {letter.fullText.length > 240 && (
                <button onClick={() => setViewFull(v => !v)} className="mt-2" style={{ ...body, fontSize: '0.76rem', fontWeight: 600, color: MAROON, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                  {viewFull ? 'Show less' : 'View full letter'}
                </button>)}
              {viewFull && <div className="mt-3" style={{ ...body, fontSize: '0.88rem', color: '#3f2f28', lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>{letter.fullText}</div>}
            </>) : <p style={{ ...body, fontSize: '0.84rem', color: MUTED }}>Letter content is not available.</p>}
          </div>

          <div>
            <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', color: GOLD, marginBottom: 10 }}>AI EVALUATION</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-3">
                <MetricCard label={letter.score === null ? 'QUALITY SCORE' : `QUALITY SCORE — ${letter.score}%`} accent={qColor}>
                  {letter.rubric.length > 0
                    ? <p style={{ ...display, fontSize: '1.6rem', fontWeight: 700, color: qColor }}>{letter.bodyScore}<span style={{ fontSize: '0.9rem', color: MUTED, fontWeight: 500 }}> / 70</span></p>
                    : <p style={{ ...body, fontSize: '0.8rem', color: MUTED }}>No rubric data.</p>}
                </MetricCard>
                {letter.rubric.length > 0 && (
                  <MetricCard label="RUBRIC BREAKDOWN"><div className="space-y-2">
                    {letter.rubric.map(r => (<div key={r.label} className="flex items-center justify-between gap-3">
                      <span style={{ ...body, fontSize: '0.78rem', color: '#3f2f28' }}>{r.label}</span>
                      <span style={{ ...body, fontSize: '0.76rem', color: INK, fontWeight: 700 }}>{r.score}/{r.max}</span></div>))}
                  </div></MetricCard>)}
                <MetricCard label="COMPLETENESS"><div className="space-y-2">
                  {letter.checklist.map(i => (<div key={i.label} className="flex items-center gap-2">
                    {i.met ? <CheckSquare size={13} style={{ color: SAGE, flexShrink: 0 }} /> : <Square size={13} style={{ color: CLAY, flexShrink: 0 }} />}
                    <span style={{ ...body, fontSize: '0.78rem', color: i.met ? '#3f2f28' : CLAY }}>{i.label}</span></div>))}
                </div></MetricCard>
              </div>
              <div className="space-y-3">
                <MetricCard label={sc && letter.sentimentScore !== null ? `SENTIMENT GAUGE — ${letter.sentimentScore}/100` : 'SENTIMENT'} accent={sc?.color || MUTED}>
                  {sc ? (<>
                    {letter.sentimentScore !== null && <SentimentGauge score={letter.sentimentScore} color={sc.color} />}
                    <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 10 }}>Overall: <strong style={{ color: sc.color }}>{sc.label}</strong></p>
                  </>) : <p style={{ ...body, fontSize: '0.8rem', color: MUTED }}>No sentiment data.</p>}
                </MetricCard>
                {letter.sentimentKeywords.length > 0 && (
                  <MetricCard label="KEYWORDS"><div className="flex flex-wrap gap-1.5">
                    {letter.sentimentKeywords.map((kw, i) => {
                      const word = typeof kw === 'string' ? kw : kw.word; const t = typeof kw === 'string' ? '' : kw.type;
                      const c = t === 'positive' ? SAGE : t === 'negative' ? CLAY : MUTED;
                      return <span key={i} style={{ ...body, fontSize: '0.7rem', fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: `${c}14`, color: c }}>{word}</span>;
                    })}
                  </div></MetricCard>)}
                <MetricCard label="WORD COUNT"><p style={{ ...display, fontSize: '1.4rem', fontWeight: 700, color: INK }}>{letter.wordCount}<span style={{ fontSize: '0.8rem', color: MUTED, fontWeight: 500 }}> words</span></p></MetricCard>
              </div>
            </div>
          </div>

          {letter.comment && letter.review !== 'pending' || (letter.comment && !mode)
            ? <AlertStrip color={AMBER}>Previous officer feedback: {letter.comment}</AlertStrip> : null}

          {letter.review === 'pending' && (
            <div style={{ borderTop: `1px solid ${RULE}` }}>
              <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', color: INK, margin: '14px 0 10px' }}>OFFICER DECISION</p>
              {!mode ? (
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setMode('approve')} style={filledBtn(SAGE)}><CheckCircle2 size={14} /> Approve</button>
                  <button onClick={() => setMode('return')} style={filledBtn(CLAY)}><XCircle size={14} /> Return for Revision</button>
                </div>
              ) : (
                <div className="space-y-3">
                  <label htmlFor="mlr-comment" style={{ ...body, fontSize: '0.78rem', color: MUTED }}>{mode === 'approve' ? 'Approval note (optional)' : 'Reason for returning (required)'}</label>
                  <textarea id="mlr-comment" value={comment} onChange={e => setComment(e.target.value)} rows={3} className="w-full resize-none outline-none"
                    placeholder={mode === 'approve' ? 'Optional approval note...' : 'Explain what needs to be revised...'}
                    style={{ ...body, fontSize: '0.88rem', padding: '12px 14px', borderRadius: 12, border: `1px solid ${reasonMissing ? `${CLAY}88` : RULE}`, background: BG, color: INK }} />
                  {reasonMissing && <p style={{ ...body, fontSize: '0.74rem', color: CLAY }}>A reason is required before returning this letter.</p>}
                  {err && <AlertStrip color={CLAY}>{err}</AlertStrip>}
                  <div className="flex flex-wrap gap-2">
                    <button onClick={submit} disabled={reasonMissing || submitting} style={{ ...filledBtn(mode === 'approve' ? SAGE : CLAY), opacity: reasonMissing || submitting ? 0.5 : 1, cursor: reasonMissing || submitting ? 'not-allowed' : 'pointer' }}>
                      {submitting ? 'Saving…' : `Confirm ${mode === 'approve' ? 'Approval' : 'Return'}`}
                    </button>
                    <button onClick={() => { setMode(null); setErr(''); }} disabled={submitting} style={outlineBtn}>Cancel</button>
                  </div>
                </div>)}
            </div>)}
        </div>
      </div>
    </div>
  );
}

// ── CSV helpers ──
const csvCell = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

const DEFAULT_FILTERS = { search: '', yearLevel: 'all', review: 'all', quality: 'all', sentiment: 'all' };
const currentMonth = () => new Date().toISOString().slice(0, 7);

// ── Main ──
export default function MonthlyLetterReview({ assignedYearLevels }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(currentMonth());
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedId, setSelectedId] = useState(null);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true); setError('');
    try {
      const res = await axios.get(`${API_BASE}${LIST_PATH}`, { ...authConfig(), params: { month } });
      if (id !== reqId.current) return; // stale response
      const list = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.submissions || [];
      setRows(list.map(mapRow));
    } catch (e) {
      if (id === reqId.current) setError(e.response?.data?.error || 'Could not load monthly letter submissions.');
    } finally { if (id === reqId.current) setLoading(false); }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (key, value) => { setFilters(f => ({ ...f, [key]: value })); setPage(1); };
  const resetFilters = () => { setFilters(DEFAULT_FILTERS); setPage(1); };
  const filtersActive = Object.keys(DEFAULT_FILTERS).some(k => filters[k] !== DEFAULT_FILTERS[k]);

  const yearLevelOptions = useMemo(() => {
    const src = assignedYearLevels?.length ? assignedYearLevels : rows.map(r => r.yearLevel).filter(y => y && y !== '—');
    return [...new Set(src)].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  }, [assignedYearLevels, rows]);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return rows.filter(r =>
      (!q || r.scholarName.toLowerCase().includes(q) || String(r.scholarId).toLowerCase().includes(q)) &&
      (filters.yearLevel === 'all' || r.yearLevel === filters.yearLevel) &&
      (filters.review === 'all' || r.review === filters.review) &&
      (filters.quality === 'all' || r.quality === filters.quality) &&
      (filters.sentiment === 'all' || r.sentiment === filters.sentiment));
  }, [rows, filters]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const pendingCount = rows.filter(r => r.review === 'pending').length;
  const selected = rows.find(r => r.id === selectedId) || null;

  // Isang decision workflow; ang modal ang nagpapakita ng error kapag nag-throw.
  const handleDecide = async (id, action, comment) => {
    await axios.post(`${API_BASE}${ACTION_PATH(id)}`, { action, comment: comment || null }, authConfig());
    setRows(list => list.map(r => r.id === id
      ? { ...r, review: action === 'approve' ? 'approved' : 'returned', comment: comment || null } : r));
    load(); // i-sync sa server (counts, filters, pagination)
  };

  const exportCSV = () => {
    const header = ['Scholar ID', 'Scholar Name', 'Submission Type', 'Submission Date', 'Completeness/Quality Score', 'Sentiment', 'Sentiment Score', 'Officer Review Status'];
    const data = filtered.map(r => [r.scholarId, r.scholarName, r.type, r.submittedDate,
      r.score === null ? '' : `${r.score}%`, r.sentiment || '', r.sentimentScore === null ? '' : `${r.sentimentScore}/100`, reviewCfg[r.review].label]);
    const csv = [header, ...data].map(row => row.map(csvCell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'monthly_letter_review.csv'; a.click(); URL.revokeObjectURL(url);
    axios.post(`${API_BASE}${LOG_PATH}`, { log_only: true, module: 'Monthly Letter Review', report_resource: 'Monthly Letter Review Export', spreadsheet_title: 'Monthly Letter Review Export', details: 'monthly_letter_review.csv' }, authConfig()).catch(() => {}); // best-effort
  };

  const columns = ['Scholar', 'Scholar ID', 'Course & School', 'AI Quality Score', 'AI Quality Status', 'Sentiment', 'Review Status', 'Submitted', ''];
  const Select = ({ id, label, value, onChange, options }) => (
    <div><label htmlFor={id} style={fieldLabel}>{label}</label>
      <select id={id} value={value} onChange={e => onChange(e.target.value)} style={{ ...boxField, cursor: 'pointer' }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
  );

  return (
    <div className="flex flex-col gap-4" style={{ minWidth: 0, ...body }}>
      <style>{`.mlr-btn:hover{background:${BG}} .mlr-btn:focus-visible,.mlr-field:focus-visible{outline:2px solid ${GOLD};outline-offset:2px}`}</style>

      <div style={{ ...tile, padding: '14px 18px', borderLeft: `3px solid ${GOLD}` }}>
        <div className="flex flex-wrap items-end gap-3">
          <div style={{ flex: '1 1 200px', minWidth: 180 }}>
            <label htmlFor="mlr-search" style={fieldLabel}>Search</label>
            <div className="flex items-center gap-2" style={{ ...boxField, minWidth: 0 }}>
              <Search size={14} style={{ color: MUTED, flexShrink: 0 }} />
              <input id="mlr-search" className="mlr-field" value={filters.search} onChange={e => setFilter('search', e.target.value)} placeholder="Scholar name or ID"
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none', ...body, fontSize: '0.84rem', color: INK }} />
            </div>
          </div>
          <div><label htmlFor="mlr-month" style={fieldLabel}>Report Month</label>
            <input id="mlr-month" className="mlr-field" type="month" value={month} onChange={e => { if (e.target.value) { setMonth(e.target.value); setPage(1); } }} style={boxField} /></div>
          <Select id="mlr-year" label="Assigned Year Level" value={filters.yearLevel} onChange={v => setFilter('yearLevel', v)} options={[['all', 'All Year Levels'], ...yearLevelOptions.map(y => [y, y])]} />
          <Select id="mlr-review" label="Officer Review Status" value={filters.review} onChange={v => setFilter('review', v)} options={[['all', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['returned', 'Returned']]} />
          <Select id="mlr-quality" label="AI Quality Status" value={filters.quality} onChange={v => setFilter('quality', v)} options={[['all', 'All'], ...Object.entries(qualityCfg).map(([k, c]) => [k, c.label])]} />
          <Select id="mlr-sent" label="Sentiment" value={filters.sentiment} onChange={v => setFilter('sentiment', v)} options={[['all', 'All'], ['positive', 'Positive'], ['neutral', 'Neutral'], ['negative', 'Negative']]} />
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <button className="mlr-btn" onClick={resetFilters} disabled={!filtersActive} style={{ ...outlineBtn, opacity: filtersActive ? 1 : 0.5, cursor: filtersActive ? 'pointer' : 'default' }}><FilterX size={14} /> Reset Filters</button>
            <button className="mlr-btn" onClick={load} style={outlineBtn}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
            <button onClick={exportCSV} disabled={filtered.length === 0} style={{ ...filledBtn(MAROON), opacity: filtered.length ? 1 : 0.5 }}><Download size={14} /> Export CSV</button>
          </div>
        </div>
        {!loading && <p style={{ fontSize: '0.74rem', color: MUTED, marginTop: 10 }}>{filtered.length} matching {filtered.length === 1 ? 'letter' : 'letters'}</p>}
      </div>

      {error && <AlertStrip color={CLAY} action={<button onClick={load} style={{ ...body, fontSize: '0.74rem', fontWeight: 700, color: CLAY, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>}>{error}</AlertStrip>}

      <div style={{ ...tile, overflow: 'hidden' }}>
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${RULE}` }}>
          <Mail size={20} strokeWidth={1.75} style={{ color: MAROON_DEEP }} />
          <div>
            <h2 style={{ ...display, fontSize: '1.15rem', fontWeight: 600, color: MAROON_DEEP, lineHeight: 1.2 }}>Monthly Letter Review</h2>
            <p style={{ fontSize: '0.78rem', color: MUTED, marginTop: 3 }}>Review monthly letters from your assigned scholars.
              {!loading && !error && pendingCount > 0 && <span style={{ color: AMBER, fontWeight: 600 }}> {pendingCount} awaiting review.</span>}</p>
          </div>
        </div>

        {!loading && filtered.length === 0 ? (
          <div className="px-4 py-14 text-center"><FileText className="mx-auto mb-3 h-9 w-9" style={{ color: RULE }} />
            <p style={{ fontSize: '0.82rem', color: MUTED }}>No letters found.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: 980 }}>
              <thead><tr style={{ background: `${BG}b3`, borderBottom: `1px solid ${RULE}` }}>
                {columns.map((c, i) => <th key={i} scope="col" className="whitespace-nowrap px-4 py-3 text-left" style={{ fontSize: '0.74rem', fontWeight: 600, color: '#6b5a52' }}>{c}</th>)}
              </tr></thead>
              <tbody>
                {loading ? Array.from({ length: 5 }).map((_, r) => (
                  <tr key={r} style={{ borderTop: `1px solid ${RULE}` }}>{columns.map((__, c) => <td key={c} className="px-4 py-4"><div className="h-2.5 w-4/5 animate-pulse rounded-full" style={{ background: BG }} /></td>)}</tr>
                )) : paged.map(r => {
                  const q = r.quality ? qualityCfg[r.quality] : null; const sc = r.sentiment ? sentimentCfg[r.sentiment] : null;
                  const color = r.score === null ? MUTED : scoreColor(r.score);
                  const initials = r.scholarName.split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-[#F6EFE4]" style={{ borderTop: `1px solid ${RULE}` }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full" style={{ background: `${MAROON}12`, color: MAROON, ...display, fontSize: '0.74rem', fontWeight: 700 }}>{initials}</span>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: '0.82rem', fontWeight: 600, color: INK }}>{r.scholarName}{r.riskFlag && <span title="Risk flag" style={{ marginLeft: 6, color: CLAY }}><AlertTriangle size={11} style={{ display: 'inline' }} /></span>}</p>
                            <p style={{ fontSize: '0.72rem', color: MUTED }}>{r.yearLevel}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3" style={{ ...mono, fontSize: '0.74rem', color: '#6b6058' }}>{r.scholarId}</td>
                      <td className="px-4 py-3">{r.course || r.school ? (<><p style={{ fontSize: '0.8rem', fontWeight: 600, color: INK }}>{r.course}</p><p style={{ fontSize: '0.72rem', color: MUTED }}>{r.school}</p></>) : <span style={{ color: MUTED }}>—</span>}</td>
                      <td className="px-4 py-3">{r.score === null ? <span style={{ color: MUTED }}>—</span> : (
                        <div className="flex items-center gap-2"><div className="h-1.5 w-16 overflow-hidden rounded-full" style={{ background: RULE }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, r.score))}%`, background: color }} /></div>
                          <span style={{ ...mono, fontSize: '0.74rem', fontWeight: 700, color }}>{r.score}</span></div>)}</td>
                      <td className="px-4 py-3">{q ? <Pill color={q.color}>{q.label}</Pill> : <span style={{ color: MUTED }}>—</span>}</td>
                      <td className="px-4 py-3">{sc ? <Pill color={sc.color}>{sc.label}</Pill> : <span style={{ color: MUTED }}>—</span>}</td>
                      <td className="px-4 py-3"><StatusBadge status={r.review} /></td>
                      <td className="whitespace-nowrap px-4 py-3" style={{ fontSize: '0.76rem', color: '#7a6a62' }}>{r.submittedDate}</td>
                      <td className="px-4 py-3 text-right">
                        <button className="mlr-btn" onClick={() => setSelectedId(r.id)} aria-label={`${r.review === 'pending' ? 'Review' : 'View'} letter from ${r.scholarName}`} style={{ ...outlineBtn, height: 34 }}>
                          <Eye size={13} /> {r.review === 'pending' ? 'Review' : 'View'}</button>
                      </td>
                    </tr>);
                })}
              </tbody>
            </table>
          </div>)}

        {!loading && filtered.length > 0 && (
          <div className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderTop: `1px solid ${RULE}` }}>
            <p style={{ fontSize: '0.76rem', color: MUTED }}>Showing {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filtered.length)} of {filtered.length} letters</p>
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="mlr-size" style={{ fontSize: '0.74rem', color: MUTED }}>Rows</label>
              <select id="mlr-size" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} style={{ ...boxField, height: 32, minWidth: 0, fontSize: '0.74rem' }}>
                {[10, 20, 50].map(s => <option key={s} value={s}>{s}</option>)}</select>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1} aria-label="Previous page" style={{ ...outlineBtn, height: 32, padding: '0 9px', opacity: safePage <= 1 ? 0.45 : 1 }}><ChevronLeft size={15} /></button>
              <span style={{ fontSize: '0.74rem', color: INK, minWidth: 76, textAlign: 'center' }}>Page {safePage} of {pageCount}</span>
              <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={safePage >= pageCount} aria-label="Next page" style={{ ...outlineBtn, height: 32, padding: '0 9px', opacity: safePage >= pageCount ? 0.45 : 1 }}><ChevronRight size={15} /></button>
            </div>
          </div>)}
      </div>

      {selected && <ReviewModal key={selected.id} letter={selected} onClose={() => setSelectedId(null)} onDecide={handleDecide} />}
    </div>
  );
}