import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import StaffSidebar from './StaffSidebar';
import appleLogo from '../../assets/logo/applelogo.png';

// ── Shared Records Office tokens ──
// This file is chrome, not a themed page — it wraps every page that has
// its own metaphor (Corkboard & Pin, Duty Docket, Desk Blotter, etc.),
// so it stays quiet and consistent rather than adding a motif of its own.
const MAROON = '#6D2140';
const GOLD = '#A9784E';
const BG = '#F3EEE6';
const CARD = '#FFFDF9';
const RULE = '#E7D8C7';

const body = { fontFamily: "'Work Sans', 'Segoe UI', sans-serif" };

const StaffLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: BG, ...body }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&family=Lora:wght@600;700&family=Work+Sans:wght@400;500;600;700&display=swap');

                .staff-page-eyebrow {
                    display: block;
                    font-family: 'Work Sans', 'Segoe UI', sans-serif;
                    font-size: 0.68rem;
                    font-weight: 700;
                    letter-spacing: 0.16em;
                    color: ${GOLD};
                }
                .staff-page-header-card {
                    min-height: 108px;
                }
                .staff-page-title {
                    margin: 4px 0 0;
                    font-family: 'Lora', Georgia, 'Times New Roman', serif;
                    font-size: 1.9rem;
                    font-weight: 700;
                    line-height: 1.2;
                    color: ${MAROON};
                }
                .staff-page-description {
                    margin: 4px 0 0;
                    font-family: 'Work Sans', 'Segoe UI', sans-serif;
                    font-size: 0.86rem;
                    line-height: 1.5;
                    color: #8A7A68;
                }
                .staff-page-date-label {
                    display: block;
                    font-family: 'Work Sans', 'Segoe UI', sans-serif;
                    font-size: 0.74rem;
                    color: #8A7A68;
                }
                .staff-page-date-value {
                    display: block;
                    margin-top: 2px;
                    font-family: 'Lora', Georgia, 'Times New Roman', serif;
                    font-size: 1.05rem;
                    font-weight: 700;
                    color: #241512;
                }
            `}</style>
            <StaffSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <main className="flex-1 min-w-0 w-full overflow-y-auto overflow-x-hidden">
                {/* Mobile / tablet header — hamburger + centered logo only */}
                <div
                    className="sticky top-0 z-10 flex items-center px-4 backdrop-blur-md lg:hidden"
                    style={{
                        height: 70,
                        background: 'rgba(247, 244, 238, 0.94)',
                        borderBottom: `1px solid ${RULE}`,
                    }}
                >
                    <button
                        onClick={() => setSidebarOpen(true)}
                        aria-label="Open navigation"
                        className="relative z-10 flex items-center justify-center shrink-0 rounded-xl transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6D2140]"
                        style={{
                            width: 42,
                            height: 42,
                            background: CARD,
                            border: `1px solid ${RULE}`,
                            boxShadow: '0 1px 4px rgba(36, 21, 18, 0.06)',
                            color: MAROON,
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

                {/* thin brand rule separating chrome from whatever page-specific theme follows */}
                <div style={{ height: 2, background: `linear-gradient(90deg, ${MAROON} 0%, ${GOLD} 100%)`, opacity: 0.35 }} />

                <Outlet />
            </main>
        </div>
    );
};

export default StaffLayout;