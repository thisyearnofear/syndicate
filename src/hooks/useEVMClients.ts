/**
 * useEVMClients — Single source of truth for EVM wallet + public clients
 *
 * Problem this solves:
 * - Multiple hooks call wagmi's useWalletClient / usePublicClient unconditionally.
 * - When a non-EVM wallet is connected (Solana, Stacks, NEAR, TON), wagmi has no
 *   EVM account, so those hooks return null — causing "No EVM wallet connected"
 *   errors even when the user is legitimately connected via MetaMask.
 *
 * Solution:
 * - Read walletType from useUnifiedWallet (the unified state layer).
 * - Only call wagmi hooks when walletType === 'evm'.
 * - All consumers read from the same source, so state is always consistent.
 *
 * Usage:
 *   const { walletClient, publicClient, fhenixWalletClient, fhenixPublicClient } = useEVMClients();
 *   // All values are WalletClient | PublicClient | null — guard before use.
 */

import { useCallback } from 'react';
import { useChainId, usePublicClient, useSwitchChain, useWalletClient } from 'wagmi';
import { base } from 'wagmi/chains';
import { useUnifiedWallet } from './useUnifiedWallet';
import { FHENIX_VAULT_CHAIN, FHENIX_VAULT_NETWORK_LABEL } from '@/services/fhe/fhenixChain';

export interface EVMClients {
  walletClient: ReturnType<typeof useWalletClient>['data'];
  publicClient: ReturnType<typeof usePublicClient>;
  fhenixWalletClient: ReturnType<typeof useWalletClient>['data'];
  fhenixPublicClient: ReturnType<typeof usePublicClient>;
  activeChainId: number | undefined;
  baseChainName: string;
  fhenixChainName: string;
  walletType: ReturnType<typeof useUnifiedWallet>['walletType'];
  ensureBaseChain: () => Promise<void>;
  ensureFhenixChain: () => Promise<void>;
}

export function useEVMClients(): EVMClients {
  const { walletType } = useUnifiedWallet();
  const isEVM = walletType === 'evm';
  const activeChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  const { data: walletClient } = useWalletClient({
    chainId: base.id,
    query: { enabled: isEVM },
  });
  const publicClient = usePublicClient({
    chainId: base.id,
    query: { enabled: isEVM },
  });
  const { data: fhenixWalletClient } = useWalletClient({
    chainId: FHENIX_VAULT_CHAIN.id,
    query: { enabled: isEVM },
  });
  const fhenixPublicClient = usePublicClient({
    chainId: FHENIX_VAULT_CHAIN.id,
    query: { enabled: isEVM },
  });

  const ensureChain = useCallback(
    async (chainId: number, chainName: string) => {
      if (!isEVM) {
        throw new Error('This action requires an EVM wallet such as MetaMask or WalletConnect.');
      }

      if (activeChainId !== chainId) {
        if (!switchChainAsync) {
          throw new Error(`Switch your wallet to ${chainName} to continue.`);
        }

        await switchChainAsync({ chainId });
      }
    },
    [activeChainId, isEVM, switchChainAsync],
  );

  const ensureBaseChain = useCallback(
    () => ensureChain(base.id, base.name),
    [ensureChain],
  );

  const ensureFhenixChain = useCallback(
    () => ensureChain(FHENIX_VAULT_CHAIN.id, FHENIX_VAULT_NETWORK_LABEL),
    [ensureChain],
  );

  return {
    walletClient,
    publicClient,
    fhenixWalletClient,
    fhenixPublicClient,
    activeChainId,
    baseChainName: base.name,
    fhenixChainName: FHENIX_VAULT_NETWORK_LABEL,
    walletType,
    ensureBaseChain,
    ensureFhenixChain,
  };
}
