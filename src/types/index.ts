export interface NFTAItem {
  id: string;
  token_id: number;
  name: string;
  description: string;
  image_url: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  owner_wallet: string | null;
  mint_price_eth: number;
  is_minted: boolean;
  minted_at: string | null;
  created_at: string;
}

export interface NFTBItem {
  id: string;
  token_id: number;
  tree_species: string;
  tree_location: string;
  planter_name: string;
  planting_date: string;
  image_url: string;
  owner_wallet: string | null;
  mint_price_usd: number;
  is_staked: boolean;
  staked_at: string | null;
  carbon_offset_kg: number;
  created_at: string;
}

export interface OxyTokenInfo {
  id: string;
  total_supply: number;
  max_supply: number;
  circulating_supply: number;
  staking_pool_remaining: number;
  ido_allocation: number;
  liquidity_allocation: number;
  staking_allocation: number;
  updated_at: string;
}

export interface StakingPosition {
  id: string;
  nft_b_id: string;
  owner_wallet: string;
  staked_at: string;
  last_claimed_at: string;
  total_rewards_claimed: number;
  is_active: boolean;
  created_at: string;
}

export interface MarketplaceListing {
  id: string;
  nft_type: 'A' | 'B';
  nft_id: string;
  seller_wallet: string;
  price_oxy: number;
  price_eth: number;
  is_active: boolean;
  buyer_wallet: string | null;
  sold_at: string | null;
  platform_fee_oxy: number;
  created_at: string;
}

export interface EcosystemStats {
  id: string;
  total_trees_planted: number;
  total_carbon_offset_kg: number;
  total_nft_a_minted: number;
  total_nft_b_minted: number;
  total_oxy_distributed: number;
  total_stakers: number;
  marketplace_volume_oxy: number;
  updated_at: string;
}
