import { useState, useMemo } from 'react';
import { CheckCircle, AlertTriangle, XCircle, ChevronRight } from 'lucide-react';

const MAROON = '#802B36';
const MAROON_LIGHT = '#F5E8EA';

export default function MonthlyReportsTab({
  filteredReports = [],
  loading,
  error,
  counts = { all: 0, accepted: 0, 'medium-risk': 0, 'high-risk': 0 },
  statusFilter,
  setStatusFilter,
  month,
  setMonth,
  yearLevel,
  setYearLevel,
  onRefresh,
  onSelectReport,
}) {
  const reportStatusBadge = (status) => {
    const badges = {
      accepted: { bg: '#d1fae5', color: '#065f46', label: 'Accepted', Icon: CheckCircle },
      'medium-risk': { bg: '#fef3c7', color: '#92400e', label: 'Medium Risk', Icon: AlertTriangle },
      'high-risk': { bg: '#fee2e2', color: '#991b1b', label: 'High Risk', Icon: XCircle },
    };

    return badges[status] || { bg: '#f3f4f6', color: '#6b7280', label: status ? status.replace(/-/g, ' ') : 'Unknown', Icon: CheckCircle };
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.9rem', color: '#9ca3af' }}>
          Loading monthly reports...
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
      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: 8, fontFamily: "'DM Sans',sans-serif", fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
            Month
          </label>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              fontFamily: "'DM Sans',sans-serif",
              fontSize: '0.9rem',
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 8, fontFamily: "'DM Sans',sans-serif", fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
            Year Level
          </label>
          <select
            value={yearLevel}
            onChange={e => setYearLevel(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              fontFamily: "'DM Sans',sans-serif",
              fontSize: '0.9rem',
            }}
          >
            <option value="">All Year Levels</option>
            <option value="1st Year">1st Year</option>
            <option value="2nd Year">2nd Year</option>
            <option value="3rd Year">3rd Year</option>
            <option value="4th Year">4th Year</option>
          </select>
        </div>
      </div>

      {/* Status Filter Badges */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: 'All', count: counts.all },
          { key: 'accepted', label: 'Accepted', count: counts.accepted },
          { key: 'medium-risk', label: 'Medium Risk', count: counts['medium-risk'] },
          { key: 'high-risk', label: 'High Risk', count: counts['high-risk'] },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            style={{
              padding: '8px 16px',
              borderRadius: 99,
              fontFamily: "'DM Sans',sans-serif",
              fontSize: '0.85rem',
              fontWeight: 600,
              background: statusFilter === f.key ? MAROON : '#f3f4f6',
              color: statusFilter === f.key ? '#fff' : '#6b7280',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            {f.label}
            <span style={{ marginLeft: 6, fontSize: '0.75rem', opacity: 0.8 }}>({f.count})</span>
          </button>
        ))}
      </div>

      {/* Reports List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredReports.length > 0 ? (
          filteredReports.map(report => {
            const badge = reportStatusBadge(report.status || 'accepted');
            const BadgeIcon = badge?.Icon || CheckCircle;
            return (
              <div
                key={report.id}
                onClick={() => onSelectReport(report)}
                style={{
                  padding: '16px',
                  borderRadius: 12,
                  border: '1px solid #e5e7eb',
                  background: '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  ':hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.95rem', fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>
                      {report.scholarName} ({report.course})
                    </h4>
                    <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.8rem', color: '#6b7280', marginBottom: 8 }}>
                      {report.school} · {report.year}
                    </p>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', color: '#9ca3af' }}>
                      <span>Submitted: {report.submittedAt}</span>
                      <span>Quality: {report.qualityScore}/100</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        borderRadius: 99,
                        fontFamily: "'DM Sans',sans-serif",
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: badge.bg,
                        color: badge.color,
                      }}
                    >
                      <BadgeIcon style={{ width: 14, height: 14 }} />
                      {badge.label}
                    </span>
                    <ChevronRight style={{ width: 18, height: 18, color: '#d1d5db' }} />
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.9rem', color: '#9ca3af' }}>
              No reports found. Try adjusting your filters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
