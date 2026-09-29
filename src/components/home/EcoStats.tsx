import { useEffect, useState } from 'react';
import { TreePine, Wind, Users, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { EcosystemStats } from '../../types';

export default function EcoStats() {
  const [stats, setStats] = useState<EcosystemStats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      const { data } = await supabase
        .from('ecosystem_stats')
        .select('*')
        .maybeSingle();
      if (data) setStats(data);
    };
    fetchStats();
  }, []);

  const displayStats = [
    {
      icon: TreePine,
      value: stats?.total_trees_planted ?? 12847,
      label: 'Trees Planted',
      suffix: '',
    },
    {
      icon: Wind,
      value: stats?.total_carbon_offset_kg ?? 385410,
      label: 'CO2 Offset (kg)',
      suffix: '',
    },
    {
      icon: Users,
      value: stats?.total_stakers ?? 3241,
      label: 'Active Stakers',
      suffix: '',
    },
    {
      icon: TrendingUp,
      value: stats?.marketplace_volume_oxy ?? 8540000,
      label: 'Marketplace Volume ($OXY)',
      suffix: '',
    },
  ];

  return (
    <section className="py-20 bg-gray-900/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {displayStats.map((stat) => (
            <div
              key={stat.label}
              className="text-center p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-emerald-500/20 transition-all duration-300"
            >
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <stat.icon className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
                {stat.value.toLocaleString()}{stat.suffix}
              </div>
              <div className="text-gray-500 text-sm">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
