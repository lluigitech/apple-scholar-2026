import React from 'react';

// Shared by: Officer/Reports (OfficerReportDetail) and Scholar/SubmissionPage (ScholarGrades, etc.)
// Same color thresholds sa dati: >=71 green, >=51 amber, else red.
const ScoreRing = ({ score, size = 64 }) => {
    const r = (size - 8) / 2;
    const circ = 2 * Math.PI * r;
    const dash = (score / 100) * circ;
    const color = score >= 90 ? '#16a34a' : score >= 75 ? '#16a34a' : score >= 50 ? '#d97706' : '#ef4444';
    return (
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#334155" strokeWidth={5} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5}
                strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        </svg>
    );
};

export default ScoreRing;