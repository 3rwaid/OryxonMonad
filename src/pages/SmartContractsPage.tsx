import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Code2, ChevronRight, Copy, Check, ExternalLink,
  Award, TreePine, Coins, BarChart3, ShoppingBag, Droplets,
} from 'lucide-react';
import { CONTRACT_ADDRESSES, getExplorerAddressUrl } from '../lib/contracts';
import { useI18n } from '../lib/i18n';

interface ContractFunction {
  name: string;
  sig: string;
  descKey: string;
  type: 'read' | 'write';
}

interface ContractInfo {
  key: keyof typeof CONTRACT_ADDRESSES;
  name: string;
  symbol: string;
  standard: string;
  icon: React.ReactNode;
  color: string;
  descKey: string;
  functions: ContractFunction[];
}

const CONTRACTS: ContractInfo[] = [
  {
    key: 'NFT_ANIMAL',
    name: 'Oryx Warrior',
    symbol: 'NFTA',
    standard: 'ERC-721',
    icon: <Award className="w-5 h-5" />,
    color: 'gold',
    descKey: 'sc.c.warrior.desc',
    functions: [
      { name: 'mint', sig: 'mint(uint256 quantity)', descKey: 'sc.c.warrior.mint', type: 'write' },
      { name: 'totalMinted', sig: 'totalMinted() → uint256', descKey: 'sc.c.warrior.totalMinted', type: 'read' },
      { name: 'MAX_SUPPLY', sig: 'MAX_SUPPLY() → uint256', descKey: 'sc.c.warrior.maxSupply', type: 'read' },
      { name: 'MINT_PRICE', sig: 'MINT_PRICE() → uint256', descKey: 'sc.c.warrior.mintPrice', type: 'read' },
      { name: 'mintedPerWallet', sig: 'mintedPerWallet(address) → uint256', descKey: 'sc.c.warrior.mintedPerWallet', type: 'read' },
      { name: 'tokenURI', sig: 'tokenURI(uint256 tokenId) → string', descKey: 'sc.c.warrior.tokenURI', type: 'read' },
      { name: 'presaleWhitelist', sig: 'presaleWhitelist(address) → bool', descKey: 'sc.c.warrior.whitelist', type: 'read' },
      { name: 'currentPhase', sig: 'currentPhase() → uint8', descKey: 'sc.c.warrior.currentPhase', type: 'read' },
    ],
  },
  {
    key: 'NFT_TREE',
    name: 'OxyTree',
    symbol: 'NFTB',
    standard: 'ERC-721',
    icon: <TreePine className="w-5 h-5" />,
    color: 'forest',
    descKey: 'sc.c.tree.desc',
    functions: [
      { name: 'trees', sig: 'trees(uint256 tokenId) → Tree', descKey: 'sc.c.tree.trees', type: 'read' },
      { name: 'totalMinted', sig: 'totalMinted() → uint256', descKey: 'sc.c.tree.totalMinted', type: 'read' },
      { name: 'tokenURI', sig: 'tokenURI(uint256 tokenId) → string', descKey: 'sc.c.tree.tokenURI', type: 'read' },
      { name: 'balanceOf', sig: 'balanceOf(address owner) → uint256', descKey: 'sc.c.tree.balanceOf', type: 'read' },
      { name: 'tokenOfOwnerByIndex', sig: 'tokenOfOwnerByIndex(address owner, uint256 index) → uint256', descKey: 'sc.c.tree.tokenOfOwnerByIndex', type: 'read' },
      { name: 'setApprovalForAll', sig: 'setApprovalForAll(address operator, bool approved)', descKey: 'sc.c.tree.setApprovalForAll', type: 'write' },
    ],
  },
  {
    key: 'OXY_TOKEN',
    name: 'OXY Token',
    symbol: 'OXY',
    standard: 'ERC-20',
    icon: <Coins className="w-5 h-5" />,
    color: 'ocean',
    descKey: 'sc.c.oxy.desc',
    functions: [
      { name: 'totalSupply', sig: 'totalSupply() → uint256', descKey: 'sc.c.oxy.totalSupply', type: 'read' },
      { name: 'balanceOf', sig: 'balanceOf(address account) → uint256', descKey: 'sc.c.oxy.balanceOf', type: 'read' },
      { name: 'transfer', sig: 'transfer(address to, uint256 amount) → bool', descKey: 'sc.c.oxy.transfer', type: 'write' },
      { name: 'approve', sig: 'approve(address spender, uint256 amount) → bool', descKey: 'sc.c.oxy.approve', type: 'write' },
      { name: 'allowance', sig: 'allowance(address owner, address spender) → uint256', descKey: 'sc.c.oxy.allowance', type: 'read' },
    ],
  },
  {
    key: 'STAKING_POOL',
    name: 'Staking Pool',
    symbol: '—',
    standard: 'Custom',
    icon: <BarChart3 className="w-5 h-5" />,
    color: 'earth',
    descKey: 'sc.c.staking.desc',
    functions: [
      { name: 'stake', sig: 'stake(uint256 tokenId)', descKey: 'sc.c.staking.stake', type: 'write' },
      { name: 'unstake', sig: 'unstake(uint256 tokenId)', descKey: 'sc.c.staking.unstake', type: 'write' },
      { name: 'claimRewards', sig: 'claimRewards(uint256 tokenId)', descKey: 'sc.c.staking.claimRewards', type: 'write' },
      { name: 'claimAll', sig: 'claimAll()', descKey: 'sc.c.staking.claimAll', type: 'write' },
      { name: 'getUserStakedTokens', sig: 'getUserStakedTokens(address user) → uint256[]', descKey: 'sc.c.staking.getUserStakedTokens', type: 'read' },
      { name: 'calculateReward', sig: 'calculateReward(uint256 tokenId) → uint256', descKey: 'sc.c.staking.calculateReward', type: 'read' },
      { name: 'getPendingRewards', sig: 'getPendingRewards(address user) → uint256', descKey: 'sc.c.staking.getPendingRewards', type: 'read' },
      { name: 'totalStaked', sig: 'totalStaked() → uint256', descKey: 'sc.c.staking.totalStaked', type: 'read' },
    ],
  },
  {
    key: 'MARKETPLACE',
    name: 'Marketplace',
    symbol: '—',
    standard: 'Custom',
    icon: <ShoppingBag className="w-5 h-5" />,
    color: 'gray',
    descKey: 'sc.c.market.desc',
    functions: [
      { name: 'listOryxWarrior', sig: 'listOryxWarrior(uint256 tokenId, uint256 priceOxy)', descKey: 'sc.c.market.listNFTA', type: 'write' },
      { name: 'listOxyTree', sig: 'listOxyTree(uint256 tokenId, uint256 priceOxy)', descKey: 'sc.c.market.listNFTB', type: 'write' },
      { name: 'buy', sig: 'buy(uint256 listingId)', descKey: 'sc.c.market.buy', type: 'write' },
      { name: 'cancelListing', sig: 'cancelListing(uint256 listingId)', descKey: 'sc.c.market.cancelListing', type: 'write' },
      { name: 'getActiveListing', sig: 'getActiveListing(uint256 id) → Listing', descKey: 'sc.c.market.getActiveListing', type: 'read' },
      { name: 'listingCounter', sig: 'listingCounter() → uint256', descKey: 'sc.c.market.listingCounter', type: 'read' },
      { name: 'platformFeeBps', sig: 'platformFeeBps() → uint256', descKey: 'sc.c.market.platformFeeBps', type: 'read' },
    ],
  },
  {
    key: 'OXY_DEX',
    name: 'OxyDEX',
    symbol: 'OXY-LP',
    standard: 'AMM',
    icon: <Droplets className="w-5 h-5" />,
    color: 'ocean',
    descKey: 'sc.c.dex.desc',
    functions: [
      { name: 'swapMonForOxy', sig: 'swapMonForOxy(uint256 minOxyOut, uint256 deadline) payable', descKey: 'sc.c.dex.swapMonForOxy', type: 'write' },
      { name: 'swapOxyForMon', sig: 'swapOxyForMon(uint256 oxyIn, uint256 minMonOut, uint256 deadline)', descKey: 'sc.c.dex.swapOxyForMon', type: 'write' },
      { name: 'addLiquidity', sig: 'addLiquidity(uint256 oxyDesired, uint256 oxyMin, uint256 monMin, uint256 deadline) payable', descKey: 'sc.c.dex.addLiquidity', type: 'write' },
      { name: 'removeLiquidity', sig: 'removeLiquidity(uint256 lpAmount, uint256 oxyMin, uint256 monMin, uint256 deadline)', descKey: 'sc.c.dex.removeLiquidity', type: 'write' },
      { name: 'claimReward', sig: 'claimReward()', descKey: 'sc.c.dex.claimReward', type: 'write' },
      { name: 'getOxyOut', sig: 'getOxyOut(uint256 monIn) → uint256', descKey: 'sc.c.dex.getOxyOut', type: 'read' },
      { name: 'getMonOut', sig: 'getMonOut(uint256 oxyIn) → uint256', descKey: 'sc.c.dex.getMonOut', type: 'read' },
      { name: 'reserveOxy', sig: 'reserveOxy() → uint256', descKey: 'sc.c.dex.reserveOxy', type: 'read' },
      { name: 'reserveMon', sig: 'reserveMon() → uint256', descKey: 'sc.c.dex.reserveMon', type: 'read' },
      { name: 'poolShare', sig: 'poolShare(address) → uint256', descKey: 'sc.c.dex.poolShare', type: 'read' },
    ],
  },
];

const colorMap: Record<string, string> = {
  gold: 'bg-gold-50 border-gold-200 text-gold-700',
  forest: 'bg-forest-50 border-forest-200 text-forest-700',
  ocean: 'bg-ocean-50 border-ocean-200 text-ocean-700',
  earth: 'bg-earth-50 border-earth-200 text-earth-700',
  gray: 'bg-gray-100 border-gray-200 text-gray-600',
};

const iconBg: Record<string, string> = {
  gold: 'bg-gold-100 text-gold-600',
  forest: 'bg-forest-100 text-forest-600',
  ocean: 'bg-ocean-100 text-ocean-600',
  earth: 'bg-earth-100 text-earth-600',
  gray: 'bg-gray-100 text-gray-600',
};

function CopyButton({ text }: { text: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0" title={t('header.copyAddress')}>
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function SmartContractsPage() {
  const { t } = useI18n();
  const [activeContract, setActiveContract] = useState<string>('NFT_ANIMAL');
  const active = CONTRACTS.find(c => c.key === activeContract) ?? CONTRACTS[0];
  const address = CONTRACT_ADDRESSES[active.key] ?? '';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-gray-900 to-gray-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-4">
            <Link to="/" className="hover:text-gray-200 transition-colors">{t('nav.home')}</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-200">{t('sc.breadcrumb')}</span>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Code2 className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold">{t('sc.title')}</h1>
              <p className="text-gray-400 text-sm mt-0.5">{t('sc.subtitle')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {CONTRACTS.map(c => (
            <button
              key={c.key}
              onClick={() => setActiveContract(c.key)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                activeContract === c.key
                  ? `${colorMap[c.color]} shadow-md`
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                activeContract === c.key ? iconBg[c.color] : 'bg-gray-100 text-gray-500'
              }`}>
                {c.icon}
              </div>
              <span className="text-xs font-semibold text-center leading-tight">{c.name}</span>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className={`px-6 py-5 border-b border-gray-100 ${colorMap[active.color]} bg-opacity-30`}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg[active.color]}`}>
                  {active.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-display font-bold text-gray-900">{active.name}</h2>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${colorMap[active.color]}`}>
                      {active.standard}
                    </span>
                    {active.symbol !== '—' && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 border border-gray-200 text-gray-600">
                        {active.symbol}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm mt-1">{t(active.descKey)}</p>
                </div>
              </div>
            </div>

            {address && (
              <div className="mt-4 flex items-center gap-2 bg-white/70 backdrop-blur-sm border border-white/60 rounded-xl px-4 py-2.5">
                <span className="text-xs text-gray-400 font-medium flex-shrink-0">{t('sc.contractAddress')}</span>
                <span className="font-mono text-sm text-gray-800 truncate flex-1">{address}</span>
                <CopyButton text={address} />
                <a
                  href={getExplorerAddressUrl(address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>

          <div className="p-6">
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">{t('sc.contractFunctions')}</p>
            <div className="space-y-2">
              {active.functions.map(fn => (
                <div key={fn.name} className="flex flex-col sm:flex-row sm:items-start gap-3 p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all">
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      fn.type === 'read'
                        ? 'bg-blue-50 text-blue-600 border border-blue-200'
                        : 'bg-orange-50 text-orange-600 border border-orange-200'
                    }`}>
                      {fn.type}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm text-gray-900 font-semibold">{fn.name}</p>
                    <p className="font-mono text-xs text-gray-400 mt-0.5 break-all">{fn.sig}</p>
                    <p className="text-sm text-gray-500 mt-1.5">{t(fn.descKey)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p className="font-semibold text-emerald-800 text-sm">{t('sc.network')}</p>
              <div className="flex flex-wrap gap-4 mt-2">
                {[
                  ['Chain ID', '10143'],
                  ['RPC', 'https://testnet-rpc.monad.xyz'],
                  ['Explorer', 'https://testnet.monadexplorer.com'],
                  ['Currency', 'MON'],
                ].map(([k, v]) => (
                  <span key={k} className="text-xs text-emerald-600">
                    <span className="font-semibold">{k}: </span>{v}
                  </span>
                ))}
              </div>
            </div>
            <a
              href="https://testnet.monadexplorer.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors flex-shrink-0"
            >
              <ExternalLink className="w-4 h-4" />
              {t('sc.blockExplorer')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
