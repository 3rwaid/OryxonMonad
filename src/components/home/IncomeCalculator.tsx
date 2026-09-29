import { useState, useEffect, useRef } from 'react';
import { TreePine, Coins, TrendingUp, Zap, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';

const REWARD_RATE_BPS = 10;     // 0.10% per tree per day
const OXY_PRICE_USD  = 0.0012;
const PRESETS = [1, 5, 10, 25, 50] as const;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function useAnimatedCounter(target: number, duration = 600) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef<number>(0);
  const prevRef  = useRef(0);

  useEffect(() => {
    const from  = prevRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t     = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(lerp(from, target, eased));
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
      else prevRef.current = target;
    };
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return display;
}

function fmt(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(2)}K`;
  return v.toFixed(2);
}

function StatBox({ label, value, unit, color, sub }: {
  label: string; value: number; unit: string; color: string; sub?: string;
}) {
  const display = useAnimatedCounter(value);
  return (
    <div
      className="relative rounded-2xl p-5 overflow-hidden flex flex-col gap-1 backdrop-blur-xl border"
      style={{
        background:  'rgba(15,23,20,0.7)',
        borderColor: `${color}25`,
        boxShadow:   `0 0 20px ${color}18, inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}
    >
      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-20" style={{ background: color }} />
      <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full"
        style={{ background: color, animation: 'dash-pulse 2s ease-in-out infinite', boxShadow: `0 0 6px ${color}` }} />
      <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">{label}</p>
      <p className="text-2xl sm:text-3xl font-display font-extrabold tabular-nums leading-none" style={{ color }}>
        {fmt(display)} <span className="text-base font-semibold opacity-70">{unit}</span>
      </p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      <div className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${color}40, transparent)` }} />
    </div>
  );
}

function YearlyBox({ yearlyOxy, yearlyUsd, yearLabel, perYearLabel }: { yearlyOxy: number; yearlyUsd: number; yearLabel: string; perYearLabel: string }) {
  const display = useAnimatedCounter(yearlyOxy);
  return (
    <div
      className="relative rounded-2xl p-5 overflow-hidden backdrop-blur-xl border"
      style={{
        background:  'rgba(15,23,20,0.7)',
        borderColor: 'rgba(234,179,8,0.3)',
        boxShadow:   '0 0 28px rgba(234,179,8,0.12), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl opacity-15" style={{ background: '#eab308' }} />
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"
          style={{ animation: 'dash-pulse 2s ease-in-out infinite', boxShadow: '0 0 6px #eab308' }} />
        <span className="text-[9px] uppercase tracking-wider text-yellow-600 font-semibold">{yearLabel}</span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 mb-1">{perYearLabel}</p>
          <p className="text-4xl font-display font-extrabold text-yellow-400 leading-none tabular-nums">
            {fmt(display)} <span className="text-xl font-semibold opacity-70">$OXY</span>
          </p>
          <p className="text-sm text-yellow-600 mt-1 font-semibold">
            ≈ ${yearlyUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </p>
        </div>
        <TrendingUp className="w-12 h-12 text-yellow-400/20" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(234,179,8,0.4), transparent)' }} />
    </div>
  );
}

export default function IncomeCalculator() {
  const { t } = useI18n();
  const [trees, setTrees]   = useState(10);
  const [oxyUsd, setOxyUsd] = useState(OXY_PRICE_USD);

  const dailyOxy   = trees * (REWARD_RATE_BPS / 10_000) * 1_000;
  const monthlyOxy = dailyOxy * 30;
  const yearlyOxy  = dailyOxy * 365;
  const monthlyUsd = monthlyOxy * oxyUsd;
  const yearlyUsd  = yearlyOxy  * oxyUsd;

  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!sectionRef.current) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.1 },
    );
    obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  const sliderPct = ((trees - 1) / 99) * 100;

  return (
    <section
      ref={sectionRef}
      className="py-20 sm:py-28 relative overflow-hidden bg-[#030f08]"
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(34,197,94,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.5) 1px, transparent 1px)',
          backgroundSize:  '48px 48px',
        }}
      />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/[0.04] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-cyan-500/[0.04] rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div
          className="text-center mb-14"
          style={{
            opacity:    visible ? 1 : 0,
            transform:  visible ? 'translateY(0)' : 'translateY(16px)',
            transition: 'opacity 0.7s ease, transform 0.7s cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-white mb-3">
            {t('calc.title')}
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto leading-relaxed">
            {t('calc.subtitle')}
          </p>
        </div>

        <div
          className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start"
          style={{
            opacity:    visible ? 1 : 0,
            transform:  visible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.7s ease 0.15s, transform 0.7s cubic-bezier(0.22,1,0.36,1) 0.15s',
          }}
        >
          {/* Control Panel */}
          <div
            className="lg:col-span-2 rounded-2xl p-6 backdrop-blur-xl border"
            style={{
              background:  'rgba(15,23,20,0.7)',
              borderColor: 'rgba(34,197,94,0.15)',
              boxShadow:   '0 0 24px rgba(34,197,94,0.07), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <div className="flex items-center gap-2 mb-6">
              <TreePine className="w-5 h-5 text-emerald-400" />
              <span className="text-sm font-semibold text-white">{t('calc.treeCount')}</span>
            </div>

            <div className="text-center mb-6">
              <span className="text-6xl font-display font-extrabold text-emerald-400 tabular-nums leading-none">
                {trees}
              </span>
              <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">{t('calc.staked')}</p>
            </div>

            <div className="relative mb-6">
              <input
                type="range" min={1} max={100} value={trees}
                onChange={(e) => setTrees(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background:  `linear-gradient(to right, #22c55e ${sliderPct}%, rgba(255,255,255,0.08) ${sliderPct}%)`,
                  accentColor: '#22c55e',
                }}
              />
              <div className="flex justify-between text-[10px] text-gray-600 mt-1.5">
                <span>1</span><span>50</span><span>100</span>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap mb-6">
              {PRESETS.map((p) => (
                <button
                  key={p} onClick={() => setTrees(p)}
                  className="px-3 py-1 rounded-lg text-xs font-semibold border transition-all duration-150"
                  style={{
                    background:  trees === p ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.04)',
                    borderColor: trees === p ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.08)',
                    color:       trees === p ? '#4ade80' : '#6b7280',
                  }}
                >
                  {p}x
                </button>
              ))}
            </div>

            <div>
              <label className="flex items-center gap-2 mb-2">
                <Coins className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-white">{t('calc.oxyPrice')}</span>
              </label>
              <div
                className="flex items-center gap-2 rounded-xl border px-4 py-2.5"
                style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(34,211,238,0.2)' }}
              >
                <span className="text-xs text-gray-500">$</span>
                <input
                  type="number" min={0.0001} step={0.0001} value={oxyUsd}
                  onChange={(e) => setOxyUsd(Math.max(0.0001, Number(e.target.value)))}
                  className="flex-1 bg-transparent text-sm text-white font-semibold outline-none tabular-nums"
                />
                <span className="text-[10px] text-gray-600 uppercase tracking-wider">USD</span>
              </div>
              <p className="text-[10px] text-gray-600 mt-1.5">{t('calc.changeHint')}</p>
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <StatBox label={t('calc.perDay')}  value={dailyOxy}   unit="$OXY" color="#22c55e" sub={`≈ $${(dailyOxy * oxyUsd).toFixed(4)}`} />
              <StatBox label={t('calc.perMonth')} value={monthlyOxy} unit="$OXY" color="#22d3ee" sub={`≈ $${monthlyUsd.toFixed(2)}`} />
            </div>

            <YearlyBox yearlyOxy={yearlyOxy} yearlyUsd={yearlyUsd} yearLabel={t('calc.estAnnual')} perYearLabel={t('calc.perYear')} />

            <div
              className="rounded-xl px-4 py-3 border flex items-start gap-3"
              style={{ background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.06)' }}
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-gray-500 leading-relaxed"
                 dangerouslySetInnerHTML={{ __html: t('calc.disclaimer', { rate: String(REWARD_RATE_BPS / 100) }) }} />
            </div>

            <Link
              to="/nft-b"
              className="group flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm text-white border border-emerald-500/25 hover:bg-emerald-500/10 hover:border-emerald-500/40 transition-all duration-200"
            >
              <TreePine className="w-4 h-4 text-emerald-400" />
              {t('calc.getCtrees')}
              <ArrowRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
