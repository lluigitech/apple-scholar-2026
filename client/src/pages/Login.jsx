import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
    Eye,
    EyeOff,
    Mail,
    Lock,
    AlertCircle,
    ShieldCheck,
    GraduationCap,
    Users,
    ArrowRight,
} from 'lucide-react';

// Official Apple Scholar logo — also the way back to the landing page
import appleLogo from '../assets/logo/applelogo.png';

// Same institutional photo already used on the Landing Page hero, so Login
// feels like the same place — src/assets/landing/papaya-academy-building-1.jpg
import heroPhoto from '../assets/landing/papaya-academy-building-1.jpg';

// ── Token system — Portal Login (quiet luxury, minimal executive) ──
const PRIMARY = '#6D2140';
const PRIMARY_DEEP = '#4A1730';
const ACCENT = '#B98B4E';
const ACCENT_DARK = '#8F6A35'; // bronze for small text on light surfaces
const BG = '#F7F4EE';
const CARD = '#FFFDF9';
const BORDER = '#E7D8C7';
const SAND = '#FBF1E6';
const INK = '#241512';
const INK_SOFT = '#5C4E42';
const MUTED = '#8A7A68';
const ERROR_BG = '#FBEAEA';
const ERROR_TEXT = '#8E2631';

const display = { fontFamily: "'Playfair Display', Georgia, serif" };
const sans = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };

const heroStats = [
    { icon: GraduationCap, value: '300+', label: 'Active Scholars' },
    { icon: Users, value: '4', label: 'User Roles' },
    { icon: ShieldCheck, value: '95%', label: 'Compliance Rate' },
];

// Small leaf-inspired decoration (purely visual) — same as Forgot Password
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

const Login = () => {
    // "Remember me" only remembers the email address on this device.
    const [email, setEmail] = useState(() => {
        try { return localStorage.getItem('remembered_email') || ''; } catch { return ''; }
    });
    const [rememberMe, setRememberMe] = useState(() => {
        try { return !!localStorage.getItem('remembered_email'); } catch { return false; }
    });
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [heroPhotoFailed, setHeroPhotoFailed] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const res = await axios.post('http://localhost:5000/api/login', { email, password });
            if (res.data.status === "Success") {
                const userRole = res.data.role.toLowerCase().trim();
                localStorage.setItem('token', res.data.token);
                localStorage.setItem('role', userRole);
                localStorage.setItem('name', res.data.name);
                localStorage.setItem('email', res.data.email || email);
                localStorage.setItem('id', res.data.id);
                localStorage.setItem('scholar_id', res.data.scholar_id);
                if (res.data.must_change_password && userRole === 'scholar') {
                    localStorage.setItem('must_change_password', 'true');
                } else {
                    localStorage.removeItem('must_change_password');
                }

                const rolesMapping = {
                    admin: '/admin',
                    staff: '/staff',
                    scholar: '/scholar',
                    officer: '/officer',
                };
                navigate(res.data.must_change_password && userRole === 'scholar' ? '/account/setup' : (rolesMapping[userRole] || '/scholar'));
            } else {
                setError('Invalid credentials. Please try again.');
            }
        } catch (err) {
            if (err.response?.status === 401) {
                setError('Wrong email or password.');
            } else if (err.response?.status === 404) {
                setError('Account not found.');
            } else {
                setError('Cannot connect to server. Please try again later.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Runs before the (unchanged) login handler: stores or clears the remembered email.
    const handleSubmit = (e) => {
        try {
            if (rememberMe) localStorage.setItem('remembered_email', email);
            else localStorage.removeItem('remembered_email');
        } catch { /* storage unavailable — ignore */ }
        handleLogin(e);
    };

    return (
        <div className="login-root" style={{ ...sans, background: BG, color: INK }}>
            <GlobalStyle />

            {/* ── Full-bleed background: same composition as Forgot Password ── */}
            <div className="login-bg" aria-hidden="true">
                <svg className="bg-full" viewBox="0 0 1600 900" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="login-panel-grad" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0" stopColor="#7A2748" />
                            <stop offset="1" stopColor={PRIMARY_DEEP} />
                        </linearGradient>
                    </defs>

                    {/* soft cream sweeps on the left */}
                    <path d="M0,0 L760,0 C690,150 560,250 600,410 C640,550 520,690 300,750 C180,784 70,750 0,790 Z" fill="#F1E8DA" opacity="0.55" />
                    <path d="M0,0 L430,0 C380,110 300,170 320,290 C340,400 250,500 120,540 C70,556 30,552 0,570 Z" fill="#EAD9C2" opacity="0.35" />

                    {/* flowing maroon fabric — enters from the upper right, curves toward the centre, wraps behind the card and runs into the bottom waves */}
                    <path
                        d="M1090,0 C1000,90 880,170 850,290 C830,380 900,420 880,500 C860,590 820,680 740,735 C700,762 650,784 590,800 C700,840 820,870 940,900 L1600,900 L1600,0 Z"
                        fill="url(#login-panel-grad)"
                    />
                    <path
                        d="M1300,0 C1220,100 1110,190 1100,320 C1092,420 1140,470 1110,570 C1085,650 1010,760 930,900 L1600,900 L1600,0 Z"
                        fill={PRIMARY_DEEP}
                        opacity="0.5"
                    />
                    {/* bronze line riding the fabric edge */}
                    <path
                        d="M1125,0 C965,120 800,210 830,350 C850,450 905,480 872,580 C845,665 770,735 640,790"
                        fill="none" stroke={ACCENT} strokeWidth="1.6" opacity="0.7" vectorEffect="non-scaling-stroke"
                    />

                    {/* bottom waves — about 10% of the height: beige, cream, bronze, maroon, deep maroon */}
                    <path d="M0,812 C220,790 420,836 700,826 C960,818 1160,850 1600,822 L1600,900 L0,900 Z" fill="#EAD9C2" opacity="0.85" />
                    <path d="M0,836 C260,816 480,858 780,846 C1060,834 1280,866 1600,844 L1600,900 L0,900 Z" fill="#F4ECE0" />
                    <path d="M0,846 C260,828 500,868 800,856 C1080,844 1300,874 1600,854" fill="none" stroke={ACCENT} strokeWidth="1.6" opacity="0.7" vectorEffect="non-scaling-stroke" />
                    <path d="M0,858 C250,846 520,880 800,868 C1080,856 1340,888 1600,866 L1600,900 L0,900 Z" fill={PRIMARY} />
                    <path d="M0,880 C300,872 560,894 840,888 C1100,882 1380,898 1600,888 L1600,900 L0,900 Z" fill={PRIMARY_DEEP} opacity="0.9" />
                </svg>

                <LeafCluster className="leaf leaf-bl" />
                <LeafCluster className="leaf leaf-edge" />
                <LeafCluster className="leaf leaf-br" flip />
            </div>

            <div className="login-inner">
                {/* ── Top header: logo (home link) + academic year ── */}
                <header className="login-header">
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

                <main className="login-main">
                    {/* ═══ LEFT — welcome, stats, photo ═══ */}
                    <section className="left-col">
                        <div className="welcome-block anim-up">
                            <p className="hero-eyebrow">
                                Kalinga Foundation<br />Apple Scholar Program
                            </p>
                            <h1 className="hero-h1" style={display}>
                                <span className="hero-h1-strong">Welcome back.</span>
                                <span className="hero-h1-light">Continue your journey.</span>
                            </h1>
                            <p className="hero-desc">
                                Access your portal to manage compliance, submit requirements, and track your academic progress.
                            </p>
                        </div>

                        {/* Stats */}
                        <div className="stats-row anim-up-2">
                            {heroStats.map((s, i) => (
                                <div key={i} className="stat-item">
                                    <span className="stat-chip">
                                        <s.icon size={18} strokeWidth={1.8} />
                                    </span>
                                    <div className="stat-text">
                                        <p className="stat-value" style={display}>{s.value}</p>
                                        <p className="stat-label">{s.label}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Photo — visual anchor of the left side */}
                        <div className="photo-card anim-up-3">
                            {heroPhotoFailed ? (
                                <div className="photo-fallback" role="img" aria-label="Apple Scholar students" />
                            ) : (
                                <img
                                    src={heroPhoto}
                                    alt="Apple Scholar students gathered in front of Papaya Academy"
                                    className="photo-img"
                                    onError={() => setHeroPhotoFailed(true)}
                                />
                            )}
                            {/* cream wave melting the photo into the page background */}
                            <svg className="photo-wave" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                                <path d="M0,100 L0,86 C16,97 34,78 56,86 C76,93 90,83 100,78 L100,100 Z" fill="#F3EBDF" />
                            </svg>
                        </div>
                    </section>

                    {/* ═══ RIGHT — login card, resting on the maroon panel ═══ */}
                    <section className="right-col">
                        <div className="auth-card">
                            <div className="card-logo-wrap">
                                <img src={appleLogo} alt="Apple Scholar" className="card-logo" />
                            </div>

                            <h2 className="auth-title" style={display}>Access Portal</h2>
                            <p className="auth-sub">Log in to continue to your account.</p>

                            {error && (
                                <div className="error-alert" role="alert">
                                    <AlertCircle size={16} color={ERROR_TEXT} className="flex-shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <form onSubmit={handleSubmit}>
                                <div className="field-group">
                                    <label className="field-label" htmlFor="login-email">Email address</label>
                                    <div className="input-wrap">
                                        <Mail size={18} color={PRIMARY} className="input-icon" />
                                        <input
                                            id="login-email"
                                            type="email" required placeholder="yourname@kalinga.org"
                                            value={email} onChange={(e) => setEmail(e.target.value)}
                                            autoComplete="email"
                                            className="portal-input"
                                            style={sans}
                                        />
                                    </div>
                                </div>

                                <div className="field-group" style={{ marginTop: 'var(--gap)' }}>
                                    <label className="field-label" htmlFor="login-password">Password</label>
                                    <div className="input-wrap">
                                        <Lock size={18} color={PRIMARY} className="input-icon" />
                                        <input
                                            id="login-password"
                                            type={showPassword ? 'text' : 'password'} required placeholder="Enter your password"
                                            value={password} onChange={(e) => setPassword(e.target.value)}
                                            autoComplete="current-password"
                                            className="portal-input"
                                            style={{ ...sans, paddingRight: 46 }}
                                        />
                                        <button
                                            type="button" onClick={() => setShowPassword((s) => !s)}
                                            className="visibility-toggle"
                                            tabIndex={-1}
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="forgot-row">
                                    <label className="remember-label">
                                        <input
                                            type="checkbox"
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                            className="remember-box"
                                        />
                                        <span>Remember me</span>
                                    </label>
                                    <button type="button" onClick={() => navigate('/forgot-password')} className="forgot-link" style={sans}>
                                        Forgot password?
                                    </button>
                                </div>

                                <button
                                    type="submit" disabled={isLoading}
                                    className="submit-btn"
                                    style={sans}
                                >
                                    {isLoading ? (
                                        <>
                                            <span className="spinner" />
                                            Logging in…
                                        </>
                                    ) : (
                                        <>
                                            Log in
                                            <ArrowRight size={18} />
                                        </>
                                    )}
                                </button>
                            </form>

                            {/* Secure access — small supporting card */}
                            <div className="secure-note">
                                <svg className="secure-leaf" viewBox="0 0 120 90" aria-hidden="true">
                                    <path d="M70 90 C58 60 66 28 96 6 C108 36 100 68 70 90 Z" fill={ACCENT} opacity="0.22" />
                                    <path d="M96 90 C92 70 100 50 118 38 C122 58 114 78 96 90 Z" fill={ACCENT} opacity="0.16" />
                                </svg>
                                <span className="secure-chip">
                                    <ShieldCheck size={20} color={PRIMARY} strokeWidth={1.8} />
                                </span>
                                <div className="secure-text">
                                    <p className="secure-note-title">Secure Access</p>
                                    <p className="secure-note-text">Your information is protected.</p>
                                    <p className="secure-note-meta">Authorized scholars, staff, officers &amp; administrators</p>
                                </div>
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
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');

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
        .anim-up-3 { opacity: 0; animation: fade-in-up 0.7s cubic-bezier(.16,1,.3,1) 0.3s forwards; }

        /* ══ Sizing tokens — same system as Forgot Password ══ */
        .login-root {
            --pad-x: 16px;
            --logo-w: 115px;
            --card-logo-w: 92px;
            --card-pad-y: 22px;
            --card-pad-x: 22px;
            --title-fs: clamp(24px, 7.6vw, 30px);
            --sub-fs: 12.5px;
            --input-h: 47px;
            --gap: 14px;
            --h1a: clamp(2.2rem, 11vw, 3.3rem);
            --h1b: clamp(1.45rem, 7.2vw, 2.2rem);
            --photo-h: clamp(160px, 46vw, 180px);

            position: relative;
            width: 100%;
            min-height: 100vh;
            min-height: 100dvh;
            overflow-x: clip;
        }

        /* ══ Background ══ */
        .login-bg { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
        .bg-full { display: none; position: absolute; inset: 0; width: 100%; height: 100%; }
        .leaf { display: none; position: absolute; height: auto; width: clamp(46px, 7.5vh, 84px); }
        /* mobile / tablet: two quiet organic curves behind the hero only */
        .login-bg::before, .login-bg::after { content: ''; position: absolute; pointer-events: none; }
        .login-bg::before { top: -110px; right: -120px; width: 320px; height: 320px; border-radius: 50%; background: #EAD9C2; opacity: 0.38; }
        .login-bg::after  { top: 150px; left: -150px; width: 300px; height: 300px; border-radius: 50%; border: 1.5px solid ${ACCENT}; opacity: 0.25; }

        /* ══ Shell ══ */
        .login-inner {
            position: relative; z-index: 1; width: 100%;
            min-height: 100vh; min-height: 100dvh;
            display: flex; flex-direction: column;
        }
        .login-header { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 18px 20px 8px; }
        .logo-link {
            background: none; border: none; padding: 0; margin: 0; cursor: pointer;
            display: block; line-height: 0; border-radius: 8px;
        }
        .logo-link:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 4px; }
        .logo-img { width: var(--logo-w); height: auto; display: block; object-fit: contain; }

        .header-meta { text-align: center; }
        .header-meta-year { font-size: 11.5px; font-weight: 700; color: ${PRIMARY}; margin: 0 0 2px; }
        .header-meta-sub  { font-size: 9.5px; color: ${INK_SOFT}; margin: 0; }
        .header-meta-rule { display: block; width: 36px; height: 2px; border-radius: 2px; background: ${ACCENT}; margin: 7px auto 0; }

        /* mobile / tablet: vertical story, maroon zone wraps the card */
        .login-main { flex: 1; display: flex; flex-direction: column; padding: 14px var(--pad-x) 0; }
        .left-col { display: flex; flex-direction: column; gap: 18px; padding: 0 4px; }
        .right-col {
            flex: 1;
            margin: 24px calc(var(--pad-x) * -1) 0;
            padding: 28px var(--pad-x) 32px;
            background: linear-gradient(160deg, #7A2748 0%, ${PRIMARY_DEEP} 100%);
            border-radius: 50% 50% 0 0 / 24px 24px 0 0;
            display: flex; justify-content: center; align-items: flex-start;
        }

        /* ══ Left — editorial introduction ══ */
        .hero-eyebrow {
            font-size: 9.5px; font-weight: 600; letter-spacing: 2.4px; text-transform: uppercase;
            line-height: 1.8; color: ${ACCENT_DARK}; margin: 0 0 12px;
        }
        .hero-h1 { margin: 0 0 12px; line-height: 1; color: ${PRIMARY_DEEP}; }
        .hero-h1-strong { display: block; font-weight: 700; font-size: var(--h1a); line-height: 0.98; color: ${PRIMARY_DEEP}; }
        .hero-h1-light  { display: block; font-weight: 400; font-size: var(--h1b); line-height: 1.05; color: ${PRIMARY}; margin-top: 4px; }
        .hero-desc { font-size: 13.5px; line-height: 1.5; color: #5F554F; max-width: 520px; margin: 0; }

        .stats-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; max-width: 34rem; }
        .stat-item {
            display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center;
            padding: 0 4px; border-left: 1px solid ${BORDER};
        }
        .stat-item:first-child { border-left: none; }
        .stat-chip {
            width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            background: rgba(185,139,78,0.16); color: ${PRIMARY};
        }
        .stat-value { font-size: 1.2rem; font-weight: 600; color: ${PRIMARY_DEEP}; margin: 0; line-height: 1.05; }
        .stat-label { font-size: 0.68rem; color: ${MUTED}; margin: 3px 0 0; line-height: 1.3; }

        .photo-card {
            position: relative; overflow: hidden; isolation: isolate;
            width: 100%; height: var(--photo-h); border-radius: 20px; background: ${PRIMARY_DEEP};
        }
        .photo-img {
            position: absolute; inset: 0; width: 100%; height: 100%;
            object-fit: cover; object-position: center bottom;
            transition: transform 0.9s cubic-bezier(.16,1,.3,1);
        }
        @media (hover: hover) { .photo-card:hover .photo-img { transform: scale(1.04); } }
        .photo-fallback { position: absolute; inset: 0; background: linear-gradient(160deg, ${PRIMARY} 0%, ${PRIMARY_DEEP} 80%); }
        .photo-wave { position: absolute; left: 0; bottom: -1px; width: 100%; height: 22%; display: block; }

        /* ══ Login card — identical treatment to the Recovery card ══ */
        .auth-card {
            width: 100%; max-width: 470px;
            background: ${CARD}; border: 1px solid ${BORDER}; border-radius: 20px;
            padding: var(--card-pad-y) var(--card-pad-x);
            box-shadow: 0 30px 60px -26px rgba(30,8,18,0.55);
            box-sizing: border-box;
            animation: card-slide-up 0.6s cubic-bezier(.16,1,.3,1) forwards;
        }
        .card-logo-wrap { display: flex; justify-content: center; margin-bottom: calc(var(--gap) * 0.6); }
        .card-logo { width: var(--card-logo-w); height: auto; display: block; object-fit: contain; }

        .auth-title {
            font-size: var(--title-fs); font-weight: 600; color: ${PRIMARY_DEEP};
            text-align: center; margin: 0 0 calc(var(--gap) * 0.5); line-height: 1.15;
        }
        .auth-sub { font-size: var(--sub-fs); line-height: 1.5; color: ${INK_SOFT}; text-align: center; margin: 0 0 var(--gap); }

        .error-alert {
            display: flex; align-items: flex-start; gap: 9px; border-radius: 10px;
            background: ${ERROR_BG}; color: ${ERROR_TEXT}; border-left: 3px solid ${PRIMARY};
            padding: 11px 13px; font-size: 0.82rem; line-height: 1.45; font-weight: 500; margin-bottom: var(--gap);
        }

        .field-group { display: flex; flex-direction: column; }
        .field-label { font-size: 0.76rem; font-weight: 600; color: ${INK}; margin-bottom: 5px; }
        .input-wrap { position: relative; display: flex; align-items: center; }
        .input-icon { position: absolute; left: 15px; pointer-events: none; }
        .portal-input {
            width: 100%; height: var(--input-h); border-radius: 12px; border: 1px solid ${BORDER};
            background: ${CARD}; padding: 0 16px 0 42px; font-size: 0.92rem; color: ${INK};
            outline: none; transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .portal-input::placeholder { color: #B7A99E; }
        .portal-input:focus { border-color: ${PRIMARY}; box-shadow: 0 0 0 4px rgba(109,33,64,0.12); }
        .portal-input:-webkit-autofill,
        .portal-input:-webkit-autofill:hover,
        .portal-input:-webkit-autofill:focus {
            -webkit-text-fill-color: ${INK};
            -webkit-box-shadow: 0 0 0px 1000px ${CARD} inset;
            transition: background-color 9999s ease-in-out 0s;
        }
        .visibility-toggle {
            position: absolute; right: 14px; color: ${MUTED}; display: flex;
            background: none; border: none; cursor: pointer; transition: color 0.15s ease;
        }
        .visibility-toggle:hover { color: ${INK}; }

        .forgot-row { display: flex; align-items: center; justify-content: space-between; gap: 6px 12px; margin-top: var(--gap); flex-wrap: wrap; }
        .remember-label { display: inline-flex; align-items: center; gap: 8px; font-size: 0.8rem; color: ${INK_SOFT}; cursor: pointer; }
        .remember-box { width: 16px; height: 16px; accent-color: ${PRIMARY}; cursor: pointer; }
        .forgot-link { font-size: 0.8rem; font-weight: 600; color: ${PRIMARY}; background: none; border: none; cursor: pointer; padding: 0; }
        .forgot-link:hover { text-decoration: underline; color: ${PRIMARY_DEEP}; }

        .submit-btn {
            width: 100%; height: var(--input-h); margin-top: var(--gap); border-radius: 12px; border: none;
            background: ${PRIMARY}; color: #FFFFFF; font-size: 0.94rem; font-weight: 600;
            display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer;
            box-shadow: 0 12px 24px -14px rgba(109,33,64,0.5);
            transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
        }
        .submit-btn:hover:not(:disabled) {
            background: ${PRIMARY_DEEP}; transform: translateY(-2px);
            box-shadow: 0 16px 28px -14px rgba(74,23,48,0.55);
        }
        .submit-btn:disabled { opacity: 0.65; cursor: default; }
        .submit-btn:focus-visible, .forgot-link:focus-visible, .visibility-toggle:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 3px; }

        .spinner {
            width: 16px; height: 16px; border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff;
            display: inline-block; animation: spin 0.7s linear infinite;
        }

        /* Secure access — same panel as "Secure Recovery" */
        .secure-note {
            position: relative; overflow: hidden; display: flex; align-items: center; gap: 12px;
            margin-top: var(--gap); padding: 12px 14px; border-radius: 16px; background: ${SAND};
        }
        .secure-leaf { position: absolute; right: 0; bottom: 0; width: 90px; height: 68px; pointer-events: none; }
        .secure-chip {
            width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center; background: rgba(185,139,78,0.2);
        }
        .secure-text { position: relative; min-width: 0; }
        .secure-note-title { font-size: 0.86rem; font-weight: 700; color: ${PRIMARY_DEEP}; margin: 0 0 1px; }
        .secure-note-text { font-size: 0.78rem; color: ${INK_SOFT}; margin: 0; }
        .secure-note-meta { font-size: 0.72rem; color: ${MUTED}; margin: 3px 0 0; line-height: 1.4; }

        /* ══ Mobile refinements ══ */
        @media (min-width: 390px) { .login-root { --pad-x: 18px; } }
        @media (min-width: 430px) { .login-root { --pad-x: 20px; --card-pad-x: 24px; --card-pad-y: 24px; } }

        /* ══ Tablet (stacked) ══ */
        @media (min-width: 640px) {
            .login-root { --pad-x: 28px; --card-pad-x: 32px; --card-pad-y: 30px; --logo-w: 130px; --card-logo-w: 100px; --title-fs: 32px; --input-h: 50px; --photo-h: 240px; --h1a: 3.6rem; --h1b: 2.5rem; }
            .hero-eyebrow { font-size: 11px; }
            .hero-desc { font-size: 15px; }
            .left-col { max-width: 640px; }
            .stat-item { flex-direction: row; text-align: left; gap: 10px; padding: 0 12px; }
            .stat-chip { width: 42px; height: 42px; }
            .stat-value { font-size: 1.45rem; }
            .stat-label { font-size: 0.78rem; }
            .photo-card, .auth-card { border-radius: 24px; }
            .right-col { padding-top: 44px; padding-bottom: 52px; }
        }
        @media (min-width: 768px) {
            .login-header { flex-direction: row; align-items: flex-start; justify-content: space-between; }
            .header-meta { text-align: right; }
            .header-meta-year { font-size: 0.84rem; }
            .header-meta-sub { font-size: 0.76rem; }
            .header-meta-rule { margin: 8px 0 0 auto; width: 44px; }
            .login-root { --pad-x: 40px; }
            .login-header { padding: 18px var(--pad-x) 10px; }
        }

        /* ══ Desktop — true full-width composition, one continuous scene ══ */
        @media (min-width: 1024px) {
            .login-root {
                --pad-x: clamp(32px, 6vw, 170px);          /* left margin: logo + hero */
                --card-right: clamp(28px, 7vw, 200px);     /* right margin: card + academic year */
                --card-w: clamp(420px, 31vw, 460px);

                --logo-w: clamp(120px, 14vh, 145px);
                --card-logo-w: clamp(70px, 10.5vh, 112px);
                --card-pad-y: clamp(16px, 3.1vh, 32px);
                --card-pad-x: clamp(22px, 2.2vw, 36px);
                --title-fs: clamp(28px, 4.6vh, 36px);
                --sub-fs: clamp(12px, 1.8vh, 13.5px);
                --input-h: clamp(42px, 6vh, 52px);
                --gap: clamp(7px, 1.5vh, 14px);
                --photo-h: clamp(170px, 24vh, 210px);
                --h1a: clamp(44px, min(5vw, 8.4vh), 72px);
                --h1b: calc(var(--h1a) * 0.84);

                height: 100vh;
                height: 100dvh;
                min-height: 0;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }
            .login-inner { flex: 1; min-height: 0; }
            .bg-full { display: block; }
            .leaf { display: block; }
            .leaf-bl   { left: clamp(8px, 2vw, 40px); bottom: 10vh; }
            .leaf-br   { right: 1.2%; bottom: 16vh; }
            .leaf-edge { display: none; left: 51.5%; top: 42%; }
            .login-bg::before, .login-bg::after { display: none; }

            .login-header {
                flex-direction: row; align-items: flex-start; justify-content: space-between; gap: 0;
                padding: clamp(14px, 3vh, 34px) var(--card-right) 0 var(--pad-x);
            }
            /* the academic year sits on the maroon panel */
            .header-meta-year { color: ${BG}; font-size: 0.84rem; }
            .header-meta-sub  { color: rgba(247,244,238,0.85); font-size: 0.76rem; }

            .login-main {
                flex: 1; min-height: 0; box-sizing: border-box;
                display: grid;
                grid-template-columns: minmax(0, 1fr) var(--card-w);
                align-items: center; gap: 0;
                padding: 0 var(--card-right) clamp(40px, 11vh, 120px) var(--pad-x);
            }
            .left-col {
                gap: clamp(16px, 3vh, 30px); padding: 0; width: 100%;
                /* never reach the curved panel edge (≈ 51% of the viewport) */
                max-width: min(clamp(560px, 44vw, 860px), calc(100vw - var(--pad-x) - var(--card-right) - var(--card-w) - 48px));
            }
            .right-col {
                margin: 0; padding: 0; background: none; border-radius: 0;
                min-height: 0; max-height: 100%;
                align-items: center; justify-content: flex-end;
            }
            .auth-card {
                max-width: none; border-radius: 26px; max-height: 100%;
                overflow-y: auto;       /* safety net only — the card is sized to fit */
                scrollbar-width: none;
            }
            .auth-card::-webkit-scrollbar { display: none; }

            .hero-eyebrow { font-size: clamp(0.72rem, 0.9vw, 0.9rem); letter-spacing: 0.26em; margin-bottom: clamp(12px, 2.6vh, 24px); }
            .hero-h1 { margin-bottom: clamp(10px, 2vh, 18px); }
            .hero-desc { font-size: clamp(15px, min(1.2vw, 2.3vh), 17px); max-width: 520px; }

            .stats-row { gap: 12px; max-width: 100%; }
            .stat-item { padding: 0 0 0 14px; }
            .stat-item:first-child { padding-left: 0; }
            .stat-chip { width: clamp(36px, 5.4vh, 42px); height: clamp(36px, 5.4vh, 42px); }
            .stat-value { font-size: clamp(1.25rem, 3vh, 1.6rem); }

            .photo-card { flex: none; }

            .secure-note { padding: clamp(8px, 1.4vh, 12px) 14px; }
            .secure-chip { width: clamp(30px, 4.6vh, 38px); height: clamp(30px, 4.6vh, 38px); }
        }

        @media (min-width: 1200px) {
            .leaf-edge { display: block; }
        }
        /* Very large screens: bigger photo, same card — extra room goes to the background */
        @media (min-width: 1700px) and (min-height: 950px) {
            .login-root { --photo-h: clamp(200px, 24vh, 260px); }
        }

        /* Short laptop viewports (e.g. 1366×768 with browser toolbars) */
        @media (min-width: 1024px) and (max-height: 760px) {
            .secure-note-meta { display: none; }
        }
        /* Extremely short windows: scroll instead of clipping */
        @media (min-width: 1024px) and (max-height: 600px) {
            .login-root { height: auto; min-height: 100dvh; overflow: visible; }
            .login-inner { min-height: 100dvh; }
            .login-main { padding-top: 16px; padding-bottom: 80px; }
        }

        /* 320px special case */
        @media (max-width: 340px) {
            .login-root {
                --pad-x: 14px; --logo-w: 105px; --card-logo-w: 82px;
                --card-pad-x: 18px; --card-pad-y: 20px; --title-fs: 24px;
                --h1a: 2rem; --h1b: 1.4rem;
            }
            .login-header { padding-top: 16px; }
            .stat-chip { width: 32px; height: 32px; }
            .stat-label { font-size: 0.64rem; }
        }

        @media (prefers-reduced-motion: reduce) {
            .anim-up, .anim-up-2, .anim-up-3 { animation: none; opacity: 1; }
            .auth-card { animation: none; }
            .photo-img, .submit-btn { transition: none; }
        }
    `}</style>
);

export default Login;