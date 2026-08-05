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
                @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=DM+Sans:wght@300;400;500;600&display=swap');

                * { box-sizing: border-box; margin: 0; padding: 0; }

                .login-root {
                    min-height: 100vh;
                    display: flex;
                    font-family: 'DM Sans', sans-serif;
                    background: #0e0608;
                    overflow: hidden;
                }

                .login-left {
                    position: relative;
                    width: 55%;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    padding: 48px 56px;
                    overflow: hidden;
                }

                .login-left-bg {
                    position: absolute;
                    inset: 0;
                    background:
                        radial-gradient(ellipse 80% 60% at 20% 80%, rgba(127,45,58,0.45) 0%, transparent 60%),
                        radial-gradient(ellipse 60% 50% at 80% 20%, rgba(90,20,20,0.35) 0%, transparent 55%),
                        linear-gradient(160deg, #1a0608 0%, #0e0608 50%, #160408 100%);
                }

                .login-left-bg::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
                    pointer-events: none;
                }

                .login-left-bg::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background-image:
                        linear-gradient(rgba(127,45,58,0.06) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(127,45,58,0.06) 1px, transparent 1px);
                    background-size: 60px 60px;
                    pointer-events: none;
                }

                .left-content { position: relative; z-index: 2; }

                .logo-mark {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    margin-bottom: 80px;
                }

                .logo-icon {
                    width: 44px;
                    height: 44px;
                    background: rgba(127,45,58,0.3);
                    border: 1px solid rgba(127,45,58,0.5);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .logo-text-main {
                    font-family: 'Cormorant Garamond', serif;
                    font-size: 18px;
                    font-weight: 700;
                    color: #fff;
                    letter-spacing: -0.3px;
                    line-height: 1.1;
                }

                .logo-text-sub {
                    font-size: 9px;
                    font-weight: 600;
                    letter-spacing: 0.22em;
                    text-transform: uppercase;
                    color: #f5c842;
                    margin-top: 1px;
                }

                .hero-heading {
                    font-family: 'Cormorant Garamond', serif;
                    font-size: clamp(48px, 5.5vw, 76px);
                    font-weight: 700;
                    line-height: 1.0;
                    color: #fff;
                    margin-bottom: 24px;
                    letter-spacing: -1px;
                }

                .hero-heading .gold { color: #f5c842; font-style: italic; }

                .hero-sub {
                    font-size: 14px;
                    font-weight: 300;
                    color: rgba(255,255,255,0.45);
                    line-height: 1.7;
                    max-width: 380px;
                    margin-bottom: 48px;
                }

                .stats-row { display: flex; gap: 32px; }

                .stat-item {
                    border-left: 2px solid rgba(127,45,58,0.5);
                    padding-left: 16px;
                }

                .stat-value {
                    font-family: 'Cormorant Garamond', serif;
                    font-size: 28px;
                    font-weight: 700;
                    color: #f5c842;
                    line-height: 1;
                }

                .stat-label {
                    font-size: 9px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.2em;
                    color: rgba(255,255,255,0.3);
                    margin-top: 4px;
                }

                .left-footer {
                    position: relative;
                    z-index: 2;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 11px;
                    color: rgba(255,255,255,0.2);
                    letter-spacing: 0.15em;
                    text-transform: uppercase;
                }

                .left-footer-dot {
                    width: 4px;
                    height: 4px;
                    border-radius: 50%;
                    background: rgba(127,45,58,0.6);
                }

                .orb {
                    position: absolute;
                    border-radius: 50%;
                    pointer-events: none;
                    z-index: 1;
                }

                .orb-1 {
                    width: 320px;
                    height: 320px;
                    background: radial-gradient(circle, rgba(127,45,58,0.25) 0%, transparent 70%);
                    bottom: -60px;
                    right: -60px;
                    animation: pulse 4s ease-in-out infinite;
                }

                .orb-2 {
                    width: 180px;
                    height: 180px;
                    background: radial-gradient(circle, rgba(245,200,66,0.08) 0%, transparent 70%);
                    top: 30%;
                    right: 10%;
                    animation: pulse 6s ease-in-out infinite reverse;
                }

                @keyframes pulse {
                    0%, 100% { opacity: 0.6; transform: scale(1); }
                    50%       { opacity: 1;   transform: scale(1.08); }
                }

                .login-right {
                    width: 45%;
                    background: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 48px 56px;
                    position: relative;
                }

                .login-right::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; right: 0;
                    height: 3px;
                    background: linear-gradient(90deg, #7f2d3a, #c4455a, #f5c842);
                }

                .form-wrapper { width: 100%; max-width: 360px; }

                .form-eyebrow {
                    font-size: 9px;
                    font-weight: 600;
                    letter-spacing: 0.3em;
                    text-transform: uppercase;
                    color: #7f2d3a;
                    margin-bottom: 10px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .form-eyebrow::before {
                    content: '';
                    display: block;
                    width: 20px;
                    height: 1px;
                    background: #7f2d3a;
                }

                .form-title {
                    font-family: 'Cormorant Garamond', serif;
                    font-size: 38px;
                    font-weight: 700;
                    color: #1a0608;
                    line-height: 1.05;
                    letter-spacing: -0.5px;
                    margin-bottom: 8px;
                }

                .form-desc {
                    font-size: 13px;
                    color: #94a3b8;
                    font-weight: 300;
                    margin-bottom: 36px;
                    line-height: 1.5;
                }

                .error-msg {
                    background: #fef2f2;
                    border: 1px solid #fecaca;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 12px;
                    color: #dc2626;
                    margin-bottom: 20px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    animation: shake 0.3s ease;
                }

                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25%       { transform: translateX(-6px); }
                    75%       { transform: translateX(6px); }
                }

                .field { margin-bottom: 18px; }

                .field-label {
                    display: block;
                    font-size: 9px;
                    font-weight: 700;
                    letter-spacing: 0.25em;
                    text-transform: uppercase;
                    color: #7f2d3a;
                    margin-bottom: 8px;
                }

                .field-input {
                    width: 100%;
                    background: #f8fafc;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 14px;
                    padding: 14px 18px;
                    font-size: 14px;
                    font-family: 'DM Sans', sans-serif;
                    font-weight: 400;
                    color: #1e293b;
                    outline: none;
                    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
                }

                .field-input::placeholder { color: #cbd5e1; }
                .field-input:hover { border-color: #cbd5e1; background: #f1f5f9; }
                .field-input:focus {
                    border-color: #7f2d3a;
                    background: #fff;
                    box-shadow: 0 0 0 4px rgba(127,45,58,0.08);
                }

                .submit-btn {
                    width: 100%;
                    background: #7f2d3a;
                    color: #fff;
                    border: none;
                    border-radius: 14px;
                    padding: 15px 24px;
                    font-family: 'DM Sans', sans-serif;
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    margin-top: 28px;
                    transition: background 0.25s, transform 0.15s, box-shadow 0.25s;
                    box-shadow: 0 8px 24px rgba(127,45,58,0.25);
                    position: relative;
                    overflow: hidden;
                }

                .submit-btn::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 60%);
                }

                .submit-btn:hover:not(:disabled) {
                    background: #63232d;
                    transform: translateY(-2px);
                    box-shadow: 0 14px 32px rgba(127,45,58,0.35);
                }

                .submit-btn:active:not(:disabled) { transform: translateY(0); }
                .submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }

                .spinner {
                    width: 16px;
                    height: 16px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: #fff;
                    border-radius: 50%;
                    animation: spin 0.7s linear infinite;
                }

                @keyframes spin { to { transform: rotate(360deg); } }

                .form-footer {
                    margin-top: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    font-size: 10px;
                    color: #cbd5e1;
                    font-weight: 500;
                    text-transform: uppercase;
                    letter-spacing: 0.15em;
                }

                @media (max-width: 768px) {
                    .login-root { flex-direction: column; }
                    .login-left { width: 100%; padding: 36px 28px 48px; min-height: 50vh; }
                    .login-right { width: 100%; padding: 40px 28px; }
                    .hero-heading { font-size: 42px; }
                    .stats-row { gap: 20px; }
                }
            `}</style>

            <div className="login-root">

                {/* LEFT PANEL */}
                <div className="login-left">
                    <div className="login-left-bg" />
                    <div className="orb orb-1" />
                    <div className="orb orb-2" />

                    <div className="left-content">
                        <div className="logo-mark">
                            <div className="logo-icon">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="#f5c842">
                                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                                </svg>
                            </div>
                            <div>
                                <div className="logo-text-main">Kalinga Foundation</div>
                                <div className="logo-text-sub">Apple Scholar Program</div>
                            </div>
                        </div>

                        <h1 className="hero-heading">
                            Scholar<br />
                            <span className="gold">Compliance</span><br />
                            Portal.
                        </h1>

                        <p className="hero-sub">
                            Intelligent tracking, correspondence evaluation, and academic progress
                            analytics — built for the scholars of Payatas, Manila.
                        </p>

                        <div className="stats-row">
                            <div className="stat-item">
                                <div className="stat-value">4</div>
                                <div className="stat-label">User Roles</div>
                            </div>
                            <div className="stat-item">
                                <div className="stat-value">100%</div>
                                <div className="stat-label">Web-Based</div>
                            </div>
                            <div className="stat-item">
                                <div className="stat-value">Live</div>
                                <div className="stat-label">Monitoring</div>
                            </div>
                        </div>
                    </div>

                    <div className="left-footer">
                        <div className="left-footer-dot" />
                        <span>Payatas, Quezon City · Manila, Philippines</span>
                        <div className="left-footer-dot" />
                        <span>2026</span>
                    </div>
                </div>

                {/* RIGHT PANEL */}
                <div className="login-right">
                    <div className="form-wrapper">
                        <div className="form-eyebrow">Secure Access</div>
                        <h2 className="form-title">Welcome<br />back.</h2>
                        <p className="form-desc">Sign in to manage your compliance requirements and track your progress.</p>

                        {error && (
                            <div className="error-msg">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                                </svg>
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleLogin}>
                            <div className="field">
                                <label className="field-label">Account Email</label>
                                <input
                                    type="email"
                                    required
                                    className="field-input"
                                    placeholder="yourname@kalinga.org"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoComplete="email"
                                />
                            </div>

                            <div className="field">
                                <label className="field-label">Password</label>
                                <input
                                    type="password"
                                    required
                                    className="field-input"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                />
                            </div>

                            <button type="submit" className="submit-btn" disabled={isLoading}>
                                {isLoading ? (
                                    <>
                                        <div className="spinner" />
                                        Authenticating...
                                    </>
                                ) : (
                                    <>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
                                        </svg>
                                        Sign In to Portal
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="form-footer">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                            Kalinga Foundation · Audit Secure Trail
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Login;