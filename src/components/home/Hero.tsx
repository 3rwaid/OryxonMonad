import { ArrowRight, TreePine, Coins, Shield } from 'lucide-react';
import type { PageKey } from '../../lib/constants';
import { useI18n } from '../../lib/i18n';

interface HeroProps {
  onNavigate: (page: PageKey) => void;
}

export default function Hero({ onNavigate }: HeroProps) {
  const { t } = useI18n();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950" />
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-teal-600/15 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-green-600/10 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-8">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 text-sm font-medium">Live on CORE Blockchain</span>
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6">
          {t('home.heroLine1')}
          <br />
          <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-green-400 bg-clip-text text-transparent">
            {t('home.heroLine2')}
          </span>
          <br />
          {t('home.heroLine3')}
        </h1>

        <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          {t('home.heroDesc')}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <button
            onClick={() => onNavigate('nft-a')}
            className="group flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold text-lg hover:from-emerald-500 hover:to-teal-500 transition-all duration-300 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5"
          >
            {t('home.mintWarriors')}
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={() => onNavigate('oxy-token')}
            className="flex items-center gap-2 px-8 py-4 rounded-xl bg-white/5 border border-white/10 text-white font-semibold text-lg hover:bg-white/10 hover:border-white/20 transition-all duration-300"
          >
            {t('home.exploreOxy')}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
          {[
            { icon: Shield, label: '1,000 Oryx Warriors', desc: 'Premium animal characters' },
            { icon: TreePine, label: 'Real OxyTrees', desc: 'RWA-backed digital assets' },
            { icon: Coins, label: '2.1B $OXY Supply', desc: 'Utility token with staking' },
          ].map((item) => (
            <div
              key={item.label}
              className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-emerald-500/20 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <item.icon className="w-6 h-6 text-emerald-400" />
              </div>
              <span className="text-white font-semibold">{item.label}</span>
              <span className="text-gray-500 text-sm">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
