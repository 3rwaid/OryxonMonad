interface Props {
  badge?: string;
  title: string;
  subtitle?: string;
  centered?: boolean;
  light?: boolean;
}

export default function SectionHeading({ badge, title, subtitle, centered = true, light = true }: Props) {
  return (
    <div className={`mb-12 ${centered ? 'text-center' : ''}`}>
      {badge && (
        <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-4 ${
          light ? 'bg-forest-50 text-forest-700' : 'bg-ocean-800/60 text-ocean-300 border border-ocean-700/50'
        }`}>
          {badge}
        </span>
      )}
      <h2 className={`text-3xl sm:text-4xl font-display font-bold ${light ? 'text-gray-900' : 'text-white'}`}>
        {title}
      </h2>
      {subtitle && (
        <p className={`mt-3 text-lg max-w-2xl mx-auto leading-relaxed ${light ? 'text-gray-500' : 'text-ocean-200/70'}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
