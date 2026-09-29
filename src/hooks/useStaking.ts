import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../lib/wallet-context';
import {
  getSigner,
  getReadProvider,
  getStakingPoolContract,
  getNFTTreeContract,
  formatOxy,
  CONTRACT_ADDRESSES,
  getExplorerTxUrl,
} from '../lib/contracts';

export interface StakeInfo {
  tokenId: number;
  staker: string;
  stakedAt: number;
  lastClaimAt: number;
  totalClaimed: string;
  pendingReward: string;
}

interface StakingState {
  stakedTokenIds: number[];
  stakeInfos: StakeInfo[];
  pendingRewardsTotal: string;
  rewardPoolBalance: string;
  totalStaked: number;
  rewardRateBps: number;
  claimPeriod: number;
  isLoading: boolean;
  error: string | null;
}

interface TxResult {
  txHash: string;
  explorerUrl: string;
}

function extractContractError(err: unknown): string {
  if (!(err instanceof Error)) return 'Transaction failed';
  const msg = err.message;
  // ethers v6 wraps revert reason inside the message
  const match = msg.match(/reason="([^"]+)"/);
  if (match) return match[1];
  // plain string revert
  if (msg.includes('Claim period not elapsed')) return 'Claim period not elapsed';
  if (msg.includes('No rewards available')) return 'No rewards available';
  if (msg.includes('Insufficient reward pool')) return 'Insufficient reward pool';
  if (msg.includes('Nothing to claim')) return 'Nothing to claim';
  if (msg.includes('user rejected') || msg.includes('User denied')) return 'User rejected the transaction';
  if (msg.startsWith('wrong_network:')) return 'wrong_network:';
  return msg;
}

export function useStaking() {
  const { wallet } = useWallet();
  const [state, setState] = useState<StakingState>({
    stakedTokenIds: [],
    stakeInfos: [],
    pendingRewardsTotal: '0',
    rewardPoolBalance: '0',
    totalStaked: 0,
    rewardRateBps: 10,
    claimPeriod: 86400,
    isLoading: false,
    error: null,
  });
  const [isTxPending, setIsTxPending] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const provider = getReadProvider();
      const contract = await getStakingPoolContract(provider);

      const [totalStaked, rewardPoolBalance, rewardRateBps, claimPeriod] = await Promise.all([
        contract.totalStaked(),
        contract.rewardPoolBalance(),
        contract.REWARD_RATE_BPS(),
        contract.CLAIM_PERIOD(),
      ]);

      let stakedTokenIds: number[] = [];
      let stakeInfos: StakeInfo[] = [];
      let pendingRewardsTotal = '0';

      if (wallet.address) {
        const rawTokenIds = await contract.getUserStakedTokens(wallet.address);
        stakedTokenIds = rawTokenIds.map((id: bigint) => Number(id));

        stakeInfos = await Promise.all(
          stakedTokenIds.map(async (tokenId) => {
            const [stakeData, pendingReward] = await Promise.all([
              contract.stakes(tokenId),
              contract.calculateReward(tokenId),
            ]);
            return {
              tokenId,
              staker: stakeData.staker,
              stakedAt: Number(stakeData.stakedAt),
              lastClaimAt: Number(stakeData.lastClaimAt),
              totalClaimed: formatOxy(stakeData.totalClaimed),
              pendingReward: formatOxy(pendingReward),
            };
          })
        );

        const pendingBig = await contract.getPendingRewards(wallet.address);
        pendingRewardsTotal = formatOxy(pendingBig);
      }

      setState({
        stakedTokenIds,
        stakeInfos,
        pendingRewardsTotal,
        rewardPoolBalance: formatOxy(rewardPoolBalance),
        totalStaked: Number(totalStaked),
        rewardRateBps: Number(rewardRateBps),
        claimPeriod: Number(claimPeriod),
        isLoading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load staking data';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
    }
  }, [wallet.address]);

  useEffect(() => {
    fetchState();
    const id = setInterval(fetchState, 30_000);
    return () => clearInterval(id);
  }, [fetchState]);

  const ensureNFTApproval = useCallback(async () => {
    if (!wallet.address) throw new Error('Wallet not connected');
    const signer = await getSigner();
    const nftContract = await getNFTTreeContract(signer);
    const isApproved = await nftContract.isApprovedForAll(wallet.address, CONTRACT_ADDRESSES.STAKING_POOL);
    if (!isApproved) {
      const tx = await nftContract.setApprovalForAll(CONTRACT_ADDRESSES.STAKING_POOL, true);
      await tx.wait();
    }
  }, [wallet.address]);

  const stake = useCallback(async (tokenId: number): Promise<TxResult> => {
    setIsTxPending(true);
    setTxError(null);
    try {
      await ensureNFTApproval();
      const signer = await getSigner();
      const contract = await getStakingPoolContract(signer);
      const tx = await contract.stake(tokenId);
      await tx.wait();
      await fetchState();
      return { txHash: tx.hash, explorerUrl: getExplorerTxUrl(tx.hash) };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Stake failed';
      setTxError(message);
      throw err;
    } finally {
      setIsTxPending(false);
    }
  }, [ensureNFTApproval, fetchState]);

  const unstake = useCallback(async (tokenId: number): Promise<TxResult> => {
    setIsTxPending(true);
    setTxError(null);
    try {
      const signer = await getSigner();
      const contract = await getStakingPoolContract(signer);
      const tx = await contract.unstake(tokenId);
      await tx.wait();
      await fetchState();
      return { txHash: tx.hash, explorerUrl: getExplorerTxUrl(tx.hash) };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unstake failed';
      setTxError(message);
      throw err;
    } finally {
      setIsTxPending(false);
    }
  }, [fetchState]);

  const claimRewards = useCallback(async (tokenId: number): Promise<TxResult> => {
    setIsTxPending(true);
    setTxError(null);
    try {
      const signer = await getSigner();
      const contract = await getStakingPoolContract(signer);
      const tx = await contract.claimRewards(tokenId);
      await tx.wait();
      await fetchState();
      return { txHash: tx.hash, explorerUrl: getExplorerTxUrl(tx.hash) };
    } catch (err) {
      const message = extractContractError(err);
      setTxError(message);
      throw err;
    } finally {
      setIsTxPending(false);
    }
  }, [fetchState]);

  const claimAll = useCallback(async (): Promise<TxResult> => {
    setIsTxPending(true);
    setTxError(null);
    try {
      const signer = await getSigner();
      const contract = await getStakingPoolContract(signer);
      const tx = await contract.claimAll();
      await tx.wait();
      await fetchState();
      return { txHash: tx.hash, explorerUrl: getExplorerTxUrl(tx.hash) };
    } catch (err) {
      const message = extractContractError(err);
      setTxError(message);
      throw err;
    } finally {
      setIsTxPending(false);
    }
  }, [fetchState]);

  return {
    ...state,
    isTxPending,
    txError,
    stake,
    unstake,
    claimRewards,
    claimAll,
    refresh: fetchState,
  };
}
