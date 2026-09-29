import { ArrowDown, Sparkles, TreePine, Coins, BarChart3 } from 'lucide-react';

export default function EcosystemFlow() {
  const steps = [
    {
      icon: Sparkles,
      title: 'Mint Genesis Oryx NFT',
      desc: 'Acquire one of 1,000 rare animal character NFTs for 0.01 ETH. Proceeds fund tree planting and ecosystem development.',
      color: 'emerald',
    },
    {
      icon: TreePine,
      title: 'Real Trees Planted (NFT B)',
      desc: 'Funds from NFT A sales are used to plant real trees. Each tree is represented as an NFT B with verifiable on-chain data.',
      color: 'teal',
    },
    {
      icon: Coins,
      title: 'Earn $OXY Rewards',
      desc: 'Stake your NFT B to earn $OXY tokens daily. Reward formula: (1/total staked) * 0.1% * available staking pool.',
      color: 'green',
    },
    {
      icon: BarChart3,
      title: 'Trade & Grow',
      desc: 'Use $OXY to buy more Tree NFTs at a discount, stake for additional rewards, or trade on the marketplace.',
      color: 'cyan',
    },
  ];

  const colorMap: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    emerald: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
      glow: 'shadow-emerald-500/20',
    },
    teal: {
      bg: 'bg-teal-500/10',
      border: 'border-teal-500/30',
      text: 'text-teal-400',
      glow: 'shadow-teal-500/20',
    },
    green: {
      bg: 'bg-green-500/10',
      border: 'border-green-500/30',
      text: 'text-green-400',
      glow: 'shadow-green-500/20',
    },
    cyan: {
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/30',
      text: 'text-cyan-400',
      glow: 'shadow-cyan-500/20',
    },
  };

  return (
    <section className="py-24 bg-gray-950 relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            How the <span className="text-emerald-400">Ecosystem</span> Works
          </h2>
          <p className="mt-4 text-gray-500 max-w-xl mx-auto">
            A circular economy where digital assets drive real-world environmental impact
          </p>
        </div>

        <div className="space-y-4">
          {steps.map((step, idx) => {
            const colors = colorMap[step.color];
            return (
              <div key={step.title}>
                <div className={`relative p-6 sm:p-8 rounded-2xl ${colors.bg} border ${colors.border} hover:shadow-lg ${colors.glow} transition-all duration-300`}>
                  <div className="flex items-start gap-5">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center`}>
                      <step.icon className={`w-6 h-6 ${colors.text}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`text-xs font-bold ${colors.text} uppercase tracking-wider`}>
                          Step {idx + 1}
                        </span>
                      </div>
                      <h3 className="text-white font-semibold text-xl">{step.title}</h3>
                      <p className="text-gray-400 mt-2 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                </div>
                {idx < steps.length - 1 && (
                  <div className="flex justify-center py-2">
                    <ArrowDown className="w-5 h-5 text-gray-700" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
