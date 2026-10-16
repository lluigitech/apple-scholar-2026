import React from 'react';

// Small shared primitives used across the officer review screens.
// Aligned with the redesigned Scholar Submissions (Manual Validation) page:
// compact sentence-case labels, thin warm borders, 10–16px radii, and the
// Apple Scholar Officer tokens (maroon #6D2140, bronze #A9784E, warm cream
// neutrals, Lora / Inter typography). Exports and props are unchanged, so
// existing imports keep working.

const MAROON = '#6D2140';
const BORDER = '#E7D8C7';
const SURFACE = '#FFFDF9';
const INK = '#241512';
const MUTED = '#8A7A68';
const MAROON_TINT = '#F3E7EC';

const sans = { fontFamily: "'Inter', sans-serif" };
const serif = { fontFamily: "'Lora', serif" };

// Soft border derived from the badge colour when it is a #RRGGBB hex.
const alpha = (hex, a) => (/^#[0-9a-f]{6}$/i.test(hex || '') ? `${hex}${a}` : undefined);

// Status-style pill (same look as the page's StatusPill).
export const Badge = ({ bg, color, children, dot }) => (
    <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full whitespace-nowrap"
        style={{
            ...sans,
            fontSize: '0.68rem',
            fontWeight: 700,
            backgroundColor: bg,
            color,
            border: `1px solid ${alpha(color, '35') || 'transparent'}`,
        }}>
        {dot && <span style={{ backgroundColor: dot }} className="w-1.5 h-1.5 rounded-full shrink-0" />}
        {children}
    </span>
);

// Loading placeholder block. `height` is optional (default 96px).
export const Skeleton = ({ height = 96 }) => (
    <div
        className="animate-pulse overflow-hidden"
        style={{ border: `1px solid ${BORDER}`, borderRadius: 16, background: SURFACE }}>
        <div className="w-full" style={{ height, backgroundColor: '#EFE7D8' }} />
    </div>
);

// Empty state: tinted icon circle, Lora title, optional supporting hint.
export const Empty = ({ icon: Icon, text, hint }) => (
    <div className="flex flex-col items-center justify-center text-center px-4" style={{ padding: '48px 16px' }}>
        {Icon && (
            <span
                className="flex items-center justify-center rounded-full mb-3"
                style={{ width: 48, height: 48, background: MAROON_TINT, color: MAROON }}>
                <Icon size={22} strokeWidth={1.6} />
            </span>
        )}
        <p style={{ ...serif, fontSize: '1.05rem', fontWeight: 600, color: INK }}>{text}</p>
        {hint && <p className="max-w-sm" style={{ ...sans, fontSize: '0.8rem', color: MUTED, marginTop: 4, lineHeight: 1.5 }}>{hint}</p>}
    </div>
);

// Toolbar filter button (matches the All / Needs Review / Flagged buttons).
export const FilterPill = ({ label, active, onClick, maroon = MAROON }) => (
    <button
        onClick={onClick}
        aria-pressed={!!active}
        className="shrink-0 px-3.5 transition-colors"
        style={{
            ...sans,
            height: 40,
            fontSize: '0.76rem',
            fontWeight: 600,
            borderRadius: 10,
            backgroundColor: active ? maroon : SURFACE,
            color: active ? '#fff' : maroon,
            border: `1px solid ${active ? maroon : BORDER}`,
            cursor: 'pointer',
        }}>
        {label}
    </button>
);