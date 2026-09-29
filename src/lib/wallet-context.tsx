import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useAccount, useBalance, useDisconnect, useReadContract, useConnectorClient } from 'wagmi';
import { formatUnits } from 'viem';
import type { WalletState } from './types';
import OxyTokenABI from './abi/abi_OxyToken.json';
import { CONTRACT_ADDRESSES, MONAD_TESTNET_CHAIN_ID, setWagmiProvider } from './contracts';

interface WalletContextType {
  wallet: WalletState;
  connect: () => void;
  disconnect: () => void;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
}

const defaultWallet: WalletState = {
  address: '',
  isConnected: false,
  balance: 0,
  oxyBalance: 0,
};

const WalletContext = createContext<WalletContextType>({
  wallet: defaultWallet,
  connect: () => {},
  disconnect: () => {},
  isModalOpen: false,
  openModal: () => {},
  closeModal: () => {},
});

function WalletStateSync({ onUpdate }: { onUpdate: (state: WalletState) => void }) {
  const { address, isConnected, chainId } = useAccount();
  const isMonadConnected = isConnected && chainId === MONAD_TESTNET_CHAIN_ID;
  const { data: balanceData } = useBalance({
    address,
    chainId: MONAD_TESTNET_CHAIN_ID,
    query: {
      enabled: isMonadConnected,
      refetchInterval: 10000,
      refetchOnWindowFocus: true,
    },
  });

  const { data: oxyRaw } = useReadContract({
    address: CONTRACT_ADDRESSES.OXY_TOKEN as `0x${string}`,
    abi: OxyTokenABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    chainId: MONAD_TESTNET_CHAIN_ID,
    query: {
      enabled: isMonadConnected && !!CONTRACT_ADDRESSES.OXY_TOKEN,
      refetchInterval: 10000,
      refetchOnWindowFocus: true,
    },
  });

  const balance = balanceData?.value != null
    ? parseFloat(formatUnits(balanceData.value, balanceData.decimals ?? 18))
    : 0;
  const oxyBalance = oxyRaw != null ? parseFloat(formatUnits(oxyRaw as bigint, 18)) : 0;

  const safeBalance = Number.isFinite(balance) ? balance : 0;
  const safeOxyBalance = Number.isFinite(oxyBalance) ? oxyBalance : 0;

  useEffect(() => {
    onUpdate({
      address: address ?? '',
      isConnected,
      balance: safeBalance,
      oxyBalance: safeOxyBalance,
    });
  }, [address, isConnected, balance, oxyBalance, onUpdate]);

  return null;
}

function ProviderSync() {
  const { data: client } = useConnectorClient();
  useEffect(() => {
    const transport = client?.transport;
    if (transport && typeof transport === 'object' && 'request' in transport) {
      setWagmiProvider(transport as unknown as Parameters<typeof setWagmiProvider>[0]);
    } else {
      setWagmiProvider(null);
    }
  }, [client]);
  return null;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletState>(defaultWallet);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { disconnect: wagmiDisconnect } = useDisconnect();

  const handleUpdate = useCallback((state: WalletState) => {
    setWallet(prev => {
      if (
        prev.address === state.address &&
        prev.isConnected === state.isConnected &&
        prev.balance === state.balance &&
        prev.oxyBalance === state.oxyBalance
      ) {
        return prev;
      }
      return state;
    });
  }, []);

  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  const connect = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const disconnect = useCallback(() => {
    wagmiDisconnect();
    setWallet(defaultWallet);
  }, [wagmiDisconnect]);

  return (
    <WalletContext.Provider value={{ wallet, connect, disconnect, isModalOpen, openModal, closeModal }}>
      <WalletStateSync onUpdate={handleUpdate} />
      <ProviderSync />
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
