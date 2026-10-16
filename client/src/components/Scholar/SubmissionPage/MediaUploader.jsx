import React, { useRef, useCallback } from 'react';
import { ImagePlus, X, UploadCloud } from 'lucide-react';

// ── Design tokens — Apple Scholar Portal system ──
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const PRIMARY = '#6D2140';
const PRIMARY_DEEP = '#4A1730';
const PRIMARY_TINT = 'rgba(109, 33, 64, 0.08)';
const GOLD = '#B98B4E';
const INK = '#241512';
const MUTED = '#8A7A68';

const display = { fontFamily: "'Playfair Display', Georgia, serif" };
const body = { fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif" };

/**
 * Props:
 * - media, onChange — unchanged, required, same shape/behavior as before.
 * - onContinue — OPTIONAL. If provided, the sticky "Continue to Automated Review"
 *   footer renders and calls it; if omitted, the footer button is hidden
 *   entirely rather than wired to nothing.
 */
const MediaUploader = ({ media, onChange, onContinue = null }) => {
    const inputRef = useRef(null);

    const addFiles = useCallback((files) => {
        const items = Array.from(files)
            .filter(f => f.type.startsWith('image/'))
            .map(f => ({ id: Math.random().toString(36).slice(2), file: f, previewUrl: URL.createObjectURL(f), description: '' }));
        onChange([...media, ...items]);
    }, [media, onChange]);

    const remove = (id) => onChange(media.filter(m => m.id !== id));
    const updateDesc = (id, desc) => onChange(media.map(m => m.id === id ? { ...m, description: desc } : m));

    const uploadedCount = media.length;

    return (
        <div>
            {/* ── 1. Documentation header ─────────────────────────────── */}
            <div className="mb-5">
                <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', color: GOLD }}>DOCUMENTATION UPLOAD</p>
                <h3 style={{ ...display, fontSize: '1.2rem', fontWeight: 600, color: INK, marginTop: 4 }}>Activity Documentation</h3>
                <p style={{ ...body, fontSize: '0.82rem', color: MUTED, marginTop: 4, maxWidth: 520 }}>
                    Upload photos of your community service, academic activities, or scholarship requirements.
                </p>
            </div>

            <input
                ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
            />

            {/* ── 2. Hero upload zone — entire card is clickable ─────────── */}
            <div
                onClick={() => inputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
                className="flex items-center gap-4 flex-wrap sm:flex-nowrap cursor-pointer transition-colors"
                style={{
                    background: SURFACE, border: `1.5px dashed ${BORDER}`, borderRadius: 16,
                    padding: '20px 22px', marginBottom: 18,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = PRIMARY; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; }}
            >
                <div className="flex items-center justify-center flex-shrink-0" style={{ width: 48, height: 48, borderRadius: '50%', background: PRIMARY_TINT }}>
                    <UploadCloud size={22} style={{ color: PRIMARY }} />
                </div>
                <div className="flex-1 min-w-0">
                    <p style={{ ...display, fontSize: '1.02rem', fontWeight: 600, color: INK }}>Drag &amp; Drop Your Activity Photos</p>
                    <p style={{ ...body, fontSize: '0.78rem', color: MUTED, marginTop: 2 }}>
                        JPG • PNG • WEBP
                    </p>
                </div>
            </div>

            {/* ── 3. Upload count ─────────────────────────────────────── */}
            <div className="mb-6">
                <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 16px' }}>
                    <p style={{ ...body, fontSize: '0.68rem', fontWeight: 600, color: GOLD }}>Uploaded</p>
                    <p style={{ ...display, fontSize: '1.4rem', fontWeight: 700, color: INK, marginTop: 4 }}>{uploadedCount}</p>
                </div>
            </div>

            {/* ── 4. Photo gallery ───────────────────────────────────── */}
            {media.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {media.map((item, i) => (
                        <div key={item.id} className="overflow-hidden" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, boxShadow: '0 8px 20px -16px rgba(36,21,18,0.3)' }}>
                            <div className="relative">
                                <img src={item.previewUrl} alt={`doc-${i}`} className="w-full object-cover" style={{ height: 168 }} />
                                <button
                                    onClick={() => remove(item.id)}
                                    className="absolute top-2.5 right-2.5 flex items-center justify-center transition-opacity hover:opacity-90"
                                    style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(36,21,18,0.65)', border: 'none', cursor: 'pointer' }}
                                >
                                    <X size={14} style={{ color: '#fff' }} />
                                </button>
                                <div className="absolute bottom-2.5 left-2.5" style={{ padding: '3px 10px', borderRadius: 999, background: PRIMARY }}>
                                    <span style={{ ...body, fontSize: '0.66rem', color: '#fff', fontWeight: 700 }}>Photo {i + 1}</span>
                                </div>
                            </div>
                            <div className="p-3">
                                <input
                                    type="text"
                                    placeholder={`Write a caption for photo ${i + 1}…`}
                                    value={item.description}
                                    onChange={e => updateDesc(item.id, e.target.value)}
                                    maxLength={140}
                                    className="w-full px-3 py-2.5 outline-none transition-colors"
                                    style={{ borderRadius: 10, border: `1px solid ${BORDER}`, ...body, fontSize: '0.83rem', color: INK, background: BG }}
                                    onFocus={e => (e.target.style.borderColor = PRIMARY)}
                                    onBlur={e => (e.target.style.borderColor = BORDER)}
                                />
                                <p style={{ ...body, fontSize: '0.66rem', color: MUTED, marginTop: 5, textAlign: 'right' }}>
                                    {item.description.length}/140
                                </p>
                            </div>
                        </div>
                    ))}

                    <div
                        onClick={() => inputRef.current?.click()}
                        className="flex flex-col items-center justify-center cursor-pointer transition-colors"
                        style={{ border: `1.5px dashed ${BORDER}`, borderRadius: 14, minHeight: 220, background: BG }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = PRIMARY; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; }}
                    >
                        <ImagePlus size={24} style={{ color: PRIMARY, marginBottom: 8 }} />
                        <span style={{ ...body, fontSize: '0.8rem', color: MUTED, fontWeight: 600 }}>Add more photos</span>
                    </div>
                </div>
            )}

            {/* ── 6. Bottom action area — only when the parent opts in ── */}
            {onContinue && (
                <div
                    className="sticky bottom-0 flex items-center justify-between gap-4 flex-wrap"
                    style={{ marginTop: 20, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '12px 18px' }}
                >
                    <div className="flex items-center gap-3 flex-1 min-w-[160px]">
                        <span style={{ ...body, fontSize: '0.78rem', color: MUTED }}>{uploadedCount} photo{uploadedCount === 1 ? '' : 's'} uploaded</span>
                    </div>
                    <button
                        onClick={onContinue}
                        className="flex-shrink-0 transition-opacity hover:opacity-90"
                        style={{ ...body, fontSize: '0.82rem', fontWeight: 700, color: '#fff', background: `linear-gradient(120deg, ${PRIMARY} 0%, ${PRIMARY_DEEP} 100%)`, border: 'none', borderRadius: 10, padding: '11px 22px', cursor: 'pointer' }}
                    >
                        Continue to AI Review
                    </button>
                </div>
            )}
        </div>
    );
};

export default MediaUploader;