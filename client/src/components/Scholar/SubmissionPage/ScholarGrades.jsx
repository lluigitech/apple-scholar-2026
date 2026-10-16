import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { uploadResumableFile } from '../../../utils/resumableUpload';
import {
    BookOpen, Plus, Trash2, Send, CheckCircle, AlertTriangle,
    ChevronDown, ChevronUp, Lock, GraduationCap, Loader2, Camera, X, RotateCcw,
    CheckCircle2, Circle, FileText,
} from 'lucide-react';

// ── Design tokens — Apple Scholar Portal system ──
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const PRIMARY = '#6D2140';
const PRIMARY_DEEP = '#4A1730';
const PRIMARY_TINT = 'rgba(109, 33, 64, 0.08)';
const BRONZE = '#A9784E';
const INK = '#241512';
const MUTED = '#8A7A68';
const SUCCESS = '#6B8F71';
const DANGER = '#C0473F';
const WARNING = '#C08A3E';

const display = { fontFamily: "'Playfair Display', Georgia, serif" };
const body = { fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif" };

const API = 'http://localhost:5000/api/submission';

const SEMESTERS  = ['1st Sem', '2nd Sem', 'Summer'];
const ACAD_YEARS = ['2023-2024', '2024-2025', '2025-2026', '2026-2027'];

const YEAR_LEVEL_LABELS = {
    grade_7: 'Grade 7', grade_8: 'Grade 8', grade_9: 'Grade 9', grade_10: 'Grade 10',
    grade_11: 'Grade 11', grade_12: 'Grade 12',
    college_1: '1st Year College', college_2: '2nd Year College', college_3: '3rd Year College',
    college_4: '4th Year College', college_5: '5th Year College',
};

const emptySubject = () => ({
    key: Math.random().toString(36).slice(2),
    subject_name: '',
    units: 3,
    grade: '',
});

const authHeader = () => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
};

const AlertStrip = ({ color, icon: Icon, title, children }) => (
    <div className="flex items-start gap-2" style={{ borderLeft: `3px solid ${color}`, background: `${color}0d`, borderRadius: 8, padding: '10px 14px' }}>
        {Icon && <Icon size={13} className="shrink-0 mt-0.5" style={{ color }} />}
        <div>
            {title && <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', color, marginBottom: 3, textTransform: 'uppercase' }}>{title}</p>}
            <p style={{ ...body, fontSize: '0.79rem', color, lineHeight: 1.5 }}>{children}</p>
        </div>
    </div>
);

const StatusBadge = ({ status }) => {
    const cfg = {
        passed:  { color: SUCCESS, label: 'Passed' },
        failed:  { color: DANGER,  label: 'Failed' },
        pending: { color: WARNING, label: 'Pending' },
    }[status] || { color: MUTED, label: status };
    return (
        <span style={{ ...body, fontSize: '0.68rem', fontWeight: 700, color: cfg.color, background: `${cfg.color}14`, padding: '3px 10px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
            {cfg.label}
        </span>
    );
};

const ReviewBadge = ({ status }) => {
    const cfg = {
        approved: { color: SUCCESS, label: 'Approved' },
        rejected: { color: DANGER,  label: 'Rejected' },
        pending:  { color: WARNING, label: 'Pending Review' },
    }[status] || { color: MUTED, label: status || 'Pending Review' };
    return (
        <span style={{ ...body, fontSize: '0.68rem', fontWeight: 700, color: cfg.color, background: `${cfg.color}14`, padding: '3px 10px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
            {cfg.label}
        </span>
    );
};

const ChecklistRow = ({ done, label }) => (
    <div className="flex items-center gap-2.5">
        {done ? <CheckCircle2 size={16} style={{ color: SUCCESS, flexShrink: 0 }} /> : <Circle size={16} style={{ color: BORDER, flexShrink: 0 }} />}
        <span style={{ ...body, fontSize: '0.82rem', color: done ? INK : MUTED, fontWeight: done ? 600 : 500 }}>{label}</span>
    </div>
);

const ScholarGrades = () => {
    const scholarId = localStorage.getItem('scholar_id');

    // ── Grading system auto-detection ──
    // Reads the same `year_level` value already stored in localStorage by
    // the rest of the Scholar module (see ScholarNotification.jsx). If it's
    // missing or unrecognized, this defaults to GWA — the exact behavior
    // the original form always had — so nothing changes for scholars whose
    // level we can't determine.
    const rawYearLevel = localStorage.getItem('year_level') || '';
    const isSHS = rawYearLevel.startsWith('grade_');
    const gradingSystem = isSHS ? 'percentage' : 'gwa';
    const yearLevelLabel = YEAR_LEVEL_LABELS[rawYearLevel] || 'Not set';

    const gradeBounds = gradingSystem === 'gwa'
        ? { min: 1.00, max: 5.00, step: 0.25, placeholder: 'GWA (1.00–5.00)' }
        : { min: 0, max: 100, step: 1, placeholder: 'Percentage (0–100)' };

    const gradeLabel = gradingSystem === 'gwa' ? 'General Weighted Average (GWA)' : 'Percentage Grade';
    const averageLabel = gradingSystem === 'gwa' ? 'Computed GWA (Preview)' : 'Computed Average (Preview)';
    const summaryAverageLabel = gradingSystem === 'gwa' ? 'General Weighted Average' : 'General Average';

    const [grades, setGrades]               = useState([]);
    const [loading, setLoading]              = useState(true);
    const [expandedSem, setExpandedSem]      = useState(null);

    const [semester, setSemester]            = useState('1st Sem');
    const [academicYear, setAcademicYear]    = useState('2025-2026');
    const [subjects, setSubjects]            = useState([emptySubject(), emptySubject()]);
    const [checkingLock, setCheckingLock]    = useState(false);
    const [isLocked, setIsLocked]            = useState(false);
    const [lockInfo, setLockInfo]            = useState({ status: null, staff_comment: null });
    const [submitting, setSubmitting]        = useState(false);
    const [error, setError]                  = useState('');
    const [success, setSuccess]              = useState('');
    const [proofFile, setProofFile]          = useState(null);
    const [proofPreview, setProofPreview]    = useState(null);

    const fetchGrades = async () => {
        if (!scholarId) return;
        setLoading(true);
        try {
            const res = await axios.get(`${API}/grades/${scholarId}`, {
                headers: authHeader(),
            });
            setGrades(res.data);
        } catch (err) {
            console.error('Error fetching grades:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchGrades(); }, [scholarId]);

    useEffect(() => {
        if (!scholarId) return;
        const checkLock = async () => {
            setCheckingLock(true);
            try {
                const res = await axios.get(`${API}/grades/${scholarId}/check/${semester}/${academicYear}`, {
                    headers: authHeader(),
                });
                setIsLocked(res.data.locked);
                setLockInfo({ status: res.data.status || null, staff_comment: res.data.staff_comment || null });
            } catch (err) {
                console.error(err);
            } finally {
                setCheckingLock(false);
            }
        };
        checkLock();
    }, [scholarId, semester, academicYear]);

    const setSubjectField = (key, field, value) => {
        setSubjects(prev => prev.map(s => s.key === key ? { ...s, [field]: value } : s));
    };

    const addSubjectRow = () => setSubjects(prev => [...prev, emptySubject()]);
    const removeSubjectRow = (key) => {
        if (subjects.length <= 1) return;
        setSubjects(prev => prev.filter(s => s.key !== key));
    };

    const handleProofChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setProofFile(file);
        setProofPreview(URL.createObjectURL(file));
    };

    const removeProof = () => {
        setProofFile(null);
        if (proofPreview) URL.revokeObjectURL(proofPreview);
        setProofPreview(null);
    };

    // Live average preview — same weighted formula as before; only the
    // label changes depending on grading system.
    const filledSubjects = subjects.filter(s => s.subject_name && s.units && s.grade !== '');
    const previewAverage = (() => {
        if (filledSubjects.length === 0) return null;
        const totalUnits = filledSubjects.reduce((sum, s) => sum + parseInt(s.units), 0);
        const weighted    = filledSubjects.reduce((sum, s) => sum + parseInt(s.units) * parseFloat(s.grade), 0);
        return totalUnits > 0 ? (weighted / totalUnits).toFixed(2) : null;
    })();

    const filledForSubmit = subjects.filter(s => s.subject_name.trim() && s.grade !== '');
    const gradesValid = filledForSubmit.length > 0 && filledForSubmit.every(s => {
        const g = parseFloat(s.grade);
        return !isNaN(g) && g >= gradeBounds.min && g <= gradeBounds.max;
    });

    const handleSubmit = async () => {
        setError('');
        setSuccess('');

        if (!scholarId) {
            setError('No scholar account found. Please log in again.');
            return;
        }

        const filled = subjects.filter(s => s.subject_name.trim() && s.grade !== '');
        if (filled.length === 0) {
            setError('Add at least one subject with a grade.');
            return;
        }
        for (const s of filled) {
            const g = parseFloat(s.grade);
            if (isNaN(g) || g < gradeBounds.min || g > gradeBounds.max) {
                setError(`Invalid grade for "${s.subject_name}". Must be between ${gradeBounds.min.toFixed(2)} and ${gradeBounds.max.toFixed(2)}.`);
                return;
            }
        }
        if (!proofFile) {
            setError('Please upload a photo of your Report Card / Grade Sheet as proof.');
            return;
        }

        try {
            setSubmitting(true);
            const formData = new FormData();
            formData.append('semester', semester);
            formData.append('academic_year', academicYear);
            formData.append('subjects', JSON.stringify(filled.map(s => ({
                subject_name: s.subject_name.trim(),
                units: parseInt(s.units),
                grade: parseFloat(s.grade),
            }))));
            const uploadId = await uploadResumableFile(proofFile, 'proof');
            formData.append('resumable_upload_id', uploadId);

            const res = await axios.post(`${API}/grades/submit-resumable`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    ...authHeader(),
                },
            });
            setSuccess(`Grades submitted! Computed ${gradingSystem === 'gwa' ? 'GWA' : 'average'}: ${res.data.gwa?.toFixed(2) ?? 'N/A'}`);
            setIsLocked(true);
            setLockInfo({ status: 'pending', staff_comment: null });
            setSubjects([emptySubject(), emptySubject()]);
            removeProof();
            fetchGrades();
        } catch (err) {
            setError(err.response?.data?.error || 'Error submitting grades. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const inputStyle = { ...body, fontSize: '0.85rem', color: INK, borderColor: BORDER, background: SURFACE };
    const inputCls = 'w-full border rounded-lg px-3.5 py-2.5 outline-none transition-all';

    const wasRejected = lockInfo.status === 'rejected';

    // "Passing" reads in the direction each grading system actually works:
    // lower is better for GWA, higher is better for percentage.
    const isPassingGrade = (g) => gradingSystem === 'gwa' ? g <= 3.00 : g >= 75;

    // Validation checklist — derived straight from existing state, no new
    // backend fields.
    const checklist = [
        { done: Boolean(semester && academicYear), label: 'Semester and academic year selected' },
        { done: filledForSubmit.length > 0, label: 'Subjects encoded' },
        { done: gradesValid, label: `Grades completed (${gradeLabel})` },
        { done: Boolean(proofFile), label: 'Report Card / Grade Sheet uploaded' },
    ];
    const allChecked = checklist.every(c => c.done);

    return (
        <div style={{ ...body, background: BG }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Inter:wght@400;500;600;700&display=swap');
                .grades-footer { position: sticky; bottom: 0; z-index: 5; }
                @media (max-width: 1023px) { .grades-footer { position: static; } }
            `}</style>

            {/* ── 1. Academic header ─────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4 flex-wrap" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '20px 24px', marginBottom: 20 }}>
                <div>
                    <p style={{ ...body, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: BRONZE }}>SCHOLAR PORTAL</p>
                    <h1 style={{ ...display, fontSize: '1.5rem', fontWeight: 600, color: INK, marginTop: 4 }}>Grades</h1>
                    <p style={{ ...body, fontSize: '0.83rem', color: MUTED, marginTop: 5, maxWidth: 460 }}>
                        Submit your grades once, with your Report Card or Grade Sheet as proof.
                    </p>
                </div>
                <span style={{ ...body, fontSize: '0.76rem', fontWeight: 600, color: PRIMARY, background: PRIMARY_TINT, border: `1px solid ${BORDER}`, borderRadius: 999, padding: '7px 16px', flexShrink: 0 }}>
                    {semester} • AY {academicYear}
                </span>
            </div>

            {/* ── 2. Semester overview — 3 compact cards ─────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4" style={{ marginBottom: 20 }}>
                <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 16px' }}>
                    <p style={{ ...body, fontSize: '0.68rem', fontWeight: 600, color: BRONZE }}>Current Semester</p>
                    <p style={{ ...display, fontSize: '1.15rem', fontWeight: 600, color: INK, marginTop: 4 }}>{semester}</p>
                    <p style={{ ...body, fontSize: '0.74rem', color: MUTED, marginTop: 1 }}>AY {academicYear}</p>
                </div>
                <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 16px' }}>
                    <p style={{ ...body, fontSize: '0.68rem', fontWeight: 600, color: BRONZE }}>Year Level</p>
                    <p style={{ ...display, fontSize: '1.15rem', fontWeight: 600, color: INK, marginTop: 4 }}>{yearLevelLabel}</p>
                </div>
                <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 16px' }}>
                    <p style={{ ...body, fontSize: '0.68rem', fontWeight: 600, color: BRONZE }}>Grading System</p>
                    <p style={{ ...display, fontSize: '1.15rem', fontWeight: 600, color: INK, marginTop: 4 }}>
                        {gradingSystem === 'gwa' ? 'GWA (1.00–5.00)' : 'Percentage (0–100)'}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 sm:gap-6">

                {/* ── LEFT: entry workspace + upload + validation ──────── */}
                <div className="lg:col-span-3 space-y-5">

                    {/* Rejection banner */}
                    {!checkingLock && wasRejected && (
                        <AlertStrip color={DANGER} icon={RotateCcw} title="Returned for correction">
                            {lockInfo.staff_comment || 'Your previous submission for this semester was rejected. Please review and resubmit.'}
                        </AlertStrip>
                    )}

                    {/* Semester / year selectors */}
                    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '18px 20px' }}>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 10, background: PRIMARY_TINT }}>
                                <GraduationCap size={16} style={{ color: PRIMARY }} />
                            </div>
                            <div>
                                <h3 style={{ ...display, fontSize: '1.05rem', fontWeight: 600, color: INK }}>Grade Entry Workspace</h3>
                                <p style={{ ...body, fontSize: '0.74rem', color: MUTED }}>One submission per semester only.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                                <label style={{ ...body, fontSize: '0.68rem', fontWeight: 700, color: MUTED, letterSpacing: '0.03em', marginBottom: 6, display: 'block' }}>SEMESTER</label>
                                <select className={inputCls} style={inputStyle} value={semester} onChange={e => setSemester(e.target.value)}>
                                    {SEMESTERS.map(s => <option key={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ ...body, fontSize: '0.68rem', fontWeight: 700, color: MUTED, letterSpacing: '0.03em', marginBottom: 6, display: 'block' }}>ACADEMIC YEAR</label>
                                <select className={inputCls} style={inputStyle} value={academicYear} onChange={e => setAcademicYear(e.target.value)}>
                                    {ACAD_YEARS.map(y => <option key={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>

                        {checkingLock ? (
                            <div className="flex items-center gap-2 py-3" style={{ ...body, fontSize: '0.8rem', color: MUTED }}>
                                <Loader2 size={13} className="animate-spin" /> Checking submission status…
                            </div>
                        ) : isLocked ? (
                            <AlertStrip color={WARNING} icon={Lock}>
                                You've already submitted grades for {semester} AY {academicYear}. This semester is locked and cannot be edited.
                            </AlertStrip>
                        ) : (
                            <>
                                {/* Subject rows — single grade column per subject, per system */}
                                <div className="mb-2" style={{ overflowX: 'auto' }}>
                                    <div className="grid gap-2" style={{ gridTemplateColumns: '2.2fr 0.8fr 1.2fr auto', minWidth: 480 }}>
                                        <span style={{ ...body, fontSize: '0.66rem', fontWeight: 700, color: BRONZE, letterSpacing: '0.04em' }}>SUBJECT</span>
                                        <span style={{ ...body, fontSize: '0.66rem', fontWeight: 700, color: BRONZE, letterSpacing: '0.04em' }}>UNITS</span>
                                        <span style={{ ...body, fontSize: '0.66rem', fontWeight: 700, color: BRONZE, letterSpacing: '0.04em' }}>{gradeLabel.toUpperCase()}</span>
                                        <span />
                                    </div>
                                    <div className="space-y-2 mt-2">
                                        {subjects.map((s, i) => (
                                            <div key={s.key} className="grid gap-2 items-center" style={{ gridTemplateColumns: '2.2fr 0.8fr 1.2fr auto', minWidth: 480 }}>
                                                <input
                                                    className={inputCls}
                                                    style={inputStyle}
                                                    placeholder={`Subject ${i + 1} name`}
                                                    value={s.subject_name}
                                                    onChange={e => setSubjectField(s.key, 'subject_name', e.target.value)}
                                                />
                                                <input
                                                    type="number" min="1" max="6"
                                                    className={inputCls}
                                                    style={inputStyle}
                                                    value={s.units}
                                                    onChange={e => setSubjectField(s.key, 'units', e.target.value)}
                                                />
                                                <input
                                                    type="number" min={gradeBounds.min} max={gradeBounds.max} step={gradeBounds.step}
                                                    className={inputCls}
                                                    style={inputStyle}
                                                    placeholder={gradeBounds.placeholder}
                                                    value={s.grade}
                                                    onChange={e => setSubjectField(s.key, 'grade', e.target.value)}
                                                />
                                                <button
                                                    onClick={() => removeSubjectRow(s.key)}
                                                    disabled={subjects.length <= 1}
                                                    className="flex items-center justify-center transition-colors"
                                                    style={{ width: 30, height: 30, borderRadius: 8, color: subjects.length <= 1 ? BORDER : MUTED, background: 'none', border: 'none', cursor: subjects.length <= 1 ? 'default' : 'pointer' }}
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button onClick={addSubjectRow}
                                    className="w-full flex items-center justify-center gap-1.5 transition-colors mt-3 mb-4"
                                    style={{ padding: '10px 0', borderRadius: 10, border: `1.5px dashed ${BORDER}`, color: MUTED, background: 'none', ...body, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                                    <Plus size={14} /> Add Another Subject
                                </button>

                                {previewAverage && (
                                    <div className="flex items-center justify-between mb-4" style={{ padding: '12px 16px', background: PRIMARY_TINT, border: `1px solid ${BORDER}`, borderRadius: 12 }}>
                                        <span style={{ ...body, fontSize: '0.72rem', fontWeight: 700, color: PRIMARY_DEEP, letterSpacing: '0.02em' }}>{averageLabel.toUpperCase()}</span>
                                        <span style={{ ...display, fontSize: '1.3rem', fontWeight: 700, color: PRIMARY }}>{previewAverage}</span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Report card upload */}
                    {!checkingLock && !isLocked && (
                        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '18px 20px' }}>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 10, background: PRIMARY_TINT }}>
                                    <FileText size={15} style={{ color: PRIMARY }} />
                                </div>
                                <div>
                                    <h3 style={{ ...display, fontSize: '1rem', fontWeight: 600, color: INK }}>Report Card Upload</h3>
                                    <p style={{ ...body, fontSize: '0.73rem', color: MUTED }}>Used to verify the grades entered above.</p>
                                </div>
                            </div>

                            {!proofPreview ? (
                                <label
                                    className="flex flex-col items-center justify-center gap-2 w-full cursor-pointer transition-colors"
                                    style={{ padding: '32px 0', borderRadius: 14, border: `1.5px dashed ${BORDER}`, background: BG, color: MUTED }}
                                    onDragOver={e => e.preventDefault()}
                                    onDrop={e => {
                                        e.preventDefault();
                                        const file = e.dataTransfer.files?.[0];
                                        if (!file) return;
                                        setProofFile(file);
                                        setProofPreview(URL.createObjectURL(file));
                                    }}
                                >
                                    <Camera size={22} />
                                    <span style={{ ...body, fontSize: '0.82rem', fontWeight: 600 }}>Drag & drop, or browse PDF / image</span>
                                    <input type="file" accept=".jpg,.jpeg,.png,.pdf,.doc,.docx" className="hidden" onChange={handleProofChange} />
                                </label>
                            ) : (
                                <div className="relative">
                                    {!proofFile?.type?.startsWith('image/') ? (
                                        <div className="flex items-center gap-2 p-3" style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 10 }}>
                                            <BookOpen size={16} style={{ color: MUTED }} />
                                            <span style={{ ...body, fontSize: '0.8rem', fontWeight: 600, color: INK }} className="truncate">{proofFile.name}</span>
                                        </div>
                                    ) : (
                                        <img src={proofPreview} alt="Proof preview" className="w-full h-44 object-cover" style={{ border: `1px solid ${BORDER}`, borderRadius: 12 }} />
                                    )}
                                    <div className="flex items-center gap-2 mt-3">
                                        <label className="flex items-center gap-1.5 cursor-pointer transition-colors" style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: PRIMARY, background: PRIMARY_TINT, border: 'none', borderRadius: 8, padding: '8px 14px' }}>
                                            <RotateCcw size={13} /> Replace File
                                            <input type="file" accept=".jpg,.jpeg,.png,.pdf,.doc,.docx" className="hidden" onChange={handleProofChange} />
                                        </label>
                                        <button onClick={removeProof} className="flex items-center gap-1.5 transition-colors" style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: DANGER, background: `${DANGER}14`, border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}>
                                            <X size={13} /> Remove
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {error && <AlertStrip color={DANGER} icon={AlertTriangle}>{error}</AlertStrip>}
                    {success && <AlertStrip color={SUCCESS} icon={CheckCircle}>{success}</AlertStrip>}

                    {/* Validation checklist */}
                    {!checkingLock && !isLocked && (
                        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '18px 20px' }}>
                            <p style={{ ...body, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', color: MUTED, marginBottom: 12 }}>BEFORE YOU SUBMIT</p>
                            <div className="space-y-2.5">
                                {checklist.map((c, i) => <ChecklistRow key={i} done={c.done} label={c.label} />)}
                            </div>
                        </div>
                    )}

                    {/* ── 7. Sticky submission footer ─────────────────────── */}
                    {!checkingLock && !isLocked && (
                        <div className="grades-footer flex items-center justify-between gap-4 flex-wrap" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 18px' }}>
                            <span style={{ ...body, fontSize: '0.8rem', fontWeight: 600, color: allChecked ? SUCCESS : MUTED }}>
                                {allChecked ? 'Ready to submit' : 'Complete the checklist to submit'}
                            </span>
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
                                style={{ padding: '11px 24px', borderRadius: 12, border: 'none', ...body, fontSize: '0.82rem', fontWeight: 700, color: '#fff', background: `linear-gradient(120deg, ${PRIMARY} 0%, ${PRIMARY_DEEP} 100%)`, cursor: submitting ? 'wait' : 'pointer' }}
                            >
                                {submitting ? (
                                    <><Loader2 size={14} className="animate-spin" /> Submitting…</>
                                ) : wasRejected ? (
                                    <><RotateCcw size={14} /> Resubmit Grades</>
                                ) : (
                                    <><Send size={14} /> Submit Grades</>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                {/* ── RIGHT: semester summary + submitted history ──────── */}
                <div className="lg:col-span-2 space-y-5">

                    {/* Semester summary card */}
                    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '18px 20px' }}>
                        <p style={{ ...body, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', color: MUTED, marginBottom: 12 }}>SEMESTER SUMMARY</p>
                        {previewAverage ? (
                            <>
                                <div className="flex items-baseline justify-between">
                                    <span style={{ ...body, fontSize: '0.82rem', color: MUTED }}>{summaryAverageLabel}</span>
                                    <span style={{ ...display, fontSize: '1.5rem', fontWeight: 700, color: PRIMARY }}>{previewAverage}</span>
                                </div>
                                <div className="flex items-baseline justify-between mt-2">
                                    <span style={{ ...body, fontSize: '0.82rem', color: MUTED }}>Total Units</span>
                                    <span style={{ ...body, fontSize: '0.9rem', fontWeight: 600, color: INK }}>
                                        {filledSubjects.reduce((sum, s) => sum + (parseInt(s.units) || 0), 0)}
                                    </span>
                                </div>
                                <div className="flex items-baseline justify-between mt-2">
                                    <span style={{ ...body, fontSize: '0.82rem', color: MUTED }}>Academic Standing</span>
                                    <span style={{ ...body, fontSize: '0.82rem', fontWeight: 700, color: isPassingGrade(parseFloat(previewAverage)) ? SUCCESS : DANGER }}>
                                        {isPassingGrade(parseFloat(previewAverage)) ? 'Passing' : 'Needs Improvement'}
                                    </span>
                                </div>
                            </>
                        ) : (
                            <p style={{ ...body, fontSize: '0.8rem', color: MUTED }}>Enter subjects and grades to see a live summary.</p>
                        )}
                    </div>

                    {/* Submitted grades history */}
                    <div>
                        <h3 className="flex items-center gap-2 mb-3" style={{ ...display, fontSize: '1.05rem', fontWeight: 600, color: INK }}>
                            <BookOpen size={16} style={{ color: PRIMARY }} /> Submitted Grades
                        </h3>

                        {loading ? (
                            <div className="space-y-3">
                                {[1, 2].map(i => <div key={i} className="animate-pulse" style={{ height: 80, borderRadius: 14, background: `${BORDER}88` }} />)}
                            </div>
                        ) : grades.length === 0 ? (
                            <div className="text-center" style={{ background: SURFACE, border: `1px dashed ${BORDER}`, borderRadius: 16, padding: '48px 20px' }}>
                                <BookOpen size={30} style={{ margin: '0 auto 12px', color: BORDER }} />
                                <p style={{ ...body, fontSize: '0.86rem', fontWeight: 600, color: MUTED }}>No grades submitted yet.</p>
                                <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 4 }}>Use the form to submit your first semester.</p>
                            </div>
                        ) : grades.map((sem, si) => {
                            const key    = `${sem.semester}|${sem.academic_year}`;
                            const isOpen = expandedSem === key;
                            const semRejected = sem.review_status === 'rejected';
                            return (
                                <div key={si} className="overflow-hidden mb-3"
                                    style={{ background: SURFACE, border: `1px solid ${semRejected ? DANGER + '55' : BORDER}`, borderRadius: 14 }}>
                                    <button onClick={() => setExpandedSem(isOpen ? null : key)}
                                        className="w-full flex items-center justify-between transition-colors"
                                        style={{ padding: '15px 18px', background: 'none', border: 'none', cursor: 'pointer' }}>
                                        <div className="text-left min-w-0">
                                            <p style={{ ...body, fontSize: '0.85rem', fontWeight: 700, color: INK }}>{sem.semester} AY {sem.academic_year}</p>
                                            <p style={{ ...body, fontSize: '0.72rem', color: MUTED, marginTop: 2 }}>{sem.total_units} total units · {sem.subjects.length} subjects</p>
                                            <div className="flex items-center gap-2 flex-wrap mt-2">
                                                <span style={{ ...display, fontSize: '1rem', fontWeight: 700, color: PRIMARY }}>
                                                    {sem.gwa ? sem.gwa.toFixed(2) : 'TBA'}
                                                </span>
                                                <StatusBadge status={sem.status} />
                                                <ReviewBadge status={sem.review_status} />
                                                {sem.locked && (
                                                    <span className="flex items-center gap-1" style={{ ...body, fontSize: '0.66rem', color: MUTED, fontWeight: 700 }}>
                                                        <Lock size={10} /> Locked
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {isOpen ? <ChevronUp size={15} style={{ color: MUTED, flexShrink: 0 }} /> : <ChevronDown size={15} style={{ color: MUTED, flexShrink: 0 }} />}
                                    </button>

                                    {semRejected && sem.staff_comment && (
                                        <div style={{ margin: '0 18px 14px' }}>
                                            <AlertStrip color={DANGER} title="Officer Feedback">{sem.staff_comment}</AlertStrip>
                                        </div>
                                    )}

                                    {isOpen && (
                                        <div style={{ borderTop: `1px solid ${BORDER}` }}>
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr style={{ background: BG }}>
                                                        <th style={{ ...body, fontSize: '0.66rem', fontWeight: 700, color: BRONZE, letterSpacing: '0.03em', padding: '10px 18px' }}>SUBJECT</th>
                                                        <th style={{ ...body, fontSize: '0.66rem', fontWeight: 700, color: BRONZE, letterSpacing: '0.03em', padding: '10px 18px' }}>UNITS</th>
                                                        <th style={{ ...body, fontSize: '0.66rem', fontWeight: 700, color: BRONZE, letterSpacing: '0.03em', padding: '10px 18px' }}>GRADE</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sem.subjects.map((subj, ji) => (
                                                        <tr key={ji} style={{ borderTop: `1px solid ${BORDER}` }}>
                                                            <td style={{ ...body, fontSize: '0.83rem', fontWeight: 600, color: INK, padding: '10px 18px' }}>{subj.subject_name}</td>
                                                            <td style={{ ...body, fontSize: '0.83rem', color: MUTED, padding: '10px 18px' }}>{subj.units}</td>
                                                            <td style={{ padding: '10px 18px' }}>
                                                                <span style={{ ...body, fontSize: '0.76rem', fontWeight: 700, padding: '2px 9px', borderRadius: 999, color: isPassingGrade(subj.grade) ? SUCCESS : DANGER, background: `${isPassingGrade(subj.grade) ? SUCCESS : DANGER}14` }}>
                                                                    {subj.grade.toFixed(2)}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScholarGrades;