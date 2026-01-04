/**
 * NETWORK INFO HOOK
 * 
 * SINGLE SOURCE OF TRUTH for network and testnet detection
 * ENHANCEMENT FIRST: Centralized hook for all components that need network awareness
 * 
 * Use this hook instead of hardcoding chain IDs or network logic throughout the app
 */

import { useMemo } from 'react';
import { useWalletContext } from '@/context/WalletContext';
import { CHAIN_IDS } from '@/config';

export interface NetworkInfo {
  chainId: number | null;
  chainName: string;
  isTestnet: boolean;
  isBase: boolean;
  isBaseSepolia: boolean;
  isEthereum: boolean;
  isSepolia: boolean;
  isMainnet: boolean; // Any mainnet (Base, Ethereum, Avalanche, etc.)
  nativeToken: string; // USDC or mock MPUSDC
  supportsAdvancedPermissions: boolean;
}

/**
 * Get comprehensive network information
 * SINGLE SOURCE OF TRUTH for all chain-aware logic
 */
export function useNetworkInfo(): NetworkInfo {
  const { state } = useWalletContext();

  return useMemo(() => {
    const chainId = state.chainId ?? 8453; // Default to Base mainnet

    const isTestnet = chainId === CHAIN_IDS.BASE_SEPOLIA || chainId === CHAIN_IDS.SEPOLIA;
    const isBase = chainId === CHAIN_IDS.BASE;
    const isBaseSepolia = chainId === CHAIN_IDS.BASE_SEPOLIA;
    const isEthereum = chainId === CHAIN_IDS.ETHEREUM;
    const isSepolia = chainId === CHAIN_IDS.SEPOLIA;
    const isMainnet = !isTestnet && (isBase || isEthereum || chainId === CHAIN_IDS.AVALANCHE);

    // Determine native token based on chain
    let nativeToken = 'USDC';
    if (isBaseSepolia) {
      nativeToken = 'Test MPUSDC'; // Mock USDC on Base Sepolia
    } else if (isSepolia) {
      nativeToken = 'Test USDC'; // Test USDC on Ethereum Sepolia
    }

    // Advanced Permissions (ERC-7715) supported on Base and Base Sepolia
    const supportsAdvancedPermissions = isBase || isBaseSepolia;

    const chainNameMap: Record<number, string> = {
      [CHAIN_IDS.BASE]: 'Base',
      [CHAIN_IDS.BASE_SEPOLIA]: 'Base Sepolia',
      [CHAIN_IDS.ETHEREUM]: 'Ethereum',
      [CHAIN_IDS.SEPOLIA]: 'Sepolia',
      [CHAIN_IDS.AVALANCHE]: 'Avalanche',
      [CHAIN_IDS.STACKS]: 'Stacks',
    };

    const chainName = chainNameMap[chainId] || `Network (${chainId})`;

    return {
      chainId,
      chainName,
      isTestnet,
      isBase,
      isBaseSepolia,
      isEthereum,
      isSepolia,
      isMainnet,
      nativeToken,
      supportsAdvancedPermissions,
    };
  }, [state.chainId]);
}

/**
 * Hook to check if feature is available on current network
 * Use this to disable/hide unsupported features based on chain
 */
export function useNetworkFeatureSupport() {
  const info = useNetworkInfo();

  return useMemo(() => ({
    canDoAdvancedPermissions: info.supportsAdvancedPermissions,
    canBuyTickets: true, // All EVM networks supported for Megapot
    canClaimWinnings: info.isMainnet, // Only claim on mainnet
    canEarnReferrals: info.isMainnet, // Only earn on mainnet
    shouldShowTestnetWarning: info.isTestnet,
  }), [info]);
}
