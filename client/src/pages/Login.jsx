import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, ArrowLeft, ShieldCheck, AlertCircle, HelpCircle } from 'lucide-react';

// Reuse the real Papaya Academy photo from the landing page, so login feels
// like the same place — copy the same file into src/assets/landing/ as
// documented on the Landing Page (papaya-academy-building-1.jpg).
import loginPhoto from '../assets/landing/papaya-academy-building-1.jpg';

// ── Token system — shared across the whole Scholar Portal ──
const MAROON = '#7f2d3a';
const MAROON_DEEP = '#4f1620';
const GOLD = '#b98b4e';
const IVORY = '#FBF7F2';
const INK = '#241512';

const stats = [
    { value: '4', label: 'User Roles' },
    { value: '100%', label: 'Web-Based' },
    { value: 'Live', label: 'Monitoring' },
];

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
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

                const rolesMapping = {
                    admin: '/admin',
                    staff: '/staff',
                    scholar: '/scholar',
                    officer: '/officer',   // ← dinagdag
                };
                navigate(rolesMapping[userRole] || '/scholar');
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

    const serif = { fontFamily: "'Playfair Display', serif" };
    const sans = { fontFamily: "'DM Sans', sans-serif" };

    return (
        <div style={{ ...sans, background: IVORY, minHeight: '100vh' }}>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }

                /* browser autofill turns inputs an ugly light-blue by default;
                   force it back to match the underline field style */
                .ledger-input:-webkit-autofill,
                .ledger-input:-webkit-autofill:hover,
                .ledger-input:-webkit-autofill:focus {
                    -webkit-text-fill-color: ${INK};
                    -webkit-box-shadow: 0 0 0px 1000px #fff inset;
                    transition: background-color 9999s ease-in-out 0s;
                }

                .login-noise::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E");
                    pointer-events: none;
                }
            `}</style>

            {/* ── Hero band — the real building, same pattern used on every
                 other page in the portal ── */}
            <div
                className="login-noise relative overflow-hidden px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-32 sm:pb-40"
                style={{ minHeight: '58vh' }}
            >
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${loginPhoto})` }} />
                <div
                    className="absolute inset-0"
                    style={{ background: `linear-gradient(160deg, ${MAROON_DEEP}f0 0%, ${MAROON}c2 45%, ${MAROON_DEEP}f5 100%)` }}
                />

                <svg
                    className="absolute -right-10 -top-12 w-64 h-64 sm:w-80 sm:h-80 opacity-[0.12] pointer-events-none"
                    viewBox="0 0 200 200" fill="none"
                >
                    <path
                        d="M100 62c-6-14-20-24-36-24-4 0-8 1-8 1s-2 10 4 22c5 10 15 18 26 19-4 12-6 26-6 38 0 34 18 62 40 62 8 0 12-4 20-4s12 4 20 4c22 0 40-30 40-64 0-24-12-42-30-42-8 0-14 4-20 4s-10-3-16-6c2-11 8-20 16-25-2-1-6-2-10-2-16 0-30 8-40 17z"
                        fill={GOLD}
                    />
                    <path d="M100 62c2-16 10-30 22-38" stroke={GOLD} strokeWidth="8" strokeLinecap="round" />
                </svg>

                {/* fallback back to landing */}
                <button
                    onClick={() => navigate('/')}
                    className="relative z-10 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest mb-6 transition-opacity hover:opacity-75"
                    style={{ color: 'rgba(255,255,255,0.75)' }}
                >
                    <ArrowLeft size={13} />
                    Back to Home
                </button>

                <div className="relative z-10 max-w-3xl mx-auto text-center">
                    <div
                        className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-5"
                        style={{ background: 'rgba(255,255,255,0.1)', border: `2px solid ${GOLD}` }}
                    >
                        <svg width="24" height="24" viewBox="0 0 200 200" fill="none">
                            <path
                                d="M100 62c-6-14-20-24-36-24-4 0-8 1-8 1s-2 10 4 22c5 10 15 18 26 19-4 12-6 26-6 38 0 34 18 62 40 62 8 0 12-4 20-4s12 4 20 4c22 0 40-30 40-64 0-24-12-42-30-42-8 0-14 4-20 4s-10-3-16-6c2-11 8-20 16-25-2-1-6-2-10-2-16 0-30 8-40 17z"
                                fill={GOLD}
                            />
                            <path d="M100 62c2-16 10-30 22-38" stroke={GOLD} strokeWidth="10" strokeLinecap="round" />
                        </svg>
                    </div>

                    <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.25em] mb-2" style={{ color: GOLD }}>
                        Kalinga Foundation · Apple Scholar Program
                    </p>
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-[1.05]" style={serif}>
                        Scholar Compliance<br /><span className="italic" style={{ color: GOLD }}>Portal.</span>
                    </h1>
                    <p className="mt-4 max-w-lg mx-auto text-sm sm:text-base" style={{ color: 'rgba(255,255,255,0.65)' }}>
                        Intelligent tracking, correspondence evaluation, and academic progress analytics —
                        built for the scholars of Payatas, Manila.
                    </p>

                    {/* stats — a quiet ledger strip, not glass boxes */}
                    <div
                        className="inline-flex flex-wrap justify-center gap-x-10 gap-y-3 mt-8 pt-6 mx-auto"
                        style={{ borderTop: '1px solid rgba(255,255,255,0.18)' }}
                    >
                        {stats.map((s, i) => (
                            <div key={i}>
                                <p className="font-bold text-xl sm:text-2xl" style={{ ...serif, color: GOLD }}>{s.value}</p>
                                <p className="text-[9px] uppercase tracking-widest mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Login card — floats up over the hero, same composition trick
                 used across Profile, Dashboard, Announcements... plus a
                 gold corner-bracket frame so it reads as a sealed document,
                 not a plain white box ── */}
            <div className="px-4 sm:px-6 lg:px-8 -mt-24 sm:-mt-28 relative z-10 pb-16">
                <div className="max-w-md mx-auto relative">
                    {[
                        '-top-2 -left-2 border-t-2 border-l-2',
                        '-top-2 -right-2 border-t-2 border-r-2',
                        '-bottom-2 -left-2 border-b-2 border-l-2',
                        '-bottom-2 -right-2 border-b-2 border-r-2',
                    ].map((pos, i) => (
                        <span key={i} className={`absolute w-6 h-6 ${pos}`} style={{ borderColor: GOLD, zIndex: 20 }} />
                    ))}

                    <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 20px 50px -16px rgba(79,22,32,0.35)' }}>
                        <div style={{ height: 4, background: `linear-gradient(90deg, ${MAROON} 0%, ${GOLD} 100%)` }} />

                        <div className="p-7 sm:p-9">
                            <div className="flex items-center gap-2 mb-3">
                                <ShieldCheck size={13} style={{ color: MAROON }} />
                                <p className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: '#a56475' }}>Secure Access</p>
                            </div>
                            <h2 className="text-3xl font-bold mb-2" style={{ ...serif, color: INK }}>Welcome back.</h2>
                            <p className="text-sm mb-7" style={{ color: '#a89890' }}>
                                Sign in to manage your compliance requirements and track your progress.
                            </p>

                            {error && (
                                <div
                                    className="flex items-center gap-2 rounded-xl px-4 py-3 mb-6 text-xs font-semibold"
                                    style={{ background: '#FBE9E9', color: '#991b1b' }}
                                >
                                    <AlertCircle size={14} className="flex-shrink-0" />
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleLogin}>
                                <div className="mb-6">
                                    <label className="block mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a56475' }}>
                                        Account Email
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        placeholder="yourname@kalinga.org"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        autoComplete="email"
                                        className="ledger-input w-full pb-2.5 outline-none bg-transparent transition-colors text-sm"
                                        style={{ color: INK, borderBottom: '1.5px solid #e9dfd8' }}
                                        onFocus={(e) => (e.target.style.borderBottom = `1.5px solid ${MAROON}`)}
                                        onBlur={(e) => (e.target.style.borderBottom = '1.5px solid #e9dfd8')}
                                    />
                                </div>

                                <div className="mb-2">
                                    <label className="block mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a56475' }}>
                                        Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            autoComplete="current-password"
                                            className="ledger-input w-full pb-2.5 pr-8 outline-none bg-transparent transition-colors text-sm"
                                            style={{ color: INK, borderBottom: '1.5px solid #e9dfd8' }}
                                            onFocus={(e) => (e.target.style.borderBottom = `1.5px solid ${MAROON}`)}
                                            onBlur={(e) => (e.target.style.borderBottom = '1.5px solid #e9dfd8')}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(s => !s)}
                                            className="absolute right-0 top-0 text-slate-400 hover:text-slate-600"
                                            tabIndex={-1}
                                        >
                                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full mt-8 py-3.5 rounded-full text-white text-xs font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
                                    style={{ background: `linear-gradient(120deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)`, boxShadow: `0 10px 24px -8px ${MAROON}80` }}
                                >
                                    {isLoading ? (
                                        <>
                                            <span
                                                className="w-4 h-4 rounded-full inline-block"
                                                style={{ border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }}
                                            />
                                            Authenticating...
                                        </>
                                    ) : (
                                        <>
                                            Sign In to Portal
                                            <ArrowRight size={14} />
                                        </>
                                    )}
                                </button>
                            </form>

                            <p className="mt-6 text-center text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#c9b3b8' }}>
                                Kalinga Foundation · Audit Secure Trail
                            </p>
                        </div>
                    </div>
                </div>

                <p className="text-center text-[10px] font-semibold uppercase tracking-widest mt-6" style={{ color: '#c9a9b0' }}>
                    Payatas, Quezon City · Manila, Philippines · 2026
                </p>

                {/* footer — fills the space below the card with purposeful
                    content instead of leaving it blank, echoing the Landing
                    Page footer treatment */}
                <div className="max-w-3xl mx-auto mt-12 pt-8" style={{ borderTop: '1px solid #ecdfe1' }}>
                    <div className="flex flex-wrap justify-center gap-x-10 gap-y-2 mb-6">
                        {['Administrator', 'Officer', 'Staff', 'Scholar'].map((role) => (
                            <span key={role} className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#c9a9b0' }}>
                                {role}
                            </span>
                        ))}
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px]" style={{ color: '#c9a9b0' }}>
                        <div className="flex items-center gap-2">
                            <HelpCircle size={12} />
                            <span>Trouble signing in? Contact your program officer.</span>
                        </div>
                        <span className="uppercase tracking-widest">Scholarship Compliance Tracking System · 2026</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;