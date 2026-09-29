import { useRef, useState, useEffect, useCallback } from 'react';

// ── Particles ─────────────────────────────────────────────────────────────────
const PARTICLES = Array.from({ length: 28 }, (_, i) => {
  const angle = (i / 28) * 360 + Math.random() * 13;
  const radius = 38 + Math.random() * 62;
  return {
    id: i,
    angle,
    radius,
    size: 2 + Math.random() * 4,
    duration: 5 + Math.random() * 9,
    delay: Math.random() * -10,
    opacity: 0.35 + Math.random() * 0.55,
    color: i % 3 === 0 ? '#7FFFD4' : i % 3 === 1 ? '#22C55E' : '#4ADE80',
  };
});

// ── Flowers: now with species, palettes, sizes, bloom timing ──────────────────
type FlowerSpec = {
  x: number;
  delay: number;
  bloomDelay: number;
  petals: number;
  size: number;
  species: 'daisy' | 'tulip' | 'star';
  palette: string[];
  pistil: string;
  stemHeight: number;
  hasLeaf: boolean;
};

const FLOWERS: FlowerSpec[] = [
  { x: 10, delay: 0.0, bloomDelay: 0.1, petals: 6, size: 22, species: 'daisy', palette: ['#60A5FA', '#38BDF8'], pistil: '#FDE68A', stemHeight: 24, hasLeaf: true },
  { x: 21, delay: 0.4, bloomDelay: 0.5, petals: 5, size: 18, species: 'star', palette: ['#7FFFD4', '#22C55E'], pistil: '#FDE68A', stemHeight: 20, hasLeaf: false },
  { x: 32, delay: 0.9, bloomDelay: 0.9, petals: 8, size: 24, species: 'tulip', palette: ['#60A5FA', '#38BDF8'], pistil: '#FDE68A', stemHeight: 27, hasLeaf: true },
  { x: 43, delay: 1.5, bloomDelay: 1.3, petals: 6, size: 19, species: 'daisy', palette: ['#7FFFD4', '#22C55E'], pistil: '#FDE68A', stemHeight: 21, hasLeaf: false },
  { x: 54, delay: 0.6, bloomDelay: 0.3, petals: 7, size: 21, species: 'star', palette: ['#60A5FA', '#38BDF8'], pistil: '#FDE68A', stemHeight: 23, hasLeaf: true },
];

type BirdSpec = {
  orbit: number;
  speed: number;
  height: number;
  size: number;
  color: string;
  glow: string;
  dir: 'cw' | 'ccw';
  tilt: number;   // vertical squash of the flight ellipse (0-1)
  flap: number;   // wing-flap duration in seconds
};

const BIRDS: BirdSpec[] = [
  { orbit: 75,  speed: 4.5, height: 34, size: 21, color: '#7FFFD4', glow: '#7FFFD4', dir: 'cw',  tilt: 0.42, flap: 0.18 },
 ];

// ── Helper: inline keyframes injected once ────────────────────────────────────
const STYLE_ID = 'eco-hologram-styles';
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = `
    @keyframes eco-float-up {
      0%   { transform: translateY(0) scale(1); opacity: var(--op); }
      80%  { opacity: var(--op); }
      100% { transform: translateY(-180px) scale(0.4); opacity: 0; }
    }
    @keyframes eco-pulse-ring {
      0%   { transform: scale(1); opacity: 0.55; }
      50%  { transform: scale(1.06); opacity: 0.25; }
      100% { transform: scale(1); opacity: 0.55; }
    }
    @keyframes eco-spin-cw  { to { transform: rotate(360deg);  } }
    @keyframes eco-spin-ccw { to { transform: rotate(-360deg); } }
    @keyframes eco-core-rotate {
      0%   { transform: rotateY(0deg)   rotateX(0deg); }
      25%  { transform: rotateY(90deg)  rotateX(10deg); }
      50%  { transform: rotateY(180deg) rotateX(0deg); }
      75%  { transform: rotateY(270deg) rotateX(-10deg); }
      100% { transform: rotateY(360deg) rotateX(0deg); }
    }
    @keyframes eco-glow-pulse {
      0%, 100% { opacity: 0.15; transform: scale(1);    }
      50%       { opacity: 0.32; transform: scale(1.12); }
    }
    @keyframes eco-sway {
      0%, 100% { transform: rotate(-6deg); }
      50%       { transform: rotate(6deg);  }
    }
    @keyframes eco-bird-flap {
      0%, 100% { transform: scaleY(1);  }
      50%       { transform: scaleY(-0.4); }
    }
    @keyframes eco-orbit {
      to { transform: rotate(360deg); }
    }
    @keyframes eco-orbit-ccw {
      to { transform: rotate(-360deg); }
    }
    @keyframes eco-grid-pulse {
      0%, 100% { opacity: 0.10; }
      50%       { opacity: 0.22; }
    }
    @keyframes eco-float-bob {
      0%, 100% { transform: translateY(0);   }
      50%       { transform: translateY(-8px); }
    }
    @keyframes eco-sparkle {
      0%, 100% { opacity: 0; transform: scale(0.5); }
      50%       { opacity: 1; transform: scale(1.2); }
    }
    @keyframes eco-bloom {
      0%   { transform: scale(0) rotate(-25deg); opacity: 0; }
      60%  { transform: scale(1.15) rotate(4deg); opacity: 1; }
      100% { transform: scale(1) rotate(0deg); opacity: 1; }
    }
    @keyframes eco-petal-shimmer {
      0%, 100% { filter: brightness(1) saturate(1); }
      50%       { filter: brightness(1.25) saturate(1.15); }
    }
    @keyframes eco-pistil-glow {
      0%, 100% { box-shadow: 0 0 3px currentColor, 0 0 6px currentColor; }
      50%       { box-shadow: 0 0 7px currentColor, 0 0 14px currentColor; }
    }
    @keyframes eco-leaf-wiggle {
      0%, 100% { transform: rotate(-10deg) scaleX(1); }
      50%       { transform: rotate(4deg) scaleX(1.05); }
    }
    @keyframes eco-wing-left {
      0%, 100% { transform: rotate(0deg) scaleY(1); }
      50%       { transform: rotate(28deg) scaleY(0.45); }
    }
    @keyframes eco-wing-right {
      0%, 100% { transform: rotate(0deg) scaleY(1); }
      50%       { transform: rotate(-28deg) scaleY(0.45); }
    }
    @keyframes eco-bird-bob {
      0%, 100% { transform: translateY(0) rotate(-3deg); }
      50%       { transform: translateY(-5px) rotate(3deg); }
    }
    @keyframes eco-trail-fade {
      0%, 100% { opacity: 0.5; }
      50%       { opacity: 0.15; }
    }
  `;
  document.head.appendChild(el);
}

// ── Flower renderer: builds one of three richer flower "species" ──────────────
function Flower({ f, i }: { f: FlowerSpec; i: number }) {
  const [c1, c2] = f.palette;
  const petalAngles = Array.from({ length: f.petals }, (_, k) => (360 / f.petals) * k);

  const renderPetals = (layer: 'outer' | 'inner') => {
    const isOuter = layer === 'outer';
    const scale = isOuter ? 1 : 0.62;
    const offset = isOuter ? 0 : 360 / f.petals / 2;
    const petalW = f.species === 'tulip' ? f.size * 0.32 : f.size * 0.4;
    const petalH = f.species === 'star' ? f.size * 0.62 : f.size * 0.5;
    const radius = (f.size / 2) * (isOuter ? 0.62 : 0.4);
    const borderRadius =
      f.species === 'daisy' ? '50% 50% 50% 50% / 60% 60% 40% 40%' :
      f.species === 'tulip' ? '50% 50% 50% 50% / 80% 80% 20% 20%' :
      '2px 50% 2px 50%'; // star: pointed diamond-ish petals

    return petalAngles.map((deg) => (
      <div
        key={`${layer}-${deg}`}
        className="absolute"
        style={{
          width: petalW * scale,
          height: petalH * scale,
          left: '50%',
          top: '50%',
          marginLeft: -(petalW * scale) / 2,
          marginTop: -(petalH * scale) / 2,
          background: `linear-gradient(180deg, ${isOuter ? c1 : c2} 0%, ${isOuter ? c2 : c1} 100%)`,
          borderRadius,
          transformOrigin: '50% 50%',
          transform: `rotate(${deg + offset}deg) translateY(-${radius}px)`,
          opacity: isOuter ? 0.95 : 0.85,
          boxShadow: `0 0 ${isOuter ? 5 : 3}px ${c1}66`,
          animation: `eco-petal-shimmer ${3 + (i % 4) * 0.3}s ease-in-out infinite`,
          animationDelay: `${f.bloomDelay + (i % 3) * 0.2}s`,
        }}
      />
    ));
  };

  return (
    <div
      className="flex flex-col items-center"
      style={{
        animation: `eco-bloom 0.7s cubic-bezier(0.34,1.56,0.64,1) both, eco-sway ${2.6 + (i % 3) * 0.4}s ease-in-out infinite ${0.7 + f.bloomDelay}s`,
        animationDelay: `${f.bloomDelay}s, ${f.delay}s`,
        transformOrigin: 'bottom center',
      }}
    >
      {/* Bloom head */}
      <div className="relative" style={{ width: f.size, height: f.size }}>
        {/* soft glow behind bloom */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            inset: -f.size * 0.25,
            background: `radial-gradient(circle, ${c1}33 0%, transparent 70%)`,
          }}
        />
        {renderPetals('outer')}
        {renderPetals('inner')}
        {/* Pistil */}
        <div
          className="absolute rounded-full"
          style={{
            width: f.size * 0.26,
            height: f.size * 0.26,
            left: '50%',
            top: '50%',
            marginLeft: -(f.size * 0.13),
            marginTop: -(f.size * 0.13),
            background: `radial-gradient(circle at 35% 30%, #fff9 0%, ${f.pistil} 55%, ${f.pistil} 100%)`,
            color: f.pistil,
            animation: 'eco-pistil-glow 2.4s ease-in-out infinite',
            animationDelay: `${f.bloomDelay}s`,
          }}
        />
      </div>

      {/* Stem + leaf */}
      <div className="relative" style={{ width: 3, height: f.stemHeight }}>
        <div
          style={{
            width: 3,
            height: f.stemHeight,
            background: 'linear-gradient(to bottom, #16a34a, #14532d)',
            borderRadius: 2,
            boxShadow: '0 0 3px rgba(34,197,94,0.4)',
          }}
        />
        {f.hasLeaf && (
          <div
            className="absolute"
            style={{
              width: 12,
              height: 6,
              top: f.stemHeight * 0.4,
              left: i % 2 === 0 ? -10 : 2,
              background: 'linear-gradient(120deg, #22c55e, #15803d)',
              borderRadius: '0 100% 0 100%',
              transform: i % 2 === 0 ? 'scaleX(1)' : 'scaleX(-1)',
              transformOrigin: i % 2 === 0 ? 'right center' : 'left center',
              animation: 'eco-leaf-wiggle 3.2s ease-in-out infinite',
              animationDelay: `${f.delay}s`,
              boxShadow: '0 0 3px rgba(34,197,94,0.35)',
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── Bird renderer: proper wing shape, glow, and a soft light trail ────────────
function Bird({ b, i }: { b: BirdSpec; i: number }) {
  // trailing echoes sit at small fixed angular offsets behind the bird on the
  // same rotating orbit, so they read as a soft comet-like trail in flight.
  const trailAngles = b.dir === 'cw' ? [-7, -14, -21] : [7, 14, 21];

  return (
    <div
      className="absolute"
      style={{
        width: b.orbit * 2,
        height: b.orbit * 2,
        left: '50%',
        top: '50%',
        marginLeft: -b.orbit,
        marginTop: -b.orbit - b.height,
        animation: `${b.dir === 'cw' ? 'eco-orbit' : 'eco-orbit-ccw'} ${b.speed}s linear infinite`,
        animationDelay: `${-b.speed * (i / BIRDS.length)}s`,
        transform: `scaleY(${b.tilt})`,
      }}
    >
      {/* light trail */}
      {trailAngles.map((deg, ti) => (
        <div key={ti} className="absolute inset-0" style={{ transform: `rotate(${deg}deg)` }}>
          <div
            className="absolute rounded-full"
            style={{
              top: 0,
              left: '50%',
              width: b.size * (0.45 - ti * 0.08),
              height: b.size * (0.28 - ti * 0.05),
              marginLeft: -(b.size * (0.45 - ti * 0.08)) / 2,
              background: b.glow,
              filter: 'blur(2px)',
              opacity: 0.28 - ti * 0.08,
              animation: `eco-trail-fade ${1.2 + ti * 0.3}s ease-in-out infinite`,
            }}
          />
        </div>
      ))}

      {/* bird body */}
      <div
        className="absolute"
        style={{
          top: 0,
          left: '50%',
          marginLeft: -b.size / 2,
          animation: `eco-bird-bob ${Math.max(b.speed / 6, 0.5)}s ease-in-out infinite`,
          animationDelay: `${i * 0.15}s`,
        }}
      >
        <svg
          width={b.size}
          height={b.size * 0.6}
          viewBox="0 0 24 14"
          style={{ filter: `drop-shadow(0 0 4px ${b.glow}) drop-shadow(0 0 8px ${b.glow}66)`, display: 'block' }}
        >
          {/* left wing */}
          <path
            d="M12 8 C 9 3, 3 1, 0 4 C 3 6, 8 7.5, 12 8 Z"
            fill={`url(#eco-bird-grad-${i})`}
            style={{ transformBox: 'fill-box', transformOrigin: '100% 50%', animation: `eco-wing-left ${b.flap}s ease-in-out infinite` }}
          />
          {/* right wing */}
          <path
            d="M12 8 C 15 3, 21 1, 24 4 C 21 6, 16 7.5, 12 8 Z"
            fill={`url(#eco-bird-grad-${i})`}
            style={{ transformBox: 'fill-box', transformOrigin: '0% 50%', animation: `eco-wing-right ${b.flap}s ease-in-out infinite` }}
          />
          {/* body */}
          <ellipse cx="12" cy="8.5" rx="2.4" ry="1.4" fill={b.color} opacity={0.95} />
          <defs>
            <linearGradient id={`eco-bird-grad-${i}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity={0.9} />
              <stop offset="45%" stopColor={b.color} />
              <stop offset="100%" stopColor={b.glow} />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function EcoHologram({ className = '' }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [mouseXY, setMouseXY] = useState({ x: 0, y: 0 });

  useEffect(() => { injectStyles(); }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const r = containerRef.current.getBoundingClientRect();
    setMouseXY({
      x: ((e.clientX - r.left) / r.width  - 0.5) * 18,
      y: ((e.clientY - r.top)  / r.height - 0.5) * 10,
    });
  }, []);

  const parallax = hovered ? `translate(${mouseXY.x}px, ${mouseXY.y}px)` : 'translate(0,0)';

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMouseXY({ x: 0, y: 0 }); }}
    >
      {/* ── Background radial glow ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 60% at 50% 55%, rgba(34,197,94,0.12) 0%, rgba(16,185,129,0.06) 40%, transparent 70%)',
          transition: 'opacity 0.6s',
          opacity: hovered ? 1.4 : 1,
        }}
      />

      {/* ── Ground grid ── */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center">
        <div
          className="relative"
          style={{
            width: '88%',
            height: 90,
            background: 'radial-gradient(ellipse 90% 60% at 50% 100%, rgba(34,197,94,0.18) 0%, transparent 70%)',
            borderRadius: '50% 50% 0 0 / 100% 100% 0 0',
            animation: 'eco-grid-pulse 3.5s ease-in-out infinite',
          }}
        >
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0"
              style={{
                bottom: i * 14,
                height: 1,
                background: 'linear-gradient(90deg, transparent 0%, rgba(34,197,94,0.35) 30%, rgba(127,255,212,0.5) 50%, rgba(34,197,94,0.35) 70%, transparent 100%)',
                opacity: 0.4 + i * 0.06,
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Outer energy rings ── */}
      {[
        { size: 320, speed: 28, color: '#836EF9', opacity: 0.12, tilt: 'rotateX(72deg)' },
        { size: 280, speed: 22, color: '#a78bfa', opacity: 0.15, tilt: 'rotateX(60deg) rotateZ(20deg)' },
        { size: 240, speed: 18, color: '#7FFFD4', opacity: 0.10, tilt: 'rotateX(75deg) rotateZ(-15deg)' },
      ].map((ring, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: '50%', top: '44%',
            width: ring.size, height: ring.size,
            marginLeft: -ring.size / 2, marginTop: -ring.size / 2,
            borderRadius: '50%',
            border: `1.5px solid ${ring.color}`,
            opacity: ring.opacity,
            transform: ring.tilt,
            animation: `${i % 2 === 0 ? 'eco-spin-cw' : 'eco-spin-ccw'} ${ring.speed}s linear infinite`,
          }}
        />
      ))}

      {/* ── Parallax wrapper  ── */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ transform: parallax, transition: hovered ? 'transform 0.1s' : 'transform 0.5s ease-out' }}
      >
        {/* Outer glow */}
        <div
          className="absolute rounded-full"
          style={{
            width: hovered ? 240 : 200,
            height: hovered ? 240 : 200,
            background: 'radial-gradient(circle, rgba(131,110,249,0.30) 0%, rgba(34,197,94,0.12) 45%, transparent 70%)',
            animation: 'eco-glow-pulse 2.8s ease-in-out infinite',
            transition: 'width 0.4s, height 0.4s',
          }}
        />

        {/* Monad logo as fruit with stem & leaf */}
        <div className="abs" style={{ width:120, height:150, animation:'eco-float-bob 3.5s ease-in-out infinite' }}>
          <svg viewBox="0 0 24 30" className="w-full h-full" style={{
            filter: hovered
              ? 'drop-shadow(0 0 24px rgba(131,110,249,.7)) drop-shadow(0 0 48px rgba(131,110,249,.35))'
              : 'drop-shadow(0 0 16px rgba(131,110,249,.5)) drop-shadow(0 0 32px rgba(131,110,249,.2))',
            animation:'eco-core-rotate 8s linear infinite',
            transition:'filter .4s',
          }}>
            <defs>
              {/* Clip — confines all sphere layers inside the circle */}
              <clipPath id="fclip">
                <circle cx="12" cy="15" r="9"/>
              </clipPath>

              {/* ── DIFFUSE: main color gradient, light from top-left (8.5,10) ── */}
              <radialGradient id="fBase" cx="8.5" cy="10" r="14" gradientUnits="userSpaceOnUse">
                <stop offset="0%"   stopColor="#c4fdf0"/>
                <stop offset="18%"  stopColor="#4df0c4"/>
                <stop offset="50%"  stopColor="#15b589"/>
                <stop offset="76%"  stopColor="#097360"/>
                <stop offset="100%" stopColor="#043326"/>
              </radialGradient>

              {/* ── PATTERN: inner Monad caustic ── */}
              <linearGradient id="fPat" x1=".2" y1=".1" x2=".8" y2=".9">
                <stop offset="0%"   stopColor="#8afce0" stopOpacity=".92"/>
                <stop offset="48%"  stopColor="#1cc59e"/>
                <stop offset="100%" stopColor="#085c48"/>
              </linearGradient>

              {/* ── AO: ambient occlusion — contact shadow at south pole ── */}
              <radialGradient id="fAO" cx="12" cy="24" r="7" gradientUnits="userSpaceOnUse">
                <stop offset="0%"   stopColor="#000" stopOpacity=".28"/>
                <stop offset="100%" stopColor="#000" stopOpacity="0"/>
              </radialGradient>

              {/* ── SSS: subsurface scattering — translucent inner glow ── */}
              <radialGradient id="fSSS" cx="13" cy="17" r="6.5" gradientUnits="userSpaceOnUse">
                <stop offset="0%"   stopColor="#7fffd4" stopOpacity=".30"/>
                <stop offset="65%"  stopColor="#1dd4a0" stopOpacity=".08"/>
                <stop offset="100%" stopColor="#7fffd4" stopOpacity="0"/>
              </radialGradient>

              {/* ── RIM LIGHT: secondary colored light, bottom-right (18.5,22) ── */}
              <radialGradient id="fRim" cx="18.5" cy="22" r="9" gradientUnits="userSpaceOnUse">
                <stop offset="0%"   stopColor="#c084fc" stopOpacity=".68"/>
                <stop offset="52%"  stopColor="#9b59e8" stopOpacity=".22"/>
                <stop offset="100%" stopColor="#c084fc" stopOpacity="0"/>
              </radialGradient>

              {/* ── SOFT SPEC: wide diffuse highlight lobe ── */}
              <radialGradient id="fSpecSoft" cx="9" cy="11" r="5.5" gradientUnits="userSpaceOnUse">
                <stop offset="0%"   stopColor="#fff" stopOpacity=".38"/>
                <stop offset="100%" stopColor="#fff" stopOpacity="0"/>
              </radialGradient>

              {/* ── HARD SPEC: sharp glossy hotspot — the "glint" ── */}
              <radialGradient id="fSpecHard" cx="8.5" cy="10.5" r="2.2" gradientUnits="userSpaceOnUse">
                <stop offset="0%"   stopColor="#fff" stopOpacity=".97"/>
                <stop offset="30%"  stopColor="#f0fffb" stopOpacity=".72"/>
                <stop offset="100%" stopColor="#fff" stopOpacity="0"/>
              </radialGradient>

              {/* ── FRESNEL: bright edge at sphere boundary (glancing angles) ── */}
              <radialGradient id="fFresnel" cx="12" cy="15" r="9" gradientUnits="userSpaceOnUse">
                <stop offset="0%"   stopColor="#7fffd4" stopOpacity="0"/>
                <stop offset="72%"  stopColor="#7fffd4" stopOpacity="0"/>
                <stop offset="88%"  stopColor="#a7f3d0" stopOpacity=".22"/>
                <stop offset="100%" stopColor="#c4fdf0" stopOpacity=".45"/>
              </radialGradient>

              {/* ── CAST SHADOW beneath fruit ── */}
              <radialGradient id="fShadow" cx=".5" cy=".5" r=".5">
                <stop offset="0%"   stopColor="#000" stopOpacity=".40"/>
                <stop offset="100%" stopColor="#000" stopOpacity="0"/>
              </radialGradient>

              {/* ── STEM: cylindrical side-lit gradient ── */}
              <linearGradient id="fStem" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#14532d"/>
                <stop offset="28%"  stopColor="#22c55e"/>
                <stop offset="58%"  stopColor="#16a34a"/>
                <stop offset="100%" stopColor="#14532d"/>
              </linearGradient>

              {/* ── LEAF ── */}
              <linearGradient id="fLeaf" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%"   stopColor="#a7f3d0"/>
                <stop offset="42%"  stopColor="#4ade80"/>
                <stop offset="100%" stopColor="#15803d"/>
              </linearGradient>
            </defs>

            {/* Contact shadow */}
            <ellipse cx="12.3" cy="25.6" rx="5.8" ry="1.3" fill="url(#fShadow)" opacity=".75"/>

            {/* Stem (cylindrical gradient) */}
            <path d="M12 3 Q12.5 1.5 13.5 1 Q14 .8 14 1.5 L13 4.5 Q12.5 5 12 4.8 Z"
              fill="url(#fStem)"/>

            {/* Leaf body */}
            <path d="M13 2.5 Q17 .5 19.5 2 Q20 2.8 19 3.5 Q16 4.5 13.5 3.8 Q12.8 3.2 13 2.5 Z"
              fill="url(#fLeaf)"
              style={{ transformOrigin:'13px 3px', animation:'eco-leaf-wiggle 3.2s ease-in-out infinite' }}/>
            {/* Leaf shadow vein */}
            <path d="M13.2 3 Q16 2.2 18.5 2.8" stroke="#15803d" strokeWidth=".3" fill="none" opacity=".55"/>
            {/* Leaf highlight vein */}
            <path d="M13.4 2.6 Q15.2 2.1 17.2 2.4" stroke="#a7f3d0" strokeWidth=".18" fill="none" opacity=".7"/>

            {/* ─── SPHERE LAYER STACK ───────────────────────────────── */}

            {/* L1 — Diffuse base */}
            <circle cx="12" cy="15" r="9" fill="url(#fBase)"/>

            {/* L2 — Monad inner caustic pattern */}
            <path clipPath="url(#fclip)"
              d="M12 6c-2.599 0-9 6.4-9 9s6.401 9 9 9s9-6.401 9-9s-6.401-9-9-9m-1.402 14.146c-1.097-.298-4.043-5.453-3.744-6.549s5.453-4.042 6.549-3.743c1.095.298 4.042 5.453 3.743 6.549c-.298 1.095-5.453 4.042-6.549 3.743"
              fill="url(#fPat)" opacity=".82"/>

            {/* L3 — Ambient occlusion */}
            <circle cx="12" cy="15" r="9" fill="url(#fAO)"/>

            {/* L4 — Subsurface scattering */}
            <circle cx="12" cy="15" r="9" fill="url(#fSSS)"/>

            {/* L5 — Rim light */}
            <circle cx="12" cy="15" r="9" fill="url(#fRim)"/>

            {/* L6 — Soft specular lobe */}
            <circle cx="12" cy="15" r="9" fill="url(#fSpecSoft)"/>

            {/* L7 — Hard specular hotspot */}
            <circle cx="12" cy="15" r="9" fill="url(#fSpecHard)"/>

            {/* L8 — Fresnel edge glow */}
            <circle cx="12" cy="15" r="9" fill="url(#fFresnel)"/>

            {/* L9 — Catchlight (micro specular dot) */}
            <ellipse cx="9.1" cy="11" rx=".9" ry=".58"
              fill="white" opacity=".88"
              clipPath="url(#fclip)"
              style={{ animation:'eco-spec-shimmer 3s ease-in-out infinite' }}/>

            {/* L10 — Anisotropic arc (reflected environment highlight) */}
            <path d="M5.8 12.2 Q8.2 10.8 10.2 11.2"
              stroke="white" strokeWidth=".5" fill="none"
              strokeLinecap="round" opacity=".13"
              clipPath="url(#fclip)"/>
          </svg>
        </div>

        {/* Orbital rings */}
        {[
          { size: 150, border: '1.5px solid rgba(131,110,249,0.50)', speed: 6, dir: 'eco-spin-cw' },
          { size: 180, border: '1px solid rgba(167,139,250,0.25)', speed: 9, dir: 'eco-spin-ccw' },
        ].map((r, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: r.size, height: r.size,
              border: r.border,
              animation: `${r.dir} ${r.speed}s linear infinite`,
              transform: `rotateX(${60 + i * 15}deg)`,
            }}
          />
        ))}

        {BIRDS.map((b, i) => (
          <Bird key={i} b={b} i={i} />
        ))}
      </div>

      {/* ── Floating particles ── */}
      {PARTICLES.map(p => {
        const cx = 50 + Math.cos((p.angle * Math.PI) / 180) * (p.radius / 3.5);
        const cy = 50 + Math.sin((p.angle * Math.PI) / 180) * (p.radius / 6);
        return (
          <div
            key={p.id}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: `${cx}%`,
              bottom: `${20 + (cy - 30)}%`,
              width: p.size,
              height: p.size,
              background: p.color,
              boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
              '--op': p.opacity,
              animation: `eco-float-up ${p.duration}s ease-in infinite`,
              animationDelay: `${p.delay}s`,
            } as React.CSSProperties}
          />
        );
      })}

      {/* ── Flowers row (now richer: layered petals, glow, leaves, bloom-in) ── */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-around px-6 pointer-events-none">
        {FLOWERS.map((f, i) => (
          <Flower key={i} f={f} i={i} />
        ))}
      </div>

      {/* ── Sparkle dots scattered ── */}
      {Array.from({ length: 14 }, (_, i) => (
        <div
          key={i}
          className="absolute pointer-events-none"
          style={{
            left: `${8 + (i * 6.5) % 85}%`,
            top: `${12 + (i * 11) % 70}%`,
            width: 3, height: 3,
            borderRadius: '50%',
            background: i % 2 === 0 ? '#7FFFD4' : '#22C55E',
            boxShadow: `0 0 6px ${i % 2 === 0 ? '#7FFFD4' : '#22C55E'}`,
            animation: `eco-sparkle ${1.8 + (i * 0.35) % 2.5}s ease-in-out infinite`,
            animationDelay: `${(i * 0.27) % 3}s`,
          }}
        />
      ))}
    </div>
  );
}
