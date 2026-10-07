import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import oryxonLogo from '../../assets/images/oryxon_noBG.png';
import { Menu, X, Wallet, ChevronDown, LogOut, Copy, CheckCheck, Globe } from 'lucide-react';
import { useChainId } from 'wagmi';
import { monadTestnet } from '../../lib/wagmi-config';
import { useWallet } from '../../lib/wallet-context';
import { useI18n, type Lang } from '../../lib/i18n';
import WalletModal from '../wallet/WalletModal';

const NAV_LINKS = [
  { key: 'nav.home', to: '/' },
  { key: 'nav.nftA', to: '/nft-a' },
  { key: 'nav.nftB', to: '/nft-b' },
  { key: 'nav.oxy', to: '/oxy' },
  { key: 'nav.staking', to: '/staking' },
  { key: 'nav.marketplace', to: '/marketplace' },
];

const LANG_OPTIONS: { code: Lang; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: 'EN' },
  { code: 'id', label: 'Bahasa Indonesia', flag: 'ID' },
];



export default function Header() {
  const { wallet, connect, disconnect } = useWallet();
  const { t, lang, setLang } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const location = useLocation();
  const chainId = useChainId();

  const chain = { name: 'Monad Testnet', color: 'bg-emerald-400' };



  const truncateAddress = (addr: string) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

  const copyAddress = () => {
    if (wallet.address) {
      navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  const currentLang = LANG_OPTIONS.find((l) => l.code === lang) ?? LANG_OPTIONS[0];

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-gray-950/90 backdrop-blur-xl border-b border-emerald-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link
              to="/"
              className="flex items-center gap-2 group"
            >
              <img
                src={oryxonLogo}
                alt="Oryxon"
                className="w-9 h-9 object-contain group-hover:scale-105 transition-transform"
              />
              <span className="text-xl font-bold text-white tracking-tight">
                Ory<span className="text-emerald-400">xon</span>
              </span>
            </Link>

            <nav className="hidden lg:flex items-center gap-1">
              {NAV_LINKS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive(item.to)
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {t(item.key)}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              {/* Language toggle */}
              <div className="relative hidden sm:block">
                <button
                  onClick={() => setLangOpen((v) => !v)}
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200"
                  aria-label={t('lang.toggle')}
                >
                  <Globe className="w-4 h-4" />
                  <span className="text-xs font-semibold">{currentLang.flag}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
                </button>
                {langOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setLangOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-44 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                      {LANG_OPTIONS.map((opt) => (
                        <button
                          key={opt.code}
                          onClick={() => { setLang(opt.code); setLangOpen(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                            lang === opt.code
                              ? 'bg-emerald-500/15 text-emerald-400 font-medium'
                              : 'text-gray-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <span className="text-xs font-bold w-6 text-center">{opt.flag}</span>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {wallet.isConnected ? (
                <div className="relative hidden sm:block">
                  <button
                    onClick={() => setWalletMenuOpen(v => !v)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-sm font-medium hover:bg-emerald-500/15 transition-all duration-200"
                  >
                    <span className={`w-2 h-2 rounded-full ${chain.color}`} />
                    <Wallet className="w-3.5 h-3.5" />
                    <span>{truncateAddress(wallet.address)}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${walletMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {walletMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setWalletMenuOpen(false)}
                      />
                      <div className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-800">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`w-2 h-2 rounded-full ${chain.color}`} />
                            <span className="text-xs text-gray-400">{chain.name}</span>
                          </div>
                          <p className="text-xs text-gray-300 font-mono break-all">{wallet.address}</p>
                        </div>

                        <div className="px-4 py-3 border-b border-gray-800">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">{t('header.coreBalance')}</span>
                            <span className="text-white font-medium">
                              {wallet.balance.toFixed(4)} MON
                            </span>
                          </div>
                          <div className="flex justify-between text-sm mt-1.5">
                            <span className="text-gray-400">{t('header.oxyBalance')}</span>
                            <span className="text-emerald-400 font-medium">
                              {wallet.oxyBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} OXY
                            </span>
                          </div>
                        </div>

                        <div className="p-2 space-y-1">
                          <button
                            onClick={() => { copyAddress(); setWalletMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                          >
                            {copied ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                            {copied ? t('header.addressCopied') : t('header.copyAddress')}
                          </button>
                          <button
                            onClick={() => { disconnect(); setWalletMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <LogOut className="w-4 h-4" />
                            {t('header.disconnect')}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button
                  onClick={connect}
                  className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-all duration-200"
                >
                  <Wallet className="w-4 h-4" />
                  {t('header.connectWallet')}
                </button>
              )}

              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {mobileOpen && (
          <div className="lg:hidden bg-gray-950/98 backdrop-blur-xl border-t border-emerald-900/30">
            <div className="px-4 py-4 space-y-1">
              {NAV_LINKS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive(item.to)
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {t(item.key)}
                </Link>
              ))}

              {/* Language toggle (mobile) */}
              <div className="flex gap-2 px-4 pt-2">
                {LANG_OPTIONS.map((opt) => (
                  <button
                    key={opt.code}
                    onClick={() => setLang(opt.code)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      lang === opt.code
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <Globe className="w-4 h-4" />
                    {opt.label}
                  </button>
                ))}
              </div>

              {wallet.isConnected ? (
                <div className="mt-3 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-2 h-2 rounded-full ${chain.color}`} />
                    <span className="text-xs text-gray-400">{chain.name}</span>
                  </div>
                  <p className="text-xs text-emerald-400 font-mono mb-2">{truncateAddress(wallet.address)}</p>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="rounded-lg bg-gray-900/70 px-2.5 py-2">
                      <p className="text-[10px] text-gray-500">MON</p>
                      <p className="text-xs font-semibold text-white">{wallet.balance.toFixed(4)}</p>
                    </div>
                    <div className="rounded-lg bg-gray-900/70 px-2.5 py-2">
                      <p className="text-[10px] text-gray-500">OXY</p>
                      <p className="text-xs font-semibold text-emerald-400">{wallet.oxyBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={copyAddress}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-gray-800 text-gray-300 text-xs hover:bg-gray-700 transition-colors"
                    >
                      {copied ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copied ? t('header.copied') : t('header.copy')}
                    </button>
                    <button
                      onClick={() => { disconnect(); setMobileOpen(false); }}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 transition-colors"
                    >
                      <LogOut className="w-3 h-3" />
                      {t('header.disconnect')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { connect(); setMobileOpen(false); }}
                  className="w-full flex items-center justify-center gap-2 mt-3 px-4 py-3 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-all"
                >
                  <Wallet className="w-4 h-4" />
                  {t('header.connectWallet')}
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <WalletModal />
    </>
  );
}
