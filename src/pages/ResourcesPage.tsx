import { Link } from 'react-router-dom';
import {
  BookOpen, Code2, HelpCircle, ChevronRight, ArrowRight,
  Wallet, Award, TreePine, BarChart3, ShoppingBag, Droplets, Globe,
} from 'lucide-react';
import { useI18n } from '../lib/i18n';

export default function ResourcesPage() {
  const { t } = useI18n();

  const cards = [
    {
      to: '/docs',
      icon: <BookOpen className="w-6 h-6" />,
      title: t('res.docTitle'),
      desc: t('res.docDesc'),
      cta: t('res.docCta'),
      gradient: 'from-forest-600 to-forest-800',
      iconBg: 'bg-forest-100 text-forest-600',
    },
    {
      to: '/smart-contracts',
      icon: <Code2 className="w-6 h-6" />,
      title: t('res.scTitle'),
      desc: t('res.scDesc'),
      cta: t('res.scCta'),
      gradient: 'from-gray-700 to-gray-900',
      iconBg: 'bg-gray-100 text-gray-600',
    },
    {
      to: '/faq',
      icon: <HelpCircle className="w-6 h-6" />,
      title: t('res.faqTitle'),
      desc: t('res.faqDesc'),
      cta: t('res.faqCta'),
      gradient: 'from-ocean-600 to-ocean-800',
      iconBg: 'bg-ocean-100 text-ocean-600',
    },
  ];

  const guideSteps = [
    { icon: <Wallet className="w-5 h-5" />, text: t('res.guide.s1') },
    { icon: <Award className="w-5 h-5" />, text: t('res.guide.s2') },
    { icon: <TreePine className="w-5 h-5" />, text: t('res.guide.s3') },
    { icon: <BarChart3 className="w-5 h-5" />, text: t('res.guide.s4') },
    { icon: <ShoppingBag className="w-5 h-5" />, text: t('res.guide.s5') },
  ];

  const networkDetails = [
    ['Chain ID', '10143'],
    ['RPC URL', 'https://testnet-rpc.monad.xyz'],
    ['Block Explorer', 'https://testnet.monadexplorer.com'],
    ['Currency Symbol', 'MON'],
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-forest-900 via-emerald-900 to-forest-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center gap-2 text-emerald-300/60 text-sm mb-4">
            <Link to="/" className="hover:text-emerald-200 transition-colors">{t('nav.home')}</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-emerald-200">{t('res.breadcrumb')}</span>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Globe className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold">{t('res.title')}</h1>
              <p className="text-emerald-200/70 text-sm mt-0.5">{t('res.subtitle')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h2 className="text-xl font-display font-bold text-gray-900 mb-6">{t('res.cardsTitle')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {cards.map(card => (
            <Link
              key={card.to}
              to={card.to}
              className="group bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all"
            >
              <div className={`bg-gradient-to-br ${card.gradient} p-6`}>
                <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white">
                  {card.icon}
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-lg font-display font-bold text-gray-900 mb-2">{card.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-4">{card.desc}</p>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-600 group-hover:text-forest-700 transition-colors">
                  {card.cta}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-forest-50 text-forest-600 flex items-center justify-center">
                <Droplets className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-display font-bold text-gray-900">{t('res.guideTitle')}</h2>
                <p className="text-gray-500 text-sm">{t('res.guideSubtitle')}</p>
              </div>
            </div>
            <ol className="space-y-4">
              {guideSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-4">
                  <div className="flex-shrink-0 flex flex-col items-center">
                    <span className="w-8 h-8 rounded-full bg-forest-100 text-forest-700 flex items-center justify-center font-bold text-sm">
                      {i + 1}
                    </span>
                    {i < guideSteps.length - 1 && (
                      <span className="w-px h-6 bg-forest-100 mt-1" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-forest-500">{step.icon}</span>
                    <span className="text-sm text-gray-600 leading-relaxed">{step.text}</span>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-ocean-50 text-ocean-600 flex items-center justify-center">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-display font-bold text-gray-900">{t('res.networkTitle')}</h2>
                <p className="text-gray-500 text-sm">{t('res.networkDesc')}</p>
              </div>
            </div>
            <div className="space-y-3">
              {networkDetails.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-500 font-medium">{k}</span>
                  <span className="text-sm text-gray-900 font-mono">{v}</span>
                </div>
              ))}
            </div>
            <a
              href="https://testnet.monadexplorer.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-ocean-600 text-white text-sm font-semibold hover:bg-ocean-700 transition-colors"
            >
              <Globe className="w-4 h-4" />
              {t('sc.blockExplorer')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
