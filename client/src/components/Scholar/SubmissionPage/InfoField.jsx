import React, { useState } from 'react';
import { Lock } from 'lucide-react';

// ── Design tokens — Apple Scholar Portal system ──
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const READONLY_BG = '#F8F4EE';
const PRIMARY = '#6D2140';
const PRIMARY_TINT = 'rgba(109, 33, 64, 0.08)';
const INK = '#241512';
const MUTED = '#8A7A68';
const PLACEHOLDER = '#A89A90';

const body = { fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif" };

const InfoField = ({ label, value, onChange, placeholder, type = 'text', readOnly = false, disabled = false, icon: Icon = null }) => {
    const [focused, setFocused] = useState(false);

    const active = focused && !readOnly && !disabled;

    const containerStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: 56,
        padding: '0 16px',
        borderRadius: 12,
        background: readOnly ? READONLY_BG : SURFACE,
        border: `1px solid ${active ? PRIMARY : BORDER}`,
        boxShadow: active ? `0 0 0 3px ${PRIMARY_TINT}` : 'none',
        opacity: disabled ? 0.55 : 1,
        transition: 'border-color 150ms ease, box-shadow 150ms ease',
    };

    return (
        <div>
            <label
                style={{
                    ...body,
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: active ? PRIMARY : MUTED,
                    display: 'block',
                    marginBottom: 6,
                    transition: 'color 150ms ease',
                }}
            >
                {label} <span style={{ color: PRIMARY }}>*</span>
            </label>

            <div style={containerStyle}>
                {Icon && (
                    <span className="flex items-center justify-center flex-shrink-0" style={{ color: active ? PRIMARY : MUTED }}>
                        <Icon size={16} />
                    </span>
                )}

                <input
                    type={type}
                    value={value}
                    placeholder={placeholder}
                    onChange={e => onChange(e.target.value)}
                    readOnly={readOnly}
                    disabled={disabled}
                    className="w-full outline-none bg-transparent"
                    style={{
                        ...body,
                        fontSize: '0.94rem',
                        fontWeight: 500,
                        color: INK,
                        border: 'none',
                        background: 'transparent',
                        cursor: readOnly ? 'default' : disabled ? 'not-allowed' : 'text',
                        minWidth: 0,
                        flex: 1,
                    }}
                    onFocus={() => { if (!readOnly && !disabled) setFocused(true); }}
                    onBlur={() => setFocused(false)}
                />

                {readOnly && (
                    <span className="flex items-center justify-center flex-shrink-0" style={{ color: MUTED }}>
                        <Lock size={14} />
                    </span>
                )}
            </div>

            {/* reserved helper-text spacing, kept empty by default */}
            <div style={{ minHeight: 16, marginTop: 4 }} />

            <style>{`
                input::placeholder { color: ${PLACEHOLDER}; opacity: 1; }
            `}</style>
        </div>
    );
};

export default InfoField;