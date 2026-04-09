import { useCallback, useEffect, useMemo } from 'react';
import { useChainId, useSignMessage, useSwitchChain } from 'wagmi';
import {
  useWallet as useSolanaAdapterWallet,
} from '@solana/wallet-adapter-react';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import {
  useUnifiedWallet as useWalletService,
} from '@/domains/wallet/services/unifiedWalletService';
import { useWalletContext } from '@/context/WalletContext';
import type { WalletType } from '@/domains/wallet/types';

export type WalletChain = 'evm' | 'solana' | 'near' | 'ton' | 'stacks' | 'starknet';

export interface ConnectOptions {
  chainId?: number;
  silent?: boolean;
  provider?: string;
}

export interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  chain: WalletChain | null;
  walletType: WalletType | null;
  chainId: number | string | null;
  error: Error | null;
  mirrorAddress: string | null;
  publicKey: string | null;
}

export interface WalletActions {
  connect: (chain: WalletChain | WalletType, options?: ConnectOptions) => Promise<void>;
  disconnect: () => Promise<void>;
  signMessage: (message: string) => Promise<string | null>;
  signTransaction: <T>(transaction: T) => Promise<T>;
  switchChain: (chainId: number) => Promise<void>;
  clearError: () => void;
}

function toWalletType(chain: WalletChain | WalletType): WalletType {
  switch (chain) {
    case 'social':
      return 'social';
    case 'evm':
      return 'evm';
    case 'solana':
      return 'solana';
    case 'near':
      return 'near';
    case 'ton':
      return 'ton';
    case 'stacks':
      return 'stacks';
    case 'starknet':
      return 'starknet';
  }
}

export function useUnifiedWallet(): WalletState & WalletActions {
  const { state, dispatch, disconnectWallet } = useWalletContext();
  const walletService = useWalletService();
  const solanaWallet = useSolanaAdapterWallet();
  const [tonConnectUI] = useTonConnectUI();
  const tonWallet = useTonWallet();
  const evmChainId = useChainId();
  const evmSignMessage = useSignMessage();
  const evmSwitchChain = useSwitchChain();

  useEffect(() => {
    if (!tonWallet?.account.address || state.walletType === 'ton') {
      return;
    }

    dispatch({
      type: 'CONNECT_SUCCESS',
      payload: {
        address: tonWallet.account.address,
        walletType: 'ton',
        chainId: tonWallet.account.chain ?? 'ton',
      },
    });
  }, [dispatch, state.walletType, tonWallet]);

  const connect = useCallback(
    async (chain: WalletChain | WalletType, options?: ConnectOptions) => {
      if (chain === 'ton') {
        dispatch({ type: 'CONNECT_START', payload: { walletType: 'ton' } });
        await tonConnectUI.openModal();
        return;
      }

      await walletService.connect(toWalletType(chain));

      if (chain === 'evm' && options?.chainId && options.chainId !== evmChainId) {
        try {
          await evmSwitchChain.switchChainAsync({ chainId: options.chainId });
        } catch {
          await walletService.switchChain(options.chainId);
        }
      }
    },
    [dispatch, evmChainId, evmSwitchChain, tonConnectUI, walletService],
  );

  const disconnect = useCallback(async () => {
    if (state.walletType === 'ton') {
      try {
        await tonConnectUI.disconnect();
      } finally {
        dispatch({ type: 'DISCONNECT' });
      }
      return;
    }

    await disconnectWallet();
  }, [dispatch, disconnectWallet, state.walletType, tonConnectUI]);

  const signMessage = useCallback(
    async (message: string): Promise<string | null> => {
      if (!state.walletType) return null;

      switch (state.walletType) {
        case 'evm':
          return evmSignMessage.signMessageAsync({ message });
        case 'solana': {
          if (!solanaWallet.signMessage) return null;
          const signature = await solanaWallet.signMessage(new TextEncoder().encode(message));
          return Buffer.from(signature).toString('base64');
        }
        case 'near':
          return null;
        default:
          return null;
      }
    },
    [evmSignMessage, solanaWallet, state.walletType],
  );

  const signTransaction = useCallback(
    async <T,>(transaction: T): Promise<T> => {
      if (state.walletType !== 'solana') {
        throw new Error('Transaction signing is only available for Solana in this hook');
      }

      if (!solanaWallet.signTransaction) {
        throw new Error('Connected Solana wallet does not support transaction signing');
      }

      return (await solanaWallet.signTransaction(transaction as never)) as T;
    },
    [solanaWallet, state.walletType],
  );

  const switchChain = useCallback(
    async (chainId: number) => {
      if (state.walletType !== 'evm') {
        throw new Error('Chain switching is only supported for EVM wallets');
      }

      try {
        await evmSwitchChain.switchChainAsync({ chainId });
      } catch {
        await walletService.switchChain(chainId);
      }
    },
    [evmSwitchChain, state.walletType, walletService],
  );

  const chain = useMemo<WalletChain | null>(() => {
    if (state.walletType) return state.walletType as WalletChain;
    if (tonWallet?.account.address) return 'ton';
    return null;
  }, [state.walletType, tonWallet]);

  return {
    address: state.address ?? tonWallet?.account.address ?? null,
    isConnected: state.isConnected || !!tonWallet?.account.address,
    isConnecting: state.isConnecting,
    chain,
    walletType: (state.walletType ?? (tonWallet?.account.address ? 'ton' : null)) as WalletType | null,
    chainId: state.walletType === 'evm' && state.isConnected ? (state.chainId ?? evmChainId ?? null) : (state.chainId ?? tonWallet?.account.chain ?? null),
    error: state.error ? new Error(state.error) : null,
    mirrorAddress: state.mirrorAddress,
    publicKey: state.walletType === 'solana' ? state.address : solanaWallet.publicKey?.toBase58() ?? null,
    connect,
    disconnect,
    signMessage,
    signTransaction,
    switchChain,
    clearError: walletService.clearError,
  };
}

export function isSupportedChain(chain: string): chain is WalletChain {
  return ['evm', 'solana', 'near', 'ton', 'stacks', 'starknet'].includes(chain);
}

export function getChainDisplayName(chain: WalletChain): string {
  const names: Record<WalletChain, string> = {
    evm: 'Ethereum',
    solana: 'Solana',
    near: 'NEAR',
    ton: 'TON',
    stacks: 'Stacks',
    starknet: 'Starknet',
  };

  return names[chain];
}

export default useUnifiedWallet;
