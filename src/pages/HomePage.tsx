import { Suspense, lazy, useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  TreePine, Leaf, Coins, ArrowRight, Shield, Zap,
  Globe, TrendingUp, Users, Award, CheckCircle,
  ExternalLink, ChevronLeft, ChevronRight, MapPin, Flame,
} from 'lucide-react';
import EcosystemJourney from '../components/home/EcosystemJourney';
import IncomeCalculator from '../components/home/IncomeCalculator';
import { OXY_MAX_SUPPLY, STAKING_REWARD_RATE_BPS } from '../lib/constants';
import { useHomeStats } from '../hooks/useHomeStats';
import { useI18n } from '../lib/i18n';

const EcoHologram = lazy(() => import('../components/home/EcoHologram'));

import img1 from '../assets/images/gallery/1.png';
import img2 from '../assets/images/gallery/2.png';
import img3 from '../assets/images/gallery/3.png';

const GALLERY = [
  { src: img1, location: 'Pesisir Mangrove, Sulawesi', date: 'Mar 2026', caption: 'Komunitas Oryxon menanam 200 bibit mangrove di kawasan pesisir yang terdegradasi.' },
  { src: img2, location: 'Hutan Bakau, Kalimantan', date: 'Apr 2026', caption: 'Program penanaman tahap 2 — setiap OxyTree yang terjual mendanai satu bibit nyata.' },
  { src: img3, location: 'Pantai Timur, Sulawesi', date: 'Mei 2026', caption: 'Relawan Oryxon bersama mitra lingkungan memperluas hutan bakau sepanjang 3 km.' },
];

function PlantingGallery({ visible }: { visible: boolean }) {
  const { t } = useI18n();

  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const galleryRef = useRef<HTMLDivElement>(null);

  const SLIDE_DURATION = 5000;

  const goTo = useCallback(
    (index: number, dir: 'next' | 'prev') => {
      setDirection(dir);
      setActive(index);
      setProgress(0);
    },
    []
  );

  const nextSlide = useCallback(() => {
    goTo((active + 1) % GALLERY.length, 'next');
  }, [active, goTo]);

  const prevSlide = useCallback(() => {
    goTo(
      (active - 1 + GALLERY.length) % GALLERY.length,
      'prev'
    );
  }, [active, goTo]);

  /*
   * Auto slide
   */
  useEffect(() => {
    if (isPaused) return;

    timerRef.current = setInterval(() => {
      setActive((current) => (current + 1) % GALLERY.length);
      setDirection('next');
      setProgress(0);
    }, SLIDE_DURATION);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPaused]);

  /*
   * Progress bar
   */
  useEffect(() => {
    if (isPaused) return;

    setProgress(0);

    const start = Date.now();

    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const percentage = Math.min(
        (elapsed / SLIDE_DURATION) * 100,
        100
      );

      setProgress(percentage);
    }, 40);

    return () => {
      if (progressRef.current) {
        clearInterval(progressRef.current);
      }
    };
  }, [active, isPaused]);

  /*
   * Mouse parallax
   */
  const handleMouseMove = (
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();

    const x =
      ((e.clientX - rect.left) / rect.width - 0.5) * 2;

    const y =
      ((e.clientY - rect.top) / rect.height - 0.5) * 2;

    setMouse({
      x: x * 6,
      y: y * 6,
    });
  };

  const handleMouseLeave = () => {
    setMouse({ x: 0, y: 0 });
    setIsPaused(false);
  };

  const handleMouseEnter = () => {
    setIsPaused(true);
  };

  const { src, location, date, caption } =
    GALLERY[active];

  return (
    <div
      ref={galleryRef}
      className="relative w-full max-w-[480px] lg:ml-auto"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible
          ? 'translateX(0) scale(1)'
          : 'translateX(40px) scale(0.96)',
        transition:
          'opacity 0.9s ease, transform 1s cubic-bezier(0.22,1,0.36,1)',
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >

      {/* Ambient glow */}
      <div
        className="
          absolute -inset-8
          rounded-[40px]
          bg-emerald-500/[0.08]
          blur-3xl
          pointer-events-none
        "
      />

      {/* Secondary glow */}
      <div
        className="
          absolute -bottom-10
          left-1/2
          -translate-x-1/2
          w-3/4
          h-20
          bg-green-400/[0.12]
          blur-3xl
          pointer-events-none
        "
      />

      {/* Gallery frame */}
      <div
        className="
          relative
          overflow-hidden
          rounded-[26px]
          border border-white/[0.10]
          bg-black
          shadow-[0_30px_80px_rgba(0,0,0,0.45)]
        "
        style={{
          aspectRatio: '4 / 3',
          transform: `
            perspective(1200px)
            rotateX(${-mouse.y * 0.35}deg)
            rotateY(${mouse.x * 0.35}deg)
          `,
          transition:
            'transform 0.25s cubic-bezier(0.22,1,0.36,1)',
        }}
      >

        {/* Image */}
        <div className="absolute inset-0 overflow-hidden">

          <img
            key={`${active}-${direction}`}
            src={src}
            alt={location}
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              animation:
                direction === 'next'
                  ? 'cinematic-slide-next 0.9s cubic-bezier(0.22,1,0.36,1) both'
                  : 'cinematic-slide-prev 0.9s cubic-bezier(0.22,1,0.36,1) both',
            }}
          />

          {/* Ken Burns */}
          <div
            key={`zoom-${active}`}
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url(${src})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              animation:
                'cinematic-kenburns 5s ease-out both',
              opacity: 0.22,
              mixBlendMode: 'screen',
            }}
          />

        </div>

        {/* Cinematic dark gradient */}
        <div
          className="
            absolute inset-0
            bg-gradient-to-t
            from-black/90
            via-black/15
            to-black/20
            pointer-events-none
          "
        />

        {/* Top cinematic vignette */}
        <div
          className="
            absolute inset-x-0 top-0
            h-32
            bg-gradient-to-b
            from-black/50
            to-transparent
            pointer-events-none
          "
        />

        {/* Scan light */}
        <div
          className="
            absolute inset-y-0
            -left-[30%]
            w-[20%]
            bg-gradient-to-r
            from-transparent
            via-white/[0.08]
            to-transparent
            skew-x-[-15deg]
            pointer-events-none
          "
          style={{
            animation:
              'gallery-light-sweep 6s ease-in-out infinite',
          }}
        />

        {/* REAL PLANTING badge */}
        <div
          className="
            absolute
            top-4
            left-4
            flex
            items-center
            gap-2
            px-3
            py-1.5
            rounded-full
            bg-black/45
            backdrop-blur-xl
            border border-green-400/20
            shadow-lg
          "
        >
          <span
            className="
              w-1.5
              h-1.5
              rounded-full
              bg-green-400
              shadow-[0_0_8px_rgba(74,222,128,0.9)]
            "
            style={{
              animation:
                'gallery-pulse 1.8s ease-in-out infinite',
            }}
          />

          <span className="
            text-[10px]
            font-bold
            uppercase
            tracking-[0.16em]
            text-green-300
          ">
            {t('home.gallery.realPlanting')}
          </span>
        </div>

        {/* Counter */}
        <div
          className="
            absolute
            top-4
            right-4
            px-3
            py-1.5
            rounded-full
            bg-black/45
            backdrop-blur-xl
            border border-white/10
          "
        >
          <span className="
            text-[10px]
            font-bold
            tracking-wider
            text-white/70
            tabular-nums
          ">
            {String(active + 1).padStart(2, '0')}
            <span className="mx-1 text-white/20">/</span>
            {String(GALLERY.length).padStart(2, '0')}
          </span>
        </div>

        {/* Center play/live indicator */}
        <div
          className="
            absolute
            top-1/2
            left-1/2
            -translate-x-1/2
            -translate-y-1/2
            pointer-events-none
          "
        >
          <div
            className="
              w-14
              h-14
              rounded-full
              border
              border-white/10
              bg-black/10
              backdrop-blur-[2px]
            "
          />
        </div>

        {/* Bottom content */}
        <div
          className="
            absolute
            left-0
            right-0
            bottom-0
            p-5
            sm:p-6
          "
        >

          {/* Location */}
          <div
            key={`location-${active}`}
            style={{
              animation:
                'gallery-content-in 0.7s 0.15s both',
            }}
          >
            <div className="
              flex
              items-center
              gap-2
              mb-2
            ">
              <MapPin
                className="
                  w-3.5
                  h-3.5
                  text-emerald-400
                "
              />

              <span className="
                text-xs
                font-bold
                text-emerald-300
              ">
                {location}
              </span>

              <span className="
                ml-auto
                text-[10px]
                text-white/45
              ">
                {date}
              </span>
            </div>

            {/* Caption */}
            <p className="
              max-w-[390px]
              text-sm
              sm:text-[15px]
              leading-relaxed
              text-white/80
              line-clamp-3
            ">
              {caption}
            </p>
          </div>

          {/* Progress + indicators */}
          <div className="
            flex
            items-center
            gap-3
            mt-5
          ">

            <div className="
              flex-1
              h-[2px]
              rounded-full
              bg-white/15
              overflow-hidden
            ">
              <div
                className="
                  h-full
                  rounded-full
                  bg-gradient-to-r
                  from-green-400
                  via-emerald-400
                  to-teal-300
                "
                style={{
                  width: `${progress}%`,
                  boxShadow:
                    '0 0 10px rgba(52,211,153,0.8)',
                }}
              />
            </div>

            <div className="
              flex
              items-center
              gap-1.5
            ">
              {GALLERY.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Go to slide ${i + 1}`}
                  onClick={() => {
                    setDirection(
                      i > active ? 'next' : 'prev'
                    );
                    setActive(i);
                  }}
                  className="
                    h-1.5
                    rounded-full
                    transition-all
                    duration-500
                  "
                  style={{
                    width: i === active ? 22 : 5,
                    background:
                      i === active
                        ? '#22c55e'
                        : 'rgba(255,255,255,0.25)',
                    boxShadow:
                      i === active
                        ? '0 0 8px rgba(34,197,94,0.7)'
                        : 'none',
                  }}
                />
              ))}
            </div>

          </div>
        </div>

        {/* Previous */}
        <button
          onClick={prevSlide}
          aria-label="Previous planting"
          className="
            absolute
            left-3
            top-1/2
            -translate-y-1/2
            w-9
            h-9
            rounded-full
            flex
            items-center
            justify-center
            bg-black/40
            backdrop-blur-xl
            border border-white/10
            text-white/80
            hover:bg-black/70
            hover:text-white
            hover:border-green-400/30
            hover:scale-110
            transition-all
            duration-300
          "
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Next */}
        <button
          onClick={nextSlide}
          aria-label="Next planting"
          className="
            absolute
            right-3
            top-1/2
            -translate-y-1/2
            w-9
            h-9
            rounded-full
            flex
            items-center
            justify-center
            bg-black/40
            backdrop-blur-xl
            border border-white/10
            text-white/80
            hover:bg-black/70
            hover:text-white
            hover:border-green-400/30
            hover:scale-110
            transition-all
            duration-300
          "
        >
          <ChevronRight className="w-4 h-4" />
        </button>

      </div>

      {/* Floating metadata */}
      <div
        className="
          absolute
          -bottom-5
          -left-5
          hidden
          sm:flex
          items-center
          gap-2
          px-4
          py-2.5
          rounded-xl
          bg-[#07150d]/90
          backdrop-blur-xl
          border border-green-500/15
          shadow-xl
        "
      >
        <TreePine className="
          w-4
          h-4
          text-green-400
        " />

        <div>
          <p className="
            text-[9px]
            uppercase
            tracking-widest
            text-white/40
          ">
            Oryxon Impact
          </p>

          <p className="
            text-xs
            font-bold
            text-green-300
          ">
            Real World Planting
          </p>
        </div>
      </div>

    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

// ── Feature card data ─────────────────────────────────────────────────────────

const FEATURES = [
  {
    Icon: Shield,
    titleKey: 'home.f1.title',
    descKey: 'home.f1.desc',
    stat: '100%',
    statLabelKey: 'home.f1.statLabel',
    color: '#22c55e',
    glow: 'rgba(34,197,94,0.18)',
    border: 'rgba(34,197,94,0.25)',
    bg: 'rgba(34,197,94,0.07)',
    pointKeys: ['home.f1.p1', 'home.f1.p2', 'home.f1.p3'],
  },
  {
    Icon: Globe,
    titleKey: 'home.f2.title',
    descKey: 'home.f2.desc',
    stat: '1:1',
    statLabelKey: 'home.f2.statLabel',
    color: '#3b82f6',
    glow: 'rgba(59,130,246,0.18)',
    border: 'rgba(59,130,246,0.25)',
    bg: 'rgba(59,130,246,0.07)',
    pointKeys: ['home.f2.p1', 'home.f2.p2', 'home.f2.p3'],
  },
  {
    Icon: Zap,
    titleKey: 'home.f3.title',
    descKey: 'home.f3.desc',
    stat: '24h',
    statLabelKey: 'home.f3.statLabel',
    color: '#eab308',
    glow: 'rgba(234,179,8,0.18)',
    border: 'rgba(234,179,8,0.25)',
    bg: 'rgba(234,179,8,0.07)',
    pointKeys: ['home.f3.p1', 'home.f3.p2', 'home.f3.p3'],
  },
  {
    Icon: Users,
    titleKey: 'home.f4.title',
    descKey: 'home.f4.desc',
    stat: '100%',
    statLabelKey: 'home.f4.statLabel',
    color: '#f97316',
    glow: 'rgba(249,115,22,0.18)',
    border: 'rgba(249,115,22,0.25)',
    bg: 'rgba(249,115,22,0.07)',
    pointKeys: ['home.f4.p1', 'home.f4.p2', 'home.f4.p3'],
  },
] as const;

// ── Feature card component ────────────────────────────────────────────────────

function FeatureCard({ feature, index, visible }: {
  feature: typeof FEATURES[number];
  index: number;
  visible: boolean;
}) {
  const { t } = useI18n();
  const { Icon, titleKey, descKey, stat, statLabelKey, color, glow, border, bg, pointKeys } = feature;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="group relative rounded-2xl p-6 cursor-default transition-all duration-300"
      style={{
        background: hovered ? bg : 'rgba(255,255,255,0.04)',
        border: `1px solid ${hovered ? border : 'rgba(255,255,255,0.07)'}`,
        boxShadow: hovered
          ? `0 0 28px ${glow}, 0 8px 32px rgba(0,0,0,0.3)`
          : '0 1px 4px rgba(0,0,0,0.2)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.6s ease ${index * 0.1}s, transform 0.6s cubic-bezier(0.22,1,0.36,1) ${index * 0.1}s, background 0.3s, border-color 0.3s, box-shadow 0.3s`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Top row: icon + stat badge */}
      <div className="flex items-start justify-between mb-5">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
          style={{
            background: bg,
            border: `1px solid ${border}`,
            color,
          }}
        >
          <Icon className="w-6 h-6" />
        </div>
        <div
          className="text-right"
          style={{
            opacity: visible ? 1 : 0,
            transition: `opacity 0.6s ${index * 0.1 + 0.3}s`,
          }}
        >
          <p className="text-xl font-display font-extrabold leading-none" style={{ color }}>
            {stat}
          </p>
          <p className="text-[10px] uppercase tracking-wider font-semibold mt-0.5" style={{ color: `${color}99` }}>
            {t(statLabelKey)}
          </p>
        </div>
      </div>

      {/* Text */}
      <h3 className="font-display font-bold text-white text-lg mb-2 leading-snug">{t(titleKey)}</h3>
      <p className="text-sm text-gray-400 leading-relaxed mb-5">{t(descKey)}</p>

      {/* Bullet points */}
      <ul className="space-y-1.5">
        {pointKeys.map((pt) => (
          <li key={pt} className="flex items-center gap-2 text-xs text-gray-400">
            <CheckCircle className="w-3.5 h-3.5 shrink-0" style={{ color }} />
            {t(pt)}
          </li>
        ))}
      </ul>

      {/* Bottom accent line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl transition-opacity duration-300"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          opacity: hovered ? 1 : 0,
        }}
      />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { t } = useI18n();
  const stats = useHomeStats();
  const oxyCircNum = parseFloat(stats.oxyCirculating);

  const featuresRef = useRef<HTMLDivElement>(null);
  const [featuresVisible, setFeaturesVisible] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);
  const [ctaVisible, setCtaVisible] = useState(false);

  useEffect(() => {
    const observers = [
      { ref: featuresRef, fn: setFeaturesVisible },
      { ref: ctaRef, fn: setCtaVisible },
    ].map(({ ref, fn }) => {
      if (!ref.current) return null;
      const obs = new IntersectionObserver(
        ([e]) => { if (e.isIntersecting) fn(true); },
        { threshold: 0.15 },
      );
      obs.observe(ref.current);
      return obs;
    });
    return () => observers.forEach(o => o?.disconnect());
  }, []);

  return (
    <div>
      {/* ── Hero with Hologram ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#020d07] via-[#041a0c] to-[#061f0f] text-white min-h-screen flex items-center">

        {/* Ambient blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-48 h-48 sm:w-80 sm:h-80 lg:w-[500px] lg:h-[500px] bg-green-500/[0.06] rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-36 h-36 sm:w-64 sm:h-64 lg:w-[400px] lg:h-[400px] bg-emerald-400/[0.05] rounded-full blur-3xl" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-500/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/15 to-transparent" />
        </div>

        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-0 items-center min-h-screen py-20 lg:py-0">

            {/* Text column */}
            <div className="relative z-10 flex flex-col justify-center lg:py-32 order-2 lg:order-1">
              <h1 className="text-4xl sm:text-5xl xl:text-6xl font-display font-extrabold leading-[1.08] tracking-tight mb-6">
                <span className="text-white">{t('home.heroLine1')}</span>
                <br />
                <span className="bg-gradient-to-r from-green-300 via-emerald-400 to-teal-300 bg-clip-text text-transparent">
                  {t('home.heroLine2')}
                </span>
                <br />
                <span className="text-white/80">{t('home.heroLine3')}</span>
              </h1>

              {/* APR Badge */}
              <div className="flex items-center gap-3 mb-8 w-fit">
                {/* Main APR pill */}
                <div
                  className="relative flex items-center gap-2.5 px-4 py-2.5 rounded-xl overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, rgba(234,179,8,0.18) 0%, rgba(251,146,60,0.18) 100%)',
                    border: '1px solid rgba(234,179,8,0.4)',
                    boxShadow: '0 0 20px rgba(234,179,8,0.25), 0 0 40px rgba(234,179,8,0.08)',
                  }}
                >
                  {/* Animated shimmer */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%)',
                      animation: 'apr-shimmer 2.8s ease-in-out infinite',
                    }}
                  />
                  <Flame className="w-4 h-4 text-yellow-400 shrink-0" style={{ filter: 'drop-shadow(0 0 6px rgba(234,179,8,0.8))' }} />
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className="text-2xl font-display font-black tabular-nums leading-none"
                      style={{
                        background: 'linear-gradient(135deg, #fde047, #fb923c)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        filter: 'drop-shadow(0 0 8px rgba(234,179,8,0.5))',
                      }}
                    >
                      {(STAKING_REWARD_RATE_BPS / 100 * 365).toFixed(1)}%
                    </span>
                    <span className="text-xs font-bold text-yellow-400/80 uppercase tracking-wider">{t('home.aprLabel')}</span>
                  </div>
                </div>

                {/* Label + link */}
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white/80 leading-tight">{t('home.stakingLabel')}</span>
                  <Link
                    to="/staking"
                    className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors font-medium mt-0.5"
                  >
                    {t('home.startStake')}
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              <p className="text-base sm:text-lg text-green-100/60 leading-relaxed max-w-lg mb-9">
                {t('home.heroDesc')}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-12">
                <Link
                  to="/nft-a"
                  className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold text-base shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:-translate-y-0.5 transition-all duration-200"
                >
                  <Leaf className="w-5 h-5" />
                  {t('home.mintWarriors')}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link
                  to="/oxy"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white/5 border border-white/[0.12] text-white font-semibold text-base hover:bg-white/10 hover:border-white/20 transition-all duration-200"
                >
                  {t('home.exploreOxy')}
                </Link>
              </div>

              {/* Stat cards — MetricCard style */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: t('home.statNftSupply'),   val: `${stats.nftMinted} / ${stats.nftMaxSupply}`, icon: <Award    className="w-4 h-4" />, color: '#eab308', glow: 'rgba(234,179,8,0.18)' },
                  { label: t('home.statTreesMinted'), val: stats.isLoading ? '…' : String(stats.treeMinted), icon: <TreePine className="w-4 h-4" />, color: '#22c55e', glow: 'rgba(34,197,94,0.18)' },
                  { label: t('home.statOxyMax'),     val: formatNumber(OXY_MAX_SUPPLY),                  icon: <Coins    className="w-4 h-4" />, color: '#22d3ee', glow: 'rgba(34,211,238,0.18)' },
                  { label: t('home.statTreesStaked'), val: stats.isLoading ? '…' : String(stats.totalStaked), icon: <Users className="w-4 h-4" />, color: '#f97316', glow: 'rgba(249,115,22,0.18)' },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="relative rounded-xl p-3 text-center backdrop-blur-xl border overflow-hidden hover:scale-[1.03] transition-transform duration-200"
                    style={{
                      background: 'rgba(15,23,20,0.65)',
                      borderColor: `${s.color}25`,
                      boxShadow: `0 0 14px ${s.glow}, inset 0 1px 0 rgba(255,255,255,0.04)`,
                    }}
                  >
                    {/* Glow orb */}
                    <div className="absolute -top-4 -right-4 w-14 h-14 rounded-full blur-2xl opacity-20"
                      style={{ background: s.color }} />
                    {/* Live dot */}
                    <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full"
                      style={{ background: s.color, animation: 'dash-pulse 1.8s ease-in-out infinite', boxShadow: `0 0 5px ${s.color}` }} />
                    <div className="flex justify-center mb-1" style={{ color: s.color }}>{s.icon}</div>
                    <p className="text-base font-display font-bold text-white leading-tight">{s.val}</p>
                    <p className="text-[10px] uppercase tracking-wider font-semibold mt-0.5" style={{ color: `${s.color}99` }}>{s.label}</p>
                    {/* Bottom accent */}
                    <div className="absolute bottom-0 left-0 right-0 h-px"
                      style={{ background: `linear-gradient(90deg, transparent, ${s.color}40, transparent)` }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Hologram column */}
            <div className="relative order-1 lg:order-2 w-full flex items-center justify-center">
              <div className="relative w-full h-[min(50vh,480px)] lg:h-[min(70vh,640px)]">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 sm:w-64 sm:h-64 lg:w-[340px] lg:h-[340px] rounded-full border border-green-500/10 animate-pulse" />
                  <div className="absolute w-56 h-56 sm:w-80 sm:h-80 lg:w-[420px] lg:h-[420px] rounded-full border border-emerald-500/[0.06]" />
                </div>
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none" />
                <Suspense
                  fallback={
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-full border-2 border-green-500/30 border-t-green-400 animate-spin mx-auto mb-3" />
                        <p className="text-xs text-green-400/60">{t('home.gallery.loading')}</p>
                      </div>
                    </div>
                  }
                >
                  <EcoHologram className="absolute inset-0" />
                </Suspense>
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/50 border border-green-500/20 backdrop-blur-sm">
                    <span className="text-base font-bold text-green-300 leading-none">O₂</span>
                    <span className="w-px h-3.5 bg-green-500/25" />
                    <span className="text-xs text-green-400/70">{t('home.gallery.oxygenActive')}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Transition: Hero dark → EcosystemJourney dark ── */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#020d07] to-transparent pointer-events-none" />
      </section>

      {/* ── How It Works ── */}
      <EcosystemJourney />

      {/* ── Income Calculator ── */}
      <IncomeCalculator />

      {/* ── Transition: dark → light ── */}

      {/* ── Why Oryxon ── */}
      <section
        ref={featuresRef}
        className="py-20 sm:py-28 bg-[#030f08] relative overflow-hidden"
      >
        {/* Subtle background grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(34,197,94,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.4) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* Ambient blobs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-green-500/[0.05] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/[0.04] rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          {/* Section header */}
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-white mb-3">
              {t('home.whyTitle')}
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
              {t('home.whyDesc')}
            </p>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f, i) => (
              <FeatureCard key={f.titleKey} feature={f} index={i} visible={featuresVisible} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section
        ref={ctaRef}
        className="relative py-24 sm:py-32 overflow-hidden"
        style={{ background: '#0a1f12' }}
      >
        {/* Animated shimmer gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(34,197,94,0.06) 0%, transparent 50%, rgba(16,185,129,0.05) 100%)',
            animation: 'cta-shimmer 8s ease-in-out infinite alternate',
          }}
        />

        {/* Concentric glow rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[320, 480, 640].map((size) => (
            <div
              key={size}
              className="absolute rounded-full border border-green-500/[0.06]"
              style={{ width: size, height: size }}
            />
          ))}
          <div className="absolute w-64 h-64 bg-green-500/[0.04] rounded-full blur-3xl" />
        </div>

        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-500/30 to-transparent" />

       <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
  <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.9fr] gap-12 lg:gap-16 items-center">

            {/* Left text block */}
            <div className="text-center lg:text-left">
              <h2
                className="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold text-white mb-5 leading-tight"
                style={{
                  opacity: ctaVisible ? 1 : 0,
                  transform: ctaVisible ? 'translateY(0)' : 'translateY(16px)',
                  transition: 'opacity 0.7s ease, transform 0.7s cubic-bezier(0.22,1,0.36,1)',
                }}
              >
                {t('home.ctaTitle1')}{' '}
                <span className="bg-gradient-to-r from-green-300 via-emerald-400 to-teal-300 bg-clip-text text-transparent">
                  {t('home.ctaTitle2')}
                </span>
              </h2>

              <p
                className="text-green-100/60 text-lg mb-8 leading-relaxed"
                style={{
                  opacity: ctaVisible ? 1 : 0,
                  transition: 'opacity 0.7s ease 0.15s',
                }}
              >
                {t('home.ctaDesc')}
              </p>

              {/* CTA buttons */}
              <div
                className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4"
                style={{
                  opacity: ctaVisible ? 1 : 0,
                  transition: 'opacity 0.7s ease 0.25s',
                }}
              >
                {/* Primary — pulsing glow */}
                <Link
                  to="/nft-a"
                  className="group relative inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-bold text-base text-white transition-all duration-300 hover:-translate-y-0.5"
                  style={{
                    background: 'linear-gradient(135deg, #22c55e, #10b981)',
                    boxShadow: '0 0 0 0 rgba(34,197,94,0.5)',
                    animation: 'cta-btn-pulse 2.5s ease-in-out infinite',
                  }}
                >
                  <Leaf className="w-5 h-5" />
                  {t('home.ctaMint')}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>

                {/* Secondary */}
                <Link
                  to="/marketplace"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-base text-green-300 border border-green-500/25 hover:bg-green-500/10 hover:border-green-500/40 transition-all duration-200"
                >
                  {t('home.ctaMarket')}
                  <ExternalLink className="w-4 h-4 opacity-60" />
                </Link>
              </div>
            </div>

            {/* Right — Gallery Slide */}
            <PlantingGallery visible={ctaVisible} />
          </div>
        </div>

        {/* Bottom accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-500/20 to-transparent" />
      </section>
    </div>
  );
}

