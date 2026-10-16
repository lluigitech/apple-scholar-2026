import { useMemo, useState } from 'react';
import axios from 'axios';
import {
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    AlertCircle,
    Mail,
    Lock,
    ShieldCheck,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

// Official Apple Scholar logo — also the way back to the landing page
import appleLogo from '../assets/logo/applelogo.png';

const API_BASE = `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '').replace(/\/api$/, '')}/api`;

/* ---------- Same token system as the Quiet Luxury Login ---------- */
const BURGUNDY = '#6D2140';
const BURGUNDY_DEEP = '#4A1730';
const GOLD = '#B98B4E';
const GOLD_DARK = '#8F6A35'; // bronze for small text on light surfaces
const IVORY = '#F7F4EE';
const CARD = '#FFFDF9';
const BORDER = '#E7D8C7';
const SAND = '#FBF1E6';
const INK = '#241512';
const TEXT_SOFT = '#5F554F';
const MUTED = '#8A7A68';
const SUCCESS = '#3F8A55';
const DANGER_BG = '#FBEAEA';
const DANGER_TEXT = '#8E2631';

const recoverySteps = [
    { n: 1, label: 'Verify Email' },
    { n: 2, label: 'Receive Secure Link' },
    { n: 3, label: 'Create New Password' },
];

const securityNotices = [
    'Link expires in 15 minutes',
    'One-time verification',
    'Encrypted authentication',
];

const highlights = [
    { icon: Lock, label: 'Secure' },
    { icon: Mail, label: 'One-time Link' },
    { icon: ShieldCheck, label: 'Encrypted' },
];

// Small leaf-inspired decoration (purely visual)
const LeafCluster = ({ className, flip = false }) => (
    <svg
        className={className}
        viewBox="0 0 120 150"
        aria-hidden="true"
        style={flip ? { transform: 'scaleX(-1)' } : undefined}
    >
        <path d="M60 148 C58 110 58 80 60 40" stroke="#B98B4E" strokeWidth="2" fill="none" opacity="0.7" />
        <path d="M60 140 C34 112 34 66 58 28 C84 62 82 108 60 140 Z" fill="#D9B98A" opacity="0.85" transform="rotate(-26 60 148)" />
        <path d="M60 140 C34 112 34 66 58 28 C84 62 82 108 60 140 Z" fill="#B98B4E" opacity="0.8" transform="rotate(4 60 148)" />
        <path d="M60 140 C34 112 34 66 58 28 C84 62 82 108 60 140 Z" fill="#EAD9C2" opacity="0.95" transform="rotate(32 60 148)" />
    </svg>
);

const ForgotPassword = () => {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const resetToken = params.get('token');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const claimNo = useMemo(() => String(Date.now()).slice(-6), []);

    // Presentation only: which step of the recovery journey the person is on.
    const activeStep = resetToken ? 3 : message ? 2 : 1;

    const handleSubmit = async (event) => {
        event.preventDefault();
        setMessage('');
        setError('');
        if (resetToken && password !== confirmPassword) {
            setError('The new password and confirmation do not match.');
            return;
        }
        if (resetToken && password.length < 8) {
            setError('Your new password must be at least 8 characters.');
            return;
        }

        setIsLoading(true);
        try {
            if (resetToken) {
                await axios.post(`${API_BASE}/reset-password`, { token: resetToken, new_password: password });
                setMessage('Your password has been reset. You can now sign in with your new password.');
            } else {
                await axios.post(`${API_BASE}/forgot-password`, { email });
                setMessage('If an account uses that email, a password reset link has been sent. Check your inbox.');
            }
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'Unable to process your request. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const display = { fontFamily: "'Playfair Display', Georgia, serif" };
    const sans = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };
    const mono = { fontFamily: "'IBM Plex Mono', monospace" };

    // ── Success view — replaces the form once `message` is set ──
    const successView = (
        <div className="success-view">
            <div className="success-icon">
                <CheckCircle2 size={30} color="#fff" strokeWidth={2} />
            </div>
            <h3 className="success-title" style={display}>
                {resetToken ? 'Password Reset' : 'Recovery Email Sent'}
            </h3>
            <p className="success-desc" style={sans}>
                {resetToken ? 'You can now sign in with your new password.' : 'Check your inbox and spam folder.'}
            </p>
            <p className="success-detail" style={sans}>{message}</p>

            <Link to="/login" className="submit-btn" style={sans}>
                Return to Login <ArrowRight size={18} />
            </Link>

            {!resetToken && (
                <p className="success-retry" style={sans}>Didn't receive it? Try again after 60 seconds.</p>
            )}
        </div>
    );

    // ── Recovery form ──
    const recoveryForm = (
        <form onSubmit={handleSubmit}>
            {!resetToken ? (
                <div className="field-group">
                    <label className="field-label" htmlFor="fp-email">Account email</label>
                    <div className="input-wrap">
                        <Mail size={17} color={BURGUNDY} className="input-icon" />
                        <input
                            id="fp-email"
                            type="email" required value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            autoComplete="email" placeholder="Email address"
                            className="enterprise-input"
                            style={sans}
                        />
                    </div>
                </div>
            ) : (
                <>
                    <div className="field-group">
                        <label className="field-label" htmlFor="fp-new">New password</label>
                        <div className="input-wrap">
                            <Lock size={17} color={BURGUNDY} className="input-icon" />
                            <input
                                id="fp-new"
                                type="password" required minLength="8" value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                autoComplete="new-password"
                                className="enterprise-input"
                                style={sans}
                            />
                        </div>
                    </div>
                    <div className="field-group" style={{ marginTop: 'var(--gap)' }}>
                        <label className="field-label" htmlFor="fp-confirm">Confirm new password</label>
                        <div className="input-wrap">
                            <Lock size={17} color={BURGUNDY} className="input-icon" />
                            <input
                                id="fp-confirm"
                                type="password" required minLength="8" value={confirmPassword}
                                onChange={(event) => setConfirmPassword(event.target.value)}
                                autoComplete="new-password"
                                className="enterprise-input"
                                style={sans}
                            />
                        </div>
                    </div>
                </>
            )}

            <button type="submit" disabled={isLoading} className="submit-btn" style={sans}>
                {isLoading ? (
                    <>
                        <span className="spinner" />
                        Please wait…
                    </>
                ) : (
                    <>{resetToken ? 'Reset password' : 'Send Reset Link'} <ArrowRight size={18} /></>
                )}
            </button>
        </form>
    );

    return (
        <div className="fp-root page" style={{ ...sans, background: IVORY, color: INK }}>
            <GlobalStyle />

            {/* ── Full-bleed background: one continuous composition (no photography) ── */}
            <div className="fp-bg" aria-hidden="true">
                <svg className="bg-full" viewBox="0 0 1600 900" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="fp-panel-grad" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0" stopColor="#7A2748" />
                            <stop offset="1" stopColor={BURGUNDY_DEEP} />
                        </linearGradient>
                    </defs>

                    {/* soft cream sweeps on the left */}
                    <path d="M0,0 L760,0 C690,150 560,250 600,410 C640,550 520,690 300,750 C180,784 70,750 0,790 Z" fill="#F1E8DA" opacity="0.55" />
                    <path d="M0,0 L430,0 C380,110 300,170 320,290 C340,400 250,500 120,540 C70,556 30,552 0,570 Z" fill="#EAD9C2" opacity="0.35" />

                    {/* beige / cream waves along the bottom-left */}
                    <path d="M0,720 C200,660 380,760 600,800 C720,822 820,860 900,900 L0,900 Z" fill="#EAD9C2" opacity="0.75" />
                    <path d="M0,780 C220,730 420,820 640,850 C760,866 860,890 940,900 L0,900 Z" fill="#F1E8DA" opacity="0.9" />

                    {/* the maroon brand panel — organic left edge that bridges hero and card */}
                    <path
                        d="M1030,0 C940,110 820,190 826,330 C832,450 880,500 850,590 C820,680 700,760 540,830 C620,880 720,900 820,900 L1600,900 L1600,0 Z"
                        fill="url(#fp-panel-grad)"
                    />
                    <path
                        d="M1250,0 C1170,110 1070,200 1080,330 C1090,450 1130,520 1100,610 C1070,700 970,800 880,900 L1600,900 L1600,0 Z"
                        fill={BURGUNDY_DEEP}
                        opacity="0.5"
                    />
                    {/* bronze line following the panel edge */}
                    <path
                        d="M995,0 C898,118 782,196 788,336 C794,458 846,508 816,600 C786,694 668,774 520,838"
                        fill="none" stroke={GOLD} strokeWidth="1.6" opacity="0.7" vectorEffect="non-scaling-stroke"
                    />

                    {/* maroon wave in the bottom-left corner */}
                    <path d="M0,790 C150,800 330,860 480,900 L0,900 Z" fill={BURGUNDY} />
                    <path d="M0,830 C120,838 260,880 360,900 L0,900 Z" fill={BURGUNDY_DEEP} opacity="0.9" />
                    <path d="M0,790 C150,800 330,860 480,900" fill="none" stroke={GOLD} strokeWidth="1.6" opacity="0.6" vectorEffect="non-scaling-stroke" />
                </svg>

                <LeafCluster className="leaf leaf-edge" />
                <LeafCluster className="leaf leaf-bl" />
                <LeafCluster className="leaf leaf-br" flip />
            </div>

            <div className="fp-inner">
                {/* ── Top header: logo (home link) + academic year ── */}
                <header className="fp-header page-header">
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        aria-label="Back to Apple Scholar home"
                        className="logo-link"
                    >
                        <img src={appleLogo} alt="Apple Scholar" className="logo-img" />
                    </button>

                    <div className="header-meta" style={sans}>
                        <p className="header-meta-year">Academic Year 2026–2027</p>
                        <p className="header-meta-sub">Scholarship Compliance Tracking System</p>
                        <span className="header-meta-rule" />
                    </div>
                </header>

                <main className="fp-main">
                    {/* ═══ LEFT — editorial introduction ═══ */}
                    <section className="left-col">
                        <div className="anim-up">
                            <p className="hero-eyebrow">
                                Kalinga Foundation<br />Apple Scholar Program
                            </p>
                            <h1 className="hero-h1" style={display}>
                                {resetToken ? (
                                    <>Reset<br />Password</>
                                ) : (
                                    <>Forgot<br />Password?</>
                                )}
                            </h1>
                            <p className="hero-desc">
                                {resetToken
                                    ? 'Set a new password to regain access to your Apple Scholar account and continue your journey.'
                                    : 'No worries. Recover access to your Apple Scholar account and continue your journey.'}
                            </p>
                        </div>

                        <div className="highlights anim-up-2">
                            {highlights.map((h, i) => (
                                <div key={i} className="highlight-item">
                                    <span className="highlight-chip">
                                        <h.icon size={20} strokeWidth={1.7} />
                                    </span>
                                    <span className="highlight-label">{h.label}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* ═══ RIGHT — recovery card, resting on the maroon panel ═══ */}
                    <section className="right-col">
                        <div className="auth-card">
                            <div className="card-logo-wrap">
                                <img src={appleLogo} alt="Apple Scholar" className="card-logo" />
                            </div>

                            <h2 className="auth-title" style={display}>
                                {resetToken ? 'Create New Password' : 'Recover Your Account'}
                            </h2>
                            <p className="auth-subtitle" style={sans}>
                                {resetToken
                                    ? 'Set a new password for your Scholar Portal account.'
                                    : "Enter your registered email address and we'll send you a secure link to reset your password."}
                            </p>

                            {error && (
                                <div role="alert" className="alert alert-error" style={sans}>
                                    <AlertCircle size={18} color={BURGUNDY} className="flex-shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {message ? successView : recoveryForm}

                            {!message && (
                                <div className="secure-note">
                                    <div className="secure-head">
                                        <span className="secure-chip">
                                            <ShieldCheck size={18} color={BURGUNDY} strokeWidth={1.8} />
                                        </span>
                                        <div>
                                            <p className="secure-note-title">Secure Recovery</p>
                                            <p className="secure-note-text">Your information is protected.</p>
                                        </div>
                                    </div>
                                    <ul className="secure-list">
                                        {securityNotices.map((n, i) => (
                                            <li key={i}>{n}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {!message && (
                                <div className="back-row">
                                    <span className="back-line" />
                                    <Link to="/login" className="return-nav" style={sans}>
                                        <ArrowLeft size={15} /> Back to Login
                                    </Link>
                                    <span className="back-line" />
                                </div>
                            )}

                            {/* Progress steps */}
                            <ol className="steps" aria-label="Recovery progress">
                                {recoverySteps.map((s, i) => {
                                    const done = s.n <= activeStep;
                                    return (
                                        <li
                                            key={s.n}
                                            className="step"
                                            aria-current={s.n === activeStep ? 'step' : undefined}
                                        >
                                            {i > 0 && <span className={`step-line ${done ? 'step-line-done' : ''}`} />}
                                            <span className={`step-dot ${done ? 'step-dot-done' : ''}`}>0{s.n}</span>
                                            <span className="step-label" style={sans}>{s.label}</span>
                                        </li>
                                    );
                                })}
                            </ol>

                            <div className="card-footer" style={sans}>
                                <span>Kalinga Foundation · Recovery Center</span>
                                <span className="ref-id">
                                    Ref. <span style={mono}>REF-{claimNo}</span>
                                </span>
                            </div>
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
};

const GlobalStyle = () => (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes card-slide-up {
            from { opacity: 0; transform: translateY(20px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        .anim-up   { opacity: 0; animation: fade-in-up 0.7s cubic-bezier(.16,1,.3,1) 0.05s forwards; }
        .anim-up-2 { opacity: 0; animation: fade-in-up 0.7s cubic-bezier(.16,1,.3,1) 0.18s forwards; }

        /* ══ Sizing tokens — mobile/tablet defaults; desktop scales with the viewport ══ */
        .fp-root {
            --pad-x: 16px;
            --logo-w: 136px;
            --card-logo-w: 100px;
            --card-pad-y: 24px;
            --card-pad-x: 22px;
            --title-fs: 1.7rem;
            --sub-fs: 0.88rem;
            --input-h: 50px;
            --gap: 14px;
            --h1-fs: clamp(2.8rem, 13vw, 3.6rem);
            --dot: 32px;

            position: relative;
            width: 100%;
            min-height: 100vh;
            min-height: 100dvh;
            overflow-x: clip;
        }

        /* ══ Background ══ */
        .fp-bg { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
        .bg-full { display: none; position: absolute; inset: 0; width: 100%; height: 100%; }
        .leaf { display: none; position: absolute; height: auto; width: clamp(46px, 7.5vh, 84px); }

        /* ══ Shell ══ */
        .fp-inner { position: relative; z-index: 1; width: 100%; display: flex; flex-direction: column; }
        .fp-header { display: flex; flex-direction: column; gap: 14px; padding: 18px var(--pad-x) 10px; }
        .logo-link {
            background: none; border: none; padding: 0; margin: 0; cursor: pointer;
            display: block; line-height: 0; border-radius: 8px; align-self: flex-start;
        }
        .logo-link:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 4px; }
        .logo-img { width: var(--logo-w); height: auto; display: block; object-fit: contain; }

        .header-meta { text-align: left; }
        .header-meta-year { font-size: 0.82rem; font-weight: 700; color: ${BURGUNDY}; margin: 0 0 2px; }
        .header-meta-sub  { font-size: 0.76rem; color: ${TEXT_SOFT}; margin: 0; }
        .header-meta-rule { display: block; width: 44px; height: 2px; border-radius: 2px; background: ${GOLD}; margin: 8px 0 0; }

        /* mobile / tablet: vertical story, maroon zone wraps the card */
        .fp-main { display: flex; flex-direction: column; gap: 24px; padding: 6px var(--pad-x) 0; }
        .left-col { display: flex; flex-direction: column; gap: 22px; }
        .right-col {
            margin: 10px calc(var(--pad-x) * -1) 0;
            padding: 34px var(--pad-x) 40px;
            background: linear-gradient(160deg, #7A2748 0%, ${BURGUNDY_DEEP} 100%);
            border-radius: 50% 50% 0 0 / 34px 34px 0 0;
            display: flex; justify-content: center;
        }

        /* ══ Left — editorial intro ══ */
        .hero-eyebrow {
            font-size: 0.7rem; font-weight: 600; letter-spacing: 0.26em; text-transform: uppercase;
            line-height: 1.9; color: ${GOLD_DARK}; margin: 0 0 14px;
        }
        .hero-h1 { margin: 0 0 14px; line-height: 0.96; font-weight: 700; color: ${BURGUNDY}; font-size: var(--h1-fs); }
        .hero-desc { font-size: 0.98rem; line-height: 1.55; color: ${TEXT_SOFT}; max-width: 520px; margin: 0; }

        .highlights { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); max-width: 460px; }
        .highlight-item {
            display: flex; flex-direction: column; align-items: center; gap: 8px;
            padding: 0 6px; text-align: center; border-left: 1px solid ${BORDER};
        }
        .highlight-item:first-child { border-left: none; }
        .highlight-chip {
            width: 46px; height: 46px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
            background: rgba(185,139,78,0.16); color: ${BURGUNDY};
        }
        .highlight-label { font-size: 0.8rem; color: ${TEXT_SOFT}; line-height: 1.3; }

        /* ══ Recovery card ══ */
        .auth-card {
            width: 100%; max-width: 470px;
            background: ${CARD}; border: 1px solid ${BORDER}; border-radius: 20px;
            padding: var(--card-pad-y) var(--card-pad-x);
            box-shadow: 0 30px 60px -26px rgba(30,8,18,0.55);
            animation: card-slide-up 0.6s cubic-bezier(.16,1,.3,1) forwards;
        }
        .card-logo-wrap { display: flex; justify-content: center; margin-bottom: calc(var(--gap) * 0.6); }
        .card-logo { width: var(--card-logo-w); height: auto; display: block; object-fit: contain; }

        .auth-title {
            font-size: var(--title-fs); font-weight: 600; color: ${BURGUNDY_DEEP};
            text-align: center; margin: 0 0 calc(var(--gap) * 0.5); line-height: 1.15;
        }
        .auth-subtitle {
            font-size: var(--sub-fs); line-height: 1.5; color: ${TEXT_SOFT};
            text-align: center; margin: 0 0 var(--gap);
        }

        .alert {
            display: flex; align-items: flex-start; gap: 9px; border-radius: 10px;
            padding: 11px 13px; font-size: 0.82rem; line-height: 1.45; margin-bottom: var(--gap);
        }
        .alert-error { background: ${DANGER_BG}; color: ${DANGER_TEXT}; border-left: 3px solid ${BURGUNDY}; }

        .field-group { display: flex; flex-direction: column; }
        .field-label { font-size: 0.76rem; font-weight: 600; color: ${INK}; margin-bottom: 5px; }
        .input-wrap { position: relative; display: flex; align-items: center; }
        .input-icon { position: absolute; left: 15px; pointer-events: none; }
        .enterprise-input {
            width: 100%; height: var(--input-h); border-radius: 12px; border: 1px solid ${BORDER};
            background: ${CARD}; padding: 0 16px 0 42px; font-size: 0.92rem; color: ${INK};
            outline: none; transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .enterprise-input::placeholder { color: #B7A99E; }
        .enterprise-input:focus { border-color: ${BURGUNDY}; box-shadow: 0 0 0 4px rgba(109,33,64,0.12); }
        .enterprise-input:-webkit-autofill,
        .enterprise-input:-webkit-autofill:hover,
        .enterprise-input:-webkit-autofill:focus {
            -webkit-text-fill-color: ${INK};
            -webkit-box-shadow: 0 0 0px 1000px ${CARD} inset;
            transition: background-color 9999s ease-in-out 0s;
        }

        .submit-btn {
            width: 100%; height: var(--input-h); margin-top: var(--gap); border-radius: 12px; border: none;
            background: ${BURGUNDY}; color: #FFFFFF; font-size: 0.94rem; font-weight: 600;
            display: flex; align-items: center; justify-content: center; gap: 8px;
            cursor: pointer; text-decoration: none;
            box-shadow: 0 12px 24px -14px rgba(109,33,64,0.5);
            transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
        }
        .submit-btn:hover:not(:disabled) {
            background: ${BURGUNDY_DEEP}; transform: translateY(-2px);
            box-shadow: 0 16px 28px -14px rgba(74,23,48,0.55);
        }
        .submit-btn:disabled { opacity: 0.65; cursor: default; }
        .submit-btn:focus-visible, .return-nav:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 3px; }

        .spinner {
            width: 16px; height: 16px; border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff;
            display: inline-block; animation: spin 0.7s linear infinite;
        }

        /* Secure recovery panel */
        .secure-note { margin-top: var(--gap); padding: 12px 14px; border-radius: 16px; background: ${SAND}; }
        .secure-head { display: flex; align-items: center; gap: 12px; }
        .secure-chip {
            width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center; background: rgba(185,139,78,0.2);
        }
        .secure-note-title { font-size: 0.86rem; font-weight: 700; color: ${BURGUNDY_DEEP}; margin: 0 0 1px; }
        .secure-note-text { font-size: 0.78rem; color: ${TEXT_SOFT}; margin: 0; }
        .secure-list { margin: 8px 0 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 3px 14px; }
        .secure-list li { position: relative; padding-left: 11px; font-size: 0.72rem; color: ${MUTED}; line-height: 1.4; }
        .secure-list li::before {
            content: ''; position: absolute; left: 0; top: 6px; width: 4px; height: 4px; border-radius: 50%; background: ${GOLD};
        }

        /* Back to login */
        .back-row { display: flex; align-items: center; gap: 12px; margin-top: calc(var(--gap) * 0.8); }
        .back-line { flex: 1; height: 1px; background: ${BORDER}; }
        .return-nav {
            display: inline-flex; align-items: center; gap: 7px; color: ${BURGUNDY};
            font-size: 0.88rem; font-weight: 600; text-decoration: none; white-space: nowrap;
        }
        .return-nav:hover { color: ${BURGUNDY_DEEP}; text-decoration: underline; }

        /* Progress steps */
        .steps { list-style: none; margin: var(--gap) 0 0; padding: 0; display: flex; }
        .step { flex: 1; position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; min-width: 0; }
        .step-line { position: absolute; top: calc(var(--dot) / 2); right: 50%; width: 100%; height: 1px; background: ${BORDER}; z-index: 0; }
        .step-line-done { background: ${BURGUNDY}; }
        .step-dot {
            position: relative; z-index: 1; width: var(--dot); height: var(--dot); border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 0.72rem; font-weight: 700; background: ${SAND}; color: ${BURGUNDY}; border: 1px solid ${BORDER};
        }
        .step-dot-done { background: ${BURGUNDY}; color: #fff; border-color: ${BURGUNDY}; }
        .step-label { font-size: 0.68rem; color: ${TEXT_SOFT}; line-height: 1.25; max-width: 84px; }

        .card-footer {
            display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 12px;
            margin-top: var(--gap); padding-top: calc(var(--gap) * 0.6); border-top: 1px solid ${BORDER};
            font-size: 0.68rem; color: ${MUTED};
        }
        .ref-id { white-space: nowrap; }

        /* Success view */
        .success-view { text-align: center; padding: 2px 0 0; }
        .success-icon {
            width: 56px; height: 56px; border-radius: 50%;
            background: linear-gradient(135deg, ${SUCCESS} 0%, #2F6B41 100%);
            display: flex; align-items: center; justify-content: center; margin: 0 auto 12px;
        }
        .success-title { font-size: 1.25rem; font-weight: 700; color: ${INK}; margin: 0 0 6px; }
        .success-desc { font-size: 0.86rem; color: #3f2f28; margin: 0 0 4px; }
        .success-detail { font-size: 0.78rem; color: ${MUTED}; margin: 0 0 4px; line-height: 1.5; }
        .success-retry { font-size: 0.74rem; color: ${MUTED}; margin: 10px 0 0; }

        /* ══ Tablet (stacked) ══ */
        @media (min-width: 640px) {
            .fp-root { --pad-x: 28px; --card-pad-x: 32px; --card-pad-y: 30px; }
            .right-col { padding-top: 44px; padding-bottom: 52px; }
        }
        @media (min-width: 768px) {
            .fp-header { flex-direction: row; align-items: flex-start; justify-content: space-between; }
            .header-meta { text-align: right; }
            .header-meta-rule { margin-left: auto; }
            .fp-root { --pad-x: 40px; --h1-fs: 4.2rem; }
        }

        /* ══ Desktop — true full-width composition, one continuous scene ══ */
        @media (min-width: 1024px) {
            .fp-root {
                --pad-x: clamp(32px, 8.5vw, 220px);          /* left margin: logo + hero text */
                --card-right: clamp(28px, 6vw, 200px);       /* right margin: card + academic year */
                --card-w: clamp(420px, 27vw, 470px);

                --logo-w: clamp(120px, 14vh, 145px);
                --card-logo-w: clamp(58px, 8.6vh, 92px);
                --card-pad-y: clamp(14px, 2.7vh, 32px);
                --card-pad-x: clamp(22px, 2.2vw, 36px);
                --title-fs: clamp(24px, 3.9vh, 32px);
                --sub-fs: clamp(12px, 1.8vh, 13.5px);
                --input-h: clamp(40px, 5.8vh, 50px);
                --gap: clamp(6px, 1.35vh, 14px);
                --h1-fs: clamp(56px, min(4.2vw, 9.5vh), 84px);
                --dot: clamp(24px, 3.5vh, 30px);

                height: 100vh;
                height: 100dvh;
                min-height: 0;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }
            .fp-inner { flex: 1; min-height: 0; }

            .bg-full { display: block; }
            .leaf { display: block; }
            .leaf-bl   { left: 2.2%; bottom: 17vh; }
            .leaf-br   { right: 1%; bottom: 19vh; }
            .leaf-edge { display: none; left: 47.2%; top: 44%; }

            .fp-header {
                flex-direction: row; align-items: flex-start; justify-content: space-between;
                gap: 0;
                padding: clamp(14px, 3vh, 34px) var(--card-right) 0 var(--pad-x);
            }
            /* the academic year sits on the maroon panel */
            .header-meta-year { color: ${IVORY}; font-size: 0.84rem; }
            .header-meta-sub  { color: rgba(247,244,238,0.85); font-size: 0.76rem; }

            .fp-main {
                flex: 1;
                min-height: 0;
                box-sizing: border-box;
                display: grid;
                grid-template-columns: minmax(0, 1fr) var(--card-w);
                align-items: center;
                gap: 0;
                padding: 0 var(--card-right) clamp(12px, 2.2vh, 28px) var(--pad-x);
            }
            .left-col {
                gap: clamp(18px, 3vh, 30px);
                /* never reach the curved panel edge (≈ 51% of the viewport) */
                max-width: min(580px, calc(50vw - var(--pad-x) - 24px));
            }
            .right-col {
                margin: 0; padding: 0; background: none; border-radius: 0;
                min-height: 0; max-height: 100%;
                align-items: center; justify-content: flex-end;
            }
            .auth-card {
                max-width: none;
                border-radius: 26px;
                max-height: 100%;
                overflow-y: auto;       /* safety net only — the card is sized to fit */
                scrollbar-width: none;
            }
            .auth-card::-webkit-scrollbar { display: none; }

            .hero-eyebrow { font-size: clamp(0.72rem, 0.9vw, 0.9rem); margin-bottom: clamp(10px, 2.2vh, 22px); }
            .hero-h1 { margin-bottom: clamp(10px, 2.2vh, 20px); }
            .hero-desc { font-size: clamp(15px, min(1.25vw, 2.3vh), 20px); max-width: 520px; }
            .highlights { max-width: 470px; }
            .highlight-chip { width: clamp(42px, 6.4vh, 56px); height: clamp(42px, 6.4vh, 56px); }
            .highlight-label { font-size: 0.86rem; }

            /* tighter card internals */
            .secure-note { padding: clamp(8px, 1.4vh, 12px) 14px; }
            .secure-chip { width: clamp(30px, 4.6vh, 38px); height: clamp(30px, 4.6vh, 38px); }
            .secure-list { margin-top: clamp(4px, 0.9vh, 8px); gap: 2px 14px; }
        }

        @media (min-width: 1200px) {
            .leaf-edge { display: block; }
        }

        /* Short laptop viewports (e.g. 1366×768 with browser toolbars) */
        @media (min-width: 1024px) and (max-height: 700px) {
            .secure-list li { font-size: 0.68rem; }
            .secure-note-text { font-size: 0.74rem; }
            .step-label { font-size: 0.62rem; }
            .card-footer { font-size: 0.62rem; }
            .field-label { margin-bottom: 3px; }
        }

        /* ═══════════════════════════════════════════════════════════
           MOBILE (< 768px) — its own composition, not a stacked desktop.
           Everything below is scoped to max-width: 767px, so the
           desktop / tablet-landscape styles above are untouched.
           ═══════════════════════════════════════════════════════════ */
        @media (max-width: 767px) {
            .fp-root {
                --pad-x: 16px;
                --logo-w: 115px;
                --card-logo-w: 92px;
                --card-pad-y: 22px;
                --card-pad-x: 22px;
                --title-fs: clamp(23px, 7.4vw, 28px);
                --sub-fs: 12px;
                --input-h: 47px;
                --gap: 14px;
                --h1-fs: clamp(42px, 12vw, 52px);
                --dot: 32px;
                min-height: 100vh;
                min-height: 100dvh;
                overflow-y: auto;
            }

            /* simplified background: two soft organic curves behind the hero only */
            .fp-bg::before, .fp-bg::after { content: ''; position: absolute; pointer-events: none; }
            .fp-bg::before {
                top: -110px; right: -120px; width: 320px; height: 320px; border-radius: 50%;
                background: #EAD9C2; opacity: 0.38;
            }
            .fp-bg::after {
                top: 150px; left: -150px; width: 300px; height: 300px; border-radius: 50%;
                border: 1.5px solid ${GOLD}; opacity: 0.25;
            }

            /* page fills the screen; the maroon zone stretches to the bottom edge */
            .fp-inner { min-height: 100vh; min-height: 100dvh; }

            /* compact, centred header */
            .fp-header { align-items: center; gap: 12px; padding: 18px 20px 8px; }
            .logo-link { align-self: center; }
            .header-meta { text-align: center; }
            .header-meta-year { font-size: 11.5px; margin: 0 0 2px; }
            .header-meta-sub { font-size: 9.5px; }
            .header-meta-rule { width: 36px; margin: 7px auto 0; }

            /* hero */
            .fp-main { flex: 1; gap: 0; padding: 14px var(--pad-x) 0; }
            .left-col { gap: 20px; padding: 0 4px; }
            .hero-eyebrow { font-size: 9.5px; letter-spacing: 2.4px; line-height: 1.8; margin: 0 0 10px; }
            .hero-h1 { line-height: 0.95; margin: 0 0 12px; }
            .hero-desc { font-size: 13px; line-height: 1.45; max-width: 340px; }

            /* security indicators — small, fit inside calc(100% - 40px) */
            .highlights { gap: 4px; max-width: 100%; }
            .highlight-item { gap: 6px; padding: 0 4px; }
            .highlight-chip { width: 36px; height: 36px; }
            .highlight-chip svg { width: 17px; height: 17px; }
            .highlight-label { font-size: 10.5px; }

            /* maroon curve introduces the recovery card */
            .right-col {
                flex: 1;
                align-items: flex-start;
                margin: 22px calc(var(--pad-x) * -1) 0;
                padding: 28px var(--pad-x) 32px;
                border-radius: 50% 50% 0 0 / 24px 24px 0 0;
            }
            .auth-card { max-width: 430px; margin-inline: auto; border-radius: 20px; }

            /* card internals */
            .card-logo-wrap { margin-bottom: 8px; }
            .auth-title { line-height: 1.05; margin-bottom: 8px; }
            .auth-subtitle { font-size: 12px; line-height: 1.4; max-width: 300px; margin: 0 auto var(--gap); }
            .field-label { font-size: 12px; }
            .enterprise-input { font-size: 13px; }
            .submit-btn { font-size: 13.5px; }

            .secure-note { padding: 12px; border-radius: 14px; }
            .secure-head { gap: 10px; }
            .secure-chip { width: 32px; height: 32px; }
            .secure-note-title { font-size: 11.5px; }
            .secure-note-text { font-size: 11px; }
            .secure-list { margin-top: 6px; gap: 2px 12px; }
            .secure-list li { font-size: 10.5px; }

            .back-row { margin-top: 15px; }
            .return-nav { font-size: 12.5px; }

            .steps { margin-top: 16px; }
            .step-label { font-size: 9.5px; max-width: 74px; }
            .step-dot { font-size: 11px; }
            .step-line { background: rgba(231,216,199,0.75); }
            .step-line-done { background: ${BURGUNDY}; }

            .card-footer { font-size: 9.5px; }
        }

        @media (max-width: 767px) and (min-width: 390px) {
            .fp-root { --pad-x: 18px; }
        }
        @media (max-width: 767px) and (min-width: 430px) {
            .fp-root { --pad-x: 20px; --card-pad-x: 24px; --card-pad-y: 24px; }
            .left-col { padding: 0 4px; }
        }

        /* 320px special case */
        @media (max-width: 340px) {
            .fp-root {
                --pad-x: 14px;
                --logo-w: 105px;
                --card-logo-w: 82px;
                --card-pad-y: 18px;
                --card-pad-x: 18px;
                --title-fs: 23px;
                --h1-fs: 40px;
                --dot: 28px;
            }
            .fp-header { padding: 16px 16px 8px; }
            .left-col { padding: 0 6px; }
            .highlight-chip { width: 32px; height: 32px; }
            .highlight-chip svg { width: 16px; height: 16px; }
            .highlight-label { font-size: 10px; }
            .secure-list { gap: 2px 10px; }
            .step-label { font-size: 9px; max-width: 64px; }
        }

        @media (prefers-reduced-motion: reduce) {
            .anim-up, .anim-up-2 { animation: none; opacity: 1; }
            .auth-card { animation: none; }
            .submit-btn { transition: none; }
        }
    `}</style>
);

export default ForgotPassword;