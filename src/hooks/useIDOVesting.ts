import { useState, useEffect, useCallback } from 'react';
import { Contract } from 'ethers';
import { getIDOVestingContract, getSigner, formatOxy, parseOxy, getReadProvider } from '../lib/contracts';

export interface VestingSchedule {
  totalAmount: string;
  released: string;
  startTime: number;
  cliffDuration: number;
  vestingDuration: number;
  revocable: boolean;
  revoked: boolean;
  currentlyVested: string;
  currentlyClaimable: string;
}

export interface VestingContractInfo {
  totalAllocated: string;
  beneficiaryCount: number;
  contractOwner: string;
  oxyTokenAddress: string;
  contractBalance: string;
}

export function useIDOVesting(walletAddress?: string) {
  const [schedule, setSchedule] = useState<VestingSchedule | null>(null);
  const [contractInfo, setContractInfo] = useState<VestingContractInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = useCallback(async () => {
    if (!walletAddress) { setSchedule(null); return; }
    setIsLoading(true);
    setError(null);
    try {
      const contract = await getIDOVestingContract();
      const s = await contract.getSchedule(walletAddress);

      const totalAmount = BigInt(s.totalAmount);
      if (totalAmount === 0n) {
        setSchedule(null);
      } else {
        setSchedule({
          totalAmount: formatOxy(totalAmount),
          released: formatOxy(BigInt(s.released)),
          startTime: Number(s.startTime),
          cliffDuration: Number(s.cliffDuration),
          vestingDuration: Number(s.vestingDuration),
          revocable: s.revocable,
          revoked: s.revoked,
          currentlyVested: formatOxy(BigInt(s.currentlyVested)),
          currentlyClaimable: formatOxy(BigInt(s.currentlyClaimable)),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch vesting schedule');
      setSchedule(null);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  const fetchContractInfo = useCallback(async () => {
    try {
      const contract = await getIDOVestingContract();
      const provider = getReadProvider();
      const [totalAllocated, beneficiaryCount, owner, oxyToken] = await Promise.all([
        contract.totalAllocated(),
        contract.beneficiaryCount(),
        contract.owner(),
        contract.oxyToken(),
      ]);

      const oxyBal = await new Contract(
        oxyToken,
        ['function balanceOf(address) view returns (uint256)'],
        provider,
      ).balanceOf(await contract.getAddress());

      setContractInfo({
        totalAllocated: formatOxy(BigInt(totalAllocated)),
        beneficiaryCount: Number(beneficiaryCount),
        contractOwner: owner,
        oxyTokenAddress: oxyToken,
        contractBalance: formatOxy(BigInt(oxyBal)),
      });
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);
  useEffect(() => { fetchContractInfo(); }, [fetchContractInfo]);

  const claim = useCallback(async (): Promise<string> => {
    const signer = await getSigner();
    const contract = await getIDOVestingContract(signer);
    const tx = await contract.claim();
    await tx.wait();
    await fetchSchedule();
    return tx.hash;
  }, [fetchSchedule]);

  const createSchedule = useCallback(async (
    beneficiary: string,
    totalAmount: string,
    startTime: number,
    cliffDuration: number,
    vestingDuration: number,
    revocable: boolean,
  ): Promise<string> => {
    const signer = await getSigner();
    const contract = await getIDOVestingContract(signer);
    const tx = await contract.createSchedule(
      beneficiary,
      parseOxy(totalAmount),
      startTime,
      cliffDuration,
      vestingDuration,
      revocable,
    );
    await tx.wait();
    await fetchContractInfo();
    return tx.hash;
  }, [fetchContractInfo]);

  const createScheduleBatch = useCallback(async (
    beneficiaries: string[],
    amounts: string[],
    startTime: number,
    cliffDuration: number,
    vestingDuration: number,
    revocable: boolean,
  ): Promise<string> => {
    const signer = await getSigner();
    const contract = await getIDOVestingContract(signer);
    const tx = await contract.createScheduleBatch(
      beneficiaries,
      amounts.map((a) => parseOxy(a)),
      startTime,
      cliffDuration,
      vestingDuration,
      revocable,
    );
    await tx.wait();
    await fetchContractInfo();
    return tx.hash;
  }, [fetchContractInfo]);

  const revoke = useCallback(async (beneficiary: string): Promise<string> => {
    const signer = await getSigner();
    const contract = await getIDOVestingContract(signer);
    const tx = await contract.revoke(beneficiary);
    await tx.wait();
    await fetchContractInfo();
    return tx.hash;
  }, [fetchContractInfo]);

  const withdrawUnallocated = useCallback(async (to: string): Promise<string> => {
    const signer = await getSigner();
    const contract = await getIDOVestingContract(signer);
    const tx = await contract.withdrawUnallocated(to);
    await tx.wait();
    await fetchContractInfo();
    return tx.hash;
  }, [fetchContractInfo]);

  return {
    schedule,
    contractInfo,
    isLoading,
    error,
    refresh: fetchSchedule,
    refreshInfo: fetchContractInfo,
    claim,
    createSchedule,
    createScheduleBatch,
    revoke,
    withdrawUnallocated,
  };
}
