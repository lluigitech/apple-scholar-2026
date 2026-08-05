import React from 'react';
import { Smile, Frown, AlertTriangle } from 'lucide-react';

const SentimentBadge = ({ type = "Negative" }) => {
    const renderBadge = () => {
        switch(type.toLowerCase().trim()) {
            case 'very negative':
            case 'negative':
                return (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-red-50 border border-red-100 text-red-600 font-sans text-xs font-bold">
                        <Frown size={14} />
                        <span>{type} (Distress Detected)</span>
                    </div>
                );
            case 'positive':
            case 'very positive':
                return (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 font-sans text-xs font-bold">
                        <Smile size={14} />
                        <span>{type} (Stable)</span>
                    </div>
                );
            default:
                return (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-50 border border-slate-100 text-slate-500 font-sans text-xs font-bold">
                        <AlertTriangle size={14} />
                        <span>Neutral</span>
                    </div>
                );
        }
    };

    return <div className="inline-block">{renderBadge()}</div>;
};

export default SentimentBadge;