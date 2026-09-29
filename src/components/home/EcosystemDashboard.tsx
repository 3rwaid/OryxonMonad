import { useEffect, useRef, useState, useMemo } from 'react';
import { Award, TreePine, Coins, TrendingUp } from 'lucide-react';

// ── Animated counter hook ─────────────────────────────────────────────────────

function useAnimatedValue(target: number, duration = 1600, trigger = true) {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!trigger) return;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + (target - from) * eased);
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration, trigger]);

  return value;
}

// ── SVG Radial Progress Ring ──────────────────────────────────────────────────

function RadialProgress({
  value,
  max,
  color,
  size = 100,
  strokeWidth = 6,
}: {
  value: number;
  max: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = max > 0 ? Math.min(value / max, 1) : 0;
  const offset = circumference * (1 - progress);

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={strokeWidth}
      />
      {/* Progress */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{
          transition: 'stroke-dashoffset 1.5s cubic-bezier(0.22, 1, 0.36, 1)',
          filter: `drop-shadow(0 0 6px ${color})`,
        }}
      />
    </svg>
  );
}

// ── Token orbit particles ─────────────────────────────────────────────────────

function TokenOrbit({ color }: { color: string }) {
  const particles = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      delay: i * 0.5,
      size: 3 + Math.random() * 3,
      radius: 38 + Math.random() * 8,
      speed: 3 + Math.random() * 1.5,
    })), []);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute top-1/2 left-1/2 rounded-full"
          style={{
            width: p.size,
            height: p.size,
            background: color,
            boxShadow: `0 0 6px ${color}`,
            animation: `dash-orbit ${p.speed}s linear ${p.delay}s infinite`,
            transformOrigin: `-${p.radius}px 0`,
            marginLeft: p.radius,
          }}
        />
      ))}
    </div>
  );
}

// ── Mini forest visualization ─────────────────────────────────────────────────

function ForestViz({ count }: { count: number }) {
  const trees = useMemo(() => {
    const items = [];
    const display = Math.min(count, 20);
    for (let i = 0; i < display; i++) {
      items.push({
        x: 10 + (i % 5) * 20 + (Math.random() * 8 - 4),
        height: 12 + Math.random() * 14,
        delay: i * 0.12,
        shade: 0.5 + Math.random() * 0.5,
      });
    }
    return items;
  }, [count]);

  return (
    <div className="absolute bottom-2 left-3 right-3 h-10 pointer-events-none overflow-hidden">
      {trees.map((t, i) => (
        <div
          key={i}
          className="absolute bottom-0"
          style={{
            left: `${t.x}%`,
            width: 4,
            height: t.height,
            background: `rgba(34, 197, 94, ${t.shade})`,
            borderRadius: '2px 2px 0 0',
            animation: `dash-tree-grow 0.6s ease-out ${t.delay}s both`,
            boxShadow: '0 0 4px rgba(34, 197, 94, 0.3)',
          }}
        />
      ))}
    </div>
  );
}

// ── World map background ──────────────────────────────────────────────────────

function WorldMapBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
      {/* Simplified world map dots */}
      <svg
        viewBox="0 0 800 400"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Continents as dot clusters */}
        <g fill="rgba(16,185,129,0.3)" className="animate-pulse">
          {/* North America */}
          <circle cx="180" cy="120" r="2.5" />
          <circle cx="195" cy="110" r="2" />
          <circle cx="170" cy="130" r="2" />
          <circle cx="200" cy="125" r="2.5" />
          <circle cx="185" cy="140" r="2" />
          <circle cx="160" cy="115" r="1.5" />
          <circle cx="210" cy="135" r="2" />
          <circle cx="175" cy="105" r="1.5" />
          {/* South America */}
          <circle cx="250" cy="230" r="2.5" />
          <circle cx="260" cy="250" r="2" />
          <circle cx="245" cy="270" r="2.5" />
          <circle cx="255" cy="210" r="2" />
          <circle cx="240" cy="240" r="1.5" />
          {/* Europe */}
          <circle cx="400" cy="100" r="2" />
          <circle cx="415" cy="95" r="2" />
          <circle cx="390" cy="110" r="2.5" />
          <circle cx="420" cy="105" r="1.5" />
          <circle cx="405" cy="115" r="2" />
          {/* Africa */}
          <circle cx="410" cy="190" r="2.5" />
          <circle cx="420" cy="210" r="2" />
          <circle cx="400" cy="200" r="2" />
          <circle cx="415" cy="230" r="2.5" />
          <circle cx="425" cy="175" r="1.5" />
          {/* Asia */}
          <circle cx="530" cy="110" r="2.5" />
          <circle cx="560" cy="100" r="2" />
          <circle cx="580" cy="120" r="2.5" />
          <circle cx="550" cy="130" r="2" />
          <circle cx="600" cy="115" r="2" />
          <circle cx="520" cy="125" r="1.5" />
          <circle cx="570" cy="140" r="2" />
          {/* Australia */}
          <circle cx="620" cy="270" r="2" />
          <circle cx="640" cy="260" r="2.5" />
          <circle cx="630" cy="280" r="2" />
          <circle cx="650" cy="275" r="1.5" />
        </g>

        {/* Oxygen flow streams */}
        <g stroke="rgba(16,185,129,0.15)" strokeWidth="1" fill="none">
          <path d="M200,130 C300,100 350,150 400,110" className="dash-flow-path" />
          <path d="M410,190 C450,150 500,160 550,120" className="dash-flow-path" />
          <path d="M260,240 C300,200 370,190 410,180" className="dash-flow-path" />
          <path d="M580,120 C590,200 620,240 635,265" className="dash-flow-path" />
        </g>

        {/* Flowing particles on streams */}
        {[
          { path: 'M200,130 C300,100 350,150 400,110', delay: 0 },
          { path: 'M410,190 C450,150 500,160 550,120', delay: 1.5 },
          { path: 'M260,240 C300,200 370,190 410,180', delay: 3 },
          { path: 'M580,120 C590,200 620,240 635,265', delay: 4.5 },
        ].map((stream, i) => (
          <circle key={i} r="3" fill="rgba(52,211,153,0.5)">
            <animateMotion
              dur="5s"
              begin={`${stream.delay}s`}
              repeatCount="indefinite"
              path={stream.path}
            />
          </circle>
        ))}
      </svg>

      {/* Floating ambient particles */}
      {Array.from({ length: 14 }, (_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-emerald-400/30"
          style={{
            left: `${8 + Math.random() * 84}%`,
            top: `${10 + Math.random() * 80}%`,
            animation: `dash-ambient-particle 4s ease-in-out ${i * 0.35}s infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}

// ── Individual metric card ────────────────────────────────────────────────────

function MetricCard({
  type,
  icon: Icon,
  label,
  value,
  max,
  subtext,
  color,
  glowColor,
  visible,
  delay,
}: {
  type: 'radial' | 'token' | 'tree' | 'forest';
  icon: typeof Award;
  label: string;
  value: number;
  max?: number;
  subtext?: string;
  color: string;
  glowColor: string;
  visible: boolean;
  delay: number;
}) {
  const animatedVal = useAnimatedValue(value, 1800, visible);

  const formatVal = (v: number) => {
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return Math.round(v).toLocaleString();
  };

  return (
    <div
      className="relative group"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
        transition: `all 0.7s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s`,
      }}
    >
      {/* Glass card */}
      <div
        className="relative rounded-2xl p-6 h-full overflow-hidden backdrop-blur-xl border transition-all duration-400 hover:scale-[1.02]"
        style={{
          background: 'rgba(15, 23, 20, 0.65)',
          borderColor: `${color}25`,
          boxShadow: `0 0 20px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.05)`,
        }}
      >
        {/* Glow orb behind card */}
        <div
          className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-35 transition-opacity"
          style={{ background: color }}
        />

        {/* Pulse indicator */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: color,
              animation: 'dash-pulse 1.8s ease-in-out infinite',
              boxShadow: `0 0 6px ${color}`,
            }}
          />
          <span className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold">Live</span>
        </div>

        {/* Visualization area */}
        <div className="relative w-full flex justify-center mb-4">
          {type === 'radial' && max && (
            <div className="relative">
              <RadialProgress value={animatedVal} max={max} color={color} size={90} strokeWidth={5} />
              <div className="absolute inset-0 flex items-center justify-center">
                <Icon className="w-6 h-6" style={{ color }} />
              </div>
            </div>
          )}
          {type === 'token' && (
            <div className="relative w-[90px] h-[90px] flex items-center justify-center">
              <TokenOrbit color={color} />
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center border"
                style={{
                  borderColor: `${color}50`,
                  background: `${color}15`,
                  boxShadow: `0 0 16px ${glowColor}`,
                }}
              >
                <Icon className="w-6 h-6" style={{ color }} />
              </div>
            </div>
          )}
          {type === 'tree' && (
            <div className="relative w-[90px] h-[90px] flex items-center justify-center">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{
                  background: `${color}15`,
                  border: `1px solid ${color}30`,
                  animation: visible ? 'dash-tree-icon-grow 0.8s ease-out 0.4s both' : 'none',
                }}
              >
                <Icon className="w-7 h-7" style={{ color }} />
              </div>
              {/* Branch dots */}
              {[0, 1, 2].map((b) => (
                <div
                  key={b}
                  className="absolute rounded-full"
                  style={{
                    width: 5,
                    height: 5,
                    background: color,
                    opacity: visible ? 0.6 : 0,
                    top: `${20 + b * 18}%`,
                    left: `${55 + b * 12}%`,
                    transition: `opacity 0.5s ${0.6 + b * 0.2}s`,
                    boxShadow: `0 0 4px ${color}`,
                  }}
                />
              ))}
            </div>
          )}
          {type === 'forest' && (
            <div className="relative w-[90px] h-[90px] flex items-center justify-center">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{
                  background: `${color}15`,
                  border: `1px solid ${color}30`,
                }}
              >
                <Icon className="w-7 h-7" style={{ color }} />
              </div>
              <ForestViz count={Math.round(animatedVal)} />
            </div>
          )}
        </div>

        {/* Label */}
        <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1">{label}</p>

        {/* Animated counter */}
        <div className="flex items-baseline gap-2">
          <span
            className="text-2xl sm:text-3xl font-display font-bold tabular-nums"
            style={{ color }}
          >
            {formatVal(animatedVal)}
          </span>
          {max && (
            <span className="text-sm text-gray-500 font-medium">
              / {formatVal(max)}
            </span>
          )}
        </div>

        {subtext && (
          <p className="text-xs text-gray-500 mt-1">{subtext}</p>
        )}

        {/* Bottom accent line */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${color}40, transparent)`,
          }}
        />
      </div>
    </div>
  );
}

// ── Main dashboard section ────────────────────────────────────────────────────

interface DashboardProps {
  nftMinted: number;
  nftMaxSupply: number;
  treeMinted: number;
  oxyCirculating: number;
  oxyMax: number;
  totalStaked: number;
  isLoading: boolean;
}

export default function EcosystemDashboard({
  nftMinted,
  nftMaxSupply,
  treeMinted,
  oxyCirculating,
  oxyMax,
  totalStaked,
  isLoading,
}: DashboardProps) {
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 },
    );
    obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="py-20 sm:py-28 relative overflow-hidden bg-[#030f08]"
    >
      <WorldMapBackground />

      {/* Radial gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#030f08_80%)] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        {/* Section header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-5">
            <div
              className="w-1.5 h-1.5 rounded-full bg-emerald-400"
              style={{ animation: 'dash-pulse 1.6s ease-in-out infinite' }}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              Real-Time Analytics
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-white mb-3">
            Ecosystem Command Center
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Live metrics tracking global impact of the Oryxon network
          </p>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <MetricCard
            type="radial"
            icon={Award}
            label="Oryx Warriors Minted"
            value={isLoading ? 0 : nftMinted}
            max={nftMaxSupply}
            color="#eab308"
            glowColor="rgba(234,179,8,0.15)"
            visible={visible && !isLoading}
            delay={0}
          />
          <MetricCard
            type="tree"
            icon={TreePine}
            label="OxyTrees Minted"
            value={isLoading ? 0 : treeMinted}
            color="#22c55e"
            glowColor="rgba(34,197,94,0.15)"
            visible={visible && !isLoading}
            delay={0.12}
          />
          <MetricCard
            type="token"
            icon={Coins}
            label="$OXY Circulating"
            value={isLoading ? 0 : oxyCirculating}
            max={oxyMax}
            subtext={`of ${oxyMax >= 1e9 ? `${(oxyMax / 1e9).toFixed(1)}B` : oxyMax.toLocaleString()} max`}
            color="#22d3ee"
            glowColor="rgba(34,211,238,0.15)"
            visible={visible && !isLoading}
            delay={0.24}
          />
          <MetricCard
            type="forest"
            icon={TrendingUp}
            label="Trees Staked"
            value={isLoading ? 0 : totalStaked}
            subtext="in staking pool"
            color="#f97316"
            glowColor="rgba(249,115,22,0.15)"
            visible={visible && !isLoading}
            delay={0.36}
          />
        </div>
      </div>
    </section>
  );
}
