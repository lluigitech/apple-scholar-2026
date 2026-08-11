import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Globe, ArrowRight, ChevronDown, ChevronUp, BookOpen, Users, BarChart2, ShieldCheck, Menu, X, UserCog, ClipboardCheck, Headset, GraduationCap } from 'lucide-react';

// ─── PHOTO IMPORTS ─────────────────────────────────────────────────────────
// Copy the 4 files from the "landing-photos" folder you were given into your
// project at src/assets/landing/, keeping these exact filenames, and these
// imports will resolve automatically:
//   scholars-group-indoor-1.jpg   → the big indoor group photo (front row seated)
//   scholars-group-indoor-2.jpg   → the second indoor group photo (different angle)
//   papaya-academy-building-1.jpg → exterior shot, "PAPAYA ACADEMY" sign, group facing camera
//   papaya-academy-building-2.jpg → exterior shot, second angle, group waving
import heroPhoto from '../assets/landing/papaya-academy-building-1.jpg';
import aboutFrontPhoto from '../assets/landing/scholars-group-indoor-1.jpg';
import aboutBackPhoto from '../assets/landing/papaya-academy-building-2.jpg';
import galleryPhoto from '../assets/landing/scholars-group-indoor-2.jpg';

// ─── Token system — shared across the whole Scholar Portal ───────────────────
const MAROON = '#7f2d3a';
const MAROON_DEEP = '#4f1620';
const GOLD = '#b98b4e';
const INK_DARK = '#1a0d10'; // a near-black derived from MAROON_DEEP, not an unrelated hue

// ─── Our own apple silhouette mark — the same one used across every hero band
//     in the portal, not the Apple Inc. logo ────────────────────────────────
const AppleMark = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" fill="none" className={className}>
    <path
      d="M100 62c-6-14-20-24-36-24-4 0-8 1-8 1s-2 10 4 22c5 10 15 18 26 19-4 12-6 26-6 38 0 34 18 62 40 62 8 0 12-4 20-4s12 4 20 4c22 0 40-30 40-64 0-24-12-42-30-42-8 0-14 4-20 4s-10-3-16-6c2-11 8-20 16-25-2-1-6-2-10-2-16 0-30 8-40 17z"
      fill="currentColor"
    />
    <path d="M100 62c2-16 10-30 22-38" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
  </svg>
);

// ─── Feature cards data from thesis ───────────────────────────────────────────
const features = [
  {
    icon: <ShieldCheck size={22} />,
    title: 'Compliance & Submission Management',
    desc: 'Scholars submit requirements and documents while administrators and officers track status, deadlines, and follow-ups.',
  },
  {
    icon: <BookOpen size={22} />,
    title: 'Letter & Report Review',
    desc: 'The system supports review of scholar letters, monthly reports, and related correspondence with structured evaluation tools.',
  },
  {
    icon: <BarChart2 size={22} />,
    title: 'Attendance & Duty Monitoring',
    desc: 'Staff and officers can record attendance, manage duty logs, and monitor scholar participation through the portal.',
  },
  {
    icon: <Users size={22} />,
    title: 'Role-Based Portal Access',
    desc: 'The platform is built for four user roles: Administrator, Officer, Staff, and Scholar, each with specific permissions.',
  },
];

// ─── Stats pulled from system description ─────────────────────────────────────
const stats = [
  { value: '4', label: 'Portal Roles' },
  { value: '24/7', label: 'Monitoring' },
  { value: 'Real-Time', label: 'Updates' },
  { value: 'Secure', label: 'Audit Trail' },
];

const workflowSteps = [
  {
    title: 'Submit requirements',
    desc: 'Scholars upload their compliance files, reports, and updates through a simple and guided process.',
  },
  {
    title: 'Review and validate',
    desc: 'Officers and staff verify submissions, assign follow-ups, and keep records accurate and timely.',
  },
  {
    title: 'Track progress',
    desc: 'Administrators monitor overall performance, deadlines, and report status from one centralized dashboard.',
  },
];

const roles = [
  { role: 'Administrator', Icon: UserCog, color: GOLD, desc: 'Manages users, compliance requirements, deadlines, reports, and overall system oversight.' },
  { role: 'Officer', Icon: ClipboardCheck, color: '#c17a6a', desc: 'Reviews scholar submissions, validates compliance records, and monitors progress closely.' },
  { role: 'Staff', Icon: Headset, color: '#8ba9c1', desc: 'Handles attendance, duty logs, announcements, and support tasks for scholars.' },
  { role: 'Scholar', Icon: GraduationCap, color: '#7ab3a3', desc: 'Uploads requirements, tracks personal status, views announcements, and accesses duty-related information.' },
];

const NAV_LINKS = ['Home', 'About', 'Workflow', 'Features', 'Scholars'];

const LandingPage = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);

  // Per-photo load-failure flags. If a file is missing/renamed under
  // src/assets/landing/, the corresponding section falls back to a plain
  // maroon/ink gradient instead of a broken image or blank block.
  const [heroPhotoFailed, setHeroPhotoFailed] = useState(false);
  const [aboutFrontPhotoFailed, setAboutFrontPhotoFailed] = useState(false);
  const [aboutBackPhotoFailed, setAboutBackPhotoFailed] = useState(false);
  const [galleryPhotoFailed, setGalleryPhotoFailed] = useState(false);

  const fallbackGradient = `linear-gradient(160deg, ${MAROON_DEEP} 0%, ${INK_DARK} 70%)`;

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

  const handleNavClick = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-screen text-white font-sans overflow-x-hidden" style={{ background: INK_DARK }}>

      {/* ── GLOBAL STYLE ─────────────────────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400;1,600&family=DM+Sans:wght@300;400;500;600&display=swap');

        .font-display { font-family: 'Playfair Display', serif; }
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
        @keyframes menu-drop {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim-float     { animation: float 6s ease-in-out infinite; }
        .anim-glow      { animation: glow-pulse 3s ease-in-out infinite; }
        .anim-slide-up  { animation: slide-up 0.8s cubic-bezier(.16,1,.3,1) forwards; }
        .anim-fade-in   { animation: fade-in 1.2s ease forwards; }
        .anim-spin-slow { animation: spin-slow 18s linear infinite; }
        .anim-menu-drop { animation: menu-drop 0.25s ease forwards; }

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
          background: rgba(26,13,16,0.55);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.07);
        }

        .maroon-glow {
          box-shadow: 0 0 60px rgba(127,45,58,0.35), 0 0 120px rgba(127,45,58,0.15);
        }
        .gold-text {
          background: linear-gradient(135deg, #d9ac6f 0%, ${GOLD} 40%, #d9ac6f 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hero-overlay {
          background: linear-gradient(
            to bottom,
            rgba(26,13,16,0.78) 0%,
            rgba(26,13,16,0.5) 40%,
            rgba(26,13,16,0.82) 80%,
            rgba(26,13,16,1) 100%
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
          background: rgba(127,45,58,0.14) !important;
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
          background: ${GOLD};
          transform: scaleX(0);
          transition: transform 0.3s;
        }
        .nav-link:hover::after { transform: scaleX(1); }
        .nav-link:hover { color: ${GOLD}; }

        .btn-primary {
          background: linear-gradient(135deg, ${MAROON} 0%, #9c3d4c 100%);
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        .btn-primary::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, #9c3d4c 0%, #b8515f 100%);
          opacity: 0;
          transition: opacity 0.3s;
        }
        .btn-primary:hover::before { opacity: 1; }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(127,45,58,0.5); }
        .btn-primary span { position: relative; z-index: 1; }
      `}</style>

      {/* ── NAVBAR ───────────────────────────────────────────────────────────── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 font-body ${
        scrolled || mobileMenuOpen ? 'glass-dark py-3 shadow-2xl' : 'py-6 bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-xl rotate-6 group-hover:rotate-12 transition-transform duration-300" style={{ background: `linear-gradient(135deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)` }} />
              <div className="relative w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: INK_DARK, border: `1px solid ${MAROON}99` }}>
                <AppleMark size={18} className="text-[#e0b478]" />
              </div>
            </div>
            <div className="leading-tight">
              <p className="font-display font-bold text-lg text-white tracking-tight">Kalinga</p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em]" style={{ color: '#e0b478' }}>Apple Scholar</p>
            </div>
          </div>

          {/* Links — desktop */}
          <div className="hidden md:flex items-center gap-8 text-xs font-medium tracking-widest uppercase text-white/70">
            {NAV_LINKS.map(link => (
              <a key={link} href={`#${link.toLowerCase()}`} className="nav-link">{link}</a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {/* CTA */}
            <button
              onClick={() => navigate('/login')}
              className="btn-primary text-white text-[10px] font-bold uppercase tracking-[0.25em] px-6 py-3 rounded-xl items-center gap-2 hidden sm:flex"
            >
              <span>Portal Login</span>
              <ArrowRight size={13} className="relative z-10" />
            </button>

            {/* Mobile menu toggle — the links weren't reachable on small screens before */}
            <button
              onClick={() => setMobileMenuOpen(o => !o)}
              className="md:hidden w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="md:hidden anim-menu-drop px-6 pt-4 pb-5 flex flex-col gap-1">
            {NAV_LINKS.map(link => (
              <a
                key={link}
                href={`#${link.toLowerCase()}`}
                onClick={handleNavClick}
                className="text-sm font-medium tracking-wide uppercase text-white/75 py-3 border-b border-white/5"
              >
                {link}
              </a>
            ))}
            <button
              onClick={() => navigate('/login')}
              className="btn-primary text-white text-[11px] font-bold uppercase tracking-[0.25em] px-6 py-3.5 rounded-xl flex items-center justify-center gap-2 mt-4 sm:hidden"
            >
              <span>Portal Login</span>
              <ArrowRight size={13} className="relative z-10" />
            </button>
          </div>
        )}
      </nav>

      {/* ── HERO SECTION ─────────────────────────────────────────────────────── */}
      <section id="home" className="relative min-h-screen flex flex-col justify-center noise-texture overflow-hidden">

        {/* Background photo — Papaya Academy, the actual building.
            Falls back to a plain maroon/ink gradient (no photo dependency)
            if the file is missing/renamed, instead of a broken or blank hero. */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: heroPhotoFailed ? fallbackGradient : `url(${heroPhoto})` }}
        >
          {/* Hidden probe — flips the fallback on load error. Rendering
              itself uses the CSS background above, so this never shifts layout. */}
          <img src={heroPhoto} alt="" className="hidden" onError={() => setHeroPhotoFailed(true)} />
        </div>
        <div className="absolute inset-0 hero-overlay" />

        {/* Decorative orbs */}
        <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] rounded-full blur-[120px] anim-glow pointer-events-none" style={{ background: `${MAROON}33` }} />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] rounded-full blur-[100px] anim-glow pointer-events-none" style={{ background: `${GOLD}14`, animationDelay: '1.5s' }} />

        {/* Spinning ring decoration */}
        <div className="absolute top-24 right-16 w-32 h-32 border border-dashed rounded-full anim-spin-slow hidden lg:block pointer-events-none" style={{ borderColor: `${MAROON}4d` }} />
        <div className="absolute bottom-40 left-12 w-20 h-20 border rounded-full anim-spin-slow hidden lg:block pointer-events-none" style={{ borderColor: `${GOLD}33`, animationDirection: 'reverse' }} />

        {/* Hero content */}
        <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-12 pt-24 pb-16 font-body">

          {/* Badge */}
          <div className="anim-slide-up delay-100 inline-flex items-center gap-2.5 glass rounded-full px-5 py-2.5 mb-8">
            <AppleMark size={13} className="text-[#e0b478]" />
            <span className="text-[10px] uppercase tracking-[0.3em] font-semibold text-white/80">
              Scholarship Compliance &amp; Monitoring Portal · Kalinga Foundation
            </span>
          </div>

          {/* Title */}
          <h1 className="anim-slide-up delay-200 font-display font-bold leading-[1.05] mb-6">
            <span className="block text-5xl md:text-7xl lg:text-8xl text-white">Support every</span>
            <span className="block text-5xl md:text-7xl lg:text-8xl italic">
              <span className="gold-text">scholar journey</span>
            </span>
            <span className="block text-3xl md:text-5xl lg:text-6xl text-white/70 font-normal mt-2">
              from submission to success.
            </span>
          </h1>

          {/* Description */}
          <p className="anim-slide-up delay-300 max-w-2xl text-white/60 text-base md:text-lg leading-relaxed mb-10 font-light">
            A centralized portal for tracking compliance, reviewing correspondence, and monitoring academic progress
            across administrators, officers, staff, and scholars in the Apple Scholar Program.
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
          <ChevronDown size={16} className="text-white/30 anim-float" style={{ animationDelay: '0.3s' }} />
        </div>
      </section>

      {/* ── ABOUT SECTION ────────────────────────────────────────────────────── */}
      <section id="about" className="relative py-24 md:py-36 overflow-hidden font-body">
        <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${INK_DARK}, #241014, ${INK_DARK})` }} />
        <div className="absolute top-0 left-0 w-full h-px" style={{ background: `linear-gradient(to right, transparent, ${MAROON}66, transparent)` }} />

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12">

          {/* Section label */}
          <div className="flex items-center gap-4 mb-6">
            <div className="h-px flex-1 max-w-[60px]" style={{ background: `${MAROON}80` }} />
            <span className="text-[10px] uppercase tracking-[0.4em] font-semibold" style={{ color: '#e0b478b3' }}>About the Foundation</span>
          </div>

          <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-start">

            {/* Left: text */}
            <div>
              <h2 className="font-display font-bold text-4xl md:text-5xl lg:text-6xl text-white leading-tight mb-8">
                Education for those who<br />
                <span className="italic" style={{ color: '#e0b478' }}>need it most.</span>
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
                <div className="w-12 h-px" style={{ background: MAROON }} />
                <p className="text-xs text-white/30 tracking-widest uppercase">Payatas, Quezon City · Manila, Philippines</p>
              </div>
            </div>

            {/* Right: photo card stack — falls back to plain gradient tiles
                if either photo is missing/renamed under src/assets/landing/. */}
            <div className="relative h-[460px] hidden md:block">
              {/* Label badge — moved out of the card stack's footprint */}
              <div className="absolute top-0 right-0 z-20 glass rounded-2xl px-4 py-3 anim-float">
                <p className="text-[10px] text-white/50 uppercase tracking-widest">Est.</p>
                <p className="font-display font-bold text-2xl gold-text">2026</p>
              </div>

              {/* Back card — exterior shot */}
              <div
                className="absolute top-16 right-0 w-72 h-72 rounded-3xl bg-cover bg-center rotate-3 opacity-70 border border-white/10"
                style={{ backgroundImage: aboutBackPhotoFailed ? fallbackGradient : `url(${aboutBackPhoto})` }}
              >
                <img src={aboutBackPhoto} alt="" className="hidden" onError={() => setAboutBackPhotoFailed(true)} />
              </div>
              {/* Front card — indoor group photo */}
              <div
                className="absolute bottom-0 left-0 w-80 h-[380px] rounded-3xl bg-cover bg-center -rotate-2 shadow-2xl border border-white/10 maroon-glow"
                style={{ backgroundImage: aboutFrontPhotoFailed ? fallbackGradient : `url(${aboutFrontPhoto})` }}
              >
                <img src={aboutFrontPhoto} alt="" className="hidden" onError={() => setAboutFrontPhotoFailed(true)} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent rounded-3xl" />
                <div className="absolute bottom-6 left-6 right-6">
                  <p className="font-display italic text-lg text-white/90">Papaya Academy</p>
                  <p className="text-[10px] text-white/50 tracking-widest uppercase mt-0.5">A Kalinga Project · DepEd Recognized</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WORKFLOW SECTION ───────────────────────────────────────────────── */}
      <section id="workflow" className="relative py-24 md:py-28 font-body overflow-hidden">
        <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${INK_DARK}, #241014)` }} />
        <div className="absolute top-0 left-0 w-full h-px" style={{ background: `linear-gradient(to right, transparent, ${MAROON}66, transparent)` }} />

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12">
          <div className="max-w-3xl mb-12">
            <div className="inline-flex items-center gap-3 mb-5">
              <div className="h-px w-12" style={{ background: `${MAROON}80` }} />
              <span className="text-[10px] uppercase tracking-[0.4em] font-semibold" style={{ color: '#e0b478b3' }}>How the portal works</span>
            </div>
            <h2 className="font-display font-bold text-4xl md:text-5xl text-white leading-tight">
              A clear path from<br />
              <span className="italic" style={{ color: '#e0b478' }}>submission to follow-up.</span>
            </h2>
          </div>

          {/* connecting line ties the three steps together as one flow,
              instead of three disconnected cards */}
          <div className="relative grid md:grid-cols-3 gap-6">
            <div className="hidden md:block absolute top-5 left-[16.5%] right-[16.5%] h-px" style={{ background: `${MAROON}4d` }} />
            {workflowSteps.map((step, index) => (
              <div key={index} className="glass rounded-3xl p-7 relative">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-5 relative z-10" style={{ background: `linear-gradient(135deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)` }}>
                  <span className="font-display text-lg text-[#e0b478]">0{index + 1}</span>
                </div>
                <h3 className="font-semibold text-white text-base mb-2">{step.title}</h3>
                <p className="text-white/45 text-sm leading-relaxed font-light">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES SECTION ─────────────────────────────────────────────────── */}
      <section id="features" className="relative py-24 md:py-32 font-body overflow-hidden">
        <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${INK_DARK}, #200f12)` }} />
        <div className="absolute top-0 left-0 w-full h-px" style={{ background: `linear-gradient(to right, transparent, ${GOLD}33, transparent)` }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full blur-[150px] pointer-events-none" style={{ background: `${MAROON}14` }} />

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12">

          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-3 mb-5">
              <div className="h-px w-12" style={{ background: `${MAROON}80` }} />
              <span className="text-[10px] uppercase tracking-[0.4em] font-semibold" style={{ color: '#e0b478b3' }}>System Capabilities</span>
              <div className="h-px w-12" style={{ background: `${MAROON}80` }} />
            </div>
            <h2 className="font-display font-bold text-4xl md:text-5xl text-white leading-tight">
              Built for the scholars.<br />
              <span className="italic" style={{ color: '#e0b478' }}>Designed for clarity.</span>
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
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-colors duration-500"
                  style={{ background: activeFeature === i ? MAROON : 'rgba(255,255,255,0.05)' }}
                >
                  <span className="transition-colors duration-500" style={{ color: activeFeature === i ? '#e0b478' : 'rgba(255,255,255,0.5)' }}>
                    {f.icon}
                  </span>
                </div>
                <h3 className="font-semibold text-white text-base mb-2">{f.title}</h3>
                <p className="text-white/45 text-sm leading-relaxed font-light">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Role breakdown — now with an icon per role instead of just a
              colored dot, since a bare dot read as unfinished */}
          <div className="mt-16 grid md:grid-cols-2 xl:grid-cols-4 gap-6">
            {roles.map((r, i) => (
              <div key={i} className="glass rounded-3xl p-7 relative overflow-hidden group">
                <div
                  className="absolute top-0 left-0 w-full h-0.5 transition-opacity duration-300 group-hover:opacity-100 opacity-60"
                  style={{ background: `linear-gradient(to right, transparent, ${r.color}, transparent)` }}
                />
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${r.color}1f`, color: r.color }}
                >
                  <r.Icon size={17} />
                </div>
                <h4 className="font-semibold text-white text-sm uppercase tracking-widest mb-3">{r.role}</h4>
                <p className="text-white/45 text-sm leading-relaxed font-light">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SCHOLARS SECTION (photo gallery) ─────────────────────────────────── */}
      <section id="scholars" className="relative py-24 font-body overflow-hidden">
        <div className="absolute inset-0" style={{ background: INK_DARK }} />
        <div className="absolute top-0 left-0 w-full h-px" style={{ background: `linear-gradient(to right, transparent, ${MAROON}4d, transparent)` }} />

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px w-10" style={{ background: `${MAROON}80` }} />
                <span className="text-[10px] uppercase tracking-[0.4em] font-semibold" style={{ color: '#e0b478b3' }}>Our Community</span>
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

          {/* Photo grid — one large showcase photo + a CTA panel that echoes the hero.
              Both fall back to plain gradients if their source photo is missing. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              className="h-80 md:h-[420px] rounded-3xl bg-cover bg-center relative overflow-hidden group border border-white/5"
              style={{ backgroundImage: galleryPhotoFailed ? fallbackGradient : `url(${galleryPhoto})` }}
            >
              <img src={galleryPhoto} alt="" className="hidden" onError={() => setGalleryPhotoFailed(true)} />
              <div className="absolute inset-0 bg-black/25 group-hover:bg-black/15 transition-colors duration-500" />
              <div className="absolute bottom-6 left-6">
                <p className="font-display italic text-2xl text-white">Papaya Academy</p>
                <p className="text-xs text-white/50 tracking-widest uppercase">A Kalinga Project · Payatas</p>
              </div>
            </div>

            <div
              className="h-80 md:h-[420px] rounded-3xl bg-cover bg-center relative overflow-hidden group border border-white/5"
              style={{ backgroundImage: heroPhotoFailed ? fallbackGradient : `url(${heroPhoto})` }}
            >
              <div className="absolute inset-0" style={{ background: 'rgba(26,13,16,0.6)' }} />
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
        <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${INK_DARK}, #241014)` }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full blur-[120px] anim-glow pointer-events-none" style={{ background: `${MAROON}33` }} />

        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
          <div className="glass rounded-[3rem] p-12 md:p-16 maroon-glow" style={{ borderColor: `${MAROON}33` }}>
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-8"
              style={{ background: `linear-gradient(135deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)` }}
            >
              <AppleMark size={26} className="text-[#e0b478]" />
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
            <AppleMark size={15} style={{ color: MAROON }} />
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