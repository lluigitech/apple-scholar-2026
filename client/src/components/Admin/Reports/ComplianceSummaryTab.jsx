import { useState } from 'react';
import { Download, TrendingUp } from 'lucide-react';

const MAROON = '#802B36';
const MAROON_LIGHT = '#F5E8EA';

export default function ComplianceSummaryTab({
  rows = [],
  loading,
  error,
  onRefresh,
  onGenerate,
}) {
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const handleGeneratePDF = async () => {
    setGeneratingPdf(true);
    try {
      await onGenerate();
    } finally {
      setGeneratingPdf(false);
    }
  };

  const getRiskBadge = (status) => {
    const badges = {
      excellent: { bg: '#d1fae5', color: '#065f46', label: 'Excellent' },
      good: { bg: '#dbeafe', color: '#1e40af', label: 'Good' },
      'at-risk': { bg: '#fee2e2', color: '#991b1b', label: 'At Risk' },
    };
    return badges[status] || badges.good;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.9rem', color: '#9ca3af' }}>
          Loading compliance data...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.9rem', color: '#ef4444', marginBottom: '16px' }}>
          {error}
        </p>
        <button
          onClick={onRefresh}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            background: MAROON,
            color: '#fff',
            fontFamily: "'DM Sans',sans-serif",
            fontWeight: 600,
            fontSize: '0.875rem',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.15rem', fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>
            Scholar Compliance Summary
          </h3>
          <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.85rem', color: '#6b7280' }}>
            Real-time compliance status of all scholars
          </p>
        </div>
        <button
          onClick={handleGeneratePDF}
          disabled={generatingPdf}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            borderRadius: 8,
            background: MAROON,
            color: '#fff',
            border: 'none',
            fontFamily: "'DM Sans',sans-serif",
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            opacity: generatingPdf ? 0.6 : 1,
          }}
        >
          <Download className="w-4 h-4" /> Generate PDF Report
        </button>
      </div>

      <div className="overflow-x-auto">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: MAROON_LIGHT, borderBottom: `1px solid #f3d0d4` }}>
              {['Scholar Name', 'Student ID', 'Completion Rate', 'Risk Status'].map(h => (
                <th
                  key={h}
                  style={{
                    textAlign: 'left',
                    padding: '14px 20px',
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: MAROON,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row, i) => {
                const badge = getRiskBadge(row.riskStatus || 'good');
                return (
                  <tr
                    key={i}
                    style={{
                      borderBottom: '1px solid #e5e7eb',
                      ':hover': { background: '#f9fafb' },
                    }}
                  >
                    <td style={{ padding: '14px 20px', fontFamily: "'DM Sans',sans-serif", fontSize: '0.875rem', fontWeight: 600, color: '#1a1a1a' }}>
                      {row.name || '—'}
                    </td>
                    <td style={{ padding: '14px 20px', fontFamily: "'DM Sans',sans-serif", fontSize: '0.875rem', color: '#6b7280' }}>
                      {row.studentId || '—'}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          style={{
                            width: '100%',
                            maxWidth: '100px',
                            height: 8,
                            borderRadius: 99,
                            background: '#e5e7eb',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${row.completionRate || 0}%`,
                              height: '100%',
                              background: MAROON,
                            }}
                          />
                        </div>
                        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.875rem', fontWeight: 600, color: MAROON }}>
                          {row.completionRate || 0}%
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: 99,
                          fontFamily: "'DM Sans',sans-serif",
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: badge.bg,
                          color: badge.color,
                        }}
                      >
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} style={{ padding: '48px 20px', textAlign: 'center' }}>
                  <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.9rem', color: '#9ca3af' }}>
                    No compliance data available
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
