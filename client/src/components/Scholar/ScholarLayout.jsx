import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import ScholarSidebar from './ScholarSidebar';

// ── Token system — shared across the Scholar Portal ──
const MAROON = '#7f2d3a';
const MAROON_DEEP = '#4f1620';
const GOLD = '#b98b4e';
const IVORY = '#FBF7F2';

const ScholarLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: IVORY }}>
            <ScholarSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <main className="flex-1 overflow-y-auto w-full min-w-0">
                {/* Mobile hamburger */}
                <div
                    className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 backdrop-blur-md lg:hidden"
                    style={{ background: 'rgba(251,247,242,0.85)', borderBottom: '1px solid #ecdfe1' }}
                >
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 rounded-xl"
                        style={{ background: '#fff', border: '1px solid #ecdfe1', boxShadow: '0 2px 6px rgba(36,21,18,0.06)', color: MAROON }}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <div className="flex items-center gap-2">
                        <div
                            className="w-6 h-6 rounded-lg flex items-center justify-center"
                            style={{ background: `linear-gradient(135deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)` }}
                        >
                            {/* our own apple silhouette mark — same one used across every hero band,
                                not the Apple Inc. logo */}
                            <svg viewBox="0 0 200 200" className="w-3.5 h-3.5" fill="none">
                                <path
                                    d="M100 62c-6-14-20-24-36-24-4 0-8 1-8 1s-2 10 4 22c5 10 15 18 26 19-4 12-6 26-6 38 0 34 18 62 40 62 8 0 12-4 20-4s12 4 20 4c22 0 40-30 40-64 0-24-12-42-30-42-8 0-14 4-20 4s-10-3-16-6c2-11 8-20 16-25-2-1-6-2-10-2-16 0-30 8-40 17z"
                                    fill={GOLD}
                                />
                                <path d="M100 62c2-16 10-30 22-38" stroke={GOLD} strokeWidth="10" strokeLinecap="round" />
                            </svg>
                        </div>
                        <span className="text-sm font-bold uppercase tracking-widest italic" style={{ fontFamily: "'Playfair Display', serif", color: MAROON }}>
                            Apple Scholar
                        </span>
                    </div>
                </div>

                <Outlet />
            </main>
        </div>
    );
};

export default ScholarLayout;