import React from 'react';
import { CheckCircle, Clock, FileText } from 'lucide-react';

// ── Token system — shared across the Scholar Portal ──
const MAROON = '#7f2d3a';
const MAROON_DEEP = '#4f1620';
const GOLD = '#b98b4e';
const ROSE = '#F5E8EA';
const INK = '#241512';

const SubmittedView = ({ info, body, media, onNew }) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

    return (
        <div>
            <div className="rounded-2xl p-4 mb-6 flex items-center gap-3" style={{ background: '#EAF3EC', border: '1px solid #bbf7d0' }}>
                <CheckCircle className="w-6 h-6 flex-shrink-0" style={{ color: '#15803d' }} />
                <div>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem', fontWeight: 700, color: '#15803d' }}>
                        Report submitted successfully!
                    </p>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.78rem', color: '#6b7280' }}>
                        Forwarded to admin/office for review — {info.date} · {timeStr}
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-2xl overflow-hidden mb-6" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)' }}>
                {/* thin gold rule — same letterhead cue used across the Submission flow */}
                <div style={{ height: 3, background: `linear-gradient(90deg, ${MAROON} 0%, ${GOLD} 100%)` }} />

                <div className="text-center py-6 px-8" style={{ borderBottom: `2px solid ${GOLD}55`, background: ROSE }}>
                    <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', fontWeight: 700, color: MAROON, marginBottom: 2 }}>
                        Kalinga at Pag-ibig Foundation Inc.
                    </p>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', fontWeight: 600, color: '#6b7280', marginBottom: 2 }}>
                        Apple Scholars
                    </p>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.82rem', color: '#9ca3af' }}>
                        Rodriguez, Rizal
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-0" style={{ borderBottom: '1px solid #f5eee9' }}>
                    {[
                        { label: 'Name', value: info.name },
                        { label: 'Age', value: `${info.age} years old` },
                        { label: 'Year', value: info.year },
                        { label: 'Course', value: info.course },
                        { label: 'School', value: info.school },
                        { label: 'Date', value: info.date },
                    ].map((row, i) => (
                        <div key={i} className="flex items-center gap-2 px-6 py-2.5"
                            style={{ borderBottom: i < 4 ? '1px solid #faf6f3' : 'none', borderRight: i % 2 === 0 ? '1px solid #f5eee9' : 'none' }}>
                            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', minWidth: 56 }}>{row.label}:</span>
                            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.82rem', fontWeight: 600, color: '#374151' }}>{row.value}</span>
                        </div>
                    ))}
                </div>

                <div className="flex items-center justify-between px-6 py-2" style={{ background: '#faf6f3', borderBottom: '1px solid #f5eee9' }}>
                    <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" style={{ color: '#9ca3af' }} />
                        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', color: '#9ca3af' }}>Submitted {timeStr}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: '#EAF3EC', border: '1px solid #bbf7d0' }}>
                        <CheckCircle className="w-3 h-3" style={{ color: '#15803d' }} />
                        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.72rem', fontWeight: 700, color: '#15803d' }}>Accepted by System</span>
                    </div>
                </div>

                <div className="px-10 py-8" style={{ maxWidth: 680, margin: '0 auto' }}>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem', lineHeight: 1.8, color: '#374151', marginBottom: 20 }}>
                        Dear Kalinga,
                    </p>
                    {body.split(/\n\n+/).filter(p => p.trim()).map((para, i) => (
                        <p key={i} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem', lineHeight: 1.8, color: '#374151', marginBottom: 16, textIndent: '2rem' }}>
                            {para.trim()}
                        </p>
                    ))}
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem', lineHeight: 1.8, color: '#374151', marginTop: 28, marginBottom: 4 }}>
                        Your scholar,
                    </p>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem', fontWeight: 700, color: INK }}>
                        {info.name}
                    </p>
                </div>

                {media.length > 0 && (
                    <div className="px-10 pb-10" style={{ borderTop: '1px solid #f5eee9' }}>
                        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '0.95rem', fontWeight: 700, color: INK, marginTop: 24, marginBottom: 16 }}>
                            Documentation
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                            {media.map((item, i) => (
                                <div key={item.id}>
                                    <div className="rounded-lg overflow-hidden" style={{ height: 160, border: '1px solid #f5eee9', boxShadow: '0 4px 12px -6px rgba(36,21,18,0.15)' }}>
                                        <img src={item.previewUrl} alt={`doc-${i + 1}`} className="w-full h-full object-cover" />
                                    </div>
                                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.77rem', color: '#6b7280', marginTop: 6, lineHeight: 1.4, textAlign: 'center', fontStyle: 'italic' }}>
                                        ({item.description || `Documentation ${i + 1}`})
                                    </p>
                                </div>
                            ))}
                        </div>
                        <div className="mt-8 pt-5" style={{ borderTop: '1px dashed #e9dfd8' }}>
                            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.78rem', color: '#9ca3af', textAlign: 'center' }}>
                                (Report Card and Certificate of Enrollment)
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between px-8 py-3" style={{ borderTop: '1px solid #f5eee9', background: '#faf6f3' }}>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.72rem', color: '#d1d5db' }}>Page 1 / Apple Scholar</span>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.72rem', color: '#d1d5db' }}>{info.date}</span>
                </div>
            </div>

            <button onClick={onNew} className="flex items-center gap-2 px-5 py-2.5 rounded-full transition-opacity hover:opacity-80"
                style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.88rem', fontWeight: 600, background: `linear-gradient(120deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)`, color: '#fff', border: 'none', cursor: 'pointer' }}>
                <FileText className="w-4 h-4" /> New Submission
            </button>
        </div>
    );
};

export default SubmittedView;