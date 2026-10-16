import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Download, X, FileText, ExternalLink, File, FileArchive, AlertTriangle } from 'lucide-react';

// ── Apple Scholar Officer tokens (same as the Scholar Submissions page) ──
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const MAROON = '#6D2140';
const INK = '#241512';
const MUTED = '#8A7A68';
const SUCCESS = '#2F855A';
const DANGER = '#B91C1C';
const GOLD = '#A9784E';

const sans = { fontFamily: "'Inter', sans-serif" };

// Per-file-type accent so the header badge always signals what you're
// looking at before the body even loads (useful for slow Cloudinary PDFs).
// Colours come from the shared palette instead of one-off blues/greys.
const KIND_STYLES = {
    image: { icon: FileText, label: 'Image', bg: `${SUCCESS}14`, fg: SUCCESS },
    pdf: { icon: FileText, label: 'PDF', bg: `${DANGER}14`, fg: DANGER },
    doc: { icon: File, label: 'Document', bg: `${GOLD}1F`, fg: GOLD },
    other: { icon: FileArchive, label: 'File', bg: `${MUTED}1F`, fg: MUTED },
};

// Any URL that goes through OUR backend (the /submission/preview proxy) is
// behind verifyToken middleware, so it needs an Authorization header.
// Native <img>/<iframe>/<a> tags never send that header - only axios/fetch
// calls we make ourselves do. So for these URLs we fetch the bytes with
// axios (token attached), turn them into a blob, and point the tags at the
// blob URL instead of the raw backend URL.
const needsAuthProxy = (url) => url.includes('/api/submission/preview') || url.includes('/submission/preview');

const iconBtn = (enabled) => ({
    width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: enabled ? MUTED : '#D9CBB8', border: `1px solid ${enabled ? BORDER : 'transparent'}`,
    background: SURFACE, cursor: enabled ? 'pointer' : 'not-allowed', transition: 'background-color 150ms ease, color 150ms ease',
});

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
    // Works for both the public Cloudinary URL and the blob: URL we create
    // for auth-proxied files - Chromium reads the fragment either way, so
    // we always append it now instead of only for the non-proxied case.
    // (Firefox/Safari mostly ignore this and show their own minimal chrome -
    // there is no fully cross-browser way to strip it from a raw iframe.)
    const pdfSrc = preview.kind === 'pdf' && effectiveUrl
        ? `${effectiveUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`
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

    const hoverOn = (e) => { e.currentTarget.style.backgroundColor = BG; e.currentTarget.style.color = INK; };
    const hoverOff = (e) => { e.currentTarget.style.backgroundColor = SURFACE; e.currentTarget.style.color = MUTED; };

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
            style={{ backgroundColor: 'rgba(36,21,18,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={preview.label || 'File preview'}
                className="preview-dialog relative w-full sm:max-w-3xl h-[92vh] sm:h-auto sm:max-h-[88vh]
                           rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
                style={{ background: SURFACE, border: `1px solid ${BORDER}`, boxShadow: '0 24px 60px -20px rgba(74,23,41,0.40)' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 shrink-0" style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <div className="flex items-center gap-3 min-w-0">
                        <div
                            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                            style={{ backgroundColor: style.bg, color: style.fg }}
                        >
                            <KindIcon size={16} strokeWidth={2.1} />
                        </div>
                        <div className="min-w-0">
                            <p className="truncate leading-tight" style={{ ...sans, fontSize: '0.88rem', fontWeight: 700, color: INK }}>
                                {preview.label}
                            </p>
                            <p style={{ ...sans, fontSize: '0.72rem', fontWeight: 600, color: style.fg, marginTop: 1 }}>
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
                            aria-label="Open in new tab"
                            onClick={(e) => !effectiveUrl && e.preventDefault()}
                            onMouseEnter={effectiveUrl ? hoverOn : undefined}
                            onMouseLeave={effectiveUrl ? hoverOff : undefined}
                            className="hidden sm:flex"
                            style={iconBtn(!!effectiveUrl)}
                        >
                            <ExternalLink size={16} />
                        </a>
                        <a
                            href={effectiveUrl || '#'}
                            target="_blank"
                            rel="noreferrer"
                            download={requiresAuth ? (preview.label || 'file') : undefined}
                            title="Download"
                            aria-label="Download"
                            onClick={(e) => !effectiveUrl && e.preventDefault()}
                            onMouseEnter={effectiveUrl ? hoverOn : undefined}
                            onMouseLeave={effectiveUrl ? hoverOff : undefined}
                            style={iconBtn(!!effectiveUrl)}
                        >
                            <Download size={16} />
                        </a>
                        <button
                            onClick={onClose}
                            title="Close"
                            aria-label="Close preview"
                            style={{ ...iconBtn(true) }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = MAROON; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = MAROON; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = SURFACE; e.currentTarget.style.color = MUTED; e.currentTarget.style.borderColor = BORDER; }}
                        >
                            <X size={17} />
                        </button>
                    </div>
                </div>

                {/* Photo comment/description - this is part of the monthly letter itself,
                    so it's shown here regardless of who opens the preview (officer or scholar).
                    Officer-side callers simply don't pass `description`, so it stays hidden there. */}
                {preview.description && (
                    <div className="px-4 sm:px-5 py-3 shrink-0" style={{ backgroundColor: BG, borderBottom: `1px solid ${BORDER}` }}>
                        <p style={{ ...sans, fontSize: '0.7rem', fontWeight: 700, color: MAROON, marginBottom: 2 }}>
                            Comment
                        </p>
                        <p style={{ ...sans, fontSize: '0.8rem', color: INK, lineHeight: 1.55 }}>{preview.description}</p>
                    </div>
                )}

                {/* Body */}
                <div
                    className={`flex-1 min-h-0 overflow-auto flex items-center justify-center relative
                                ${preview.kind === 'pdf' ? 'p-0' : 'p-3 sm:p-5'}`}
                    style={{ backgroundColor: BG }}
                >
                    {fetchError ? (
                        <div className="flex flex-col items-center gap-3 py-10 px-6 text-center">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${DANGER}14`, color: DANGER }}>
                                <AlertTriangle size={22} strokeWidth={2} />
                            </div>
                            <p role="alert" style={{ ...sans, fontSize: '0.86rem', fontWeight: 700, color: INK }}>{fetchError}</p>
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
                                        className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                                        style={{ borderRadius: 12, border: `1px solid ${BORDER}`, background: SURFACE }}
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
                                        className="w-14 h-14 rounded-full flex items-center justify-center"
                                        style={{ backgroundColor: style.bg, color: style.fg }}
                                    >
                                        <KindIcon size={24} strokeWidth={1.9} />
                                    </div>
                                    <div>
                                        <p style={{ ...sans, fontSize: '0.9rem', fontWeight: 700, color: INK }}>
                                            {preview.kind === 'doc' ? "Can't preview Word documents here" : "Can't preview this file type"}
                                        </p>
                                        <p className="max-w-xs mx-auto" style={{ ...sans, fontSize: '0.78rem', color: MUTED, marginTop: 4, lineHeight: 1.5 }}>
                                            Download it to open with the right app on your device.
                                        </p>
                                    </div>
                                    <a
                                        href={effectiveUrl || '#'}
                                        target="_blank"
                                        rel="noreferrer"
                                        download={requiresAuth ? (preview.label || 'file') : undefined}
                                        onClick={(e) => !effectiveUrl && e.preventDefault()}
                                        className="inline-flex items-center gap-2 px-5 transition-opacity hover:opacity-90"
                                        style={{ ...sans, height: 40, borderRadius: 12, backgroundColor: MAROON, color: '#fff', fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none' }}
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
                .preview-dialog { animation: preview-in 0.22s ease-out; }
                @keyframes preview-in {
                    from { opacity: 0; transform: translateY(12px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @media (prefers-reduced-motion: reduce) { .preview-dialog { animation: none; } }
            `}</style>
        </div>
    );
};

const Spinner = () => (
    <div className="absolute inset-0 flex items-center justify-center">
        <div
            className="w-8 h-8 rounded-full animate-spin"
            style={{ border: `2px solid ${BORDER}`, borderTopColor: MAROON }}
        />
    </div>
);

export default FilePreviewModal;