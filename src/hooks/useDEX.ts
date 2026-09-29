import { useState, useEffect, useCallback } from 'react';
import { parseEther, formatEther, parseUnits, formatUnits, MaxUint256 } from 'ethers';
import { getSigner, getReadProvider, getOxyDEXContract, getOxyTokenContract, CONTRACT_ADDRESSES, formatOxy, parseOxy } from '../lib/contracts';

export interface DEXPoolState {
  reserveOxy: string;       // formatted
  reserveMon: string;       // formatted (MON)
  totalLPSupply: string;    // formatted
  lpBalance: string;        // user's LP balance
  poolShare: string;        // user's share % (0-100)
  pendingReward: string;    // OXY reward accrued
  rewardPerSecond: string;  // OXY/sec emitted
  rewardPoolBalance: string;// OXY in reward pool
  priceOxyPerMon: string;   // OXY per 1 MON
  userOxyBalance: string;
  userMonBalance: string;
}

const EMPTY_STATE: DEXPoolState = {
  reserveOxy: '0', reserveMon: '0', totalLPSupply: '0',
  lpBalance: '0', poolShare: '0', pendingReward: '0',
  rewardPerSecond: '0', rewardPoolBalance: '0', priceOxyPerMon: '0',
  userOxyBalance: '0', userMonBalance: '0',
};

export function useDEX(userAddress?: string | null) {
  const [state, setState] = useState<DEXPoolState>(EMPTY_STATE);
  const [isLoading, setIsLoading] = useState(false);

  const contractReady = !!CONTRACT_ADDRESSES.OXY_DEX;

  const fetchState = useCallback(async () => {
    if (!contractReady) return;
    setIsLoading(true);
    try {
      const provider = getReadProvider();
      const [dex, oxy] = await Promise.all([
        getOxyDEXContract(provider),
        getOxyTokenContract(provider),
      ]);

      const [
        resOxy, resMon, totalLP, rps, rwdPool,
      ] = await Promise.all([
        dex.reserveOxy(),
        dex.reserveMon(),
        dex.totalSupply(),
        dex.rewardPerSecond(),
        dex.rewardPoolBalance(),
      ]);

      let lpBal = 0n;
      let share = 0n;
      let pending = 0n;
      let userOxy = 0n;
      let userMon = 0n;

      if (userAddress) {
        [lpBal, share, pending, userOxy, userMon] = await Promise.all([
          dex.balanceOf(userAddress),
          dex.poolShare(userAddress),
          dex.earned(userAddress),
          oxy.balanceOf(userAddress),
          provider.getBalance(userAddress),
        ]);
      }

      const priceRaw = resMon > 0n ? (resOxy * BigInt(1e6)) / resMon : 0n;

      setState({
        reserveOxy:       formatOxy(resOxy),
        reserveMon:       formatEther(resMon),
        totalLPSupply:    formatUnits(totalLP, 18),
        lpBalance:        formatUnits(lpBal, 18),
        poolShare:        (Number(share) / 1e16).toFixed(2),  // share is 1e18 scaled
        pendingReward:    formatOxy(pending),
        rewardPerSecond:  formatOxy(rps),
        rewardPoolBalance:formatOxy(rwdPool),
        priceOxyPerMon:   (Number(priceRaw) / 1e6).toFixed(2),
        userOxyBalance:   formatOxy(userOxy),
        userMonBalance:   formatEther(userMon),
      });
    } catch { /* silent — contract may not be deployed yet */ }
    finally { setIsLoading(false); }
  }, [contractReady, userAddress]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 15_000);
    return () => clearInterval(interval);
  }, [fetchState]);

  // ── Quote helpers (no wallet needed) ─────────────────────────────────────

  const quoteOxyOut = useCallback(async (monIn: string): Promise<string> => {
    if (!contractReady || !monIn || parseFloat(monIn) <= 0) return '0';
    try {
      const provider = getReadProvider();
      const dex = await getOxyDEXContract(provider);
      const out = await dex.getOxyOut(parseEther(monIn));
      return formatOxy(out);
    } catch { return '0'; }
  }, [contractReady]);

  const quoteMonOut = useCallback(async (oxyIn: string): Promise<string> => {
    if (!contractReady || !oxyIn || parseFloat(oxyIn) <= 0) return '0';
    try {
      const provider = getReadProvider();
      const dex = await getOxyDEXContract(provider);
      const out = await dex.getMonOut(parseOxy(oxyIn));
      return formatEther(out);
    } catch { return '0'; }
  }, [contractReady]);

  // ── Swap ─────────────────────────────────────────────────────────────────

  const swapMonForOxy = useCallback(async (
    monIn: string,
    minOxyOut: string,
    slippagePct = 0.5,
  ): Promise<string> => {
    const signer = await getSigner();
    const dex = await getOxyDEXContract(signer);
    const outRaw = parseOxy(minOxyOut);
    const minOut = outRaw - (outRaw * BigInt(Math.round(slippagePct * 100))) / 10000n;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
    const tx = await dex.swapMonForOxy(minOut, deadline, { value: parseEther(monIn) });
    const receipt = await tx.wait();
    await fetchState();
    return receipt.hash;
  }, [fetchState]);

  const swapOxyForMon = useCallback(async (
    oxyIn: string,
    minMonOut: string,
    slippagePct = 0.5,
  ): Promise<string> => {
    const signer = await getSigner();
    const dex = await getOxyDEXContract(signer);
    const oxy = await getOxyTokenContract(signer);
    const oxyRaw = parseOxy(oxyIn);
    const signerAddr = await signer.getAddress();
    const allowance: bigint = await oxy.allowance(signerAddr, CONTRACT_ADDRESSES.OXY_DEX);
    if (allowance < oxyRaw) {
      const approveTx = await oxy.approve(CONTRACT_ADDRESSES.OXY_DEX, MaxUint256);
      await approveTx.wait();
    }
    const outRaw = parseEther(minMonOut);
    const minOut = outRaw - (outRaw * BigInt(Math.round(slippagePct * 100))) / 10000n;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
    const tx = await dex.swapOxyForMon(oxyRaw, minOut, deadline);
    const receipt = await tx.wait();
    await fetchState();
    return receipt.hash;
  }, [fetchState]);

  // ── Liquidity ─────────────────────────────────────────────────────────────

  const addLiquidity = useCallback(async (
    oxyDesired: string,
    monDesired: string,
    slippagePct = 0.5,
  ): Promise<string> => {
    const signer = await getSigner();
    const dex = await getOxyDEXContract(signer);
    const oxy = await getOxyTokenContract(signer);
    const oxyRaw = parseOxy(oxyDesired);
    const monRaw = parseEther(monDesired);
    // slippage mins
    const slip = BigInt(Math.round(slippagePct * 100));
    const oxyMin = oxyRaw - (oxyRaw * slip) / 10000n;
    const monMin = monRaw - (monRaw * slip) / 10000n;
    // approve OXY
    const signerAddr = await signer.getAddress();
    const allowance: bigint = await oxy.allowance(signerAddr, CONTRACT_ADDRESSES.OXY_DEX);
    if (allowance < oxyRaw) {
      const approveTx = await oxy.approve(CONTRACT_ADDRESSES.OXY_DEX, MaxUint256);
      await approveTx.wait();
    }
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
    const tx = await dex.addLiquidity(oxyRaw, oxyMin, monMin, deadline, { value: monRaw });
    const receipt = await tx.wait();
    await fetchState();
    return receipt.hash;
  }, [fetchState]);

  const removeLiquidity = useCallback(async (
    lpAmount: string,
    slippagePct = 0.5,
  ): Promise<string> => {
    const signer = await getSigner();
    const dex = await getOxyDEXContract(signer);
    const lpRaw = parseUnits(lpAmount, 18);
    const totalLP = parseUnits(state.totalLPSupply, 18);
    const resOxy  = parseOxy(state.reserveOxy);
    const resMon = parseEther(state.reserveMon);
    const oxyOut  = totalLP > 0n ? (lpRaw * resOxy) / totalLP : 0n;
    const monOut = totalLP > 0n ? (lpRaw * resMon) / totalLP : 0n;
    const slip = BigInt(Math.round(slippagePct * 100));
    const oxyMin  = oxyOut  - (oxyOut  * slip) / 10000n;
    const monMin = monOut - (monOut * slip) / 10000n;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
    const tx = await dex.removeLiquidity(lpRaw, oxyMin, monMin, deadline);
    const receipt = await tx.wait();
    await fetchState();
    return receipt.hash;
  }, [fetchState, state.totalLPSupply, state.reserveOxy, state.reserveMon]);

  const claimReward = useCallback(async (): Promise<string> => {
    const signer = await getSigner();
    const dex = await getOxyDEXContract(signer);
    const tx = await dex.claimReward();
    const receipt = await tx.wait();
    await fetchState();
    return receipt.hash;
  }, [fetchState]);

  return {
    state,
    isLoading,
    contractReady,
    fetchState,
    quoteOxyOut,
    quoteMonOut,
    swapMonForOxy,
    swapOxyForMon,
    addLiquidity,
    removeLiquidity,
    claimReward,
  };
}
