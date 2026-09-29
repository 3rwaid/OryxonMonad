export const SITE_NAME = 'Oryxon';
export const SITE_TAGLINE = 'Sustainable Economy on the Blockchain';

export const NFT_A_MAX_SUPPLY = 1000;
export const NFT_A_MINT_PRICE = 0.01;
export const OXY_MAX_SUPPLY = 2_100_000_000;
export const OXY_IDO_PERCENT = 10;
export const OXY_LIQUIDITY_PERCENT = 10;
export const OXY_STAKING_PERCENT = 80;

export const STAKING_REWARD_RATE_BPS = 10;
export const STAKING_CLAIM_INTERVAL_HOURS = 24;
export const MARKETPLACE_FEE_BPS = 250;

export const ANIMAL_RARITIES = ['Common', 'Rare', 'Epic', 'Legendary'] as const;

export const TREE_SPECIES = [
  'Mahogany', 'Teak', 'Oak', 'Pine', 'Bamboo',
  'Mangrove', 'Eucalyptus', 'Banyan', 'Cedar', 'Maple'
] as const;

export const NAV_ITEMS = [
  { label: 'Home', key: 'home' },
  { label: 'Oryx Warrior', key: 'nft-a' },
  { label: 'OxyTree', key: 'nft-b' },
  { label: '$OXY Token', key: 'oxy-token' },
  { label: 'Staking', key: 'staking' },
  { label: 'Marketplace', key: 'marketplace' },
  { label: 'Dashboard', key: 'dashboard' },
] as const;

export type PageKey = typeof NAV_ITEMS[number]['key'];
