import { useState, useEffect, useCallback } from 'react';
import {
  TreePine, Upload, MapPin, User,
  Settings, BarChart3, Shield,
  ShoppingCart, CheckCircle, XCircle, Clock, AlertCircle, Loader,
  ExternalLink, RefreshCw, Coins, CreditCard, Search,
  Save, X, Package, Zap, Info, TrendingUp, ArrowRight,
  Link2, Plus, Trash2, Globe, ToggleLeft, ToggleRight,
  CalendarClock, DollarSign, FileJson, Download, Eye, Copy,
  Crown, Users as UsersIcon, Lock,
} from 'lucide-react';
import { useWallet } from '../lib/wallet-context';
import { useAdminAuth, type UserRole } from '../lib/admin-auth-context';
import { useAppSettings } from '../hooks/useAppSettings';
import { useNFTTree } from '../hooks/useNFTTree';
import { useStaking } from '../hooks/useStaking';
import { useExchangeLinks, type ExchangeLink } from '../hooks/useExchangeLinks';
import { useIDO, type IDOPhase } from '../hooks/useIDO';
import {
  getSigner, getNFTTreeContract, getExplorerTxUrl, getExplorerAddressUrl,
  getStakingPoolContract, getOxyTokenContract,
  CONTRACT_ADDRESSES, parseOxy, formatOxy,
} from '../lib/contracts';
import { useIDOVesting } from '../hooks/useIDOVesting';
import { supabase } from '../lib/supabase';
import { TREE_SPECIES } from '../lib/constants';
import { useI18n } from '../lib/i18n';

// ── types ─────────────────────────────────────────────────────────────────────

interface PurchaseOrder {
  id: string;
  buyer_wallet: string;
  buyer_email: string;
  payment_method: 'fiat' | 'oxy';
  tree_species: string;
  quantity: number;
  unit_price_usd: number;
  total_price_usd: number;
  total_price_idr?: number;
  oxy_amount: number;
  status: 'pending' | 'paid' | 'minting' | 'delivered' | 'cancelled';
  tx_hash: string;
  midtrans_order_id?: string;
  midtrans_transaction_id?: string;
  token_ids: number[];
  notes: string;
  created_at: string;
  updated_at: string;
}

interface MintForm {
  species: string;
  location: string;
  planter: string;
  recipientAddress: string;
}

type AdminTab = 'overview' | 'orders' | 'mint' | 'pool' | 'ido' | 'exchanges' | 'settings' | 'metadata' | 'users' | 'vesting';

// ── helpers ───────────────────────────────────────────────────────────────────

function shortenAddr(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const STATUS_STYLES: Record<PurchaseOrder['status'], { bg: string; text: string; dot: string; label: string }> = {
  pending:   { bg: 'bg-amber-50',   text: 'text-amber-700',  dot: 'bg-amber-400',  label: 'Pending' },
  paid:      { bg: 'bg-sky-50',     text: 'text-sky-700',    dot: 'bg-sky-400',    label: 'Paid' },
  minting:   { bg: 'bg-forest-50',  text: 'text-forest-700', dot: 'bg-forest-400', label: 'Minting' },
  delivered: { bg: 'bg-emerald-50', text: 'text-emerald-700',dot: 'bg-emerald-400',label: 'Delivered' },
  cancelled: { bg: 'bg-red-50',     text: 'text-red-700',    dot: 'bg-red-400',    label: 'Cancelled' },
};

// ── Overview ──────────────────────────────────────────────────────────────────

function OverviewTab({ orders, totalMinted, totalStaked }: { orders: PurchaseOrder[]; totalMinted: number; totalStaked: number }) {
  const { t } = useI18n();
  const pending   = orders.filter((o) => o.status === 'pending').length;
  const paid      = orders.filter((o) => o.status === 'paid').length;
  const delivered = orders.filter((o) => o.status === 'delivered').length;
  const oxyOrders  = orders.filter((o) => o.payment_method === 'oxy');
  const fiatOrders = orders.filter((o) => o.payment_method === 'fiat');
  const totalOxy   = oxyOrders.reduce((s, o) => s + Number(o.oxy_amount), 0);
  const totalUsd   = fiatOrders.reduce((s, o) => s + Number(o.total_price_usd), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: t('admin.totalOrders'),   val: orders.length,  icon: <ShoppingCart className="w-5 h-5" />, color: 'bg-sky-50 text-sky-600' },
          { label: t('admin.needsAction'),   val: pending + paid, icon: <Clock className="w-5 h-5" />,        color: 'bg-amber-50 text-amber-600' },
          { label: t('admin.nftsMinted'),    val: totalMinted,    icon: <TreePine className="w-5 h-5" />,     color: 'bg-forest-50 text-forest-600' },
          { label: t('admin.nftsStaked'),    val: totalStaked,    icon: <Package className="w-5 h-5" />,      color: 'bg-emerald-50 text-emerald-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center mb-3`}>{s.icon}</div>
            <p className="text-2xl font-display font-bold text-gray-900">{s.val.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-xs text-gray-500 mb-2">{t('admin.fulfillmentRate')}</p>
          <p className="text-2xl font-display font-bold text-forest-700">{delivered}</p>
          <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-forest-500 transition-all"
              style={{ width: orders.length ? `${(delivered / orders.length) * 100}%` : '0%' }} />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {t('admin.percentOfOrders', { pct: orders.length ? ((delivered / orders.length) * 100).toFixed(0) : 0, count: orders.length })}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-xs text-gray-500 mb-2">{t('admin.oxyReceived')}</p>
          <p className="text-2xl font-display font-bold text-forest-700">
            {totalOxy.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-gray-400 mt-1">{t('admin.oxyFromOrders', { count: oxyOrders.length })}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-xs text-gray-500 mb-2">{t('admin.fiatRevenue')}</p>
          <p className="text-2xl font-display font-bold text-gray-900">
            ${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-400 mt-1">{t('admin.usdFromOrders', { count: fiatOrders.length })}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h3 className="font-display font-bold text-gray-900 mb-4">{t('admin.recentOrders')}</h3>
        {orders.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">{t('admin.noOrders')}</p>
        ) : (
          <div className="space-y-2">
            {orders.slice(0, 6).map((o) => {
              const s = STATUS_STYLES[o.status];
              return (
                <div key={o.id} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50">
                  <div className={`w-2 h-2 rounded-full ${s.dot} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {o.quantity}× {o.tree_species} — {shortenAddr(o.buyer_wallet)}
                    </p>
                    <p className="text-xs text-gray-400">{formatDate(o.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {o.payment_method === 'oxy'
                      ? <span className="flex items-center gap-1 text-xs text-forest-600"><Coins className="w-3.5 h-3.5" />{Number(o.oxy_amount).toLocaleString()} OXY</span>
                      : <span className="flex items-center gap-1 text-xs text-sky-600"><CreditCard className="w-3.5 h-3.5" />${o.total_price_usd}</span>}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>{s.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Orders Tab ────────────────────────────────────────────────────────────────

function OrdersTab({
  orders, isLoading, onRefresh, onUpdateStatus, onMarkMinted,
}: {
  orders: PurchaseOrder[];
  isLoading: boolean;
  onRefresh: () => void;
  onUpdateStatus: (id: string, status: PurchaseOrder['status']) => Promise<void>;
  onMarkMinted: (order: PurchaseOrder, tokenIds: number[]) => Promise<void>;
}) {
  const { t } = useI18n();
  const [filterStatus, setFilterStatus] = useState<PurchaseOrder['status'] | 'all'>('all');
  const [search, setSearch] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [mintingOrder, setMintingOrder] = useState<PurchaseOrder | null>(null);
  const [tokenIdInput, setTokenIdInput] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const filtered = orders
    .filter((o) => filterStatus === 'all' || o.status === filterStatus)
    .filter((o) => {
      const q = search.toLowerCase();
      return !q || o.buyer_wallet.includes(q) || o.buyer_email?.includes(q) || o.tree_species.toLowerCase().includes(q);
    });

  const handleAction = async (id: string, status: PurchaseOrder['status']) => {
    setActionId(id); setActionError(null);
    try { await onUpdateStatus(id, status); }
    catch (err) { setActionError(err instanceof Error ? err.message : 'Action failed'); }
    finally { setActionId(null); }
  };

  const handleMarkMinted = async () => {
    if (!mintingOrder) return;
    const ids = tokenIdInput.split(',').map((s) => parseInt(s.trim())).filter((n) => !isNaN(n));
    if (ids.length === 0) { setActionError('Enter at least one token ID.'); return; }
    setActionId(mintingOrder.id); setActionError(null);
    try {
      await onMarkMinted(mintingOrder, ids);
      setMintingOrder(null); setTokenIdInput('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Update failed');
    } finally { setActionId(null); }
  };

  const statusKeys: (PurchaseOrder['status'] | 'all')[] = ['all', 'pending', 'paid', 'minting', 'delivered', 'cancelled'];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
          {statusKeys.map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                filterStatus === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}>
              {s === 'all' ? t('admin.allOrders', { count: orders.length }) : `${STATUS_STYLES[s].label} (${orders.filter((o) => o.status === s).length})`}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={t('admin.searchPlaceholder')}
              className="pl-8 pr-3 py-2 text-xs rounded-xl border border-gray-200 focus:border-forest-400 outline-none w-48" />
          </div>
          <button onClick={onRefresh} disabled={isLoading}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <RefreshCw className={`w-4 h-4 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {actionError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{actionError}</p>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12"><Loader className="w-7 h-7 animate-spin text-forest-500 mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{t('admin.noOrdersFound')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const s = STATUS_STYLES[order.status];
            const isActing = actionId === order.id;
            return (
              <div key={order.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${s.bg} ${s.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        order.payment_method === 'oxy' ? 'bg-forest-50 text-forest-700' : 'bg-sky-50 text-sky-700'
                      }`}>
                        {order.payment_method === 'oxy' ? 'OXY' : 'Fiat'}
                      </span>
                    </div>
                    <p className="font-display font-bold text-gray-900 text-sm mb-2">
                      {order.quantity}× {order.tree_species}
                    </p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-500">
                      <span>Wallet: <span className="font-mono text-gray-700">{shortenAddr(order.buyer_wallet)}</span></span>
                      {order.buyer_email && <span>Email: {order.buyer_email}</span>}
                      <span>Amount: <strong className="text-gray-800">
                        {order.payment_method === 'oxy'
                          ? `${Number(order.oxy_amount).toLocaleString()} OXY`
                          : `$${order.total_price_usd}`}
                      </strong></span>
                      <span>{formatDate(order.created_at)}</span>
                      {order.tx_hash && (
                        <span className="col-span-2">
                          Tx: <a href={getExplorerTxUrl(order.tx_hash)} target="_blank" rel="noopener noreferrer"
                            className="text-forest-600 hover:underline font-mono">
                            {order.tx_hash.slice(0, 14)}... <ExternalLink className="w-2.5 h-2.5 inline" />
                          </a>
                        </span>
                      )}
                      {order.midtrans_order_id && (
                        <span className="col-span-2 flex items-center gap-1">
                          Midtrans ID:
                          <span className="font-mono text-sky-700">{order.midtrans_order_id}</span>
                          {order.midtrans_transaction_id && (
                            <span className="text-gray-400">/ Txn: {order.midtrans_transaction_id.slice(0, 12)}...</span>
                          )}
                        </span>
                      )}
                      {order.total_price_idr && (
                        <span>IDR: <strong className="text-gray-800">Rp {order.total_price_idr.toLocaleString('id-ID')}</strong></span>
                      )}
                      {order.token_ids?.length > 0 && (
                        <span className="col-span-2">Tokens: <strong>#{order.token_ids.join(', #')}</strong></span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    {order.status === 'pending' && (
                      <>
                        <button onClick={() => handleAction(order.id, 'paid')} disabled={isActing}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg transition-colors disabled:opacity-50">
                          {isActing ? <Loader className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                          {t('admin.markPaid')}
                        </button>
                        <button onClick={() => handleAction(order.id, 'cancelled')} disabled={isActing}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50">
                          <XCircle className="w-3.5 h-3.5" /> {t('admin.cancel')}
                        </button>
                      </>
                    )}
                    {order.status === 'paid' && (
                      <button onClick={() => handleAction(order.id, 'minting')} disabled={isActing}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-forest-50 text-forest-700 hover:bg-forest-100 rounded-lg transition-colors disabled:opacity-50">
                        {isActing ? <Loader className="w-3 h-3 animate-spin" /> : <TreePine className="w-3.5 h-3.5" />}
                        {t('admin.startMinting')}
                      </button>
                    )}
                    {order.status === 'minting' && (
                      <button onClick={() => { setMintingOrder(order); setTokenIdInput(''); setActionError(null); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors">
                        <CheckCircle className="w-3.5 h-3.5" /> {t('admin.markDelivered')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mintingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setMintingOrder(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-gray-900 mb-1">{t('admin.markAsDelivered')}</h3>
            <p className="text-sm text-gray-500 mb-4">
              {t('admin.markAsDeliveredDesc', { addr: `${mintingOrder.buyer_wallet.slice(0, 10)}...` })}
            </p>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">{t('admin.tokenIdsComma')}</label>
            <input type="text" value={tokenIdInput} onChange={(e) => setTokenIdInput(e.target.value)}
              placeholder="e.g. 42, 43"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-forest-400 outline-none text-sm mb-4" />
            {actionError && <p className="text-xs text-red-600 mb-3">{actionError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setMintingOrder(null)} className="flex-1 btn-secondary text-sm">{t('admin.cancel')}</button>
              <button onClick={handleMarkMinted} disabled={actionId === mintingOrder.id}
                className="flex-1 btn-primary text-sm disabled:opacity-50">
                {actionId === mintingOrder.id ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {t('admin.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mint Tab ──────────────────────────────────────────────────────────────────

function MintTab() {
  const { t } = useI18n();
  const [form, setForm] = useState<MintForm>({ species: TREE_SPECIES[0], location: '', planter: '', recipientAddress: '' });
  const [isMinting, setIsMinting] = useState(false);
  const [mintStep, setMintStep] = useState('');
  const [mintResult, setMintResult] = useState<{ txHash: string; tokenId?: number } | null>(null);
  const [mintError, setMintError] = useState<string | null>(null);

  const handleMint = async () => {
    if (!form.recipientAddress.startsWith('0x')) { setMintError('Enter a valid recipient address.'); return; }
    if (!form.location.trim()) { setMintError('Location is required.'); return; }
    if (!form.planter.trim()) { setMintError('Planter name is required.'); return; }

    setIsMinting(true); setMintError(null); setMintResult(null);
    try {
      setMintStep('Getting signer...');
      const signer = await getSigner();
      const contract = await getNFTTreeContract(signer);

      setMintStep('Sending transaction...');
      const tx = await contract.mintTree(form.recipientAddress, form.species, form.location, form.planter);

      setMintStep('Waiting for confirmation...');
      const receipt = await tx.wait();

      let tokenId: number | undefined;
      const iface = contract.interface;
      for (const log of receipt.logs ?? []) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === 'TreeMinted') { tokenId = Number(parsed.args.tokenId); break; }
        } catch { /* skip */ }
      }

      setMintResult({ txHash: tx.hash, tokenId });
      setForm({ species: TREE_SPECIES[0], location: '', planter: '', recipientAddress: '' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Mint failed';
      setMintError(msg.startsWith('wrong_network:') ? 'Switch to Monad Testnet.' : msg);
    } finally { setIsMinting(false); setMintStep(''); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h3 className="text-lg font-display font-bold text-gray-900 mb-6 flex items-center gap-2">
          <TreePine className="w-5 h-5 text-forest-600" /> {t('admin.mintOxyTreeOnChain')}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('admin.species')}</label>
            <select value={form.species} onChange={(e) => setForm((p) => ({ ...p, species: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-forest-400 outline-none text-sm bg-white">
              {TREE_SPECIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <MapPin className="w-3.5 h-3.5 inline mr-1" />{t('admin.location')}
            </label>
            <input type="text" value={form.location}
              onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
              placeholder="e.g., Bogor, West Java"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-forest-400 outline-none text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <User className="w-3.5 h-3.5 inline mr-1" />{t('admin.planterName')}
            </label>
            <input type="text" value={form.planter}
              onChange={(e) => setForm((p) => ({ ...p, planter: e.target.value }))}
              placeholder="e.g., Pak Ahmad"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-forest-400 outline-none text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('admin.recipientAddress')}</label>
            <input type="text" value={form.recipientAddress}
              onChange={(e) => setForm((p) => ({ ...p, recipientAddress: e.target.value }))}
              placeholder="0x..."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-forest-400 outline-none text-sm font-mono" />
          </div>
        </div>

        {mintError && (
          <div className="mt-4 flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">{mintError}</p>
          </div>
        )}
        {mintResult && (
          <div className="mt-4 p-4 bg-forest-50 rounded-xl border border-forest-200">
            <p className="text-sm font-semibold text-forest-800 mb-1">
              {t('admin.mintedSuccess', { tokenId: mintResult.tokenId !== undefined ? ` Token #${mintResult.tokenId}` : '' })}
            </p>
            <a href={getExplorerTxUrl(mintResult.txHash)} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-forest-600 hover:text-forest-500">
              {t('admin.viewTransaction')} <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
        {isMinting && mintStep && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-forest-50 rounded-xl">
            <Loader className="w-4 h-4 animate-spin text-forest-600 shrink-0" />
            <p className="text-sm text-forest-700">{mintStep}</p>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button onClick={handleMint} disabled={isMinting} className="btn-primary disabled:opacity-50">
            {isMinting ? <Loader className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {isMinting ? t('admin.minting') : t('admin.mintOxyTree')}
          </button>
          <button onClick={() => setForm({ species: TREE_SPECIES[0], location: '', planter: '', recipientAddress: '' })}
            className="btn-secondary">{t('admin.reset')}</button>
        </div>
      </div>

      <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6">
        <h4 className="font-display font-bold text-amber-800 mb-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" /> {t('admin.requirements')}
        </h4>
        <ul className="space-y-2 text-sm text-amber-700">
          {[
            t('admin.req1'),
            t('admin.req2'),
            t('admin.req3'),
            t('admin.req4'),
          ].map((req) => (
            <li key={req} className="flex items-start gap-2">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />{req}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Settings Tab ──────────────────────────────────────────────────────────────

function SettingsTab() {
  const { t } = useI18n();
  const { settings, isLoading, updateSetting } = useAppSettings();
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const fields = [
    { key: 'tree_price_usd',      label: t('admin.treePriceUsd'),        type: 'number', hint: t('admin.treePriceUsdHint') },
    { key: 'tree_price_oxy',      label: t('admin.treePriceOxy'),        type: 'number', hint: t('admin.treePriceOxyHint') },
    { key: 'oxy_receiver_wallet', label: t('admin.oxyReceiverWallet'), type: 'text',   hint: t('admin.oxyReceiverWalletHint') },
    { key: 'max_order_quantity',  label: t('admin.maxTreesPerOrder'),         type: 'number', hint: t('admin.maxTreesPerOrderHint') },
  ] as const;

  const getValue = (key: string) => editing[key] !== undefined ? editing[key] : String(settings[key as keyof typeof settings] ?? '');

  const handleSave = async (key: string) => {
    setSavingKey(key); setSaveError(null);
    try {
      await updateSetting(key as keyof typeof settings, getValue(key));
      setSavedKey(key);
      setEditing((p) => { const n = { ...p }; delete n[key]; return n; });
      setTimeout(() => setSavedKey(null), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSavingKey(null); }
  };

  if (isLoading) return <div className="text-center py-12"><Loader className="w-7 h-7 animate-spin text-forest-500 mx-auto" /></div>;

  return (
    <div className="max-w-2xl space-y-4">
      {saveError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{saveError}</p>
        </div>
      )}

      {fields.map((field) => {
        const isDirty = editing[field.key] !== undefined;
        const isSaving = savingKey === field.key;
        const isSaved = savedKey === field.key;
        return (
          <div key={field.key} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-gray-900 text-sm">{field.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{field.hint}</p>
              </div>
              {isSaved && (
                <span className="flex items-center gap-1 text-xs text-forest-600 font-medium">
                  <CheckCircle className="w-3.5 h-3.5" /> {t('admin.saved')}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type={field.type === 'number' ? 'number' : 'text'}
                value={getValue(field.key)}
                onChange={(e) => setEditing((p) => ({ ...p, [field.key]: e.target.value }))}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-forest-400 focus:ring-2 focus:ring-forest-100 outline-none text-sm font-mono"
              />
              <button onClick={() => handleSave(field.key)} disabled={isSaving || !isDirty}
                className="px-4 py-2.5 rounded-xl bg-forest-600 text-white text-sm font-semibold hover:bg-forest-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5">
                {isSaving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {t('admin.save')}
              </button>
              {isDirty && (
                <button onClick={() => setEditing((p) => { const n = { ...p }; delete n[field.key]; return n; })}
                  className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
          </div>
        );
      })}

      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5">
        <p className="text-sm font-semibold text-gray-700 mb-1">{t('admin.notes')}</p>
        <ul className="text-xs text-gray-500 space-y-1">
          <li>• {t('admin.note1')}</li>
          <li>• {t('admin.note2')}</li>
          <li>• {t('admin.note3')}</li>
        </ul>
      </div>

      {/* Midtrans status */}
      <div className="rounded-2xl border p-5 bg-white shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-gray-900 text-sm flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-sky-500" />
            {t('admin.midtransGateway')}
          </p>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
            import.meta.env.VITE_MIDTRANS_IS_PRODUCTION === 'true'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            {import.meta.env.VITE_MIDTRANS_IS_PRODUCTION === 'true' ? 'Production' : 'Sandbox'}
          </span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">{t('admin.clientKey')}</span>
            <span className="font-mono text-gray-700">
              {import.meta.env.VITE_MIDTRANS_CLIENT_KEY
                ? `${String(import.meta.env.VITE_MIDTRANS_CLIENT_KEY).slice(0, 22)}…`
                : <span className="text-red-500">{t('admin.notConfigured')}</span>}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Snap.js URL</span>
            <span className="font-mono text-gray-400 truncate max-w-xs">
              {import.meta.env.VITE_MIDTRANS_IS_PRODUCTION === 'true'
                ? 'app.midtrans.com/snap/snap.js'
                : 'app.sandbox.midtrans.com/snap/snap.js'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">{t('admin.serverKeyEdgeFn')}</span>
            <span className="font-mono text-gray-400">{t('admin.serverKeyValue')}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">{t('admin.webhookUrl')}</span>
            <span className="font-mono text-gray-600 truncate max-w-xs text-right">
              {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/midtrans-webhook`}
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
          To go live: set <code className="bg-gray-100 px-1 rounded">VITE_MIDTRANS_IS_PRODUCTION=true</code> and add your
          production <code className="bg-gray-100 px-1 rounded">MIDTRANS_SERVER_KEY</code> as a Supabase Edge Function secret.
        </p>
      </div>
    </div>
  );
}

// ── Reward Pool Tab ───────────────────────────────────────────────────────────

function RewardPoolTab() {
  const { t } = useI18n();
  const { wallet } = useWallet();
  const { rewardPoolBalance, totalStaked, rewardRateBps, claimPeriod, isLoading, refresh } = useStaking();
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState('');
  const [isFunding, setIsFunding] = useState(false);
  const [fundError, setFundError] = useState<string | null>(null);
  const [fundSuccess, setFundSuccess] = useState<{ txHash: string } | null>(null);
  const [oxyBalance, setOxyBalance] = useState<string | null>(null);
  const [oxyLoading, setOxyLoading] = useState(false);

  // Sync state
  const [contractRawBalance, setContractRawBalance] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<{ txHash: string; delta: string } | null>(null);

  const fetchOxyBalance = useCallback(async () => {
    if (!wallet.address) return;
    setOxyLoading(true);
    try {
      const oxyContract = await getOxyTokenContract();
      const [walletBal, contractBal] = await Promise.all([
        oxyContract.balanceOf(wallet.address),
        oxyContract.balanceOf(CONTRACT_ADDRESSES.STAKING_POOL),
      ]);
      setOxyBalance(parseFloat(formatOxy(walletBal)).toLocaleString(undefined, { maximumFractionDigits: 2 }));
      setContractRawBalance(formatOxy(contractBal));
    } catch {
      setOxyBalance(null);
      setContractRawBalance(null);
    } finally {
      setOxyLoading(false);
    }
  }, [wallet.address]);

  useEffect(() => { fetchOxyBalance(); }, [fetchOxyBalance]);

  const poolBalance = parseFloat(rewardPoolBalance);
  const dailyRewardPerToken = totalStaked > 0
    ? (poolBalance * (rewardRateBps / 10000)) / totalStaked
    : 0;
  const daysUntilEmpty = totalStaked > 0 && dailyRewardPerToken > 0
    ? poolBalance / (dailyRewardPerToken * totalStaked)
    : null;

  const handleFund = async () => {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setFundError('Enter a valid amount greater than 0.');
      return;
    }
    setIsFunding(true);
    setFundError(null);
    setFundSuccess(null);

    try {
      setStep('Getting signer...');
      const signer = await getSigner();

      setStep('Checking OXY allowance...');
      const oxyContract = await getOxyTokenContract(signer);
      const parsedAmount = parseOxy(amount);
      const allowance = await oxyContract.allowance(wallet.address!, CONTRACT_ADDRESSES.STAKING_POOL);

      if (allowance < parsedAmount) {
        setStep('Approving OXY spend...');
        const approveTx = await oxyContract.approve(CONTRACT_ADDRESSES.STAKING_POOL, parsedAmount);
        await approveTx.wait();
      }

      setStep('Funding reward pool...');
      const stakingContract = await getStakingPoolContract(signer);
      const tx = await stakingContract.fundRewardsPool(parsedAmount);

      setStep('Waiting for confirmation...');
      await tx.wait();

      setFundSuccess({ txHash: tx.hash });
      setAmount('');
      await refresh();
      await fetchOxyBalance();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Funding failed';
      const match = msg.match(/reason="([^"]+)"/);
      setFundError(match ? match[1] : msg.startsWith('wrong_network:') ? 'Switch to Monad Testnet.' : msg);
    } finally {
      setIsFunding(false);
      setStep('');
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    setSyncSuccess(null);
    try {
      const signer = await getSigner();
      const stakingContract = await getStakingPoolContract(signer);
      const tx = await stakingContract.syncRewardPool();
      await tx.wait();
      const delta = contractRawBalance
        ? (parseFloat(contractRawBalance) - parseFloat(rewardPoolBalance)).toLocaleString(undefined, { maximumFractionDigits: 2 })
        : '?';
      setSyncSuccess({ txHash: tx.hash, delta });
      await refresh();
      await fetchOxyBalance();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      const match = msg.match(/reason="([^"]+)"/);
      setSyncError(match ? match[1] : msg.startsWith('wrong_network:') ? 'Switch to Monad Testnet.' : msg);
    } finally {
      setIsSyncing(false);
    }
  };

  const untrackedBalance = contractRawBalance !== null
    ? Math.max(0, parseFloat(contractRawBalance) - parseFloat(rewardPoolBalance))
    : null;
  const hasSyncable = untrackedBalance !== null && untrackedBalance > 0;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Pool status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: t('admin.poolBalance'),
            value: isLoading ? '...' : `${parseFloat(rewardPoolBalance).toLocaleString(undefined, { maximumFractionDigits: 0 })} OXY`,
            icon: <Coins className="w-5 h-5" />,
            color: 'bg-forest-50 text-forest-600',
            highlight: poolBalance === 0,
          },
          {
            label: t('admin.totalStakedTrees'),
            value: isLoading ? '...' : totalStaked.toLocaleString(),
            icon: <TreePine className="w-5 h-5" />,
            color: 'bg-sky-50 text-sky-600',
          },
          {
            label: t('admin.dailyRewardPerTree'),
            value: isLoading ? '...' : `${dailyRewardPerToken.toLocaleString(undefined, { maximumFractionDigits: 4 })} OXY`,
            icon: <TrendingUp className="w-5 h-5" />,
            color: 'bg-amber-50 text-amber-600',
          },
          {
            label: t('admin.poolRunway'),
            value: isLoading ? '...' : daysUntilEmpty !== null ? `~${Math.floor(daysUntilEmpty)} ${t('admin.days')}` : 'N/A',
            icon: <Clock className="w-5 h-5" />,
            color: 'bg-emerald-50 text-emerald-600',
          },
        ].map((s) => (
          <div key={s.label} className={`bg-white rounded-2xl border p-5 shadow-sm ${s.highlight ? 'border-red-200' : 'border-gray-100'}`}>
            <div className={`w-9 h-9 rounded-xl ${s.color} flex items-center justify-center mb-3`}>{s.icon}</div>
            <p className={`text-xl font-display font-bold ${s.highlight ? 'text-red-600' : 'text-gray-900'}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {poolBalance === 0 && !hasSyncable && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">{t('admin.poolEmpty')}</p>
            <p className="text-sm text-red-700 mt-0.5">{t('admin.poolEmptyDesc')}</p>
          </div>
        </div>
      )}

      {/* Sync section — shown when contract holds untracked OXY */}
      {hasSyncable && (
        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw className="w-4 h-4 text-sky-600" />
                <p className="text-sm font-semibold text-sky-800">{t('admin.untrackedOxy')}</p>
              </div>
              <p className="text-sm text-sky-700">
                Kontrak memegang OXY yang belum tercatat sebagai reward pool — kemungkinan dari <code className="bg-sky-100 px-1 rounded text-xs">mintStakingAllocation()</code>.
                Sinkronkan untuk menjadikannya tersedia sebagai reward.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                <div className="bg-white rounded-lg p-2 border border-sky-100">
                  <p className="text-gray-400">Saldo ERC20 aktual</p>
                  <p className="font-bold text-gray-800 mt-0.5">
                    {oxyLoading ? '...' : parseFloat(contractRawBalance!).toLocaleString(undefined, { maximumFractionDigits: 0 })} OXY
                  </p>
                </div>
                <div className="bg-white rounded-lg p-2 border border-sky-100">
                  <p className="text-gray-400">rewardPoolBalance</p>
                  <p className="font-bold text-gray-800 mt-0.5">
                    {parseFloat(rewardPoolBalance).toLocaleString(undefined, { maximumFractionDigits: 0 })} OXY
                  </p>
                </div>
                <div className="bg-sky-100 rounded-lg p-2 border border-sky-200">
                  <p className="text-sky-600">Akan disinkronkan</p>
                  <p className="font-bold text-sky-800 mt-0.5">
                    +{untrackedBalance!.toLocaleString(undefined, { maximumFractionDigits: 0 })} OXY
                  </p>
                </div>
              </div>
            </div>
            <div className="shrink-0">
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="btn-primary bg-sky-600 hover:bg-sky-700 disabled:opacity-50 whitespace-nowrap"
              >
                {isSyncing ? (
                  <><Loader className="w-4 h-4 animate-spin" /> Syncing...</>
                ) : (
                  <><RefreshCw className="w-4 h-4" /> Sync ke Pool</>
                )}
              </button>
            </div>
          </div>

          {syncError && (
            <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{syncError}</p>
            </div>
          )}
          {syncSuccess && (
            <div className="mt-3 p-3 bg-white rounded-xl border border-sky-200">
              <p className="text-sm font-semibold text-sky-800">Sync berhasil! +{syncSuccess.delta} OXY masuk ke reward pool.</p>
              <a href={getExplorerTxUrl(syncSuccess.txHash)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-500 mt-1">
                Lihat transaksi <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Fund form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h3 className="text-lg font-display font-bold text-gray-900 mb-1 flex items-center gap-2">
            <Zap className="w-5 h-5 text-gold-500" /> {t('admin.fundRewardPool')}
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            {t('admin.fundRewardPoolDesc')}
          </p>

          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-700">{t('admin.amount')}</label>
            {oxyBalance !== null && (
              <button
                onClick={() => setAmount(oxyBalance.replace(/,/g, ''))}
                className="text-xs text-forest-600 hover:text-forest-800 font-medium"
              >
                {t('admin.balance', { balance: oxyLoading ? '...' : oxyBalance })}
              </button>
            )}
          </div>

          <div className="relative mb-4">
            <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 10000"
              className="w-full pl-10 pr-16 py-3 rounded-xl border border-gray-200 focus:border-forest-400 focus:ring-2 focus:ring-forest-100 outline-none text-lg font-semibold"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">OXY</span>
          </div>

          {/* Quick amounts */}
          <div className="flex gap-2 mb-5">
            {['1000', '10000', '50000', '100000'].map((v) => (
              <button
                key={v}
                onClick={() => setAmount(v)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  amount === v ? 'bg-forest-600 text-white border-forest-600' : 'border-gray-200 text-gray-600 hover:border-forest-400'
                }`}
              >
                {parseInt(v).toLocaleString()}
              </button>
            ))}
          </div>

          {isFunding && step && (
            <div className="mb-4 flex items-center gap-2 p-3 bg-forest-50 rounded-xl border border-forest-200">
              <Loader className="w-4 h-4 animate-spin text-forest-600 shrink-0" />
              <p className="text-sm text-forest-700">{step}</p>
            </div>
          )}

          {fundError && (
            <div className="mb-4 flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{fundError}</p>
            </div>
          )}

          {fundSuccess && (
            <div className="mb-4 p-4 bg-forest-50 rounded-xl border border-forest-200">
              <p className="text-sm font-semibold text-forest-800 mb-1">{t('admin.poolFundedSuccess')}</p>
              <a
                href={getExplorerTxUrl(fundSuccess.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-forest-600 hover:text-forest-500"
              >
                {t('admin.viewTransaction')} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          <button
            onClick={handleFund}
            disabled={isFunding || !amount}
            className="w-full btn-gold py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isFunding ? (
              <span className="flex items-center justify-center gap-2">
                <Loader className="w-5 h-5 animate-spin" />
                {t('admin.funding')}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Zap className="w-5 h-5" />
                {t('admin.fundPool', { amount: amount ? `${parseFloat(amount).toLocaleString()} OXY` : t('admin.fundPoolBtn') })}
              </span>
            )}
          </button>
        </div>

        {/* Technical guide */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h4 className="font-display font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-sky-500" /> {t('admin.howPoolWorks')}
            </h4>
            <div className="space-y-4 text-sm text-gray-600">
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-forest-100 text-forest-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</div>
                <div>
                  <p className="font-semibold text-gray-800">{t('admin.poolBalanceDrives')}</p>
                  <p className="mt-0.5">{t('admin.poolBalanceDrivesDesc')}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-forest-100 text-forest-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</div>
                <div>
                  <p className="font-semibold text-gray-800">{t('admin.claimPeriod24h')}</p>
                  <p className="mt-0.5">{t('admin.claimPeriod24hDesc')}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">A</div>
                <div>
                  <p className="font-semibold text-gray-800">{t('admin.adminManualFunding')}</p>
                  <p className="mt-0.5">{t('admin.adminManualFundingDesc')}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">B</div>
                <div>
                  <p className="font-semibold text-gray-800">{t('admin.marketplaceFeesAuto')}</p>
                  <p className="mt-0.5">{t('admin.marketplaceFeesAutoDesc')}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
            <h4 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {t('admin.requirements')}
            </h4>
            <ul className="space-y-2 text-sm text-amber-700">
              {[
                t('admin.req1'),
                t('admin.req2'),
                t('admin.req3'),
                t('admin.req4'),
              ].map((req) => (
                <li key={req} className="flex items-start gap-2">
                  <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-0.5" />{req}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h4 className="font-semibold text-gray-800 mb-3">{t('admin.contractReference')}</h4>
            <div className="space-y-2 text-xs font-mono text-gray-600">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-400 mb-1">// Manual funding</p>
                <p>StakingPool.fundRewardsPool(uint256 amount)</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-400 mb-1">// Auto from marketplace sales</p>
                <p>StakingPool.receiveMarketplaceFees(uint256 amount)</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-400 mb-1">// Reward rate constant</p>
                <p>REWARD_RATE_BPS = {rewardRateBps} ({(rewardRateBps / 100).toFixed(2)}% per day per token)</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-400 mb-1">// Claim period constant</p>
                <p>CLAIM_PERIOD = {claimPeriod}s ({claimPeriod / 3600}h)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Exchange Links Tab ────────────────────────────────────────────────────────

const BLANK_LINK: Omit<ExchangeLink, 'id' | 'created_at'> = {
  name: '', type: 'dex', url: '', logo_url: null, pair: 'OXY/USDT', is_active: true, sort_order: 0,
};

function ExchangeLinksTab() {
  const { t } = useI18n();
  const { links, isLoading, upsert, remove, toggleActive, refresh } = useExchangeLinks();
  const [editing, setEditing] = useState<(Partial<ExchangeLink> & { id?: string }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true); setError(null);
    try {
      await upsert(editing);
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this exchange link?')) return;
    try { await remove(id); } catch (err) { setError(err instanceof Error ? err.message : 'Delete failed'); }
  };

  const dex = links.filter((l) => l.type === 'dex');
  const cex = links.filter((l) => l.type === 'cex');

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold text-gray-900">{t('admin.exchangeLinks')}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{t('admin.exchangeLinksDesc')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={refresh} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <RefreshCw className={`w-4 h-4 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setEditing({ ...BLANK_LINK })}
            className="flex items-center gap-2 px-4 py-2 bg-forest-600 text-white text-sm font-semibold rounded-xl hover:bg-forest-700 transition-colors">
            <Plus className="w-4 h-4" /> {t('admin.addLink')}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12"><Loader className="w-7 h-7 animate-spin text-forest-500 mx-auto" /></div>
      ) : (
        <div className="space-y-6">
          {[{ label: 'DEX (Decentralized)', items: dex }, { label: 'CEX (Centralized)', items: cex }].map(({ label, items }) => (
            <div key={label}>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{label}</p>
              {items.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center bg-gray-50 rounded-2xl">No {label.split(' ')[0]} links yet.</p>
              ) : (
                <div className="space-y-2">
                  {items.map((link) => (
                    <div key={link.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-4">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${link.type === 'dex' ? 'bg-forest-50 text-forest-600' : 'bg-ocean-50 text-ocean-600'}`}>
                        <Globe className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 text-sm">{link.name}</p>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${link.type === 'dex' ? 'bg-forest-50 text-forest-700' : 'bg-ocean-50 text-ocean-700'}`}>
                            {link.type.toUpperCase()}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{link.pair}</span>
                        </div>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{link.url}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => toggleActive(link.id, !link.is_active)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${link.is_active ? 'bg-forest-50 text-forest-700 hover:bg-forest-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >
                          {link.is_active ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                          {link.is_active ? t('admin.active') : t('admin.hidden')}
                        </button>
                        <button onClick={() => setEditing({ ...link })}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                          <Save className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(link.id)}
                          className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-gray-900 mb-5">
              {editing.id ? t('admin.editExchangeLink') : t('admin.addExchangeLink')}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">{t('admin.name')}</label>
                <input type="text" value={editing.name ?? ''} onChange={(e) => setEditing((p) => p && ({ ...p, name: e.target.value }))}
                  placeholder="e.g. CoreSwap" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-forest-400 outline-none text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">{t('admin.type')}</label>
                  <select value={editing.type ?? 'dex'} onChange={(e) => setEditing((p) => p && ({ ...p, type: e.target.value as 'dex' | 'cex' }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-forest-400 outline-none text-sm bg-white">
                    <option value="dex">DEX</option>
                    <option value="cex">CEX</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">{t('admin.pair')}</label>
                  <input type="text" value={editing.pair ?? ''} onChange={(e) => setEditing((p) => p && ({ ...p, pair: e.target.value }))}
                    placeholder="OXY/USDT" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-forest-400 outline-none text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">{t('admin.url')}</label>
                <input type="url" value={editing.url ?? ''} onChange={(e) => setEditing((p) => p && ({ ...p, url: e.target.value }))}
                  placeholder="https://..." className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-forest-400 outline-none text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">{t('admin.logoUrl')}</label>
                  <input type="url" value={editing.logo_url ?? ''} onChange={(e) => setEditing((p) => p && ({ ...p, logo_url: e.target.value || null }))}
                    placeholder="https://..." className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-forest-400 outline-none text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">{t('admin.sortOrder')}</label>
                  <input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing((p) => p && ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-forest-400 outline-none text-sm" />
                </div>
              </div>
            </div>
            {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditing(null)} className="flex-1 btn-secondary text-sm">{t('admin.cancel')}</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 btn-primary text-sm disabled:opacity-50">
                {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t('admin.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── IDO Management Tab ────────────────────────────────────────────────────────

const BLANK_PHASE: Omit<IDOPhase, 'id' | 'sold_oxy'> = {
  phase_name: '',
  price_per_oxy: 0.0001,
  hard_cap_oxy: 10_000_000,
  min_buy_oxy: 100,
  max_buy_oxy: 100_000,
  start_time: new Date().toISOString().slice(0, 16),
  end_time: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
  is_active: false,
};

function IDOTab() {
  const { t } = useI18n();
  const { phases, isLoading, refresh } = useIDO();
  const [editing, setEditing] = useState<Partial<IDOPhase> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true); setError(null);
    try {
      if (editing.id) {
        const { error: e } = await supabase.from('ido_phases').update(editing).eq('id', editing.id);
        if (e) throw new Error(e.message);
      } else {
        const { error: e } = await supabase.from('ido_phases').insert([{ ...BLANK_PHASE, ...editing }]);
        if (e) throw new Error(e.message);
      }
      await refresh();
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this IDO phase?')) return;
    const { error: e } = await supabase.from('ido_phases').delete().eq('id', id);
    if (e) setError(e.message);
    else await refresh();
  };

  const togglePhase = async (id: string, is_active: boolean) => {
    await supabase.from('ido_phases').update({ is_active }).eq('id', id);
    await refresh();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold text-gray-900">{t('admin.idoPhases')}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{t('admin.idoPhasesDesc')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={refresh} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <RefreshCw className={`w-4 h-4 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setEditing({ ...BLANK_PHASE })}
            className="flex items-center gap-2 px-4 py-2 bg-ocean-600 text-white text-sm font-semibold rounded-xl hover:bg-ocean-700 transition-colors">
            <Plus className="w-4 h-4" /> {t('admin.addPhase')}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12"><Loader className="w-7 h-7 animate-spin text-forest-500 mx-auto" /></div>
      ) : phases.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl">
          <CalendarClock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">{t('admin.noIdoPhases')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {phases.map((phase) => {
            const progress = phase.hard_cap_oxy > 0 ? (phase.sold_oxy / phase.hard_cap_oxy) * 100 : 0;
            const now = new Date();
            const start = new Date(phase.start_time);
            const end = new Date(phase.end_time);
            const statusLabel = !phase.is_active ? t('admin.inactive') : now < start ? t('admin.upcoming') : now > end ? t('admin.ended') : 'Live';
            const statusColor = statusLabel === 'Live' ? 'bg-forest-50 text-forest-700' : statusLabel === 'Upcoming' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500';

            return (
              <div key={phase.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      <p className="font-display font-bold text-gray-900">{phase.phase_name}</p>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColor}`}>{statusLabel}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1.5 text-xs text-gray-500 mb-4">
                      <span>Price: <strong className="text-gray-800">{phase.price_per_oxy} MON/OXY</strong></span>
                      <span>Cap: <strong className="text-gray-800">{Number(phase.hard_cap_oxy).toLocaleString()} OXY</strong></span>
                      <span>Min: <strong className="text-gray-800">{Number(phase.min_buy_oxy).toLocaleString()} OXY</strong></span>
                      <span>Max: <strong className="text-gray-800">{Number(phase.max_buy_oxy).toLocaleString()} OXY</strong></span>
                      <span>Start: <strong className="text-gray-800">{new Date(phase.start_time).toLocaleDateString()}</strong></span>
                      <span>End: <strong className="text-gray-800">{new Date(phase.end_time).toLocaleDateString()}</strong></span>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Sold: {Number(phase.sold_oxy).toLocaleString()} OXY</span>
                        <span>{progress.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-ocean-400 to-ocean-600 transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={() => togglePhase(phase.id, !phase.is_active)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${phase.is_active ? 'bg-forest-50 text-forest-700 hover:bg-forest-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {phase.is_active ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                      {phase.is_active ? 'Active' : 'Inactive'}
                    </button>
                    <button onClick={() => setEditing({ ...phase })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors">
                      <Save className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button onClick={() => handleDelete(phase.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-gray-900 mb-5">
              {editing.id ? t('admin.editIdoPhase') : t('admin.addIdoPhase')}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">{t('admin.phaseName')}</label>
                <input type="text" value={editing.phase_name ?? ''} onChange={(e) => setEditing((p) => p && ({ ...p, phase_name: e.target.value }))}
                  placeholder="e.g. Seed Round" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-ocean-400 outline-none text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">{t('admin.priceTcoreOxy')}</label>
                  <input type="number" step="0.000001" value={editing.price_per_oxy ?? 0} onChange={(e) => setEditing((p) => p && ({ ...p, price_per_oxy: parseFloat(e.target.value) }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-ocean-400 outline-none text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">{t('admin.hardCapOxy')}</label>
                  <input type="number" value={editing.hard_cap_oxy ?? 0} onChange={(e) => setEditing((p) => p && ({ ...p, hard_cap_oxy: parseFloat(e.target.value) }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-ocean-400 outline-none text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">{t('admin.minBuyOxy')}</label>
                  <input type="number" value={editing.min_buy_oxy ?? 100} onChange={(e) => setEditing((p) => p && ({ ...p, min_buy_oxy: parseFloat(e.target.value) }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-ocean-400 outline-none text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">{t('admin.maxBuyOxy')}</label>
                  <input type="number" value={editing.max_buy_oxy ?? 100000} onChange={(e) => setEditing((p) => p && ({ ...p, max_buy_oxy: parseFloat(e.target.value) }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-ocean-400 outline-none text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">{t('admin.startTime')}</label>
                  <input type="datetime-local" value={editing.start_time?.slice(0, 16) ?? ''} onChange={(e) => setEditing((p) => p && ({ ...p, start_time: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-ocean-400 outline-none text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">{t('admin.endTime')}</label>
                  <input type="datetime-local" value={editing.end_time?.slice(0, 16) ?? ''} onChange={(e) => setEditing((p) => p && ({ ...p, end_time: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-ocean-400 outline-none text-sm" />
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-xl">
                <input type="checkbox" checked={editing.is_active ?? false} onChange={(e) => setEditing((p) => p && ({ ...p, is_active: e.target.checked }))}
                  className="w-4 h-4 rounded accent-ocean-600" />
                <div>
                  <p className="text-sm font-semibold text-gray-800">{t('admin.activeLabel')}</p>
                  <p className="text-xs text-gray-500">{t('admin.activeLabelDesc')}</p>
                </div>
              </label>
            </div>
            {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditing(null)} className="flex-1 btn-secondary text-sm">{t('admin.cancel')}</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-ocean-600 text-white font-semibold rounded-xl hover:bg-ocean-700 transition-colors disabled:opacity-50 text-sm">
                {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t('admin.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Metadata Generator Tab ────────────────────────────────────────────────────

interface MetaField {
  location: string;
  planter: string;
}

function MetadataTab({ orders }: { orders: PurchaseOrder[] }) {
  const { t } = useI18n();
  const deliveredOrders = orders.filter(
    (o) => o.status === 'delivered' && o.token_ids?.length > 0,
  );

  const [fields, setFields] = useState<Record<string, MetaField>>({});
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const getKey = (orderId: string, tokenId: number) => `${orderId}_${tokenId}`;
  const getField = (key: string): MetaField => fields[key] ?? { location: '', planter: '' };
  const setField = (key: string, update: Partial<MetaField>) =>
    setFields((prev) => ({ ...prev, [key]: { ...getField(key), ...update } }));

  const buildMetadata = (order: PurchaseOrder, tokenId: number) => {
    const f = getField(getKey(order.id, tokenId));
    return {
      name: `Oryxon Tree #${tokenId}`,
      description: `A certified OxyTree from Oryxon. This token represents a real ${order.tree_species} tree planted on the Monad Testnet ecosystem.`,
      image: '',
      external_url: '',
      attributes: [
        { trait_type: 'Species',      value: order.tree_species },
        { trait_type: 'Location',     value: f.location },
        { trait_type: 'Planter',      value: f.planter },
        { trait_type: 'Order ID',     value: order.id },
        { trait_type: 'Buyer Wallet', value: order.buyer_wallet },
      ],
    };
  };

  const downloadJSON = (tokenId: number, metadata: object) => {
    const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tokenId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAll = () => {
    deliveredOrders.forEach((order) => {
      order.token_ids.forEach((tokenId) => {
        downloadJSON(tokenId, buildMetadata(order, tokenId));
      });
    });
  };

  const copyJSON = async (key: string, meta: object) => {
    await navigator.clipboard.writeText(JSON.stringify(meta, null, 2));
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const previewEntry = previewKey
    ? (() => {
        for (const order of deliveredOrders) {
          for (const tokenId of order.token_ids) {
            if (getKey(order.id, tokenId) === previewKey) {
              return { order, tokenId, meta: buildMetadata(order, tokenId) };
            }
          }
        }
        return null;
      })()
    : null;

  const totalTokens = deliveredOrders.reduce((s, o) => s + o.token_ids.length, 0);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-display font-bold text-gray-900 text-lg flex items-center gap-2">
            <FileJson className="w-5 h-5 text-forest-600" /> {t('admin.metadataGen')}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {t('admin.metadataGenDesc')}
          </p>
        </div>
        {totalTokens > 0 && (
          <button
            onClick={downloadAll}
            className="flex items-center gap-2 px-4 py-2.5 bg-forest-600 hover:bg-forest-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Download className="w-4 h-4" />
            {t('admin.downloadAll', { count: totalTokens })}
          </button>
        )}
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-sky-50 border border-sky-200 rounded-2xl">
        <Info className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
        <div className="text-sm text-sky-700 space-y-1">
          <p className="font-semibold text-sky-800">{t('admin.howToUse')}</p>
          <p>Fill in Location and Planter for each token. Download the JSON and upload it to your metadata hosting (IPFS, CDN, etc). Set the contract's <code className="bg-sky-100 px-1 rounded text-xs">baseURI</code> to point to the folder containing these files (e.g. <code className="bg-sky-100 px-1 rounded text-xs">ipfs://Qm.../</code>). Each file must be named <code className="bg-sky-100 px-1 rounded text-xs">{'{tokenId}'}.json</code>.</p>
        </div>
      </div>

      {deliveredOrders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Package className="w-14 h-14 text-gray-200 mx-auto mb-4" />
          <p className="font-display font-bold text-gray-600 text-lg mb-1">{t('admin.noDeliveredOrders')}</p>
          <p className="text-sm text-gray-400 max-w-xs mx-auto">
            {t('admin.noDeliveredDesc')}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {deliveredOrders.map((order) => (
            <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Order header */}
              <div className="flex items-center gap-3 px-5 py-3.5 bg-gray-50 border-b border-gray-100">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-gray-900">
                    {order.quantity}× {order.tree_species}
                  </span>
                  <span className="ml-3 text-xs text-gray-400 font-mono">{shortenAddr(order.buyer_wallet)}</span>
                  <span className="ml-2 text-xs text-gray-400">{formatDate(order.created_at)}</span>
                </div>
                <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-semibold">
                  {order.token_ids.length} token{order.token_ids.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* Per-token rows */}
              <div className="divide-y divide-gray-50">
                {order.token_ids.map((tokenId) => {
                  const key = getKey(order.id, tokenId);
                  const f = getField(key);
                  const meta = buildMetadata(order, tokenId);
                  const isCopied = copiedKey === key;

                  return (
                    <div key={tokenId} className="px-5 py-4">
                      <div className="flex items-start gap-4 flex-wrap lg:flex-nowrap">
                        {/* Token ID badge */}
                        <div className="w-16 h-16 shrink-0 rounded-xl bg-gradient-to-br from-forest-900 to-gray-900 flex flex-col items-center justify-center gap-0.5">
                          <TreePine className="w-5 h-5 text-forest-400/70" />
                          <span className="text-white/60 text-[10px] font-mono">#{tokenId}</span>
                        </div>

                        {/* Editable fields */}
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                          <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                              <MapPin className="w-3 h-3 inline mr-1" />{t('admin.location')}
                            </label>
                            <input
                              type="text"
                              value={f.location}
                              onChange={(e) => setField(key, { location: e.target.value })}
                              placeholder="e.g. Bogor, West Java"
                              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:border-forest-400 focus:ring-2 focus:ring-forest-100 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                              <User className="w-3 h-3 inline mr-1" />{t('admin.planterName')}
                            </label>
                            <input
                              type="text"
                              value={f.planter}
                              onChange={(e) => setField(key, { planter: e.target.value })}
                              placeholder="e.g. Pak Ahmad"
                              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:border-forest-400 focus:ring-2 focus:ring-forest-100 outline-none"
                            />
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setPreviewKey(key)}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" /> {t('admin.preview')}
                          </button>
                          <button
                            onClick={() => copyJSON(key, meta)}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border rounded-xl transition-colors ${
                              isCopied
                                ? 'bg-forest-50 text-forest-700 border-forest-200'
                                : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200'
                            }`}
                          >
                            {isCopied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {isCopied ? t('admin.copied') : t('admin.copy')}
                          </button>
                          <button
                            onClick={() => downloadJSON(tokenId, meta)}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-forest-600 text-white hover:bg-forest-700 rounded-xl transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" /> {tokenId}.json
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setPreviewKey(null)}
        >
          <div
            className="bg-gray-950 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <FileJson className="w-4 h-4 text-forest-400" />
                <span className="font-semibold text-white text-sm">
                  {previewEntry.tokenId}.json
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyJSON(previewKey!, previewEntry.meta)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-800 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <Copy className="w-3 h-3" /> {t('admin.copy')}
                </button>
                <button
                  onClick={() => downloadJSON(previewEntry.tokenId, previewEntry.meta)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-forest-700 text-white hover:bg-forest-600 rounded-lg transition-colors"
                >
                  <Download className="w-3 h-3" /> {t('admin.download')}
                </button>
                <button
                  onClick={() => setPreviewKey(null)}
                  className="p-1.5 text-gray-500 hover:text-white rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <pre className="p-5 text-xs text-forest-300 font-mono leading-relaxed overflow-x-auto max-h-[70vh] overflow-y-auto bg-gray-950">
              {JSON.stringify(previewEntry.meta, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Vesting Admin Tab ────────────────────────────────────────────────────────

interface IDOPurchaseRecord {
  id: string;
  phase_id: string;
  buyer_wallet: string;
  oxy_amount: number;
  mon_amount: number;
  tx_hash: string;
  status: string;
  created_at: string;
}

function VestingAdminTab() {
  const { wallet } = useWallet();
  const { contractInfo, createSchedule, createScheduleBatch, revoke, withdrawUnallocated, refreshInfo } = useIDOVesting(wallet.address);

  const [mode, setMode] = useState<'single' | 'batch'>('single');

  // Single form
  const [beneficiary, setBeneficiary] = useState('');
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 16));
  const [cliffDays, setCliffDays] = useState('30');
  const [vestingDays, setVestingDays] = useState('180');
  const [revocable, setRevocable] = useState(true);

  // Batch form
  const [batchRows, setBatchRows] = useState<{ address: string; amount: string }[]>([{ address: '', amount: '' }]);
  const [batchStartDate, setBatchStartDate] = useState(new Date().toISOString().slice(0, 16));
  const [batchCliffDays, setBatchCliffDays] = useState('30');
  const [batchVestingDays, setBatchVestingDays] = useState('180');
  const [batchRevocable, setBatchRevocable] = useState(true);

  // Revoke form
  const [revokeAddr, setRevokeAddr] = useState('');
  const [withdrawAddr, setWithdrawAddr] = useState('');

  // IDO purchases
  const [idoPurchases, setIdoPurchases] = useState<IDOPurchaseRecord[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [selectedPurchases, setSelectedPurchases] = useState<Set<string>>(new Set());

  // State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ msg: string; txHash: string } | null>(null);

  const fetchPurchases = useCallback(async () => {
    setPurchasesLoading(true);
    try {
      const { data: resp, error: fnError } = await supabase.functions.invoke('get-admin-ido-purchases');
      if (fnError) throw fnError;
      const records = (resp as { data?: IDOPurchaseRecord[] })?.data ?? (resp as IDOPurchaseRecord[]) ?? [];
      setIdoPurchases(Array.isArray(records) ? records : []);
    } catch {
      setIdoPurchases([]);
    } finally {
      setPurchasesLoading(false);
    }
  }, []);

  useEffect(() => { fetchPurchases(); }, [fetchPurchases]);

  const togglePurchase = (id: string) => {
    setSelectedPurchases((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllPurchases = () => {
    if (selectedPurchases.size === idoPurchases.length) {
      setSelectedPurchases(new Set());
    } else {
      setSelectedPurchases(new Set(idoPurchases.map((p) => p.id)));
    }
  };

  const loadSelectedToBatch = () => {
    const selected = idoPurchases.filter((p) => selectedPurchases.has(p.id));
    if (selected.length === 0) return;
    // Aggregate by buyer_wallet (sum amounts for same buyer)
    const byWallet = new Map<string, number>();
    for (const p of selected) {
      byWallet.set(p.buyer_wallet, (byWallet.get(p.buyer_wallet) ?? 0) + p.oxy_amount);
    }
    const rows = Array.from(byWallet.entries()).map(([address, amt]) => ({
      address,
      amount: String(amt),
    }));
    setBatchRows(rows);
    setMode('batch');
    setError(null);
    setSuccess(null);
  };

  const handleSingle = async () => {
    if (!beneficiary.startsWith('0x') || beneficiary.length !== 42) { setError('Enter a valid wallet address.'); return; }
    if (!amount || parseFloat(amount) <= 0) { setError('Enter a valid OXY amount.'); return; }
    setIsSubmitting(true); setError(null); setSuccess(null);
    try {
      const startTs = Math.floor(new Date(startDate).getTime() / 1000);
      const cliffSec = parseInt(cliffDays) * 86400;
      const vestSec = parseInt(vestingDays) * 86400;
      if (vestSec <= 0) { setError('Vesting duration must be > 0.'); setIsSubmitting(false); return; }
      if (cliffSec > vestSec) { setError('Cliff cannot exceed vesting duration.'); setIsSubmitting(false); return; }
      const hash = await createSchedule(beneficiary, amount, startTs, cliffSec, vestSec, revocable);
      setSuccess({ msg: `Schedule created for ${beneficiary.slice(0, 8)}...${beneficiary.slice(-4)}`, txHash: hash });
      setBeneficiary(''); setAmount('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed';
      const match = msg.match(/reason="([^"]+)"/);
      setError(match ? match[1] : msg.startsWith('wrong_network:') ? 'Switch to Monad Testnet.' : msg);
    } finally { setIsSubmitting(false); }
  };

  const handleBatch = async () => {
    const valid = batchRows.filter((r) => r.address.startsWith('0x') && r.address.length === 42 && parseFloat(r.amount) > 0);
    if (valid.length === 0) { setError('Add at least one valid row.'); return; }
    setIsSubmitting(true); setError(null); setSuccess(null);
    try {
      const startTs = Math.floor(new Date(batchStartDate).getTime() / 1000);
      const cliffSec = parseInt(batchCliffDays) * 86400;
      const vestSec = parseInt(batchVestingDays) * 86400;
      if (vestSec <= 0 || cliffSec > vestSec) { setError('Invalid cliff/vesting values.'); setIsSubmitting(false); return; }
      const hash = await createScheduleBatch(
        valid.map((r) => r.address),
        valid.map((r) => r.amount),
        startTs, cliffSec, vestSec, batchRevocable,
      );
      setSuccess({ msg: `Batch created: ${valid.length} schedules`, txHash: hash });
      setBatchRows([{ address: '', amount: '' }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed';
      const match = msg.match(/reason="([^"]+)"/);
      setError(match ? match[1] : msg);
    } finally { setIsSubmitting(false); }
  };

  const handleRevoke = async () => {
    if (!revokeAddr.startsWith('0x')) { setError('Enter a valid address.'); return; }
    setIsSubmitting(true); setError(null); setSuccess(null);
    try {
      const hash = await revoke(revokeAddr);
      setSuccess({ msg: `Schedule revoked for ${revokeAddr.slice(0, 10)}...`, txHash: hash });
      setRevokeAddr('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed';
      const match = msg.match(/reason="([^"]+)"/);
      setError(match ? match[1] : msg);
    } finally { setIsSubmitting(false); }
  };

  const handleWithdraw = async () => {
    if (!withdrawAddr.startsWith('0x')) { setError('Enter a valid address.'); return; }
    setIsSubmitting(true); setError(null); setSuccess(null);
    try {
      const hash = await withdrawUnallocated(withdrawAddr);
      setSuccess({ msg: `Unallocated tokens withdrawn to ${withdrawAddr.slice(0, 10)}...`, txHash: hash });
      setWithdrawAddr('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed';
      const match = msg.match(/reason="([^"]+)"/);
      setError(match ? match[1] : msg);
    } finally { setIsSubmitting(false); }
  };

  const unallocated = contractInfo
    ? Math.max(0, parseFloat(contractInfo.contractBalance) - parseFloat(contractInfo.totalAllocated))
    : 0;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Contract status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'OXY Balance', value: contractInfo ? `${parseFloat(contractInfo.contractBalance).toLocaleString(undefined, { maximumFractionDigits: 0 })} OXY` : '...', icon: <Coins className="w-5 h-5" />, color: 'bg-ocean-50 text-ocean-600' },
          { label: 'Total Allocated', value: contractInfo ? `${parseFloat(contractInfo.totalAllocated).toLocaleString(undefined, { maximumFractionDigits: 0 })} OXY` : '...', icon: <Lock className="w-5 h-5" />, color: 'bg-forest-50 text-forest-600' },
          { label: 'Unallocated', value: `${unallocated.toLocaleString(undefined, { maximumFractionDigits: 0 })} OXY`, icon: <Coins className="w-5 h-5" />, color: 'bg-amber-50 text-amber-600' },
          { label: 'Beneficiaries', value: contractInfo ? String(contractInfo.beneficiaryCount) : '...', icon: <UsersIcon className="w-5 h-5" />, color: 'bg-sky-50 text-sky-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center mb-3`}>{s.icon}</div>
            <p className="text-xl font-display font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Contract link */}
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>Contract:</span>
        <a href={getExplorerAddressUrl(CONTRACT_ADDRESSES.IDO_VESTING)} target="_blank" rel="noopener noreferrer"
          className="font-mono text-ocean-600 hover:underline flex items-center gap-1">
          {CONTRACT_ADDRESSES.IDO_VESTING} <ExternalLink className="w-3 h-3" />
        </a>
        <button onClick={refreshInfo} className="p-1 rounded hover:bg-gray-100 transition-colors">
          <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>

      {/* Feedback */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 p-3 bg-forest-50 rounded-xl border border-forest-200">
          <CheckCircle className="w-4 h-4 text-forest-600 shrink-0 mt-0.5" />
          <div className="text-sm text-forest-700">
            <p className="font-semibold">{success.msg}</p>
            <a href={getExplorerTxUrl(success.txHash)} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-forest-600 hover:text-forest-500 mt-0.5">
              View transaction <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* IDO Purchases — buyers list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-display font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-ocean-500" /> IDO Purchases
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">Select buyers and load them into the batch vesting form</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchPurchases} disabled={purchasesLoading}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <RefreshCw className={`w-4 h-4 text-gray-500 ${purchasesLoading ? 'animate-spin' : ''}`} />
            </button>
            {selectedPurchases.size > 0 && (
              <button onClick={loadSelectedToBatch}
                className="flex items-center gap-1.5 px-3 py-2 bg-ocean-600 text-white text-xs font-semibold rounded-lg hover:bg-ocean-700 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Load {selectedPurchases.size} to Batch
              </button>
            )}
          </div>
        </div>

        {purchasesLoading ? (
          <div className="text-center py-8"><Loader className="w-6 h-6 animate-spin text-ocean-500 mx-auto" /></div>
        ) : idoPurchases.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No IDO purchases yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left w-10">
                    <input type="checkbox" checked={selectedPurchases.size === idoPurchases.length && idoPurchases.length > 0}
                      onChange={toggleAllPurchases} className="w-4 h-4 rounded accent-ocean-600" />
                  </th>
                  <th className="px-4 py-3 text-left">Buyer</th>
                  <th className="px-4 py-3 text-right">OXY Amount</th>
                  <th className="px-4 py-3 text-right">MON Paid</th>
                  <th className="px-4 py-3 text-left">Tx Hash</th>
                  <th className="px-4 py-3 text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                {idoPurchases.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedPurchases.has(p.id)}
                        onChange={() => togglePurchase(p.id)} className="w-4 h-4 rounded accent-ocean-600" />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{shortenAddr(p.buyer_wallet)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-ocean-700">{p.oxy_amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{p.mon_amount?.toFixed(6) ?? '-'}</td>
                    <td className="px-4 py-3">
                      {p.tx_hash ? (
                        <a href={getExplorerTxUrl(p.tx_hash)} target="_blank" rel="noopener noreferrer"
                          className="text-ocean-600 hover:underline font-mono text-xs flex items-center gap-1">
                          {p.tx_hash.slice(0, 10)}... <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-100 bg-gray-50">
                  <td colSpan={2} className="px-4 py-3 text-xs font-semibold text-gray-600">
                    {selectedPurchases.size > 0 ? `${selectedPurchases.size} selected` : `${idoPurchases.length} total purchases`}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-ocean-700">
                    {selectedPurchases.size > 0
                      ? idoPurchases.filter((p) => selectedPurchases.has(p.id)).reduce((s, p) => s + p.oxy_amount, 0).toLocaleString()
                      : idoPurchases.reduce((s, p) => s + p.oxy_amount, 0).toLocaleString()}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Create schedule */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-display font-bold text-gray-900 flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-ocean-500" /> Create Vesting Schedule
          </h3>
          <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
            {(['single', 'batch'] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(null); setSuccess(null); }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${mode === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                {m === 'single' ? 'Single' : 'Batch'}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {mode === 'single' ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Beneficiary Address</label>
                <input type="text" value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)}
                  placeholder="0x..." className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-ocean-400 outline-none text-sm font-mono" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">OXY Amount</label>
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 100000" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-ocean-400 outline-none text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Cliff (days)</label>
                  <input type="number" value={cliffDays} onChange={(e) => setCliffDays(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-ocean-400 outline-none text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Vesting Duration (days)</label>
                  <input type="number" value={vestingDays} onChange={(e) => setVestingDays(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-ocean-400 outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Start Time</label>
                  <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-ocean-400 outline-none text-sm" />
                </div>
                <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-xl self-end">
                  <input type="checkbox" checked={revocable} onChange={(e) => setRevocable(e.target.checked)}
                    className="w-4 h-4 rounded accent-ocean-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Revocable</p>
                    <p className="text-xs text-gray-500">Owner can revoke unvested tokens</p>
                  </div>
                </label>
              </div>
              <button onClick={handleSingle} disabled={isSubmitting}
                className="btn-primary disabled:opacity-50 w-full sm:w-auto">
                {isSubmitting ? <><Loader className="w-4 h-4 animate-spin" /> Creating...</> : <><Plus className="w-4 h-4" /> Create Schedule</>}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                {batchRows.map((row, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <input type="text" value={row.address} onChange={(e) => { const r = [...batchRows]; r[i].address = e.target.value; setBatchRows(r); }}
                      placeholder="0x... address" className="flex-1 px-3 py-2 rounded-xl border border-gray-200 focus:border-ocean-400 outline-none text-sm font-mono" />
                    <input type="number" value={row.amount} onChange={(e) => { const r = [...batchRows]; r[i].amount = e.target.value; setBatchRows(r); }}
                      placeholder="OXY amount" className="w-40 px-3 py-2 rounded-xl border border-gray-200 focus:border-ocean-400 outline-none text-sm" />
                    <button onClick={() => setBatchRows(batchRows.filter((_, j) => j !== i))} disabled={batchRows.length <= 1}
                      className="p-2 rounded-lg text-red-400 hover:bg-red-50 disabled:opacity-30 transition-colors shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button onClick={() => setBatchRows([...batchRows, { address: '', amount: '' }])}
                  className="flex items-center gap-1.5 text-xs font-semibold text-ocean-600 hover:text-ocean-700">
                  <Plus className="w-3.5 h-3.5" /> Add Row
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Start</label>
                  <input type="datetime-local" value={batchStartDate} onChange={(e) => setBatchStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-ocean-400 outline-none text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Cliff (days)</label>
                  <input type="number" value={batchCliffDays} onChange={(e) => setBatchCliffDays(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-ocean-400 outline-none text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Vesting (days)</label>
                  <input type="number" value={batchVestingDays} onChange={(e) => setBatchVestingDays(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-ocean-400 outline-none text-sm" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer p-2 bg-gray-50 rounded-xl self-end">
                  <input type="checkbox" checked={batchRevocable} onChange={(e) => setBatchRevocable(e.target.checked)}
                    className="w-4 h-4 rounded accent-ocean-600" />
                  <span className="text-xs font-semibold text-gray-700">Revocable</span>
                </label>
              </div>
              <button onClick={handleBatch} disabled={isSubmitting}
                className="btn-primary disabled:opacity-50 w-full sm:w-auto">
                {isSubmitting ? <><Loader className="w-4 h-4 animate-spin" /> Creating...</> : <><Plus className="w-4 h-4" /> Create {batchRows.filter((r) => r.address && r.amount).length} Schedule(s)</>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Admin actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Revoke */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h4 className="font-display font-bold text-gray-900 mb-1 flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" /> Revoke Schedule
          </h4>
          <p className="text-xs text-gray-500 mb-4">Revoke a beneficiary's unvested tokens (vested tokens are released to them first).</p>
          <input type="text" value={revokeAddr} onChange={(e) => setRevokeAddr(e.target.value)}
            placeholder="0x... beneficiary address" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-red-400 outline-none text-sm font-mono mb-3" />
          <button onClick={handleRevoke} disabled={isSubmitting || !revokeAddr}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-red-50 text-red-700 font-semibold rounded-xl hover:bg-red-100 transition-colors text-sm disabled:opacity-50">
            {isSubmitting ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
            Revoke
          </button>
        </div>

        {/* Withdraw unallocated */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h4 className="font-display font-bold text-gray-900 mb-1 flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-500" /> Withdraw Unallocated
          </h4>
          <p className="text-xs text-gray-500 mb-2">
            Withdraw OXY tokens not assigned to any schedule.
            Available: <strong className="text-gray-800">{unallocated.toLocaleString(undefined, { maximumFractionDigits: 0 })} OXY</strong>
          </p>
          <input type="text" value={withdrawAddr} onChange={(e) => setWithdrawAddr(e.target.value)}
            placeholder="0x... recipient address" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-amber-400 outline-none text-sm font-mono mb-3" />
          <button onClick={handleWithdraw} disabled={isSubmitting || !withdrawAddr || unallocated <= 0}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-50 text-amber-700 font-semibold rounded-xl hover:bg-amber-100 transition-colors text-sm disabled:opacity-50">
            {isSubmitting ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Coins className="w-3.5 h-3.5" />}
            Withdraw
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-ocean-50 border border-ocean-200 rounded-2xl p-5">
        <h4 className="font-semibold text-ocean-800 mb-2 flex items-center gap-2 text-sm">
          <Info className="w-4 h-4" /> How Vesting Admin Works
        </h4>
        <ul className="space-y-1.5 text-xs text-ocean-700">
          <li>1. Fund the vesting contract by sending OXY tokens to the contract address.</li>
          <li>2. Create individual or batch vesting schedules for IDO buyers.</li>
          <li>3. Each schedule has a cliff period (no tokens released) followed by linear vesting.</li>
          <li>4. Revocable schedules can have unvested tokens reclaimed; vested tokens still go to the beneficiary.</li>
          <li>5. Use "Withdraw Unallocated" to retrieve excess tokens not assigned to any schedule.</li>
        </ul>
      </div>
    </div>
  );
}

// ── User Management Tab (superadmin only) ─────────────────────────────────────

interface ManagedUser {
  user_id: string;
  email: string;
  role: string;
  created_at: string;
}

function UsersTab() {
  const { t } = useI18n();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<string>('end_user');
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('manage-user-roles');
      if (fnError) { setError(fnError.message); return; }
      setUsers((data?.users as ManagedUser[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSave = async (userId: string) => {
    setSaving(true);
    setError(null);
    try {
      const { error: fnError } = await supabase.functions.invoke('manage-user-roles', {
        method: 'POST',
        body: JSON.stringify({ target_user_id: userId, new_role: newRole }),
      });
      if (fnError) { setError(fnError.message); return; }
      setEditingId(null);
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setSaving(false);
    }
  };

  const roleBadge = (r: string) => {
    if (r === 'superadmin') return 'bg-amber-100 text-amber-700 border-amber-200';
    if (r === 'admin') return 'bg-ocean-100 text-ocean-700 border-ocean-200';
    return 'bg-gray-100 text-gray-600 border-gray-200';
  };

  const roleIcon = (r: string) => {
    if (r === 'superadmin') return <Crown className="w-3 h-3" />;
    if (r === 'admin') return <Shield className="w-3 h-3" />;
    return <User className="w-3 h-3" />;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold text-gray-900">User Management</h2>
          <p className="text-sm text-gray-500 mt-1">Manage roles and permissions for all users</p>
        </div>
        <button onClick={fetchUsers} disabled={isLoading}
          className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
          <RefreshCw className={`w-4 h-4 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12"><Loader className="w-7 h-7 animate-spin text-forest-500 mx-auto" /></div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <UsersIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No users found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <div key={u.user_id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                    {roleIcon(u.role)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{u.email}</p>
                    <p className="text-xs text-gray-400 font-mono">{u.user_id.slice(0, 8)}...</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {editingId === u.user_id ? (
                    <>
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold outline-none focus:border-forest-400"
                      >
                        <option value="end_user">End User</option>
                        <option value="admin">Admin</option>
                        <option value="superadmin">Superadmin</option>
                      </select>
                      <button
                        onClick={() => handleSave(u.user_id)}
                        disabled={saving}
                        className="px-3 py-2 rounded-lg bg-forest-600 text-white text-sm font-semibold hover:bg-forest-700 transition-colors disabled:opacity-50"
                      >
                        {saving ? <Loader className="w-4 h-4 animate-spin" /> : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 ${roleBadge(u.role)}`}>
                        {roleIcon(u.role)}
                        {u.role === 'superadmin' ? 'Superadmin' : u.role === 'admin' ? 'Admin' : 'End User'}
                      </span>
                      <button
                        onClick={() => { setEditingId(u.user_id); setNewRole(u.role); }}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Edit
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { t } = useI18n();
  const { wallet, connect } = useWallet();
  const { user, signOut, role } = useAdminAuth();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const { totalMinted } = useNFTTree();
  const { totalStaked } = useStaking();

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const { data: resp, error } = await supabase.functions.invoke('get-admin-orders');
      if (error) { console.error('fetchOrders error:', error.message); return; }
      setOrders((resp?.data as PurchaseOrder[]) ?? []);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Refresh orders whenever the admin navigates to the orders or overview tab
  useEffect(() => {
    if (tab === 'orders' || tab === 'overview') fetchOrders();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateStatus = async (id: string, status: PurchaseOrder['status']) => {
    const { error } = await supabase.from('tree_purchase_orders').update({ status }).eq('id', id);
    if (error) throw new Error(error.message);
    await fetchOrders();
  };

  const markMinted = async (order: PurchaseOrder, tokenIds: number[]) => {
    const { error } = await supabase
      .from('tree_purchase_orders')
      .update({ status: 'delivered', token_ids: tokenIds })
      .eq('id', order.id);
    if (error) throw new Error(error.message);
    await fetchOrders();
  };

  if (!wallet.isConnected) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-display font-bold text-gray-900 mb-2">{t('admin.adminAccessRequired')}</h2>
          <p className="text-gray-500 mb-6">{t('admin.connectAdminWallet')}</p>
          <button onClick={connect} className="btn-primary">{t('wallet.connectWallet')}</button>
        </div>
      </div>
    );
  }

  const pendingCount = orders.filter((o) => o.status === 'pending' || o.status === 'paid').length;

  const tabs: { key: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'overview',   label: t('admin.tab.overview'),      icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'orders',     label: t('admin.tab.orders'),        icon: <ShoppingCart className="w-4 h-4" />, badge: pendingCount },
    { key: 'mint',       label: t('admin.tab.mint'),     icon: <TreePine className="w-4 h-4" /> },
    { key: 'metadata',   label: t('admin.tab.metadata'),      icon: <FileJson className="w-4 h-4" /> },
    { key: 'pool',       label: t('admin.tab.pool'),   icon: <Zap className="w-4 h-4" /> },
    { key: 'ido',        label: t('admin.tab.ido'),    icon: <DollarSign className="w-4 h-4" /> },
    { key: 'vesting',   label: 'Vesting',                    icon: <Lock className="w-4 h-4" /> },
    { key: 'exchanges',  label: t('admin.tab.exchanges'),     icon: <Link2 className="w-4 h-4" /> },
    { key: 'settings',   label: t('admin.tab.settings'),      icon: <Settings className="w-4 h-4" /> },
    ...(role === 'superadmin' ? [{ key: 'users' as AdminTab, label: 'Users', icon: <UsersIcon className="w-4 h-4" /> }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="bg-gradient-to-r from-forest-900 to-forest-800 text-white py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-display font-bold">{t('admin.dashboard')}</h1>
              <p className="text-forest-200 text-sm mt-1">{t('admin.ecosystemMgmt')}</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-end">
              {user && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-forest-700/50 rounded-xl text-sm text-forest-200">
                  {role === 'superadmin' ? <Crown className="w-3.5 h-3.5 text-amber-400" /> : <Shield className="w-3.5 h-3.5 text-forest-400" />}
                  {user.email}
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    role === 'superadmin' ? 'bg-amber-500/20 text-amber-300' : 'bg-ocean-500/20 text-ocean-300'
                  }`}>
                    {role === 'superadmin' ? 'Superadmin' : 'Admin'}
                  </span>
                </div>
              )}
              {wallet.isConnected && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-forest-700/50 rounded-xl text-sm text-forest-200">
                  <div className="w-2 h-2 rounded-full bg-forest-400" />
                  {wallet.address?.slice(0, 8)}...{wallet.address?.slice(-4)}
                </div>
              )}
              {pendingCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 rounded-xl text-amber-300 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {t('admin.actionsNeeded', { count: pendingCount })}
                </div>
              )}
              <button
                onClick={signOut}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-xl text-red-300 text-sm font-medium transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                {t('admin.logout')}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex gap-1 bg-white border border-gray-200 p-1 rounded-xl w-fit mb-8 shadow-sm overflow-x-auto">
          {tabs.map((tabItem) => (
            <button key={tabItem.key} onClick={() => setTab(tabItem.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                tab === tabItem.key ? 'bg-forest-50 text-forest-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {tabItem.icon} {tabItem.label}
              {tabItem.badge ? (
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-bold">
                  {tabItem.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {tab === 'overview'   && <OverviewTab orders={orders} totalMinted={totalMinted} totalStaked={totalStaked} />}
        {tab === 'orders'    && <OrdersTab orders={orders} isLoading={ordersLoading} onRefresh={fetchOrders} onUpdateStatus={updateStatus} onMarkMinted={markMinted} />}
        {tab === 'mint'      && <MintTab />}
        {tab === 'metadata'  && <MetadataTab orders={orders} />}
        {tab === 'pool'      && <RewardPoolTab />}
        {tab === 'ido'       && <IDOTab />}
        {tab === 'vesting'  && <VestingAdminTab />}
        {tab === 'exchanges' && <ExchangeLinksTab />}
        {tab === 'settings'  && <SettingsTab />}
        {tab === 'users'     && <UsersTab />}
      </section>
    </div>
  );
}
