import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';
import { Leaf, Twitter } from 'lucide-react';

const ECOSYSTEM_LINKS = [
  { key: 'nav.nftA', to: '/nft-a' },
  { key: 'nav.nftB', to: '/nft-b' },
  { key: 'nav.oxy',  to: '/oxy' },
  { key: 'nav.staking', to: '/staking' },
  { key: 'nav.marketplace', to: '/marketplace' },
];

const RESOURCE_LINKS = [
  { key: 'res.breadcrumb', to: '/resources' },
  { key: 'footer.documentation', to: '/docs' },
  { key: 'footer.smartContracts', to: '/smart-contracts' },
  { key: 'footer.faq', to: '/faq' },
];

export default function Footer() {
  const { t } = useI18n();

  return (
    <footer className="bg-gray-950 border-t border-emerald-900/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Leaf className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white">
                Ory<span className="text-emerald-400">xon</span>
              </span>
            </div>
            <p className="text-gray-500 text-sm max-w-md leading-relaxed">
              {t('footer.tagline')}
            </p>
            <div className="flex items-center gap-4 mt-6">
              <a href="#" className="text-gray-500 hover:text-emerald-400 transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm mb-4">{t('footer.ecosystem')}</h4>
            <ul className="space-y-3">
              {ECOSYSTEM_LINKS.map(({ key, to }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className="text-gray-500 hover:text-emerald-400 text-sm transition-colors"
                  >
                    {t(key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm mb-4">{t('footer.resources')}</h4>
            <ul className="space-y-3">
              {RESOURCE_LINKS.map(({ key, to }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className="text-gray-500 hover:text-emerald-400 text-sm transition-colors"
                  >
                    {t(key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-600 text-xs">
            {t('footer.rights')}
          </p>
          <div className="flex items-center gap-6">
            <Link to="/privacy-policy" className="text-gray-600 hover:text-gray-400 text-xs transition-colors">
              {t('footer.privacy')}
            </Link>
            <Link to="/terms-of-service" className="text-gray-600 hover:text-gray-400 text-xs transition-colors">
              {t('footer.terms')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
