import { useEffect, useState } from 'react';
import {
  Mail, CheckCircle, XCircle, Clock, AlertTriangle,
  MessageSquare, TrendingUp, Eye, ChevronDown, ChevronUp, Download
} from 'lucide-react';

/* Legacy mock data retained only as historical reference; the page uses the API below.

const letters = [
  {
    id: 'L001',
    scholarId: 'AS-2026-001001',
    scholarName: 'Maria Dela Cruz',
    yearLevel: '3rd Year College',
    submittedDate: 'Jun 15, 2026',
    type: 'Monthly Progress Report - June 2026',
    wordCount: 412,
    completenessScore: 92,
    completenessItems: [
      { label: 'Minimum word count (300+)', met: true },
      { label: 'Scholar ID & Name', met: true },
      { label: 'Reporting period stated', met: true },
      { label: 'Academic update included', met: true },
      { label: 'Community service mentioned', met: true },
      { label: 'Proper salutation', met: true },
      { label: 'Closing & Signature', met: true },
      { label: 'GWA or grade mentioned', met: false },
    ],
    sentiment: 'positive',
    sentimentScore: 82,
    sentimentKeywords: [
      { word: 'grateful', type: 'positive' },
      { word: 'improving', type: 'positive' },
      { word: 'dedicated', type: 'positive' },
      { word: 'achieving', type: 'positive' },
      { word: 'motivated', type: 'positive' },
      { word: 'thankful', type: 'positive' },
    ],
    excerpt: 'I am grateful for the continued support of the Kalingan Foundation. This month, I have been dedicated to improving my academic performance...',
    fullText: 'Dear Kalingan Foundation,\n\nI am Maria Dela Cruz, scholar ID AS-2026-001001, reporting my progress for June 2026...',
    staffStatus: 'pending',
    staffComment: null,
    riskFlag: false,
  },
  {
    id: 'L002',
    scholarId: 'AS-2026-001241',
    scholarName: 'Isabel Martinez',
    yearLevel: '2nd Year College',
    submittedDate: 'May 10, 2026',
    type: 'Monthly Progress Report - May 2026',
    wordCount: 287,
    completenessScore: 54,
    completenessItems: [
      { label: 'Minimum word count (300+)', met: false },
      { label: 'Scholar ID & Name', met: true },
      { label: 'Reporting period stated', met: true },
      { label: 'Academic update included', met: false },
      { label: 'Community service mentioned', met: false },
      { label: 'Proper salutation', met: true },
      { label: 'Closing & Signature', met: true },
      { label: 'GWA or grade mentioned', met: false },
    ],
    sentiment: 'negative',
    sentimentScore: 31,
    sentimentKeywords: [
      { word: 'difficult time', type: 'negative' },
      { word: 'overwhelmed', type: 'negative' },
      { word: 'unable', type: 'negative' },
      { word: 'struggling', type: 'negative' },
      { word: 'failing', type: 'negative' },
      { word: 'hoping', type: 'neutral' },
    ],
    excerpt: 'I am having a very difficult time this semester. I feel overwhelmed and unable to keep up with all my requirements...',
    fullText: 'To the Kalingan Foundation,\n\nI am Isabel Martinez, AS-2026-001241. I am having a very difficult time...',
    staffStatus: 'returned',
    staffComment: 'Please revise: letter is below word count, missing academic update and community service summary. Also please mention your current GWA.',
    riskFlag: true,
  },
  {
    id: 'L003',
    scholarId: 'AS-2026-001010',
    scholarName: 'Ana Santos',
    yearLevel: 'Grade 11',
    submittedDate: 'Jun 14, 2026',
    type: 'Monthly Progress Report - June 2026',
    wordCount: 356,
    completenessScore: 88,
    completenessItems: [
      { label: 'Minimum word count (300+)', met: true },
      { label: 'Scholar ID & Name', met: true },
      { label: 'Reporting period stated', met: true },
      { label: 'Academic update included', met: true },
      { label: 'Community service mentioned', met: true },
      { label: 'Proper salutation', met: true },
      { label: 'Closing & Signature', met: false },
      { label: 'GWA or grade mentioned', met: true },
    ],
    sentiment: 'positive',
    sentimentScore: 76,
    sentimentKeywords: [
      { word: 'thankful', type: 'positive' },
      { word: 'progressing', type: 'positive' },
      { word: 'participated', type: 'positive' },
      { word: 'maintained', type: 'neutral' },
    ],
    excerpt: 'I am thankful for this scholarship. I have been progressing well in my studies and have maintained my grades...',
    fullText: 'Dear Kalingan Foundation,\n\nI am Ana Santos, scholar AS-2026-001010...',
    staffStatus: 'approved',
    staffComment: null,
    riskFlag: false,
  },
  {
    id: 'L004',
    scholarId: 'AS-2026-001242',
    scholarName: 'Roberto Cruz',
    yearLevel: '3rd Year College',
    submittedDate: 'Apr 15, 2026',
    type: 'Monthly Progress Report - April 2026',
    wordCount: 318,
    completenessScore: 75,
    completenessItems: [
      { label: 'Minimum word count (300+)', met: true },
      { label: 'Scholar ID & Name', met: true },
      { label: 'Reporting period stated', met: true },
      { label: 'Academic update included', met: true },
      { label: 'Community service mentioned', met: false },
      { label: 'Proper salutation', met: true },
      { label: 'Closing & Signature', met: true },
      { label: 'GWA or grade mentioned', met: false },
    ],
    sentiment: 'neutral',
    sentimentScore: 55,
    sentimentKeywords: [
      { word: 'attended', type: 'neutral' },
      { word: 'completed', type: 'neutral' },
      { word: 'reporting', type: 'neutral' },
    ],
    excerpt: 'I am reporting my progress for the month of April. I have attended my classes and completed some of my requirements...',
    fullText: 'To Kalingan Foundation,\n\nI am Roberto Cruz, scholar ID AS-2026-001242...',
    staffStatus: 'pending',
    staffComment: null,
    riskFlag: false,
  },
]; */

// ─── Config Maps ───────────────────────────────────────────────────────────

const sentimentCfg = {
  positive: { color: '#15803d', bg: '#dcfce7', label: 'Positive' },
  neutral:  { color: '#854d0e', bg: '#fef9c3', label: 'Neutral'  },
  negative: { color: '#991b1b', bg: '#fee2e2', label: 'Negative' },
};

const statusCfg = {
  pending:  { color: '#854d0e', bg: '#fef9c3', icon: Clock,       label: 'Pending Review' },
  approved: { color: '#15803d', bg: '#dcfce7', icon: CheckCircle, label: 'Approved'       },
  returned: { color: '#991b1b', bg: '#fee2e2', icon: XCircle,     label: 'Returned'       },
};

// ─── Letter Card ───────────────────────────────────────────────────────────

function LetterCard({ letter, onStatusChange }) {
  const [expanded, setExpanded] = useState(false);
  const [viewFull, setViewFull] = useState(false);
  const [comment, setComment] = useState(letter.staffComment || '');
  const [actionMode, setActionMode] = useState(null);

  const sc = sentimentCfg[letter.sentiment];
  const stc = statusCfg[letter.staffStatus];
  const StIcon = stc.icon;
  const completenessColor = letter.completenessScore >= 80 ? '#15803d' : letter.completenessScore >= 60 ? '#854d0e' : '#991b1b';

  const handleSubmit = () => {
    if (actionMode) {
      onStatusChange(letter.id, actionMode === 'approve' ? 'approved' : 'returned', comment);
      setActionMode(null);
    }
  };

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${letter.riskFlag ? 'border-red-300' : 'border-gray-200'}`}>
      <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-sm font-semibold" style={{ fontFamily: "'DM Sans', sans-serif", color: '#1a1a1a' }}>{letter.scholarName}</span>
            {letter.riskFlag && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                <AlertTriangle className="w-3 h-3" /> Risk Flag
              </span>
            )}
          </div>
          <p className="text-xs mb-0.5" style={{ fontFamily: "'DM Sans', sans-serif", color: '#6b7280' }}>
            {letter.scholarId} · {letter.yearLevel}
          </p>
          <p className="text-xs mb-1" style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151', fontWeight: 500 }}>{letter.type}</p>
          <p className="text-xs" style={{ fontFamily: "'DM Sans', sans-serif", color: '#9ca3af' }}>Submitted: {letter.submittedDate}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          {/* Completeness */}
          <div className="text-center px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-100">
            <p className="text-xs" style={{ fontFamily: "'DM Sans', sans-serif", color: '#6b7280' }}>Completeness</p>
            <p className="text-sm font-bold" style={{ fontFamily: "'DM Sans', sans-serif", color: completenessColor }}>{letter.completenessScore}%</p>
          </div>
          {/* Sentiment */}
          <div className="text-center px-3 py-1.5 rounded-lg" style={{ backgroundColor: sc.bg }}>
            <p className="text-xs" style={{ fontFamily: "'DM Sans', sans-serif", color: '#6b7280' }}>Sentiment</p>
            <p className="text-sm font-bold" style={{ fontFamily: "'DM Sans', sans-serif", color: sc.color }}>{sc.label}</p>
          </div>
          {/* Status */}
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg" style={{ backgroundColor: stc.bg }}>
            <StIcon className="w-3.5 h-3.5" style={{ color: stc.color }} />
            <span className="text-xs font-medium" style={{ fontFamily: "'DM Sans', sans-serif", color: stc.color }}>{stc.label}</span>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151', background: '#fff', cursor: 'pointer' }}
          >
            <Eye className="w-3.5 h-3.5" />
            Review
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-5 space-y-4">
          {/* Excerpt */}
          <div>
            <p className="text-xs font-semibold mb-1" style={{ fontFamily: "'DM Sans', sans-serif", color: '#6b7280' }}>LETTER EXCERPT</p>
            <p className="text-sm italic" style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151' }}>"{letter.excerpt}"</p>
            <button
              onClick={() => setViewFull(!viewFull)}
              className="text-xs mt-1 underline"
              style={{ color: '#802B36', fontFamily: "'DM Sans', sans-serif", background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              {viewFull ? 'Show less' : 'View full letter'}
            </button>
            {viewFull && (
              <pre className="mt-2 text-sm whitespace-pre-wrap p-3 rounded-lg bg-gray-50 border border-gray-100" style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151' }}>
                {letter.fullText}
              </pre>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Completeness Check */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="w-3.5 h-3.5" style={{ color: '#802B36' }} />
                <span className="text-xs font-semibold" style={{ fontFamily: "'DM Sans', sans-serif", color: '#1a1a1a' }}>
                  Completeness Check — Kalingan Foundation Metrics
                </span>
              </div>
              <div className="space-y-1.5">
                {letter.completenessItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {item.met
                      ? <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                      : <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    }
                    <span className="text-xs" style={{ fontFamily: "'DM Sans', sans-serif", color: item.met ? '#374151' : '#991b1b' }}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs mt-1" style={{ fontFamily: "'DM Sans', sans-serif", color: '#6b7280' }}>
                Word count: {letter.wordCount} words
              </p>
            </div>

            {/* Sentiment Keywords */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <MessageSquare className="w-3.5 h-3.5" style={{ color: '#802B36' }} />
                <span className="text-xs font-semibold" style={{ fontFamily: "'DM Sans', sans-serif", color: '#1a1a1a' }}>
                  NLP Sentiment Analysis — Score: {letter.sentimentScore}/100
                </span>
              </div>
              <div className="mb-2">
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${letter.sentimentScore}%`,
                    backgroundColor: letter.sentimentScore >= 70 ? '#22c55e' : letter.sentimentScore >= 40 ? '#f59e0b' : '#ef4444'
                  }} />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {letter.sentimentKeywords.map((kw, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      backgroundColor: kw.type === 'positive' ? '#dcfce7' : kw.type === 'negative' ? '#fee2e2' : '#f3f4f6',
                      color: kw.type === 'positive' ? '#15803d' : kw.type === 'negative' ? '#991b1b' : '#374151'
                    }}>
                    {kw.word}
                  </span>
                ))}
              </div>
              <p className="text-xs mt-2" style={{ fontFamily: "'DM Sans', sans-serif", color: '#6b7280' }}>
                Overall: <strong style={{ color: sc.color }}>{sc.label}</strong>
              </p>
            </div>
          </div>

          {/* Staff Comment */}
          {letter.staffComment && (
            <div className="p-3 rounded-lg" style={{ backgroundColor: '#fef9c3' }}>
              <p className="text-xs font-semibold mb-1" style={{ fontFamily: "'DM Sans', sans-serif", color: '#854d0e' }}>Previous Staff Comment:</p>
              <p className="text-xs" style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151' }}>{letter.staffComment}</p>
            </div>
          )}

          {/* Actions */}
          {letter.staffStatus === 'pending' && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold mb-2" style={{ fontFamily: "'DM Sans', sans-serif", color: '#1a1a1a' }}>Final Review Action</p>
              {!actionMode ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setActionMode('approve')}
                    className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg text-white"
                    style={{ backgroundColor: '#22c55e', fontFamily: "'DM Sans', sans-serif", border: 'none', cursor: 'pointer' }}
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button
                    onClick={() => setActionMode('return')}
                    className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg text-white"
                    style={{ backgroundColor: '#ef4444', fontFamily: "'DM Sans', sans-serif", border: 'none', cursor: 'pointer' }}
                  >
                    <XCircle className="w-3.5 h-3.5" /> Return for Revision
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs" style={{ fontFamily: "'DM Sans', sans-serif", color: '#6b7280' }}>
                    {actionMode === 'approve' ? 'Add approval note (optional):' : 'Reason for returning (required):'}
                  </p>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder={actionMode === 'approve' ? 'Optional approval note...' : 'Explain what needs to be revised...'}
                    className="w-full text-sm p-3 rounded-lg border border-gray-200 outline-none resize-none"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSubmit}
                      className="text-xs font-medium px-4 py-2 rounded-lg text-white"
                      style={{ backgroundColor: actionMode === 'approve' ? '#22c55e' : '#ef4444', fontFamily: "'DM Sans', sans-serif", border: 'none', cursor: 'pointer' }}
                    >
                      Confirm {actionMode === 'approve' ? 'Approval' : 'Return'}
                    </button>
                    <button
                      onClick={() => setActionMode(null)}
                      className="text-xs px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                      style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151', background: '#fff', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────

import axios from 'axios';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '').replace(/\/api$/, '');
const authConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

const normalizeStatus = status => status === 'rejected' ? 'returned' : status || 'pending';
const formatDate = value => value ? new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown date';
const getWordCount = text => String(text || '').trim().split(/\s+/).filter(Boolean).length;
const getSentiment = (label, score) => {
  const normalizedLabel = String(label || '').toLowerCase();
  const numericScore = Number(score);
  const scoreOutOf100 = numericScore >= -1 && numericScore <= 1
    ? Math.round((numericScore + 1) * 50)
    : Math.round(Math.max(0, Math.min(100, numericScore || 0)));
  const sentiment = ['positive', 'negative', 'neutral'].includes(normalizedLabel)
    ? normalizedLabel
    : scoreOutOf100 >= 70 ? 'positive' : scoreOutOf100 < 40 ? 'negative' : 'neutral';
  return { sentiment, score: scoreOutOf100 };
};

const mapLetter = row => {
  const fullText = row.letter_content || '';
  const wordCount = getWordCount(fullText);
  const completenessScore = Number(row.quality_score ?? 0);
  const sentiment = getSentiment(row.sentiment_label, row.sentiment_score);
  return {
    id: row.id,
    scholarId: row.scholar_id || 'Unknown scholar',
    scholarName: row.full_name || 'Unknown scholar',
    yearLevel: row.year_level || 'Year level not set',
    submittedDate: formatDate(row.submitted_at),
    type: 'Monthly Progress Report',
    wordCount,
    completenessScore,
    completenessItems: [
      { label: 'Letter body provided', met: wordCount > 0 },
      { label: 'Minimum word count (300+)', met: wordCount >= 300 },
      { label: 'Quality evaluation available', met: row.quality_score !== null && row.quality_score !== undefined },
    ],
    sentiment: sentiment.sentiment,
    sentimentScore: sentiment.score,
    sentimentKeywords: [],
    excerpt: fullText.slice(0, 240),
    fullText,
    staffStatus: normalizeStatus(row.status),
    staffComment: row.staff_comment || null,
    riskFlag: sentiment.sentiment === 'negative' || row.quality_status === 'high_risk',
  };
};

export function CorrespondenceReview() {
  const [letterList, setLetterList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sentimentFilter, setSentimentFilter] = useState('all');

  const loadLetters = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_BASE}/api/submission/letters`, authConfig());
      setLetterList((response.data || []).map(mapLetter));
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not load correspondence submissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      await loadLetters();
    };
    load();
  }, []);

  const handleStatusChange = async (id, status, comment) => {
    try {
      await axios.put(`${API_BASE}/api/submission/review/${id}`, {
        status: status === 'returned' ? 'rejected' : status,
        staff_comment: comment || null,
      }, authConfig());
      setLetterList(list => list.map(letter => letter.id === id
        ? { ...letter, staffStatus: status, staffComment: comment || null }
        : letter));
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not save the review decision.');
    }
  };

  const filtered = letterList.filter(l => {
    const sm = statusFilter === 'all' || l.staffStatus === statusFilter;
    const sn = sentimentFilter === 'all' || l.sentiment === sentimentFilter;
    return sm && sn;
  });

  const pending = letterList.filter(l => l.staffStatus === 'pending').length;
  const negativeSent = letterList.filter(l => l.sentiment === 'negative').length;

  const exportCSV = () => {
    const rows = [['ID', 'Scholar', 'Type', 'Date', 'Completeness', 'Sentiment', 'Score', 'Status']];
    letterList.forEach(l => rows.push([l.scholarId, l.scholarName, l.type, l.submittedDate, `${l.completenessScore}%`, l.sentiment, `${l.sentimentScore}/100`, l.staffStatus]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'correspondence_review.csv';
    a.click();
    URL.revokeObjectURL(url);
    // Best-effort server log
    axios.post(`${(import.meta.env?.VITE_API_URL || 'http://localhost:5000').replace(/\/+/g, '').replace(/\/api$/, '')}/api/export/google-sheets`, { log_only: true, module: 'Correspondence Review', report_resource: 'Correspondence Review Export', spreadsheet_title: 'Correspondence Review Export', details: 'correspondence_review.csv' }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).catch(() => {});
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="mb-1" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.75rem', fontWeight: 700, color: '#1a1a1a' }}>
            Correspondence Review
          </h1>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem', color: '#6b7280' }}>
            Review scholar letters — NLP sentiment analysis & completeness check
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex-shrink-0"
          style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151', background: '#fff', cursor: 'pointer' }}
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {error && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={loadLetters} className="font-semibold underline" type="button">Retry</button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center shadow-sm">
          <p className="text-xl font-bold" style={{ fontFamily: "'DM Sans', sans-serif", color: '#1a1a1a' }}>{letterList.length}</p>
          <p className="text-xs text-gray-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>Total Letters</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-100 p-3 text-center shadow-sm">
          <p className="text-xl font-bold text-amber-700" style={{ fontFamily: "'DM Sans', sans-serif" }}>{pending}</p>
          <p className="text-xs text-amber-600" style={{ fontFamily: "'DM Sans', sans-serif" }}>Pending Review</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-100 p-3 text-center shadow-sm">
          <p className="text-xl font-bold text-red-700" style={{ fontFamily: "'DM Sans', sans-serif" }}>{negativeSent}</p>
          <p className="text-xs text-red-600" style={{ fontFamily: "'DM Sans', sans-serif" }}>Negative Sentiment</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-100 p-3 text-center shadow-sm">
          <p className="text-xl font-bold text-green-700" style={{ fontFamily: "'DM Sans', sans-serif" }}>{letterList.filter(l => l.staffStatus === 'approved').length}</p>
          <p className="text-xs text-green-600" style={{ fontFamily: "'DM Sans', sans-serif" }}>Approved</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="flex gap-1">
          {['all', 'pending', 'approved', 'returned'].map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className="text-xs px-3 py-1.5 rounded-lg border capitalize transition-all"
              style={{ fontFamily: "'DM Sans', sans-serif", backgroundColor: statusFilter === f ? '#802B36' : '#fff', color: statusFilter === f ? '#fff' : '#374151', borderColor: statusFilter === f ? '#802B36' : '#e5e7eb', cursor: 'pointer' }}>
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {['all', 'positive', 'neutral', 'negative'].map(f => (
            <button key={f} onClick={() => setSentimentFilter(f)}
              className="text-xs px-3 py-1.5 rounded-lg border capitalize transition-all"
              style={{ fontFamily: "'DM Sans', sans-serif", backgroundColor: sentimentFilter === f ? '#374151' : '#fff', color: sentimentFilter === f ? '#fff' : '#374151', borderColor: sentimentFilter === f ? '#374151' : '#e5e7eb', cursor: 'pointer' }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {loading && (
          <div className="text-center py-10 bg-white rounded-xl border border-gray-200">
            <p style={{ fontFamily: "'DM Sans', sans-serif", color: '#6b7280' }}>Loading correspondence submissions...</p>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-10 bg-white rounded-xl border border-gray-200">
            <Mail className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p style={{ fontFamily: "'DM Sans', sans-serif", color: '#6b7280' }}>No letters match this filter</p>
          </div>
        )}
        {filtered.map(l => (
          <LetterCard key={l.id} letter={l} onStatusChange={handleStatusChange} />
        ))}
      </div>
    </div>
  );
}
export default CorrespondenceReview;