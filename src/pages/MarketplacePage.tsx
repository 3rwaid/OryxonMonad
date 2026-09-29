import { useState, useEffect } from 'react';
import {
  Search, Tag, ShoppingCart, Coins, Filter,
  TreePine, Wallet, ExternalLink, AlertCircle, Loader, RefreshCw,
} from 'lucide-react';
import { useWallet } from '../lib/wallet-context';
import { useMarketplace } from '../hooks/useMarketplace';
import type { Listing } from '../hooks/useMarketplace';
import { getProvider, getNFTAnimalContract, getNFTTreeContract } from '../lib/contracts';
import { useI18n } from '../lib/i18n';

// ── helpers ──────────────────────────────────────────────────────────────────

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatOxyDisplay(raw: string): string {
  const num = parseFloat(raw);
  if (isNaN(num)) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

const PEXELS_ANIMAL_IDS = [2295744, 3608263, 1661535, 1661179, 2611810, 474968, 1309899, 3551498];
const PEXELS_TREE_IDS   = [1122414, 1179229, 1459495, 1367192, 1084542];

function animalFallback(tokenId: number): string {
  const id = PEXELS_ANIMAL_IDS[tokenId % PEXELS_ANIMAL_IDS.length];
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop`;
}

function treeFallback(tokenId: number): string {
  const id = PEXELS_TREE_IDS[tokenId % PEXELS_TREE_IDS.length];
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop`;
}

// ── metadata cache ────────────────────────────────────────────────────────────

interface NFTMeta {
  name: string;
  image: string;
}

async function resolveURI(uri: string): Promise<string> {
  if (uri.startsWith('ipfs://')) return uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
  return uri;
}

async function fetchNFTMeta(nftType: 'A' | 'B', tokenId: number): Promise<NFTMeta> {
  try {
    const provider = getProvider();
    const contract = nftType === 'A'
      ? await getNFTAnimalContract(provider)
      : await getNFTTreeContract(provider);
    const rawUri: string = await contract.tokenURI(tokenId);
    if (!rawUri) throw new Error('empty uri');
    const uri = await resolveURI(rawUri);
    const res = await fetch(uri);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    let image: string = json.image ?? '';
    if (image.startsWith('ipfs://')) image = await resolveURI(image);
    return {
      name: json.name ?? (nftType === 'A' ? `Animal #${tokenId}` : `Tree #${tokenId}`),
      image: image || (nftType === 'A' ? animalFallback(tokenId) : treeFallback(tokenId)),
    };
  } catch {
    return {
      name: nftType === 'A' ? `Animal #${tokenId}` : `Tree #${tokenId}`,
      image: nftType === 'A' ? animalFallback(tokenId) : treeFallback(tokenId),
    };
  }
}

// ── Listing Card ──────────────────────────────────────────────────────────────

interface ListingCardProps {
  listing: Listing;
  isOwn: boolean;
  isBuying: boolean;
  onBuy: () => void;
  onConnect: () => void;
  isConnected: boolean;
  isTxPending: boolean;
}

function ListingCard({ listing, isOwn, isBuying, onBuy, onConnect, isConnected, isTxPending }: ListingCardProps) {
  const { t } = useI18n();
  const [meta, setMeta] = useState<NFTMeta | null>(null);
  const [imgErr, setImgErr] = useState(false);

  useEffect(() => {
    fetchNFTMeta(listing.nftType === 'A' ? 'A' : 'B', listing.tokenId).then(setMeta);
  }, [listing.nftType, listing.tokenId]);

  const displayName = meta?.name ?? (listing.nftType === 'A' ? `Animal #${listing.tokenId}` : `Tree #${listing.tokenId}`);
  const displayImage = imgErr
    ? (listing.nftType === 'A' ? animalFallback(listing.tokenId) : treeFallback(listing.tokenId))
    : (meta?.image ?? (listing.nftType === 'A' ? animalFallback(listing.tokenId) : treeFallback(listing.tokenId)));

  return (
    <div className="card overflow-hidden group">
      <div className="aspect-square overflow-hidden relative bg-gray-100">
        {meta ? (
          <img
            src={displayImage}
            alt={displayName}
            onError={() => setImgErr(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Loader className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        )}
        <div className="absolute top-3 left-3 flex gap-2">
          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
            listing.nftType === 'A'
              ? 'bg-gold-500/90 text-white'
              : 'bg-forest-500/90 text-white'
          }`}>
            {listing.nftType === 'A' ? t('market.nftA') : t('market.nftB')}
          </span>
        </div>
        {isOwn && (
          <div className="absolute top-3 right-3">
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-900/80 text-white">
              {t('market.yours')}
            </span>
          </div>
        )}
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between mb-1">
          <div className="min-w-0 flex-1 mr-2">
            <h3 className="font-display font-bold text-gray-900 truncate">{displayName}</h3>
            <p className="text-xs text-gray-400">{t('market.listedBy', { seller: shortenAddress(listing.seller) })}</p>
          </div>
          {listing.nftType === 'A' ? (
            <Coins className="w-4 h-4 text-gold-500 flex-shrink-0" />
          ) : (
            <TreePine className="w-4 h-4 text-forest-500 flex-shrink-0" />
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-3">
          <div>
            <p className="text-xs text-gray-400">{t('market.price')}</p>
            <div className="flex items-center gap-1">
              <Coins className="w-4 h-4 text-forest-600" />
              <span className="text-lg font-display font-bold text-gray-900">
                {formatOxyDisplay(listing.priceOxy)}
              </span>
              <span className="text-xs text-gray-400">$OXY</span>
            </div>
          </div>

          {!isConnected ? (
            <button onClick={onConnect} className="btn-secondary text-sm !py-2 !px-4">
              <Wallet className="w-4 h-4" />
              {t('market.connect')}
            </button>
          ) : isOwn ? (
            <span className="text-xs text-gray-400 italic">{t('market.yourListing')}</span>
          ) : (
            <button
              onClick={onBuy}
              disabled={isTxPending}
              className="btn-primary text-sm !py-2 !px-4 disabled:opacity-50"
            >
              {isBuying ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <ShoppingCart className="w-4 h-4" />
              )}
              {isBuying ? t('market.buying') : t('market.buy')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type NFTTypeFilter = 'all' | 'A' | 'B';
type SortBy = 'price-asc' | 'price-desc' | 'newest';

export default function MarketplacePage() {
  const { t } = useI18n();
  const [typeFilter, setTypeFilter] = useState<NFTTypeFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [txFeedback, setTxFeedback] = useState<{ hash: string; url: string } | null>(null);
  const [buyingId, setBuyingId] = useState<number | null>(null);

  const { wallet, connect } = useWallet();
  const {
    listings,
    listingCount,
    platformFeeBps,
    isLoading,
    error,
    isTxPending,
    txError,
    buy,
    refresh,
  } = useMarketplace();

  const feePercent = platformFeeBps / 100;

  const filtered = listings
    .filter((l: Listing) => {
      const matchType = typeFilter === 'all' || l.nftType === typeFilter;
      const label = l.nftType === 'A' ? `Animal #${l.tokenId}` : `Tree #${l.tokenId}`;
      const matchSearch =
        label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shortenAddress(l.seller).includes(searchQuery.toLowerCase());
      return matchType && matchSearch;
    })
    .sort((a: Listing, b: Listing) => {
      if (sortBy === 'price-asc') return parseFloat(a.priceOxy) - parseFloat(b.priceOxy);
      if (sortBy === 'price-desc') return parseFloat(b.priceOxy) - parseFloat(a.priceOxy);
      return b.id - a.id;
    });

  const handleBuy = async (listing: Listing) => {
    setBuyingId(listing.id);
    setTxFeedback(null);
    try {
      const result = await buy(listing.id, listing.priceOxy);
      setTxFeedback({ hash: result.txHash, url: result.explorerUrl });
    } catch {
      // error shown via txError state
    } finally {
      setBuyingId(null);
    }
  };

  return (
    <div>
      <section className="bg-gradient-to-b from-gray-900 to-gray-950 text-white py-16 sm:py-20 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-10 left-1/4 w-80 h-80 bg-forest-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-1/4 w-60 h-60 bg-gold-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-4xl sm:text-5xl font-display font-extrabold mb-4">
            {t('market.title1')} <span className="gradient-text">{t('market.title2')}</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10">
            {t('market.desc')}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3 text-center">
              <p className="text-xl font-display font-bold">{isLoading ? '...' : listingCount}</p>
              <p className="text-xs text-gray-400 mt-1">{t('market.activeListings')}</p>
            </div>
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3 text-center">
              <p className="text-xl font-display font-bold">{isLoading ? '...' : `${feePercent}%`}</p>
              <p className="text-xs text-gray-400 mt-1">{t('market.platformFee')}</p>
            </div>
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
              <p className="text-xl font-display font-bold">$OXY</p>
              <p className="text-xs text-gray-400 mt-1">{t('market.tradingCurrency')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-4 bg-white border-b border-gray-100 sticky top-16 z-30 bg-white/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-2 sm:gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder={t('market.searchNameSeller')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-forest-400 focus:ring-2 focus:ring-forest-100 outline-none transition-all text-sm"
              />
            </div>

            {/* Mobile: toggle button */}
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`sm:hidden flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors shrink-0 ${
                showFilters || typeFilter !== 'all'
                  ? 'border-forest-400 bg-forest-50 text-forest-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              {t('market.filters')}
              {typeFilter !== 'all' && <span className="w-1.5 h-1.5 rounded-full bg-forest-500" />}
            </button>

            {/* Desktop: always visible */}
            <div className="hidden sm:flex gap-2 items-center shrink-0">
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                {(['all', 'A', 'B'] as NFTTypeFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setTypeFilter(f)}
                    className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${
                      typeFilter === f ? 'bg-white shadow-sm text-forest-700' : 'text-gray-500'
                    }`}
                  >
                    {f === 'all' ? t('market.all') : f === 'A' ? t('market.nftA') : t('market.nftB')}
                  </button>
                ))}
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none bg-white"
              >
                <option value="newest">{t('market.sortNewest')}</option>
                <option value="price-asc">{t('market.sortPriceAsc')}</option>
                <option value="price-desc">{t('market.sortPriceDesc')}</option>
              </select>
              <button
                onClick={refresh}
                disabled={isLoading}
                className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
                title="Refresh listings"
              >
                <RefreshCw className={`w-4 h-4 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Mobile: collapsible filter panel */}
          {showFilters && (
            <div className="sm:hidden mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2 items-center">
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                {(['all', 'A', 'B'] as NFTTypeFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setTypeFilter(f)}
                    className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${
                      typeFilter === f ? 'bg-white shadow-sm text-forest-700' : 'text-gray-500'
                    }`}
                  >
                    {f === 'all' ? t('market.all') : f === 'A' ? t('market.nftA') : t('market.nftB')}
                  </button>
                ))}
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none bg-white"
              >
                <option value="newest">{t('market.sortNewest')}</option>
                <option value="price-asc">{t('market.sortPriceAsc')}</option>
                <option value="price-desc">{t('market.sortPriceDesc')}</option>
              </select>
              <button
                onClick={refresh}
                disabled={isLoading}
                className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
                title="Refresh listings"
              >
                <RefreshCw className={`w-4 h-4 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="py-10 bg-gray-50 min-h-[400px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {txFeedback && (
            <div className="mb-6 p-4 rounded-xl bg-forest-50 border border-forest-200 flex items-center justify-between">
              <p className="text-sm text-forest-700 font-medium">Purchase confirmed!</p>
              <a
                href={txFeedback.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-forest-600 hover:text-forest-800"
              >
                {t('market.viewTx')} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {(txError || error) && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-600">{txError || error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader className="w-8 h-8 animate-spin text-forest-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Tag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">{t('market.noListings')}</p>
              {listings.length === 0 && (
                <p className="text-sm text-gray-400 mt-2">{t('market.noListingsDesc')}</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((listing: Listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  isOwn={wallet.address?.toLowerCase() === listing.seller.toLowerCase()}
                  isBuying={buyingId === listing.id}
                  onBuy={() => handleBuy(listing)}
                  onConnect={connect}
                  isConnected={wallet.isConnected}
                  isTxPending={isTxPending}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
