import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, Award, TreePine, Coins, BarChart3, ShoppingBag,
  Droplets, ChevronRight, ArrowRight, ExternalLink, Zap,
  Shield, Users, Globe,
} from 'lucide-react';
import { useI18n } from '../lib/i18n';

export default function DocumentationPage() {
  const { t } = useI18n();
  const [active, setActive] = useState('overview');

  const sectionIds = ['overview', 'nft-animal', 'nft-tree', 'oxy-token', 'staking', 'marketplace', 'dex'];

  const sectionTitle = (id: string): string => ({
    'overview': t('docs.overview'),
    'nft-animal': t('docs.nftAnimal'),
    'nft-tree': t('docs.nftTree'),
    'oxy-token': t('docs.oxyToken'),
    'staking': t('docs.staking'),
    'marketplace': t('docs.marketplace'),
    'dex': t('docs.dex'),
  }[id] ?? id);

  const sectionIcon: Record<string, React.ReactNode> = {
    'overview': <BookOpen className="w-5 h-5" />,
    'nft-animal': <Award className="w-5 h-5" />,
    'nft-tree': <TreePine className="w-5 h-5" />,
    'oxy-token': <Coins className="w-5 h-5" />,
    'staking': <BarChart3 className="w-5 h-5" />,
    'marketplace': <ShoppingBag className="w-5 h-5" />,
    'dex': <Droplets className="w-5 h-5" />,
  };

  const rarityTiers = [
    { label: t('docs.tier.common'), color: 'bg-gray-100 text-gray-700' },
    { label: t('docs.tier.uncommon'), color: 'bg-green-100 text-green-700' },
    { label: t('docs.tier.rare'), color: 'bg-blue-100 text-blue-700' },
    { label: t('docs.tier.epic'), color: 'bg-purple-100 text-purple-700' },
    { label: t('docs.tier.legendary'), color: 'bg-yellow-100 text-yellow-700' },
  ];

  const overviewFeatures = [
    { icon: <Shield className="w-5 h-5 text-gold-600" />, title: t('docs.f1Title'), desc: t('docs.f1Desc') },
    { icon: <Globe className="w-5 h-5 text-forest-600" />, title: t('docs.f2Title'), desc: t('docs.f2Desc') },
    { icon: <Zap className="w-5 h-5 text-ocean-600" />, title: t('docs.f3Title'), desc: t('docs.f3Desc') },
    { icon: <Users className="w-5 h-5 text-earth-600" />, title: t('docs.f4Title'), desc: t('docs.f4Desc') },
  ];

  const nftAnimalRows: [string, string][] = [
    [t('docs.row.standard'), t('docs.val.erc721')],
    [t('docs.row.maxSupply'), t('docs.val.1000nft')],
    [t('docs.row.mintPrice'), t('docs.val.001tcore')],
    [t('docs.row.maxPerWallet'), t('docs.val.5nft')],
    [t('docs.row.phases'), t('docs.val.phasesDesc')],
    [t('docs.row.network'), t('docs.val.coreTestnet')],
  ];

  const nftTreeFields: [string, string][] = [
    [t('docs.field.species'), t('docs.fieldDesc.species')],
    [t('docs.field.location'), t('docs.fieldDesc.location')],
    [t('docs.field.planter'), t('docs.fieldDesc.planter')],
    [t('docs.field.plantedAt'), t('docs.fieldDesc.plantedAt')],
    [t('docs.field.tokenURI'), t('docs.fieldDesc.tokenURI')],
  ];

  const oxyRows: [string, string][] = [
    [t('docs.row.standard'), t('docs.val.erc20')],
    [t('docs.row.maxSupply'), t('docs.val.21bOxy')],
    [t('docs.row.decimals'), t('docs.val.18decimals')],
    [t('docs.row.idoAlloc'), t('docs.val.10pct')],
    [t('docs.row.liqAlloc'), t('docs.val.10pct')],
    [t('docs.row.stakingPool'), t('docs.val.80pct')],
  ];

  const stakingRows: [string, string][] = [
    [t('docs.row.stakingAsset'), t('docs.val.stakingAssetVal')],
    [t('docs.row.rewardToken'), t('docs.val.rewardTokenVal')],
    [t('docs.row.rewardRate'), t('docs.val.rewardRateVal')],
    [t('docs.row.claimPeriod'), t('docs.val.claimPeriodVal')],
    [t('docs.row.method'), t('docs.val.methodVal')],
  ];

  const stakingSteps = [
    t('docs.stakingStep1'),
    t('docs.stakingStep2'),
    t('docs.stakingStep3'),
    t('docs.stakingStep4'),
    t('docs.stakingStep5'),
  ];

  const marketRows: [string, string][] = [
    [t('docs.row.paymentToken'), t('docs.val.paymentTokenVal')],
    [t('docs.row.supportedNfts'), t('docs.val.supportedNftsVal')],
    [t('docs.row.platformFee'), t('docs.val.platformFeeVal')],
    [t('docs.row.listing'), t('docs.val.listingVal')],
    [t('docs.row.cancellation'), t('docs.val.cancellationVal')],
  ];

  const dexRows: [string, string][] = [
    [t('docs.row.pair'), t('docs.val.pairVal')],
    [t('docs.row.model'), t('docs.val.modelVal')],
    [t('docs.row.lpTokens'), t('docs.val.lpTokensVal')],
    [t('docs.row.farming'), t('docs.val.farmingVal')],
    [t('docs.row.slippage'), t('docs.val.slippageVal')],
    [t('docs.row.deadline'), t('docs.val.deadlineVal')],
  ];

  const activeIndex = sectionIds.indexOf(active);

  const renderContent = () => {
    switch (active) {
      case 'overview':
        return (
          <div className="space-y-4">
            <p className="text-gray-600 leading-relaxed">{t('docs.overviewPara')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
              {overviewFeatures.map(f => (
                <div key={f.title} className="flex gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50">
                  <div className="mt-0.5 flex-shrink-0">{f.icon}</div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{f.title}</p>
                    <p className="text-gray-500 text-sm mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'nft-animal':
        return (
          <div className="space-y-4">
            <p className="text-gray-600 leading-relaxed">{t('docs.nftAnimalPara')}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gold-50 text-gold-800">
                    <th className="text-left px-4 py-3 font-semibold rounded-tl-lg">{t('docs.paramCol')}</th>
                    <th className="text-left px-4 py-3 font-semibold rounded-tr-lg">{t('docs.valueCol')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {nftAnimalRows.map(([k, v]) => (
                    <tr key={k} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 font-medium">{k}</td>
                      <td className="px-4 py-3 text-gray-900">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-gold-50 border border-gold-200 rounded-xl p-4 mt-4">
              <p className="text-gold-800 text-sm font-semibold mb-1">{t('docs.nftAnimalRarity')}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {rarityTiers.map(r => (
                  <span key={r.label} className={`px-3 py-1 rounded-full text-xs font-semibold ${r.color}`}>{r.label}</span>
                ))}
              </div>
            </div>
            <p className="text-gray-500 text-sm">{t('docs.nftAnimalHolder')}</p>
          </div>
        );
      case 'nft-tree':
        return (
          <div className="space-y-4">
            <p className="text-gray-600 leading-relaxed">{t('docs.nftTreePara')}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-forest-50 text-forest-800">
                    <th className="text-left px-4 py-3 font-semibold rounded-tl-lg">{t('docs.fieldCol')}</th>
                    <th className="text-left px-4 py-3 font-semibold rounded-tr-lg">{t('docs.descCol')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {nftTreeFields.map(([k, v]) => (
                    <tr key={k} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-forest-700 text-xs">{k}</td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-forest-50 border border-forest-200 rounded-xl p-4">
              <p className="text-forest-800 text-sm">
                <span className="font-semibold">{t('docs.nftTreeMinting')}</span> {t('docs.nftTreeMintingDesc')}
              </p>
            </div>
          </div>
        );
      case 'oxy-token':
        return (
          <div className="space-y-4">
            <p className="text-gray-600 leading-relaxed">{t('docs.oxyPara')}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-ocean-50 text-ocean-800">
                    <th className="text-left px-4 py-3 font-semibold rounded-tl-lg">{t('docs.paramCol')}</th>
                    <th className="text-left px-4 py-3 font-semibold rounded-tr-lg">{t('docs.valueCol')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {oxyRows.map(([k, v]) => (
                    <tr key={k} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 font-medium">{k}</td>
                      <td className="px-4 py-3 text-gray-900">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'staking':
        return (
          <div className="space-y-4">
            <p className="text-gray-600 leading-relaxed">{t('docs.stakingPara')}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-earth-50 text-earth-800">
                    <th className="text-left px-4 py-3 font-semibold rounded-tl-lg">{t('docs.paramCol')}</th>
                    <th className="text-left px-4 py-3 font-semibold rounded-tr-lg">{t('docs.valueCol')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stakingRows.map(([k, v]) => (
                    <tr key={k} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 font-medium">{k}</td>
                      <td className="px-4 py-3 text-gray-900">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ol className="space-y-2 mt-2">
              {stakingSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-forest-100 text-forest-700 flex items-center justify-center font-bold text-xs">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        );
      case 'marketplace':
        return (
          <div className="space-y-4">
            <p className="text-gray-600 leading-relaxed">{t('docs.marketPara')}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-700">
                    <th className="text-left px-4 py-3 font-semibold rounded-tl-lg">{t('docs.paramCol')}</th>
                    <th className="text-left px-4 py-3 font-semibold rounded-tr-lg">{t('docs.valueCol')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {marketRows.map(([k, v]) => (
                    <tr key={k} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 font-medium">{k}</td>
                      <td className="px-4 py-3 text-gray-900">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'dex':
        return (
          <div className="space-y-4">
            <p className="text-gray-600 leading-relaxed">{t('docs.dexPara')}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-ocean-50 text-ocean-800">
                    <th className="text-left px-4 py-3 font-semibold rounded-tl-lg">{t('docs.featureCol')}</th>
                    <th className="text-left px-4 py-3 font-semibold rounded-tr-lg">{t('docs.detailsCol')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dexRows.map(([k, v]) => (
                    <tr key={k} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 font-medium">{k}</td>
                      <td className="px-4 py-3 text-gray-900">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-forest-900 to-forest-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center gap-2 text-forest-300/60 text-sm mb-4">
            <Link to="/" className="hover:text-forest-200 transition-colors">{t('nav.home')}</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-forest-200">{t('docs.breadcrumb')}</span>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold">{t('docs.title')}</h1>
              <p className="text-forest-200/70 text-sm mt-0.5">{t('docs.subtitle')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="lg:w-64 flex-shrink-0">
            <nav className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden sticky top-6">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('docs.overview')}</p>
              </div>
              <ul className="py-2">
                {sectionIds.map(s => (
                  <li key={s}>
                    <button
                      onClick={() => setActive(s)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all ${
                        active === s
                          ? 'bg-forest-50 text-forest-700 font-semibold border-r-2 border-forest-500'
                          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <span className={active === s ? 'text-forest-600' : 'text-gray-400'}>{sectionIcon[s]}</span>
                      {sectionTitle(s)}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mt-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{t('docs.overview')}</p>
              <div className="space-y-2">
                <Link to="/smart-contracts" className="flex items-center gap-2 text-sm text-gray-500 hover:text-forest-600 transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" /> {t('sc.breadcrumb')}
                </Link>
                <Link to="/faq" className="flex items-center gap-2 text-sm text-gray-500 hover:text-forest-600 transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" /> {t('faq.breadcrumb')}
                </Link>
                <Link to="/nft-a" className="flex items-center gap-2 text-sm text-gray-500 hover:text-forest-600 transition-colors">
                  <ArrowRight className="w-3.5 h-3.5" /> {t('docs.nftAnimal')}
                </Link>
                <Link to="/staking" className="flex items-center gap-2 text-sm text-gray-500 hover:text-forest-600 transition-colors">
                  <ArrowRight className="w-3.5 h-3.5" /> {t('docs.staking')}
                </Link>
              </div>
            </div>
          </aside>

          <main className="flex-1 min-w-0">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-forest-50 text-forest-600 flex items-center justify-center">
                  {sectionIcon[active]}
                </div>
                <h2 className="text-2xl font-display font-bold text-gray-900">{sectionTitle(active)}</h2>
              </div>
              {renderContent()}
            </div>

            <div className="flex justify-between mt-6">
              {activeIndex > 0 && (
                <button
                  onClick={() => setActive(sectionIds[activeIndex - 1])}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-600 hover:border-forest-400 hover:text-forest-600 text-sm font-medium transition-all"
                >
                  ← {sectionTitle(sectionIds[activeIndex - 1])}
                </button>
              )}
              <div className="ml-auto">
                {activeIndex < sectionIds.length - 1 && (
                  <button
                    onClick={() => setActive(sectionIds[activeIndex + 1])}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-forest-600 text-white hover:bg-forest-700 text-sm font-medium transition-all"
                  >
                    {sectionTitle(sectionIds[activeIndex + 1])} →
                  </button>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
