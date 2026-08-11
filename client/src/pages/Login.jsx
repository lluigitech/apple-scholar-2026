import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
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

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600&family=DM+Sans:wght@300;400;500;600;700&display=swap');

                * { box-sizing: border-box; margin: 0; padding: 0; }

                .kls-root {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 40px 20px;
                    font-family: 'DM Sans', sans-serif;
                    background: #3a1620;
                    position: relative;
                    overflow: hidden;
                }

                .kls-root::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background:
                        radial-gradient(ellipse 70% 60% at 15% 10%, rgba(127,45,58,0.55) 0%, transparent 60%),
                        radial-gradient(ellipse 60% 55% at 90% 90%, rgba(79,22,32,0.6) 0%, transparent 55%),
                        linear-gradient(155deg, #2c111a 0%, #1e0c12 55%, #2a1119 100%);
                }

                .kls-root::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background-image:
                        linear-gradient(rgba(201,166,122,0.05) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(201,166,122,0.05) 1px, transparent 1px);
                    background-size: 46px 46px;
                    mask-image: radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 75%);
                }

                .kls-card {
                    position: relative;
                    z-index: 2;
                    width: min(94vw, 1160px);
                    min-height: 620px;
                    display: flex;
                    background: #FBF7F2;
                    border-radius: 22px;
                    box-shadow: 0 30px 70px rgba(20,6,10,0.55), 0 2px 0 rgba(255,255,255,0.4) inset;
                    overflow: hidden;
                    animation: cardIn 0.6s cubic-bezier(0.16,1,0.3,1);
                }

                @keyframes cardIn {
                    from { opacity: 0; transform: translateY(18px); }
                    to   { opacity: 1; transform: translateY(0); }
                }

                /* ── STUB (left) ─────────────────────────────────────── */

                .kls-stub {
                    position: relative;
                    width: 34%;
                    min-width: 260px;
                    max-width: 340px;
                    flex-shrink: 0;
                    background:
                        linear-gradient(165deg, #4f1620 0%, #7f2d3a 60%, #6b2430 100%);
                    padding: 44px 30px;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    color: #f3e6da;
                    overflow: hidden;
                }

                .kls-stub::after {
                    content: '';
                    position: absolute;
                    right: -70px;
                    bottom: -70px;
                    width: 220px;
                    height: 220px;
                    border-radius: 50%;
                    background: radial-gradient(circle, rgba(201,166,122,0.14) 0%, transparent 70%);
                    pointer-events: none;
                }

                .kls-stub-top { display: flex; flex-direction: column; gap: 26px; }

                .kls-mark {
                    width: 40px;
                    height: 40px;
                    border-radius: 10px;
                    background: rgba(255,255,255,0.08);
                    border: 1px solid rgba(201,166,122,0.55);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .kls-brand-name {
                    font-family: 'Playfair Display', serif;
                    font-size: 15px;
                    font-weight: 700;
                    letter-spacing: -0.2px;
                    line-height: 1.15;
                    margin-top: 12px;
                }

                .kls-brand-sub {
                    font-size: 8.5px;
                    font-weight: 600;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                    color: #c9a67a;
                    margin-top: 3px;
                }

                .kls-file-no {
                    font-size: 9.5px;
                    letter-spacing: 0.14em;
                    color: rgba(243,230,218,0.55);
                    border-top: 1px dashed rgba(201,166,122,0.4);
                    padding-top: 12px;
                }

                .kls-file-no b { color: #e9c9a3; font-weight: 600; }

                .kls-vertical {
                    position: absolute;
                    left: 24px;
                    bottom: 100px;
                    writing-mode: vertical-rl;
                    transform: rotate(180deg);
                    font-size: 9px;
                    font-weight: 600;
                    letter-spacing: 0.3em;
                    text-transform: uppercase;
                    color: rgba(243,230,218,0.28);
                }

                .kls-stub-bottom {
                    font-size: 9.5px;
                    line-height: 1.6;
                    color: rgba(243,230,218,0.5);
                    letter-spacing: 0.02em;
                }

                /* ── PERFORATION ─────────────────────────────────────── */

                .kls-perf {
                    position: relative;
                    width: 0;
                    background-image: repeating-linear-gradient(
                        to bottom,
                        rgba(122,90,80,0.35) 0 6px,
                        transparent 6px 14px
                    );
                    background-position: center;
                    background-size: 1.5px 100%;
                    background-repeat: no-repeat;
                }

                .kls-perf::before,
                .kls-perf::after {
                    content: '';
                    position: absolute;
                    left: 50%;
                    width: 26px;
                    height: 26px;
                    background: #3a1620;
                    border-radius: 50%;
                    transform: translateX(-50%);
                    z-index: 3;
                }

                .kls-perf::before { top: -13px; }
                .kls-perf::after { bottom: -13px; }

                /* ── FORM (right) ────────────────────────────────────── */

                .kls-form-side {
                    position: relative;
                    flex: 1;
                    padding: 44px 64px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                }

                .kls-form-side::before {
                    content: '';
                    position: absolute;
                    right: -60px;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 340px;
                    height: 340px;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cpath d='M100 62c-6-14-20-24-36-24-4 0-8 1-8 1s-2 10 4 22c5 10 15 18 26 19-4 12-6 26-6 38 0 34 18 62 40 62 8 0 12-4 20-4s12 4 20 4c22 0 40-30 40-64 0-24-12-42-30-42-8 0-14 4-20 4s-10-3-16-6c2-11 8-20 16-25-2-1-6-2-10-2-16 0-30 8-40 17z' fill='%237f2d3a'/%3E%3C/svg%3E");
                    background-size: contain;
                    background-repeat: no-repeat;
                    opacity: 0.05;
                    pointer-events: none;
                }

                .kls-form-wrapper { position: relative; z-index: 1; width: 100%; max-width: 360px; }

                .kls-eyebrow {
                    font-size: 9px;
                    font-weight: 700;
                    letter-spacing: 0.28em;
                    text-transform: uppercase;
                    color: #7f2d3a;
                    margin-bottom: 10px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .kls-eyebrow::before {
                    content: '';
                    display: block;
                    width: 18px;
                    height: 1px;
                    background: #7f2d3a;
                }

                .kls-title {
                    font-family: 'Playfair Display', serif;
                    font-size: 40px;
                    font-weight: 700;
                    color: #241512;
                    line-height: 1.06;
                    letter-spacing: -0.5px;
                    margin-bottom: 10px;
                }

                .kls-title .gold { color: #a3475a; font-style: italic; }

                .kls-desc {
                    font-size: 13.5px;
                    color: #a89890;
                    font-weight: 300;
                    margin-bottom: 30px;
                    line-height: 1.6;
                }

                .kls-error {
                    background: #FBE9E9;
                    border: 1px solid #f3c6c6;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 12px;
                    color: #991b1b;
                    margin-bottom: 18px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    animation: kls-shake 0.3s ease;
                }

                @keyframes kls-shake {
                    0%, 100% { transform: translateX(0); }
                    25%       { transform: translateX(-6px); }
                    75%       { transform: translateX(6px); }
                }

                .kls-field { margin-bottom: 16px; }

                .kls-field-label {
                    display: block;
                    font-size: 9px;
                    font-weight: 700;
                    letter-spacing: 0.22em;
                    text-transform: uppercase;
                    color: #a56475;
                    margin-bottom: 7px;
                }

                .kls-field-input {
                    width: 100%;
                    background: #fff;
                    border: 1.5px solid #e9dfd8;
                    border-radius: 12px;
                    padding: 13px 16px;
                    font-size: 13.5px;
                    font-family: 'DM Sans', sans-serif;
                    color: #241512;
                    outline: none;
                    transition: border-color 0.2s, box-shadow 0.2s;
                }

                .kls-field-input::placeholder { color: #d8c9c2; }
                .kls-field-input:hover { border-color: #d8c9c2; }
                .kls-field-input:focus {
                    border-color: #7f2d3a;
                    box-shadow: 0 0 0 4px rgba(127,45,58,0.08);
                }

                .kls-submit {
                    width: 100%;
                    background: linear-gradient(120deg, #7f2d3a 0%, #4f1620 100%);
                    color: #fff;
                    border: none;
                    border-radius: 999px;
                    padding: 14px 22px;
                    font-family: 'DM Sans', sans-serif;
                    font-size: 10.5px;
                    font-weight: 700;
                    letter-spacing: 0.18em;
                    text-transform: uppercase;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 9px;
                    margin-top: 24px;
                    transition: transform 0.15s, box-shadow 0.25s, opacity 0.2s;
                    box-shadow: 0 8px 22px rgba(127,45,58,0.3);
                }

                .kls-submit:hover:not(:disabled) {
                    opacity: 0.93;
                    transform: translateY(-2px);
                    box-shadow: 0 12px 28px rgba(127,45,58,0.38);
                }

                .kls-submit:active:not(:disabled) { transform: translateY(0); }
                .kls-submit:disabled { opacity: 0.7; cursor: not-allowed; }

                .kls-spinner {
                    width: 15px;
                    height: 15px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: #fff;
                    border-radius: 50%;
                    animation: kls-spin 0.7s linear infinite;
                }

                @keyframes kls-spin { to { transform: rotate(360deg); } }

                .kls-form-footer {
                    margin-top: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    font-size: 9.5px;
                    color: #c9b3b8;
                    font-weight: 500;
                    text-transform: uppercase;
                    letter-spacing: 0.14em;
                }

                @media (max-width: 720px) {
                    .kls-card { flex-direction: column; width: 92vw; max-width: 420px; min-height: 0; }
                    .kls-stub { width: 100%; max-width: none; flex-direction: row; align-items: center; padding: 20px 24px; }
                    .kls-stub-top { flex-direction: row; align-items: center; gap: 14px; }
                    .kls-file-no, .kls-vertical, .kls-stub-bottom { display: none; }
                    .kls-form-side::before { display: none; }
                    .kls-perf {
                        width: 100%;
                        height: 0;
                        background-image: repeating-linear-gradient(
                            to right,
                            rgba(122,90,80,0.35) 0 6px,
                            transparent 6px 14px
                        );
                        background-size: 100% 1.5px;
                    }
                    .kls-perf::before, .kls-perf::after {
                        top: 50%; left: auto;
                        transform: translateY(-50%);
                    }
                    .kls-perf::before { left: -13px; }
                    .kls-perf::after { right: -13px; left: auto; }
                    .kls-form-side { padding: 30px 26px; }
                }
            `}</style>

            <div className="kls-root">
                <div className="kls-card">

                    {/* STUB */}
                    <div className="kls-stub">
                        <div className="kls-stub-top">
                            <div className="kls-mark">
                                <svg width="20" height="20" viewBox="0 0 200 200" fill="none">
                                    <path
                                        d="M100 62c-6-14-20-24-36-24-4 0-8 1-8 1s-2 10 4 22c5 10 15 18 26 19-4 12-6 26-6 38 0 34 18 62 40 62 8 0 12-4 20-4s12 4 20 4c22 0 40-30 40-64 0-24-12-42-30-42-8 0-14 4-20 4s-10-3-16-6c2-11 8-20 16-25-2-1-6-2-10-2-16 0-30 8-40 17z"
                                        fill="#c9a67a"
                                    />
                                    <path d="M100 62c2-16 10-30 22-38" stroke="#c9a67a" strokeWidth="10" strokeLinecap="round" />
                                </svg>
                            </div>
                            <div>
                                <div className="kls-brand-name">Kalinga<br/>Foundation</div>
                                <div className="kls-brand-sub">Apple Scholar Program</div>
                            </div>
                        </div>

                        <div className="kls-vertical">Scholar Compliance Portal</div>

                        <div>
                            <div className="kls-file-no">FILE NO. <b>AS-2026</b></div>
                            <div className="kls-stub-bottom" style={{ marginTop: 12 }}>
                                Payatas, Quezon City<br />Manila, Philippines
                            </div>
                        </div>
                    </div>

                    <div className="kls-perf" />

                    {/* FORM */}
                    <div className="kls-form-side">
                        <div className="kls-form-wrapper">
                            <div className="kls-eyebrow">Secure Access</div>
                            <h2 className="kls-title">Welcome<br /><span className="gold">back.</span></h2>
                            <p className="kls-desc">Sign in to manage your compliance requirements and track your progress.</p>

                            {error && (
                                <div className="kls-error">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                                    </svg>
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleLogin}>
                                <div className="kls-field">
                                    <label className="kls-field-label">Account Email</label>
                                    <input
                                        type="email"
                                        required
                                        className="kls-field-input"
                                        placeholder="yourname@kalinga.org"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        autoComplete="email"
                                    />
                                </div>

                                <div className="kls-field">
                                    <label className="kls-field-label">Password</label>
                                    <input
                                        type="password"
                                        required
                                        className="kls-field-input"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        autoComplete="current-password"
                                    />
                                </div>

                                <button type="submit" className="kls-submit" disabled={isLoading}>
                                    {isLoading ? (
                                        <>
                                            <div className="kls-spinner" />
                                            Authenticating...
                                        </>
                                    ) : (
                                        <>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
                                            </svg>
                                            Sign In to Portal
                                        </>
                                    )}
                                </button>
                            </form>

                            <div className="kls-form-footer">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                </svg>
                                Kalinga Foundation · Audit Secure Trail
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </>
    );
};

export default Login;