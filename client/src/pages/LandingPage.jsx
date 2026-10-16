import { useNavigate } from 'react-router-dom';
import { useState, useEffect, Fragment } from 'react';
import TAGALOG_COPY from '../locales/landingTagalog';
import {
  Globe,
  ArrowRight,
  BookOpen,
  Users,
  BarChart2,
  ShieldCheck,
  Menu,
  X,
  UserCog,
  ClipboardCheck,
  Headset,
  GraduationCap,
  Clock,
  Activity,
  Upload,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MapPin,
} from 'lucide-react';

// ─── OFFICIAL LOGO ─────────────────────────────────────────────────────────
import appleLogo from '../assets/logo/applelogo.png';

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

// Additional community / activity photos (same folder: src/assets/landing/)
import communityCleanup from '../assets/landing/community-cleanup-activity.jpg';
import communityGarden from '../assets/landing/community-garden-project.jpg';
import scholarGathering from '../assets/landing/scholar-community-gathering.jpg';
import scholarService from '../assets/landing/scholar-community-service.jpg';
import scholarLaptops from '../assets/landing/scholar-laptop-distribution.jpg';
import scholarVolunteer from '../assets/landing/scholar-volunteer-activity.jpg';

// ─── Token system — Apple Scholar portal branding (same as Login / Forgot Password) ───
const MAROON = '#6D2140';
const MAROON_DEEP = '#4A1730';
const CREAM = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const BRONZE = '#B98B4E';
const BRONZE_DARK = '#8F6A35'; // bronze for small text on light surfaces (contrast)
const BRONZE_LIGHT = '#DDBA86'; // bronze for text on maroon
const SAND = '#F1E8DA'; // soft neutral surface for variety inside bento grids
const INK = '#241512';
const INK_SOFT = '#5C4E42'; // body copy on cream
const MUTED = '#8A7A68';

// Full-width background, controlled inner width
const WRAP = 'w-full mx-auto px-4 sm:px-6 lg:px-10';

// ─── Feature cards data from thesis ───────────────────────────────────────────
const features = [
  {
    Icon: ShieldCheck,
    title: 'Compliance & Submission Management',
    desc: 'Scholars submit requirements and documents while administrators and officers track status, deadlines, and follow-ups.',
  },
  {
    Icon: BookOpen,
    title: 'Letter & Report Review',
    desc: 'The system supports review of scholar letters, monthly reports, and related correspondence with structured evaluation tools.',
  },
  {
    Icon: BarChart2,
    title: 'Attendance & Duty Monitoring',
    desc: 'Staff and officers can record attendance, manage duty logs, and monitor scholar participation through the portal.',
  },
  {
    Icon: Users,
    title: 'Role-Based Portal Access',
    desc: 'The platform is built for four user roles: Administrator, Officer, Staff, and Scholar, each with specific permissions.',
  },
];

// ─── Stats pulled from system description ─────────────────────────────────────
const stats = [
  { Icon: Users, value: '4', label: 'Portal Roles' },
  { Icon: Clock, value: '24/7', label: 'Monitoring' },
  { Icon: Activity, value: 'Real-Time', label: 'Updates' },
  { Icon: ShieldCheck, value: 'Secure', label: 'Audit Trail' },
];

const workflowSteps = [
  {
    Icon: Upload,
    title: 'Submit requirements',
    desc: 'Scholars upload their compliance files, reports, and updates through a simple and guided process.',
  },
  {
    Icon: ClipboardCheck,
    title: 'Review and validate',
    desc: 'Officers and staff verify submissions, assign follow-ups, and keep records accurate and timely.',
  },
  {
    Icon: BarChart2,
    title: 'Track progress',
    desc: 'Administrators monitor overall performance, deadlines, and report status from one centralized dashboard.',
  },
];

const roles = [
  { role: 'Administrator', Icon: UserCog, desc: 'Manages users, compliance requirements, deadlines, reports, and overall system oversight.' },
  { role: 'Officer', Icon: ClipboardCheck, desc: 'Reviews scholar submissions, validates compliance records, and monitors progress closely.' },
  { role: 'Staff', Icon: Headset, desc: 'Handles attendance, duty logs, announcements, and support tasks for scholars.' },
  { role: 'Scholar', Icon: GraduationCap, desc: 'Uploads requirements, tracks personal status, views announcements, and accesses duty-related information.' },
];

// Compact summary cards (second bento row). Each opens its detailed panel below.
const quickCards = [
  { key: 'features', Icon: ShieldCheck, title: 'Key Features', desc: 'Compliance, monitoring, communication, and more in one platform.' },
  { key: 'workflow', Icon: BookOpen, title: 'How It Works', desc: 'A simple and guided process from submission to tracking.' },
  { key: 'scholars', Icon: Users, title: 'Our Scholars', desc: 'Stories, progress, and the growing Apple Scholar community.' },
];

// Community / activity photos shown in the carousel and the Scholars gallery
const extraPhotos = [
  { key: 'cleanup', src: communityCleanup, title: 'Community Clean-up', alt: 'Scholars taking part in a community clean-up activity' },
  { key: 'garden', src: communityGarden, title: 'Community Garden', alt: 'Scholars working on a community garden project' },
  { key: 'gathering', src: scholarGathering, title: 'Community Gathering', alt: 'Scholars and families at a community gathering' },
  { key: 'service', src: scholarService, title: 'Community Service', alt: 'Scholars doing community service' },
  { key: 'laptops', src: scholarLaptops, title: 'Laptop Distribution', alt: 'Laptop distribution to Apple Scholars' },
  { key: 'volunteer', src: scholarVolunteer, title: 'Volunteer Activity', alt: 'Scholars volunteering together' },
];
const SLIDE_COUNT = 4 + extraPhotos.length;

const NAV_LINKS = ['Home', 'About', 'Workflow', 'Features', 'Scholars'];
const NAV_DETAIL = { Features: 'features', Workflow: 'workflow', Scholars: 'scholars' };
// ─── Small helpers ────────────────────────────────────────────────────────────
const Ico = ({ Icon, ...props }) => <Icon {...props} />;

// Photo block: <img> with object-cover; swaps to a plain maroon gradient if
// the file is missing/renamed, instead of a broken or blank block.
const PhotoFill = ({ src, failed, onFail, alt = '', position = 'center', fallback }) =>
  failed ? (
    <div className="absolute inset-0" style={{ background: fallback }} role="img" aria-label={alt} />
  ) : (
    <img
      src={src}
      alt={alt}
      onError={onFail}
      className="absolute inset-0 w-full h-full object-cover"
      style={{ objectPosition: position }}
    />
  );

const Eyebrow = ({ children, light = false, className = 'mb-3' }) => (
  <p
    className={`text-[10.5px] font-semibold uppercase tracking-[0.22em] ${className}`}
    style={{ color: light ? BRONZE_LIGHT : BRONZE_DARK }}
  >
    {children}
  </p>
);

// Small leaf-inspired decoration (purely visual) — same motif as Login / Forgot Password
const LeafCluster = ({ className = '', flip = false, style }) => (
  <svg
    className={`pointer-events-none ${className}`}
    viewBox="0 0 120 150"
    aria-hidden="true"
    style={{ ...(flip ? { transform: 'scaleX(-1)' } : null), ...style }}
  >
    <path d="M60 148 C58 110 58 80 60 40" stroke="#B98B4E" strokeWidth="2" fill="none" opacity="0.7" />
    <path d="M60 140 C34 112 34 66 58 28 C84 62 82 108 60 140 Z" fill="#D9B98A" opacity="0.85" transform="rotate(-26 60 148)" />
    <path d="M60 140 C34 112 34 66 58 28 C84 62 82 108 60 140 Z" fill="#B98B4E" opacity="0.8" transform="rotate(4 60 148)" />
    <path d="M60 140 C34 112 34 66 58 28 C84 62 82 108 60 140 Z" fill="#EAD9C2" opacity="0.95" transform="rotate(32 60 148)" />
  </svg>
);

const LandingPage = () => {
  const navigate = useNavigate();
  const [language, setLanguage] = useState(() => localStorage.getItem('landing-language') || 'en');
  const isTagalog = language === 'tl';
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const [activeNav, setActiveNav] = useState('Home');
  const [detail, setDetail] = useState(null); // 'features' | 'workflow' | 'scholars' | null
  const [slide, setSlide] = useState(0);
  const [failedExtra, setFailedExtra] = useState({}); // load-failure flags for the extra photos
  const failExtra = key => setFailedExtra(f => ({ ...f, [key]: true }));

  // Per-photo load-failure flags. If a file is missing/renamed under
  // src/assets/landing/, the corresponding section falls back to a plain
  // maroon gradient instead of a broken image or blank block.
  const [heroPhotoFailed, setHeroPhotoFailed] = useState(false);
  const [aboutFrontPhotoFailed, setAboutFrontPhotoFailed] = useState(false);
  const [aboutBackPhotoFailed, setAboutBackPhotoFailed] = useState(false);
  const [galleryPhotoFailed, setGalleryPhotoFailed] = useState(false);

  const fallbackGradient = `linear-gradient(160deg, ${MAROON} 0%, ${MAROON_DEEP} 80%)`;

  const localizedFeatures = isTagalog
    ? features.map((item, index) => ({ ...item, title: TAGALOG_COPY.featureTitles[index], desc: TAGALOG_COPY.featureDescriptions[index] }))
    : features;
  const localizedWorkflowSteps = isTagalog
    ? workflowSteps.map((item, index) => ({ ...item, title: TAGALOG_COPY.workflowTitles[index], desc: TAGALOG_COPY.workflowDescriptions[index] }))
    : workflowSteps;
  const localizedRoles = isTagalog
    ? roles.map((item, index) => ({ ...item, role: TAGALOG_COPY.roleLabels[index], desc: TAGALOG_COPY.roleDescriptions[index] }))
    : roles;
  const localizedQuickCards = isTagalog
    ? quickCards.map((item, index) => ({ ...item, title: TAGALOG_COPY.quickTitles[index], desc: TAGALOG_COPY.quickDescriptions[index] }))
    : quickCards;

  const changeLanguage = event => {
    const nextLanguage = event.target.value;
    setLanguage(nextLanguage);
    localStorage.setItem('landing-language', nextLanguage);
  };

  // Featured photo carousel — uses the same four existing photos
  const slides = [
    { src: aboutFrontPhoto, failed: aboutFrontPhotoFailed, onFail: () => setAboutFrontPhotoFailed(true), alt: 'Apple Scholar students and staff seated together indoors', position: 'center 40%', title: 'Papaya Academy', sub: isTagalog ? 'Proyekto ng Kalinga · Kinikilala ng DepEd' : 'A Kalinga Project · DepEd Recognized' },
    { src: galleryPhoto, failed: galleryPhotoFailed, onFail: () => setGalleryPhotoFailed(true), alt: 'Apple Scholar students at Papaya Academy', position: 'center 40%', title: 'Papaya Academy', sub: isTagalog ? 'Proyekto ng Kalinga · Kinikilala ng DepEd' : 'A Kalinga Project · DepEd Recognized' },
    { src: aboutBackPhoto, failed: aboutBackPhotoFailed, onFail: () => setAboutBackPhotoFailed(true), alt: 'Scholars waving in front of the Papaya Academy building', position: 'center 30%', title: 'Papaya Academy', sub: isTagalog ? 'Proyekto ng Kalinga · Kinikilala ng DepEd' : 'A Kalinga Project · DepEd Recognized' },
    { src: heroPhoto, failed: heroPhotoFailed, onFail: () => setHeroPhotoFailed(true), alt: 'Apple Scholar students gathered in front of Papaya Academy', position: 'center 75%', title: 'Papaya Academy', sub: isTagalog ? 'Proyekto ng Kalinga · Kinikilala ng DepEd' : 'A Kalinga Project · DepEd Recognized' },
    ...extraPhotos.map(p => ({
      src: p.src, failed: !!failedExtra[p.key], onFail: () => failExtra(p.key), alt: p.alt, position: 'center 40%',
      title: isTagalog ? TAGALOG_COPY.photoCaptions[extraPhotos.indexOf(p)] : p.title,
      sub: isTagalog ? 'Programa ng Apple Scholar · Payatas' : 'Apple Scholar Program · Payatas',
    })),
  ];

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

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return undefined;
    const interval = setInterval(() => setSlide(s => (s + 1) % SLIDE_COUNT), 6000);
    return () => clearInterval(interval);
  }, []);

  const handleNavClick = link => {
    setMobileMenuOpen(false);
    if (typeof link === 'string') {
      setActiveNav(link);
      if (NAV_DETAIL[link]) setDetail(NAV_DETAIL[link]);
    }
  };
  const toggleDetail = key => setDetail(d => (d === key ? null : key));
  const goSlide = i => setSlide((i + slides.length) % slides.length);

  const featureCardStyle = i => ({
    background: SURFACE,
    border: `1px solid ${activeFeature === i ? MAROON : BORDER}`,
    boxShadow: activeFeature === i ? '0 12px 28px rgba(74,23,48,0.10)' : 'none',
    transition: 'border-color 0.4s ease, box-shadow 0.4s ease',
  });
  const featureChipStyle = i => ({
    background: activeFeature === i ? MAROON : `${BRONZE}26`,
    color: activeFeature === i ? BRONZE_LIGHT : MAROON,
    transition: 'background 0.4s ease, color 0.4s ease',
  });

  const cardBase = { background: SURFACE, border: `1px solid ${BORDER}`, boxShadow: '0 14px 30px -22px rgba(74,23,48,0.35)' };

  // Divider helpers for 2×2 (mobile) → 4-in-a-row (desktop) grids
  const gridDivider = i =>
    [
      '',
      'border-l',
      'border-t lg:border-t-0 lg:border-l',
      'border-l border-t lg:border-t-0',
    ][i];
  const roleDivider = i =>
    [
      '',
      'border-l',
      'border-t sm:border-t-0 sm:border-l',
      'border-l border-t sm:border-t-0',
    ][i];

  return (
    <div
      className="min-h-screen font-body"
      style={{ background: CREAM, color: INK, overflowX: 'clip' }}
    >
      {/* ── SHAPE DEFINITIONS (organic hero curves) ──────────────────────────── */}
      <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
        <defs>
          <clipPath id="hero-maroon-clip" clipPathUnits="objectBoundingBox">
            <path d="M0.2,0 L1,0 L1,1 L0.03,1 C0.2,0.78 -0.02,0.4 0.2,0 Z" />
          </clipPath>
          <clipPath id="hero-photo-clip" clipPathUnits="objectBoundingBox">
            <path d="M0.26,0.03 L0.95,0.03 Q0.985,0.03 0.985,0.09 L0.985,1 L0.1,1 C0.27,0.77 0.06,0.4 0.26,0.03 Z" />
          </clipPath>
        </defs>
      </svg>

      {/* ── GLOBAL STYLE ─────────────────────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400;1,600&family=DM+Sans:wght@300;400;500;600;700&display=swap');

        .font-display { font-family: 'Playfair Display', Georgia, serif; }
        .font-body    { font-family: 'DM Sans', 'Inter', system-ui, sans-serif; }

        html { scroll-behavior: smooth; }

        @keyframes slide-up {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes menu-drop {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim-slide-up  { animation: slide-up 0.7s cubic-bezier(.16,1,.3,1) forwards; }
        .anim-fade-in   { animation: fade-in 1s ease forwards; }
        .anim-menu-drop { animation: menu-drop 0.25s ease forwards; }

        .delay-100 { animation-delay: 0.1s; opacity: 0; }
        .delay-200 { animation-delay: 0.2s; opacity: 0; }
        .delay-300 { animation-delay: 0.3s; opacity: 0; }
        .delay-400 { animation-delay: 0.4s; opacity: 0; }

        /* Hero headline: 38–44px on mobile, scales with width AND height on desktop */
        .hero-h1 { font-size: clamp(2.4rem, 10.5vw, 2.75rem); }

        @media (min-width: 1024px) {
          .hero-h1 { font-size: clamp(2.4rem, min(3.5vw, 6.2vh), 3.9rem); }
          .hero-stage { min-height: clamp(360px, 43vh, 470px); }
          /* text aligns with the page grid; photo bleeds to the right edge */
          .hero-pad { padding-left: max(2rem, calc((100vw - 1480px) / 2 + 2.5rem)); }
          .hero-maroon { clip-path: url(#hero-maroon-clip); }
          .hero-photo  { clip-path: url(#hero-photo-clip); }
        }

        .nav-link { position: relative; transition: color 0.25s; }
        .nav-link::after {
          content: '';
          position: absolute;
          bottom: -7px; left: 0; right: 0;
          height: 2px; border-radius: 2px;
          background: ${MAROON};
          transform: scaleX(0);
          transition: transform 0.25s;
        }
        .nav-link:hover { color: ${MAROON}; }
        .nav-link:hover::after { transform: scaleX(1); background: ${BRONZE}; }
        .nav-link[aria-current='true'] { color: ${MAROON}; font-weight: 600; }
        .nav-link[aria-current='true']::after { transform: scaleX(1); background: ${MAROON}; }

        .lift { transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease; }
        .lift:hover { transform: translateY(-2px); box-shadow: 0 18px 36px -18px rgba(74,23,48,0.35); }

        .zoom img { transition: transform 0.8s cubic-bezier(.16,1,.3,1); }
        .zoom:hover img { transform: scale(1.04); }
        .slide-layer { transition: opacity 0.7s ease; }

        .btn-maroon { background: ${MAROON}; color: #fff; transition: background 0.25s, transform 0.25s, box-shadow 0.25s; }
        .btn-maroon:hover { background: ${MAROON_DEEP}; transform: translateY(-2px); box-shadow: 0 10px 24px rgba(74,23,48,0.28); }
        .btn-outline-maroon { border: 1.5px solid ${MAROON}; color: ${MAROON}; background: transparent; transition: background 0.25s, color 0.25s; }
        .btn-outline-maroon:hover { background: ${MAROON}; color: #fff; }
        .arrow-btn { border: 1.5px solid ${BRONZE}; color: ${MAROON}; transition: background 0.25s, color 0.25s, transform 0.3s; }
        .arrow-btn:hover { background: ${MAROON}; color: #fff; border-color: ${MAROON}; }

        a:focus-visible, button:focus-visible {
          outline: 2px solid ${BRONZE};
          outline-offset: 3px;
        }

        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
          .anim-slide-up, .anim-fade-in, .anim-menu-drop { animation: none !important; opacity: 1 !important; transform: none !important; }
          .lift, .zoom img, .btn-maroon, .nav-link::after, .slide-layer, .arrow-btn { transition: none !important; }
        }
      `}</style>

      {/* ── NAVBAR ───────────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50 font-body"
        style={{
          background: scrolled ? 'rgba(247,244,238,0.93)' : CREAM,
          backdropFilter: scrolled ? 'blur(10px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(10px)' : 'none',
          borderBottom: `1px solid ${BORDER}`,
          boxShadow: scrolled ? '0 8px 24px rgba(74,23,48,0.08)' : 'none',
          transition: 'box-shadow 0.3s ease, background 0.3s ease',
        }}
      >
        <div className={`${WRAP} h-16 flex lg:grid lg:grid-cols-[1fr_auto_1fr] items-center justify-between gap-4`}>
          {/* Official logo */}
          <a href="#home" onClick={() => handleNavClick('Home')} className="flex-shrink-0 justify-self-start" aria-label="Apple Scholar — home">
            <img
              src={appleLogo}
              alt="Apple Scholar"
              className="h-10 sm:h-11 w-auto"
              style={{ objectFit: 'contain' }}
            />
          </a>

          {/* Links — desktop (centered) */}
          <div className="hidden lg:flex items-center gap-9 text-[13px] font-medium" style={{ color: INK_SOFT }}>
            {NAV_LINKS.map(link => (
              <a
                key={link}
                href={`#${link.toLowerCase()}`}
                onClick={() => handleNavClick(link)}
                aria-current={activeNav === link ? 'true' : undefined}
                className="nav-link"
              >
                {isTagalog ? TAGALOG_COPY.nav[NAV_LINKS.indexOf(link)] : link}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3 justify-self-end">
            {/* CTA */}
            <button
              onClick={() => navigate('/login')}
              className="btn-maroon hidden sm:flex items-center gap-2 text-[13px] font-semibold px-5 h-10 rounded-full"
            >
              <span>{isTagalog ? TAGALOG_COPY.portalLogin : 'Portal Login'}</span>
              <ArrowRight size={15} />
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(o => !o)}
              className="lg:hidden w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: SURFACE, border: `1px solid ${BORDER}`, color: MAROON }}
              aria-label={isTagalog ? TAGALOG_COPY.menuToggle : 'Toggle menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div
            className="lg:hidden anim-menu-drop px-4 sm:px-6 pt-1 pb-5 flex flex-col"
            style={{ background: CREAM, borderTop: `1px solid ${BORDER}` }}
          >
            {NAV_LINKS.map(link => (
              <a
                key={link}
                href={`#${link.toLowerCase()}`}
                onClick={() => handleNavClick(link)}
                className="text-base font-medium py-3"
                style={{ color: activeNav === link ? MAROON : INK, borderBottom: `1px solid ${BORDER}` }}
              >
                {isTagalog ? TAGALOG_COPY.nav[NAV_LINKS.indexOf(link)] : link}
              </a>
            ))}
            <button
              onClick={() => navigate('/login')}
              className="btn-maroon sm:hidden text-sm font-semibold px-6 h-12 rounded-full flex items-center justify-center gap-2 mt-5"
            >
              <span>{isTagalog ? TAGALOG_COPY.portalLogin : 'Portal Login'}</span>
              <ArrowRight size={15} />
            </button>
          </div>
        )}
      </nav>

      {/* ── HERO SECTION ─────────────────────────────────────────────────────── */}
      <section id="home" className="relative scroll-mt-20 overflow-hidden">
        {/* Organic background — cream sweeps, a maroon wave and a bronze line */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 1536 460"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0,0 L700,0 C640,90 520,150 540,250 C560,330 460,400 300,430 C190,452 80,430 0,450 Z" fill={SAND} opacity="0.75" />
          <path d="M0,0 L380,0 C340,70 270,110 280,190 C290,260 200,320 110,340 C60,350 30,346 0,360 Z" fill="#EAD9C2" opacity="0.4" />
          <path d="M0,340 C70,336 150,370 230,420 L230,460 L0,460 Z" fill={MAROON} />
          <path d="M0,340 C70,336 150,370 230,420" fill="none" stroke={BRONZE} strokeWidth="1.5" opacity="0.7" vectorEffect="non-scaling-stroke" />
        </svg>
        <LeafCluster className="hidden lg:block absolute left-1 bottom-24 w-14 xl:w-16" />
        <LeafCluster className="hidden lg:block absolute top-[44%] w-12 xl:w-14" style={{ left: '37.5%' }} />
        <LeafCluster className="hidden lg:block absolute right-0 bottom-16 w-10 xl:w-12 opacity-90" flip />

        <div className="relative hero-stage flex flex-col lg:flex lg:flex-row lg:items-center">
          {/* Text column */}
          <div className="relative z-10 px-4 sm:px-6 pt-7 pb-5 lg:py-7 lg:w-[44%] hero-pad lg:pr-6">
            <div className="max-w-[520px]">
              <p
                className="anim-slide-up delay-100 text-[10.5px] sm:text-[11px] font-semibold uppercase leading-relaxed mb-3"
                style={{ color: BRONZE_DARK, letterSpacing: '0.22em' }}
              >
                Kalinga Foundation<br />Apple Scholar Program
              </p>

              <h1 className="anim-slide-up delay-200 hero-h1 font-display font-bold leading-[1.04] mb-3" style={{ color: MAROON }}>
                <span className="block">{isTagalog ? TAGALOG_COPY.heroTitle[0] : 'Support every'}</span>
                <span className="block">{isTagalog ? TAGALOG_COPY.heroTitle[1] : 'scholar journey.'}</span>
              </h1>

              <p className="anim-slide-up delay-200 font-display text-lg sm:text-xl lg:text-[1.35rem] mb-3" style={{ color: INK }}>
                {isTagalog ? TAGALOG_COPY.heroSubtitle : 'From submission to success.'}
              </p>

              <p
                className="anim-slide-up delay-300 max-w-[30rem] text-[14px] leading-[1.55] mb-5"
                style={{ color: INK_SOFT }}
              >
                {isTagalog ? TAGALOG_COPY.heroDescription : 'A centralized portal for tracking compliance, reviewing correspondence, and monitoring academic progress across administrators, officers, staff, and scholars in the Apple Scholar Program.'}
              </p>

              {/* Credibility chips (replace the duplicate Enter Portal / Learn More buttons) */}
              <div className="anim-slide-up delay-400 flex flex-wrap gap-2.5">
                {[
                  { Icon: GraduationCap, text: isTagalog ? TAGALOG_COPY.credibility[0] : 'DepEd Recognized' },
                  { Icon: BookOpen, text: isTagalog ? TAGALOG_COPY.credibility[1] : 'A Kalinga Project' },
                  { Icon: MapPin, text: isTagalog ? TAGALOG_COPY.credibility[2] : 'Payatas, Manila' },
                ].map(({ Icon, text }) => (
                  <span
                    key={text}
                    className="inline-flex items-center gap-2 h-9 pl-1.5 pr-3.5 rounded-full text-[12.5px] font-medium"
                    style={{ background: SURFACE, border: `1px solid ${BORDER}`, color: INK_SOFT }}
                  >
                    <span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: `${BRONZE}26`, color: MAROON }}>
                      <Icon size={13} />
                    </span>
                    {text}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Photo: organic maroon frame + curved photo + bronze line */}
          <div className="px-4 pb-5 sm:px-6 lg:p-0 lg:absolute lg:inset-y-0 lg:right-0 lg:w-[58%]">
            <div className="relative h-[250px] sm:h-[350px] lg:h-full">
              <div
                className="anim-fade-in delay-200 hero-maroon zoom absolute inset-0 rounded-[20px] lg:rounded-none overflow-hidden"
                style={{ background: `linear-gradient(155deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)` }}
              >
                <div className="hero-photo absolute inset-1.5 lg:inset-0 rounded-[16px] lg:rounded-none overflow-hidden">
                  <PhotoFill
                    src={heroPhoto}
                    failed={heroPhotoFailed}
                    onFail={() => setHeroPhotoFailed(true)}
                    alt="Apple Scholar students gathered in front of Papaya Academy"
                    position="center 82%"
                    fallback={fallbackGradient}
                  />
                </div>
              </div>
              <svg
                className="hidden lg:block absolute inset-0 w-full h-full pointer-events-none overflow-visible"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d="M0.2,100 C18.2,78 -3.8,40 16.2,0" fill="none" stroke={BRONZE} strokeWidth="1.6" opacity="0.8" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
          </div>
        </div>

        {/* STAT STRIP — one floating bento strip with vertical separators */}
        <div className={`${WRAP} relative z-20 mt-1 lg:mt-4`}>
          <div className="grid grid-cols-2 lg:grid-cols-4 rounded-[20px] overflow-hidden lg:mx-8" style={cardBase}>
            {stats.map((s, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 px-4 py-3 sm:px-6 sm:py-3.5 ${gridDivider(i)}`}
                style={{ borderColor: BORDER }}
              >
                <span
                  className="w-10 h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: `${BRONZE}26`, color: MAROON }}
                >
                  <s.Icon size={18} />
                </span>
                <div className="min-w-0">
                  <p className="font-display font-bold text-lg lg:text-[1.55rem] leading-tight truncate" style={{ color: MAROON_DEEP }}>{isTagalog ? TAGALOG_COPY.statsValues[i] : s.value}</p>
                  <p className="text-xs lg:text-[13px]" style={{ color: MUTED }}>{isTagalog ? TAGALOG_COPY.stats[i] : s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MAIN BENTO (about · featured photo · roles) + SUMMARY ROW ────────── */}
      <section className="relative pt-5 lg:pt-6 pb-10 lg:pb-12">
        {/* soft organic sand curves behind the bento */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 1536 700"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0,60 C160,20 260,120 330,260 C400,400 260,560 0,640 Z" fill={SAND} opacity="0.7" />
          <path d="M1536,40 C1400,90 1340,200 1380,330 C1420,460 1500,520 1536,600 Z" fill={SAND} opacity="0.7" />
          <path d="M0,620 C300,560 600,660 900,620 C1200,580 1380,640 1536,600" fill="none" stroke={BRONZE} strokeWidth="1.3" opacity="0.35" vectorEffect="non-scaling-stroke" />
        </svg>
        <LeafCluster className="hidden xl:block absolute left-1 top-[46%] w-12 opacity-90" />
        <LeafCluster className="hidden xl:block absolute right-1 top-[34%] w-12 opacity-90" flip />
        <LeafCluster className="hidden xl:block absolute right-2 bottom-14 w-10 opacity-90" flip />

        <div className={`${WRAP} relative`}>
          {/* Row 1 */}
          <div className="grid lg:grid-cols-[1.1fr_1fr_1.1fr] gap-4 lg:gap-5">

            {/* ABOUT */}
            <div
              id="about"
              className="relative overflow-hidden scroll-mt-24 rounded-[22px] p-5 sm:p-6 flex flex-col"
              style={cardBase}
            >
              <Eyebrow>{isTagalog ? TAGALOG_COPY.aboutEyebrow : 'About Apple Scholar'}</Eyebrow>
              <h2 className="font-display font-bold text-[1.6rem] sm:text-[1.75rem] leading-[1.1] mb-3" style={{ color: MAROON_DEEP }}>
                {isTagalog ? TAGALOG_COPY.aboutTitle : 'Education for those who need it most.'}
              </h2>
              <div className="space-y-2.5 text-[13px] leading-[1.55]" style={{ color: INK_SOFT }}>
                <p>{isTagalog ? TAGALOG_COPY.aboutParagraphs[0] : <>
                  The <strong className="font-semibold" style={{ color: INK }}>Kalinga Foundation</strong> is devoted to children in extreme poverty
                  living in and around the Payatas rubbish dump in Manila, Philippines.
                  Kalinga offers them tools with which they can build a better future for themselves.
                </>}</p>
                <p>{isTagalog ? TAGALOG_COPY.aboutParagraphs[1] : <>
                  The <strong className="font-semibold" style={{ color: INK }}>Apple Scholar Program</strong> is the foundation's scholarship arm —
                  providing financial support, mentoring, and academic guidance to disadvantaged
                  youth, from high school through college and beyond.
                </>}</p>
                <p>{isTagalog ? TAGALOG_COPY.aboutParagraphs[2] : <>
                  This platform — the <strong className="font-semibold" style={{ color: INK }}>Scholarship Compliance Tracking System</strong> —
                  was built to digitize and streamline the program's operations: monitoring compliance,
                  evaluating correspondence, and generating analytics to support every scholar's journey.
                </>}</p>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <a
                  href="#features"
                  onClick={() => handleNavClick('Features')}
                  className="btn-outline-maroon h-9 px-5 rounded-full text-[13px] font-semibold inline-flex items-center gap-2"
                >
                  {isTagalog ? TAGALOG_COPY.learnMore : 'Learn More'} <ArrowRight size={14} />
                </a>
                <p className="text-[11px] text-right" style={{ color: MUTED }}>Payatas, Quezon City · Manila, Philippines</p>
              </div>
            </div>

            {/* FEATURED PHOTO CAROUSEL */}
            <div className="flex flex-col">
              <div
                className="zoom relative overflow-hidden rounded-[22px] min-h-[260px] flex-1"
                style={{ border: `1px solid ${BORDER}`, background: MAROON_DEEP }}
              >
                {slides.map((s, i) => (
                  <div
                    key={i}
                    className="slide-layer absolute inset-0"
                    style={{ opacity: slide === i ? 1 : 0 }}
                    aria-hidden={slide === i ? undefined : 'true'}
                  >
                    <PhotoFill
                      src={s.src}
                      failed={s.failed}
                      onFail={s.onFail}
                      alt={s.alt}
                      position={s.position}
                      fallback={fallbackGradient}
                    />
                  </div>
                ))}
                <div className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(36,21,18,0.78), transparent)' }} />
                <button
                  onClick={() => goSlide(slide - 1)}
                  aria-label={isTagalog ? TAGALOG_COPY.previousPhoto : 'Previous photo'}
                  className="absolute left-3 bottom-4 w-9 h-9 rounded-full flex items-center justify-center text-white"
                  style={{ border: '1px solid rgba(255,255,255,0.55)', background: 'rgba(36,21,18,0.35)' }}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => goSlide(slide + 1)}
                  aria-label={isTagalog ? TAGALOG_COPY.nextPhoto : 'Next photo'}
                  className="absolute right-3 bottom-4 w-9 h-9 rounded-full flex items-center justify-center text-white"
                  style={{ border: '1px solid rgba(255,255,255,0.55)', background: 'rgba(36,21,18,0.35)' }}
                >
                  <ChevronRight size={18} />
                </button>
                <div className="absolute bottom-4 left-14 right-14">
                  <p className="font-display font-semibold text-lg text-white leading-tight">{slides[slide].title}</p>
                  <p className="text-[11.5px] text-white/85">{slides[slide].sub}</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 pt-3" role="tablist" aria-label={isTagalog ? TAGALOG_COPY.featuredPhotos : 'Featured photos'}>
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goSlide(i)}
                    aria-label={`${isTagalog ? TAGALOG_COPY.showPhoto : 'Show photo'} ${i + 1}`}
                    aria-selected={slide === i}
                    role="tab"
                    className="rounded-full"
                    style={{
                      width: 8,
                      height: 8,
                      background: slide === i ? MAROON : '#E3D3C0',
                      transition: 'background 0.3s ease',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* PORTAL ROLES — one compact card, four columns */}
            <div id="roles" className="scroll-mt-24 rounded-[22px] p-5 sm:p-6 flex flex-col self-start lg:self-stretch" style={cardBase}>
              <h2 className="sr-only">{isTagalog ? TAGALOG_COPY.roleAccessibleHeading : 'Built for Every Member of the Scholarship Community'}</h2>
              <Eyebrow className="mb-4">{isTagalog ? TAGALOG_COPY.portalRoles : 'Portal Roles'}</Eyebrow>
              <div className="grid grid-cols-2 sm:grid-cols-4 flex-1">
                {localizedRoles.map((r, i) => (
                  <div
                    key={r.role}
                    className={`flex flex-col items-center text-center px-2.5 py-3 sm:py-0 ${roleDivider(i)}`}
                    style={{ borderColor: BORDER }}
                  >
                    <span
                      className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                      style={{ background: `${BRONZE}26`, color: MAROON }}
                    >
                      <r.Icon size={20} />
                    </span>
                    <h3 className="font-display font-bold text-[15px] mb-1.5" style={{ color: MAROON_DEEP }}>{r.role}</h3>
                    <p className="text-[12px] leading-[1.45]" style={{ color: INK_SOFT }}>{r.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2 — compact summary cards */}
          <div className="grid md:grid-cols-3 gap-4 lg:gap-5 mt-4 lg:mt-5">
            {localizedQuickCards.map(c => {
              const open = detail === c.key;
              return (
                <div
                  key={c.key}
                  id={c.key}
                  className="lift scroll-mt-24 rounded-[20px] px-4 py-3.5 sm:px-5 flex items-center gap-4"
                  style={{ ...cardBase, borderColor: open ? MAROON : BORDER }}
                >
                  <span
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: `${BRONZE}26`, color: MAROON }}
                  >
                    <c.Icon size={22} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display font-bold text-lg leading-tight mb-0.5" style={{ color: MAROON_DEEP }}>{c.title}</h3>
                    <p className="text-[13px] leading-snug" style={{ color: INK_SOFT }}>{c.desc}</p>
                  </div>
                  <button
                    onClick={() => toggleDetail(c.key)}
                    aria-expanded={open}
                    aria-controls="detail-panel"
                    aria-label={`${open ? (isTagalog ? TAGALOG_COPY.hide : 'Hide') : (isTagalog ? TAGALOG_COPY.show : 'Show')} ${c.title}`}
                    className="arrow-btn w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={open ? { background: MAROON, color: '#fff', borderColor: MAROON } : undefined}
                  >
                    {open ? <ChevronDown size={18} className="rotate-180" /> : <ArrowRight size={18} />}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Expandable detail panel — keeps all original feature / workflow / scholar content */}
          {detail && (
            <div
              id="detail-panel"
              className="anim-slide-up mt-4 lg:mt-5 rounded-[22px] p-5 sm:p-6"
              style={cardBase}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <Eyebrow className="mb-1.5">
                    {detail === 'features' ? (isTagalog ? 'Mga Tampok' : 'Key Features') : detail === 'workflow' ? (isTagalog ? 'Paano ito gumagana' : 'How it works') : (isTagalog ? 'Ang Aming Komunidad' : 'Our Community')}
                  </Eyebrow>
                  <h2 className="font-display font-bold text-2xl sm:text-[1.7rem] leading-tight" style={{ color: MAROON_DEEP }}>
                    {detail === 'features' && (isTagalog ? TAGALOG_COPY.detailHeadings[0] : 'A Complete Scholarship Management Portal')}
                    {detail === 'workflow' && (isTagalog ? TAGALOG_COPY.detailHeadings[1] : 'A Simple and Organized Process')}
                    {detail === 'scholars' && (isTagalog ? TAGALOG_COPY.detailHeadings[2] : 'The scholars behind every record.')}
                  </h2>
                  {detail === 'features' && (
                    <p className="text-[13.5px] mt-1.5" style={{ color: INK_SOFT }}>
                      {isTagalog ? 'Mga madaling gamiting tool para sa pagsunod, komunikasyon, pagsubaybay, at iba pa.' : 'Streamlined tools for compliance, communication, monitoring, and more.'}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setDetail(null)}
                  aria-label={isTagalog ? TAGALOG_COPY.closeDetails : 'Close details'}
                  className="arrow-btn w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                >
                  <X size={16} />
                </button>
              </div>

              {/* FEATURES */}
              {detail === 'features' && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {localizedFeatures.map((f, i) => (
                    <div
                      key={f.title}
                      onMouseEnter={() => setActiveFeature(i)}
                      className="rounded-[18px] p-4 cursor-default"
                      style={featureCardStyle(i)}
                    >
                      <span className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3" style={featureChipStyle(i)}>
                        <Ico Icon={f.Icon} size={20} />
                      </span>
                      <h3 className="font-display font-bold text-base leading-snug mb-1.5" style={{ color: MAROON_DEEP }}>{f.title}</h3>
                      <p className="text-[13px] leading-relaxed" style={{ color: INK_SOFT }}>{f.desc}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* WORKFLOW */}
              {detail === 'workflow' && (
                <div className="flex flex-col md:flex-row md:items-stretch gap-3">
                  {localizedWorkflowSteps.map((step, index) => (
                    <Fragment key={step.title}>
                      <div className="flex-1 rounded-[18px] p-4 sm:p-5" style={{ background: SAND, border: `1px solid ${BORDER}` }}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: MAROON, color: BRONZE_LIGHT }}>
                            <step.Icon size={20} />
                          </span>
                          <span className="font-display font-bold text-4xl leading-none" style={{ color: `${BRONZE}99` }}>0{index + 1}</span>
                        </div>
                        <h3 className="font-display font-bold text-lg mb-1" style={{ color: MAROON_DEEP }}>{step.title}</h3>
                        <p className="text-[13px] leading-relaxed" style={{ color: INK_SOFT }}>{step.desc}</p>
                      </div>
                      {index < workflowSteps.length - 1 && (
                        <div className="hidden md:flex items-center" aria-hidden="true">
                          <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ border: `1px solid ${BORDER}`, color: BRONZE_DARK, background: CREAM }}>
                            <ArrowRight size={14} />
                          </span>
                        </div>
                      )}
                    </Fragment>
                  ))}
                </div>
              )}

              {/* SCHOLARS */}
              {detail === 'scholars' && (
                <div className="grid lg:grid-cols-12 gap-3">
                  <div className="zoom lg:col-span-5 relative overflow-hidden rounded-[18px] h-[220px]" style={{ border: `1px solid ${BORDER}` }}>
                    <PhotoFill
                      src={galleryPhoto}
                      failed={galleryPhotoFailed}
                      onFail={() => setGalleryPhotoFailed(true)}
                      alt="Apple Scholar students at Papaya Academy"
                      fallback={fallbackGradient}
                    />
                    <div className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(36,21,18,0.7), transparent)' }} />
                    <div className="absolute bottom-4 left-4">
                      <p className="font-display italic text-xl text-white">Papaya Academy</p>
                      <p className="text-[11.5px] text-white/80">A Kalinga Project · Payatas</p>
                    </div>
                  </div>

                  <div className="zoom lg:col-span-3 relative overflow-hidden rounded-[18px] min-h-[180px] lg:h-[220px] flex items-center justify-center p-5">
                    <PhotoFill
                      src={heroPhoto}
                      failed={heroPhotoFailed}
                      onFail={() => setHeroPhotoFailed(true)}
                      alt=""
                      fallback={fallbackGradient}
                    />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, rgba(109,33,64,0.86), rgba(74,23,48,0.92))' }} />
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">
                      <path d="M0,300 C80,240 140,260 220,210 C300,160 340,170 400,110" fill="none" stroke="rgba(221,186,134,0.55)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
                    </svg>
                    <div className="relative text-center">
                      <p className="font-display italic text-2xl sm:text-3xl text-white mb-1.5">{isTagalog ? TAGALOG_COPY.joinMission : 'Join the mission.'}</p>
                      <p className="text-[13px]" style={{ color: 'rgba(247,244,238,0.85)' }}>{isTagalog ? TAGALOG_COPY.joinMissionDescription : 'Help a scholar achieve their dream'}</p>
                    </div>
                  </div>

                  <div className="lg:col-span-4 rounded-[18px] p-5 flex gap-3 items-start" style={{ background: SAND, border: `1px solid ${BORDER}` }}>
                    <span className="font-display text-5xl leading-none select-none" style={{ color: `${BRONZE}99` }} aria-hidden="true">“</span>
                    <p className="font-display italic text-lg leading-snug pt-2" style={{ color: INK }}>
                      Behind every data point is a real student working toward a better future from Payatas, Manila.
                    </p>
                  </div>

                  {/* Scholars in action — community & activity photos */}
                  <div className="lg:col-span-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-1">
                    {extraPhotos.map(p => (
                      <div
                        key={p.key}
                        className="zoom lift relative overflow-hidden rounded-[18px] h-[130px] sm:h-[150px]"
                        style={{ border: `1px solid ${BORDER}`, background: MAROON_DEEP }}
                      >
                        <PhotoFill
                          src={p.src}
                          failed={!!failedExtra[p.key]}
                          onFail={() => failExtra(p.key)}
                          alt={p.alt}
                          position="center 40%"
                          fallback={fallbackGradient}
                        />
                        <div className="absolute inset-x-0 bottom-0 h-3/5 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(36,21,18,0.8), transparent)' }} />
                        <p className="absolute bottom-2.5 left-3 right-3 font-display font-semibold text-[13px] text-white leading-tight">{isTagalog ? TAGALOG_COPY.photoCaptions[extraPhotos.indexOf(p)] : p.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer
        className="relative"
        style={{ background: `linear-gradient(90deg, ${MAROON_DEEP} 0%, ${MAROON} 55%, ${MAROON_DEEP} 100%)` }}
      >
        {/* cream → maroon organic wave with a bronze line */}
        <svg
          className="absolute left-0 top-0 w-full h-10 sm:h-14 pointer-events-none"
          viewBox="0 0 1600 60"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0,34 C300,4 600,56 900,30 C1200,8 1400,46 1600,20 L1600,0 L0,0 Z" fill="#EAD9C2" />
          <path d="M0,26 C300,-4 600,46 900,22 C1200,2 1400,36 1600,10 L1600,0 L0,0 Z" fill={CREAM} />
          <path d="M0,30 C300,0 600,51 900,26 C1200,5 1400,41 1600,15" fill="none" stroke={BRONZE} strokeWidth="1.4" opacity="0.9" vectorEffect="non-scaling-stroke" />
        </svg>

        <div
          className={`${WRAP} relative pt-12 sm:pt-16 pb-6 flex flex-col lg:flex-row lg:justify-between items-start lg:items-center gap-6`}
          style={{ color: 'rgba(247,244,238,0.85)' }}
        >
          {/* Logo + copyright */}
          <div className="flex items-center gap-4">
            <div className="rounded-xl px-2.5 py-1.5 flex-shrink-0" style={{ background: SURFACE }}>
              <img src={appleLogo} alt="Apple Scholar" className="h-9 w-auto" style={{ objectFit: 'contain' }} />
            </div>
            <div className="text-[12px] leading-relaxed">
              <p>{isTagalog ? '© 2026 Kalinga Foundation. Nakalaan ang lahat ng karapatan.' : '© 2026 Kalinga Foundation. All rights reserved.'}</p>
              <p>Apple Scholar Program · {isTagalog ? TAGALOG_COPY.footerDescription : 'Scholarship Compliance Tracking System'} · 2026</p>
            </div>
          </div>

          {/* Legal + language */}
          <div className="flex flex-wrap items-center lg:justify-end gap-x-4 gap-y-3 text-[12px]">
            <div className="flex items-center gap-3">
              {(isTagalog ? TAGALOG_COPY.legalLinks : ['Privacy Policy', 'Terms of Use', 'Contact Us']).map((t, i) => (
                <Fragment key={t}>
                  {i > 0 && <span aria-hidden="true" style={{ opacity: 0.4 }}>|</span>}
                  <a href="#" onClick={e => e.preventDefault()} className="hover:underline">{t}</a>
                </Fragment>
              ))}
            </div>
            <label
              className="flex items-center gap-2 rounded-full px-3.5 h-9 text-[13px]"
              style={{ border: '1px solid rgba(247,244,238,0.35)', color: CREAM }}
            >
              <Globe size={14} />
              <span className="sr-only">Language / Wika</span>
              <select
                value={language}
                onChange={changeLanguage}
                aria-label="Language / Wika"
                className="bg-transparent text-inherit outline-none cursor-pointer"
                style={{ color: CREAM, colorScheme: 'dark' }}
              >
                <option value="en">English</option>
                <option value="tl">Tagalog</option>
              </select>
              <ChevronDown size={14} aria-hidden="true" />
            </label>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;