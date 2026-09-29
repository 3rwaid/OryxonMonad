export interface NFTA {
  id: string;
  token_id: number;
  name: string;
  description: string;
  image_url: string;
  animal_type: string;
  rarity: string;
  owner_address: string;
  is_minted: boolean;
  minted_at: string | null;
  created_at: string;
}

export interface NFTB {
  id: string;
  token_id: number;
  name: string;
  description: string;
  image_url: string;
  tree_species: string;
  location_lat: number;
  location_lng: number;
  location_name: string;
  planter_name: string;
  planted_at: string;
  owner_address: string;
  price_usd: number;
  is_staked: boolean;
  staked_at: string | null;
  created_at: string;
}

export interface OxyBalance {
  id: string;
  wallet_address: string;
  balance: number;
  staking_rewards_earned: number;
  updated_at: string;
}

export interface StakingPosition {
  id: string;
  nft_b_id: string;
  staker_address: string;
  staked_at: string;
  last_claim_at: string;
  total_rewards_claimed: number;
  is_active: boolean;
  created_at: string;
  nft_b?: NFTB;
}

export interface MarketplaceListing {
  id: string;
  nft_type: 'A' | 'B';
  nft_id: string;
  seller_address: string;
  price: number;
  price_currency: string;
  is_active: boolean;
  buyer_address: string;
  sold_at: string | null;
  fee_amount: number;
  created_at: string;
  nft_a?: NFTA;
  nft_b?: NFTB;
}

export interface TokenAllocation {
  id: string;
  category: string;
  percentage: number;
  total_amount: number;
  distributed_amount: number;
  description: string;
  created_at: string;
}

export interface SalePhase {
  id: string;
  phase_name: string;
  price_eth: number;
  max_per_wallet: number;
  start_time: string;
  end_time: string;
  total_supply: number;
  minted_count: number;
  is_active: boolean;
  created_at: string;
}

export interface PlatformStats {
  id: string;
  total_nft_a_minted: number;
  total_nft_b_minted: number;
  total_oxy_distributed: number;
  total_trees_planted: number;
  total_staked_nft_b: number;
  staking_reward_pool: number;
  marketplace_fee_pool: number;
  updated_at: string;
}

export interface WalletState {
  address: string;
  isConnected: boolean;
  balance: number;
  oxyBalance: number;
}
