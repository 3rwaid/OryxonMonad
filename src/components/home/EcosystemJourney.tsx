import { useEffect, useRef, useState, useCallback } from 'react';
import { Award, TreeDeciduous, Coins, TrendingUp } from 'lucide-react';
import SectionHeading from '../shared/SectionHeading';
import { useI18n } from '../../lib/i18n';

// ── Step definitions ──────────────────────────────────────────────────────────

const STEP_CONFIG = [
  {
    Icon: Award,
    step: 1,
    titleKey: 'hiw.s1.title',
    descKey: 'hiw.s1.desc',
    accent: '#eab308',
    glow: 'rgba(234,179,8,0.32)',
    border: 'rgba(234,179,8,0.38)',
    iconGrad: 'from-yellow-500 to-amber-600',
    particleColor: '#eab308',
  },
  {
    Icon: TreeDeciduous,
    step: 2,
    titleKey: 'hiw.s2.title',
    descKey: 'hiw.s2.desc',
    accent: '#22c55e',
    glow: 'rgba(34,197,94,0.32)',
    border: 'rgba(34,197,94,0.38)',
    iconGrad: 'from-green-400 to-emerald-600',
    particleColor: '#22c55e',
  },
  {
    Icon: Coins,
    step: 3,
    titleKey: 'hiw.s3.title',
    descKey: 'hiw.s3.desc',
    accent: '#22d3ee',
    glow: 'rgba(34,211,238,0.32)',
    border: 'rgba(34,211,238,0.38)',
    iconGrad: 'from-cyan-400 to-sky-600',
    particleColor: '#22d3ee',
  },
  {
    Icon: TrendingUp,
    step: 4,
    titleKey: 'hiw.s4.title',
    descKey: 'hiw.s4.desc',
    accent: '#f97316',
    glow: 'rgba(249,115,22,0.32)',
    border: 'rgba(249,115,22,0.38)',
    iconGrad: 'from-orange-400 to-rose-500',
    particleColor: '#f97316',
  },
] as const;

// ── O₂ molecules (step 3 special effect) ─────────────────────────────────────

function O2Molecules() {
  const molecules = [
    { dx: -14, delay: 0,   duration: 2.2 },
    { dx: 10,  delay: 0.6, duration: 2.6 },
    { dx: -6,  delay: 1.1, duration: 2.0 },
    { dx: 18,  delay: 1.7, duration: 2.4 },
    { dx: -22, delay: 2.2, duration: 2.8 },
    { dx: 4,   delay: 0.4, duration: 1.9 },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
      {molecules.map((m, i) => (
        <span
          key={i}
          className="absolute bottom-4 left-1/2 text-[9px] font-bold text-cyan-300/80 select-none"
          style={{
            '--eco-dx': `${m.dx}px`,
            animation: `eco-o2-rise ${m.duration}s ease-out ${m.delay}s infinite`,
          } as React.CSSProperties}
        >
          O₂
        </span>
      ))}
    </div>
  );
}

// ── Network effect (step 4 special effect) ───────────────────────────────────

function NetworkNodes() {
  const nodes = [
    { top: '18%', left: '12%', size: 6, delay: 0 },
    { top: '72%', left: '20%', size: 5, delay: 0.4 },
    { top: '28%', left: '82%', size: 7, delay: 0.8 },
    { top: '78%', left: '76%', size: 5, delay: 1.2 },
    { top: '50%', left: '50%', size: 4, delay: 0.6 },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none">
      {nodes.map((n, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-orange-400/50"
          style={{
            top: n.top, left: n.left,
            width: n.size, height: n.size,
            animation: `eco-network-node 1.8s ease-in-out ${n.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ── Energy particles on connecting line ───────────────────────────────────────

function EnergyLine({ color }: { color: string }) {
  const particles = [0, 1, 2, 3, 4];
  return (
    <div className="hidden lg:block absolute top-1/2 -translate-y-1/2 -right-6 w-12 h-px z-20 overflow-visible">
      {/* Line */}
      <div
        className="absolute inset-0 h-px top-0"
        style={{ background: `linear-gradient(90deg, transparent, ${color}60, transparent)` }}
      />
      {/* Flowing dots */}
      {particles.map((p) => (
        <div
          key={p}
          className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
          style={{
            background: color,
            boxShadow: `0 0 4px ${color}`,
            animation: `eco-particle-flow 1.4s ease-in-out ${p * 0.28}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ── Background pulse rings ────────────────────────────────────────────────────

function PulseRings() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="absolute rounded-full border border-emerald-400/10"
          style={{
            width: 480,
            height: 480,
            top: '50%',
            left: '50%',
            animation: `eco-pulse-ring 4s ease-out ${i * 1}s infinite`,
          }}
        />
      ))}
      {/* Static ambient blobs */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-emerald-500/[0.04] rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-cyan-500/[0.04] rounded-full blur-3xl" />
    </div>
  );
}

// ── Step connector (desktop) ──────────────────────────────────────────────────

function StepConnector({ color, visible }: { color: string; visible: boolean }) {
  return (
    <div className="hidden lg:flex absolute top-[5.5rem] left-[calc(50%+3.5rem)] w-[calc(100%-7rem)] items-center pointer-events-none z-10">
      {/* Line */}
      <div
        className="relative flex-1 h-px origin-left"
        style={{
          background: `linear-gradient(90deg, ${color}70, ${color}30)`,
          transition: 'transform 0.8s ease-out',
          transform: visible ? 'scaleX(1)' : 'scaleX(0)',
        }}
      >
        {/* Flowing energy dots */}
        {[0,1,2,3].map(p => (
          <div
            key={p}
            className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
            style={{
              background: color,
              boxShadow: `0 0 6px ${color}`,
              animation: visible ? `eco-particle-flow 1.6s linear ${p * 0.4}s infinite` : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Holographic rotating border overlay ──────────────────────────────────────

function HoloBorder({ color, hovered }: { color: string; hovered: boolean }) {
  return (
    <div
      className="absolute -inset-px rounded-2xl pointer-events-none z-0 transition-opacity duration-300"
      style={{ opacity: hovered ? 1 : 0 }}
    >
      <div
        className="absolute -inset-[2px] rounded-2xl"
        style={{
          background: `conic-gradient(from 0deg, transparent, ${color}80, transparent, ${color}40, transparent)`,
          animation: 'eco-glow-spin 3s linear infinite',
        }}
      />
      {/* Mask inner */}
      <div className="absolute inset-[2px] rounded-[14px] bg-gray-900/90" />
    </div>
  );
}

// ── Individual step node ──────────────────────────────────────────────────────

function StepNode({
  data,
  index,
  visible,
}: {
  data: typeof STEP_CONFIG[number];
  index: number;
  visible: boolean;
}) {
  const { t } = useI18n();
  const { Icon, step, titleKey, descKey, accent, glow, border, iconGrad } = data;
  const [hovered, setHovered] = useState(false);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    setTilt({ rx: dy * -11, ry: dx * 11 });
  }, []);

  const onMouseLeave = useCallback(() => {
    setTilt({ rx: 0, ry: 0 });
    setHovered(false);
  }, []);

  const floatDelay = index * 0.45;
  const revealDelay = index * 0.18;

  return (
    <div
      ref={cardRef}
      className="relative"
      style={{ perspective: '900px' }}
    >
      <div
        className="relative rounded-2xl cursor-pointer select-none"
        onMouseEnter={() => setHovered(true)}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        style={{
          opacity: visible ? 1 : 0,
          animation: visible ? `eco-reveal 0.65s cubic-bezier(.22,1,.36,1) ${revealDelay}s both, eco-float 3.8s ease-in-out ${floatDelay}s infinite` : 'none',
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${hovered ? 1.03 : 1})`,
          transformStyle: 'preserve-3d',
          transition: 'transform 0.25s ease-out, box-shadow 0.25s ease-out',
          boxShadow: hovered
            ? `0 0 32px ${glow}, 0 16px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)`
            : `0 0 12px ${glow}50, 0 8px 24px rgba(0,0,0,0.35)`,
        }}
      >
        {/* Holographic spinning border */}
        <HoloBorder color={accent} hovered={hovered} />

        {/* Card body */}
        <div
          className="relative z-10 bg-gray-900/80 backdrop-blur-xl rounded-2xl p-6 border"
          style={{ borderColor: hovered ? border : 'rgba(255,255,255,0.07)' }}
        >
          {/* Step badge */}
          <div className="flex items-center gap-3 mb-5">
            {/* Icon */}
            <div
              className={`relative w-12 h-12 rounded-xl bg-gradient-to-br ${iconGrad} flex items-center justify-center shrink-0 shadow-lg`}
              style={{
                boxShadow: hovered ? `0 0 20px ${glow}` : undefined,
                animation: visible
                  ? `eco-icon-grow 0.7s cubic-bezier(.22,1,.36,1) ${revealDelay + 0.2}s both`
                  : 'none',
              }}
            >
              <Icon className="w-6 h-6 text-white" />
            </div>

            {/* Step number */}
            <div className="flex flex-col">
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: accent }}
              >
                {t('hiw.stepLabel')} {step}
              </span>
              <div
                className="h-px w-8 mt-0.5 rounded-full"
                style={{ background: accent, opacity: 0.5 }}
              />
            </div>
          </div>

          {/* Text */}
          <h3 className="text-lg font-display font-bold text-white mb-2 leading-snug">
            {t(titleKey)}
          </h3>
          <p className="text-sm text-gray-400 leading-relaxed">{t(descKey)}</p>

          {/* Special effects per step */}
          {step === 3 && <O2Molecules />}
          {step === 4 && <NetworkNodes />}

          {/* Bottom accent line */}
          <div
            className="absolute bottom-0 left-6 right-6 h-px rounded-full transition-opacity duration-300"
            style={{
              background: `linear-gradient(90deg, transparent, ${accent}60, transparent)`,
              opacity: hovered ? 1 : 0.3,
            }}
          />
        </div>
      </div>

      {/* Connector to next step (between nodes on desktop) */}
      {index < STEP_CONFIG.length - 1 && (
        <div className="hidden lg:block absolute top-[3rem] left-[calc(100%+0px)] w-8 z-20">
          <EnergyLine color={accent} />
        </div>
      )}

      {/* Vertical connector (mobile) */}
      {index < STEP_CONFIG.length - 1 && (
        <div className="lg:hidden flex justify-center py-3">
          <div
            className="w-px h-8 rounded-full"
            style={{ background: `linear-gradient(180deg, ${accent}80, transparent)` }}
          />
        </div>
      )}
    </div>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────

export default function EcosystemJourney() {
  const { t } = useI18n();
  const [visibleSteps, setVisibleSteps] = useState<Set<number>>(new Set());
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observers = nodeRefs.current.map((ref, i) => {
      if (!ref) return null;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setVisibleSteps((prev) => new Set([...prev, i]));
        },
        { threshold: 0.25 },
      );
      obs.observe(ref);
      return obs;
    });
    return () => observers.forEach((o) => o?.disconnect());
  }, []);

  return (
    <section className="py-20 sm:py-28 relative overflow-hidden bg-[#020d07]">
      <PulseRings />

      {/* Top gradient fade from previous white section */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <SectionHeading
          title={t('hiw.heading')}
          subtitle={t('hiw.headingSub')}
          light={false}
        />

        {/* Timeline */}
        <div className="relative">
          {/* Desktop background track line */}
          <div className="hidden lg:block absolute top-[3.4rem] left-[6%] right-[6%] h-px bg-white/5 pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-5">
            {STEP_CONFIG.map((step, i) => (
              <div key={step.step} ref={(el) => { nodeRefs.current[i] = el; }}>
                <StepNode
                  data={step}
                  index={i}
                  visible={visibleSteps.has(i)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom gradient fade to next white section */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white/[0.04] to-transparent pointer-events-none" />
    </section>
  );
}
