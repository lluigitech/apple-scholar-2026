// src/components/Administrator/RiskScoreCard.jsx
const RiskScoreCard = ({ score, level, description }) => {
    const color = score >= 80 ? 'red' : score >= 50 ? 'orange' : 'green';
    const colorMap = {
        red: 'bg-red-50 border-red-100 text-red-700',
        orange: 'bg-orange-50 border-orange-100 text-orange-700',
        green: 'bg-green-50 border-green-100 text-green-700',
    };

    return (
        <div className={`p-6 rounded-[2rem] border shadow-sm ${colorMap[color]}`}>
            <p className="text-5xl font-black">{score}</p>
            <p className="font-black uppercase tracking-widest text-sm mt-1">{level}</p>
            <p className="text-xs text-slate-500 mt-3 leading-relaxed">{description}</p>
        </div>
    );
};

export default RiskScoreCard;