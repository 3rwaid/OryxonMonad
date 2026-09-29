import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../lib/wallet-context';
import { useChainId, useSwitchChain } from 'wagmi';
import { monadTestnet } from '../lib/wagmi-config';
import {
  getSigner,
  getReadProvider,
  getNFTAnimalContract,
  getExplorerTxUrl,
  MONAD_TESTNET_CHAIN_ID,
} from '../lib/contracts';

export interface AnimalMetadata {
  tokenId: number;
  name: string;
  image: string;
  description: string;
  attributes: Array<{ trait_type: string; value: string | number }>;
  rarity: string;
  animalType: string;
}

interface NFTAnimalState {
  totalMinted: number;
  maxSupply: number;
  mintPrice: string;
  mintedByWallet: number;
  maxPerWallet: number;
  currentPhase: number;
  isWhitelisted: boolean;
  isLoading: boolean;
  error: string | null;
}

interface MintResult {
  txHash: string;
  explorerUrl: string;
}

const DEFAULT_STATE: NFTAnimalState = {
  totalMinted: 0,
  maxSupply: 1000,
  mintPrice: '0.01',
  mintedByWallet: 0,
  maxPerWallet: 5,
  currentPhase: 1,
  isWhitelisted: false,
  isLoading: false,
  error: null,
};

const ANIMAL_TYPES = ['Tiger', 'Eagle', 'Dolphin', 'Panda', 'Wolf', 'Fox', 'Owl', 'Bear', 'Lion', 'Deer'];

const IPFS_GATEWAYS = [
  'https://dweb.link/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
];

function extractIpfsPath(uri: string): string | null {
  if (uri.startsWith('ipfs://')) {
    return uri.replace('ipfs://', '');
  }
  const match = uri.match(/\/ipfs\/(.+)/);
  if (match) {
    return match[1];
  }
  return null;
}

function ipfsImageToHttp(image: string): string {
  if (!image) return '';
  const path = extractIpfsPath(image);
  if (path) return IPFS_GATEWAYS[0] + path;
  return image;
}

async function tryFetchJson(uri: string): Promise<Record<string, unknown> | null> {
  const ipfsPath = extractIpfsPath(uri);
  if (ipfsPath) {
    for (const gateway of IPFS_GATEWAYS) {
      const url = gateway + ipfsPath;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) continue;
        return await res.json();
      } catch {
        // try next gateway
      }
    }
    return null;
  }

  // Non-IPFS URL, try directly
  try {
    const res = await fetch(uri, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchTokenMetadata(tokenURI: string, tokenId: number): Promise<AnimalMetadata> {
  let uri = tokenURI;

  // Handle base64-encoded JSON metadata (data URI)
  if (uri.startsWith('data:application/json;base64,')) {
    try {
      const json = JSON.parse(atob(uri.split(',')[1]));
      return parseMetadataJson(json, tokenId);
    } catch {
      return fallbackMetadata(tokenId);
    }
  }

  // Handle inline data URI
  if (uri.startsWith('data:application/json,')) {
    try {
      const json = JSON.parse(decodeURIComponent(uri.split(',')[1]));
      return parseMetadataJson(json, tokenId);
    } catch {
      return fallbackMetadata(tokenId);
    }
  }

  const json = await tryFetchJson(uri);
  if (!json) return fallbackMetadata(tokenId);

  return parseMetadataJson(json, tokenId);
}

function parseMetadataJson(json: Record<string, unknown>, tokenId: number): AnimalMetadata {
  const name: string = (json.name as string) ?? `Animal #${tokenId}`;
  let image: string = (json.image as string) ?? '';
  image = ipfsImageToHttp(image);

  const attributes: Array<{ trait_type: string; value: string | number }> = Array.isArray(json.attributes)
    ? json.attributes
    : [];

  const rarityAttr = attributes.find(a =>
    a.trait_type?.toLowerCase() === 'rarity' || a.trait_type?.toLowerCase() === 'tier'
  );
  const typeAttr = attributes.find(a =>
    a.trait_type?.toLowerCase() === 'animal' ||
    a.trait_type?.toLowerCase() === 'type' ||
    a.trait_type?.toLowerCase() === 'species'
  );

  const rarity = rarityAttr ? String(rarityAttr.value) : guessRarity(tokenId);
  const animalType = typeAttr ? String(typeAttr.value) : guessAnimalType(name, tokenId);

  return {
    tokenId,
    name,
    image,
    description: (json.description as string) ?? '',
    attributes,
    rarity,
    animalType,
  };
}

function fallbackMetadata(tokenId: number): AnimalMetadata {
  return {
    tokenId,
    name: `Animal #${tokenId}`,
    image: '',
    description: '',
    attributes: [],
    rarity: guessRarity(tokenId),
    animalType: guessAnimalType('', tokenId),
  };
}

function guessRarity(tokenId: number): string {
  const tiers = ['Common', 'Common', 'Common', 'Uncommon', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
  return tiers[tokenId % tiers.length];
}

function guessAnimalType(name: string, tokenId: number): string {
  for (const t of ANIMAL_TYPES) {
    if (name.toLowerCase().includes(t.toLowerCase())) return t;
  }
  return ANIMAL_TYPES[tokenId % ANIMAL_TYPES.length];
}

export function useNFTAnimal() {
  const { wallet } = useWallet();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [state, setState] = useState<NFTAnimalState>(DEFAULT_STATE);
  const [isMinting, setIsMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintTx, setMintTx] = useState<MintResult | null>(null);

  const isWrongNetwork = chainId !== MONAD_TESTNET_CHAIN_ID;

  const switchToMonad = useCallback(() => {
    switchChain({ chainId: monadTestnet.id });
  }, [switchChain]);

  const fetchState = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const provider = getReadProvider();
      const contract = await getNFTAnimalContract(provider);

      const [totalMinted, maxSupply, mintPrice, maxPerWallet, currentPhase] = await Promise.all([
        contract.totalMinted(),
        contract.MAX_SUPPLY(),
        contract.MINT_PRICE(),
        contract.MAX_PER_WALLET(),
        contract.currentPhase(),
      ]);

      let mintedByWallet = 0;
      let isWhitelisted = false;
      if (wallet.address) {
        [mintedByWallet, isWhitelisted] = await Promise.all([
          contract.mintedPerWallet(wallet.address),
          contract.presaleWhitelist(wallet.address),
        ]);
      }

      setState({
        totalMinted: Number(totalMinted),
        maxSupply: Number(maxSupply),
        mintPrice: (Number(mintPrice) / 1e18).toString(),
        mintedByWallet: Number(mintedByWallet),
        maxPerWallet: Number(maxPerWallet),
        currentPhase: Number(currentPhase),
        isWhitelisted,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load contract data';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
    }
  }, [wallet.address]);

  useEffect(() => {
    fetchState();
    const id = setInterval(fetchState, 30_000);
    return () => clearInterval(id);
  }, [fetchState]);

  const mint = useCallback(async (quantity: number): Promise<MintResult> => {
    setIsMinting(true);
    setMintError(null);
    setMintTx(null);
    try {
      const signer = await getSigner();
      const contract = await getNFTAnimalContract(signer);
      const mintPrice = await contract.MINT_PRICE();
      const totalCost = mintPrice * BigInt(quantity);

      const tx = await contract.mint(quantity, { value: totalCost });
      await tx.wait();

      const result: MintResult = {
        txHash: tx.hash,
        explorerUrl: getExplorerTxUrl(tx.hash),
      };
      setMintTx(result);
      await fetchState();
      return result;
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Mint failed';
      setMintError(raw);
      throw err;
    } finally {
      setIsMinting(false);
    }
  }, [fetchState]);

  const getOwnedAnimals = useCallback(async (): Promise<AnimalMetadata[]> => {
    if (!wallet.address) return [];
    try {
      const provider = getReadProvider();
      const contract = await getNFTAnimalContract(provider);
      const balance = await contract.balanceOf(wallet.address);
      const count = Number(balance);
      if (count === 0) return [];

      const tokenIds = await Promise.all(
        Array.from({ length: count }, (_, i) =>
          contract.tokenOfOwnerByIndex(wallet.address, i).then(Number)
        )
      );

      return await Promise.all(
        tokenIds.map(async (tokenId) => {
          try {
            const uri: string = await contract.tokenURI(tokenId);
            return await fetchTokenMetadata(uri, tokenId);
          } catch {
            return {
              tokenId,
              name: `Animal #${tokenId}`,
              image: '',
              description: '',
              attributes: [],
              rarity: guessRarity(tokenId),
              animalType: guessAnimalType('', tokenId),
            };
          }
        })
      );
    } catch {
      return [];
    }
  }, [wallet.address]);

  return {
    ...state,
    isMinting,
    mintError,
    mintTx,
    isWrongNetwork,
    switchToMonad,
    mint,
    getOwnedAnimals,
    refresh: fetchState,
  };
}
