import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Download, X, FileText, ExternalLink, File, FileArchive, AlertTriangle } from 'lucide-react';

const MAROON = '#7f2d3a';
const BLUSH = '#F5E8EA';

// Per-file-type accent so the header badge always signals what you're
// looking at before the body even loads (useful for slow Cloudinary PDFs).
const KIND_STYLES = {
    image: { icon: FileText, label: 'Image', bg: '#EAF3EE', fg: '#2F6B4F' },
    pdf: { icon: FileText, label: 'PDF', bg: '#FDECEC', fg: '#B3261E' },
    doc: { icon: File, label: 'Document', bg: '#E9EEFB', fg: '#2E4FA3' },
    other: { icon: FileArchive, label: 'File', bg: '#F1F1F1', fg: '#5B5B5B' },
};

// Any URL that goes through OUR backend (the /submission/preview proxy) is
// behind verifyToken middleware, so it needs an Authorization header.
// Native <img>/<iframe>/<a> tags never send that header - only axios/fetch
// calls we make ourselves do. So for these URLs we fetch the bytes with
// axios (token attached), turn them into a blob, and point the tags at the
// blob URL instead of the raw backend URL.
const needsAuthProxy = (url) => url.includes('/api/submission/preview') || url.includes('/submission/preview');

const FilePreviewModal = ({ preview, onClose }) => {
    const [loaded, setLoaded] = useState(false);
    const [objectUrl, setObjectUrl] = useState(null);
    const [fetchError, setFetchError] = useState(null);
    const style = KIND_STYLES[preview.kind] || KIND_STYLES.other;
    const KindIcon = style.icon;

    const rawUrl = preview.url;
    const requiresAuth = needsAuthProxy(rawUrl);
    // What we actually render/link to: the blob we fetched ourselves if this
    // URL needed auth, otherwise the original URL (public Cloudinary asset).
    const effectiveUrl = requiresAuth ? objectUrl : rawUrl;

    useEffect(() => {
        if (!requiresAuth) {
            setObjectUrl(null);
            setFetchError(null);
            return;
        }

        let currentBlobUrl = null;
        let cancelled = false;

        const fetchWithAuth = async () => {
            setLoaded(false);
            setFetchError(null);
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(rawUrl, {
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: 'blob',
                });
                if (cancelled) return;
                currentBlobUrl = URL.createObjectURL(res.data);
                setObjectUrl(currentBlobUrl);
            } catch (err) {
                if (cancelled) return;
                console.error('Preview fetch failed:', err);
                setFetchError(
                    err.response?.status === 401
                        ? 'Session expired. Please log in again.'
                        : "Couldn't load this file."
                );
            }
        };

        fetchWithAuth();

        return () => {
            cancelled = true;
            if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rawUrl, requiresAuth]);

    // Chrome/Edge's built-in PDF viewer renders its own dark toolbar chrome
    // inside the iframe's document - it's not part of our DOM, so it can't
    // be styled away with CSS. Appending these hash params is the one thing
    // Chromium's viewer respects to hide toolbar/sidebar/scrollbar on load.
    // (Firefox/Safari mostly ignore this and show their own minimal chrome -
    // there is no fully cross-browser way to strip it from a raw iframe.)
    const pdfSrc = preview.kind === 'pdf' && effectiveUrl
        ? `${effectiveUrl}${requiresAuth ? '' : '#toolbar=0&navpanes=0&scrollbar=0&view=FitH'}`
        : effectiveUrl;

    // Escape closes, and lock background scroll while open.
    useEffect(() => {
        const onKey = (e) => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [onClose]);

    const isWaitingOnAuthFetch = requiresAuth && !objectUrl && !fetchError;

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
            style={{ backgroundColor: 'rgba(20,10,12,0.55)', backdropFilter: 'blur(6px)' }}
            onClick={onClose}
        >
            <div
                className="relative bg-white w-full sm:max-w-3xl h-[92vh] sm:h-auto sm:max-h-[88vh]
                           rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col
                           animate-[preview-in_0.22s_ease-out]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: style.bg, color: style.fg }}
                        >
                            <KindIcon size={16} strokeWidth={2.25} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate leading-tight">
                                {preview.label}
                            </p>
                            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: style.fg }}>
                                {style.label}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        {/* Open/Download only make sense once we actually have a usable URL
                            (either the public asset, or the blob we fetched with auth). */}
                        <a
                            href={effectiveUrl || '#'}
                            target="_blank"
                            rel="noreferrer"
                            title="Open in new tab"
                            onClick={(e) => !effectiveUrl && e.preventDefault()}
                            className={`hidden sm:flex w-9 h-9 items-center justify-center rounded-xl transition-colors
                                        ${effectiveUrl ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100' : 'text-slate-200 cursor-not-allowed'}`}
                        >
                            <ExternalLink size={16} />
                        </a>
                        <a
                            href={effectiveUrl || '#'}
                            target="_blank"
                            rel="noreferrer"
                            download={requiresAuth ? (preview.label || 'file') : undefined}
                            title="Download"
                            onClick={(e) => !effectiveUrl && e.preventDefault()}
                            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors
                                        ${effectiveUrl ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100' : 'text-slate-200 cursor-not-allowed'}`}
                        >
                            <Download size={16} />
                        </a>
                        <button
                            onClick={onClose}
                            title="Close"
                            className="w-9 h-9 flex items-center justify-center rounded-xl
                                       text-slate-400 hover:text-white transition-colors"
                            style={{ backgroundColor: 'transparent' }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = MAROON)}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                            <X size={17} />
                        </button>
                    </div>
                </div>

                {/* Photo comment/description - this is part of the monthly letter itself,
                    so it's shown here regardless of who opens the preview (officer or scholar).
                    Officer-side callers simply don't pass `description`, so it stays hidden there. */}
                {preview.description && (
                    <div className="px-4 sm:px-5 py-2.5 border-b border-slate-100 shrink-0" style={{ backgroundColor: BLUSH }}>
                        <p className="text-[10px] font-black uppercase tracking-wider mb-0.5" style={{ color: MAROON }}>
                            Comment
                        </p>
                        <p className="text-xs text-slate-600 leading-relaxed">{preview.description}</p>
                    </div>
                )}

                {/* Body */}
                <div
                    className={`flex-1 min-h-0 overflow-auto bg-slate-50 flex items-center justify-center relative
                                ${preview.kind === 'pdf' ? 'p-0' : 'p-3 sm:p-5'}`}
                >
                    {fetchError ? (
                        <div className="flex flex-col items-center gap-3 py-10 px-6 text-center">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#fef2f2', color: '#ef4444' }}>
                                <AlertTriangle size={24} strokeWidth={2} />
                            </div>
                            <p className="text-sm font-bold text-slate-700">{fetchError}</p>
                        </div>
                    ) : isWaitingOnAuthFetch ? (
                        <Spinner />
                    ) : (
                        <>
                            {preview.kind === 'image' && (
                                <>
                                    {!loaded && <Spinner />}
                                    <img
                                        src={effectiveUrl}
                                        alt={preview.label}
                                        onLoad={() => setLoaded(true)}
                                        className={`max-w-full max-h-full object-contain rounded-xl shadow-sm
                                                    transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                                    />
                                </>
                            )}

                            {preview.kind === 'pdf' && (
                                <div className="w-full h-full relative">
                                    {!loaded && <Spinner />}
                                    <iframe
                                        src={pdfSrc}
                                        title={preview.label}
                                        onLoad={() => setLoaded(true)}
                                        className={`w-full h-full transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                                        style={{ border: 'none', minHeight: '60vh' }}
                                    />
                                </div>
                            )}

                            {(preview.kind === 'doc' || preview.kind === 'other') && (
                                <div className="flex flex-col items-center gap-4 py-10 px-6 text-center">
                                    <div
                                        className="w-16 h-16 rounded-2xl flex items-center justify-center"
                                        style={{ backgroundColor: style.bg, color: style.fg }}
                                    >
                                        <KindIcon size={26} strokeWidth={2} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-700">
                                            {preview.kind === 'doc' ? "Can't preview Word documents here" : "Can't preview this file type"}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1 max-w-xs">
                                            Download it to open with the right app on your device.
                                        </p>
                                    </div>
                                    <a
                                        href={effectiveUrl || '#'}
                                        target="_blank"
                                        rel="noreferrer"
                                        download={requiresAuth ? (preview.label || 'file') : undefined}
                                        onClick={(e) => !effectiveUrl && e.preventDefault()}
                                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold
                                                   uppercase tracking-wider text-white transition-transform hover:scale-[1.02]"
                                        style={{ backgroundColor: MAROON }}
                                    >
                                        <Download size={14} />
                                        Download {preview.kind === 'doc' ? 'document' : 'file'}
                                    </a>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes preview-in {
                    from { opacity: 0; transform: translateY(12px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
};

const Spinner = () => (
    <div className="absolute inset-0 flex items-center justify-center">
        <div
            className="w-8 h-8 rounded-full border-2 border-slate-200 animate-spin"
            style={{ borderTopColor: MAROON }}
        />
    </div>
);

export default FilePreviewModal;