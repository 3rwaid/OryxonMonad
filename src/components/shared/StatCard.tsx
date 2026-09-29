import type { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  label: string;
  value: string;
  subtext?: string;
  color?: string;
}

export default function StatCard({ icon, label, value, subtext, color = 'forest' }: Props) {
  const colorMap: Record<string, string> = {
    forest: 'bg-forest-50 text-forest-600',
    gold: 'bg-gold-50 text-gold-600',
    ocean: 'bg-ocean-50 text-ocean-600',
    earth: 'bg-earth-50 text-earth-600',
  };

  return (
    <div className="stat-card group">
      <div className={`w-12 h-12 rounded-xl ${colorMap[color]} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-display font-bold text-gray-900">{value}</p>
      {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
    </div>
  );
}
