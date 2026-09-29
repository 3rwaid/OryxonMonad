import { useState, useEffect } from 'react';
import {
  Award, Minus, Plus, ShoppingCart, Clock, Users,
  Shield, Gift, Sparkles, Check, ExternalLink, AlertCircle, Loader,
  RefreshCw, Layers, Info, Tag, Coins, X, ChevronRight,
} from 'lucide-react';
import SectionHeading from '../components/shared/SectionHeading';
import { useWallet } from '../lib/wallet-context';
import { useNFTAnimal, type AnimalMetadata } from '../hooks/useNFTAnimal';
import { useMarketplace } from '../hooks/useMarketplace';
import { useI18n } from '../lib/i18n';

// ── constants ────────────────────────────────────────────────────────────────

const PHASE_KEYS: Record<number, string> = {
  0: 'nfta.phase.closed',
  1: 'nfta.phase.presale',
  2: 'nfta.phase.public',
};

type ActiveTab = 'mint' | 'my-animals' | 'sell';

// ── helpers ──────────────────────────────────────────────────────────────────

function AnimalImageArea({ animal, className = '' }: { animal: AnimalMetadata; className?: string }) {
  const [imgError, setImgError] = useState(false);
  const [gatewayIdx, setGatewayIdx] = useState(0);
  const hasImage = !imgError && !!animal.image;
  const bg = 'from-gray-700 to-gray-900';

  const gateways = [
    'https://dweb.link/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://ipfs.io/ipfs/',
  ];

  if (hasImage) {
    let imgSrc = animal.image;
    const ipfsMatch = animal.image.match(/\/ipfs\/(.+)/);
    if (ipfsMatch) {
      const cid = ipfsMatch[1];
      imgSrc = gateways[Math.min(gatewayIdx, gateways.length - 1)] + cid;
    }

    return (
      <img
        src={imgSrc}
        alt={animal.name}
        onError={() => {
          if (ipfsMatch && gatewayIdx < gateways.length - 1) {
            setGatewayIdx(gatewayIdx + 1);
          } else {
            setImgError(true);
          }
        }}
        className={`w-full h-full object-cover ${className}`}
      />
    );
  }

  return (
    <div className={`w-full h-full bg-gradient-to-br ${bg} flex flex-col items-center justify-center gap-2`}>
      <Award className="w-10 h-10 text-white/40" />
      <span className="text-white/30 text-xs font-mono">#{animal.tokenId}</span>
    </div>
  );
}

function AnimalCard({ animal, compact = false }: { animal: AnimalMetadata; compact?: boolean }) {
  return (
    <div className="card overflow-hidden group hover:shadow-lg transition-all duration-300">
      <div className="relative aspect-square overflow-hidden bg-gray-800">
        <AnimalImageArea
          animal={animal}
          className="group-hover:scale-110 transition-transform duration-500"
        />
      </div>
      <div className="p-3">
        {!compact && animal.attributes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {animal.attributes.slice(0, 3).map((attr) => (
              <span
                key={attr.trait_type}
                className="text-[9px] bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5 text-gray-500"
              >
                {attr.trait_type}: {attr.value}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1 mt-2">
          <span className="text-[10px] text-gray-400">ID #{animal.tokenId}</span>
        </div>
      </div>
    </div>
  );
}

// ── My Animals Tab ────────────────────────────────────────────────────────────

function MyAnimalsTab({ onGoSell }: { onGoSell: () => void }) {
  const { wallet, connect } = useWallet();
  const { getOwnedAnimals, mintedByWallet } = useNFTAnimal();
  const [animals, setAnimals] = useState<AnimalMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();

  const load = async () => {
    if (!wallet.isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getOwnedAnimals();
      setAnimals(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('nfta.failedLoad'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [wallet.address]);

  if (!wallet.isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gold-50 flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8 text-gold-500" />
        </div>
        <h3 className="text-xl font-display font-bold text-gray-900 mb-2">{t('nfta.connectWallet')}</h3>
        <p className="text-gray-500 max-w-sm mb-6">{t('nfta.connectDesc')}</p>
        <button onClick={connect} className="btn-primary">{t('nfta.connectWallet')}</button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader className="w-8 h-8 text-gold-500 animate-spin mb-3" />
        <p className="text-gray-500 text-sm">{t('nfta.loadingAnimals')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
        <p className="text-red-600 font-medium mb-2">{t('nfta.failedLoad')}</p>
        <p className="text-gray-500 text-sm mb-4">{error}</p>
        <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className="w-4 h-4" /> {t('nfta.retry')}
        </button>
      </div>
    );
  }

  if (animals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <Layers className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-xl font-display font-bold text-gray-900 mb-2">{t('nfta.noAnimals')}</h3>
        <p className="text-gray-500 max-w-sm">
          {t('nfta.noAnimalsDesc')}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-display font-bold text-gray-900">{t('nfta.yourCollection')}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{t('nfta.animalsOwned', { count: animals.length })}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onGoSell}
            className="btn-gold text-sm flex items-center gap-2"
          >
            <Tag className="w-4 h-4" />
            {t('nfta.listForSale')}
          </button>
          <button
            onClick={load}
            disabled={isLoading}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            {t('nfta.refresh')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
        {animals.map((animal) => (
          <AnimalCard key={animal.tokenId} animal={animal} />
        ))}
      </div>
    </div>
  );
}

// ── Sell Modal ────────────────────────────────────────────────────────────────

interface SellModalProps {
  animal: AnimalMetadata;
  onClose: () => void;
  onSuccess: () => void;
}

function SellModal({ animal, onClose, onSuccess }: SellModalProps) {
  const [price, setPrice] = useState('');
  const [isListing, setIsListing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const { listNFTA } = useMarketplace();
  const bg = 'from-gray-700 to-gray-900';
  const { t } = useI18n();

  const handleList = async () => {
    const priceNum = parseFloat(price);
    if (!price || isNaN(priceNum) || priceNum <= 0) {
      setError(t('nfta.failedLoad'));
      return;
    }
    setIsListing(true);
    setError(null);
    try {
      const result = await listNFTA(animal.tokenId, price);
      setTxHash(result.txHash);
      setTimeout(onSuccess, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('nfta.listing'));
    } finally {
      setIsListing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-display font-bold text-gray-900">{t('nfta.listAnimalTitle')}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 bg-gradient-to-br ${bg} flex items-center justify-center`}>
              {animal.image ? (
                <img src={animal.image} alt={animal.name} className="w-full h-full object-cover" />
              ) : (
                <Award className="w-8 h-8 text-white/50" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-gray-900">NFT #{animal.tokenId}</h3>
              <p className="text-sm text-gray-500 mb-1">ID #{animal.tokenId}</p>
            </div>
          </div>

          {txHash ? (
            <div className="bg-forest-50 border border-forest-200 rounded-2xl p-4 text-center">
              <Check className="w-8 h-8 text-forest-500 mx-auto mb-2" />
              <p className="font-semibold text-forest-800 mb-1">{t('nfta.listedSuccess')}</p>
              <a
                href={`https://testnet.monadexplorer.com/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-forest-600 hover:text-forest-800"
              >
                {t('nfta.viewTx')} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ) : (
            <>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-5 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  {t('nfta.listingInfo')}
                </p>
              </div>

              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('nfta.salePrice')}
              </label>
              <div className="relative mb-5">
                <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 1000"
                  className="w-full pl-10 pr-16 py-3 rounded-xl border border-gray-200 focus:border-forest-400 focus:ring-2 focus:ring-forest-100 outline-none text-lg font-semibold"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">$OXY</span>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}

              <button
                onClick={handleList}
                disabled={isListing || !price}
                className="w-full btn-gold py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isListing ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader className="w-5 h-5 animate-spin" />
                    {t('nfta.listing')}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Tag className="w-5 h-5" />
                    {t('nfta.listFor', { price: price || '—' })}
                  </span>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SellableAnimalCard({ animal, onSelect }: { animal: AnimalMetadata; onSelect: () => void }) {
  const { t } = useI18n();
  const bg = 'from-gray-700 to-gray-900';
  return (
    <div className="card overflow-hidden group">
      <div className="relative aspect-square overflow-hidden bg-gray-800">
        {animal.image ? (
          <img
            src={animal.image}
            alt={`NFT #${animal.tokenId}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${bg} flex flex-col items-center justify-center gap-2`}>
            <Award className="w-10 h-10 text-white/40" />
            <span className="text-white/30 text-xs font-mono">#{animal.tokenId}</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="font-bold text-gray-900 text-sm truncate">NFT #{animal.tokenId}</p>
        <button
          onClick={onSelect}
          className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold bg-gray-900 text-white rounded-xl py-2.5 hover:bg-gray-700 transition-colors"
        >
          <Tag className="w-3.5 h-3.5" />
          {t('nfta.listForSale')}
        </button>
      </div>
    </div>
  );
}

// ── Sell Tab ──────────────────────────────────────────────────────────────────

function SellTab() {
  const { wallet, connect } = useWallet();
  const { getOwnedAnimals } = useNFTAnimal();
  const { listings, cancelListing, isTxPending } = useMarketplace();
  const [animals, setAnimals] = useState<AnimalMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnimal, setSelectedAnimal] = useState<AnimalMetadata | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const { t } = useI18n();

  const myListings = listings.filter(
    (l) => l.nftType === 'A' && l.seller.toLowerCase() === wallet.address?.toLowerCase()
  );

  const load = async () => {
    if (!wallet.isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getOwnedAnimals();
      setAnimals(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('nfta.failedLoad'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [wallet.address]);

  const handleCancel = async (listingId: number) => {
    setCancellingId(listingId);
    setCancelError(null);
    try {
      await cancelListing(listingId);
      await load();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : t('nfta.cancel'));
    } finally {
      setCancellingId(null);
    }
  };

  if (!wallet.isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gold-50 flex items-center justify-center mb-4">
          <Tag className="w-8 h-8 text-gold-500" />
        </div>
        <h3 className="text-xl font-display font-bold text-gray-900 mb-2">{t('nfta.connectWallet')}</h3>
        <p className="text-gray-500 max-w-sm mb-6">{t('nfta.connectDescSell')}</p>
        <button onClick={connect} className="btn-primary">{t('nfta.connectWallet')}</button>
      </div>
    );
  }

  return (
    <div>
      {selectedAnimal && (
        <SellModal
          animal={selectedAnimal}
          onClose={() => setSelectedAnimal(null)}
          onSuccess={() => { setSelectedAnimal(null); load(); }}
        />
      )}

      {/* Active listings */}
      {myListings.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xl font-display font-bold text-gray-900 mb-4">
            {t('nfta.yourListings')}
            <span className="ml-2 text-sm font-normal text-gray-400">({myListings.length})</span>
          </h2>
          {cancelError && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-600">{cancelError}</p>
            </div>
          )}
          <div className="space-y-3">
            {myListings.map((listing) => {
              const isCancelling = cancellingId === listing.id;
              const bg = 'from-gray-700 to-gray-900';
              return (
                <div key={listing.id} className="flex items-center gap-4 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                  <div className={`w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br ${bg} flex items-center justify-center`}>
                    <Award className="w-6 h-6 text-white/40" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">Animal #{listing.tokenId}</p>
                    <div className="flex items-center gap-1 text-sm text-forest-600 mt-0.5">
                      <Coins className="w-3.5 h-3.5" />
                      <span className="font-semibold">{parseFloat(listing.priceOxy).toLocaleString()}</span>
                      <span className="text-gray-400 text-xs">$OXY</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-forest-50 text-forest-700 border border-forest-200">
                    {t('nfta.listed')}
                  </span>
                  <button
                    onClick={() => handleCancel(listing.id)}
                    disabled={isTxPending || isCancelling}
                    className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors px-3 py-1.5 rounded-xl hover:bg-red-50"
                  >
                    {isCancelling ? <Loader className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                    {t('nfta.cancel')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Animals available to list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-display font-bold text-gray-900">
            {t('nfta.animalsToList')}
            {animals.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-400">({animals.length})</span>
            )}
          </h2>
          <button
            onClick={load}
            disabled={isLoading}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            {t('nfta.refresh')}
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader className="w-7 h-7 text-gold-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="w-7 h-7 text-red-400 mb-3" />
            <p className="text-red-600 text-sm mb-3">{error}</p>
            <button onClick={load} className="btn-secondary text-sm">{t('nfta.retry')}</button>
          </div>
        ) : animals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Layers className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">{t('nfta.noAnimalsWallet')}</p>
            <p className="text-sm text-gray-400 mt-1">{t('nfta.mintFirst')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {animals.map((animal) => (
              <SellableAnimalCard
                key={animal.tokenId}
                animal={animal}
                onSelect={() => setSelectedAnimal(animal)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function NFTAPage() {
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<ActiveTab>('mint');
  const { wallet, connect } = useWallet();
  const {
    totalMinted,
    maxSupply,
    mintPrice,
    mintedByWallet,
    maxPerWallet,
    currentPhase,
    isLoading,
    isMinting,
    mintError,
    mintTx,
    isWrongNetwork,
    switchToMonad,
    mint,
  } = useNFTAnimal();

  const { listings } = useMarketplace();
  const { t } = useI18n();
  const myListingCount = listings.filter(
    (l) => l.nftType === 'A' && l.seller.toLowerCase() === wallet.address?.toLowerCase()
  ).length;

  const progress = maxSupply > 0 ? (totalMinted / maxSupply) * 100 : 0;
  const remaining = maxPerWallet - mintedByWallet;
  const maxQty = Math.min(maxPerWallet, remaining);

  const handleMint = async () => {
    try {
      await mint(quantity);
    } catch {
      // error shown via mintError state
    }
  };

  const tabs: { key: ActiveTab; label: string; badge?: number }[] = [
    { key: 'mint', label: t('nfta.tab.mint') },
    { key: 'my-animals', label: t('nfta.tab.myAnimals'), badge: mintedByWallet > 0 ? mintedByWallet : undefined },
    { key: 'sell', label: t('nfta.tab.sell'), badge: myListingCount > 0 ? myListingCount : undefined },
  ];

  return (
    <div>
      {/* ── Hero ── */}
      <section className="relative bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 text-white py-20 sm:py-28 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-10 right-20 w-80 h-80 bg-gold-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-20 w-60 h-60 bg-forest-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl sm:text-5xl font-display font-extrabold leading-tight mb-6">
                {t('nfta.title1')}
                <br />
                <span className="bg-gradient-to-r from-gold-300 to-gold-500 bg-clip-text text-transparent">
                  {t('nfta.title2')}
                </span>
              </h1>

              <p className="text-lg text-gray-400 mb-8 leading-relaxed">
                {t('nfta.desc')}
              </p>

              <div className="relative h-24 mb-8 max-w-xl overflow-hidden" aria-hidden="true">
                <svg viewBox="0 0 640 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 h-full w-full">
                  <defs>
                    <linearGradient id="hero-line" x1="0" y1="48" x2="640" y2="48" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#D6A84F" stopOpacity="0" />
                      <stop offset="0.2" stopColor="#D6A84F" stopOpacity="0.8" />
                      <stop offset="0.8" stopColor="#5E9B78" stopOpacity="0.65" />
                      <stop offset="1" stopColor="#5E9B78" stopOpacity="0" />
                    </linearGradient>
                    <filter id="hero-glow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <path d="M0 56C76 18 128 79 205 45C286 9 337 77 416 42C495 8 551 68 640 25" stroke="url(#hero-line)" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M0 72C74 39 130 91 211 62C291 34 341 89 421 56C504 22 557 79 640 45" stroke="url(#hero-line)" strokeOpacity="0.35" strokeWidth="1" strokeLinecap="round" />
                  <g filter="url(#hero-glow)" fill="#E7C16D">
                    <circle cx="205" cy="45" r="3" />
                    <circle cx="416" cy="42" r="2.5" />
                  </g>
                  <g fill="#78B894">
                    <circle cx="128" cy="58" r="2" />
                    <circle cx="337" cy="55" r="2" />
                    <circle cx="551" cy="47" r="2" />
                  </g>
                </svg>
              </div>


            </div>

            {/* Mint card */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-3xl border border-gray-700/50 p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm text-gray-400">{t('nfta.currentPhase')}</p>
                  <p className="text-xl font-display font-bold">
                    {isLoading ? '...' : t(PHASE_KEYS[currentPhase] ?? 'nfta.phase.closed')}
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${currentPhase === 0 ? 'bg-red-500/20 text-red-400' : 'bg-forest-500/20 text-forest-400'}`}>
                  {currentPhase === 0 ? 'ENDED' : 'LIVE'}
                </div>
              </div>

              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">
                    {isLoading ? t('nfta.loading') : `${totalMinted.toLocaleString()} / ${maxSupply.toLocaleString()} ${t('nfta.minted')}`}
                  </span>
                  <span className="text-white font-semibold">{progress.toFixed(1)}%</span>
                </div>
                <div className="h-3 rounded-full bg-gray-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-400 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="bg-gray-900/50 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-400">{t('nfta.pricePerNft')}</span>
                  <span className="text-2xl font-display font-bold">
                    {isLoading ? '...' : `${parseFloat(mintPrice).toFixed(4)} MON`}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">{t('nfta.quantity')}</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={isMinting}
                      className="w-8 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition-colors disabled:opacity-50"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-xl font-bold w-8 text-center">{quantity}</span>
                    <button
                      onClick={() => setQuantity(Math.min(Math.max(1, maxQty), quantity + 1))}
                      disabled={isMinting || quantity >= maxQty}
                      className="w-8 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition-colors disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm mb-6 px-1">
                <span className="text-gray-400">{t('nfta.total')}</span>
                <span className="text-xl font-bold">
                  {isLoading ? '...' : `${(quantity * parseFloat(mintPrice)).toFixed(4)} MON`}
                </span>
              </div>

              {mintTx && (
                <div className="mb-4 p-3 rounded-xl bg-forest-500/10 border border-forest-500/20">
                  <p className="text-sm text-forest-400 font-medium mb-1">{t('nfta.mintSuccess')}</p>
                  <a
                    href={mintTx.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-forest-300 hover:text-forest-200 transition-colors"
                  >
                    {t('nfta.viewExplorer')} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {mintError && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-400">{mintError}</p>
                </div>
              )}

              {!wallet.isConnected ? (
                <button onClick={connect} className="w-full btn-primary text-base py-4">
                  {t('nfta.connectToMint')}
                </button>
              ) : isWrongNetwork ? (
                <button onClick={switchToMonad} className="w-full btn-gold text-base py-4">
                  {t('nfta.switchNetwork')}
                </button>
              ) : (
                <button
                  onClick={handleMint}
                  disabled={isMinting || isLoading || maxQty <= 0 || currentPhase === 0}
                  className="w-full btn-gold text-base py-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isMinting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader className="w-5 h-5 animate-spin" />
                      {t('nfta.minting')}
                    </span>
                  ) : currentPhase === 0 ? (
                    t('nfta.saleClosed')
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <ShoppingCart className="w-5 h-5" />
                      {t('nfta.mintN', { qty: quantity })}
                    </span>
                  )}
                </button>
              )}

              <div className="flex items-center justify-between mt-3 px-1">
                <p className="text-xs text-gray-500">{t('nfta.maxPerWallet', { max: maxPerWallet })}</p>
                {wallet.isConnected && (
                  <p className="text-xs text-gray-500">{t('nfta.mintedCount', { minted: mintedByWallet, max: maxPerWallet })}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Tabs ── */}
      <section className="py-16 bg-gray-50 min-h-[600px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 p-1 bg-white border border-gray-200 rounded-2xl w-fit mb-10 shadow-sm flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  activeTab === tab.key
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {tab.label}
                {tab.badge !== undefined && (
                  <span className="ml-2 text-[10px] bg-gold-500 text-white rounded-full px-1.5 py-0.5 font-bold">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {activeTab === 'mint' && (
            <div className="max-w-2xl">
              <SectionHeading
                badge={t('nfta.howBadge')}
                title={t('nfta.howTitle')}
                subtitle={t('nfta.howSubtitle')}
              />
              <div className="space-y-4 mt-8">
                {[
                  { step: 1, title: t('nfta.step1.title'), desc: t('nfta.step1.desc') },
                  { step: 2, title: t('nfta.step2.title'), desc: t('nfta.step2.desc') },
                  { step: 3, title: t('nfta.step3.title'), desc: t('nfta.step3.desc', { max: maxPerWallet }) },
                  { step: 4, title: t('nfta.step4.title'), desc: t('nfta.step4.desc', { price: mintPrice }) },
                  { step: 5, title: t('nfta.step5.title'), desc: t('nfta.step5.desc') },
                ].map((s) => (
                  <div key={s.step} className="flex gap-4 bg-white border border-gray-100 rounded-2xl p-5">
                    <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {s.step}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 mb-0.5">{s.title}</p>
                      <p className="text-sm text-gray-500">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 bg-white border border-gray-100 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{t('nfta.sellPrompt')}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{t('nfta.sellPromptDesc')}</p>
                </div>
                <button
                  onClick={() => setActiveTab('sell')}
                  className="btn-gold text-sm flex items-center gap-2 flex-shrink-0"
                >
                  {t('nfta.sell')} <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'my-animals' && (
            <MyAnimalsTab onGoSell={() => setActiveTab('sell')} />
          )}

          {activeTab === 'sell' && <SellTab />}
        </div>
      </section>

      {/* ── Benefits ── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionHeading badge={t('nfta.benefitsBadge')} title={t('nfta.benefitsTitle')} />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: <Gift className="w-6 h-6" />, title: t('nfta.b1f.title'), desc: t('nfta.b1f.desc') },
              { icon: <Shield className="w-6 h-6" />, title: t('nfta.b3f.title'), desc: t('nfta.b3f.desc') },
              { icon: <Clock className="w-6 h-6" />, title: t('nfta.b4f.title'), desc: t('nfta.b4f.desc') },
              { icon: <Users className="w-6 h-6" />, title: t('nfta.b5f.title'), desc: t('nfta.b5f.desc') },
              { icon: <Award className="w-6 h-6" />, title: t('nfta.b6f.title'), desc: t('nfta.b6f.desc') },
            ].map((b) => (
              <div key={b.title} className="card p-6 hover:shadow-md transition-shadow duration-200">
                <div className="w-12 h-12 rounded-xl bg-gold-50 text-gold-600 flex items-center justify-center mb-4">
                  {b.icon}
                </div>
                <h3 className="font-display font-bold text-gray-900 mb-2">{b.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
