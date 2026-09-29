import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../lib/wallet-context';
import {
  getSigner,
  getReadProvider,
  getMarketplaceContract,
  getOxyTokenContract,
  getNFTAnimalContract,
  getNFTTreeContract,
  formatOxy,
  parseOxy,
  CONTRACT_ADDRESSES,
  getExplorerTxUrl,
} from '../lib/contracts';

export interface Listing {
  id: number;
  seller: string;
  nftContract: string;
  tokenId: number;
  priceOxy: string;
  isActive: boolean;
  nftType: 'A' | 'B' | 'unknown';
}

interface MarketplaceState {
  listings: Listing[];
  listingCount: number;
  platformFeeBps: number;
  isLoading: boolean;
  error: string | null;
}

interface TxResult {
  txHash: string;
  explorerUrl: string;
}

export function useMarketplace() {
  const { wallet } = useWallet();
  const [state, setState] = useState<MarketplaceState>({
    listings: [],
    listingCount: 0,
    platformFeeBps: 250,
    isLoading: false,
    error: null,
  });
  const [isTxPending, setIsTxPending] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  const fetchListings = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const provider = getReadProvider();
      const contract = await getMarketplaceContract(provider);

      const [listingCounter, platformFeeBps] = await Promise.all([
        contract.listingCounter(),
        contract.platformFeeBps(),
      ]);

      const count = Number(listingCounter);

      const results = await Promise.allSettled(
        Array.from({ length: count }, (_, i) => contract.getActiveListing(i + 1))
      );

      const listings: Listing[] = results
        .map((r, i) => {
          if (r.status !== 'fulfilled' || !r.value.isActive) return null;
          const listing = r.value;
          const nftType: 'A' | 'B' | 'unknown' =
            listing.nftContract.toLowerCase() === CONTRACT_ADDRESSES.NFT_ANIMAL.toLowerCase()
              ? 'A'
              : listing.nftContract.toLowerCase() === CONTRACT_ADDRESSES.NFT_TREE.toLowerCase()
              ? 'B'
              : 'unknown';
          return {
            id: i + 1,
            seller: listing.seller,
            nftContract: listing.nftContract,
            tokenId: Number(listing.tokenId),
            priceOxy: formatOxy(listing.priceOxy),
            isActive: listing.isActive,
            nftType,
          } satisfies Listing;
        })
        .filter((l): l is Listing => l !== null);

      setState({
        listings,
        listingCount: listings.length,
        platformFeeBps: Number(platformFeeBps),
        isLoading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load marketplace listings';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
    }
  }, []);

  useEffect(() => {
    fetchListings();
    const id = setInterval(fetchListings, 30_000);
    return () => clearInterval(id);
  }, [fetchListings]);

  const ensureOxyApproval = useCallback(async (amount: string) => {
    if (!wallet.address) throw new Error('Wallet not connected');
    const signer = await getSigner();
    const oxyContract = await getOxyTokenContract(signer);
    const parsedAmount = parseOxy(amount);
    const allowance = await oxyContract.allowance(wallet.address, CONTRACT_ADDRESSES.MARKETPLACE);
    if (allowance < parsedAmount) {
      const tx = await oxyContract.approve(CONTRACT_ADDRESSES.MARKETPLACE, parsedAmount);
      await tx.wait();
    }
  }, [wallet.address]);

  const ensureNFTApproval = useCallback(async (nftType: 'A' | 'B', tokenId: number) => {
    if (!wallet.address) throw new Error('Wallet not connected');
    const signer = await getSigner();
    const nftContract = nftType === 'A'
      ? await getNFTAnimalContract(signer)
      : await getNFTTreeContract(signer);
    const marketplaceAddr = CONTRACT_ADDRESSES.MARKETPLACE;
    const isApprovedAll = await nftContract.isApprovedForAll(wallet.address, marketplaceAddr);
    if (!isApprovedAll) {
      const approved = await nftContract.getApproved(tokenId);
      if (approved.toLowerCase() !== marketplaceAddr.toLowerCase()) {
        const tx = await nftContract.approve(marketplaceAddr, tokenId);
        await tx.wait();
      }
    }
  }, [wallet.address]);

  const listNFTA = useCallback(async (tokenId: number, priceOxy: string): Promise<TxResult> => {
    setIsTxPending(true);
    setTxError(null);
    try {
      await ensureNFTApproval('A', tokenId);
      const signer = await getSigner();
      const contract = await getMarketplaceContract(signer);
      const tx = await contract.listOryxWarrior(tokenId, parseOxy(priceOxy));
      await tx.wait();
      await fetchListings();
      return { txHash: tx.hash, explorerUrl: getExplorerTxUrl(tx.hash) };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'List NFT A failed';
      setTxError(message);
      throw err;
    } finally {
      setIsTxPending(false);
    }
  }, [ensureNFTApproval, fetchListings]);

  const listNFTB = useCallback(async (tokenId: number, priceOxy: string): Promise<TxResult> => {
    setIsTxPending(true);
    setTxError(null);
    try {
      await ensureNFTApproval('B', tokenId);
      const signer = await getSigner();
      const contract = await getMarketplaceContract(signer);
      const tx = await contract.listOxyTree(tokenId, parseOxy(priceOxy));
      await tx.wait();
      await fetchListings();
      return { txHash: tx.hash, explorerUrl: getExplorerTxUrl(tx.hash) };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'List NFT B failed';
      setTxError(message);
      throw err;
    } finally {
      setIsTxPending(false);
    }
  }, [ensureNFTApproval, fetchListings]);

  const buy = useCallback(async (listingId: number, priceOxy: string): Promise<TxResult> => {
    setIsTxPending(true);
    setTxError(null);
    try {
      await ensureOxyApproval(priceOxy);
      const signer = await getSigner();
      const contract = await getMarketplaceContract(signer);
      const tx = await contract.buy(listingId);
      await tx.wait();
      await fetchListings();
      return { txHash: tx.hash, explorerUrl: getExplorerTxUrl(tx.hash) };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Buy failed';
      setTxError(message);
      throw err;
    } finally {
      setIsTxPending(false);
    }
  }, [ensureOxyApproval, fetchListings]);

  const cancelListing = useCallback(async (listingId: number): Promise<TxResult> => {
    setIsTxPending(true);
    setTxError(null);
    try {
      const signer = await getSigner();
      const contract = await getMarketplaceContract(signer);
      const tx = await contract.cancelListing(listingId);
      await tx.wait();
      await fetchListings();
      return { txHash: tx.hash, explorerUrl: getExplorerTxUrl(tx.hash) };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cancel listing failed';
      setTxError(message);
      throw err;
    } finally {
      setIsTxPending(false);
    }
  }, [fetchListings]);

  return {
    ...state,
    isTxPending,
    txError,
    listNFTA,
    listNFTB,
    buy,
    cancelListing,
    refresh: fetchListings,
  };
}
