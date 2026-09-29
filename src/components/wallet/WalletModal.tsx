import { useEffect, useState } from 'react';
import { useConnect, useAccount, useChainId, useSwitchChain } from 'wagmi';
import { X, Wallet, AlertTriangle, CheckCircle, ChevronRight, Loader2, Globe } from 'lucide-react';
import { useWallet } from '../../lib/wallet-context';
import { monadTestnet } from '../../lib/wagmi-config';
import { useI18n } from '../../lib/i18n';

const CONNECTOR_META: Record<string, { icon: string; label: string; sub: string }> = {
  injected:       { icon: '🦊', label: 'MetaMask / Browser Wallet', sub: 'Browser extension' },
  walletConnect:  { icon: '🔗', label: 'WalletConnect',             sub: 'Scan QR code' },
  coinbaseWallet: { icon: '💰', label: 'Coinbase Wallet',           sub: 'Mobile & web' },
};

export default function WalletModal() {
  const { t } = useI18n();
  const { isModalOpen, closeModal } = useWallet();
  const { connect, connectors, isPending, error } = useConnect();
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const [switching, setSwitching] = useState(false);

  const isWrongNetwork = isConnected && chainId !== monadTestnet.id;

  // Close modal once connected on the right network
  useEffect(() => {
    if (isConnected && chainId === monadTestnet.id) {
      setSwitching(false);
      closeModal();
    }
  }, [isConnected, chainId, closeModal]);

  // Auto-switch when connected but on wrong network
  useEffect(() => {
    if (isConnected && chainId !== monadTestnet.id) {
      setSwitching(true);
      switchChain({ chainId: monadTestnet.id });
    }
  }, [isConnected, chainId, switchChain]);

  useEffect(() => {
    if (!isModalOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeModal();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isModalOpen, closeModal]);

  if (!isModalOpen) return null;

  const handleConnect = (connector: typeof connectors[number]) => {
    connect({ connector, chainId: monadTestnet.id });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={closeModal} />

      <div className="relative w-full max-w-sm bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <Wallet className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">{t('wallet.connectWallet')}</h2>
          </div>
          <button
            onClick={closeModal}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Network badge */}
        <div className="mx-6 mt-5 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
          <div className="flex items-center gap-1.5 shrink-0">
            <Globe className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">{t('wallet.network')}</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-semibold text-white">Monad Testnet</span>
          </div>
        </div>

        {/* Wrong network warning (if already connected but on wrong chain) */}
        {isWrongNetwork && (
          <div className="mx-6 mt-3 flex items-start gap-2.5 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-amber-400">{t('wallet.wrongNetwork')}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t('wallet.switching')}</p>
            </div>
            {(switching || isSwitching) && (
              <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
            )}
          </div>
        )}

        {/* Connector list */}
        <div className="px-6 py-5">
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            {t('wallet.autoSwitch')}
          </p>

          <div className="space-y-2.5">
            {connectors.map((connector) => {
              const meta = CONNECTOR_META[connector.id] ?? {
                icon: '🔌',
                label: connector.name,
                sub: 'Web3 Wallet',
              };
              const loading = isPending;

              return (
                <button
                  key={connector.uid}
                  onClick={() => handleConnect(connector)}
                  disabled={loading}
                  className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl bg-gray-900 border border-gray-800 hover:border-emerald-500/50 hover:bg-gray-800/80 transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-2xl leading-none">{meta.icon}</span>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">
                      {meta.label}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{meta.sub}</div>
                  </div>
                  {loading ? (
                    <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-emerald-400 transition-colors" />
                  )}
                </button>
              );
            })}
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-400 leading-relaxed">{error.message}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 bg-gray-900/40">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              <span>{t('wallet.autoSwitchFooter')}</span>
            </div>
            <span>{t('wallet.chainId')}</span>
          </div>
          <p className="text-xs text-gray-600 mt-2.5 text-center">
            {t('wallet.terms')}{' '}
            <span className="text-gray-400 cursor-pointer hover:text-white transition-colors">{t('wallet.termsLink')}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
