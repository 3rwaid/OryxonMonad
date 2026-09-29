import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../lib/wallet-context';
import {
  getSigner,
  getReadProvider,
  getOxyTokenContract,
  formatOxy,
  parseOxy,
} from '../lib/contracts';

interface OxyTokenState {
  balance: string;
  totalSupply: string;
  decimals: number;
  isLoading: boolean;
  error: string | null;
}

export function useOxyToken() {
  const { wallet } = useWallet();
  const [state, setState] = useState<OxyTokenState>({
    balance: '0',
    totalSupply: '0',
    decimals: 18,
    isLoading: false,
    error: null,
  });

  const fetchState = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const provider = getReadProvider();
      const contract = await getOxyTokenContract(provider);

      const [totalSupply, decimals] = await Promise.all([
        contract.totalSupply(),
        contract.decimals(),
      ]);

      let balance = '0';
      if (wallet.address) {
        const raw = await contract.balanceOf(wallet.address);
        balance = formatOxy(raw);
      }

      setState({
        balance,
        totalSupply: formatOxy(totalSupply),
        decimals: Number(decimals),
        isLoading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load OXY token data';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
    }
  }, [wallet.address]);

  useEffect(() => {
    fetchState();
    const id = setInterval(fetchState, 30_000);
    return () => clearInterval(id);
  }, [fetchState]);

  const getAllowance = useCallback(async (spender: string): Promise<string> => {
    if (!wallet.address) return '0';
    try {
      const provider = getReadProvider();
      const contract = await getOxyTokenContract(provider);
      const allowance = await contract.allowance(wallet.address, spender);
      return formatOxy(allowance);
    } catch {
      return '0';
    }
  }, [wallet.address]);

  const approve = useCallback(async (spender: string, amount: string): Promise<string> => {
    const signer = await getSigner();
    const contract = await getOxyTokenContract(signer);
    const parsedAmount = parseOxy(amount);
    const tx = await contract.approve(spender, parsedAmount);
    await tx.wait();
    await fetchState();
    return tx.hash;
  }, [fetchState]);

  const approveMax = useCallback(async (spender: string): Promise<string> => {
    const signer = await getSigner();
    const contract = await getOxyTokenContract(signer);
    const maxUint = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    const tx = await contract.approve(spender, maxUint);
    await tx.wait();
    await fetchState();
    return tx.hash;
  }, [fetchState]);

  const transfer = useCallback(async (to: string, amount: string): Promise<string> => {
    const signer = await getSigner();
    const contract = await getOxyTokenContract(signer);
    const tx = await contract.transfer(to, parseOxy(amount));
    await tx.wait();
    await fetchState();
    return tx.hash;
  }, [fetchState]);

  return {
    ...state,
    getAllowance,
    approve,
    approveMax,
    transfer,
    refresh: fetchState,
  };
}
