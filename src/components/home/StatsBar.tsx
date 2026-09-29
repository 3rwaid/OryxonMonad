import { useEffect, useState } from 'react';
import { TreePine, Wind, Users, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { EcosystemStats } from '../../types';

export default function StatsBar() {
  const [stats, setStats] = useState<EcosystemStats | null>(null);

  useEffect(() => {
    async function fetchStats() {
      const { data } = await supabase
        .from('ecosystem_stats')
        .select('*')
        .maybeSingle();
      if (data) setStats(data);
    }
    fetchStats();
  }, []);

  const items = [
    {
      icon: TreePine,
      value: stats?.total_trees_planted?.toLocaleString() ?? '0',
      label: 'Trees Planted',
    },
    {
      icon: Wind,
      value: `${(stats?.total_carbon_offset_kg ?? 0).toLocaleString()} kg`,
      label: 'CO2 Offset',
    },
    {
      icon: Users,
      value: stats?.total_stakers?.toLocaleString() ?? '0',
      label: 'Active Stakers',
    },
    {
      icon: TrendingUp,
      value: `${((stats?.total_oxy_distributed ?? 0) / 1e6).toFixed(1)}M`,
      label: '$OXY Distributed',
    },
  ];

  return (
    <section className="py-16 bg-gray-900/50 border-y border-emerald-900/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <item.icon className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-white font-bold text-xl">{item.value}</p>
                <p className="text-gray-500 text-xs">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
