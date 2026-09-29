import { useState, useEffect, useMemo } from 'react';
import {
  Coins, PieChart, Lock, TrendingUp, Zap,
  ShoppingCart, Award, ArrowRight, TreePine,
  ArrowUpDown, ExternalLink, Globe, AlertCircle,
  Loader, CheckCircle, Clock, ChevronDown, ChevronUp,
  Plus, Minus, Gift, Droplets, BarChart3, RefreshCw,
  Info,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import SectionHeading from '../components/shared/SectionHeading';
import { OXY_MAX_SUPPLY, OXY_STAKING_PERCENT, OXY_IDO_PERCENT, OXY_LIQUIDITY_PERCENT } from '../lib/constants';
import { useIDO } from '../hooks/useIDO';
import { useExchangeLinks } from '../hooks/useExchangeLinks';
import { useIDOVesting } from '../hooks/useIDOVesting';
import { useWallet } from '../lib/wallet-context';
import { useDEX } from '../hooks/useDEX';
import { getSigner, getOxyTokenContract, getReadProvider, CONTRACT_ADDRESSES, formatOxy, parseOxy, getExplorerTxUrl, getExplorerAddressUrl } from '../lib/contracts';
import { BrowserProvider, parseEther, formatEther } from 'ethers';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18n';

// ── helpers ───────────────────────────────────────────────────────────────────

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function timeRemaining(endTime: string): string {
  const diff = new Date(endTime).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h remaining`;
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

function fmtDecimals(v: string, decimals = 4): string {
  const n = parseFloat(v);
  if (isNaN(n)) return '0';
  if (n === 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

// ── Tokenomics data ───────────────────────────────────────────────────────────

const allocations = [
  {
    category: 'Staking Rewards',
    percentage: OXY_STAKING_PERCENT,
    amount: OXY_MAX_SUPPLY * (OXY_STAKING_PERCENT / 100),
    fill: '#2a9d6a',
    bg: 'bg-forest-500',
    text: 'text-forest-600',
    light: 'bg-forest-50',
    icon: <TrendingUp className="w-5 h-5" />,
    desc: 'Distributed to OxyTree stakers as daily rewards',
  },
  {
    category: 'IDO',
    percentage: OXY_IDO_PERCENT,
    amount: OXY_MAX_SUPPLY * (OXY_IDO_PERCENT / 100),
    fill: '#3b97f6',
    bg: 'bg-ocean-500',
    text: 'text-ocean-600',
    light: 'bg-ocean-50',
    icon: <Coins className="w-5 h-5" />,
    desc: 'Initial DEX Offering to fund project development',
  },
  {
    category: 'Liquidity Pool',
    percentage: OXY_LIQUIDITY_PERCENT,
    amount: OXY_MAX_SUPPLY * (OXY_LIQUIDITY_PERCENT / 100),
    fill: '#eab308',
    bg: 'bg-gold-500',
    text: 'text-gold-600',
    light: 'bg-gold-50',
    icon: <Lock className="w-5 h-5" />,
    desc: 'Paired on DEX liquidity pools for stable trading',
  },
];

const utilities = [
  { icon: <TreePine className="w-6 h-6" />, title: 'Buy OxyTrees', desc: 'Purchase OxyTree NFTs with $OXY at a 10% discount vs stablecoin.' },
  { icon: <TrendingUp className="w-6 h-6" />, title: 'Staking Rewards', desc: 'Stake OxyTrees to earn daily $OXY from the reward pool.' },
  { icon: <ShoppingCart className="w-6 h-6" />, title: 'Marketplace Trading', desc: 'All marketplace fees are paid in $OXY and redistributed to stakers.' },
  { icon: <Award className="w-6 h-6" />, title: 'Governance', desc: 'Vote on ecosystem proposals and future development direction.' },
];

// ── DEX AMM Swap Widget ───────────────────────────────────────────────────────

type SwapDirection = 'buy' | 'sell';

function DexSwapWidget() {
  const { t } = useI18n();
  const { wallet, connect } = useWallet();
  const { state, contractReady, quoteOxyOut, quoteMonOut, swapMonForOxy, swapOxyForMon, fetchState } = useDEX(wallet.address);

  const [direction, setDirection] = useState<SwapDirection>('buy');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount]     = useState('');
  const [slippage]                  = useState(0.5);
  const [isQuoting, setIsQuoting]   = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapError, setSwapError]   = useState<string | null>(null);
  const [swapTx, setSwapTx]         = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const hasLiquidity = parseFloat(state.reserveOxy) > 0 && parseFloat(state.reserveMon) > 0;

  // quote on input change
  useEffect(() => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) { setToAmount(''); return; }
    if (!contractReady || !hasLiquidity) {
      // fallback static rate
      const n = parseFloat(fromAmount);
      setToAmount(direction === 'buy' ? (n * 1000).toFixed(2) : (n * 0.001).toFixed(6));
      return;
    }
    let cancelled = false;
    setIsQuoting(true);
    const fn = direction === 'buy' ? quoteOxyOut : quoteMonOut;
    fn(fromAmount).then((q) => {
      if (!cancelled) { setToAmount(parseFloat(q).toFixed(direction === 'buy' ? 2 : 6)); setIsQuoting(false); }
    }).catch(() => { if (!cancelled) setIsQuoting(false); });
    return () => { cancelled = true; };
  }, [fromAmount, direction, contractReady, hasLiquidity, quoteOxyOut, quoteMonOut]);

  const minReceived = useMemo(() => {
    const n = parseFloat(toAmount);
    if (isNaN(n) || n <= 0) return '0';
    return (n * (1 - slippage / 100)).toFixed(direction === 'buy' ? 2 : 6);
  }, [toAmount, slippage, direction]);

  const handleSwap = async () => {
    const n = parseFloat(fromAmount);
    if (!n || n <= 0) { setSwapError('Enter a valid amount.'); return; }
    if (!wallet.isConnected) { connect(); return; }

    setIsSwapping(true); setSwapError(null); setSwapTx(null);
    try {
      let hash: string;
      if (!contractReady || !hasLiquidity) {
        // preview mode simulation
        await new Promise((r) => setTimeout(r, 1500));
        hash = `0x${Math.random().toString(16).slice(2).repeat(4).slice(0, 64)}`;
      } else if (direction === 'buy') {
        hash = await swapMonForOxy(fromAmount, toAmount || '0', slippage);
      } else {
        hash = await swapOxyForMon(fromAmount, toAmount || '0', slippage);
      }
      setSwapTx(hash);
      setFromAmount('');
      setToAmount('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Swap failed';
      setSwapError(msg.startsWith('wrong_network:') ? 'Switch to Monad Testnet.' : msg);
    } finally {
      setIsSwapping(false);
    }
  };

  const fromToken = direction === 'buy' ? 'MON' : 'OXY';
  const toToken   = direction === 'buy' ? 'OXY'    : 'MON';
  const fromBal   = direction === 'buy' ? state.userMonBalance : state.userOxyBalance;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold text-gray-900">{t('oxy.swap')}</h3>
          <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg">
            {(['buy', 'sell'] as SwapDirection[]).map((d) => (
              <button
                key={d}
                onClick={() => { setDirection(d); setFromAmount(''); setToAmount(''); setSwapError(null); setSwapTx(null); }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${direction === d ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
              >
                {d === 'buy' ? t('oxy.buyOxyTab') : t('oxy.sellOxyTab')}
              </button>
            ))}
          </div>
        </div>
        {/* Pool stats mini */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t('oxy.oxyReserve'), val: fmtDecimals(state.reserveOxy) },
            { label: t('oxy.tcoreReserve'), val: fmtDecimals(state.reserveMon, 4) },
            { label: t('oxy.priceOxyPerCore'), val: `${fmtDecimals(state.priceOxyPerMon, 0)} OXY/MON` },
          ].map((s) => (
            <div key={s.label} className="bg-gray-50 rounded-lg p-2 text-center">
              <p className="text-xs font-semibold text-gray-800">{s.val}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-5 space-y-3">
        {/* From */}
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-medium">{t('oxy.youPay')}</span>
            {wallet.isConnected && (
              <button
                onClick={() => setFromAmount(fmtDecimals(fromBal, 6).replace(/,/g, ''))}
                className="text-xs text-ocean-600 hover:text-ocean-800 font-medium"
              >
                Max: {fmtDecimals(fromBal, 4)} {fromToken}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={fromAmount}
              onChange={(e) => { setFromAmount(e.target.value); setSwapError(null); setSwapTx(null); }}
              placeholder="0.00"
              className="flex-1 bg-transparent text-2xl font-bold text-gray-900 outline-none min-w-0"
            />
            <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-sm shrink-0 ${direction === 'buy' ? 'bg-ocean-100 text-ocean-800' : 'bg-forest-100 text-forest-800'}`}>
              <Coins className="w-4 h-4" />
              {fromToken}
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <button
            onClick={() => { setDirection((d) => d === 'buy' ? 'sell' : 'buy'); setFromAmount(''); setToAmount(''); }}
            className="w-9 h-9 rounded-xl bg-white border-2 border-gray-200 flex items-center justify-center hover:border-ocean-400 hover:bg-ocean-50 transition-all shadow-sm"
          >
            <ArrowUpDown className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* To */}
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-medium">{t('oxy.youReceiveEst')}</span>
            {isQuoting && <Loader className="w-3.5 h-3.5 animate-spin text-gray-400" />}
          </div>
          <div className="flex items-center gap-3">
            <span className={`flex-1 text-2xl font-bold min-w-0 ${toAmount ? 'text-gray-900' : 'text-gray-300'}`}>
              {toAmount || '0.00'}
            </span>
            <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-sm shrink-0 ${direction === 'buy' ? 'bg-forest-100 text-forest-800' : 'bg-ocean-100 text-ocean-800'}`}>
              <Coins className="w-4 h-4" />
              {toToken}
            </div>
          </div>
        </div>

        {/* Details toggle */}
        {toAmount && (
          <button
            onClick={() => setShowDetails((s) => !s)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            <span>{t('oxy.swapDetails')}</span>
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
        {showDetails && toAmount && (
          <div className="bg-gray-50 rounded-xl p-3 space-y-2 text-xs text-gray-600">
            <div className="flex justify-between"><span>{t('oxy.slippageTolerance')}</span><span>{slippage}%</span></div>
            <div className="flex justify-between"><span>{t('oxy.minReceived')}</span><span>{minReceived} {toToken}</span></div>
            <div className="flex justify-between"><span>{t('oxy.swapFee')}</span><span>0.30%</span></div>
            <div className="flex justify-between"><span>{t('oxy.protocolFee')}</span><span>0.05%</span></div>
            <div className="flex justify-between"><span>{t('oxy.network')}</span><span>Monad Testnet</span></div>
          </div>
        )}

        {/* Errors / success */}
        {swapError && (
          <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-600">{swapError}</p>
          </div>
        )}
        {swapTx && (
          <div className="flex items-start gap-2 p-3 bg-forest-50 rounded-xl border border-forest-200">
            <CheckCircle className="w-4 h-4 text-forest-600 shrink-0 mt-0.5" />
            <div className="text-xs text-forest-700">
              <p className="font-semibold">{t('oxy.swapSuccess')}</p>
              <p className="break-all mt-0.5 text-forest-600">{swapTx.slice(0, 22)}...{swapTx.slice(-8)}</p>
            </div>
          </div>
        )}

        {!contractReady && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              <strong>{t('oxy.previewMode')}</strong>
            </p>
          </div>
        )}

        {wallet.isConnected ? (
          <button
            onClick={handleSwap}
            disabled={isSwapping || !fromAmount}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-ocean-600 text-white font-semibold rounded-xl hover:bg-ocean-700 transition-all shadow-lg shadow-ocean-600/20 disabled:opacity-50 disabled:cursor-not-allowed text-base"
          >
            {isSwapping ? (
              <><Loader className="w-5 h-5 animate-spin" /> {t('oxy.swapping')}</>
            ) : (
              <><ArrowUpDown className="w-5 h-5" /> {t('oxy.swapBtn', { from: fromToken, to: toToken })}</>
            )}
          </button>
        ) : (
          <button onClick={connect} className="w-full flex items-center justify-center gap-2 py-3.5 bg-ocean-600 text-white font-semibold rounded-xl hover:bg-ocean-700 transition-all text-base">
            {t('oxy.connectToSwap')}
          </button>
        )}
      </div>
    </div>
  );
}

// ── LP Panel ─────────────────────────────────────────────────────────────────

type LPTab = 'add' | 'remove' | 'rewards';

function LiquidityPanel() {
  const { t } = useI18n();
  const { wallet, connect } = useWallet();
  const { state, contractReady, addLiquidity, removeLiquidity, claimReward, fetchState } = useDEX(wallet.address);
  const [tab, setTab] = useState<LPTab>('add');

  // Add liquidity state
  const [oxyAmount, setOxyAmount] = useState('');
  const [monAmount, setMonAmount] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError]   = useState<string | null>(null);
  const [addTx, setAddTx]         = useState<string | null>(null);

  // Remove liquidity state
  const [lpAmount, setLpAmount]     = useState('');
  const [removeLoading, setRemoveLoading] = useState(false);
  const [removeError, setRemoveError]     = useState<string | null>(null);
  const [removeTx, setRemoveTx]           = useState<string | null>(null);

  // Claim state
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError]     = useState<string | null>(null);
  const [claimTx, setClaimTx]           = useState<string | null>(null);

  const hasLiquidity = parseFloat(state.reserveOxy) > 0 && parseFloat(state.reserveMon) > 0;
  const userHasLP    = parseFloat(state.lpBalance) > 0;
  const hasPending   = parseFloat(state.pendingReward) > 0;

  // Auto-compute paired MON amount when OXY changes (only if pool is seeded)
  const handleOxyChange = (val: string) => {
    setOxyAmount(val);
    if (hasLiquidity && val && parseFloat(val) > 0) {
      const ratio = parseFloat(state.reserveMon) / parseFloat(state.reserveOxy);
      setMonAmount((parseFloat(val) * ratio).toFixed(6));
    }
  };

  const handleMonChange = (val: string) => {
    setMonAmount(val);
    if (hasLiquidity && val && parseFloat(val) > 0) {
      const ratio = parseFloat(state.reserveOxy) / parseFloat(state.reserveMon);
      setOxyAmount((parseFloat(val) * ratio).toFixed(2));
    }
  };

  // Estimated LP tokens user would receive
  const estimatedLP = useMemo(() => {
    if (!oxyAmount || !monAmount) return '';
    const supply = parseFloat(state.totalLPSupply);
    const resOxy  = parseFloat(state.reserveOxy);
    const resMon = parseFloat(state.reserveMon);
    if (supply === 0) {
      return Math.sqrt(parseFloat(oxyAmount) * parseFloat(monAmount)).toFixed(4);
    }
    const byOxy  = (parseFloat(oxyAmount)  / resOxy)  * supply;
    const byMon = (parseFloat(monAmount) / resMon) * supply;
    return Math.min(byOxy, byMon).toFixed(4);
  }, [oxyAmount, monAmount, state]);

  // Estimated withdrawal amounts
  const estimatedWithdraw = useMemo(() => {
    const lp    = parseFloat(lpAmount);
    const total = parseFloat(state.totalLPSupply);
    if (!lp || !total) return { oxy: '0', mon: '0' };
    const share = lp / total;
    return {
      oxy:  (share * parseFloat(state.reserveOxy)).toFixed(2),
      mon: (share * parseFloat(state.reserveMon)).toFixed(6),
    };
  }, [lpAmount, state]);

  const handleAdd = async () => {
    if (!wallet.isConnected) { connect(); return; }
    setAddLoading(true); setAddError(null); setAddTx(null);
    try {
      const hash = await addLiquidity(oxyAmount, monAmount);
      setAddTx(hash);
      setOxyAmount(''); setMonAmount('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transaction failed';
      setAddError(msg.startsWith('wrong_network:') ? 'Switch to Monad Testnet.' : msg);
    } finally { setAddLoading(false); }
  };

  const handleRemove = async () => {
    if (!wallet.isConnected) { connect(); return; }
    setRemoveLoading(true); setRemoveError(null); setRemoveTx(null);
    try {
      const hash = await removeLiquidity(lpAmount);
      setRemoveTx(hash);
      setLpAmount('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transaction failed';
      setRemoveError(msg.startsWith('wrong_network:') ? 'Switch to Monad Testnet.' : msg);
    } finally { setRemoveLoading(false); }
  };

  const handleClaim = async () => {
    if (!wallet.isConnected) { connect(); return; }
    setClaimLoading(true); setClaimError(null); setClaimTx(null);
    try {
      const hash = await claimReward();
      setClaimTx(hash);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transaction failed';
      setClaimError(msg.startsWith('wrong_network:') ? 'Switch to Monad Testnet.' : msg);
    } finally { setClaimLoading(false); }
  };

  const lpTabs: { key: LPTab; label: string; icon: React.ReactNode }[] = [
    { key: 'add',     label: t('oxy.tab.add'),     icon: <Plus className="w-4 h-4" /> },
    { key: 'remove',  label: t('oxy.tab.remove'),  icon: <Minus className="w-4 h-4" /> },
    { key: 'rewards', label: t('oxy.tab.rewards'), icon: <Gift className="w-4 h-4" /> },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display font-bold text-gray-900">{t('oxy.liquidityPool')}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{t('oxy.lpPair')}</p>
          </div>
          <button onClick={fetchState} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Pool stats */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-forest-50 rounded-xl p-3">
            <p className="text-[10px] text-forest-500 font-semibold uppercase tracking-wider">{t('oxy.oxyReserve')}</p>
            <p className="text-sm font-bold text-forest-800 mt-0.5">{fmtDecimals(state.reserveOxy)}</p>
          </div>
          <div className="bg-ocean-50 rounded-xl p-3">
            <p className="text-[10px] text-ocean-500 font-semibold uppercase tracking-wider">{t('oxy.tcoreReserve')}</p>
            <p className="text-sm font-bold text-ocean-800 mt-0.5">{fmtDecimals(state.reserveMon, 4)}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{t('oxy.yourLp')}</p>
            <p className="text-sm font-bold text-gray-800 mt-0.5">{fmtDecimals(state.lpBalance, 4)}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{t('oxy.poolShare')}</p>
            <p className="text-sm font-bold text-gray-800 mt-0.5">{state.poolShare}%</p>
          </div>
        </div>

        {/* Tab selector */}
        <div className="flex gap-1 bg-gray-100 p-0.5 rounded-xl">
          {lpTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${tab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {t.icon}{t.label}
              {t.key === 'rewards' && parseFloat(state.pendingReward) > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">

        {/* ── Add Liquidity ── */}
        {tab === 'add' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">{t('oxy.oxyAmountLabel')}</label>
              <div className="relative">
                <input
                  type="number"
                  value={oxyAmount}
                  onChange={(e) => handleOxyChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-4 pr-16 py-3 rounded-xl border border-gray-200 focus:border-forest-400 focus:ring-2 focus:ring-forest-100 outline-none text-lg font-semibold"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-semibold">OXY</span>
              </div>
              {wallet.isConnected && (
                <p className="text-xs text-gray-400 mt-1">Balance: {fmtDecimals(state.userOxyBalance)} OXY</p>
              )}
            </div>

            <div className="flex justify-center">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <Plus className="w-4 h-4 text-gray-400" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">{t('oxy.tcoreAmountLabel')}</label>
              <div className="relative">
                <input
                  type="number"
                  value={monAmount}
                  onChange={(e) => handleMonChange(e.target.value)}
                  placeholder="0.000000"
                  className="w-full pl-4 pr-20 py-3 rounded-xl border border-gray-200 focus:border-ocean-400 focus:ring-2 focus:ring-ocean-100 outline-none text-lg font-semibold"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-semibold">MON</span>
              </div>
              {wallet.isConnected && (
                <p className="text-xs text-gray-400 mt-1">Balance: {fmtDecimals(state.userMonBalance, 4)} MON</p>
              )}
            </div>

            {estimatedLP && (
              <div className="bg-forest-50 border border-forest-100 rounded-xl p-3 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>{t('oxy.lpTokensReceive')}</span>
                  <strong className="text-forest-700">{estimatedLP} OXY-LP</strong>
                </div>
                {!hasLiquidity && (
                  <p className="text-xs text-forest-600 mt-1.5">{t('oxy.seedingPool')}</p>
                )}
              </div>
            )}

            {addError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-600">{addError}</p>
              </div>
            )}
            {addTx && (
              <div className="flex items-start gap-2 p-3 bg-forest-50 rounded-xl border border-forest-200">
                <CheckCircle className="w-4 h-4 text-forest-600 shrink-0 mt-0.5" />
                <p className="text-xs text-forest-700 break-all">{t('oxy.liquidityAdded')} Tx: {addTx.slice(0, 18)}...{addTx.slice(-6)}</p>
              </div>
            )}

            {!contractReady && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">Deploy <code>OxyDEX.sol</code> and set <code>VITE_OXY_DEX_ADDRESS</code> to enable live LP operations.</p>
              </div>
            )}

            {wallet.isConnected ? (
              <button
                onClick={handleAdd}
                disabled={addLoading || !oxyAmount || !monAmount}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-forest-600 text-white font-semibold rounded-xl hover:bg-forest-700 transition-all shadow-lg shadow-forest-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addLoading ? <><Loader className="w-5 h-5 animate-spin" /> {t('oxy.adding')}</> : <><Plus className="w-5 h-5" /> {t('oxy.addLiquidity')}</>}
              </button>
            ) : (
              <button onClick={connect} className="w-full flex items-center justify-center gap-2 py-3.5 bg-forest-600 text-white font-semibold rounded-xl hover:bg-forest-700 transition-all">
                {t('oxy.connectWallet')}
              </button>
            )}
          </div>
        )}

        {/* ── Remove Liquidity ── */}
        {tab === 'remove' && (
          <div className="space-y-4">
            {!userHasLP ? (
              <div className="text-center py-8">
                <Droplets className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-500">{t('oxy.noLpTokens')}</p>
                <button onClick={() => setTab('add')} className="mt-3 text-xs text-ocean-600 font-semibold hover:underline">{t('oxy.addLiquidityFirst')}</button>
              </div>
            ) : (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('oxy.lpAmountBurn')}</label>
                    <button
                      onClick={() => setLpAmount(parseFloat(state.lpBalance).toFixed(6))}
                      className="text-xs text-ocean-600 hover:text-ocean-800 font-medium"
                    >
                      Max: {fmtDecimals(state.lpBalance, 4)}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={lpAmount}
                      onChange={(e) => setLpAmount(e.target.value)}
                      placeholder="0.000000"
                      max={state.lpBalance}
                      className="w-full pl-4 pr-16 py-3 rounded-xl border border-gray-200 focus:border-ocean-400 focus:ring-2 focus:ring-ocean-100 outline-none text-lg font-semibold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">OXY-LP</span>
                  </div>
                </div>

                {/* Quick presets */}
                <div className="flex gap-2">
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setLpAmount(((parseFloat(state.lpBalance) * pct) / 100).toFixed(6))}
                      className="flex-1 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:border-ocean-400 hover:text-ocean-700 transition-colors"
                    >
                      {pct}%
                    </button>
                  ))}
                </div>

                {lpAmount && parseFloat(lpAmount) > 0 && (
                  <div className="bg-ocean-50 border border-ocean-100 rounded-xl p-3 space-y-1.5 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>{t('oxy.youReceiveOxy')}</span>
                      <strong className="text-forest-700">{estimatedWithdraw.oxy} OXY</strong>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>{t('oxy.youReceiveTcore')}</span>
                      <strong className="text-ocean-700">{estimatedWithdraw.mon} MON</strong>
                    </div>
                  </div>
                )}

                {removeError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600">{removeError}</p>
                  </div>
                )}
                {removeTx && (
                  <div className="flex items-start gap-2 p-3 bg-forest-50 rounded-xl border border-forest-200">
                    <CheckCircle className="w-4 h-4 text-forest-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-forest-700 break-all">Removed! Tx: {removeTx.slice(0, 18)}...{removeTx.slice(-6)}</p>
                  </div>
                )}

                <button
                  onClick={handleRemove}
                  disabled={removeLoading || !lpAmount || parseFloat(lpAmount) <= 0}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {removeLoading ? <><Loader className="w-5 h-5 animate-spin" /> {t('oxy.removing')}</> : <><Minus className="w-5 h-5" /> {t('oxy.removeLiquidity')}</>}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Rewards ── */}
        {tab === 'rewards' && (
          <div className="space-y-5">
            {/* Reward stats */}
            <div className="bg-gradient-to-br from-amber-50 to-gold-50 border border-amber-100 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Gift className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-amber-600 font-semibold uppercase tracking-wider">{t('oxy.yourPendingReward')}</p>
                  <p className="text-2xl font-display font-bold text-amber-800">{fmtDecimals(state.pendingReward)} OXY</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/60 rounded-xl p-3">
                  <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wider">{t('oxy.poolEmission')}</p>
                  <p className="text-sm font-bold text-amber-800 mt-0.5">{fmtDecimals(state.rewardPerSecond, 4)} OXY/s</p>
                </div>
                <div className="bg-white/60 rounded-xl p-3">
                  <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wider">{t('oxy.rewardPool')}</p>
                  <p className="text-sm font-bold text-amber-800 mt-0.5">{fmtDecimals(state.rewardPoolBalance)} OXY</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
              <p className="font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-ocean-500" /> {t('oxy.howLpRewardsWork')}
              </p>
              <ul className="space-y-1.5 text-xs">
                <li>• {t('oxy.lpReward1')}</li>
                <li>• {t('oxy.lpReward2')}</li>
                <li>• {t('oxy.lpReward3')}</li>
                <li>• {t('oxy.lpReward4')}</li>
              </ul>
            </div>

            {claimError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-600">{claimError}</p>
              </div>
            )}
            {claimTx && (
              <div className="flex items-start gap-2 p-3 bg-forest-50 rounded-xl border border-forest-200">
                <CheckCircle className="w-4 h-4 text-forest-600 shrink-0 mt-0.5" />
                <p className="text-xs text-forest-700 break-all">Claimed! Tx: {claimTx.slice(0, 18)}...{claimTx.slice(-6)}</p>
              </div>
            )}

            {wallet.isConnected ? (
              <button
                onClick={handleClaim}
                disabled={claimLoading || !hasPending}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-white font-semibold rounded-xl hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {claimLoading
                  ? <><Loader className="w-5 h-5 animate-spin" /> {t('oxy.claiming')}</>
                  : <><Gift className="w-5 h-5" /> {t('oxy.claimOxy', { amount: fmtDecimals(state.pendingReward) })}</>}
              </button>
            ) : (
              <button onClick={connect} className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-white font-semibold rounded-xl hover:bg-amber-600 transition-all">
                {t('oxy.connectWallet')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pool Overview Banner ─────────────────────────────────────────────────────

function PoolOverviewBanner() {
  const { t } = useI18n();
  const { wallet } = useWallet();
  const { state, isLoading } = useDEX(wallet.address);

  const tvl = parseFloat(state.reserveMon) * 2; // rough TVL in MON

  const stats = [
    { label: t('oxy.oxyReserve'),   value: fmtDecimals(state.reserveOxy),          sub: 'OXY'     },
    { label: t('oxy.tcoreReserve'), value: fmtDecimals(state.reserveMon, 4),       sub: 'MON'  },
    { label: t('oxy.priceOxyPerCore'),         value: `${fmtDecimals(state.priceOxyPerMon, 0)}`, sub: 'OXY/MON' },
    { label: t('oxy.swapFee'),      value: '0.35%',                                  sub: 'per swap' },
    { label: 'LP Emission',   value: `${fmtDecimals(state.rewardPerSecond, 4)}`, sub: 'OXY/sec' },
    { label: t('oxy.rewardPool'),   value: fmtDecimals(state.rewardPoolBalance),    sub: 'OXY'     },
  ];

  return (
    <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 text-white">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-ocean-500/20 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-ocean-400" />
        </div>
        <div>
          <h3 className="font-display font-bold">OXY/MON Pool</h3>
          <p className="text-xs text-gray-400">Constant-product AMM · 0.35% total fee</p>
        </div>
        {isLoading && <Loader className="w-4 h-4 animate-spin text-gray-400 ml-auto" />}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-white/5 rounded-xl p-3 text-center">
            <p className="text-sm font-bold text-white">{s.value}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
            <p className="text-[10px] text-gray-500">{s.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── IDO Section ───────────────────────────────────────────────────────────────

function IDOSection() {
  const { t } = useI18n();
  const { activePhase, isLoading, refresh } = useIDO();
  const { wallet, connect } = useWallet();
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState('');
  const [isBuying, setIsBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [buySuccess, setBuySuccess] = useState<string | null>(null);

  if (isLoading) {
    return <div className="text-center py-12"><Loader className="w-7 h-7 animate-spin text-ocean-500 mx-auto" /></div>;
  }

  if (!activePhase) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12 bg-gray-50 rounded-2xl border border-gray-200">
        <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="font-display font-bold text-gray-700 text-lg">{t('oxy.noActiveIdo')}</p>
        <p className="text-sm text-gray-500 mt-1">{t('oxy.noActiveIdoDesc')}</p>
      </div>
    );
  }

  const progress = activePhase.hard_cap_oxy > 0
    ? Math.min((activePhase.sold_oxy / activePhase.hard_cap_oxy) * 100, 100)
    : 0;
  const monNeeded = parseFloat(amount || '0') * activePhase.price_per_oxy;
  const now = new Date();
  const hasStarted = new Date(activePhase.start_time) <= now;
  const hasEnded   = new Date(activePhase.end_time) < now;
  const isLive     = hasStarted && !hasEnded;

  const handleBuy = async () => {
    if (!wallet.isConnected) { connect(); return; }
    const n = parseFloat(amount);
    if (!amount || isNaN(n) || n <= 0) { setBuyError('Enter a valid OXY amount.'); return; }
    if (n < activePhase.min_buy_oxy) { setBuyError(`Minimum purchase is ${activePhase.min_buy_oxy.toLocaleString()} OXY.`); return; }
    if (n > activePhase.max_buy_oxy) { setBuyError(`Maximum purchase is ${activePhase.max_buy_oxy.toLocaleString()} OXY.`); return; }

    setIsBuying(true); setBuyError(null); setBuySuccess(null);
    try {
      setStep('Connecting wallet...');
      const signer = await getSigner();

      setStep('Loading IDO wallet address...');
      // Read the idoWallet address from the OxyToken contract (read-only, via read provider for speed)
      const readContract = await getOxyTokenContract(getReadProvider());
      const idoWalletAddr = await Promise.race([
        readContract.idoWallet(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Could not reach the blockchain. Please try again.')), 10000),
        ),
      ]);
      if (idoWalletAddr === '0x0000000000000000000000000000000000000000') {
        throw new Error('IDO wallet not configured on the token contract.');
      }

      setStep('Sending MON to IDO wallet...');
      const tx = await signer.sendTransaction({
        to: idoWalletAddr,
        value: parseEther(monNeeded.toFixed(18)),
      });
      setStep('Confirming transaction...');
      // tx.wait() can fail on Monad testnet due to RPC archive node issues
      // even when the transaction was successfully mined. Retry a few times,
      // and if it still fails, proceed anyway since we have the tx hash.
      let confirmed = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await Promise.race([
            tx.wait(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('timeout')), 20000),
            ),
          ]);
          confirmed = true;
          break;
        } catch (waitErr) {
          if (attempt < 2) {
            setStep(`Confirming transaction (retry ${attempt + 2}/3)...`);
            await new Promise((r) => setTimeout(r, 3000));
          }
        }
      }
      const txHash = tx.hash;

      setStep('Recording purchase...');
      // Record the purchase and update progress via edge function
      const { data: recordResp, error: recordError } = await supabase.functions.invoke('record-ido-purchase', {
        body: {
          phase_id: activePhase.id,
          buyer_wallet: wallet.address!.toLowerCase(),
          oxy_amount: n,
          mon_amount: monNeeded,
          tx_hash: txHash,
        },
      });

      if (recordError || recordResp?.error) {
        setBuySuccess(`Payment sent! ${n.toLocaleString()} OXY for ${monNeeded.toFixed(6)} MON. Tx: ${txHash.slice(0, 14)}... (Purchase recording pending - please contact admin if vesting schedule is not created.)`);
      } else {
        setBuySuccess(`Purchase successful! ${n.toLocaleString()} OXY for ${monNeeded.toFixed(6)} MON. Tx: ${txHash.slice(0, 14)}...${confirmed ? '' : ' (confirmation pending on RPC - transaction was submitted)'}`);
      }
      setAmount('');
      refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Purchase failed';
      if (msg.startsWith('wrong_network:')) {
        setBuyError('Wrong network. Please switch to Monad Testnet in your wallet.');
      } else if (msg.includes('user rejected') || msg.includes('User denied')) {
        setBuyError('Transaction rejected.');
      } else {
        setBuyError(msg);
      }
    } finally { setIsBuying(false); setStep(''); }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-ocean-900 to-ocean-950 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-ocean-300 text-xs font-semibold uppercase tracking-wider">{t('oxy.currentPhase')}</p>
                <h3 className="text-2xl font-display font-bold mt-1">{activePhase.phase_name}</h3>
              </div>
              <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${isLive ? 'bg-forest-500 text-white' : hasEnded ? 'bg-gray-600 text-gray-200' : 'bg-amber-500 text-white'}`}>
                {isLive ? 'LIVE' : hasEnded ? 'ENDED' : 'UPCOMING'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="bg-ocean-800/50 rounded-xl p-3"><p className="text-ocean-300 text-xs">{t('oxy.priceLabel')}</p><p className="text-xl font-bold mt-0.5">{activePhase.price_per_oxy} <span className="text-sm font-normal text-ocean-300">MON/OXY</span></p></div>
              <div className="bg-ocean-800/50 rounded-xl p-3"><p className="text-ocean-300 text-xs">{t('oxy.hardCap')}</p><p className="text-xl font-bold mt-0.5">{formatNumber(activePhase.hard_cap_oxy)} <span className="text-sm font-normal text-ocean-300">OXY</span></p></div>
              <div className="bg-ocean-800/50 rounded-xl p-3"><p className="text-ocean-300 text-xs">{t('oxy.minBuy')}</p><p className="font-bold mt-0.5">{formatNumber(activePhase.min_buy_oxy)} OXY</p></div>
              <div className="bg-ocean-800/50 rounded-xl p-3"><p className="text-ocean-300 text-xs">{t('oxy.maxBuy')}</p><p className="font-bold mt-0.5">{formatNumber(activePhase.max_buy_oxy)} OXY</p></div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-ocean-300 mb-2">
                <span>{t('oxy.progress')}</span>
                <span>{formatNumber(activePhase.sold_oxy)} / {formatNumber(activePhase.hard_cap_oxy)} OXY {t('oxy.sold')}</span>
              </div>
              <div className="h-3 bg-ocean-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-ocean-400 to-forest-400 transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex justify-between text-xs text-ocean-400 mt-1">
                <span>{progress.toFixed(1)}% {t('oxy.filled')}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {timeRemaining(activePhase.end_time)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6">
          <h4 className="font-display font-bold text-gray-900 mb-1">{t('oxy.buyOxy')}</h4>
          <p className="text-sm text-gray-500 mb-5">{t('oxy.buyOxyDesc', { phase: activePhase.phase_name })}</p>
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">{t('oxy.oxyAmount')}</label>
            <div className="relative">
              <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="number" value={amount} onChange={(e) => { setAmount(e.target.value); setBuyError(null); }} placeholder={`Min ${formatNumber(activePhase.min_buy_oxy)}`} disabled={!isLive} className="w-full pl-10 pr-16 py-3 rounded-xl border border-gray-200 focus:border-ocean-400 focus:ring-2 focus:ring-ocean-100 outline-none text-lg font-semibold disabled:bg-gray-50 disabled:text-gray-400" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">OXY</span>
            </div>
          </div>
          {amount && parseFloat(amount) > 0 && (
            <div className="mb-4 p-3 bg-ocean-50 rounded-xl border border-ocean-100 text-sm">
              <div className="flex justify-between text-gray-600 mb-1"><span>{t('oxy.youPay')}</span><strong className="text-gray-900">{monNeeded.toFixed(6)} MON</strong></div>
              <div className="flex justify-between text-gray-600"><span>{t('oxy.youReceive')}</span><strong className="text-ocean-700">{parseFloat(amount).toLocaleString()} OXY</strong></div>
            </div>
          )}
          <div className="flex gap-2 mb-5">
            {[activePhase.min_buy_oxy, activePhase.min_buy_oxy * 10, activePhase.max_buy_oxy / 2, activePhase.max_buy_oxy].map((v) => (
              <button key={v} onClick={() => setAmount(String(v))} disabled={!isLive} className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-40 ${String(amount) === String(v) ? 'bg-ocean-600 text-white border-ocean-600' : 'border-gray-200 text-gray-600 hover:border-ocean-400'}`}>{formatNumber(v)}</button>
            ))}
          </div>
          {isBuying && step && <div className="mb-4 flex items-center gap-2 p-3 bg-ocean-50 rounded-xl border border-ocean-200"><Loader className="w-4 h-4 animate-spin text-ocean-600 shrink-0" /><p className="text-sm text-ocean-700">{step}</p></div>}
          {buyError && <div className="mb-4 flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-200"><AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /><p className="text-sm text-red-600">{buyError}</p></div>}
          {buySuccess && <div className="mb-4 p-3 bg-forest-50 rounded-xl border border-forest-200"><p className="text-sm text-forest-700">{buySuccess}</p></div>}
          {wallet.isConnected ? (
            <button onClick={handleBuy} disabled={isBuying || !isLive} className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-ocean-600 text-white font-semibold rounded-xl hover:bg-ocean-700 transition-all shadow-lg shadow-ocean-600/20 disabled:opacity-50 disabled:cursor-not-allowed text-base">
              {isBuying ? <><Loader className="w-5 h-5 animate-spin" /> {t('oxy.processing')}</> : isLive ? <><Coins className="w-5 h-5" /> {t('oxy.buyOxyBtn')}</> : <><Clock className="w-5 h-5" /> {hasEnded ? t('oxy.phaseEnded') : t('oxy.notStarted')}</>}
            </button>
          ) : (
            <button onClick={connect} className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-ocean-600 text-white font-semibold rounded-xl hover:bg-ocean-700 transition-all text-base">{t('oxy.connectToParticipate')}</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── IDO Vesting Claim Section ────────────────────────────────────────────────

function VestingClaimSection() {
  const { t } = useI18n();
  const { wallet, connect } = useWallet();
  const { schedule, contractInfo, isLoading, claim, refresh } = useIDOVesting(wallet.address);

  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimTx, setClaimTx] = useState<string | null>(null);

  const handleClaim = async () => {
    if (!wallet.isConnected) { connect(); return; }
    setIsClaiming(true); setClaimError(null); setClaimTx(null);
    try {
      const hash = await claim();
      setClaimTx(hash);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Claim failed';
      const match = msg.match(/reason="([^"]+)"/);
      setClaimError(match ? match[1] : msg.startsWith('wrong_network:') ? 'Switch to Monad Testnet.' : msg);
    } finally { setIsClaiming(false); }
  };

  if (!wallet.isConnected) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12 bg-white rounded-2xl border border-gray-200 shadow-sm">
        <Lock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="font-display font-bold text-gray-700 text-lg mb-2">IDO Token Vesting</p>
        <p className="text-sm text-gray-500 mb-5">Connect your wallet to check your vesting schedule</p>
        <button onClick={connect} className="btn-primary">Connect Wallet</button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12">
        <Loader className="w-7 h-7 animate-spin text-ocean-500 mx-auto" />
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="max-w-3xl mx-auto text-center py-10 bg-white rounded-2xl border border-gray-200 shadow-sm">
        <Lock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="font-display font-bold text-gray-600 text-lg mb-1">No Vesting Schedule</p>
        <p className="text-sm text-gray-400">Your wallet does not have an active IDO vesting schedule.</p>
      </div>
    );
  }

  const totalAmount = parseFloat(schedule.totalAmount);
  const released = parseFloat(schedule.released);
  const vested = parseFloat(schedule.currentlyVested);
  const claimable = parseFloat(schedule.currentlyClaimable);
  const locked = totalAmount - vested;
  const progressPct = totalAmount > 0 ? (vested / totalAmount) * 100 : 0;
  const releasedPct = totalAmount > 0 ? (released / totalAmount) * 100 : 0;

  const cliffEnd = (schedule.startTime + schedule.cliffDuration) * 1000;
  const vestEnd = (schedule.startTime + schedule.vestingDuration) * 1000;
  const now = Date.now();
  const inCliff = now < cliffEnd;
  const fullyVested = now >= vestEnd;

  const formatTs = (ts: number) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const daysRemaining = Math.max(0, Math.ceil((vestEnd - now) / 86400000));

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Main vesting card */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-ocean-900 to-ocean-800 p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-ocean-700/50 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-ocean-300" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg">Your Vesting</h3>
                  <p className="text-xs text-ocean-300">IDO Token Release Schedule</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {schedule.revoked && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-300">Revoked</span>
                )}
                {fullyVested && !schedule.revoked && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-forest-500/20 text-forest-300">Fully Vested</span>
                )}
                {inCliff && !schedule.revoked && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300">Cliff Period</span>
                )}
                {!inCliff && !fullyVested && !schedule.revoked && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-ocean-500/20 text-ocean-300">Vesting</span>
                )}
                <button onClick={refresh} className="p-1.5 rounded-lg hover:bg-ocean-700/50 text-ocean-300 transition-colors">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-2">
              <div className="flex justify-between text-xs text-ocean-300 mb-1.5">
                <span>Vested: {formatNumber(vested)} OXY</span>
                <span>{progressPct.toFixed(1)}%</span>
              </div>
              <div className="h-3 bg-ocean-800 rounded-full overflow-hidden relative">
                <div className="absolute inset-0 h-full rounded-full bg-ocean-600/40 transition-all duration-500"
                  style={{ width: `${progressPct}%` }} />
                <div className="absolute inset-0 h-full rounded-full bg-gradient-to-r from-forest-400 to-ocean-400 transition-all duration-500"
                  style={{ width: `${releasedPct}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-ocean-400 mt-1">
                <span>Claimed: {formatNumber(released)} OXY</span>
                <span>Total: {formatNumber(totalAmount)} OXY</span>
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5">
            {[
              { label: 'Total Allocation', value: `${formatNumber(totalAmount)}`, sub: 'OXY', color: 'text-gray-900' },
              { label: 'Claimed', value: `${formatNumber(released)}`, sub: 'OXY', color: 'text-forest-600' },
              { label: 'Claimable Now', value: `${formatNumber(claimable)}`, sub: 'OXY', color: claimable > 0 ? 'text-ocean-600' : 'text-gray-400' },
              { label: 'Still Locked', value: `${formatNumber(locked)}`, sub: 'OXY', color: 'text-gray-500' },
            ].map((s) => (
              <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className={`text-lg font-display font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{s.sub}</p>
                <p className="text-[10px] text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Claim section */}
          <div className="px-5 pb-5">
            {claimError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-200 mb-3">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-600">{claimError}</p>
              </div>
            )}
            {claimTx && (
              <div className="flex items-start gap-2 p-3 bg-forest-50 rounded-xl border border-forest-200 mb-3">
                <CheckCircle className="w-4 h-4 text-forest-600 shrink-0 mt-0.5" />
                <div className="text-xs text-forest-700">
                  <p className="font-semibold">Tokens claimed successfully!</p>
                  <a href={getExplorerTxUrl(claimTx)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 mt-0.5 text-forest-600 hover:text-forest-500">
                    View transaction <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}
            {inCliff && !schedule.revoked && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200 mb-3">
                <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  <strong>Cliff period active.</strong> Tokens will start unlocking on {formatTs(cliffEnd)}.
                </p>
              </div>
            )}
            <button
              onClick={handleClaim}
              disabled={isClaiming || claimable <= 0 || schedule.revoked}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-ocean-600 text-white font-semibold rounded-xl hover:bg-ocean-700 transition-all shadow-lg shadow-ocean-600/20 disabled:opacity-50 disabled:cursor-not-allowed text-base"
            >
              {isClaiming ? (
                <><Loader className="w-5 h-5 animate-spin" /> Claiming...</>
              ) : claimable > 0 ? (
                <><Coins className="w-5 h-5" /> Claim {formatNumber(claimable)} OXY</>
              ) : (
                <><Lock className="w-5 h-5" /> No Tokens Available</>
              )}
            </button>
          </div>
        </div>

        {/* Timeline sidebar */}
        <div className="lg:col-span-2 space-y-4">
          {/* Schedule details */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h4 className="font-display font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-ocean-500" /> Schedule Details
            </h4>
            <div className="space-y-3">
              {[
                { label: 'Vesting Start', value: formatTs(schedule.startTime * 1000), done: true },
                { label: 'Cliff Ends', value: formatTs(cliffEnd), done: now >= cliffEnd },
                { label: 'Fully Vested', value: formatTs(vestEnd), done: fullyVested },
              ].map((step, i) => (
                <div key={step.label} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      step.done ? 'bg-forest-100 text-forest-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {step.done ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                    </div>
                    {i < 2 && <div className={`w-0.5 h-6 mt-1 ${step.done ? 'bg-forest-200' : 'bg-gray-200'}`} />}
                  </div>
                  <div className="pt-0.5">
                    <p className="text-xs font-semibold text-gray-800">{step.label}</p>
                    <p className="text-xs text-gray-500">{step.value}</p>
                  </div>
                </div>
              ))}
            </div>
            {!fullyVested && !schedule.revoked && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Days remaining</span>
                  <span className="font-semibold text-gray-800">{daysRemaining} days</span>
                </div>
              </div>
            )}
          </div>

          {/* Info box */}
          <div className="bg-ocean-50 border border-ocean-200 rounded-2xl p-5">
            <h4 className="font-semibold text-ocean-800 mb-2 flex items-center gap-2 text-sm">
              <Info className="w-4 h-4" /> How Vesting Works
            </h4>
            <ul className="space-y-2 text-xs text-ocean-700">
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-ocean-400 shrink-0 mt-1.5" />
                Tokens are locked during the cliff period and cannot be claimed.
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-ocean-400 shrink-0 mt-1.5" />
                After the cliff, tokens unlock linearly over the vesting duration.
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-ocean-400 shrink-0 mt-1.5" />
                You can claim your unlocked tokens at any time using the button above.
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-ocean-400 shrink-0 mt-1.5" />
                Unclaimed tokens continue to accrue until fully vested.
              </li>
            </ul>
          </div>

          {/* Contract info */}
          {contractInfo && (
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Contract Info</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Contract</span>
                  <a href={getExplorerAddressUrl(CONTRACT_ADDRESSES.IDO_VESTING)} target="_blank" rel="noopener noreferrer"
                    className="text-ocean-600 font-mono hover:underline flex items-center gap-1">
                    {CONTRACT_ADDRESSES.IDO_VESTING.slice(0, 8)}...{CONTRACT_ADDRESSES.IDO_VESTING.slice(-4)}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">OXY Balance</span>
                  <span className="font-semibold text-gray-800">{formatNumber(parseFloat(contractInfo.contractBalance))} OXY</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Allocated</span>
                  <span className="font-semibold text-gray-800">{formatNumber(parseFloat(contractInfo.totalAllocated))} OXY</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Beneficiaries</span>
                  <span className="font-semibold text-gray-800">{contractInfo.beneficiaryCount}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Exchange Links Section ────────────────────────────────────────────────────

function ExchangeLinksSection() {
  const { t } = useI18n();
  const { links, isLoading } = useExchangeLinks();
  const active = links.filter((l) => l.is_active);
  const dex = active.filter((l) => l.type === 'dex');
  const cex = active.filter((l) => l.type === 'cex');

  if (isLoading) return <div className="text-center py-8"><Loader className="w-6 h-6 animate-spin text-ocean-500 mx-auto" /></div>;
  if (active.length === 0) return (
    <div className="text-center py-8 text-gray-400">
      <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="text-sm">{t('oxy.exchangeListingsComingSoon')}</p>
    </div>
  );

  const renderGroup = (label: string, items: typeof active, badgeClass: string) => (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">{label}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((link) => (
          <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
            className="group flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all hover:-translate-y-0.5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${link.type === 'dex' ? 'bg-forest-50' : 'bg-ocean-50'}`}>
              {link.logo_url ? <img src={link.logo_url} alt={link.name} className="w-7 h-7 object-contain rounded" /> : <Globe className={`w-5 h-5 ${link.type === 'dex' ? 'text-forest-600' : 'text-ocean-600'}`} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-900 text-sm">{link.name}</p>
                <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${badgeClass}`}>{link.type.toUpperCase()}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{link.pair}</p>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors" />
          </a>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {dex.length > 0 && renderGroup('Decentralized Exchanges (DEX)', dex, 'bg-forest-50 text-forest-700')}
      {cex.length > 0 && renderGroup('Centralized Exchanges (CEX)', cex, 'bg-ocean-50 text-ocean-700')}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OxyTokenPage() {
  const { t } = useI18n();
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-b from-ocean-950 via-ocean-900 to-gray-950 text-white py-20 sm:py-28 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 right-20 w-96 h-96 bg-ocean-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-20 w-72 h-72 bg-forest-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ocean-800/60 border border-ocean-700/50 mb-6">
            <Coins className="w-4 h-4 text-ocean-400" />
            <span className="text-sm text-ocean-200">{t('oxy.badge')}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold mb-6">
            <span className="bg-gradient-to-r from-ocean-300 via-forest-400 to-gold-400 bg-clip-text text-transparent">$OXY</span>{' '}Token
          </h1>
          <p className="text-lg text-ocean-200/80 max-w-2xl mx-auto mb-10 leading-relaxed">
            {t('oxy.desc')}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { label: t('oxy.maxSupply'), val: formatNumber(OXY_MAX_SUPPLY) },
              { label: t('oxy.circulating'), val: '45.2M' },
              { label: t('oxy.staked'), val: '32.8M' },
              { label: t('oxy.price'), val: '$0.0042' },
            ].map((s) => (
              <div key={s.label} className="bg-ocean-800/40 border border-ocean-700/40 rounded-2xl p-4 text-center">
                <p className="text-2xl font-display font-bold">{s.val}</p>
                <p className="text-xs text-ocean-300/70 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* IDO Section */}
      <section className="py-20 bg-gradient-to-b from-gray-950 to-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionHeading badge={t('oxy.idoBadge')} title={t('oxy.idoTitle')} subtitle={t('oxy.idoSubtitle')} light={false} />
          <IDOSection />
        </div>
      </section>

      {/* IDO Vesting Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionHeading
            badge="Vesting"
            title="IDO Token Vesting"
            subtitle="Claim your vested $OXY tokens from the IDO. Tokens unlock gradually over time after the cliff period."
          />
          <VestingClaimSection />
        </div>
      </section>

      {/* DEX AMM Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionHeading
            badge={t('oxy.dexBadge')}
            title={t('oxy.dexTitle')}
            subtitle={t('oxy.dexSubtitle')}
          />

          {/* Pool overview banner */}
          <div className="mb-8">
            <PoolOverviewBanner />
          </div>

          {/* Swap + LP side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <DexSwapWidget />
            <LiquidityPanel />
          </div>

          {/* External exchange links */}
          <div className="mt-14">
            <h3 className="text-lg font-display font-bold text-gray-900 mb-6">{t('oxy.externalExchanges')}</h3>
            <ExchangeLinksSection />
          </div>
        </div>
      </section>

      {/* Tokenomics */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionHeading badge={t('oxy.tokenomicsBadge')} title={t('oxy.tokenomicsTitle')} subtitle={t('oxy.tokenomicsSubtitle')} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="relative">
              <div className="w-72 h-72 mx-auto relative">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="16" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#2a9d6a" strokeWidth="16" strokeDasharray={`${80 * 2.51} ${100 * 2.51}`} strokeDashoffset="0" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#3b97f6" strokeWidth="16" strokeDasharray={`${10 * 2.51} ${100 * 2.51}`} strokeDashoffset={`${-80 * 2.51}`} />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#eab308" strokeWidth="16" strokeDasharray={`${10 * 2.51} ${100 * 2.51}`} strokeDashoffset={`${-90 * 2.51}`} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-sm text-gray-500">{t('oxy.totalSupply')}</p>
                  <p className="text-2xl font-display font-bold text-gray-900">2.1B</p>
                  <p className="text-xs text-gray-400">$OXY</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              {allocations.map((a) => (
                <div key={a.category} className="card p-5 flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl ${a.light} flex items-center justify-center flex-shrink-0`}>
                    <div className={a.text}>{a.icon}</div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-display font-bold text-gray-900">{a.category}</h3>
                      <span className="text-lg font-bold text-gray-900">{a.percentage}%</span>
                    </div>
                    <p className="text-sm text-gray-500 mb-2">{a.desc}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${a.bg}`} style={{ width: `${a.percentage}%` }} />
                      </div>
                      <span className="text-xs font-medium text-gray-400">{formatNumber(a.amount)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Utility */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionHeading badge={t('oxy.utilityBadge')} title={t('oxy.utilityTitle')} subtitle={t('oxy.utilitySubtitle')} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {utilities.map((u) => (
              <div key={u.title} className="card p-6 flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-ocean-50 text-ocean-600 flex items-center justify-center flex-shrink-0">{u.icon}</div>
                <div>
                  <h3 className="font-display font-bold text-gray-900 mb-1">{u.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{u.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reward Formula */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionHeading badge={t('oxy.rewardBadge')} title={t('oxy.rewardTitle')} subtitle={t('oxy.rewardSubtitle')} />
          <div className="max-w-3xl mx-auto">
            <div className="bg-gray-900 rounded-2xl p-8 text-white mb-6">
              <div className="text-center mb-6">
                <p className="text-sm text-gray-400 mb-3">{t('oxy.dailyRewardPerTree')}</p>
                <div className="bg-gray-800 rounded-xl p-6 inline-block">
                  <p className="text-xl sm:text-2xl font-mono">
                    <span className="text-forest-400">reward</span> = (<span className="text-ocean-400">1</span> / <span className="text-gold-400">totalStaked</span>) × (<span className="text-ocean-400">0.1%</span> × <span className="text-gold-400">rewardPool</span>)
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                {[
                  { label: t('oxy.claimPeriod24h'), val: '24 Hours', color: 'text-forest-400' },
                  { label: t('oxy.rewardRate01'), val: '0.1% / day', color: 'text-ocean-400' },
                  { label: t('oxy.rewardPool168b'), val: '1.68B $OXY', color: 'text-gold-400' },
                ].map((s) => (
                  <div key={s.label} className="bg-gray-800 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                    <p className={`text-lg font-bold ${s.color}`}>{s.val}</p>
                  </div>
                ))}
              </div>
              <div className="bg-gray-800 rounded-xl p-4 border border-amber-500/20">
                <p className="text-xs text-amber-400 font-semibold mb-1">{t('oxy.lpStakingRewards')}</p>
                <p className="text-xs text-gray-300">{t('oxy.lpStakingDesc')}</p>
              </div>
            </div>
            <div className="bg-forest-50 border border-forest-200 rounded-2xl p-6 flex items-start gap-4">
              <PieChart className="w-6 h-6 text-forest-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-display font-bold text-forest-900 mb-1">{t('oxy.feeRedistribution')}</h3>
                <p className="text-sm text-forest-700 leading-relaxed">{t('oxy.feeRedistributionDesc')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-ocean-900 to-ocean-950 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">{t('oxy.ctaTitle')}</h2>
          <p className="text-ocean-200/80 text-lg mb-8">{t('oxy.ctaDesc')}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/staking" className="btn-primary text-base"><Zap className="w-5 h-5" /> {t('oxy.goToStaking')} <ArrowRight className="w-4 h-4" /></Link>
            <Link to="/nft-b" className="btn-secondary !border-ocean-600 !text-white hover:!bg-ocean-800 text-base">{t('oxy.buyOxyTrees')}</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
