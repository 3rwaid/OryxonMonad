import { BrowserProvider, JsonRpcProvider, Contract, parseEther, formatEther, formatUnits, parseUnits } from 'ethers';
import type { Signer } from 'ethers';

const MONAD_RPC_URL = 'https://testnet-rpc.monad.xyz';

let wagmiProvider: Eip1193Provider | null = null;

export function setWagmiProvider(provider: Eip1193Provider | null) {
  wagmiProvider = provider;
}

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
}

import NFTAnimalABI from './abi/abi_NFTAnimal.json';
import NFTTreeABI from './abi/abi_NFTTree.json';
import OxyTokenABI from './abi/abi_OxyToken.json';
import StakingPoolABI from './abi/abi_StakingPool.json';
import MarketplaceABI from './abi/abi_OxyMarketplace.json';
import OxyDEXABI from './abi/abi_OxyDEX.json';
import IDOVestingABI from './abi/abi_IDOVesting.json';

export const MONAD_TESTNET_CHAIN_ID = 10143;

export const CONTRACT_ADDRESSES = {
  OXY_TOKEN: import.meta.env.VITE_OXY_TOKEN_ADDRESS as string,
  NFT_ANIMAL: import.meta.env.VITE_NFT_ANIMAL_ADDRESS as string,
  NFT_TREE: import.meta.env.VITE_NFT_TREE_ADDRESS as string,
  STAKING_POOL: import.meta.env.VITE_STAKING_POOL_ADDRESS as string,
  MARKETPLACE: import.meta.env.VITE_MARKETPLACE_ADDRESS as string,
  OXY_DEX: import.meta.env.VITE_OXY_DEX_ADDRESS as string,
  IDO_VESTING: '0xa5BB12B9808Ab034D75aa457066C2f082E345b45',
} as const;

export function getReadProvider(): JsonRpcProvider {
  return new JsonRpcProvider(MONAD_RPC_URL);
}

export function getProvider(): BrowserProvider {
  const p = wagmiProvider ?? window.ethereum;
  if (!p) throw new Error('No wallet detected. Please install MetaMask.');
  return new BrowserProvider(p);
}

export async function getSigner(): Promise<Signer> {
  const p = wagmiProvider ?? window.ethereum;
  if (!p) throw new Error('No wallet detected. Please install MetaMask.');
  const provider = new BrowserProvider(p);

  // Race getNetwork against a timeout so we never hang forever
  const network = await Promise.race([
    provider.getNetwork(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Wallet not responding. Please unlock your wallet and try again.')), 15000),
    ),
  ]);
  if (Number(network.chainId) !== MONAD_TESTNET_CHAIN_ID) {
    // Try to switch automatically
    try {
      await p.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x279F' }], // 10143 in hex
      });
      // Re-check after switch
      const network2 = await provider.getNetwork();
      if (Number(network2.chainId) !== MONAD_TESTNET_CHAIN_ID) {
        throw new Error(`wrong_network:${Number(network2.chainId)}`);
      }
    } catch {
      throw new Error(`wrong_network:${Number(network.chainId)}`);
    }
  }
  return provider.getSigner();
}

export async function getCheckedProvider(): Promise<BrowserProvider> {
  const provider = getProvider();
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== MONAD_TESTNET_CHAIN_ID) {
    throw new Error(`wrong_network:${Number(network.chainId)}`);
  }
  return provider;
}

export async function getNFTAnimalContract(signerOrProvider?: Signer | BrowserProvider) {
  const sp = signerOrProvider ?? getProvider();
  return new Contract(CONTRACT_ADDRESSES.NFT_ANIMAL, NFTAnimalABI, sp);
}

export async function getNFTTreeContract(signerOrProvider?: Signer | BrowserProvider) {
  const sp = signerOrProvider ?? getProvider();
  return new Contract(CONTRACT_ADDRESSES.NFT_TREE, NFTTreeABI, sp);
}

export async function getOxyTokenContract(signerOrProvider?: Signer | BrowserProvider) {
  const sp = signerOrProvider ?? getProvider();
  return new Contract(CONTRACT_ADDRESSES.OXY_TOKEN, OxyTokenABI, sp);
}

export async function getStakingPoolContract(signerOrProvider?: Signer | BrowserProvider) {
  const sp = signerOrProvider ?? getProvider();
  return new Contract(CONTRACT_ADDRESSES.STAKING_POOL, StakingPoolABI, sp);
}

export async function getMarketplaceContract(signerOrProvider?: Signer | BrowserProvider) {
  const sp = signerOrProvider ?? getProvider();
  return new Contract(CONTRACT_ADDRESSES.MARKETPLACE, MarketplaceABI, sp);
}

export async function getOxyDEXContract(signerOrProvider?: Signer | BrowserProvider) {
  const sp = signerOrProvider ?? getProvider();
  return new Contract(CONTRACT_ADDRESSES.OXY_DEX, OxyDEXABI, sp);
}

export async function getIDOVestingContract(signerOrProvider?: Signer | BrowserProvider) {
  const sp = signerOrProvider ?? getReadProvider();
  return new Contract(CONTRACT_ADDRESSES.IDO_VESTING, IDOVestingABI, sp);
}

export { parseEther, formatEther, formatUnits, parseUnits };

export function formatOxy(value: bigint): string {
  return formatUnits(value, 18);
}

export function parseOxy(value: string): bigint {
  return parseUnits(value, 18);
}

export function shortenTxHash(hash: string): string {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

export function getExplorerTxUrl(txHash: string): string {
  return `https://testnet.monadexplorer.com/tx/${txHash}`;
}

export function getExplorerAddressUrl(address: string): string {
  return `https://testnet.monadexplorer.com/address/${address}`;
}
