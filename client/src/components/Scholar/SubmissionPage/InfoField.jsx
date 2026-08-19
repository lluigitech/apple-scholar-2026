import React from 'react';

const MAROON = '#7f2d3a';

const InfoField = ({ label, value, onChange, placeholder, type = 'text', readOnly = false, disabled = false }) => {
    return (
        <div>
            <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.72rem', fontWeight: 700, color: '#a56475', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {label} <span style={{ color: MAROON }}>*</span>
            </label>
            <input
                type={type}
                value={value}
                placeholder={placeholder}
                onChange={e => onChange(e.target.value)}
                readOnly={readOnly}
                disabled={disabled}
                className="w-full pb-2 outline-none transition-colors bg-transparent"
                style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem', color: '#241512', borderBottom: '1.5px solid #e9dfd8', background: readOnly ? 'rgba(127,45,58,0.02)' : 'transparent' }}
                onFocus={e => {
                    if (!readOnly && !disabled) e.target.style.borderBottom = `1.5px solid ${MAROON}`;
                }}
                onBlur={e => {
                    if (!readOnly && !disabled) e.target.style.borderBottom = '1.5px solid #e9dfd8';
                }}
            />
        </div>
    );
};

export default InfoField;