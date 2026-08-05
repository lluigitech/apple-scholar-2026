import React, { useRef, useCallback } from 'react';
import { ImagePlus, X } from 'lucide-react';

// ── Token system — shared across the Scholar Portal ──
const MAROON = '#7f2d3a';
const GOLD = '#b98b4e';
const IVORY = '#FBF7F2';
const INK = '#241512';

const MediaUploader = ({ media, onChange }) => {
    const inputRef = useRef(null);

    const addFiles = useCallback((files) => {
        const items = Array.from(files)
            .filter(f => f.type.startsWith('image/'))
            .map(f => ({ id: Math.random().toString(36).slice(2), file: f, previewUrl: URL.createObjectURL(f), description: '' }));
        onChange([...media, ...items]);
    }, [media, onChange]);

    const remove = (id) => onChange(media.filter(m => m.id !== id));
    const updateDesc = (id, desc) => onChange(media.map(m => m.id === id ? { ...m, description: desc } : m));

    return (
        <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div>
                    <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.05rem', fontWeight: 700, color: INK }}>
                        Documentation Photos
                    </h3>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.77rem', color: '#9ca3af' }}>
                        Attach photos of your activities — each photo needs a short description
                    </p>
                </div>
                <button onClick={() => inputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 rounded-full transition-opacity hover:opacity-80"
                    style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.82rem', fontWeight: 600, background: MAROON, color: '#fff', border: 'none', cursor: 'pointer' }}>
                    <ImagePlus className="w-4 h-4" /> Add Photos
                </button>
                <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                    onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
            </div>

            {media.length === 0 ? (
                <div className="rounded-2xl p-8 text-center cursor-pointer transition-colors"
                    style={{ border: `2px dashed ${GOLD}88`, background: IVORY }}
                    onClick={() => inputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}>
                    <ImagePlus className="w-10 h-10 mx-auto mb-3" style={{ color: GOLD }} />
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', color: '#9ca3af' }}>
                        Drag &amp; drop photos or click <span style={{ color: MAROON, fontWeight: 600 }}>Add Photos</span>
                    </p>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', color: '#d1d5db', marginTop: 4 }}>
                        JPG, PNG, WEBP accepted
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {media.map((item, i) => (
                        <div key={item.id} className="rounded-2xl overflow-hidden bg-white" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)' }}>
                            <div className="relative">
                                <img src={item.previewUrl} alt={`doc-${i}`} className="w-full object-cover" style={{ height: 170 }} />
                                <button onClick={() => remove(item.id)}
                                    className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                                    style={{ background: 'rgba(36,21,18,0.6)', border: 'none', cursor: 'pointer' }}>
                                    <X className="w-3.5 h-3.5" style={{ color: '#fff' }} />
                                </button>
                                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md" style={{ background: 'rgba(127,45,58,0.85)' }}>
                                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.7rem', color: '#fff', fontWeight: 600 }}>
                                        Documentation {i + 1}
                                    </span>
                                </div>
                            </div>
                            <div className="p-3">
                                <input type="text" placeholder={`Short description for photo ${i + 1}…`}
                                    value={item.description} onChange={e => updateDesc(item.id, e.target.value)}
                                    className="w-full rounded-lg border px-3 py-2 outline-none transition-all"
                                    style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.82rem', color: INK, background: IVORY, borderColor: '#e9dfd8' }}
                                    onFocus={e => (e.target.style.borderColor = MAROON)}
                                    onBlur={e => (e.target.style.borderColor = '#e9dfd8')} />
                            </div>
                        </div>
                    ))}
                    <div className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors"
                        style={{ borderColor: `${GOLD}88`, minHeight: 220, background: IVORY }}
                        onClick={() => inputRef.current?.click()}>
                        <ImagePlus className="w-8 h-8 mb-2" style={{ color: GOLD }} />
                        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem', color: '#9ca3af' }}>Add more photos</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MediaUploader;