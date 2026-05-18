"use client";

import { useCallback, useMemo, useState } from 'react';
import { usePublicClient, useWalletClient } from 'wagmi';
import { formatUnits } from 'viem';

import { FHENIX_VAULT_CHAIN } from '@/services/fhe/fhenixChain';
import {
  createPermit,
  decryptSealedOutput,
  getActivePermit,
  getPermission,
  initializeFhe,
  selectActivePermit,
} from '@/services/fhe/fheService';

const FHENIX_BALANCE_ABI = [
  {
    name: 'getEncryptedBalanceCtHash',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      {
        name: 'permission',
        type: 'tuple',
        components: [
          { name: 'publicKey', type: 'bytes32' },
          { name: 'signature', type: 'bytes' },
        ],
      },
    ],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;

type Status = 'idle' | 'initializing' | 'permit' | 'reading' | 'unsealing' | 'ready' | 'error';

export function useFhenixPrivateVaultBalance(params: {
  userAddress?: `0x${string}`;
  vaultAddress?: `0x${string}`;
  enabled?: boolean;
}) {
  const { userAddress, vaultAddress, enabled = true } = params;

  const { data: walletClient } = useWalletClient({ chainId: FHENIX_VAULT_CHAIN.id });
  const publicClient = usePublicClient({ chainId: FHENIX_VAULT_CHAIN.id });

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [balanceMicro, setBalanceMicro] = useState<bigint | null>(null);

  const formattedBalance = useMemo(() => {
    if (balanceMicro == null) return null;
    return formatUnits(balanceMicro, 6);
  }, [balanceMicro]);

  const reveal = useCallback(async () => {
    if (!enabled) return null;
    if (!userAddress) {
      setStatus('error');
      setError('No wallet connected.');
      return null;
    }
    if (!vaultAddress) {
      setStatus('error');
      setError('Fhenix vault address not configured.');
      return null;
    }
    if (!walletClient || !publicClient) {
      setStatus('error');
      setError(`Wallet must be connected on ${FHENIX_VAULT_CHAIN.name}.`);
      return null;
    }

    try {
      setError(null);
      setStatus('initializing');

      // 1) Initialize cofhejs for this chain + wallet.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- wagmi injects account
      const initRes = await initializeFhe(publicClient as any, walletClient as any);
      if (!initRes.success) throw new Error(initRes.error?.message ?? 'Failed to initialize FHE');

      // 2) Ensure there is an active permit for this vault.
      setStatus('permit');
      let permit = await getActivePermit();

      // If no permit, or it doesn't match this vault, create a new one.
      const permitObj = permit as unknown as { validatorContract?: string; getHash?: () => string };
      if (!permit || String(permitObj.validatorContract).toLowerCase() !== vaultAddress.toLowerCase()) {
        const permitRes = await createPermit(userAddress, vaultAddress);
        if (!permitRes.success) throw new Error(permitRes.error?.message ?? 'Failed to create permit');
        permit = permitRes.data;
      }

      const permitHash = permitObj.getHash?.() as string | undefined;
      if (!permitHash) throw new Error('Could not resolve permit hash');

      const selRes = await selectActivePermit(permitHash);
      if (!selRes.success) throw new Error(selRes.error?.message ?? 'Failed to activate permit');

      const permissionRes = await getPermission(permitHash);
      if (!permissionRes.success) throw new Error(permissionRes.error?.message ?? 'Failed to get permission');

      // 3) Read encrypted balance (sealed output) from the vault.
      setStatus('reading');
      const sealedOutput = await publicClient.readContract({
        address: vaultAddress,
        abi: FHENIX_BALANCE_ABI,
        functionName: 'getEncryptedBalanceCtHash',
        args: [permissionRes.data as unknown as { publicKey: `0x${string}`; signature: `0x${string}` }],
      });

      // 4) Decrypt the sealed output locally (no threshold network round-trip).
      setStatus('unsealing');
      const unsealRes = await decryptSealedOutput(sealedOutput);
      if (!unsealRes.success) {
        const errMsg = 'error' in unsealRes && unsealRes.error ? unsealRes.error.message : 'Failed to decrypt sealed output';
        throw new Error(errMsg);
      }

      setBalanceMicro(unsealRes.data);
      setStatus('ready');
      return unsealRes.data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus('error');
      setError(msg);
      return null;
    }
  }, [enabled, publicClient, userAddress, vaultAddress, walletClient]);

  return {
    status,
    error,
    balanceMicro,
    formattedBalance,
    reveal,
  };
}

