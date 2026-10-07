import { useState, useCallback, useEffect } from 'react';
import {
  TreePine, MapPin, Calendar, User, Search, Filter,
  Leaf, Info, TreeDeciduous, Wallet, Loader, ExternalLink,
  AlertCircle, CheckCircle, Lock, Unlock, Coins, RefreshCw,
  ChevronRight, Clock, ShoppingCart, Tag, CreditCard, X,
  Plus, Minus,
} from 'lucide-react';
import SectionHeading from '../components/shared/SectionHeading';
import { useI18n } from '../lib/i18n';
import { useWallet } from '../lib/wallet-context';
import { useNFTTree, type TreeData } from '../hooks/useNFTTree';
import { useStaking } from '../hooks/useStaking';
import { useMarketplace, type Listing } from '../hooks/useMarketplace';
import { useAppSettings } from '../hooks/useAppSettings';
import { useSwitchChain } from 'wagmi';
import { monadTestnet } from '../lib/wagmi-config';
import { TREE_SPECIES } from '../lib/constants';
import { getSigner, getOxyTokenContract, parseOxy, getExplorerTxUrl } from '../lib/contracts';
import { supabase } from '../lib/supabase';



// ── helpers ──────────────────────────────────────────────────────────────────

function TreeImagePlaceholder({ species, tokenId, className = '' }: { species?: string; tokenId?: number; className?: string }) {
  return (
    <div className={`w-full h-full bg-gradient-to-br from-forest-900 via-forest-800 to-gray-900 flex flex-col items-center justify-center gap-2 ${className}`}>
      <TreePine className="w-10 h-10 text-forest-400/60" />
      {species && <span className="text-forest-300/50 text-xs font-semibold">{species}</span>}
      {tokenId !== undefined && <span className="text-white/20 text-xs font-mono">#{tokenId}</span>}
    </div>
  );
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function secondsUntilClaim(lastClaimAt: number, claimPeriod: number): number {
  return Math.max(0, lastClaimAt + claimPeriod - Math.floor(Date.now() / 1000));
}

function formatCountdown(seconds: number): string {
  if (seconds === 0) return 'Ready';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function shortenAddr(addr: string): string {
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

// ── types ────────────────────────────────────────────────────────────────────

type ActiveTab = 'shop' | 'my-trees' | 'sell' | 'how-it-works';

interface TxFeedback {
  hash: string;
  url: string;
  action: string;
}

// ── Buy Modal (fiat + OXY) ────────────────────────────────────────────────────

interface BuyNewModalProps {
  walletAddress: string;
  oxyBalance: string;
  onClose: () => void;
  onSuccess: (result: { method: 'fiat' | 'oxy'; txHash?: string; detail: string }) => void;
}

function BuyNewModal({ walletAddress, oxyBalance, onClose, onSuccess }: BuyNewModalProps) {
  const { t } = useI18n();
  const [method, setMethod] = useState<'fiat' | 'oxy'>('fiat');
  const [species, setSpecies] = useState(TREE_SPECIES[0]);
  const [quantity, setQuantity] = useState(1);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const { settings, isLoading: settingsLoading } = useAppSettings();

  const priceIdr = settings.tree_price_idr;
  const priceOxy = settings.tree_price_oxy;
  const maxQty = settings.max_order_quantity;
  const receiverWallet = settings.oxy_receiver_wallet;

  const totalIdr = priceIdr * quantity;
  const totalOxy = priceOxy * quantity;
  const hasEnoughOxy = parseFloat(oxyBalance) >= totalOxy;
  const hasReceiver = receiverWallet && receiverWallet.startsWith('0x');

  useEffect(() => {
    setQuantity(1);
  }, [maxQty]);

  const handleSubmit = async () => {
    setError(null);
    setSubmitStep('');
    if (!walletAddress) { setError('Wallet not connected.'); return; }

    if (method === 'fiat') {
      if (!email.includes('@')) { setError('Please enter a valid email address.'); return; }
      setIsSubmitting(true);
      setSubmitStep('Creating DOKU Checkout...');
      try {
        const fnRes = await supabase.functions.invoke('create-doku-transaction', {
          body: { buyer_wallet: walletAddress, buyer_email: email, tree_species: species, quantity },
        });
        if (fnRes.error) {
          const detail = (fnRes.data as { error?: string } | null)?.error ?? fnRes.error.message;
          throw new Error(detail);
        }
        const { payment_url } = fnRes.data as { payment_url?: string };
        if (!payment_url) throw new Error('DOKU Checkout URL was not returned.');
        window.location.assign(payment_url);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Payment could not be started.');
        setIsSubmitting(false);
        setSubmitStep('');
      }
      return;
    }

    // OXY payment — real on-chain transfer
    if (!hasEnoughOxy) { setError(`Insufficient $OXY. Need ${totalOxy.toLocaleString()} OXY but you have ${parseFloat(oxyBalance).toFixed(2)}.`); return; }
    if (!hasReceiver) { setError('OXY payment receiver wallet is not configured yet. Please use fiat or contact support.'); return; }

    setIsSubmitting(true);
    let orderId: string | null = null;
    try {
      // 1. Create pending order server-side (service role — no SELECT grant needed)
      setSubmitStep('Creating order...');
      const fnRes = await supabase.functions.invoke('create-order', {
        body: {
          buyer_wallet: walletAddress,
          buyer_email: email,
          payment_method: 'oxy',
          tree_species: species,
          quantity,
          unit_price_idr: priceIdr,
          total_price_idr: totalIdr,
          oxy_amount: totalOxy,
        },
      });
      if (fnRes.error) {
        const detail =
          (fnRes.data as { error?: string } | null)?.error ??
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (fnRes.error as any)?.context?.json?.error ??
          fnRes.error.message;
        throw new Error(detail);
      }
      orderId = (fnRes.data as { order_id: string }).order_id;
      if (!orderId) throw new Error('Failed to create order. Please try again.');

      // 2. Execute on-chain OXY transfer
      setSubmitStep('Waiting for wallet confirmation...');
      const signer = await getSigner();
      const oxyContract = await getOxyTokenContract(signer);
      const amountWei = parseOxy(totalOxy.toString());
      const tx = await oxyContract.transfer(receiverWallet, amountWei);

      setSubmitStep('Confirming transaction...');
      await tx.wait();

      // 3. Update order with tx hash and paid status
      setSubmitStep('Finalizing order...');
      await supabase
        .from('tree_purchase_orders')
        .update({ status: 'paid', tx_hash: tx.hash })
        .eq('id', orderId);

      onSuccess({
        method: 'oxy',
        txHash: tx.hash,
        detail: `Payment confirmed! ${totalOxy.toLocaleString()} OXY sent. Your tree NFT will be minted shortly.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transaction failed';
      setError(msg.startsWith('wrong_network:')
        ? 'Please switch to Monad Testnet first.'
        : msg.includes('user rejected') || msg.includes('User rejected')
        ? 'Transaction was rejected in wallet.'
        : msg);
      // Mark order cancelled if it was created but tx failed
      if (orderId) {
        await supabase.from('tree_purchase_orders').update({ status: 'cancelled' }).eq('id', orderId);
      }
    } finally {
      setIsSubmitting(false);
      setSubmitStep('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-forest-900 to-forest-800 p-6 text-white sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-forest-700/50 flex items-center justify-center">
                <TreePine className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display font-bold text-lg">{t('nftb.buyTree')}</h2>
                <p className="text-forest-300 text-xs">{t('nftb.realTreePlanted')}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-forest-700/50 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {settingsLoading ? (
            <div className="flex items-center justify-center py-8"><Loader className="w-6 h-6 animate-spin text-forest-500" /></div>
          ) : (
            <>
              {/* Payment method */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('nftb.paymentMethod')}</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'fiat' as const, icon: <CreditCard className="w-5 h-5" />, label: t('nftb.fiatMethod'), sub: `Rp${priceIdr.toLocaleString('id-ID')}${t('nftb.perTree')}`, disabled: false },
                    { id: 'oxy' as const, icon: <Coins className="w-5 h-5" />, label: t('nftb.oxyMethod'), sub: `${priceOxy.toLocaleString()} OXY${t('nftb.perTree')}`, disabled: false },
                  ].map((opt) => (
                    <button key={opt.id} onClick={() => !opt.disabled && setMethod(opt.id)}
                      className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                        opt.disabled ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                        : method === opt.id ? 'border-forest-500 bg-forest-50' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                      <span className={method === opt.id ? 'text-forest-600' : 'text-gray-400'}>{opt.icon}</span>
                      <div>
                        <p className={`text-sm font-semibold ${method === opt.id ? 'text-forest-700' : 'text-gray-700'}`}>{opt.label}</p>
                        <p className="text-xs text-gray-400">{opt.sub}</p>
                      </div>
                      {opt.disabled && (
                        <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                          {t('nftb.fiatComingSoon')}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Species */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">{t('nftb.treeSpecies')}</label>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select value={species} onChange={(e) => setSpecies(e.target.value)}
                    className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 focus:border-forest-400 focus:ring-2 focus:ring-forest-100 outline-none text-sm appearance-none bg-white">
                    {TREE_SPECIES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">{t('nftb.quantityMax', { max: maxQty })}</label>
                <div className="flex items-center gap-4">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-2xl font-display font-bold w-8 text-center">{quantity}</span>
                  <button onClick={() => setQuantity(Math.min(maxQty, quantity + 1))}
                    className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Email — fiat */}
              {method === 'fiat' && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">{t('nftb.emailLabel')}</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-forest-400 focus:ring-2 focus:ring-forest-100 outline-none text-sm" />
                </div>
              )}

              {/* OXY balance */}
              {method === 'oxy' && (
                <div className={`flex items-center justify-between p-3 rounded-xl ${hasEnoughOxy ? 'bg-forest-50' : 'bg-red-50'}`}>
                  <span className="text-sm text-gray-600">{t('nftb.yourOxyBalance')}</span>
                  <span className={`text-sm font-semibold ${hasEnoughOxy ? 'text-forest-700' : 'text-red-600'}`}>
                    {parseFloat(oxyBalance).toLocaleString(undefined, { maximumFractionDigits: 2 })} OXY
                  </span>
                </div>
              )}

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{quantity} × {species}</span>
                  <span className="font-medium">
                    {method === 'fiat' ? `Rp${priceIdr.toLocaleString('id-ID')} × ${quantity}` : `${priceOxy.toLocaleString()} × ${quantity}`}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-2 mt-2">
                  <span>Total</span>
                  <span className={method === 'oxy' ? 'text-forest-700' : 'text-gray-900'}>
                    {method === 'fiat' ? `Rp${totalIdr.toLocaleString('id-ID')}` : `${totalOxy.toLocaleString()} OXY`}
                  </span>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {!hasReceiver && method === 'oxy' && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">OXY receiver wallet is not configured by admin yet. Use fiat payment instead.</p>
                </div>
              )}

              <div className="bg-amber-50 rounded-xl p-3 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  {method === 'fiat'
                    ? t('nftb.dokuInfo')
                    : t('nftb.oxyPaymentInfo', { addr: walletAddress.slice(0, 8) })}
                </p>
              </div>

              {isSubmitting && submitStep && (
                <div className="flex items-center gap-3 p-3 bg-forest-50 rounded-xl">
                  <Loader className="w-4 h-4 animate-spin text-forest-600 shrink-0" />
                  <p className="text-sm text-forest-700 font-medium">{submitStep}</p>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={isSubmitting || (method === 'oxy' && (!hasEnoughOxy || !hasReceiver))}
                className="w-full btn-primary py-4 text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <Loader className="w-5 h-5 animate-spin" />
                  : method === 'fiat' ? <CreditCard className="w-5 h-5" />
                  : <Coins className="w-5 h-5" />}
                {isSubmitting ? submitStep || t('nftb.processing')
                  : method === 'fiat' ? t('nftb.payIdr', { amount: totalIdr.toLocaleString('id-ID') })
                  : t('nftb.payOxy', { amount: totalOxy.toLocaleString() })}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Buy from Marketplace Modal (OXY) ─────────────────────────────────────────

interface BuyListingModalProps {
  listing: Listing;
  oxyBalance: string;
  isTxPending: boolean;
  onClose: () => void;
  onBuy: (listingId: number, priceOxy: string) => Promise<void>;
}

function BuyListingModal({ listing, oxyBalance, isTxPending, onClose, onBuy }: BuyListingModalProps) {
  const { t } = useI18n();
  const price = parseFloat(listing.priceOxy);
  const balance = parseFloat(oxyBalance);
  const hasEnough = balance >= price;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-forest-900 to-forest-800 p-5 text-white flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-forest-700/50 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold">{t('nftb.buyTreeN', { id: listing.tokenId })}</h2>
              <p className="text-forest-300 text-xs">{t('nftb.paymentInOxy')}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-forest-700/50 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
              <TreeImagePlaceholder tokenId={listing.tokenId} />
            </div>
            <div>
              <p className="font-display font-bold text-gray-900">OxyTree #{listing.tokenId}</p>
              <p className="text-sm text-gray-500 mt-1">{t('nftb.seller')}: {shortenAddr(listing.seller)}</p>
              <div className="flex items-center gap-1.5 mt-2">
                <Coins className="w-4 h-4 text-forest-600" />
                <span className="font-bold text-forest-700">{formatOxyDisplay(listing.priceOxy)} OXY</span>
              </div>
            </div>
          </div>

          <div className={`flex items-center justify-between p-3 rounded-xl ${hasEnough ? 'bg-forest-50' : 'bg-red-50'}`}>
            <span className="text-sm text-gray-600">{t('nftb.yourOxyBalance')}</span>
            <span className={`text-sm font-semibold ${hasEnough ? 'text-forest-700' : 'text-red-600'}`}>
              {balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} OXY
            </span>
          </div>

          {!hasEnough && (
            <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">
                {t('nftb.insufficientOxy', { need: formatOxyDisplay(listing.priceOxy), have: balance.toFixed(2) })}
              </p>
            </div>
          )}

          <div className="bg-gray-50 rounded-xl p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">{t('nftb.price')}</span>
              <span className="font-medium">{formatOxyDisplay(listing.priceOxy)} OXY</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">{t('nftb.platformFee')}</span>
              <span className="text-gray-400">{t('nftb.deductedFromSeller')}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 btn-secondary">Cancel</button>
            <button
              onClick={() => onBuy(listing.id, listing.priceOxy)}
              disabled={isTxPending || !hasEnough}
              className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTxPending ? <Loader className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
              {isTxPending ? 'Buying...' : 'Confirm Buy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sell (List) Modal ─────────────────────────────────────────────────────────

interface SellModalProps {
  tree: TreeData;
  isTxPending: boolean;
  onClose: () => void;
  onList: (tokenId: number, priceOxy: string) => Promise<void>;
}

function SellModal({ tree, isTxPending, onClose, onList }: SellModalProps) {
  const { t } = useI18n();
  const [priceOxy, setPriceOxy] = useState('500');
  const [error, setError] = useState<string | null>(null);

  const handleList = async () => {
    const p = parseFloat(priceOxy);
    if (isNaN(p) || p <= 0) { setError('Enter a valid price above 0.'); return; }
    setError(null);
    try {
      await onList(tree.tokenId, priceOxy);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Listing failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-5 text-white flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-700/50 flex items-center justify-center">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold">{t('nftb.listForSaleTitle')}</h2>
              <p className="text-gray-400 text-xs">Tree #{tree.tokenId} · {tree.species}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-700/50 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
              <TreeImagePlaceholder species={tree.species} tokenId={tree.tokenId} />
            </div>
            <div>
              <p className="font-display font-bold text-gray-900">{tree.species} #{tree.tokenId}</p>
              {tree.location && <p className="text-sm text-gray-500 flex items-center gap-1 mt-1"><MapPin className="w-3.5 h-3.5" />{tree.location}</p>}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
              {t('nftb.salePriceOxy')}
            </label>
            <div className="relative">
              <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forest-500" />
              <input
                type="number"
                min="1"
                step="1"
                value={priceOxy}
                onChange={(e) => setPriceOxy(e.target.value)}
                className="w-full pl-9 pr-16 py-3 rounded-xl border border-gray-200 focus:border-forest-400 focus:ring-2 focus:ring-forest-100 outline-none text-sm"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">OXY</span>
            </div>
          </div>

          <div className="bg-amber-50 rounded-xl p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              {t('nftb.listingInfo')}
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 btn-secondary">Cancel</button>
            <button
              onClick={handleList}
              disabled={isTxPending}
              className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTxPending ? <Loader className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
              {isTxPending ? 'Listing...' : 'List NFT'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tree cards ────────────────────────────────────────────────────────────────

interface MyTreeCardProps {
  tree: TreeData;
  isStaked: boolean;
  stakedInfo?: { lastClaimAt: number; pendingReward: string; totalClaimed: string };
  claimPeriod: number;
  isTxPending: boolean;
  onStake: (tokenId: number) => void;
  onUnstake: (tokenId: number) => void;
  onClaim: (tokenId: number) => void;
  onSell: (tree: TreeData) => void;
  onClick: () => void;
}

function MyTreeCard({
  tree, isStaked, stakedInfo, claimPeriod, isTxPending,
  onStake, onUnstake, onClaim, onSell, onClick,
}: MyTreeCardProps) {
  const { t } = useI18n();
  const canClaim = stakedInfo ? secondsUntilClaim(stakedInfo.lastClaimAt, claimPeriod) === 0 : false;
  const countdown = stakedInfo ? secondsUntilClaim(stakedInfo.lastClaimAt, claimPeriod) : 0;

  return (
    <div className="card overflow-hidden cursor-pointer group hover:-translate-y-1" onClick={onClick}>
      <div className="aspect-[4/3] overflow-hidden relative">
        <TreeImagePlaceholder species={tree.species} tokenId={tree.tokenId} />
        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-white/90 backdrop-blur-sm text-xs font-semibold text-forest-700">
          {tree.species}
        </div>
        {isStaked && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-forest-600/90 backdrop-blur-sm text-xs font-semibold text-white flex items-center gap-1">
            <Lock className="w-3 h-3" /> {t('nftb.staked')}
          </div>
        )}
        <div className="absolute bottom-3 right-3 px-2 py-1 rounded-lg bg-black/50 text-xs text-white font-mono">
          #{tree.tokenId}
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-display font-bold text-gray-900 mb-2">{tree.species} #{tree.tokenId}</h3>
        <div className="space-y-1.5 mb-3">
          {tree.location && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <MapPin className="w-3.5 h-3.5 text-forest-500 shrink-0" />
              <span className="truncate">{tree.location}</span>
            </div>
          )}
          {tree.planter && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <User className="w-3.5 h-3.5 text-forest-500 shrink-0" /> {tree.planter}
            </div>
          )}
        </div>

        {isStaked && stakedInfo && (
          <div className="bg-forest-50 rounded-xl p-2.5 mb-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-forest-600">{t('nftb.pending')}</span>
              <span className="font-semibold text-forest-700">{parseFloat(stakedInfo.pendingReward).toFixed(4)} OXY</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-forest-600">{t('nftb.nextClaim')}</span>
              <span className={`font-semibold ${canClaim ? 'text-forest-600' : 'text-gray-500'}`}>
                {formatCountdown(countdown)}
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {!isStaked ? (
            <>
              <button onClick={() => onStake(tree.tokenId)} disabled={isTxPending}
                className="flex-1 btn-primary text-xs !py-2 !px-2 disabled:opacity-50">
                {isTxPending ? <Loader className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
                {t('nftb.stake')}
              </button>
              <button onClick={() => onSell(tree)} disabled={isTxPending}
                className="flex-1 btn-secondary text-xs !py-2 !px-2 disabled:opacity-50">
                <Tag className="w-3 h-3" /> {t('nftb.sell')}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => onClaim(tree.tokenId)} disabled={isTxPending || !canClaim}
                className="flex-1 btn-primary text-xs !py-2 !px-2 disabled:opacity-50">
                {isTxPending ? <Loader className="w-3 h-3 animate-spin" /> : <Coins className="w-3 h-3" />}
                {t('nftb.claim')}
              </button>
              <button onClick={() => onUnstake(tree.tokenId)} disabled={isTxPending}
                className="flex-1 btn-secondary text-xs !py-2 !px-2 disabled:opacity-50">
                <Unlock className="w-3 h-3" /> {t('nftb.unstake')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────

interface TreeDetailModalProps {
  tree: TreeData;
  isStaked: boolean;
  stakedInfo?: { lastClaimAt: number; pendingReward: string; totalClaimed: string; stakedAt: number };
  claimPeriod: number;
  isTxPending: boolean;
  onClose: () => void;
  onStake: (tokenId: number) => void;
  onUnstake: (tokenId: number) => void;
  onClaim: (tokenId: number) => void;
}

function TreeDetailModal({ tree, isStaked, stakedInfo, claimPeriod, isTxPending, onClose, onStake, onUnstake, onClaim }: TreeDetailModalProps) {
  const { t } = useI18n();
  const canClaim = stakedInfo ? secondsUntilClaim(stakedInfo.lastClaimAt, claimPeriod) === 0 : false;
  const countdown = stakedInfo ? secondsUntilClaim(stakedInfo.lastClaimAt, claimPeriod) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="aspect-video overflow-hidden relative">
          <TreeImagePlaceholder species={tree.species} tokenId={tree.tokenId} />
          {isStaked && (
            <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-forest-600 text-white text-xs font-semibold flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> {t('nftb.staked')}
            </div>
          )}
          <button onClick={onClose} className="absolute top-4 left-4 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-display font-bold text-gray-900">{tree.species} #{tree.tokenId}</h3>
              <span className="text-sm text-forest-600 font-medium">{t('nftb.howBadge')}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">{t('nftb.location')}</p>
              <p className="text-sm font-medium">{tree.location || t('nftb.unknown')}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">{t('nftb.planter')}</p>
              <p className="text-sm font-medium">{tree.planter || t('nftb.anonymous')}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">{t('nftb.planted')}</p>
              <p className="text-sm font-medium">{tree.plantedAt > 0 ? formatDate(tree.plantedAt) : t('nftb.unknown')}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">{t('nftb.tokenId')}</p>
              <p className="text-sm font-mono font-medium">#{tree.tokenId}</p>
            </div>
          </div>

          {isStaked && stakedInfo ? (
            <div className="bg-forest-50 border border-forest-200/50 rounded-2xl p-4 mb-5 space-y-3">
              <p className="text-sm font-semibold text-forest-800">{t('nftb.stakingInfo')}</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-forest-600">{t('nftb.stakedSince')}</p>
                  <p className="font-medium text-forest-800">{formatDate(stakedInfo.stakedAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-forest-600">{t('nftb.pendingRewards')}</p>
                  <p className="font-semibold text-forest-700">{parseFloat(stakedInfo.pendingReward).toFixed(6)} OXY</p>
                </div>
                <div>
                  <p className="text-xs text-forest-600">{t('nftb.totalClaimed')}</p>
                  <p className="font-medium text-forest-800">{parseFloat(stakedInfo.totalClaimed).toFixed(6)} OXY</p>
                </div>
                <div>
                  <p className="text-xs text-forest-600">{t('nftb.nextClaim')}</p>
                  <p className={`font-medium flex items-center gap-1 ${canClaim ? 'text-forest-600' : 'text-gray-600'}`}>
                    <Clock className="w-3.5 h-3.5" /> {formatCountdown(countdown)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-forest-50 rounded-xl p-4 mb-5 flex items-start gap-3">
              <Info className="w-5 h-5 text-forest-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-forest-800 font-medium">{t('nftb.stakeToEarn')}</p>
                <p className="text-xs text-forest-600 mt-1">{t('nftb.stakeToEarnDesc')}</p>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            {!isStaked ? (
              <button onClick={() => onStake(tree.tokenId)} disabled={isTxPending}
                className="flex-1 btn-primary disabled:opacity-50">
                {isTxPending ? <Loader className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {t('nftb.stakeNft')}
              </button>
            ) : (
              <>
                <button onClick={() => onClaim(tree.tokenId)} disabled={isTxPending || !canClaim}
                  className="flex-1 btn-primary disabled:opacity-50">
                  {isTxPending ? <Loader className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />}
                  {t('nftb.claimOxy')}
                </button>
                <button onClick={() => onUnstake(tree.tokenId)} disabled={isTxPending}
                  className="flex-1 btn-secondary disabled:opacity-50">
                  {isTxPending ? <Loader className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                  {t('nftb.unstake')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NFTBPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<ActiveTab>('shop');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecies, setSelectedSpecies] = useState('');
  const [selectedTree, setSelectedTree] = useState<TreeData | null>(null);
  const [sellTree, setSellTree] = useState<TreeData | null>(null);
  const [buyListingModal, setBuyListingModal] = useState<Listing | null>(null);
  const [showBuyNewModal, setShowBuyNewModal] = useState(false);
  const [txFeedback, setTxFeedback] = useState<TxFeedback | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  const { wallet, connect } = useWallet();
  const { switchChain } = useSwitchChain();
  const { settings } = useAppSettings();

  const { totalMinted, ownedTrees, isLoading: nftLoading, error: nftError, refresh: refreshNFT } = useNFTTree();

  const {
    stakedTokenIds, stakeInfos, pendingRewardsTotal,
    rewardPoolBalance, totalStaked, claimPeriod,
    isLoading: stakingLoading, isTxPending,
    stake, unstake, claimRewards, claimAll, refresh: refreshStaking,
  } = useStaking();

  const {
    listings, isLoading: marketLoading, error: marketError,
    isTxPending: isMktTxPending, txError: mktTxError,
    buy, listNFTB, refresh: refreshMarket,
  } = useMarketplace();

  const isLoading = nftLoading || stakingLoading;

  // Only Tree (NFT B) listings from the marketplace
  const treeListings = listings.filter((l) => l.nftType === 'B');

  const oxyBalance = wallet.oxyBalance.toString();

  const handleRefresh = useCallback(() => {
    refreshNFT(); refreshStaking(); refreshMarket();
    setTxFeedback(null); setActionError(null);
  }, [refreshNFT, refreshStaking, refreshMarket]);

  const execAction = useCallback(async (fn: () => Promise<{ txHash: string; explorerUrl: string }>, action: string) => {
    setActionError(null);
    setTxFeedback(null);
    try {
      const result = await fn();
      setTxFeedback({ hash: result.txHash, url: result.explorerUrl, action });
      setSelectedTree(null);
      setSellTree(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : `${action} failed`;
      setActionError(msg.startsWith('wrong_network:') ? 'Please switch to Monad Testnet.' : msg);
    }
  }, []);

  const handleStake   = (id: number) => execAction(() => stake(id),         'Staked');
  const handleUnstake = (id: number) => execAction(() => unstake(id),       'Unstaked');
  const handleClaim   = (id: number) => execAction(() => claimRewards(id),  'Rewards claimed');
  const handleClaimAll =             () => execAction(() => claimAll(),      'All rewards claimed');

  const handleBuyListing = async (listingId: number, priceOxy: string) => {
    setActionError(null); setTxFeedback(null);
    try {
      const result = await buy(listingId, priceOxy);
      setTxFeedback({ hash: result.txHash, url: result.explorerUrl, action: 'Purchase complete' });
      setBuyListingModal(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Buy failed';
      setActionError(msg.startsWith('wrong_network:') ? 'Please switch to Monad Testnet.' : msg);
    }
  };

  const handleListTree = async (tokenId: number, priceOxy: string) => {
    setActionError(null); setTxFeedback(null);
    try {
      const result = await listNFTB(tokenId, priceOxy);
      setTxFeedback({ hash: result.txHash, url: result.explorerUrl, action: 'Tree listed for sale' });
      setSellTree(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Listing failed';
      setActionError(msg.startsWith('wrong_network:') ? 'Please switch to Monad Testnet.' : msg);
    }
  };

  const stakedSet = new Set(stakedTokenIds);
  const getStakedInfo = (tokenId: number) => stakeInfos.find((s) => s.tokenId === tokenId);
  const selectedStakedInfo = selectedTree ? getStakedInfo(selectedTree.tokenId) : undefined;

  const filteredOwned = ownedTrees.filter((t) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || t.species.toLowerCase().includes(q) || t.location.toLowerCase().includes(q);
    const matchSpecies = !selectedSpecies || t.species.toLowerCase().includes(selectedSpecies.toLowerCase());
    return matchSearch && matchSpecies;
  });

  const filteredListings = treeListings.filter((l) => {
    const q = searchQuery.toLowerCase();
    return !q || `tree #${l.tokenId}`.includes(q) || l.seller.toLowerCase().includes(q);
  });

  const tabs: { key: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { key: 'shop',          label: t('nftb.tab.shop'),        icon: <ShoppingCart className="w-4 h-4" /> },
    { key: 'my-trees',      label: t('nftb.tab.myTrees'),    icon: <Leaf className="w-4 h-4" /> },
    { key: 'sell',          label: t('nftb.tab.sell'),        icon: <Tag className="w-4 h-4" /> },
    { key: 'how-it-works',  label: t('nftb.tab.howItWorks'),icon: <Info className="w-4 h-4" /> },
  ];

  return (
    <div>
      {/* ── Hero ── */}
      <section className="bg-gradient-to-b from-forest-900 to-forest-950 text-white py-20 sm:py-28 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 left-20 w-80 h-80 bg-forest-400/10 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-20 w-60 h-60 bg-forest-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-forest-800/60 border border-forest-700/50 mb-6">
            <TreePine className="w-4 h-4 text-forest-400" />
            <span className="text-sm text-forest-200">{t('nftb.badge')}</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-display font-extrabold mb-6">
            {t('nftb.title1')}<br />
            <span className="gradient-text">{t('nftb.title2')}</span>
          </h1>

          <p className="text-lg text-forest-200/80 max-w-2xl mx-auto mb-10 leading-relaxed">
            {t('nftb.desc')}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto mb-8">
            {[
              { label: t('nftb.totalMinted'),  val: isLoading ? '...' : totalMinted.toLocaleString() },
              { label: t('nftb.totalStaked'),  val: isLoading ? '...' : totalStaked.toLocaleString() },
              { label: t('nftb.rewardPool'),   val: isLoading ? '...' : `${parseFloat(rewardPoolBalance).toLocaleString(undefined, { maximumFractionDigits: 0 })} OXY` },
              { label: t('nftb.marketplace'),   val: marketLoading ? '...' : t('nftb.marketplaceListed', { count: treeListings.length }) },
            ].map((s) => (
              <div key={s.label} className="bg-forest-800/40 border border-forest-700/40 rounded-xl p-3 text-center">
                <p className="text-xl font-display font-bold">{s.val}</p>
                <p className="text-xs text-forest-300/70 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => { setActiveTab('shop'); setShowBuyNewModal(true); }}
              className="btn-primary px-8 py-3.5 text-base"
            >
              <CreditCard className="w-5 h-5" /> {t('nftb.buyWithUsd')}
            </button>
            <button
              onClick={() => { setActiveTab('shop'); setShowBuyNewModal(true); }}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-forest-700/50 border border-forest-600/50 text-white font-semibold rounded-xl hover:bg-forest-700 transition-all text-base"
            >
              <Coins className="w-5 h-5" /> {t('nftb.buyWithOxy')}
            </button>
          </div>
        </div>
      </section>

      {/* ── Tabs ── */}
      <section className="py-10 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">

          <div className="w-full overflow-x-auto mb-8">
            <div
              className="flex gap-0 p-1 rounded-2xl w-fit min-w-full"
              style={{
                background: 'rgba(0,0,0,0.35)',
                border: '1px solid rgba(255,255,255,0.07)',
                backdropFilter: 'blur(8px)',
              }}
            >
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); if (!wallet.isConnected && (t.key === 'my-trees' || t.key === 'sell')) connect(); }}
                className="relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap"
                style={activeTab === t.key ? {
                  background: 'linear-gradient(135deg, #166534, #15803d)',
                  color: '#ffffff',
                  boxShadow: '0 2px 12px rgba(34,197,94,0.35), 0 1px 3px rgba(0,0,0,0.4)',
                } : {
                  color: 'rgba(255,255,255,0.45)',
                }}
              >
                <span className={`transition-colors duration-200 ${activeTab === t.key ? 'text-emerald-300' : 'text-white/30'}`}>
                  {t.icon}
                </span>
                {t.label}
                {t.key === 'my-trees' && ownedTrees.length > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === t.key ? 'bg-emerald-400/25 text-emerald-200' : 'bg-white/10 text-white/40'}`}>{ownedTrees.length}</span>
                )}
                {t.key === 'shop' && treeListings.length > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === t.key ? 'bg-emerald-400/25 text-emerald-200' : 'bg-white/10 text-white/40'}`}>{treeListings.length}</span>
                )}
              </button>
            ))}
            </div>
          </div>

          {/* Tx feedback */}
          {txFeedback && (
            <div className="mb-6 p-4 rounded-xl bg-forest-50 border border-forest-200 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-forest-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-forest-800">{txFeedback.action}!</p>
                <a href={txFeedback.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-forest-600 hover:text-forest-500 mt-1">
                  View transaction <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {orderSuccess && (
            <div className="mb-6 p-4 rounded-xl bg-forest-50 border border-forest-200 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-forest-600 shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-forest-800">{orderSuccess}</p>
            </div>
          )}

          {(actionError || mktTxError) && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-700">{actionError || mktTxError}</p>
                {(actionError || mktTxError || '').includes('MON') && (
                  <button onClick={() => switchChain({ chainId: monadTestnet.id })}
                    className="mt-1 text-xs text-red-600 underline hover:no-underline">
                    Switch to Monad Testnet
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── SHOP TAB ── */}
          {activeTab === 'shop' && (
            <div>
              {/* Admin listing cards */}
              <div className="mb-10">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-display font-bold text-gray-900">{t('nftb.buyNewTree')}</h2>
                    <p className="text-sm text-gray-500 mt-1">{t('nftb.buyNewDesc')}</p>
                  </div>
                  <button onClick={() => setShowBuyNewModal(true)}
                    className="btn-primary">
                    <ShoppingCart className="w-4 h-4" /> {t('nftb.buyNow')}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {[
                    { method: t('nftb.fiatMethod'), icon: <CreditCard className="w-6 h-6" />, price: `Rp${settings.tree_price_idr.toLocaleString('id-ID')}`, desc: t('nftb.fiatDesc'), color: 'bg-sky-50 text-sky-600', border: 'border-sky-200' },
                    { method: t('nftb.oxyMethod'), icon: <Coins className="w-6 h-6" />, price: `${settings.tree_price_oxy.toLocaleString()} OXY`, desc: t('nftb.oxyMethodDesc'), color: 'bg-forest-50 text-forest-600', border: 'border-forest-200' },
                    { method: t('nftb.marketplaceMethod'), icon: <Tag className="w-6 h-6" />, price: t('nftb.varies'), desc: t('nftb.marketplaceMethodDesc', { count: treeListings.length }), color: 'bg-amber-50 text-amber-600', border: 'border-amber-200' },
                  ].map((opt) => (
                    <div key={opt.method} className={`relative rounded-2xl border-2 ${opt.border} p-5 bg-white ${opt.comingSoon ? 'opacity-75' : ''}`}>
                      {opt.comingSoon && (
                        <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                          {t('nftb.fiatComingSoon')}
                        </span>
                      )}
                      <div className={`w-12 h-12 rounded-xl ${opt.color} flex items-center justify-center mb-4`}>
                        {opt.icon}
                      </div>
                      <h3 className="font-display font-bold text-gray-900 mb-1">{opt.method}</h3>
                      <p className="text-lg font-bold text-gray-700 mb-2">{opt.price}<span className="text-sm font-normal text-gray-400"> {t('nftb.perTree')}</span></p>
                      <p className="text-sm text-gray-500 leading-relaxed">{opt.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Marketplace listings */}
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-2xl font-display font-bold text-gray-900">{t('nftb.marketplaceListings')}</h2>
                    <p className="text-sm text-gray-500 mt-1">{t('nftb.marketplaceListingsDesc')}</p>
                  </div>
                  <button onClick={refreshMarket} disabled={marketLoading}
                    className="btn-secondary !py-2 !px-3">
                    <RefreshCw className={`w-4 h-4 ${marketLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {/* Search */}
                <div className="relative mb-5 w-full sm:max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder={t('nftb.searchTokenSeller')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-forest-400 focus:ring-2 focus:ring-forest-100 outline-none text-sm"
                  />
                </div>

                {marketLoading && (
                  <div className="text-center py-12"><Loader className="w-7 h-7 text-forest-500 animate-spin mx-auto" /></div>
                )}

                {marketError && !marketLoading && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 mb-4">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{marketError}</p>
                  </div>
                )}

                {!marketLoading && filteredListings.length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl">
                    <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">{t('nftb.noListings')}</p>
                    <p className="text-sm text-gray-400 mt-1">{t('nftb.noListingsDesc')}</p>
                  </div>
                )}

                {filteredListings.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredListings.map((listing) => {
                      const isOwn = wallet.address?.toLowerCase() === listing.seller.toLowerCase();
                      return (
                        <div key={listing.id} className="card overflow-hidden group">
                          <div className="aspect-[4/3] overflow-hidden relative">
                            <TreeImagePlaceholder tokenId={listing.tokenId} />
                            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-forest-600/90 text-white text-xs font-semibold">OxyTree</div>
                            {isOwn && (
                              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-gray-900/80 text-white text-xs font-semibold">Yours</div>
                            )}
                            <div className="absolute bottom-3 right-3 px-2 py-1 rounded-lg bg-black/50 text-xs text-white font-mono">#{listing.tokenId}</div>
                          </div>

                          <div className="p-5">
                            <div className="flex items-start justify-between mb-1">
                              <div>
                                <h3 className="font-display font-bold text-gray-900">Tree #{listing.tokenId}</h3>
                                <p className="text-xs text-gray-400 mt-0.5">{t('nftb.treeBy', { seller: shortenAddr(listing.seller) })}</p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-3">
                              <div>
                                <p className="text-xs text-gray-400">{t('nftb.price')}</p>
                                <div className="flex items-center gap-1">
                                  <Coins className="w-4 h-4 text-forest-600" />
                                  <span className="text-lg font-display font-bold">{formatOxyDisplay(listing.priceOxy)}</span>
                                  <span className="text-xs text-gray-400">OXY</span>
                                </div>
                              </div>
                              {!wallet.isConnected ? (
                                <button onClick={connect} className="btn-secondary text-sm !py-2 !px-4">
                                  <Wallet className="w-3.5 h-3.5" /> {t('nftb.connect')}
                                </button>
                              ) : isOwn ? (
                                <span className="text-xs text-gray-400 italic">{t('nftb.yourListing')}</span>
                              ) : (
                                <button onClick={() => setBuyListingModal(listing)}
                                  disabled={isMktTxPending}
                                  className="btn-primary text-sm !py-2 !px-4 disabled:opacity-50">
                                  <ShoppingCart className="w-3.5 h-3.5" /> {t('nftb.buy')}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── MY TREES TAB ── */}
          {activeTab === 'my-trees' && (
            <div>
              {!wallet.isConnected ? (
                <div className="text-center py-20">
                  <Wallet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="font-display font-bold text-gray-700 text-xl mb-2">{t('nftb.connectWallet')}</h3>
                  <p className="text-gray-400 mb-6">{t('nftb.connectDesc')}</p>
                  <button onClick={connect} className="btn-primary"><Wallet className="w-4 h-4" /> {t('nftb.connectWallet')}</button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                    {[
                      { label: t('nftb.myOxyTrees'),    val: isLoading ? '...' : ownedTrees.length.toString() },
                      { label: t('nftb.staked'),          val: isLoading ? '...' : stakedTokenIds.length.toString() },
                      { label: t('nftb.pendingOxy'),     val: isLoading ? '...' : parseFloat(pendingRewardsTotal).toFixed(4) },
                    ].map((s) => (
                      <div key={s.label} className="bg-forest-50 rounded-xl p-4">
                        <p className="text-xs text-forest-600 mb-1">{s.label}</p>
                        <p className="text-2xl font-display font-bold text-forest-800">{s.val}</p>
                      </div>
                    ))}
                    <div className="bg-forest-50 rounded-xl p-4 flex flex-col justify-between">
                      <p className="text-xs text-forest-600 mb-1">{t('nftb.actions')}</p>
                      <button onClick={handleClaimAll}
                        disabled={isTxPending || parseFloat(pendingRewardsTotal) === 0}
                        className="btn-primary text-xs !py-2 !px-3 disabled:opacity-50">
                        {isTxPending ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Coins className="w-3.5 h-3.5" />}
                        {t('nftb.claimAll')}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="text" placeholder={t('nftb.searchSpeciesLocation')}
                        value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 focus:border-forest-400 focus:ring-2 focus:ring-forest-100 outline-none text-sm"
                      />
                    </div>
                    <div className="relative">
                      <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <select value={selectedSpecies} onChange={(e) => setSelectedSpecies(e.target.value)}
                        className="pl-9 pr-8 py-3 rounded-xl border border-gray-200 focus:border-forest-400 outline-none text-sm appearance-none bg-white">
                        <option value="">{t('nftb.allSpecies')}</option>
                        {TREE_SPECIES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <button onClick={handleRefresh} disabled={isLoading} className="btn-secondary !px-4 !py-3">
                      <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {isLoading && (
                    <div className="text-center py-16">
                      <Loader className="w-8 h-8 text-forest-500 animate-spin mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">{t('nftb.loadingTrees')}</p>
                    </div>
                  )}

                  {nftError && !isLoading && (
                    <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 mb-6">
                      <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">{nftError}</p>
                    </div>
                  )}

                  {!isLoading && !nftError && ownedTrees.length === 0 && (
                    <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
                      <TreeDeciduous className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="font-display font-bold text-gray-700 text-lg mb-2">{t('nftb.noOxyTrees')}</h3>
                      <p className="text-gray-400 text-sm max-w-sm mx-auto mb-6">{t('nftb.noOxyTreesDesc')}</p>
                      <button onClick={() => setActiveTab('shop')} className="btn-primary">
                        <ShoppingCart className="w-4 h-4" /> {t('nftb.goToShop')}
                      </button>
                    </div>
                  )}

                  {!isLoading && filteredOwned.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredOwned.map((tree) => {
                        const info = getStakedInfo(tree.tokenId);
                        return (
                          <MyTreeCard key={tree.tokenId} tree={tree}
                            isStaked={stakedSet.has(tree.tokenId)}
                            stakedInfo={info ? { lastClaimAt: info.lastClaimAt, pendingReward: info.pendingReward, totalClaimed: info.totalClaimed } : undefined}
                            claimPeriod={claimPeriod}
                            isTxPending={isTxPending}
                            onStake={handleStake} onUnstake={handleUnstake} onClaim={handleClaim}
                            onSell={(t) => setSellTree(t)}
                            onClick={() => setSelectedTree(tree)}
                          />
                        );
                      })}
                    </div>
                  )}

                  {!isLoading && ownedTrees.length > 0 && filteredOwned.length === 0 && (
                    <div className="text-center py-12">
                      <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">{t('nftb.noTreesMatch')}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── SELL TAB ── */}
          {activeTab === 'sell' && (
            <div>
              {!wallet.isConnected ? (
                <div className="text-center py-20">
                  <Wallet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="font-display font-bold text-gray-700 text-xl mb-2">{t('nftb.connectWallet')}</h3>
                  <p className="text-gray-400 mb-6">{t('nftb.connectDescSell')}</p>
                  <button onClick={connect} className="btn-primary"><Wallet className="w-4 h-4" /> {t('nftb.connectWallet')}</button>
                </div>
              ) : (
                <>
                  <div className="mb-8">
                    <SectionHeading badge={t('nftb.sellBadge')} title={t('nftb.sellTitle')} subtitle={t('nftb.sellSubtitle')} />
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8 flex items-start gap-4">
                    <Info className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-800 mb-1">{t('nftb.howSellingWorks')}</p>
                      <p className="text-sm text-amber-700 leading-relaxed">
                        {t('nftb.howSellingDesc')}
                      </p>
                    </div>
                  </div>

                  {isLoading ? (
                    <div className="text-center py-16"><Loader className="w-8 h-8 text-forest-500 animate-spin mx-auto" /></div>
                  ) : ownedTrees.length === 0 ? (
                    <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
                      <TreeDeciduous className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 font-medium">{t('nftb.noTreesToSell')}</p>
                      <button onClick={() => setActiveTab('shop')} className="btn-primary mt-5">
                        <ShoppingCart className="w-4 h-4" /> {t('nftb.buyTreesFirst')}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {ownedTrees.map((tree) => {
                        const isStaked = stakedSet.has(tree.tokenId);
                        return (
                          <div key={tree.tokenId} className="card overflow-hidden">
                            <div className="aspect-[4/3] overflow-hidden relative">
                              <TreeImagePlaceholder species={tree.species} tokenId={tree.tokenId} />
                              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-white/90 text-xs font-semibold text-forest-700">
                                {tree.species}
                              </div>
                              {isStaked && (
                                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-forest-600/90 text-white text-xs font-semibold flex items-center gap-1">
                                  <Lock className="w-3 h-3" /> {t('nftb.staked')}
                                </div>
                              )}
                              <div className="absolute bottom-3 right-3 px-2 py-1 rounded-lg bg-black/50 text-xs text-white font-mono">
                                #{tree.tokenId}
                              </div>
                            </div>

                            <div className="p-5">
                              <h3 className="font-display font-bold text-gray-900 mb-1">{tree.species} #{tree.tokenId}</h3>
                              {tree.location && (
                                <p className="text-xs text-gray-500 flex items-center gap-1 mb-4">
                                  <MapPin className="w-3.5 h-3.5 text-forest-500" /> {tree.location}
                                </p>
                              )}

                              {isStaked ? (
                                <div className="p-3 bg-gray-50 rounded-xl text-center">
                                  <p className="text-xs text-gray-500">{t('nftb.unstakeFirstToSell')}</p>
                                  <button onClick={() => handleUnstake(tree.tokenId)}
                                    disabled={isTxPending}
                                    className="btn-secondary text-xs !py-2 !px-4 mt-2 disabled:opacity-50">
                                    <Unlock className="w-3 h-3" /> {t('nftb.unstake')}
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => setSellTree(tree)}
                                  disabled={isMktTxPending}
                                  className="w-full btn-primary text-sm disabled:opacity-50">
                                  <Tag className="w-4 h-4" /> {t('nftb.listForSale')}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── HOW IT WORKS TAB ── */}
          {activeTab === 'how-it-works' && (
            <div>
              <SectionHeading badge={t('nftb.howBadge')} title={t('nftb.howTitle')}
                subtitle={t('nftb.howSubtitle')} />

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {[
                  { step: '01', icon: <ShoppingCart className="w-6 h-6" />, title: t('nftb.howStep1'), desc: t('nftb.howStep1Desc'), color: 'bg-sky-50 text-sky-600' },
                  { step: '02', icon: <TreeDeciduous className="w-6 h-6" />, title: t('nftb.howStep2'), desc: t('nftb.howStep2Desc'), color: 'bg-forest-50 text-forest-600' },
                  { step: '03', icon: <Lock className="w-6 h-6" />, title: t('nftb.howStep3'), desc: t('nftb.howStep3Desc'), color: 'bg-emerald-50 text-emerald-600' },
                  { step: '04', icon: <Tag className="w-6 h-6" />, title: t('nftb.howStep4'), desc: t('nftb.howStep4Desc'), color: 'bg-amber-50 text-amber-600' },
                ].map((s) => (
                  <div key={s.step} className="card p-6 relative">
                    <div className="absolute top-4 right-4 text-4xl font-display font-extrabold text-gray-100">{s.step}</div>
                    <div className={`w-12 h-12 rounded-xl ${s.color} flex items-center justify-center mb-4`}>{s.icon}</div>
                    <h3 className="font-display font-bold text-gray-900 mb-2">{s.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                  </div>
                ))}
              </div>

              <div className="bg-forest-900 rounded-3xl p-8 text-white">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  <div>
                    <h3 className="text-2xl font-display font-bold mb-3">{t('nftb.stakingMechanics')}</h3>
                    <p className="text-forest-200/80 text-sm leading-relaxed mb-6">
                      {t('nftb.stakingMechanicsDesc')}
                    </p>
                    <div className="space-y-3 text-sm">
                      {[
                        [t('nftb.rewardRate'), t('nftb.rewardRateVal')],
                        [t('nftb.claimPeriod'), t('nftb.claimPeriodVal')],
                        [t('nftb.poolSource'), t('nftb.poolSourceVal')],
                        [t('nftb.compound'), t('nftb.compoundVal')],
                      ].map(([label, val]) => (
                        <div key={label} className="flex items-center gap-3">
                          <ChevronRight className="w-4 h-4 text-forest-400 shrink-0" />
                          <span className="text-forest-300">{label}:</span>
                          <span className="text-white font-medium">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-forest-800/50 rounded-2xl p-6 grid grid-cols-2 gap-4">
                    {[
                      { label: t('nftb.totalStakedNfts'), val: isLoading ? '...' : totalStaked.toString() },
                      { label: t('nftb.rewardPoolOxy'), val: isLoading ? '...' : parseFloat(rewardPoolBalance).toLocaleString(undefined, { maximumFractionDigits: 0 }) },
                      { label: t('nftb.totalMinted'), val: isLoading ? '...' : totalMinted.toString() },
                      { label: t('nftb.myStaked'), val: wallet.isConnected ? (isLoading ? '...' : stakedTokenIds.length.toString()) : '-' },
                    ].map((s) => (
                      <div key={s.label}>
                        <p className="text-xs text-forest-400 mb-1">{s.label}</p>
                        <p className="text-2xl font-display font-bold">{s.val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Modals ── */}

      {showBuyNewModal && wallet.isConnected && (
        <BuyNewModal
          walletAddress={wallet.address ?? ''}
          oxyBalance={oxyBalance}
          onClose={() => setShowBuyNewModal(false)}
          onSuccess={({ detail, txHash }) => {
            setShowBuyNewModal(false);
            setOrderSuccess(detail);
            if (txHash) setTxFeedback({ hash: txHash, url: getExplorerTxUrl(txHash), action: 'OXY payment confirmed' });
            setTimeout(() => setOrderSuccess(null), 10000);
          }}
        />
      )}

      {showBuyNewModal && !wallet.isConnected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowBuyNewModal(false)}>
          <div className="bg-white rounded-3xl max-w-sm w-full p-8 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <Wallet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-display font-bold mb-2">{t('nftb.connectWalletFirst')}</h2>
            <p className="text-gray-500 text-sm mb-6">{t('nftb.connectWalletFirstDesc')}</p>
            <button onClick={() => { setShowBuyNewModal(false); connect(); }} className="btn-primary w-full">
              <Wallet className="w-4 h-4" /> {t('nftb.connectWallet')}
            </button>
          </div>
        </div>
      )}

      {buyListingModal && (
        <BuyListingModal
          listing={buyListingModal}
          oxyBalance={oxyBalance}
          isTxPending={isMktTxPending}
          onClose={() => setBuyListingModal(null)}
          onBuy={handleBuyListing}
        />
      )}

      {sellTree && (
        <SellModal
          tree={sellTree}
          isTxPending={isMktTxPending}
          onClose={() => setSellTree(null)}
          onList={handleListTree}
        />
      )}

      {selectedTree && (
        <TreeDetailModal
          tree={selectedTree}
          isStaked={stakedSet.has(selectedTree.tokenId)}
          stakedInfo={selectedStakedInfo ? {
            lastClaimAt: selectedStakedInfo.lastClaimAt,
            pendingReward: selectedStakedInfo.pendingReward,
            totalClaimed: selectedStakedInfo.totalClaimed,
            stakedAt: selectedStakedInfo.stakedAt,
          } : undefined}
          claimPeriod={claimPeriod}
          isTxPending={isTxPending}
          onClose={() => setSelectedTree(null)}
          onStake={handleStake} onUnstake={handleUnstake} onClaim={handleClaim}
        />
      )}
    </div>
  );
}
