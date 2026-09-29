import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface AppSettings {
  tree_price_usd: number;
  tree_price_oxy: number;
  oxy_receiver_wallet: string;
  max_order_quantity: number;
}

const DEFAULTS: AppSettings = {
  tree_price_usd: 25,
  tree_price_oxy: 500,
  oxy_receiver_wallet: '',
  max_order_quantity: 10,
};

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: resp, error: err } = await supabase.functions.invoke('get-public-data', {
        body: { resource: 'app_settings' },
      });
      if (err) throw new Error(err.message);

      const rows: Array<{ key: string; value: string }> = resp?.data ?? [];
      const map: Record<string, string> = {};
      for (const row of rows) map[row.key] = row.value;

      setSettings({
        tree_price_usd: map.tree_price_usd ? parseFloat(map.tree_price_usd) : DEFAULTS.tree_price_usd,
        tree_price_oxy: map.tree_price_oxy ? parseFloat(map.tree_price_oxy) : DEFAULTS.tree_price_oxy,
        oxy_receiver_wallet: map.oxy_receiver_wallet ?? DEFAULTS.oxy_receiver_wallet,
        max_order_quantity: map.max_order_quantity ? parseInt(map.max_order_quantity) : DEFAULTS.max_order_quantity,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const updateSetting = useCallback(async (key: keyof AppSettings, value: string) => {
    const { error: err } = await supabase
      .from('app_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (err) throw new Error(err.message);
    await fetch();
  }, [fetch]);

  return { settings, isLoading, error, refresh: fetch, updateSetting };
}
