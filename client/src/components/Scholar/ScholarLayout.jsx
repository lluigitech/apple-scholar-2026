import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import ScholarSidebar from './ScholarSidebar';
import appleLogo from '../../assets/logo/applelogo.png';

// ── Unified Apple Scholar tokens (same as Admin / Officer / Staff portals) ──
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const PRIMARY = '#6D2140';

const ScholarLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: BG }}>
            {/* Shared bento building blocks for Scholar pages.
                Pages opt in by using these classes; nothing here restyles
                existing page markup, and desktop layouts are untouched. */}
            <style>{`
                .sb-grid {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr);
                    gap: 12px;
                    padding: 0 16px 24px;
                    min-width: 0;
                }
                @media (min-width: 375px) {
                    .sb-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                    .sb-span-2 { grid-column: span 2; }
                }
                @media (min-width: 768px) {
                    .sb-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; padding: 0 24px 28px; }
                    .sb-span-2 { grid-column: span 2; }
                    .sb-span-3 { grid-column: span 3; }
                }
                @media (min-width: 1024px) {
                    .sb-grid { gap: 16px; padding: 0 32px 32px; }
                }

                .sb-card {
                    background: ${SURFACE};
                    border: 1px solid ${BORDER};
                    border-radius: 18px;
                    padding: 16px 18px;
                    box-shadow: 0 1px 3px rgba(74, 23, 48, 0.04);
                    min-width: 0;
                }
                .sb-card--hero {
                    background: linear-gradient(160deg, #6D2140 0%, #4A1730 100%);
                    border-color: #4A1730;
                    color: #fff;
                    padding: 22px 20px;
                    box-shadow: 0 8px 24px rgba(74, 23, 48, 0.18);
                }
                .sb-card--tint {
                    background: rgba(109, 33, 64, 0.06);
                    border-color: rgba(109, 33, 64, 0.14);
                }
                .sb-label {
                    font-family: 'Inter', 'Segoe UI', sans-serif;
                    font-size: 0.64rem;
                    font-weight: 700;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                    color: #A9784E;
                }
                .sb-card--hero .sb-label { color: rgba(255, 255, 255, 0.72); }
                .sb-title {
                    font-family: 'Playfair Display', Georgia, serif;
                    font-weight: 700;
                    color: #241512;
                    line-height: 1.15;
                }
                .sb-card--hero .sb-title { color: #fff; font-size: 1.6rem; }
                .sb-stat {
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: 1.9rem;
                    font-weight: 700;
                    color: #6D2140;
                    line-height: 1;
                    margin-top: 10px;
                }
                .sb-muted {
                    font-family: 'Inter', 'Segoe UI', sans-serif;
                    font-size: 0.78rem;
                    color: #8A7A68;
                }
            `}</style>

            <ScholarSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <main className="flex-1 min-w-0 w-full overflow-y-auto overflow-x-hidden" style={{ background: BG }}>
                {/* Mobile / tablet header — hamburger + centered logo only */}
                <div
                    className="sticky top-0 z-10 flex items-center px-4 backdrop-blur-md lg:hidden"
                    style={{
                        height: 70,
                        background: 'rgba(247, 244, 238, 0.94)',
                        borderBottom: `1px solid ${BORDER}`,
                    }}
                >
                    <button
                        onClick={() => setSidebarOpen(true)}
                        aria-label="Open navigation"
                        className="relative z-10 flex items-center justify-center shrink-0 rounded-xl transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6D2140]"
                        style={{
                            width: 42,
                            height: 42,
                            background: SURFACE,
                            border: `1px solid ${BORDER}`,
                            boxShadow: '0 1px 4px rgba(36, 21, 18, 0.06)',
                            color: PRIMARY,
                            cursor: 'pointer',
                        }}
                    >
                        <Menu size={20} strokeWidth={2} />
                    </button>

                    {/* Official Apple Scholar logo — centered, proportional, uncropped.
                        Height scales 32px (320px phones) → 42px (≈440px+). */}
                    <img
                        src={appleLogo}
                        alt="Apple Scholar"
                        draggable={false}
                        style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            display: 'block',
                            height: 'clamp(32px, 9.5vw, 42px)',
                            width: 'auto',
                            maxWidth: 170,
                            objectFit: 'contain',
                            mixBlendMode: 'multiply',
                            userSelect: 'none',
                            pointerEvents: 'none',
                        }}
                    />
                </div>

                {/* 16px breathing room between header and page content (mobile/tablet only) */}
                <div className="lg:hidden" style={{ height: 16 }} aria-hidden />

                <Outlet />
            </main>
        </div>
    );
};

export default ScholarLayout;