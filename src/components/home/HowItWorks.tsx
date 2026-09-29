import { Sparkles, TreePine, Coins, ArrowDown } from 'lucide-react';
import { useI18n } from '../../lib/i18n';

export default function HowItWorks() {
  const { t } = useI18n();
  const steps = [
    {
      icon: Sparkles,
      title: t('hiw.s1.title'),
      description: t('hiw.s1.desc'),
      color: 'from-amber-500 to-orange-500',
      bgColor: 'bg-amber-500/10',
      textColor: 'text-amber-400',
    },
    {
      icon: TreePine,
      title: t('hiw.s2.title'),
      description: t('hiw.s2.desc'),
      color: 'from-emerald-500 to-green-500',
      bgColor: 'bg-emerald-500/10',
      textColor: 'text-emerald-400',
    },
    {
      icon: Coins,
      title: t('hiw.s3.title'),
      description: t('hiw.s3.desc'),
      color: 'from-teal-500 to-cyan-500',
      bgColor: 'bg-teal-500/10',
      textColor: 'text-teal-400',
    },
  ];

  return (
    <section className="py-24 bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            {t('hiw.title')}
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto text-lg">
            {t('hiw.subtitle')}
          </p>
        </div>

        <div className="relative flex flex-col items-center gap-4">
          {steps.map((step, i) => (
            <div key={i} className="w-full max-w-2xl">
              <div className="relative p-8 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-emerald-500/20 transition-all duration-300 group">
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg relative">
                      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${step.color} opacity-20`} />
                      <div className={`relative w-14 h-14 rounded-2xl ${step.bgColor} flex items-center justify-center`}>
                        <step.icon className={`w-7 h-7 ${step.textColor}`} />
                      </div>
                    </div>
                    <div className="flex justify-center mt-2">
                      <span className="text-xs font-bold text-gray-600">
                        {t('hiw.step')} {i + 1}
                      </span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">
                      {step.title}
                    </h3>
                    <p className="text-gray-400 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              </div>
              {i < steps.length - 1 && (
                <div className="flex justify-center py-2">
                  <ArrowDown className="w-5 h-5 text-emerald-500/40" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
