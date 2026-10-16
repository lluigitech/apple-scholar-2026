import { useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowRight, Eye, EyeOff, Paperclip, ShieldCheck, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_BASE = `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '').replace(/\/api$/, '')}/api`;

/* ---------- Records Office palette (shared across the portal) ---------- */
const MAROON = '#7f2d3a';
const MAROON_DEEP = '#4f1620';
const GOLD = '#b98b4e';
const GOLD_LIGHT = '#d4af7a';
const BG = '#F6EFE4';
const CARD = '#fffdf8';
const RULE = '#e8dccb';
const INK = '#241512';
const MUTED = '#a89890';
const SAGE = '#6b8f71';
const CLAY = '#c1666b';

const initialDetails = {
    full_name: '',
    email: '',
    birth_date: '',
    phone: '',
    address: '',
    course: '',
    school: '',
    year_level: '',
};

const yearLevels = [
    ['grade_7', 'Grade 7'], ['grade_8', 'Grade 8'], ['grade_9', 'Grade 9'],
    ['grade_10', 'Grade 10'], ['grade_11', 'Grade 11'], ['grade_12', 'Grade 12'],
    ['college_1', '1st Year College'], ['college_2', '2nd Year College'],
    ['college_3', '3rd Year College'], ['college_4', '4th Year College'],
    ['college_5', '5th Year College'],
];

/* ---------- A typed field: underlined, no box, feels written onto the sheet ---------- */
const Field = ({ label, span2, children }) => (
    <div style={{ gridColumn: span2 ? '1 / -1' : 'auto' }}>
        <label className="intake-label">{label}</label>
        {children}
    </div>
);

const typedInputStyle = {
    width: '100%',
    padding: '9px 2px 10px',
    border: 0,
    borderBottom: `1px solid ${RULE}`,
    background: 'transparent',
    color: INK,
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.86rem',
    outline: 'none',
};

const PasswordField = ({ label, value, onChange, show, onToggle, autoComplete }) => (
    <Field label={label}>
        <div style={{ position: 'relative' }}>
            <input
                type={show ? 'text' : 'password'}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                autoComplete={autoComplete}
                required
                style={{ ...typedInputStyle, paddingRight: 30 }}
            />
            <button
                type="button"
                aria-label={show ? `Hide ${label}` : `Show ${label}`}
                onClick={onToggle}
                className="intake-eye"
            >
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
        </div>
    </Field>
);

const New = () => {
    const navigate = useNavigate();
    const [details, setDetails] = useState(initialDetails);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [fileNo, setFileNo] = useState('000000');

    useEffect(() => {
        const token = localStorage.getItem('token');
        const role = localStorage.getItem('role');
        if (!token || role !== 'scholar') {
            navigate('/login', { replace: true });
            return;
        }

        const userId = localStorage.getItem('id');
        setFileNo(String(userId ?? '0').padStart(6, '0'));
        axios.get(`${API_BASE}/scholar/profile/${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
        }).then(({ data }) => {
            setDetails({
                full_name: data.full_name ?? '',
                email: data.email ?? '',
                birth_date: data.birth_date ? String(data.birth_date).slice(0, 10) : '',
                phone: data.phone ?? '',
                address: data.address ?? '',
                course: data.course ?? '',
                school: data.school ?? '',
                year_level: data.year_level ?? '',
            });
        }).catch(() => setError('We could not load your account details. Please try again.'));
    }, [navigate]);

    const updateDetail = (field, value) => setDetails((current) => ({ ...current, [field]: value }));

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');

        if (newPassword.length < 8) {
            setError('Your new password must be at least 8 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('The new password and confirmation do not match.');
            return;
        }

        const token = localStorage.getItem('token');
        const userId = localStorage.getItem('id');
        setIsLoading(true);
        try {
            await axios.patch(`${API_BASE}/scholar/profile/${userId}`, {
                full_name: details.full_name,
                email: details.email,
                birth_date: details.birth_date || null,
                phone: details.phone,
                address: details.address,
                course: details.course,
                school: details.school,
                year_level: details.year_level,
            }, { headers: { Authorization: `Bearer ${token}` } });

            await axios.post(`${API_BASE}/change-password`, {
                current_password: currentPassword,
                new_password: newPassword,
            }, { headers: { Authorization: `Bearer ${token}` } });

            localStorage.removeItem('must_change_password');
            localStorage.setItem('name', details.full_name);
            localStorage.setItem('email', details.email);
            setIsComplete(true);
        } catch (requestError) {
            setError(requestError.response?.data?.error || requestError.response?.data?.message || 'Unable to finish account setup. Please check your details and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="dossier-page">
            <GlobalStyle />

            {isComplete ? (
                <div className="intake-outcome">
                    <div className="ink-stamp">
                        <ShieldCheck size={26} />
                        <span className="ink-stamp-word">VERIFIED</span>
                        <span className="ink-stamp-sub">SCHOLAR FILE &middot; APPROVED</span>
                    </div>
                    <h1 className="dossier-heading" style={{ fontSize: 'clamp(1.9rem, 4vw, 2.7rem)' }}>Your file is complete.</h1>
                    <p style={{ color: MUTED, lineHeight: 1.7, margin: '10px 0 28px', maxWidth: 440 }}>
                        Details are saved to File No. {fileNo}, and the temporary password on record has been replaced.
                    </p>
                    <button type="button" onClick={() => navigate('/scholar', { replace: true })} className="intake-submit">
                        Enter Scholar Portal <ArrowRight size={16} />
                    </button>
                </div>
            ) : (
                <div className="dossier">
                    {/* ── Index rail — the folder's own tabbed spine, always in view ── */}
                    <aside className="dossier-rail">
                        <div className="rail-plate">
                            <span className="rail-plate-no">{fileNo}</span>
                            <span className="rail-plate-label">File No.</span>
                        </div>

                        <div className="rail-stamp">PENDING<br />VERIFICATION</div>

                        <nav className="rail-tabs">
                            <a href="#section-01" className="rail-tab">
                                <span className="rail-tab-no">01</span> Personal &amp; Academic
                            </a>
                            <a href="#section-02" className="rail-tab">
                                <span className="rail-tab-no">02</span> Security Credentials
                            </a>
                        </nav>
                    </aside>

                    <div className="dossier-gutter"><span /><span /><span /></div>

                    {/* ── Sheet — the page you actually fill in ── */}
                    <section className="dossier-sheet">
                        <p className="sheet-overline">Office of the Registrar</p>
                        <h1 className="dossier-heading" style={{ fontSize: 'clamp(1.7rem, 4vw, 2.4rem)' }}>
                            Complete your scholar file.
                        </h1>
                        <p style={{ color: MUTED, lineHeight: 1.7, marginTop: 8, maxWidth: 480 }}>
                            Confirm the details on record and replace the temporary password from the administrator before entering the portal.
                        </p>

                        {error && <div role="alert" className="intake-error">{error}</div>}

                        <form onSubmit={handleSubmit}>
                            <h2 id="section-01" className="sheet-section-title">
                                <UserRound size={14} /> 01 &mdash; Personal &amp; Academic Details
                            </h2>
                            <div className="intake-grid">
                                <Field label="Full name">
                                    <input value={details.full_name} onChange={(e) => updateDetail('full_name', e.target.value)} style={typedInputStyle} required />
                                </Field>
                                <Field label="Email">
                                    <input type="email" value={details.email} onChange={(e) => updateDetail('email', e.target.value)} style={typedInputStyle} required />
                                </Field>
                                <Field label="Birthday">
                                    <input type="date" value={details.birth_date} onChange={(e) => updateDetail('birth_date', e.target.value)} style={typedInputStyle} required />
                                </Field>
                                <Field label="Phone number">
                                    <input type="tel" value={details.phone} onChange={(e) => updateDetail('phone', e.target.value)} style={typedInputStyle} required />
                                </Field>
                                <Field label="Course">
                                    <input value={details.course} onChange={(e) => updateDetail('course', e.target.value)} style={typedInputStyle} required />
                                </Field>
                                <Field label="Year level">
                                    <select value={details.year_level} onChange={(e) => updateDetail('year_level', e.target.value)} style={typedInputStyle} required>
                                        <option value="">Select year level</option>
                                        {yearLevels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                    </select>
                                </Field>
                                <Field label="School" span2>
                                    <input value={details.school} onChange={(e) => updateDetail('school', e.target.value)} style={typedInputStyle} required />
                                </Field>
                                <Field label="Address" span2>
                                    <textarea rows="2" value={details.address} onChange={(e) => updateDetail('address', e.target.value)} style={{ ...typedInputStyle, resize: 'vertical' }} required />
                                </Field>
                            </div>

                            <h2 id="section-02" className="sheet-section-title" style={{ marginTop: 30 }}>
                                <ShieldCheck size={14} /> 02 &mdash; Security Credentials
                            </h2>
                            <div className="credentials-slip">
                                <Paperclip size={22} className="slip-clip" strokeWidth={1.6} />
                                <p className="slip-note">
                                    Use the temporary password from the administrator&rsquo;s email as your current password.
                                </p>
                                <div className="intake-grid">
                                    <PasswordField label="Current password" value={currentPassword} onChange={setCurrentPassword} show={showCurrent} onToggle={() => setShowCurrent((v) => !v)} autoComplete="current-password" />
                                    <PasswordField label="New password" value={newPassword} onChange={setNewPassword} show={showNew} onToggle={() => setShowNew((v) => !v)} autoComplete="new-password" />
                                    <PasswordField label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} show={showConfirm} onToggle={() => setShowConfirm((v) => !v)} autoComplete="new-password" />
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 28 }}>
                                <button type="submit" disabled={isLoading} className="intake-submit" style={{ opacity: isLoading ? 0.65 : 1 }}>
                                    {isLoading ? 'Filing details...' : 'Save details and continue'} <ArrowRight size={16} />
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </main>
    );
};

/* ---------- Shared visual system ---------- */
const GlobalStyle = () => (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500;0,600;0,700;1,500&family=Work+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

        .dossier-page {
            min-height: 100vh;
            padding: clamp(28px, 6vw, 72px) 20px;
            background-color: ${BG};
            background-image: radial-gradient(rgba(127,45,58,0.05) 1px, transparent 1px);
            background-size: 14px 14px;
            font-family: 'Work Sans', 'Segoe UI', sans-serif;
            display: flex;
            justify-content: center;
        }

        .dossier-heading {
            margin: 0;
            color: ${INK};
            font-family: 'Lora', Georgia, serif;
            font-weight: 700;
            line-height: 1.15;
        }

        /* ── layout: rail + gutter + sheet ── */
        .dossier {
            display: flex;
            flex-direction: column;
            width: 100%;
            max-width: 960px;
        }

        .dossier-rail {
            flex: none;
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            align-items: center;
            gap: 14px;
            padding: 16px 20px;
        }
        .rail-plate {
            display: flex;
            flex-direction: column;
            padding: 8px 16px;
            background: ${GOLD_LIGHT};
            color: ${MAROON_DEEP};
            clip-path: polygon(0 0, 92% 0, 100% 50%, 92% 100%, 0 100%);
            line-height: 1.2;
        }
        .rail-plate-no { font-family: 'Lora', Georgia, serif; font-weight: 700; font-size: 1.05rem; }
        .rail-plate-label { font-family: 'IBM Plex Mono', monospace; font-size: 0.56rem; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.85; }

        .rail-stamp {
            flex: none;
            width: 74px;
            padding: 8px 3px;
            border: 2px dashed ${CLAY};
            border-radius: 50%;
            color: ${CLAY};
            font-family: 'IBM Plex Mono', monospace;
            font-size: 0.5rem;
            font-weight: 500;
            letter-spacing: 0.06em;
            text-align: center;
            line-height: 1.45;
            transform: rotate(-6deg);
            opacity: 0.85;
        }

        .rail-tabs {
            display: flex;
            flex-direction: row;
            gap: 8px;
            flex: 1 1 auto;
            min-width: 0;
        }
        .rail-tab {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 9px 16px;
            background: ${CARD};
            border: 1px solid ${RULE};
            border-bottom: none;
            color: ${MAROON};
            font-family: 'IBM Plex Mono', monospace;
            font-size: 0.64rem;
            font-weight: 500;
            letter-spacing: 0.04em;
            text-decoration: none;
            white-space: nowrap;
            clip-path: polygon(0 0, 100% 0, 100% 76%, 88% 100%, 0 100%);
            margin-bottom: -1px;
        }
        .rail-tab-no { font-family: 'Lora', Georgia, serif; font-weight: 700; color: ${GOLD}; font-size: 0.82rem; }

        .dossier-gutter {
            flex: none;
            width: 100%;
            height: 12px;
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: space-evenly;
            padding: 0 30px;
        }
        .dossier-gutter span {
            width: 10px; height: 10px; border-radius: 50%;
            background: ${BG};
            box-shadow: inset 0 1px 2px rgba(36,21,18,0.3);
        }

        .dossier-sheet {
            position: relative;
            padding: clamp(24px, 4vw, 40px);
            background: ${CARD};
            border: 1px solid ${RULE};
            border-radius: 4px 12px 12px 12px;
            box-shadow: 0 26px 60px -34px rgba(79,22,32,0.4);
        }
        .sheet-overline {
            margin: 0 0 4px;
            color: ${GOLD};
            font-family: 'IBM Plex Mono', monospace;
            font-size: 0.62rem;
            font-weight: 500;
            letter-spacing: 0.14em;
            text-transform: uppercase;
        }

        .intake-error {
            padding: 12px 14px;
            margin: 18px 0 4px;
            border-left: 3px solid ${CLAY};
            background: #fbeceb;
            color: #8e2631;
            font-size: 0.82rem;
            font-weight: 500;
        }

        .sheet-section-title {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 24px 0 16px;
            padding-bottom: 8px;
            border-bottom: 2px solid ${MAROON};
            color: ${MAROON_DEEP};
            font-family: 'IBM Plex Mono', monospace;
            font-size: 0.7rem;
            font-weight: 500;
            letter-spacing: 0.08em;
        }

        .intake-label {
            display: block;
            margin-bottom: 2px;
            color: ${MUTED};
            font-family: 'Work Sans', sans-serif;
            font-size: 0.72rem;
            font-weight: 500;
        }

        .intake-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 20px 26px;
            padding-bottom: 18px;
            border-bottom: 1px solid ${RULE};
        }

        input, select, textarea { font-family: inherit; }
        input:focus, select:focus, textarea:focus { border-bottom-color: ${MAROON}; }
        input:focus-visible, select:focus-visible, textarea:focus-visible, button:focus-visible, a.rail-tab:focus-visible {
            outline: 2px solid ${GOLD}; outline-offset: 2px;
        }

        .intake-eye {
            position: absolute; right: 2px; top: 7px;
            border: 0; background: transparent; color: ${MUTED}; cursor: pointer;
            display: flex; align-items: center;
        }

        .credentials-slip {
            position: relative;
            margin-top: -1px;
            padding: 20px 22px 22px 46px;
            background: repeating-linear-gradient(${CARD}, ${CARD} 27px, ${RULE} 28px);
            border: 1px dashed ${GOLD};
            border-radius: 2px;
        }
        .slip-clip {
            position: absolute;
            top: -12px;
            left: 14px;
            color: ${GOLD};
            transform: rotate(-18deg);
        }
        .slip-note {
            margin: 0 0 16px;
            color: ${MAROON_DEEP};
            font-size: 0.8rem;
            font-style: italic;
        }

        .intake-submit {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 9px;
            padding: 12px 20px;
            border: 0;
            border-radius: 3px;
            background: linear-gradient(120deg, ${MAROON}, ${MAROON_DEEP});
            color: #fff;
            font-family: 'Work Sans', sans-serif;
            font-size: 0.8rem;
            font-weight: 600;
            cursor: pointer;
        }

        .intake-outcome {
            max-width: 480px;
            margin: auto;
            padding: 48px 20px;
            text-align: center;
        }
        .ink-stamp {
            display: inline-flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            width: 168px;
            height: 168px;
            margin-bottom: 22px;
            border: 3px double ${SAGE};
            border-radius: 50%;
            color: ${SAGE};
            transform: rotate(-8deg);
            mix-blend-mode: multiply;
        }
        .ink-stamp-word {
            font-family: 'Lora', Georgia, serif;
            font-weight: 700;
            font-size: 1.25rem;
            letter-spacing: 0.06em;
        }
        .ink-stamp-sub {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 0.56rem;
            letter-spacing: 0.06em;
        }

        /* ── desktop: rail becomes a persistent vertical spine on the left ── */
        @media (min-width: 860px) {
            .dossier { flex-direction: row; align-items: flex-start; }
            .dossier-rail {
                width: 200px;
                flex-direction: column;
                align-items: flex-start;
                padding: 30px 0 0 2px;
                gap: 20px;
            }
            .rail-tabs { flex-direction: column; width: 100%; }
            .rail-tab {
                clip-path: polygon(0 0, 88% 0, 100% 20%, 100% 80%, 88% 100%, 0 100%);
                margin-right: -1px;
                margin-bottom: 0;
                border-right: none;
                border-bottom: 1px solid ${RULE};
                white-space: normal;
            }
            .dossier-gutter {
                width: 12px; height: auto;
                flex-direction: column;
                padding: 40px 0;
            }
            .dossier-sheet { border-radius: 4px 12px 12px 4px; }
        }
    `}</style>
);

export default New;