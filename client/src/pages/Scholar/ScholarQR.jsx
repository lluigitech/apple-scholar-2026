import { useState, useEffect } from 'react';
import { User, Mail, Phone, Hash, Download, Shield, BookOpen, QrCode, CreditCard } from 'lucide-react';
import { formatYearLevelLabel } from '../../utils/yearLevelLabels';

// Deterministic QR SVG
function QRCodeSVG({ value, cellSize = 7 }) {
  const hash = value.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const size = 21;
  const cells = [];

  const isFinderPattern = (r, c) =>
    (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);

  const finderCell = (r, c) => {
    const norm = (x, mn, mx) => x >= mn && x <= mx;
    if (r < 7 && c < 7) {
      if (r === 0 || r === 6 || c === 0 || c === 6) return true;
      return norm(r, 2, 4) && norm(c, 2, 4);
    }
    if (r < 7 && c >= size - 7) {
      const lc = c - (size - 7);
      if (r === 0 || r === 6 || lc === 0 || lc === 6) return true;
      return norm(r, 2, 4) && norm(lc, 2, 4);
    }
    if (r >= size - 7 && c < 7) {
      const lr = r - (size - 7);
      if (lr === 0 || lr === 6 || c === 0 || c === 6) return true;
      return norm(lr, 2, 4) && norm(c, 2, 4);
    }
    return false;
  };

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      let dark;
      if (isFinderPattern(r, c)) dark = finderCell(r, c);
      else if (r === 6) dark = c % 2 === 0;
      else if (c === 6) dark = r % 2 === 0;
      else {
        const seed = (r * size + c + hash * 7 + r * c) % 97;
        dark = seed > 45;
      }
      cells.push({ r, c, dark });
    }
  }

  const qrSize = size * cellSize;
  return (
    <svg width={qrSize} height={qrSize} viewBox={`0 0 ${qrSize} ${qrSize}`} xmlns="http://www.w3.org/2000/svg">
      <rect width={qrSize} height={qrSize} fill="white" />
      {cells.map(({ r, c, dark }) =>
        dark ? <rect key={`${r}-${c}`} x={c * cellSize} y={r * cellSize} width={cellSize} height={cellSize} fill="#802B36" /> : null
      )}
    </svg>
  );
}

// ── Premium ID Card ─────────────────────────────────────────────────────────
function PremiumIDCard({ scholar }) {
  return (
    <div style={{
      width: '100%',
      maxWidth: 360,
      borderRadius: 20,
      overflow: 'hidden',
      position: 'relative',
      background: '#1a0a0d',
      boxShadow: '0 24px 64px rgba(128,43,54,0.45), 0 4px 20px rgba(0,0,0,0.35)',
      fontFamily: "'DM Sans', sans-serif",
      color: 'white',
      aspectRatio: '1.586 / 1',
    }}>
      {/* Background texture layers */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #2d0e14 0%, #1a0a0d 50%, #260d12 100%)' }} />

      {/* Gold foil diagonal band */}
      <div style={{
        position: 'absolute', top: -40, left: -20, right: -20, bottom: -40,
        background: 'linear-gradient(115deg, transparent 30%, rgba(212,175,55,0.07) 45%, rgba(212,175,55,0.12) 50%, rgba(212,175,55,0.07) 55%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Subtle radial glow */}
      <div style={{ position: 'absolute', top: '20%', right: '10%', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(128,43,54,0.25) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Embossed circle watermark */}
      <div style={{ position: 'absolute', bottom: -50, right: -50, width: 200, height: 200, borderRadius: '50%', border: '1.5px solid rgba(212,175,55,0.12)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -35, right: -35, width: 170, height: 170, borderRadius: '50%', border: '1px solid rgba(212,175,55,0.07)', pointerEvents: 'none' }} />

      {/* Top gold accent line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #8B6914, #D4AF37, #F5D778, #D4AF37, #8B6914)' }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, padding: '16px 20px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>

        {/* Top row: org name + logo */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#D4AF37', opacity: 0.9 }}>Kalinga at Pag-ibig Foundation</p>
            <p style={{ margin: '2px 0 0', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>Apple Scholars</p>
          </div>
          {/* Apple icon, stylized */}
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'linear-gradient(135deg, rgba(212,175,55,0.25), rgba(212,175,55,0.10))',
            border: '1px solid rgba(212,175,55,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1rem',
          }}>🍎</div>
        </div>

        {/* Middle: photo + name block */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Photo placeholder with gold border */}
          <div style={{
            width: 62, height: 72, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(145deg, #2a1018, #3a1520)',
            border: '1.5px solid rgba(212,175,55,0.40)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}>
            <User size={22} color="rgba(212,175,55,0.55)" />
            <p style={{ margin: 0, fontSize: '0.38rem', color: 'rgba(212,175,55,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Photo</p>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Scholar name in serif */}
            <p style={{ margin: '0 0 6px', fontFamily: "'Playfair Display', serif", fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.15, color: '#fff', letterSpacing: '-0.01em' }}>
              {scholar.name}
            </p>
            {/* Gold divider */}
            <div style={{ height: 1, width: 40, background: 'linear-gradient(90deg, #D4AF37, transparent)', marginBottom: 7 }} />
            {/* Info grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 14px' }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.41rem', color: '#D4AF37', opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Scholar ID</p>
                <p style={{ margin: '1px 0 0', fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.04em' }}>{scholar.studentId}</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.41rem', color: '#D4AF37', opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Year Level</p>
                <p style={{ margin: '1px 0 0', fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{formatYearLevelLabel(scholar.yearLevel)}</p>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <p style={{ margin: 0, fontSize: '0.41rem', color: '#D4AF37', opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Course</p>
                <p style={{ margin: '1px 0 0', fontSize: '0.58rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{scholar.course}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: valid + status badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid rgba(212,175,55,0.18)' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.41rem', color: '#D4AF37', opacity: 0.65, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Valid Until</p>
            <p style={{ margin: '1px 0 0', fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>{scholar.academicYear}</p>
          </div>
          <div style={{
            background: 'linear-gradient(90deg, rgba(212,175,55,0.18), rgba(212,175,55,0.10))',
            border: '1px solid rgba(212,175,55,0.4)',
            borderRadius: 5, padding: '3px 10px',
            fontSize: '0.46rem', fontWeight: 800,
            letterSpacing: '0.13em', textTransform: 'uppercase',
            color: '#D4AF37',
          }}>
            ✦ Active Scholar
          </div>
        </div>
      </div>

      {/* Bottom gold line */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #8B6914, #D4AF37, #F5D778, #D4AF37, #8B6914)' }} />
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
function MyID() {
  const [visible, setVisible] = useState(false);
  const [activeView, setActiveView] = useState('id');

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const scholar = {
    name: 'Maria Santos',
    studentId: 'AS-2024-001',
    email: 'maria.santos@university.edu',
    phone: '+63 912 345 6789',
    yearLevel: 'Year 3',
    course: 'BS Computer Science',
    academicYear: 'AY 2025–2026',
    status: 'Active Scholar',
  };

  const MAROON = '#802B36';
  const GOLD = '#D4AF37';

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#fdf2f3 0%,#fff8f8 60%,#fef9ec 100%)', fontFamily: "'DM Sans', sans-serif", padding: '2rem 1rem' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        .fade-up { opacity:0; transform:translateY(24px); transition:opacity 0.55s ease, transform 0.55s ease; }
        .fade-up.visible { opacity:1; transform:translateY(0); }
        .fade-up.d1 { transition-delay:0.05s; }
        .fade-up.d2 { transition-delay:0.15s; }
        .fade-up.d3 { transition-delay:0.25s; }
        .tab-btn { display:flex; align-items:center; gap:7px; padding:10px 22px; border-radius:10px; border:none; font-family:'DM Sans',sans-serif; font-size:0.875rem; font-weight:600; cursor:pointer; transition:all 0.18s ease; }
        .tab-btn.active { background:#802B36; color:white; box-shadow:0 4px 14px rgba(128,43,54,0.28); }
        .tab-btn.inactive { background:white; color:#6b7280; border:1.5px solid #e5e7eb; }
        .tab-btn.inactive:hover { border-color:#802B36; color:#802B36; }
        .info-row { display:flex; align-items:flex-start; gap:12px; padding:10px 0; }
        .info-row + .info-row { border-top:1px solid rgba(128,43,54,0.09); }
        .icon-wrap { width:32px; height:32px; border-radius:8px; background:rgba(128,43,54,0.10); display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px; }
        .dl-btn { display:inline-flex; align-items:center; gap:8px; padding:11px 26px; border-radius:10px; border:none; font-family:'DM Sans',sans-serif; font-size:0.875rem; font-weight:600; background:#802B36; color:white; cursor:pointer; transition:all 0.18s; box-shadow:0 4px 14px rgba(128,43,54,0.25); }
        .dl-btn:hover { background:#6b2430; transform:translateY(-1px); box-shadow:0 6px 20px rgba(128,43,54,0.32); }
        .dl-btn.outline { background:white; color:#802B36; border:1.5px solid #802B36; box-shadow:none; }
        .dl-btn.outline:hover { background:#fdf0f2; transform:translateY(-1px); }
      `}</style>

      <div style={{ width: '100%' }}>

        {/* Header */}
        <div className={`fade-up d1${visible ? ' visible' : ''}`} style={{ marginBottom: '1.8rem' }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(1.6rem,4vw,2.2rem)', fontWeight: 800, color: '#1a1a1a', margin: 0, letterSpacing: '-0.02em' }}>
            My Scholar ID
          </h1>
          <p style={{ margin: '6px 0 0', color: '#9ca3af', fontSize: '0.875rem' }}>
            Your official Apple Scholars identification & attendance QR
          </p>
        </div>

        {/* Tabs */}
        <div className={`fade-up d2${visible ? ' visible' : ''}`} style={{ display: 'flex', gap: 10, marginBottom: '1.8rem' }}>
          <button className={`tab-btn ${activeView === 'id' ? 'active' : 'inactive'}`} onClick={() => setActiveView('id')}>
            <CreditCard size={15} /> Scholar ID Card
          </button>
          <button className={`tab-btn ${activeView === 'qr' ? 'active' : 'inactive'}`} onClick={() => setActiveView('qr')}>
            <QrCode size={15} /> Attendance QR
          </button>
        </div>

        {/* ── ID CARD VIEW ── */}
        {activeView === 'id' && (
          <div className={`fade-up d3${visible ? ' visible' : ''}`}>
            <div style={{ background: 'white', borderRadius: 18, boxShadow: '0 8px 40px rgba(128,43,54,0.09),0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ height: 5, background: 'linear-gradient(90deg,#802B36,#c0556a,#802B36)' }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>

                {/* Left – ID Card preview */}
                <div style={{ padding: '36px 28px', background: 'linear-gradient(160deg,#1a0a0d 0%,#200d11 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.05rem', fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>Scholar ID Card</p>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>Present at events & campus offices</p>
                  </div>
                  <PremiumIDCard scholar={scholar} />
                  <button className="dl-btn" style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.35)', boxShadow: 'none' }}>
                    <Download size={14} /> Download ID Card
                  </button>
                </div>

                {/* Right – Scholar info */}
                <div style={{ padding: '32px 28px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#802B36,#a03848)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(128,43,54,0.28)', flexShrink: 0 }}>
                      <User size={24} color="white" />
                    </div>
                    <div>
                      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.2rem', fontWeight: 700, color: MAROON, margin: 0, lineHeight: 1.2 }}>{scholar.name}</h2>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999, background: 'rgba(128,43,54,0.09)', color: MAROON, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>
                        <Shield size={10} /> {scholar.status}
                      </span>
                    </div>
                  </div>

                  <div>
                    {[
                      { icon: <Hash size={13} color={MAROON} />, label: 'Student ID', value: scholar.studentId },
                      { icon: <Mail size={13} color={MAROON} />, label: 'Email', value: scholar.email },
                      { icon: <Phone size={13} color={MAROON} />, label: 'Phone', value: scholar.phone },
                      { icon: <BookOpen size={13} color={MAROON} />, label: 'Program', value: scholar.course, sub: scholar.yearLevel },
                    ].map(({ icon, label, value, sub }) => (
                      <div className="info-row" key={label}>
                        <div className="icon-wrap">{icon}</div>
                        <div>
                          <p style={{ margin: 0, fontSize: '0.68rem', color: '#9ca3af', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
                          <p style={{ margin: '2px 0 0', fontSize: '0.9rem', fontWeight: 600, color: '#1a1a1a', wordBreak: 'break-all' }}>{value}</p>
                          {sub && <p style={{ margin: '1px 0 0', fontSize: '0.78rem', color: '#6b7280' }}>{sub}</p>}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(128,43,54,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Academic Year</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: MAROON }}>{scholar.academicYear}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── QR VIEW ── */}
        {activeView === 'qr' && (
          <div className={`fade-up d3${visible ? ' visible' : ''}`}>
            <div style={{ background: 'white', borderRadius: 18, boxShadow: '0 8px 40px rgba(128,43,54,0.09),0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ height: 5, background: 'linear-gradient(90deg,#802B36,#c0556a,#802B36)' }} />
              <div style={{ padding: '40px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.25rem', fontWeight: 700, color: '#1a1a1a', margin: '0 0 4px' }}>Attendance QR Code</p>
                <p style={{ margin: '0 0 28px', fontSize: '0.875rem', color: '#9ca3af' }}>Show this to staff for event check-in</p>

                <div style={{ background: 'white', border: '2px solid #f0e0e2', borderRadius: 20, padding: 24, boxShadow: '0 4px 24px rgba(128,43,54,0.10)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, maxWidth: 300, width: '100%' }}>
                  <p style={{ margin: 0, fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: MAROON, opacity: 0.7 }}>Apple Scholars Program</p>
                  <div style={{ background: '#fdf9f9', borderRadius: 12, padding: 12, border: '1px solid #f3e4e6' }}>
                    <QRCodeSVG value={`${scholar.studentId}|${scholar.name}|${scholar.course}`} cellSize={8} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: '0.95rem', fontWeight: 700, color: '#1a1a1a' }}>{scholar.name}</p>
                    <p style={{ margin: '3px 0 0', fontSize: '0.72rem', color: MAROON, fontWeight: 600, letterSpacing: '0.06em' }}>{scholar.studentId}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.68rem', color: '#9ca3af' }}>{scholar.course} · {formatYearLevelLabel(scholar.yearLevel)}</p>
                  </div>
                  <div style={{ width: '100%', paddingTop: 10, borderTop: '1px dashed #f0e0e2', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '0.62rem', color: '#c4c4c4', letterSpacing: '0.05em' }}>Valid · {scholar.academicYear}</p>
                  </div>
                </div>

                <button className="dl-btn" style={{ marginTop: 24 }}>
                  <Download size={14} /> Download QR Code
                </button>
                <p style={{ margin: '12px 0 0', fontSize: '0.75rem', color: '#d1d5db' }}>For official Apple Scholars use only</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MyID;