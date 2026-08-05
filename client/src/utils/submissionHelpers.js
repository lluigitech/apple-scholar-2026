// submissionHelpers.js
// Pure helper functions used across the Officer submission review screens.

export const statusBadge = (status) => {
    const map = {
        pending:  { bg: '#fef3c7', color: '#92400e', dot: '#f59e0b', label: 'Pending'  },
        approved: { bg: '#d1fae5', color: '#065f46', dot: '#10b981', label: 'Approved' },
        rejected: { bg: '#fee2e2', color: '#991b1b', dot: '#ef4444', label: 'Rejected' },
    };
    return map[status] || map.pending;
};

export const sentimentBadge = (label) => {
    if (!label) return { bg: '#f1f5f9', color: '#94a3b8', label: '-' };
    if (label.includes('Positive')) return { bg: '#d1fae5', color: '#065f46', label };
    if (label === 'Neutral')        return { bg: '#dbeafe', color: '#1e40af', label };
    return { bg: '#fee2e2', color: '#991b1b', label };
};

export const qualityColor = (score) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
};

// Media paths/URLs are full Cloudinary URLs (e.g. https://res.cloudinary.com/...),
// not local server-relative paths, so we use them as-is with no localhost prefix.
export const getMediaItems = (sub) => {
    if (!sub.media_paths) return [];
    const paths = sub.media_paths.split(',');
    const descs  = sub.media_descriptions ? sub.media_descriptions.split(',') : [];
    return paths.map((p, i) => ({ path: p, description: descs[i] || '' }));
};

// Detects file type from a URL/path so we can render the right preview
// (image thumbnail vs PDF/DOC icon). Cloudinary URLs don't always end in a
// real extension, so we check the Cloudinary resource-type path segment
// first (/image/upload/, /raw/upload/, /video/upload/) before falling back
// to the file extension. This fixes cases where a PDF was mis-detected as
// an image (or vice versa) just because the URL had no ".pdf" at the end.
export const fileKind = (url) => {
    if (!url) return 'other';
    const clean = url.split('?')[0].toLowerCase();

    // Explicit extension wins first — most reliable signal when present.
    if (/\.(jpe?g|png|gif|webp|bmp|svg)$/.test(clean)) return 'image';
    if (/\.pdf$/.test(clean)) return 'pdf';
    if (/\.docx?$/.test(clean)) return 'doc';

    // No extension? Fall back to Cloudinary's resource-type path segment.
    if (/\/image\/upload\//.test(clean)) return 'image';
    if (/\/raw\/upload\//.test(clean)) {
        // Raw uploads are almost always PDFs or Office docs in this app.
        if (/docx?/.test(clean)) return 'doc';
        return 'pdf';
    }
    return 'other';
};