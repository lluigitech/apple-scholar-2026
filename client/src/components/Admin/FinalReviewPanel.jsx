import React, { useState } from 'react';
import { CheckCircle, XCircle, MessageSquare } from 'lucide-react';

const FinalReviewPanel = ({ onSubmitReview }) => {
    const [comments, setComments] = useState('');

    return (
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm font-sans">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                <MessageSquare size={16} className="text-[#7f2d3a]" /> Executive Oversight Review
            </h3>
            
            <p className="text-xs text-slate-400 mb-4">
                The NLP check and structural validations are complete. Please enter final disposition below.
            </p>

            {/* Comment Entry Area */}
            <textarea 
                rows="3"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Write verification notes or grounds for rejection..."
                className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs focus:ring-2 focus:ring-[#7f2d3a]/20 focus:border-[#7f2d3a] outline-none transition-all resize-none"
            />

            {/* Decision Actions Button Triggers */}
            <div className="grid grid-cols-2 gap-3 mt-4">
                <button 
                    onClick={() => onSubmitReview('approved', comments)}
                    className="flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] uppercase tracking-wider py-3.5 rounded-xl transition-colors shadow-md"
                >
                    <CheckCircle size={14} /> Grant Approval
                </button>
                <button 
                    onClick={() => onSubmitReview('rejected', comments)}
                    className="flex items-center justify-center gap-2 bg-[#7f2d3a] hover:bg-[#63232d] text-white font-bold text-[11px] uppercase tracking-wider py-3.5 rounded-xl transition-colors shadow-md"
                >
                    <XCircle size={14} /> Flag & Reject
                </button>
            </div>
        </div>
    );
};

export default FinalReviewPanel;