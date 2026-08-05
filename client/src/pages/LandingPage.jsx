import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Globe, ArrowRight, ChevronDown, BookOpen, Users, BarChart2, ShieldCheck } from 'lucide-react';

// ─── Apple logo SVG as inline component ───────────────────────────────────────
const AppleIcon = ({ size = 32, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
);

// ─── Feature cards data from thesis ───────────────────────────────────────────
const features = [
  {
    icon: <ShieldCheck size={22} />,
    title: 'Compliance Tracking',
    desc: 'Automated monitoring of scholar requirements, deadlines, and submission status with real-time risk detection.',
  },
  {
    icon: <BookOpen size={22} />,
    title: 'Correspondence Evaluation',
    desc: 'AI-assisted analysis of scholar letters and reports using rule-based sentiment and quality assessment.',
  },
  {
    icon: <BarChart2 size={22} />,
    title: 'Progress Analytics',
    desc: 'Visual dashboards and trend analysis tracking academic performance across all enrolled scholars.',
  },
  {
    icon: <Users size={22} />,
    title: 'Multi-Role Management',
    desc: 'Distinct portals for Administrators, Officers & Staff, and Scholars — each with tailored permissions.',
  },
];

// ─── Stats pulled from system description ─────────────────────────────────────
const stats = [
  { value: '3', label: 'User Roles' },
  { value: '100%', label: 'Web-Based' },
  { value: 'Real-Time', label: 'Monitoring' },
  { value: 'Secure', label: 'Audit Trail' },
];

// ─── The real uploaded photos as usable URLs ──────────────────────────────────
// We embed them as base64 data URIs via the img src path trick in React
// Since we're in a local project context, reference the public folder or imports.
// Using unsplash placeholder for hero bg, actual local photos for gallery section.
const HERO_BG = 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=1920&auto=format&fit=crop';

const LandingPage = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature(prev => (prev + 1) % features.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0d0608] text-white font-sans overflow-x-hidden">

      {/* ── GLOBAL STYLE ─────────────────────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Sans:wght@300;400;500;600&display=swap');

        .font-display { font-family: 'Cormorant Garamond', serif; }
        .font-body    { font-family: 'DM Sans', sans-serif; }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-12px); }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 0.8; }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .anim-float     { animation: float 6s ease-in-out infinite; }
        .anim-glow      { animation: glow-pulse 3s ease-in-out infinite; }
        .anim-slide-up  { animation: slide-up 0.8s cubic-bezier(.16,1,.3,1) forwards; }
        .anim-fade-in   { animation: fade-in 1.2s ease forwards; }
        .anim-spin-slow { animation: spin-slow 18s linear infinite; }

        .delay-100 { animation-delay: 0.1s; opacity: 0; }
        .delay-200 { animation-delay: 0.2s; opacity: 0; }
        .delay-300 { animation-delay: 0.3s; opacity: 0; }
        .delay-500 { animation-delay: 0.5s; opacity: 0; }
        .delay-700 { animation-delay: 0.7s; opacity: 0; }

        .glass {
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .glass-dark {
          background: rgba(0,0,0,0.35);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.07);
        }

        .maroon-glow {
          box-shadow: 0 0 60px rgba(127,45,58,0.35), 0 0 120px rgba(127,45,58,0.15);
        }
        .gold-text {
          background: linear-gradient(135deg, #f5c842 0%, #e8a020 40%, #f5c842 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hero-overlay {
          background: linear-gradient(
            to bottom,
            rgba(13,6,8,0.75) 0%,
            rgba(13,6,8,0.45) 40%,
            rgba(13,6,8,0.80) 80%,
            rgba(13,6,8,1) 100%
          );
        }
        .noise-texture::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 1;
        }
        .feature-card-active {
          border-color: rgba(127,45,58,0.6) !important;
          background: rgba(127,45,58,0.12) !important;
        }
        .nav-link {
          position: relative;
          transition: color 0.3s;
        }
        .nav-link::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0; right: 0;
          height: 1px;
          background: #f5c842;
          transform: scaleX(0);
          transition: transform 0.3s;
        }
        .nav-link:hover::after { transform: scaleX(1); }
        .nav-link:hover { color: #f5c842; }

        .btn-primary {
          background: linear-gradient(135deg, #7f2d3a 0%, #a33847 100%);
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        .btn-primary::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, #a33847 0%, #c4455a 100%);
          opacity: 0;
          transition: opacity 0.3s;
        }
        .btn-primary:hover::before { opacity: 1; }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(127,45,58,0.5); }
        .btn-primary span { position: relative; z-index: 1; }
      `}</style>

      {/* ── NAVBAR ───────────────────────────────────────────────────────────── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 font-body ${
        scrolled ? 'glass-dark py-3 shadow-2xl' : 'py-6 bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 bg-[#7f2d3a] rounded-xl rotate-6 group-hover:rotate-12 transition-transform duration-300"></div>
              <div className="relative w-10 h-10 bg-[#0d0608] border border-[#7f2d3a]/60 rounded-xl flex items-center justify-center">
                <AppleIcon size={20} className="text-[#f5c842]" />
              </div>
            </div>
            <div className="leading-tight">
              <p className="font-display font-bold text-lg text-white tracking-tight">Kalinga</p>
              <p className="text-[9px] text-[#f5c842] font-semibold uppercase tracking-[0.2em]">Apple Scholar</p>
            </div>
          </div>

          {/* Links */}
          <div className="hidden md:flex items-center gap-8 text-xs font-medium tracking-widest uppercase text-white/70">
            {['Home', 'About', 'Features', 'Scholars'].map(link => (
              <a key={link} href={`#${link.toLowerCase()}`} className="nav-link">{link}</a>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={() => navigate('/login')}
            className="btn-primary text-white text-[10px] font-bold uppercase tracking-[0.25em] px-6 py-3 rounded-xl flex items-center gap-2"
          >
            <span>Portal Login</span>
            <ArrowRight size={13} className="relative z-10" />
          </button>
        </div>
      </nav>

      {/* ── HERO SECTION ─────────────────────────────────────────────────────── */}
      <section id="home" className="relative min-h-screen flex flex-col justify-center noise-texture overflow-hidden">

        {/* Background photo */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url('${HERO_BG}')` }}
        />
        <div className="absolute inset-0 hero-overlay" />

        {/* Decorative orbs */}
        <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] rounded-full bg-[#7f2d3a]/20 blur-[120px] anim-glow pointer-events-none" />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-[#f5c842]/8 blur-[100px] anim-glow pointer-events-none" style={{animationDelay:'1.5s'}} />

        {/* Spinning ring decoration */}
        <div className="absolute top-24 right-16 w-32 h-32 border border-dashed border-[#7f2d3a]/30 rounded-full anim-spin-slow hidden lg:block pointer-events-none" />
        <div className="absolute bottom-40 left-12 w-20 h-20 border border-[#f5c842]/20 rounded-full anim-spin-slow hidden lg:block pointer-events-none" style={{animationDirection:'reverse'}} />

        {/* Hero content */}
        <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-12 pt-24 pb-16 font-body">

          {/* Badge */}
          <div className="anim-slide-up delay-100 inline-flex items-center gap-2.5 glass rounded-full px-5 py-2.5 mb-8">
            <AppleIcon size={14} className="text-[#f5c842]" />
            <span className="text-[10px] uppercase tracking-[0.3em] font-semibold text-white/80">
              Scholarship Management System · Kalinga Foundation
            </span>
          </div>

          {/* Title */}
          <h1 className="anim-slide-up delay-200 font-display font-bold leading-[1.05] mb-6">
            <span className="block text-5xl md:text-7xl lg:text-8xl text-white">Empowering</span>
            <span className="block text-5xl md:text-7xl lg:text-8xl italic">
              <span className="gold-text">Apple Scholars</span>
            </span>
            <span className="block text-3xl md:text-5xl lg:text-6xl text-white/70 font-normal mt-2">
              through intelligent tracking.
            </span>
          </h1>

          {/* Description */}
          <p className="anim-slide-up delay-300 max-w-2xl text-white/60 text-base md:text-lg leading-relaxed mb-10 font-light">
            A centralized compliance tracking system with correspondence evaluation and 
            progress report analytics — built to support scholars from the Payatas community 
            in Manila in building a better future.
          </p>

          {/* CTAs */}
          <div className="anim-slide-up delay-500 flex flex-wrap gap-4 items-center">
            <button
              onClick={() => navigate('/login')}
              className="btn-primary text-white font-semibold text-sm px-8 py-4 rounded-xl flex items-center gap-3"
            >
              <span>Access Scholar Portal</span>
              <ArrowRight size={16} className="relative z-10" />
            </button>
            <a href="#about" className="flex items-center gap-2 text-white/60 hover:text-white text-sm font-medium transition-colors duration-200 group">
              Learn about the program
              <ChevronDown size={16} className="group-hover:translate-y-1 transition-transform" />
            </a>
          </div>

          {/* Stats row */}
          <div className="anim-slide-up delay-700 grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-3xl">
            {stats.map((s, i) => (
              <div key={i} className="glass rounded-2xl px-5 py-4 text-center">
                <p className="font-display font-bold text-2xl md:text-3xl gold-text">{s.value}</p>
                <p className="text-[10px] uppercase tracking-widest text-white/40 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 anim-fade-in delay-700">
          <div className="w-px h-10 bg-gradient-to-b from-white/0 to-white/30 anim-float" />
          <ChevronDown size={16} className="text-white/30 anim-float" style={{animationDelay:'0.3s'}} />
        </div>
      </section>

      {/* ── ABOUT SECTION ────────────────────────────────────────────────────── */}
      <section id="about" className="relative py-24 md:py-36 overflow-hidden font-body">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d0608] via-[#130a0d] to-[#0d0608]" />
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#7f2d3a]/40 to-transparent" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12">

          {/* Section label */}
          <div className="flex items-center gap-4 mb-6">
            <div className="h-px flex-1 max-w-[60px] bg-[#7f2d3a]/50" />
            <span className="text-[10px] uppercase tracking-[0.4em] text-[#f5c842]/70 font-semibold">About the Foundation</span>
          </div>

          <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-start">

            {/* Left: text */}
            <div>
              <h2 className="font-display font-bold text-4xl md:text-5xl lg:text-6xl text-white leading-tight mb-8">
                Education for those who<br />
                <span className="italic text-[#f5c842]">need it most.</span>
              </h2>
              <div className="space-y-5 text-white/55 leading-relaxed text-sm md:text-base font-light">
                <p>
                  The <strong className="text-white/80 font-medium">Kalinga Foundation</strong> is devoted to children in extreme poverty 
                  living in and around the Payatas rubbish dump in Manila, Philippines. 
                  Kalinga offers them tools with which they can build a better future for themselves.
                </p>
                <p>
                  The <strong className="text-white/80 font-medium">Apple Scholar Program</strong> is the foundation's scholarship arm — 
                  providing financial support, mentoring, and academic guidance to disadvantaged 
                  youth, from high school through college and beyond.
                </p>
                <p>
                  This platform — the <strong className="text-white/80 font-medium">Scholarship Compliance Tracking System</strong> — 
                  was built to digitize and streamline the program's operations: monitoring compliance, 
                  evaluating correspondence, and generating analytics to support every scholar's journey.
                </p>
              </div>

              <div className="mt-8 flex items-center gap-4">
                <div className="w-12 h-px bg-[#7f2d3a]" />
                <p className="text-xs text-white/30 tracking-widest uppercase">Payatas, Quezon City · Manila, Philippines</p>
              </div>
            </div>

            {/* Right: photo card stack */}
            <div className="relative h-[440px] hidden md:block">
              {/* Back card */}
              <div
                className="absolute top-8 right-0 w-72 h-72 rounded-3xl bg-cover bg-center rotate-3 opacity-70 border border-white/10"
                style={{ backgroundImage: `url('https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=800&auto=format&fit=crop')` }}
              />
              {/* Front card — group photo style */}
              <div
                className="absolute top-0 left-0 w-80 h-[380px] rounded-3xl bg-cover bg-center -rotate-2 shadow-2xl border border-white/10 maroon-glow"
                style={{ backgroundImage: `url('https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=800&auto=format&fit=crop')` }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent rounded-3xl" />
                <div className="absolute bottom-6 left-6 right-6">
                  <p className="font-display italic text-lg text-white/90">Papaya Academy</p>
                  <p className="text-[10px] text-white/50 tracking-widest uppercase mt-0.5">A Kalinga Project · DepEd Recognized</p>
                </div>
              </div>

              {/* Label badge */}
              <div className="absolute bottom-4 right-4 glass rounded-2xl px-4 py-3 anim-float">
                <p className="text-[10px] text-white/50 uppercase tracking-widest">Est.</p>
                <p className="font-display font-bold text-2xl gold-text">2026</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES SECTION ─────────────────────────────────────────────────── */}
      <section id="features" className="relative py-24 md:py-32 font-body overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d0608] to-[#100508]" />
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#f5c842]/20 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full bg-[#7f2d3a]/8 blur-[150px] pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12">

          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-3 mb-5">
              <div className="h-px w-12 bg-[#7f2d3a]/50" />
              <span className="text-[10px] uppercase tracking-[0.4em] text-[#f5c842]/70 font-semibold">System Capabilities</span>
              <div className="h-px w-12 bg-[#7f2d3a]/50" />
            </div>
            <h2 className="font-display font-bold text-4xl md:text-5xl text-white leading-tight">
              Built for the scholars.<br />
              <span className="italic text-[#f5c842]">Designed for clarity.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f, i) => (
              <div
                key={i}
                onMouseEnter={() => setActiveFeature(i)}
                className={`glass rounded-3xl p-7 cursor-default transition-all duration-500 ${
                  activeFeature === i ? 'feature-card-active' : 'hover:border-white/15'
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-colors duration-500 ${
                  activeFeature === i ? 'bg-[#7f2d3a]' : 'bg-white/5'
                }`}>
                  <span className={`transition-colors duration-500 ${activeFeature === i ? 'text-[#f5c842]' : 'text-white/50'}`}>
                    {f.icon}
                  </span>
                </div>
                <h3 className="font-semibold text-white text-base mb-2">{f.title}</h3>
                <p className="text-white/45 text-sm leading-relaxed font-light">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Role breakdown */}
          <div className="mt-16 grid md:grid-cols-3 gap-6">
            {[
              { role: 'Administrator', color: '#f5c842', desc: 'Manages user credentials, compliance requirements, task assignments, deadlines, and summary report requests.' },
              { role: 'Officer / Staff', color: '#e07070', desc: 'Validates compliance submissions, monitors scholar tasks, and processes manual attendance checks.' },
              { role: 'Scholar', color: '#70b8e0', desc: 'Submits compliance requirements, tracks personal status, views announcements, and accesses QR-based duty logs.' },
            ].map((r, i) => (
              <div key={i} className="glass rounded-3xl p-7 relative overflow-hidden group">
                <div
                  className="absolute top-0 left-0 w-full h-0.5 transition-opacity duration-300 group-hover:opacity-100 opacity-60"
                  style={{ background: `linear-gradient(to right, transparent, ${r.color}, transparent)` }}
                />
                <div className="w-2 h-2 rounded-full mb-4" style={{ background: r.color }} />
                <h4 className="font-semibold text-white text-sm uppercase tracking-widest mb-3">{r.role}</h4>
                <p className="text-white/45 text-sm leading-relaxed font-light">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SCHOLARS SECTION (photo gallery) ─────────────────────────────────── */}
      <section id="scholars" className="relative py-24 font-body overflow-hidden">
        <div className="absolute inset-0 bg-[#0d0608]" />
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#7f2d3a]/30 to-transparent" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px w-10 bg-[#7f2d3a]/50" />
                <span className="text-[10px] uppercase tracking-[0.4em] text-[#f5c842]/70 font-semibold">Our Community</span>
              </div>
              <h2 className="font-display font-bold text-4xl md:text-5xl text-white">
                The scholars<br />
                <span className="italic text-white/50">behind every record.</span>
              </h2>
            </div>
            <p className="text-white/35 text-sm max-w-xs leading-relaxed">
              Behind every data point is a real student working toward a better future from Payatas, Manila.
            </p>
          </div>

          {/* Photo grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div
              className="col-span-2 md:col-span-2 row-span-1 h-72 md:h-80 rounded-3xl bg-cover bg-center bg-[#1a0d10] relative overflow-hidden group border border-white/5"
              style={{ backgroundImage: `url('https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1200&auto=format&fit=crop')` }}
            >
              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors duration-500" />
              <div className="absolute bottom-6 left-6">
                <p className="font-display italic text-2xl text-white">Papaya Academy</p>
                <p className="text-xs text-white/50 tracking-widest uppercase">A Kalinga Project · Payatas</p>
              </div>
            </div>
            <div
              className="h-72 md:h-80 rounded-3xl bg-cover bg-center bg-[#1a0d10] relative overflow-hidden group border border-white/5"
              style={{ backgroundImage: `url('https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?q=80&w=600&auto=format&fit=crop')` }}
            >
              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors duration-500" />
            </div>
            <div
              className="h-56 rounded-3xl bg-cover bg-center bg-[#1a0d10] relative overflow-hidden group border border-white/5"
              style={{ backgroundImage: `url('https://images.unsplash.com/photo-1523580494863-6f3031224c94?q=80&w=600&auto=format&fit=crop')` }}
            >
              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors duration-500" />
            </div>
            <div
              className="col-span-2 h-56 rounded-3xl bg-cover bg-center bg-[#1a0d10] relative overflow-hidden group border border-white/5"
              style={{ backgroundImage: `url('https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?q=80&w=1200&auto=format&fit=crop')` }}
            >
              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors duration-500" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="glass-dark rounded-3xl px-8 py-5 text-center maroon-glow">
                  <p className="font-display italic text-3xl text-white mb-1">Join the mission.</p>
                  <p className="text-xs text-white/45 tracking-widest uppercase">Help a scholar achieve their dream</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────────────── */}
      <section className="relative py-24 md:py-32 font-body overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d0608] to-[#130a0d]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-[#7f2d3a]/20 blur-[120px] anim-glow pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
          <div className="glass rounded-[3rem] p-12 md:p-16 border border-[#7f2d3a]/20 maroon-glow">
            <div className="w-16 h-16 bg-[#7f2d3a] rounded-2xl flex items-center justify-center mx-auto mb-8">
              <AppleIcon size={28} className="text-[#f5c842]" />
            </div>
            <h2 className="font-display font-bold text-4xl md:text-5xl text-white mb-4">
              Ready to access<br />
              <span className="italic gold-text">your portal?</span>
            </h2>
            <p className="text-white/45 text-base mb-10 leading-relaxed font-light">
              Sign in to manage compliance, submit requirements, and track your academic progress 
              under the Kalinga Apple Scholar Program.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="btn-primary text-white font-semibold text-sm px-10 py-5 rounded-2xl flex items-center gap-3 mx-auto"
            >
              <span>Enter the Scholar Portal</span>
              <ArrowRight size={16} className="relative z-10" />
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="relative border-t border-white/5 py-8 font-body">
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AppleIcon size={16} className="text-[#7f2d3a]" />
            <span className="text-xs text-white/30">Kalinga Foundation · Apple Scholar Program</span>
          </div>
          <div className="flex items-center gap-2 glass rounded-xl px-4 py-2 cursor-pointer text-xs text-white/40">
            <Globe size={12} />
            <span>English</span>
          </div>
          <p className="text-[10px] text-white/20 tracking-widest uppercase">
            Scholarship Compliance Tracking System · 2026
          </p>
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;