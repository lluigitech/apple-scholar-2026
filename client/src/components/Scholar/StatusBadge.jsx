const StatusBadge = ({ status }) => {
    const styles = {
        verified: "bg-emerald-100 text-emerald-700 border-emerald-200",
        pending: "bg-amber-100 text-amber-700 border-amber-200",
        rejected: "bg-red-100 text-red-700 border-red-200",
    };

    const currentStyle = styles[status.toLowerCase()] || styles.pending;

    return (
        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${currentStyle}`}>
            {status}
        </span>
    );
};

export default StatusBadge;