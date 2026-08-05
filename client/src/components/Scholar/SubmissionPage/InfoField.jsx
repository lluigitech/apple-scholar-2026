import React from 'react';

const MAROON = '#7f2d3a';

const InfoField = ({ label, value, onChange, placeholder, type = 'text' }) => {
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
                className="w-full pb-2 outline-none transition-colors bg-transparent"
                style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem', color: '#241512', borderBottom: '1.5px solid #e9dfd8' }}
                onFocus={e => (e.target.style.borderBottom = `1.5px solid ${MAROON}`)}
                onBlur={e => (e.target.style.borderBottom = '1.5px solid #e9dfd8')}
            />
        </div>
    );
};

export default InfoField;