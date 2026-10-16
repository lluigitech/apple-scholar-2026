import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import OfficerSidebar from './OfficerSidebar';
import appleLogo from '../../assets/logo/applelogo.png';

// ── Unified Apple Scholar tokens (same as Admin / Staff / Scholar portals) ──
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const PRIMARY = '#6D2140';

const OfficerLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: BG }}>
            <OfficerSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

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

                <Outlet />
            </main>
        </div>
    );
};

export default OfficerLayout;