import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    BookOpen, Plus, Trash2, Send, CheckCircle, AlertTriangle,
    ChevronDown, ChevronUp, Lock, GraduationCap, Loader2, Camera, X, RotateCcw,
} from 'lucide-react';

// ── Token system — shared across the Scholar Portal ──
const MAROON = '#7f2d3a';
const MAROON_DEEP = '#4f1620';
const GOLD = '#b98b4e';
const ROSE = '#F5E8EA';
const IVORY = '#FBF7F2';
const INK = '#241512';
const API = 'http://localhost:5000/api/submission';

const SEMESTERS  = ['1st Sem', '2nd Sem', 'Summer'];
const ACAD_YEARS = ['2023-2024', '2024-2025', '2025-2026', '2026-2027'];

const emptySubject = () => ({
    key: Math.random().toString(36).slice(2),
    subject_name: '',
    units: 3,
    grade: '',
});

// Builds the Authorization header from the JWT stored at login.
// All submission/grades endpoints now require verifyToken, so every
// axios call in this file must send this.
const authHeader = () => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
};

// Academic performance badge (passed/failed based on GWA) - unchanged meaning.
const StatusBadge = ({ status }) => {
    const cfg = {
        passed:  { bg: '#EAF3EC', color: '#15803d', label: 'Passed' },
        failed:  { bg: '#FBE9E9', color: '#991b1b', label: 'Failed' },
        pending: { bg: '#FBF0DE', color: '#92400e', label: 'Pending' },
    }[status] || { bg: '#f1f5f9', color: '#64748b', label: status };
    return (
        <span className="text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wide"
            style={{ background: cfg.bg, color: cfg.color }}>
            {cfg.label}
        </span>
    );
};

// Officer's review decision on the submission itself (separate from the
// academic passed/failed status above). This is what tells the scholar
// whether their submission was accepted, still awaiting review, or
// returned for correction.
const ReviewBadge = ({ status }) => {
    const cfg = {
        approved: { bg: '#EAF3EC', color: '#15803d', label: 'Approved' },
        rejected: { bg: '#FBE9E9', color: '#991b1b', label: 'Rejected' },
        pending:  { bg: '#FBF0DE', color: '#92400e', label: 'Pending Review' },
    }[status] || { bg: '#f1f5f9', color: '#64748b', label: status || 'Pending Review' };
    return (
        <span className="text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wide"
            style={{ background: cfg.bg, color: cfg.color }}>
            {cfg.label}
        </span>
    );
};

const ScholarGrades = () => {
    const scholarId = localStorage.getItem('scholar_id');

    const [grades, setGrades]               = useState([]);
    const [loading, setLoading]              = useState(true);
    const [expandedSem, setExpandedSem]      = useState(null);

    // Submit form state
    const [semester, setSemester]            = useState('1st Sem');
    const [academicYear, setAcademicYear]    = useState('2025-2026');
    const [subjects, setSubjects]            = useState([emptySubject(), emptySubject()]);
    const [checkingLock, setCheckingLock]    = useState(false);
    const [isLocked, setIsLocked]            = useState(false);
    // Info about the existing submission for the currently selected sem/year
    // (used to show a "this was rejected, here's why" banner when unlocked-for-resubmit).
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

    // Check lock status whenever semester/year selection changes.
    // The backend now returns locked=false when the existing submission for
    // this sem/year was rejected, plus the status + staff_comment so we can
    // show the scholar why it was returned.
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

    // Live GWA preview based on current form inputs
    const previewGwa = (() => {
        const valid = subjects.filter(s => s.subject_name && s.units && s.grade);
        if (valid.length === 0) return null;
        const totalUnits = valid.reduce((sum, s) => sum + parseInt(s.units), 0);
        const weighted    = valid.reduce((sum, s) => sum + parseInt(s.units) * parseFloat(s.grade), 0);
        return totalUnits > 0 ? (weighted / totalUnits).toFixed(2) : null;
    })();

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
            if (isNaN(g) || g < 1.00 || g > 5.00) {
                setError(`Invalid grade for "${s.subject_name}". Must be between 1.00 and 5.00.`);
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
            formData.append('proof', proofFile);

            const res = await axios.post(`${API}/grades/submit`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    ...authHeader(),
                },
            });
            setSuccess(`Grades submitted! Computed GWA: ${res.data.gwa?.toFixed(2) ?? 'N/A'}`);
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

    const inputCls = 'w-full bg-white border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 transition-all';
    const inputStyle = { color: INK, borderColor: '#e9dfd8' };

    const wasRejected = lockInfo.status === 'rejected';

    return (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* Submit Form */}
            <div className="lg:col-span-2">
                <div className="bg-white p-6 rounded-2xl sticky top-6" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)', borderTop: `2px solid ${GOLD}` }}>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="p-2 rounded-xl" style={{ background: ROSE }}>
                            <GraduationCap size={16} style={{ color: MAROON }} />
                        </div>
                        <h3 className="font-black text-sm" style={{ color: INK }}>Submit Semester Grades</h3>
                    </div>
                    <p className="text-xs text-slate-400 mb-5 ml-10">One submission per semester only.</p>

                    {/* Sem / Year selectors */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div>
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">Semester</label>
                            <select className={inputCls} style={inputStyle} value={semester} onChange={e => setSemester(e.target.value)}>
                                {SEMESTERS.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">Academic Year</label>
                            <select className={inputCls} style={inputStyle} value={academicYear} onChange={e => setAcademicYear(e.target.value)}>
                                {ACAD_YEARS.map(y => <option key={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Rejection banner - shown when this sem/year was returned by the
                        officer, so the form below is unlocked for resubmission. */}
                    {!checkingLock && wasRejected && (
                        <div className="flex items-start gap-2 px-4 py-3 rounded-xl mb-4" style={{ background: '#FBE9E9', border: '1px solid #f3c6c6' }}>
                            <RotateCcw size={14} className="shrink-0 mt-0.5" style={{ color: '#991b1b' }} />
                            <div>
                                <p className="text-xs font-black uppercase tracking-wide mb-0.5" style={{ color: '#991b1b' }}>
                                    Returned for correction
                                </p>
                                <p className="text-xs leading-relaxed" style={{ color: '#991b1b' }}>
                                    {lockInfo.staff_comment || 'Your previous submission for this semester was rejected. Please review and resubmit.'}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Lock state */}
                    {checkingLock ? (
                        <div className="flex items-center gap-2 text-xs text-slate-400 py-3">
                            <Loader2 size={13} className="animate-spin" /> Checking submission status...
                        </div>
                    ) : isLocked ? (
                        <div className="flex items-start gap-2 px-4 py-3 rounded-xl mb-4" style={{ background: '#FBF0DE', border: '1px solid #f3d9a6' }}>
                            <Lock size={14} className="shrink-0 mt-0.5" style={{ color: '#92400e' }} />
                            <p className="text-xs font-semibold" style={{ color: '#92400e' }}>
                                You've already submitted grades for {semester} AY {academicYear}. This semester is locked and cannot be edited.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Subject rows */}
                            <div className="space-y-3 mb-3">
                                {subjects.map((s, i) => (
                                    <div key={s.key} className="p-3 rounded-xl" style={{ background: IVORY, border: '1px solid #f0e6e0' }}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-black text-slate-400 uppercase">Subject {i + 1}</span>
                                            {subjects.length > 1 && (
                                                <button onClick={() => removeSubjectRow(s.key)}
                                                    className="p-1 rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-400 transition-all">
                                                    <Trash2 size={12} />
                                                </button>
                                            )}
                                        </div>
                                        <input
                                            className={inputCls + ' mb-2'}
                                            style={inputStyle}
                                            placeholder="Subject name (e.g. Mathematics 101)"
                                            value={s.subject_name}
                                            onChange={e => setSubjectField(s.key, 'subject_name', e.target.value)}
                                        />
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                type="number" min="1" max="6"
                                                className={inputCls}
                                                style={inputStyle}
                                                placeholder="Units"
                                                value={s.units}
                                                onChange={e => setSubjectField(s.key, 'units', e.target.value)}
                                            />
                                            <input
                                                type="number" min="1.00" max="5.00" step="0.25"
                                                className={inputCls}
                                                style={inputStyle}
                                                placeholder="Grade (1.00-5.00)"
                                                value={s.grade}
                                                onChange={e => setSubjectField(s.key, 'grade', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button onClick={addSubjectRow}
                                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed text-slate-500 text-xs font-bold hover:bg-slate-50 transition-all mb-4"
                                style={{ borderColor: `${GOLD}88` }}>
                                <Plus size={13} /> Add Another Subject
                            </button>

                            {/* Live GWA preview */}
                            {previewGwa && (
                                <div className="flex items-center justify-between p-3 rounded-xl mb-4"
                                    style={{ background: ROSE }}>
                                    <span className="text-xs font-bold text-slate-600">Computed GWA (preview)</span>
                                    <span className="text-lg font-black" style={{ color: MAROON }}>{previewGwa}</span>
                                </div>
                            )}

                            {/* Proof of grades upload */}
                            <div className="mb-4">
                                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">
                                    Proof - Report Card / Grade Sheet Photo <span style={{ color: MAROON }}>*</span>
                                </label>
                                {!proofPreview ? (
                                    <label className="flex flex-col items-center justify-center gap-1.5 w-full py-6 rounded-xl border-2 border-dashed text-slate-400 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                                        style={{ borderColor: `${GOLD}88`, background: IVORY }}>
                                        <Camera size={18} />
                                        Upload photo of your Report Card
                                        <input type="file" accept=".jpg,.jpeg,.png,.pdf,.doc,.docx" className="hidden" onChange={handleProofChange} />
                                    </label>
                                ) : (
                                    <div className="relative">
                                        {!proofFile?.type?.startsWith('image/') ? (
                                            <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: IVORY, border: '1px solid #e9dfd8' }}>
                                                <BookOpen size={16} className="text-slate-400" />
                                                <span className="text-xs font-semibold text-slate-600 truncate">{proofFile.name}</span>
                                            </div>
                                        ) : (
                                            <img src={proofPreview} alt="Proof preview" className="w-full h-40 object-cover rounded-xl" style={{ border: '1px solid #e9dfd8' }} />
                                        )}
                                        <button onClick={removeProof}
                                            className="absolute top-2 right-2 p-1.5 rounded-full bg-white shadow text-slate-500 hover:text-red-500 transition-all"
                                            style={{ border: 'none', cursor: 'pointer' }}>
                                            <X size={13} />
                                        </button>
                                    </div>
                                )}
                                <p className="text-[10px] text-slate-400 mt-1.5">This will be used to verify the grades you entered above.</p>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl mb-4" style={{ background: '#FBE9E9', border: '1px solid #f3c6c6' }}>
                                    <AlertTriangle size={13} className="shrink-0" style={{ color: '#991b1b' }} />
                                    <p className="text-xs font-medium" style={{ color: '#991b1b' }}>{error}</p>
                                </div>
                            )}
                            {success && (
                                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl mb-4" style={{ background: '#EAF3EC', border: '1px solid #bbf7d0' }}>
                                    <CheckCircle size={13} className="shrink-0" style={{ color: '#15803d' }} />
                                    <p className="text-xs font-medium" style={{ color: '#15803d' }}>{success}</p>
                                </div>
                            )}

                            <div className="rounded-xl px-3.5 py-2.5 mb-4 flex items-start gap-2" style={{ background: '#FBF0DE', border: '1px solid #f3d9a6' }}>
                                <AlertTriangle size={13} className="shrink-0 mt-0.5" style={{ color: '#92400e' }} />
                                <p className="text-[11px] font-medium leading-relaxed" style={{ color: '#92400e' }}>
                                    Double-check your entries. Once submitted, grades for this semester cannot be edited unless returned by the officer for correction.
                                </p>
                            </div>

                            <button onClick={handleSubmit} disabled={submitting}
                                className="w-full py-3 rounded-full text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
                                style={{ background: `linear-gradient(120deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)`, boxShadow: `0 4px 14px ${MAROON}35` }}>
                                {submitting ? (
                                    <><Loader2 size={14} className="animate-spin" /> Submitting...</>
                                ) : wasRejected ? (
                                    <><RotateCcw size={14} /> Resubmit Grades</>
                                ) : (
                                    <><Send size={14} /> Submit Grades</>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Submitted Grades History */}
            <div className="lg:col-span-3 space-y-4">
                <h3 className="font-black flex items-center gap-2" style={{ color: INK }}>
                    <BookOpen size={16} style={{ color: MAROON }} /> Submitted Grades
                </h3>

                {loading ? (
                    <div className="space-y-3">
                        {[1, 2].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: '#EFE7E2' }} />)}
                    </div>
                ) : grades.length === 0 ? (
                    <div className="bg-white rounded-[2rem] p-16 text-center" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)' }}>
                        <BookOpen size={40} className="mx-auto mb-3" style={{ color: '#e9d9dc' }} />
                        <p className="text-sm font-bold" style={{ color: '#c9b3b8' }}>No grades submitted yet.</p>
                        <p className="text-xs mt-1" style={{ color: '#c9b3b8' }}>Use the form to submit your first semester.</p>
                    </div>
                ) : grades.map((sem, si) => {
                    const key    = `${sem.semester}|${sem.academic_year}`;
                    const isOpen = expandedSem === key;
                    const semRejected = sem.review_status === 'rejected';
                    return (
                        <div key={si} className="bg-white rounded-[2rem] overflow-hidden"
                            style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)', border: semRejected ? '1px solid #f3c6c6' : 'none' }}>
                            <button onClick={() => setExpandedSem(isOpen ? null : key)}
                                className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
                                style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                <div className="flex items-center gap-4 flex-wrap">
                                    <div className="text-left">
                                        <p className="text-sm font-black" style={{ color: INK }}>{sem.semester} AY {sem.academic_year}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">{sem.total_units} total units - {sem.subjects.length} subjects</p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-lg font-black" style={{ color: MAROON }}>
                                            {sem.gwa ? sem.gwa.toFixed(2) : 'TBA'}
                                        </span>
                                        <span className="text-[10px] text-slate-400">GWA</span>
                                        <StatusBadge status={sem.status} />
                                        <ReviewBadge status={sem.review_status} />
                                        {sem.locked && (
                                            <span className="flex items-center gap-1 text-[10px] text-slate-300 font-bold ml-1">
                                                <Lock size={10} /> Locked
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {isOpen ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
                            </button>

                            {/* Officer feedback, shown right under the header when rejected */}
                            {semRejected && sem.staff_comment && (
                                <div className="mx-6 mb-4 -mt-1 px-4 py-3 rounded-xl" style={{ background: '#FBE9E9', border: '1px solid #f3c6c6' }}>
                                    <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: '#991b1b' }}>Officer Feedback</p>
                                    <p className="text-xs leading-relaxed" style={{ color: '#991b1b' }}>{sem.staff_comment}</p>
                                </div>
                            )}

                            {isOpen && (
                                <div className="border-t" style={{ borderColor: '#f5eee9' }}>
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="text-[10px] font-black uppercase tracking-widest border-b"
                                                style={{ color: MAROON, background: IVORY, borderColor: '#f5eee9' }}>
                                                <th className="px-6 py-3">Subject</th>
                                                <th className="px-6 py-3">Units</th>
                                                <th className="px-6 py-3">Grade</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y" style={{ borderColor: '#f5eee9' }}>
                                            {sem.subjects.map((subj, ji) => (
                                                <tr key={ji}>
                                                    <td className="px-6 py-3 text-sm font-semibold text-slate-700">{subj.subject_name}</td>
                                                    <td className="px-6 py-3 text-sm text-slate-500">{subj.units}</td>
                                                    <td className="px-6 py-3">
                                                        <span className="text-sm font-black px-2.5 py-0.5 rounded-full"
                                                            style={subj.grade <= 3.00 ? { background: '#EAF3EC', color: '#15803d' } : { background: '#FBE9E9', color: '#991b1b' }}>
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
    );
};

export default ScholarGrades;