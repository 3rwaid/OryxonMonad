import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface ExchangeLink {
  id: string;
  name: string;
  type: 'dex' | 'cex';
  url: string;
  logo_url: string | null;
  pair: string;
  is_active: boolean;
  sort_order: number;
}

export function useExchangeLinks() {
  const [links, setLinks] = useState<ExchangeLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: resp } = await supabase.functions.invoke('get-public-data', {
        body: { resource: 'exchange_links' },
      });
      setLinks((resp?.data ?? []) as ExchangeLink[]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const upsert = useCallback(async (link: Partial<ExchangeLink> & { id?: string }) => {
    if (link.id) {
      const { error } = await supabase.from('exchange_links').update(link).eq('id', link.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from('exchange_links').insert([link]);
      if (error) throw new Error(error.message);
    }
    await fetch();
  }, [fetch]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('exchange_links').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await fetch();
  }, [fetch]);

  const toggleActive = useCallback(async (id: string, is_active: boolean) => {
    const { error } = await supabase.from('exchange_links').update({ is_active }).eq('id', id);
    if (error) throw new Error(error.message);
    await fetch();
  }, [fetch]);

  return { links, isLoading, refresh: fetch, upsert, remove, toggleActive };
}
