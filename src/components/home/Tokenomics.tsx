import { OXY_MAX_SUPPLY } from '../../lib/constants';

const allocations = [
  { label: 'Staking Rewards', percent: 80, color: 'bg-emerald-500', description: 'Distributed to NFT B stakers over time' },
  { label: 'IDO (Initial DEX Offering)', percent: 10, color: 'bg-teal-500', description: 'Public token sale to fund development' },
  { label: 'Liquidity Pool', percent: 10, color: 'bg-cyan-500', description: 'DEX liquidity for trading' },
];

export default function Tokenomics() {
  return (
    <section className="py-24 bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            $OXY Tokenomics
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto text-lg">
            A carefully designed token economy with a maximum supply of{' '}
            <span className="text-emerald-400 font-semibold">
              {OXY_MAX_SUPPLY.toLocaleString()} $OXY
            </span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="relative flex items-center justify-center">
            <div className="relative w-72 h-72 sm:w-80 sm:h-80">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgb(31,41,55)" strokeWidth="12" />
                <circle
                  cx="50" cy="50" r="40"
                  fill="none" stroke="rgb(16,185,129)" strokeWidth="12"
                  strokeDasharray={`${80 * 2.51} ${(100 - 80) * 2.51}`}
                  strokeDashoffset="0"
                  className="transition-all duration-1000"
                />
                <circle
                  cx="50" cy="50" r="40"
                  fill="none" stroke="rgb(20,184,166)" strokeWidth="12"
                  strokeDasharray={`${10 * 2.51} ${(100 - 10) * 2.51}`}
                  strokeDashoffset={`${-80 * 2.51}`}
                  className="transition-all duration-1000"
                />
                <circle
                  cx="50" cy="50" r="40"
                  fill="none" stroke="rgb(6,182,212)" strokeWidth="12"
                  strokeDasharray={`${10 * 2.51} ${(100 - 10) * 2.51}`}
                  strokeDashoffset={`${-90 * 2.51}`}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-white">2.1B</span>
                <span className="text-gray-400 text-sm">Max Supply</span>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {allocations.map((item) => (
              <div
                key={item.label}
                className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-emerald-500/20 transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${item.color}`} />
                    <span className="text-white font-semibold">{item.label}</span>
                  </div>
                  <span className="text-emerald-400 font-bold text-lg">{item.percent}%</span>
                </div>
                <p className="text-gray-500 text-sm">{item.description}</p>
                <div className="mt-3 h-2 rounded-full bg-gray-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${item.color} transition-all duration-1000`}
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
