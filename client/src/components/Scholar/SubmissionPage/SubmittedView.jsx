import React, { useMemo } from 'react';
import {
    CheckCircle,
    FileText,
    Calendar,
    User,
    Hash,
    GraduationCap,
    BookOpen,
    Building2,
    Mail,
    Eye,
    ShieldCheck,
    Bell,
    History,
} from 'lucide-react';

// ── Design tokens — "Submission Receipt" system ──
// Apple Wallet receipt × Stripe confirmation × Notion reading page.
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const PRIMARY = '#6D2140';
const PRIMARY_DEEP = '#4A1730';
const SUCCESS = '#3F8A55';
const SUCCESS_DEEP = '#2E6941';
const BORDER = '#E7D8C7';
const INK = '#241512';
const MUTED = '#96816F';

const display = { fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif" };
const sans = { fontFamily: "'Inter', 'Segoe UI', -apple-system, sans-serif" };

const card = {
    background: SURFACE,
    border: `1px solid ${BORDER}`,
    borderRadius: 18,
};

const STAGES = [
    { key: 'submitted', label: 'Submitted' },
    { key: 'officer', label: 'Officer Review' },
    { key: 'admin', label: 'Admin Verification' },
    { key: 'completed', label: 'Completed' },
];

// A submission always lands here immediately after a successful POST,
// so the tracker's current stage is always the first one.
const CURRENT_STAGE_INDEX = 0;

const NEXT_STEPS = [
    { icon: Eye, text: 'Officer reviews your report.' },
    { icon: ShieldCheck, text: 'Admin validates requirements.' },
    { icon: Bell, text: "You'll receive a notification." },
    { icon: History, text: 'Status appears in Submission History.' },
];

const SubmittedView = ({ info, body: letterBody, media, onNew, onViewHistory }) => {
    // Preserved: submitted timestamp comes from the moment this view renders.
    const now = useMemo(() => new Date(), []);
    const dateStr = now.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

    // A human-readable receipt number derived from the submission moment —
    // no new external state, just a display affordance for this view.
    const submissionId = useMemo(
        () => `ASP-${now.getTime().toString(36).toUpperCase()}`,
        [now]
    );

    const paragraphs = letterBody.split(/\n\n+/).filter((p) => p.trim());
    const wordCount = letterBody.trim().split(/\s+/).filter(Boolean).length;

    const scholarFields = [
        { label: 'Name', value: info.name, icon: User },
        { label: 'Age', value: `${info.age} years old`, icon: Hash },
        { label: 'Year Level', value: info.year, icon: GraduationCap },
        { label: 'Course', value: info.course, icon: BookOpen },
        { label: 'School', value: info.school, icon: Building2 },
        { label: 'Date', value: info.date, icon: Calendar },
    ];

    const summaryCards = [
        { label: 'Submission Date', value: info.date },
        { label: 'Semester', value: info.semester || '—' },
        { label: 'Document Type', value: 'Monthly Report' },
        { label: 'Current Status', value: 'Submitted' },
    ];

    return (
        <div style={{ background: BG, padding: '28px 20px', borderRadius: 20 }}>
            <div style={{ maxWidth: 900, margin: '0 auto' }}>

                {/* 1. Success Hero */}
                <div
                    className="flex items-center justify-between gap-6"
                    style={{
                        ...card,
                        background: `linear-gradient(120deg, ${SUCCESS} 0%, ${SUCCESS_DEEP} 100%)`,
                        border: 'none',
                        padding: '28px 32px',
                        marginBottom: 20,
                    }}
                >
                    <div>
                        <p style={{ ...sans, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', color: '#DFF3E4', marginBottom: 8 }}>
                            SUCCESSFULLY SUBMITTED
                        </p>
                        <h1 style={{ ...display, fontSize: '1.6rem', fontWeight: 700, color: '#fff', marginBottom: 10 }}>
                            Monthly Report Received
                        </h1>
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                            <span style={{ ...sans, fontSize: '0.8rem', color: '#ECFDF3' }}>Receipt {submissionId}</span>
                            <span style={{ ...sans, fontSize: '0.8rem', color: '#ECFDF3' }}>{dateStr} · {timeStr}</span>
                        </div>
                    </div>
                    <div
                        className="hidden sm:flex items-center justify-center flex-shrink-0"
                        style={{ width: 76, height: 76, borderRadius: '50%', background: 'rgba(255,255,255,0.16)' }}
                    >
                        <CheckCircle className="w-10 h-10" style={{ color: '#fff' }} strokeWidth={1.75} />
                    </div>
                </div>

                {/* 2. Tracking Progress */}
                <div style={{ ...card, padding: '24px 32px', marginBottom: 20 }}>
                    <div className="flex items-start justify-between" style={{ position: 'relative' }}>
                        {STAGES.map((stage, i) => {
                            const isDone = i < CURRENT_STAGE_INDEX;
                            const isCurrent = i === CURRENT_STAGE_INDEX;
                            const isActive = isDone || isCurrent;
                            return (
                                <div key={stage.key} className="flex-1 flex flex-col items-center" style={{ position: 'relative' }}>
                                    {i < STAGES.length - 1 && (
                                        <div
                                            style={{
                                                position: 'absolute',
                                                top: 10,
                                                left: '50%',
                                                width: '100%',
                                                height: 2,
                                                background: i < CURRENT_STAGE_INDEX ? SUCCESS : BORDER,
                                                zIndex: 0,
                                            }}
                                        />
                                    )}
                                    <div
                                        style={{
                                            width: 22,
                                            height: 22,
                                            borderRadius: '50%',
                                            background: isActive ? SUCCESS : SURFACE,
                                            border: `2px solid ${isActive ? SUCCESS : BORDER}`,
                                            position: 'relative',
                                            zIndex: 1,
                                        }}
                                    />
                                    <span
                                        style={{
                                            ...sans,
                                            fontSize: '0.72rem',
                                            fontWeight: isCurrent ? 700 : 500,
                                            color: isActive ? INK : MUTED,
                                            marginTop: 10,
                                            textAlign: 'center',
                                        }}
                                    >
                                        {stage.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 3. Submission Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ marginBottom: 20 }}>
                    {summaryCards.map((item) => (
                        <div key={item.label} style={{ ...card, padding: '16px 18px' }}>
                            <p style={{ ...sans, fontSize: '0.7rem', color: MUTED, marginBottom: 6 }}>{item.label}</p>
                            <p style={{ ...sans, fontSize: '0.95rem', fontWeight: 700, color: INK }}>{item.value}</p>
                        </div>
                    ))}
                </div>

                {/* 4. Scholar Information */}
                <div style={{ ...card, padding: '26px 32px', marginBottom: 20 }}>
                    <h2 style={{ ...display, fontSize: '1.05rem', fontWeight: 700, color: PRIMARY, marginBottom: 18 }}>
                        Scholar Information
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4">
                        {scholarFields.map((field) => (
                            <div key={field.label} className="flex items-center gap-3">
                                <div
                                    className="flex items-center justify-center flex-shrink-0"
                                    style={{ width: 34, height: 34, borderRadius: 10, background: `${PRIMARY}0f` }}
                                >
                                    <field.icon className="w-4 h-4" style={{ color: PRIMARY }} strokeWidth={1.75} />
                                </div>
                                <div>
                                    <p style={{ ...sans, fontSize: '0.68rem', color: MUTED }}>{field.label}</p>
                                    <p style={{ ...sans, fontSize: '0.88rem', fontWeight: 600, color: INK }}>{field.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 5. Monthly Letter */}
                <div style={{ ...card, marginBottom: 20, overflow: 'hidden' }}>
                    <div
                        className="flex items-center justify-between"
                        style={{ padding: '18px 32px', borderBottom: `1px solid ${BORDER}`, background: BG }}
                    >
                        <div className="flex items-center gap-2.5">
                            <Mail className="w-4 h-4" style={{ color: PRIMARY }} strokeWidth={1.75} />
                            <h2 style={{ ...display, fontSize: '1.05rem', fontWeight: 700, color: PRIMARY }}>
                                Monthly Letter
                            </h2>
                        </div>
                        <span style={{ ...sans, fontSize: '0.72rem', color: MUTED }}>{wordCount} words</span>
                    </div>
                    <div className="px-6 sm:px-10 py-9" style={{ maxWidth: 680, margin: '0 auto' }}>
                        <p style={{ ...sans, fontSize: '0.92rem', lineHeight: 1.85, color: '#3f2f28', marginBottom: 22 }}>
                            Dear Kalinga,
                        </p>
                        {paragraphs.map((para, i) => (
                            <p key={i} style={{ ...sans, fontSize: '0.92rem', lineHeight: 1.85, color: '#3f2f28', marginBottom: 18 }}>
                                {para.trim()}
                            </p>
                        ))}
                        <p style={{ ...sans, fontSize: '0.92rem', lineHeight: 1.85, color: '#3f2f28', marginTop: 26, marginBottom: 4 }}>
                            Your scholar,
                        </p>
                        <p style={{ ...display, fontSize: '1rem', fontWeight: 700, color: INK }}>
                            {info.name}
                        </p>
                    </div>
                </div>

                {/* 6. Documentation Gallery */}
                {media.length > 0 && (
                    <div style={{ ...card, padding: '26px 32px', marginBottom: 20 }}>
                        <h2 style={{ ...display, fontSize: '1.05rem', fontWeight: 700, color: PRIMARY, marginBottom: 18 }}>
                            Documentation
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                            {media.map((item, i) => (
                                <div key={item.id}>
                                    <div
                                        className="overflow-hidden"
                                        style={{ height: 170, borderRadius: 14, border: `1px solid ${BORDER}` }}
                                    >
                                        <img
                                            src={item.previewUrl}
                                            alt={`doc-${i + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
                                        <p style={{ ...sans, fontSize: '0.78rem', color: '#3f2f28' }}>
                                            {item.description || `Documentation ${i + 1}`}
                                        </p>
                                        <span style={{ ...sans, fontSize: '0.68rem', color: MUTED }}>{i + 1}/{media.length}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 7. Next Steps */}
                <div style={{ ...card, padding: '26px 32px', marginBottom: 28 }}>
                    <h2 style={{ ...display, fontSize: '1.05rem', fontWeight: 700, color: PRIMARY, marginBottom: 18 }}>
                        What happens next?
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {NEXT_STEPS.map((step, i) => (
                            <div key={i} className="flex items-start gap-3">
                                <div
                                    className="flex items-center justify-center flex-shrink-0"
                                    style={{ width: 32, height: 32, borderRadius: 10, background: `${SUCCESS}14` }}
                                >
                                    <step.icon className="w-4 h-4" style={{ color: SUCCESS_DEEP }} strokeWidth={1.75} />
                                </div>
                                <p style={{ ...sans, fontSize: '0.85rem', lineHeight: 1.5, color: '#3f2f28', paddingTop: 5 }}>
                                    {step.text}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 8. Bottom Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                        onClick={onViewHistory}
                        className="flex items-center gap-2 transition-opacity hover:opacity-80"
                        style={{
                            padding: '10px 20px',
                            borderRadius: 999,
                            ...sans,
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            background: 'transparent',
                            color: PRIMARY,
                            border: `1.5px solid ${PRIMARY}55`,
                            cursor: 'pointer',
                        }}
                    >
                        <History className="w-4 h-4" /> View Submission History
                    </button>
                    <button
                        onClick={onNew}
                        className="flex items-center gap-2 transition-opacity hover:opacity-90"
                        style={{
                            padding: '10px 20px',
                            borderRadius: 999,
                            ...sans,
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            background: `linear-gradient(120deg, ${PRIMARY} 0%, ${PRIMARY_DEEP} 100%)`,
                            color: '#fff',
                            border: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        <FileText className="w-4 h-4" /> New Submission
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SubmittedView;