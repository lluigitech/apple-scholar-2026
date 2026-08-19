import { useState, useEffect } from 'react';
import axios from 'axios';
import { Download, Eye, ChevronDown, ChevronUp, CheckCircle, XCircle, AlertTriangle, RefreshCw, FileX, ExternalLink } from 'lucide-react';
import FilePreviewModal from '../../components/Officer/ManualValidation/FilePreviewModal';
import { fileKind } from '../../utils/submissionHelpers';

const API = 'http://localhost:5000/api';

// ─── Transform DB row → UI shape ───────────────────────────────
const normalizeYearLevel = (value) => {
    if (!value) return '—';
    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'grade 7' || normalized === 'grade_7' || normalized === 'g7') return 'Grade 7';
    if (normalized === 'grade 8' || normalized === 'grade_8' || normalized === 'g8') return 'Grade 8';
    if (normalized === 'grade 9' || normalized === 'grade_9' || normalized === 'g9') return 'Grade 9';
    if (normalized === 'grade 10' || normalized === 'grade_10' || normalized === 'g10') return 'Grade 10';
    if (normalized === 'grade 11' || normalized === 'grade_11' || normalized === 'g11') return 'Grade 11';
    if (normalized === 'grade 12' || normalized === 'grade_12' || normalized === 'g12') return 'Grade 12';
    if (normalized === '1st year college' || normalized === '1st year' || normalized === 'college_1' || normalized === 'college 1' || normalized === '1y') return '1st Year College';
    if (normalized === '2nd year college' || normalized === '2nd year' || normalized === 'college_2' || normalized === 'college 2' || normalized === '2y') return '2nd Year College';
    if (normalized === '3rd year college' || normalized === '3rd year' || normalized === 'college_3' || normalized === 'college 3' || normalized === '3y') return '3rd Year College';
    if (normalized === '4th year college' || normalized === '4th year' || normalized === 'college_4' || normalized === 'college 4' || normalized === '4y') return '4th Year College';
    if (normalized === '5th year college' || normalized === '5th year' || normalized === 'college_5' || normalized === 'college 5' || normalized === '5y') return '5th Year College';
    return value;
};

const transformLetter = (row) => {
    const wordCount = (row.letter_content || '').trim().split(/\s+/).filter(Boolean).length;

    // ensure numeric values are numbers (DB may return strings)
    const completenessScore = Number(row.quality_score) || 0; // 0-100

    // sentiment_score stored as -1 to 1 → convert to 0-100 for UI
    const rawSentiment = row.sentiment_score !== null && row.sentiment_score !== undefined
        ? parseFloat(row.sentiment_score)
        : 0;
    const sentimentScore = Math.round((rawSentiment + 1) * 50);

    const labelLower = (row.sentiment_label || '').toLowerCase();
    const sentiment = labelLower.includes('negative') ? 'negative'
        : labelLower.includes('positive') ? 'positive'
        : 'neutral';

    // keyConcerns may be stored as JSON string (optional)
    let keyConcerns = [];
    try {
        if (row.key_concerns) {
            keyConcerns = typeof row.key_concerns === 'string' ? JSON.parse(row.key_concerns) : row.key_concerns;
            if (!Array.isArray(keyConcerns)) keyConcerns = [];
        }
    } catch (e) {
        keyConcerns = [];
    }

    return {
        id: `EL${row.id}`,
        rawId: row.id,
        scholarId: row.scholar_id,
        scholarName: row.full_name || row.scholar_id || 'Unknown',
        yearLevel: normalizeYearLevel(row.year_level),
        type: 'Monthly Progress Report',
        submittedDate: row.submitted_at
            ? new Date(row.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : '—',
        wordCount,
        completenessScore,
        completenessBreakdown: [
            { metric: 'Minimum length (150+ words)', score: wordCount >= 150 ? 15 : 0, max: 15, met: wordCount >= 150 },
            { metric: 'Overall Quality Score', score: completenessScore, max: 100, met: completenessScore >= 71 },
        ],
        sentimentScore,
        sentiment,
        keyConcerns,
        generatedPdfPath: row.generated_pdf_path || null,
        staffStatus: row.status,
        adminNote: row.staff_comment || '',
    };
};

const sentimentCfg = {
    positive: { color: '#15803d', bg: '#dcfce7' },
    neutral: { color: '#854d0e', bg: '#fef9c3' },
    negative: { color: '#991b1b', bg: '#fee2e2' },
};

const EvalCard = ({ letter, onSaveNote, onPreview, onGeneratePdf, generatingPdfId }) => {

    const [expanded, setExpanded] = useState(false);
    const [adminNote, setAdminNote] = useState(letter.adminNote || '');
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);

    const sc = sentimentCfg[letter.sentiment];
    const completenessColor = letter.completenessScore >= 80 ? '#15803d' : letter.completenessScore >= 60 ? '#854d0e' : '#991b1b';
    const cardBorder = letter.completenessScore >= 80 ? 'border-green-300' : letter.completenessScore >= 60 ? 'border-amber-200' : 'border-red-300';

    const handleSave = async () => {
        if (!adminNote.trim()) return;
        try {
            setSaving(true);
            await onSaveNote(letter.rawId, adminNote);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${cardBorder}`}>
            <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-sm font-semibold" style={{ fontFamily: "'DM Sans', sans-serif", color: '#1a1a1a' }}>{letter.scholarName}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: cardBorder.includes('green') ? '#dcfce7' : cardBorder.includes('amber') ? '#fef3c7' : '#fee2e2', color: cardBorder.includes('green') ? '#15803d' : cardBorder.includes('amber') ? '#854d0e' : '#991b1b', fontFamily: "'DM Sans', sans-serif" }}>
                            Quality Review
                        </span>
                    </div>
                    <p className="text-xs mb-0.5" style={{ fontFamily: "'DM Sans', sans-serif", color: '#6b7280' }}>{letter.scholarId} · {letter.yearLevel}</p>
                    <p className="text-xs font-medium mb-0.5" style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151' }}>{letter.type}</p>
                    <p className="text-xs" style={{ fontFamily: "'DM Sans', sans-serif", color: '#9ca3af' }}>Submitted: {letter.submittedDate} · {letter.wordCount} words</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                    <div className="text-center px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-100">
                        <p className="text-xs" style={{ fontFamily: "'DM Sans', sans-serif", color: '#6b7280' }}>Quality Score</p>
                        <p className="text-sm font-bold" style={{ fontFamily: "'DM Sans', sans-serif", color: completenessColor }}>{letter.completenessScore}%</p>
                    </div>
                    <div className="text-center px-3 py-1.5 rounded-lg" style={{ backgroundColor: sc.bg }}>
                        <p className="text-xs" style={{ fontFamily: "'DM Sans', sans-serif", color: '#6b7280' }}>Sentiment</p>
                        <p className="text-sm font-bold" style={{ fontFamily: "'DM Sans', sans-serif", color: sc.color }}>{letter.sentimentScore}/100</p>
                    </div>
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                        style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151' }}
                    >
                        <Eye className="w-3.5 h-3.5" />
                        Evaluate
                        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="border-t border-gray-100 p-5 space-y-5">
                    {letter.generatedPdfPath ? (
                        <div className="rounded-3xl border border-gray-200 bg-slate-50 p-4 shadow-sm">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500 font-black">Generated PDF</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-800">Letter template preview available</p>
                                </div>
                                <button onClick={() => onPreview(letter.generatedPdfPath, 'Generated PDF')}
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wide text-white"
                                    style={{ backgroundColor: '#802B36' }}>
                                    <ExternalLink size={14} /> Open PDF
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-3xl border border-gray-200 bg-slate-50 p-4 shadow-sm">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500 font-black">Generated PDF</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-800">No PDF generated yet</p>
                                </div>
                                <button onClick={() => onGeneratePdf(letter.rawId)}
                                    disabled={generatingPdfId === letter.rawId}
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wide text-white disabled:opacity-60"
                                    style={{ backgroundColor: generatingPdfId === letter.rawId ? '#94a3b8' : '#802B36' }}>
                                    {generatingPdfId === letter.rawId ? 'Generating...' : 'Generate PDF'}
                                </button>
                            </div>
                            <p className="mt-2 text-[11px] text-slate-500">Generate the letter PDF now so it can be previewed here.</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <h4 className="text-xs font-semibold mb-3" style={{ fontFamily: "'DM Sans', sans-serif", color: '#1a1a1a' }}>
                                Monthly Letter Quality Metrics
                            </h4>
                            <div className="space-y-2">
                                {letter.completenessBreakdown.map((item, i) => (
                                    <div key={i}>
                                        <div className="flex items-center justify-between mb-0.5">
                                            <div className="flex items-center gap-1.5">
                                                {item.met
                                                    ? <CheckCircle className="w-3 h-3 text-green-600" />
                                                    : <XCircle className="w-3 h-3 text-red-500" />
                                                }
                                                <span className="text-xs" style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151' }}>{item.metric}</span>
                                            </div>
                                            <span className="text-xs font-medium" style={{ fontFamily: "'DM Sans', sans-serif", color: item.met ? '#15803d' : '#991b1b' }}>
                                                {item.score}/{item.max}
                                            </span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full" style={{ width: `${(item.score / item.max) * 100}%`, backgroundColor: item.met ? '#22c55e' : '#ef4444' }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                        <div className="rounded-3xl border border-gray-100 bg-slate-50 p-4 h-full">
                            <p className="text-xs uppercase tracking-[0.24em] font-semibold text-slate-400 mb-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>Letter Summary</p>
                            <div className="grid gap-3 text-xs text-slate-600">
                                <div className="flex items-center justify-between gap-2">
                                    <span>Scholar ID</span>
                                    <span className="font-semibold text-slate-900 text-right">{letter.scholarId || '—'}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <span>Year Level</span>
                                    <span className="font-semibold text-slate-900 text-right">{letter.yearLevel}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <span>Type</span>
                                    <span className="font-semibold text-slate-900 text-right">{letter.type}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <span>Status</span>
                                    <span className="font-semibold text-slate-900 text-right capitalize">{letter.staffStatus || 'pending'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    </div>

                    {letter.keyConcerns.length > 0 && (
                        <div>
                            <h4 className="text-xs font-semibold mb-2" style={{ fontFamily: "'DM Sans', sans-serif", color: '#1a1a1a' }}>
                                Key Concerns
                            </h4>
                            <div className="space-y-2">
                                {letter.keyConcerns.map((concern, i) => (
                                    <div key={i} className="text-xs px-3 py-2 rounded-xl bg-slate-100 text-slate-700" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                        {concern}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="border-t border-gray-100 pt-4">
                        <h4 className="text-xs font-semibold mb-2" style={{ fontFamily: "'DM Sans', sans-serif", color: '#1a1a1a' }}>Admin Evaluation Note</h4>
                        <textarea
                            value={adminNote}
                            onChange={e => setAdminNote(e.target.value)}
                            placeholder="Add admin evaluation notes, intervention plan, or override recommendation..."
                            className="w-full text-sm p-3 rounded-lg border border-gray-200 outline-none focus:border-gray-400 resize-none"
                            style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151' }}
                            rows={3}
                        />
                        <button onClick={handleSave} disabled={saving}
                            className="mt-2 text-xs font-medium px-4 py-2 rounded-lg text-white disabled:opacity-60"
                            style={{ backgroundColor: '#802B36', fontFamily: "'DM Sans', sans-serif" }}>
                            {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Note'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const transformScholar = (s) => {
    // Look for year_level across ALL submission types (letters, report cards, CORs, etc.)
    let scholarYearLevel = '—';
    const allSubmissions = [
        ...(s.monthly_letters || []),
        ...(s.report_cards || []),
        ...(s.cors || []),
        ...(s.other_documents || [])
    ];
    
    // Find the first submission with a valid year_level
    for (const submission of allSubmissions) {
        if (submission.year_level && submission.year_level !== '—') {
            scholarYearLevel = submission.year_level;
            break;
        }
    }
    
    // Enrich each letter row with scholar context before transforming
    const letters = (s.monthly_letters || []).map(letter => 
        transformLetter({ 
            ...letter, 
            scholar_id: s.scholar_id, 
            full_name: s.full_name,
            year_level: letter.year_level || scholarYearLevel  // Ensure year_level is set
        })
    );

    // aggregate
    const totalLetters = letters.length;
    const avgSentiment = totalLetters ? Math.round(letters.reduce((sum, l) => sum + l.sentimentScore, 0) / totalLetters) : 0;
    const avgCompleteness = totalLetters ? Math.round(letters.reduce((sum, l) => sum + l.completenessScore, 0) / totalLetters) : 0;
    return {
        scholar_id: s.scholar_id,
        full_name: s.full_name || 'Unknown',
        year_level: normalizeYearLevel(scholarYearLevel),
        totalLetters,
        avgSentiment,
        avgCompleteness,
        letters,
    };
};

const ScholarCard = ({ scholar, onSaveNote, onPreview, onGeneratePdf, generatingPdfId }) => {
    const [open, setOpen] = useState(false);

    return (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="text-sm font-semibold">{scholar.full_name}</div>
                        <div className="text-xs text-gray-500">{scholar.scholar_id} · {scholar.year_level}</div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{scholar.totalLetters} letters · Avg Sentiment {scholar.avgSentiment} · Avg Completeness {scholar.avgCompleteness}%</div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setOpen(!open)} className="text-sm px-3 py-1.5 rounded-lg border border-gray-200">{open ? 'Hide history' : 'View history'}</button>
                </div>
            </div>
            {open && (
                <div className="mt-4 space-y-3">
                    {scholar.letters.map(l => (
                        <EvalCard
                            key={l.id}
                            letter={l}
                            onSaveNote={onSaveNote}
                            onPreview={onPreview}
                            onGeneratePdf={onGeneratePdf}
                            generatingPdfId={generatingPdfId}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const CorrespondenceEvaluator = () => {
    const [scholars, setScholars] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [gradeFilter, setGradeFilter] = useState('all');
    const [generatingPdfId, setGeneratingPdfId] = useState(null);
    const [filePreview, setFilePreview] = useState(null);

    const fetchScholars = async () => {
        try {
            setLoading(true);
            setError('');
            const res = await axios.get(`${API}/submission/scholar-view`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
            setScholars(res.data.map(transformScholar));
        } catch (err) {
            console.error(err);
            setError('Failed to load correspondence data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchScholars(); }, []);

    const handleSaveNote = async (submissionId, note) => {
        await axios.put(`${API}/submission/review/${submissionId}`, { status: 'pending', staff_comment: note }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        // update local state
        setScholars(prev => prev.map(s => ({
            ...s,
            letters: s.letters.map(l => l.rawId === submissionId ? { ...l, adminNote: note } : l)
        })));
    };

    const handleGeneratePdf = async (submissionId) => {
        setGeneratingPdfId(submissionId);
        try {
            await axios.get(`${API}/submission/generate-pdf/${submissionId}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
            await fetchScholars();
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

    const gradeOptions = [
        'all',
        'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10',
        'Grade 11', 'Grade 12',
        '1st Year College', '2nd Year College', '3rd Year College', '4th Year College', '5th Year College'
    ];

    // Apply filters: search (name/ID) and grade
    const filtered = scholars.filter(s => {
        const matchesSearch = searchQuery === '' || 
            s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.scholar_id.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesGrade = gradeFilter === 'all' || s.year_level === gradeFilter;
        return matchesSearch && matchesGrade;
    });

    const totalLetters = filtered.reduce((sum, s) => sum + s.totalLetters, 0);
    const avgSentiment = filtered.length ? Math.round(filtered.reduce((sum, s) => sum + s.avgSentiment, 0) / filtered.length) : 0;
    const avgCompleteness = filtered.length ? Math.round(filtered.reduce((sum, s) => sum + s.avgCompleteness, 0) / filtered.length) : 0;

    const exportCSV = () => {
        const rows = [['ScholarID','Scholar','TotalLetters','AvgCompleteness','AvgSentiment']];
        filtered.forEach(s => rows.push([s.scholar_id, s.full_name, String(s.totalLetters), String(s.avgCompleteness), String(s.avgSentiment)]));
        const csv = rows.map(r => r.map(f => `"${f}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'correspondence_by_scholar.csv'; a.click(); URL.revokeObjectURL(url);
        axios.post(`${API}/export/google-sheets`, { log_only: true, module: 'Correspondence Evaluator', report_resource: 'Correspondence Export', spreadsheet_title: 'correspondence_by_scholar.csv', details: 'correspondence_by_scholar.csv' }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).catch(() => {});
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="grid gap-4 lg:grid-cols-[1.8fr_1fr] mb-6">
                <div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="mb-1" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.75rem', fontWeight: 700, color: '#1a1a1a' }}>
                                Correspondence Evaluation
                            </h1>
                            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.95rem', color: '#6b7280' }}>
                                One card per scholar · expand to view history
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button onClick={fetchScholars} className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 shadow-sm" style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151' }}>
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                            </button>
                            <button onClick={exportCSV} className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-2xl border border-gray-200 bg-[#f8f5f5] hover:bg-[#f1eeed] shadow-sm" style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151' }}>
                                <Download className="w-4 h-4" /> Export
                            </button>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[1fr_280px] mt-5">
                        <input
                            type="text"
                            placeholder="Search by scholar name or ID..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full text-sm px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:border-gray-400 shadow-sm"
                            style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151' }}
                        />
                        <div className="grid gap-3 sm:grid-cols-2">
                            <select
                                value={gradeFilter}
                                onChange={e => setGradeFilter(e.target.value)}
                                className="w-full text-sm px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:border-gray-400 shadow-sm"
                                style={{ fontFamily: "'DM Sans', sans-serif", backgroundColor: '#fff', color: '#374151' }}
                            >
                                <option value="all">All Grades</option>
                                {gradeOptions.filter(g => g !== 'all').map(grade => (
                                    <option key={grade} value={grade}>{grade}</option>
                                ))}
                            </select>
                            <button onClick={() => setSearchQuery('')} className="w-full text-sm font-medium px-4 py-3 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 shadow-sm" style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151' }}>
                                Clear Filters
                            </button>
                        </div>
                    </div>

                    <p className="mt-3 text-xs text-slate-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                        Showing {filtered.length} of {scholars.length} scholars
                    </p>
                </div>

                {!loading && !error && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3 h-full">
                        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-5 text-center">
                            <p className="text-3xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: '#1a1a1a' }}>{totalLetters}</p>
                            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400 mt-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Letters Evaluated</p>
                        </div>
                        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-5 text-center">
                            <p className="text-3xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: avgSentiment >= 60 ? '#15803d' : avgSentiment >= 40 ? '#854d0e' : '#991b1b' }}>{avgSentiment}</p>
                            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400 mt-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Avg Sentiment</p>
                        </div>
                        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-5 text-center">
                            <p className="text-3xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: avgCompleteness >= 80 ? '#15803d' : '#854d0e' }}>{avgCompleteness}%</p>
                            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400 mt-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Avg Completeness</p>
                        </div>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="space-y-3">
                    {Array(3).fill(0).map((_, i) => (
                        <div key={i} className="animate-pulse bg-white rounded-xl h-20 border border-gray-100" />
                    ))}
                </div>
            ) : error ? (
                <div className="bg-red-50 border border-red-100 rounded-xl p-8 text-center">
                    <AlertTriangle size={28} className="mx-auto mb-2 text-red-400" />
                    <p className="text-sm font-bold text-red-600">{error}</p>
                    <button onClick={fetchScholars} className="mt-3 text-xs font-black text-red-500 underline">Try again</button>
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 flex flex-col items-center justify-center py-16">
                    <FileX size={40} strokeWidth={1} className="text-gray-200 mb-2" />
                    <p className="text-sm font-bold text-gray-400">No scholars found.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filtered.map(s => <ScholarCard key={s.scholar_id} scholar={s} onSaveNote={handleSaveNote} onPreview={handlePreview} onGeneratePdf={handleGeneratePdf} generatingPdfId={generatingPdfId} />)}
                </div>
            )}

            {filePreview && (
                <FilePreviewModal preview={filePreview} onClose={() => setFilePreview(null)} />
            )}
        </div>
    );
};

export default CorrespondenceEvaluator;