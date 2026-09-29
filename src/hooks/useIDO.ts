import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getSigner, getOxyTokenContract, CONTRACT_ADDRESSES, formatOxy, parseOxy } from '../lib/contracts';
import { BrowserProvider, parseEther, formatEther } from 'ethers';

export interface IDOPhase {
  id: string;
  phase_name: string;
  price_per_oxy: number;   // MON per 1 OXY
  hard_cap_oxy: number;
  sold_oxy: number;
  min_buy_oxy: number;
  max_buy_oxy: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface IDOPurchase {
  phase_id: string;
  buyer_wallet: string;
  oxy_amount: number;
  tcore_amount: number;
  tx_hash: string;
  status: 'pending' | 'confirmed' | 'refunded';
}

export function useIDO() {
  const [phases, setPhases] = useState<IDOPhase[]>([]);
  const [activePhase, setActivePhase] = useState<IDOPhase | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPhases = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: resp } = await supabase.functions.invoke('get-public-data', {
        body: { resource: 'ido_phases' },
      });
      const list = (resp?.data ?? []) as IDOPhase[];
      setPhases(list);
      const now = new Date().toISOString();
      setActivePhase(
        list.find(
          (p) => p.is_active && p.start_time <= now && p.end_time >= now,
        ) ?? list.find((p) => p.is_active) ?? null,
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchPhases(); }, [fetchPhases]);

  // Record a purchase in Supabase (call after on-chain tx confirmed)
  const recordPurchase = useCallback(async (purchase: IDOPurchase) => {
    const { error } = await supabase.from('ido_purchases').insert([purchase]);
    if (error) throw new Error(error.message);
    // Optimistically update sold_oxy
    await supabase
      .from('ido_phases')
      .update({ sold_oxy: (activePhase?.sold_oxy ?? 0) + purchase.oxy_amount })
      .eq('id', purchase.phase_id);
    await fetchPhases();
  }, [activePhase, fetchPhases]);

  return { phases, activePhase, isLoading, refresh: fetchPhases, recordPurchase };
}
