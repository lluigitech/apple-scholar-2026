import { Download, FileText } from 'lucide-react';

const MAROON = '#802B36';
const MAROON_LIGHT = '#F5E8EA';

export default function AttendanceReportsTab({
  data = [],
  loading,
  error,
  filters,
  setFilters,
  onFetch,
  onExport,
}) {
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.9rem', color: '#9ca3af' }}>
          Loading attendance records...
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
          onClick={onFetch}
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', padding: '16px', borderRadius: 12, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
        <div>
          <label style={{ display: 'block', marginBottom: 8, fontFamily: "'DM Sans',sans-serif", fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
            From Date
          </label>
          <input
            type="date"
            value={filters.date_from}
            onChange={e => handleFilterChange('date_from', e.target.value)}
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
            To Date
          </label>
          <input
            type="date"
            value={filters.date_to}
            onChange={e => handleFilterChange('date_to', e.target.value)}
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
            Status
          </label>
          <select
            value={filters.status}
            onChange={e => handleFilterChange('status', e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              fontFamily: "'DM Sans',sans-serif",
              fontSize: '0.9rem',
            }}
          >
            <option value="all">All Status</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="excused">Excused</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
          <button
            onClick={onFetch}
            style={{
              flex: 1,
              padding: '10px 20px',
              borderRadius: 8,
              background: MAROON,
              color: '#fff',
              fontFamily: "'DM Sans',sans-serif",
              fontSize: '0.875rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Search Records
          </button>
          <button
            onClick={() => onExport(data)}
            disabled={data.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              background: '#fff',
              fontFamily: "'DM Sans',sans-serif",
              fontSize: '0.875rem',
              fontWeight: 600,
              color: MAROON,
              cursor: data.length > 0 ? 'pointer' : 'not-allowed',
              opacity: data.length > 0 ? 1 : 0.5,
            }}
          >
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: MAROON_LIGHT, borderBottom: `1px solid #f3d0d4` }}>
              {['Scholar', 'Scholar ID', 'Year Level', 'Duty', 'Date', 'Location', 'Status', 'Method', 'Marked At'].map(h => (
                <th
                  key={h}
                  style={{
                    textAlign: 'left',
                    padding: '12px 16px',
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: MAROON,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? (
              data.map((record, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  <td style={{ padding: '12px 16px', fontFamily: "'DM Sans',sans-serif", fontSize: '0.85rem', color: '#1a1a1a', whiteSpace: 'nowrap' }}>
                    {record.date || record.marked_at?.split('T')[0] || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: "'DM Sans',sans-serif", fontSize: '0.85rem', fontWeight: 600, color: '#1a1a1a' }}>
                    {record.staff_name || record.performed_by || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: "'DM Sans',sans-serif", fontSize: '0.85rem', color: '#1a1a1a' }}>
                    {record.scholar || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: "'DM Sans',sans-serif", fontSize: '0.85rem', color: '#6b7280' }}>
                    {record.scholar_id || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: "'DM Sans',sans-serif", fontSize: '0.85rem', color: '#6b7280' }}>
                    {record.year_level || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: "'DM Sans',sans-serif", fontSize: '0.85rem', color: '#6b7280' }}>
                    {record.duty || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: "'DM Sans',sans-serif", fontSize: '0.85rem', color: '#6b7280' }}>
                    {record.date || record.marked_at?.split('T')[0] || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: "'DM Sans',sans-serif", fontSize: '0.85rem', color: '#6b7280' }}>
                    {record.location || '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: 99,
                        fontFamily: "'DM Sans',sans-serif",
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background:
                          record.status === 'present' ? '#d1fae5' :
                          record.status === 'absent' ? '#fee2e2' :
                          record.status === 'excused' ? '#fef3c7' : '#f3f4f6',
                        color:
                          record.status === 'present' ? '#065f46' :
                          record.status === 'absent' ? '#991b1b' :
                          record.status === 'excused' ? '#92400e' : '#6b7280',
                      }}
                    >
                      {record.status ? record.status.charAt(0).toUpperCase() + record.status.slice(1) : '—'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: "'DM Sans',sans-serif", fontSize: '0.85rem', color: '#6b7280', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {record.method || '—'}{record.marked_at ? ` • ${new Date(record.marked_at).toLocaleString('en-PH')}` : ''}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={{ padding: '48px 20px', textAlign: 'center' }}>
                  <FileText style={{ width: 40, height: 40, margin: '0 auto 12px', color: '#d1d5db' }} />
                  <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.9rem', color: '#9ca3af' }}>
                    No attendance records found. Try adjusting your filters.
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
