import React from 'react';
import { BarChart3, AlertTriangle, CheckCircle, TrendingDown } from 'lucide-react';

const AnalyticsChart = () => {
    // Mock statistical aggregates matched with Kalinga Foundation's target monitoring rules
    const metricsSummary = {
        totalScholars: 150,
        compliantScholars: 112,
        flaggedScholars: 38,
        riskDistribution: [
            { category: 'Academic At-Risk (GPA Drop)', count: 18, percentage: 47, color: 'bg-red-600' },
            { category: 'Missed Document Deadlines', count: 12, percentage: 31, color: 'bg-amber-500' },
            { category: 'Negative Sentiment Alerts (NLP)', count: 8, percentage: 22, color: 'bg-purple-600' }
        ]
    };

    return (
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm font-sans">
            
            {/* Header Title Section */}
            <div className="flex justify-between items-start border-b border-slate-50 pb-5 mb-6">
                <div>
                    <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                        <BarChart3 size={20} className="text-[#7f2d3a]" />
                        Compliance Metric Analytics
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Real-time distribution of risk factors and validation state.</p>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-lg">
                    Batch 2026
                </span>
            </div>

            {/* Top Quick Numbers Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl">
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Total Active Scholars</p>
                    <p className="text-2xl font-black text-slate-800 mt-1">{metricsSummary.totalScholars}</p>
                </div>
                <div className="p-4 bg-emerald-50/30 border border-emerald-100/50 rounded-2xl">
                    <p className="text-[10px] text-emerald-600 uppercase font-black tracking-wider flex items-center gap-1">
                        <CheckCircle size={10} /> Fully Compliant
                    </p>
                    <p className="text-2xl font-black text-emerald-700 mt-1">{metricsSummary.compliantScholars}</p>
                </div>
                <div className="p-4 bg-red-50/30 border border-red-100/50 rounded-2xl">
                    <p className="text-[10px] text-red-600 uppercase font-black tracking-wider flex items-center gap-1">
                        <AlertTriangle size={10} /> Flagged for Review
                    </p>
                    <p className="text-2xl font-black text-red-700 mt-1">{metricsSummary.flaggedScholars}</p>
                </div>
            </div>

            {/* Custom Interactive Risk Factor Bar Chart Layout */}
            <div className="space-y-5">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <TrendingDown size={14} className="text-red-500" /> Primary Risk Breakdown
                </h4>
                
                {metricsSummary.riskDistribution.map((item, index) => (
                    <div key={index} className="space-y-2">
                        {/* Label Metadata */}
                        <div className="flex justify-between text-xs">
                            <span className="font-bold text-slate-700">{item.category}</span>
                            <span className="font-mono text-slate-400 font-bold">
                                {item.count} Scholars ({item.percentage}%)
                            </span>
                        </div>
                        
                        {/* Progress Bar Container Track */}
                        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden relative">
                            <div 
                                className={`h-full ${item.color} rounded-full transition-all duration-1000 ease-out`}
                                style={{ width: `${item.percentage}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* Bottom Insight Footer block for Panel Demonstration */}
            <div className="mt-6 pt-5 border-t border-slate-50 text-[11px] text-slate-400 flex justify-between items-center">
                <span>Metrics synced with Kalinga Foundation parameters</span>
                <span className="font-bold text-[#7f2d3a] cursor-pointer hover:underline">View Detailed Records &rarr;</span>
            </div>

        </div>
    );
};

export default AnalyticsChart;