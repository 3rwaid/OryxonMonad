import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap, TreePine, Coins, Clock, TrendingUp,
  ArrowUpRight, ArrowDownRight, ChevronRight, Wallet,
  ExternalLink, AlertCircle, Loader, RefreshCw, Info, ArrowRight,
} from 'lucide-react';
import SectionHeading from '../components/shared/SectionHeading';
import StatCard from '../components/shared/StatCard';
import { useWallet } from '../lib/wallet-context';
import { useStaking, type StakeInfo } from '../hooks/useStaking';
import { useNFTTree } from '../hooks/useNFTTree';
import { useI18n } from '../lib/i18n';

// ── helpers ───────────────────────────────────────────────────────────────────

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatOxyDisplay(raw: string): string {
  const num = parseFloat(raw);
  if (isNaN(num)) return '0';
  return formatNumber(Math.floor(num));
}

function formatDate(timestamp: number): string {
  if (!timestamp) return 'N/A';
  return new Date(timestamp * 1000).toLocaleDateString();
}

function secondsUntilClaim(lastClaimAt: number, claimPeriod: number): number {
  const nextClaimAt = lastClaimAt + claimPeriod;
  return Math.max(0, nextClaimAt - Math.floor(Date.now() / 1000));
}

function formatCountdown(seconds: number): string {
  if (seconds === 0) return 'Ready to claim';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// Translate on-chain revert messages into readable text
function parseClaimError(raw: string): string {
  if (raw.includes('Claim period not elapsed')) return 'Claim period not elapsed yet. Wait 24 hours between claims.';
  if (raw.includes('No rewards available')) return 'No rewards available — the reward pool may be empty.';
  if (raw.includes('Insufficient reward pool')) return 'Reward pool is empty. No rewards available right now.';
  if (raw.includes('Not staker')) return 'You are not the staker of this token.';
  if (raw.includes('user rejected') || raw.includes('User denied')) return 'Transaction was rejected in your wallet.';
  if (raw.startsWith('wrong_network:')) return 'Please switch to Monad Testnet.';
  return raw;
}

// ── Countdown component (live ticking) ───────────────────────────────────────

function ClaimCountdown({ lastClaimAt, claimPeriod }: { lastClaimAt: number; claimPeriod: number }) {
  const { t } = useI18n();
  const [remaining, setRemaining] = useState(() => secondsUntilClaim(lastClaimAt, claimPeriod));

  useEffect(() => {
    if (remaining === 0) return;
    const interval = setInterval(() => {
      const r = secondsUntilClaim(lastClaimAt, claimPeriod);
      setRemaining(r);
    }, 1000);
    return () => clearInterval(interval);
  }, [lastClaimAt, claimPeriod]);

  if (remaining === 0) {
    return <span className="text-forest-600 font-semibold text-xs">{t('staking.readyToClaim')}</span>;
  }
  return (
    <span className="text-amber-600 font-mono text-xs tabular-nums">
      {formatCountdown(remaining)}
    </span>
  );
}

// ── Staked row ────────────────────────────────────────────────────────────────

interface StakedRowProps {
  s: StakeInfo;
  claimPeriod: number;
  rewardPoolBalance: string;
  isTxPending: boolean;
  claimingId: number | null;
  unstakingId: number | null;
  onClaim: (tokenId: number) => void;
  onUnstake: (tokenId: number) => void;
}

function StakedRow({
  s, claimPeriod, rewardPoolBalance,
  isTxPending, claimingId, unstakingId,
  onClaim, onUnstake,
}: StakedRowProps) {
  const { t } = useI18n();
  const [remaining, setRemaining] = useState(() => secondsUntilClaim(s.lastClaimAt, claimPeriod));

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(secondsUntilClaim(s.lastClaimAt, claimPeriod));
    }, 1000);
    return () => clearInterval(interval);
  }, [s.lastClaimAt, claimPeriod]);

  const isClaimReady = remaining === 0;
  const poolEmpty = parseFloat(rewardPoolBalance) === 0;
  const canClaim = isClaimReady && !poolEmpty;

  const isClaimingThis = claimingId === s.tokenId;
  const isUnstakingThis = unstakingId === s.tokenId;

  return (
    <div className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="w-14 h-14 rounded-xl bg-forest-50 flex items-center justify-center flex-shrink-0">
        <TreePine className="w-7 h-7 text-forest-600" />
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-display font-bold text-gray-900">Tree #{s.tokenId}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{t('staking.stakedSince', { date: formatDate(s.stakedAt) })}</p>
      </div>

      <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
        <div className="text-center min-w-[60px] sm:min-w-[72px]">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{t('staking.pending')}</p>
          <p className="text-sm font-bold text-gold-600">
            {formatOxyDisplay(s.pendingReward)} $OXY
          </p>
        </div>

        <div className="text-center min-w-[68px] sm:min-w-[80px]">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{t('staking.nextClaim')}</p>
          <ClaimCountdown lastClaimAt={s.lastClaimAt} claimPeriod={claimPeriod} />
        </div>

        <div className="text-center min-w-[60px] sm:min-w-[72px]">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{t('staking.totalClaimed')}</p>
          <p className="text-xs font-medium text-forest-600">{formatOxyDisplay(s.totalClaimed)} $OXY</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onClaim(s.tokenId)}
            disabled={isTxPending || !canClaim || isClaimingThis}
            title={
              poolEmpty ? t('staking.poolEmpty')
              : !isClaimReady ? t('staking.claimErrorPeriod')
              : t('staking.claim')
            }
            className="btn-primary text-xs !py-2 !px-3 disabled:opacity-40"
          >
            {isClaimingThis ? (
              <Loader className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowUpRight className="w-3.5 h-3.5" />
            )}
            {isClaimingThis ? t('staking.claiming') : t('staking.claim')}
          </button>
          <button
            onClick={() => onUnstake(s.tokenId)}
            disabled={isTxPending || isUnstakingThis}
            className="btn-secondary text-xs !py-2 !px-3 disabled:opacity-40"
          >
            {isUnstakingThis ? (
              <Loader className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5" />
            )}
            {isUnstakingThis ? t('staking.unstaking') : t('staking.unstake')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function StakingPage() {
  const { t } = useI18n();
  const { wallet, connect } = useWallet();
  const [tab, setTab] = useState<'staked' | 'unstaked'>('staked');
  const [txFeedback, setTxFeedback] = useState<{ hash: string; url: string } | null>(null);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [unstakingId, setUnstakingId] = useState<number | null>(null);
  const [stakingId, setStakingId] = useState<number | null>(null);

  const {
    stakedTokenIds,
    stakeInfos,
    pendingRewardsTotal,
    rewardPoolBalance,
    totalStaked,
    claimPeriod,
    isLoading,
    isTxPending,
    txError,
    stake,
    unstake,
    claimRewards,
    claimAll,
    refresh,
  } = useStaking();

  const { ownedTrees, isLoading: treesLoading } = useNFTTree();
  const unstakedTrees = ownedTrees.filter((t) => !stakedTokenIds.includes(t.tokenId));

  // Count how many staked tokens have elapsed their claim period
  const now = Math.floor(Date.now() / 1000);
  const claimableCount = stakeInfos.filter(s => s.lastClaimAt + claimPeriod <= now).length;
  const poolEmpty = parseFloat(rewardPoolBalance) === 0;
  const canClaimAll = claimableCount > 0 && !poolEmpty;

  const handleStake = async (tokenId: number) => {
    setStakingId(tokenId);
    setTxFeedback(null);
    try {
      const result = await stake(tokenId);
      setTxFeedback({ hash: result.txHash, url: result.explorerUrl });
    } catch { /* error in txError */ }
    finally { setStakingId(null); }
  };

  const handleUnstake = async (tokenId: number) => {
    setUnstakingId(tokenId);
    setTxFeedback(null);
    try {
      const result = await unstake(tokenId);
      setTxFeedback({ hash: result.txHash, url: result.explorerUrl });
    } catch { /* error in txError */ }
    finally { setUnstakingId(null); }
  };

  const handleClaim = async (tokenId: number) => {
    setClaimingId(tokenId);
    setTxFeedback(null);
    try {
      const result = await claimRewards(tokenId);
      setTxFeedback({ hash: result.txHash, url: result.explorerUrl });
    } catch { /* error in txError */ }
    finally { setClaimingId(null); }
  };

  const handleClaimAll = async () => {
    setTxFeedback(null);
    try {
      const result = await claimAll();
      setTxFeedback({ hash: result.txHash, url: result.explorerUrl });
    } catch { /* error in txError */ }
  };

  return (
    <div>
      {/* ── Hero ── */}
      <section className="bg-gradient-to-b from-forest-950 to-gray-950 text-white py-16 sm:py-24 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-10 left-20 w-80 h-80 bg-forest-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-60 h-60 bg-gold-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-forest-800/60 border border-forest-700/50 mb-6">
              <Zap className="w-4 h-4 text-gold-400" />
              <span className="text-sm text-forest-200">{t('staking.badge')}</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-display font-extrabold mb-4">
              {t('staking.title1')} <span className="gradient-text">{t('staking.title2')}</span>
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              {t('staking.desc')}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-5xl mx-auto">
            <div className="bg-forest-800/40 border border-forest-700/40 rounded-2xl p-5 text-center">
              <TreePine className="w-6 h-6 text-forest-400 mx-auto mb-2" />
              <p className="text-2xl font-display font-bold">
                {isLoading ? '...' : stakeInfos.length}
              </p>
              <p className="text-xs text-forest-300/70 mt-1">{t('staking.yourStakedTrees')}</p>
            </div>
            <div className="bg-gold-500/10 border border-gold-500/30 rounded-2xl p-5 text-center">
              <Coins className="w-6 h-6 text-gold-400 mx-auto mb-2" />
              <p className="text-2xl font-display font-bold">
                {isLoading ? '...' : formatOxyDisplay(pendingRewardsTotal)}
              </p>
              <p className="text-xs text-gold-300/70 mt-1">{t('staking.pendingOxy')}</p>
            </div>
            <div className="bg-forest-800/40 border border-forest-700/40 rounded-2xl p-5 text-center">
              <TrendingUp className="w-6 h-6 text-forest-400 mx-auto mb-2" />
              <p className="text-2xl font-display font-bold">
                {isLoading ? '...' : formatOxyDisplay(rewardPoolBalance)}
              </p>
              <p className="text-xs text-forest-300/70 mt-1">{t('staking.rewardPool')}</p>
            </div>
            <div className="bg-forest-800/40 border border-forest-700/40 rounded-2xl p-5 text-center">
              <Clock className="w-6 h-6 text-ocean-400 mx-auto mb-2" />
              <p className="text-2xl font-display font-bold">~36.5%</p>
              <p className="text-xs text-ocean-300/70 mt-1">Est. APR</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Positions ── */}
      <section className="py-12 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          {!wallet.isConnected ? (
            <div className="text-center py-16">
              <Wallet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-display font-bold text-gray-900 mb-2">{t('staking.connectWallet')}</h3>
              <p className="text-gray-500 mb-6">{t('staking.connectDesc')}</p>
              <button onClick={connect} className="btn-primary">
                <Wallet className="w-4 h-4" />
                {t('staking.connectWallet')}
              </button>
            </div>
          ) : (
            <>
              {txFeedback && (
                <div className="mb-6 p-4 rounded-xl bg-forest-50 border border-forest-200 flex items-center justify-between">
                  <p className="text-sm text-forest-700 font-medium">Transaction confirmed!</p>
                  <a href={txFeedback.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-forest-600 hover:text-forest-800">
                    {t('staking.viewTx')} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {txError && (
                <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-600">{parseClaimError(txError)}</p>
                </div>
              )}

              {poolEmpty && stakeInfos.length > 0 && (
                <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-700">
                    {t('staking.poolEmpty')}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between mb-8 gap-3 flex-wrap">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="flex bg-gray-100 rounded-xl p-1 overflow-x-auto">
                    <button
                      onClick={() => setTab('staked')}
                      className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        tab === 'staked' ? 'bg-white shadow-sm text-forest-700' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {t('staking.tab.staked')} ({stakeInfos.length})
                    </button>
                    <button
                      onClick={() => setTab('unstaked')}
                      className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        tab === 'unstaked' ? 'bg-white shadow-sm text-forest-700' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {t('staking.tab.unstaked')} ({unstakedTrees.length})
                    </button>
                  </div>
                  <button
                    onClick={refresh}
                    disabled={isLoading}
                    className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw className={`w-4 h-4 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {tab === 'staked' && stakeInfos.length > 0 && (
                  <button
                    onClick={handleClaimAll}
                    disabled={isTxPending || !canClaimAll}
                    title={poolEmpty ? t('staking.poolEmpty') : claimableCount === 0 ? 'No tokens ready to claim yet' : undefined}
                    className="btn-gold text-sm disabled:opacity-40"
                  >
                    {isTxPending && claimingId === null ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Coins className="w-4 h-4" />
                    )}
                    {claimableCount > 0 ? t('staking.claimAllReady', { count: claimableCount }) : t('staking.claimAll')}
                  </button>
                )}
              </div>

              {isLoading || treesLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader className="w-8 h-8 animate-spin text-forest-500" />
                </div>
              ) : tab === 'staked' ? (
                <div className="space-y-4">
                  {stakeInfos.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="w-16 h-16 rounded-2xl bg-forest-50 flex items-center justify-center mx-auto mb-4">
                        <TreePine className="w-8 h-8 text-forest-400" />
                      </div>
                      <p className="font-semibold text-gray-700 mb-1">{t('staking.noStakedTrees')}</p>
                      <p className="text-sm text-gray-400 mb-6">{t('staking.noStakedDesc')}</p>
                    </div>
                  ) : (
                    stakeInfos.map((s) => (
                      <StakedRow
                        key={s.tokenId}
                        s={s}
                        claimPeriod={claimPeriod}
                        rewardPoolBalance={rewardPoolBalance}
                        isTxPending={isTxPending}
                        claimingId={claimingId}
                        unstakingId={unstakingId}
                        onClaim={handleClaim}
                        onUnstake={handleUnstake}
                      />
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {unstakedTrees.length === 0 ? (
                    <div className="flex flex-col items-center text-center py-16 px-4">
                      {/* Icon */}
                      <div
                        className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5"
                        style={{
                          background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(16,185,129,0.08))',
                          border: '1px solid rgba(34,197,94,0.2)',
                        }}
                      >
                        <TreePine className="w-10 h-10 text-emerald-500" />
                      </div>

                      <h3 className="text-lg font-display font-bold text-gray-800 mb-1">{t('staking.noUnstakedTrees')}</h3>
                      <p className="text-sm text-gray-500 mb-8 max-w-sm">
                        Dapatkan OxyTree Oryxon dan stake untuk menghasilkan reward $OXY setiap hari — hingga <span className="font-semibold text-emerald-600">36.5% APR</span>.
                      </p>

                      {/* Primary CTA */}
                      <Link
                        to="/nft-b"
                        className="group inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl font-semibold text-white text-base shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/35 hover:-translate-y-0.5 transition-all duration-200"
                        style={{ background: 'linear-gradient(135deg, #16a34a, #059669)' }}
                      >
                        <TreePine className="w-5 h-5" />
                        {t('staking.goToStake')}
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </Link>

                      <p className="text-xs text-gray-400 mt-4">
                        Setiap OxyTree = 1 bibit nyata yang ditanam di alam
                      </p>
                    </div>
                  ) : (
                    unstakedTrees.map((nft) => (
                      <div key={nft.tokenId} className="card p-5 flex items-center gap-2 sm:gap-4">
                        <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <TreePine className="w-7 h-7 text-gray-400" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-display font-bold text-gray-900">
                            {nft.species ? `${nft.species} #${nft.tokenId}` : `Tree #${nft.tokenId}`}
                          </h3>
                          <p className="text-sm text-gray-500">{nft.location || 'Unknown location'}</p>
                        </div>
                        <button
                          onClick={() => handleStake(nft.tokenId)}
                          disabled={isTxPending}
                          className="btn-primary text-sm disabled:opacity-50"
                        >
                          {stakingId === nft.tokenId ? (
                            <Loader className="w-4 h-4 animate-spin" />
                          ) : (
                            <Zap className="w-4 h-4" />
                          )}
                          {stakingId === nft.tokenId ? t('staking.staking') : t('staking.stake')}
                          {stakingId !== nft.tokenId && <ChevronRight className="w-4 h-4" />}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ── Global Stats ── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionHeading badge="Global Stats" title="Staking Overview" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard icon={<TreePine className="w-6 h-6" />} label={t('staking.totalStaked')} value={isLoading ? '...' : totalStaked.toLocaleString()} color="forest" />
            <StatCard icon={<Coins className="w-6 h-6" />} label={t('staking.rewardPool')} value={isLoading ? '...' : formatOxyDisplay(rewardPoolBalance)} color="gold" />
            <StatCard icon={<TrendingUp className="w-6 h-6" />} label="Est. APR" value="~36.5%" color="ocean" />
            <StatCard icon={<Clock className="w-6 h-6" />} label={t('staking.claimPeriodLabel')} value="24 hours" color="earth" />
          </div>
        </div>
      </section>
    </div>
  );
}
