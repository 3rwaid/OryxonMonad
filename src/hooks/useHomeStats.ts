import { useState, useEffect } from 'react';
import {
  getReadProvider,
  getNFTAnimalContract,
  getNFTTreeContract,
  getOxyTokenContract,
  getStakingPoolContract,
  formatOxy,
} from '../lib/contracts';

export interface HomeStats {
  nftMinted: number;
  nftMaxSupply: number;
  treeMinted: number;
  oxyCirculating: string;
  totalStaked: number;
  isLoading: boolean;
}

const DEFAULT: HomeStats = {
  nftMinted: 0,
  nftMaxSupply: 1000,
  treeMinted: 0,
  oxyCirculating: '0',
  totalStaked: 0,
  isLoading: true,
};

export function useHomeStats(): HomeStats {
  const [stats, setStats] = useState<HomeStats>(DEFAULT);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      try {
        const provider = getReadProvider();
        const [nftA, nftB, oxy, staking] = await Promise.all([
          getNFTAnimalContract(provider),
          getNFTTreeContract(provider),
          getOxyTokenContract(provider),
          getStakingPoolContract(provider),
        ]);

        const [nftMinted, nftMaxSupply, treeMinted, oxySupply, totalStaked] = await Promise.all([
          nftA.totalMinted().then(Number).catch(() => 0),
          nftA.MAX_SUPPLY().then(Number).catch(() => 1000),
          nftB.totalMinted().then(Number).catch(() => 0),
          oxy.totalSupply().catch(() => 0n),
          staking.totalStaked().then(Number).catch(() => 0),
        ]);

        if (!cancelled) {
          setStats({
            nftMinted,
            nftMaxSupply,
            treeMinted,
            oxyCirculating: formatOxy(oxySupply as bigint),
            totalStaked,
            isLoading: false,
          });
        }
      } catch {
        if (!cancelled) setStats(prev => ({ ...prev, isLoading: false }));
      }
    }

    fetch();
    const id = setInterval(fetch, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return stats;
}
