import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../lib/wallet-context';
import { getSigner, getReadProvider, getNFTTreeContract } from '../lib/contracts';

export interface TreeData {
  tokenId: number;
  species: string;
  location: string;
  planter: string;
  plantedAt: number;
  tokenURI: string;
}

interface NFTTreeState {
  totalMinted: number;
  ownedTokenIds: number[];
  ownedTrees: TreeData[];
  isLoading: boolean;
  error: string | null;
}

export function useNFTTree() {
  const { wallet } = useWallet();
  const [state, setState] = useState<NFTTreeState>({
    totalMinted: 0,
    ownedTokenIds: [],
    ownedTrees: [],
    isLoading: false,
    error: null,
  });

  const fetchState = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const provider = getReadProvider();
      const contract = await getNFTTreeContract(provider);

      const totalMinted = await contract.totalMinted();
      let ownedTokenIds: number[] = [];
      let ownedTrees: TreeData[] = [];

      if (wallet.address) {
        const balance = await contract.balanceOf(wallet.address);
        const ids: number[] = [];
        for (let i = 0; i < Number(balance); i++) {
          const tokenId = await contract.tokenOfOwnerByIndex(wallet.address, i);
          ids.push(Number(tokenId));
        }
        ownedTokenIds = ids;

        ownedTrees = await Promise.all(
          ids.map(async (tokenId) => {
            const treeData = await contract.trees(tokenId);
            const tokenURI = await contract.tokenURI(tokenId).catch(() => '');
            return {
              tokenId,
              species: treeData.species,
              location: treeData.location,
              planter: treeData.planter,
              plantedAt: Number(treeData.plantedAt),
              tokenURI,
            };
          })
        );
      }

      setState({
        totalMinted: Number(totalMinted),
        ownedTokenIds,
        ownedTrees,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load OxyTree data';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
    }
  }, [wallet.address]);

  useEffect(() => {
    fetchState();
    const id = setInterval(fetchState, 30_000);
    return () => clearInterval(id);
  }, [fetchState]);

  const approveForStaking = useCallback(async (tokenId: number, stakingAddress: string) => {
    const signer = await getSigner();
    const contract = await getNFTTreeContract(signer);
    const tx = await contract.approve(stakingAddress, tokenId);
    await tx.wait();
    return tx.hash;
  }, []);

  const approveAllForStaking = useCallback(async (stakingAddress: string) => {
    const signer = await getSigner();
    const contract = await getNFTTreeContract(signer);
    const tx = await contract.setApprovalForAll(stakingAddress, true);
    await tx.wait();
    return tx.hash;
  }, []);

  const isApprovedForAll = useCallback(async (owner: string, operator: string): Promise<boolean> => {
    try {
      const provider = getReadProvider();
      const contract = await getNFTTreeContract(provider);
      return await contract.isApprovedForAll(owner, operator);
    } catch {
      return false;
    }
  }, []);

  return {
    ...state,
    approveForStaking,
    approveAllForStaking,
    isApprovedForAll,
    refresh: fetchState,
  };
}
