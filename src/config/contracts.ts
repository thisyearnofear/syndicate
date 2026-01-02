/**
 * CENTRALIZED CONTRACT CONFIGURATION
 * 
 * Core Principles Applied:
 * - DRY: Single source of truth for contract addresses and ABIs
 * - ORGANIZED: All contracts in one place for easy management
 * 
 * Use this file to import contracts instead of duplicating configs
 */

import { Address } from 'viem';

// =============================================================================
// MEGAPOT CONTRACT (Base Mainnet)
// =============================================================================

export const MEGAPOT = {
  address: '0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95' as Address,
  chainId: 8453, // Base
  abi: [
    {
      name: 'purchaseTickets',
      type: 'function',
      inputs: [
        { name: 'referrer', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'recipient', type: 'address' },
      ],
      outputs: [],
      stateMutability: 'payable',
    },
  ] as const,
} as const;

// =============================================================================
// ALL CONTRACTS MAP
// =============================================================================

export const CONTRACTS = {
  megapot: MEGAPOT,
} as const;

// =============================================================================
// HELPER: Get contract for chain
// =============================================================================

export function getContractForChain(chainId: number, contractName: keyof typeof CONTRACTS) {
  const contract = CONTRACTS[contractName];
  
  if (contract.chainId && contract.chainId !== chainId) {
    console.warn(
      `[Config] Contract ${contractName} is on chain ${contract.chainId}, but you requested chain ${chainId}`
    );
  }
  
  return contract;
}
