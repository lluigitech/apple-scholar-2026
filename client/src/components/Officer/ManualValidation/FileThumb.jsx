import React, { useState } from 'react';
import { FileText, Image as ImageIcon } from 'lucide-react';
import { fileKind } from '../../../utils/submissionHelpers';

// File Thumbnail - shows an image thumbnail for images, or a labeled icon
// card for PDFs/Word docs. Clicking always opens the in-page preview modal
// (via onPreview) instead of navigating to another tab/page.
const FileThumb = ({ url, label, onPreview }) => {
    const kind = fileKind(url);
    const [imgFailed, setImgFailed] = useState(false);

    if (kind === 'image' && !imgFailed) {
        return (
            <button onClick={() => onPreview({ url, kind, label })}
                className="block rounded-xl overflow-hidden border border-slate-100 group aspect-square w-full"
                style={{ padding: 0, cursor: 'pointer' }}>
                <img src={url} alt={label}
                    onError={() => setImgFailed(true)}
                    className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
            </button>
        );
    }
    const iconMap = { pdf: FileText, doc: FileText, other: FileText, image: ImageIcon };
    const labelMap = { pdf: 'PDF', doc: 'DOC', other: 'FILE', image: 'FILE' };
    const Icon = iconMap[kind];
    return (
        <button onClick={() => onPreview({ url, kind: imgFailed ? 'other' : kind, label })}
            className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50 aspect-square w-full hover:bg-slate-100 transition-all"
            style={{ cursor: 'pointer' }}>
            <Icon size={22} className="text-slate-400" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{labelMap[kind]}</span>
        </button>
    );
};

export default FileThumb;