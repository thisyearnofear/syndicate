/**
 * 0XSPLITS SERVICE
 * 
 * Creates and manages splits on Base for syndicate prize distribution.
 * Uses the SplitMain contract directly (no SDK dependency needed).
 * 
 * March 2026: 0xSplits SplitMain on Base
 * - SplitMain: 0x2ed6c55457632e381550485286422539B967796D
 */

import { 
  createWalletClient, 
  http, 
  encodeFunctionData,
  type Address,
  type WalletClient,
  type PublicClient,
} from 'viem';
import { base } from 'viem/chains';
import { basePublicClient } from '@/lib/baseClient';

const _BASE_CHAIN_ID = 8453;

// SplitMain contract on Base (immutable, no upgrade)
const SPLIT_MAIN = '0x2ed6c55457632e381550485286422539B967796D' as const;

// SplitMain ABI (core functions)
const SPLIT_MAIN_ABI = [
  {
    name: 'createSplit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'accounts',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'allocPoints', type: 'uint256' },
        ],
      },
      { name: 'distributorFee', type: 'uint256' },
      { name: 'controller', type: 'address' },
    ],
    outputs: [{ name: 'split', type: 'address' }],
  },
  {
    name: 'distributeETH',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'split', type: 'address' },
      { name: 'distributions', type: 'tuple[]', components: [
        { name: 'recipient', type: 'address' },
        { name: 'percentAllocation', type: 'uint256' },
        { name: 'addressData', type: 'bytes' },
      ]},
    ],
    outputs: [],
  },
  {
    name: 'distributeToken',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'split', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'distributions', type: 'tuple[]', components: [
        { name: 'recipient', type: 'address' },
        { name: 'percentAllocation', type: 'uint256' },
        { name: 'addressData', type: 'bytes' },
      ]},
    ],
    outputs: [],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'split', type: 'address' },
      { name: 'tokens', type: 'address[]' },
      { name: 'distributions', type: 'tuple[]', components: [
        { name: 'recipient', type: 'address' },
        { name: 'percentAllocation', type: 'uint256' },
        { name: 'addressData', type: 'bytes' },
      ]},
    ],
    outputs: [],
  },
  {
    name: 'getSplitInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'split', type: 'address' }],
    outputs: [
      { name: 'accounts', type: 'tuple[]', components: [
        { name: 'target', type: 'address' },
        { name: 'allocPoints', type: 'uint256' },
      ]},
      { name: 'totalAllocPoints', type: 'uint256' },
      { name: 'distributorFee', type: 'uint256' },
      { name: 'controller', type: 'address' },
    ],
  },
  {
    name: 'getSplitBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'split', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// ERC20 ABI for token distribution
const _ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export interface SplitRecipient {
  address: Address;
  percentAllocation: number; // 0-100, up to 4 decimals
}

export interface SplitInfo {
  address: Address;
  recipients: SplitRecipient[];
  totalAllocPoints: bigint;
  distributorFee: number;
  controller: Address | null;
}

export interface CreateSplitParams {
  recipients: SplitRecipient[];
  distributorFee?: number; // 0-100, default 0
  controller?: Address; // defaults to zero address (immutable)
}

export interface CreateSplitResult {
  success: boolean;
  splitAddress?: Address;
  txHash?: string;
  error?: string;
}

export interface DistributeTokenParams {
  splitAddress: Address;
  token: Address;
  walletClient: WalletClient;
}

const publicClient = basePublicClient as any;

/**
 * Create a new split on Base
 */
export async function createSplit(
  params: CreateSplitParams,
  walletClient: WalletClient
): Promise<CreateSplitResult> {
  try {
    const { recipients, distributorFee = 0, controller } = params;

    // Validate recipients
    const totalAllocation = recipients.reduce((sum, r) => sum + r.percentAllocation, 0);
    if (Math.abs(totalAllocation - 100) > 0.01) {
      return {
        success: false,
        error: `Total allocation must equal 100%, got ${totalAllocation}%`,
      };
    }

    // Build accounts array for contract
    const accounts = recipients.map(r => ({
      target: r.address,
      allocPoints: BigInt(Math.round(r.percentAllocation * 10000)), // 4 decimal precision
    }));

    // Controller address (zero address = immutable split)
    const controllerAddress = controller || '0x0000000000000000000000000000000000000000';

    // Encode the createSplit call
    const data = encodeFunctionData({
      abi: SPLIT_MAIN_ABI,
      functionName: 'createSplit',
      args: [
        accounts,
        BigInt(Math.round(distributorFee * 10000)), // 4 decimal precision
        controllerAddress,
      ],
    });

    // Get the account from wallet client
    const [account] = await walletClient.getAddresses();
    if (!account) {
      return { success: false, error: 'No account connected' };
    }

    // Send transaction
    const txHash = await walletClient.sendTransaction({
      account,
      to: SPLIT_MAIN,
      data,
      chain: base,
    });

    console.log('[SplitsService] Create split transaction sent:', {
      txHash,
      recipients,
      distributorFee,
    });

    // Wait for transaction _receipt to get split address
    const _receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    
    // Parse logs to find the SplitCreated event
    // For now, return the txHash - the split address will be indexed by subgraph
    return {
      success: true,
      txHash,
    };
  } catch (error) {
    console.error('[SplitsService] Failed to create split:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create split',
    };
  }
}

/**
 * Get split information from chain
 */
export async function getSplitInfo(splitAddress: Address): Promise<SplitInfo | null> {
  try {
    const result = await publicClient.readContract({
      address: SPLIT_MAIN,
      abi: SPLIT_MAIN_ABI,
      functionName: 'getSplitInfo',
      args: [splitAddress],
    }) as readonly [readonly { target: Address; allocPoints: bigint }[], bigint, bigint, Address];

    const [accounts, totalAllocPoints, distributorFee, controller] = result;

    const recipients: SplitRecipient[] = accounts.map((account: { target: Address; allocPoints: bigint }) => ({
      address: account.target,
      percentAllocation: Number(account.allocPoints) / 10000, // Convert from 4 decimal precision
    }));

    return {
      address: splitAddress,
      recipients,
      totalAllocPoints,
      distributorFee: Number(distributorFee) / 10000,
      controller: controller === '0x0000000000000000000000000000000000000000' ? null : controller,
    };
  } catch (error) {
    console.error('[SplitsService] Failed to get split info:', error);
    return null;
  }
}

/**
 * Get split token balance
 */
export async function getSplitBalance(
  splitAddress: Address,
  token: Address
): Promise<bigint> {
  try {
    const balance = await publicClient.readContract({
      address: SPLIT_MAIN,
      abi: SPLIT_MAIN_ABI,
      functionName: 'getSplitBalance',
      args: [splitAddress, token],
    });
    return balance;
  } catch (error) {
    console.error('[SplitsService] Failed to get split balance:', error);
    return 0n;
  }
}

/**
 * Distribute ERC20 token through split
 * This distributes the token balance to all recipients proportionally
 */
export async function distributeToken(
  params: DistributeTokenParams
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const { splitAddress, token, walletClient } = params;

    // Get split info to build distributions
    const splitInfo = await getSplitInfo(splitAddress);
    if (!splitInfo) {
      return { success: false, error: 'Split not found' };
    }

    // Build distributions array
    const distributions = splitInfo.recipients.map(r => ({
      recipient: r.address,
      percentAllocation: BigInt(Math.round(r.percentAllocation * 10000)),
      addressData: '0x' as `0x${string}`,
    }));

    // Encode distributeToken call
    const data = encodeFunctionData({
      abi: SPLIT_MAIN_ABI,
      functionName: 'distributeToken',
      args: [splitAddress, token, distributions],
    });

    const [account] = await walletClient.getAddresses();

    // Send transaction
    const txHash = await walletClient.sendTransaction({
      account,
      to: SPLIT_MAIN,
      data,
      chain: base,
    });

    console.log('[SplitsService] Distribute token transaction sent:', {
      txHash,
      splitAddress,
      token,
      recipients: splitInfo.recipients.length,
    });

    return { success: true, txHash };
  } catch (error) {
    console.error('[SplitsService] Failed to distribute token:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to distribute token',
    };
  }
}

/**
 * Distribute ETH through split
 */
export async function distributeETH(
  splitAddress: Address,
  walletClient: WalletClient
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    // Get split info to build distributions
    const splitInfo = await getSplitInfo(splitAddress);
    if (!splitInfo) {
      return { success: false, error: 'Split not found' };
    }

    // Build distributions array
    const distributions = splitInfo.recipients.map(r => ({
      recipient: r.address,
      percentAllocation: BigInt(Math.round(r.percentAllocation * 10000)),
      addressData: '0x' as `0x${string}`,
    }));

    // Encode distributeETH call
    const data = encodeFunctionData({
      abi: SPLIT_MAIN_ABI,
      functionName: 'distributeETH',
      args: [splitAddress, distributions],
    });

    const [account] = await walletClient.getAddresses();

    // Send transaction
    const txHash = await walletClient.sendTransaction({
      account,
      to: SPLIT_MAIN,
      data,
      chain: base,
    });

    console.log('[SplitsService] Distribute ETH transaction sent:', {
      txHash,
      splitAddress,
      recipients: splitInfo.recipients.length,
    });

    return { success: true, txHash };
  } catch (error) {
    console.error('[SplitsService] Failed to distribute ETH:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to distribute ETH',
    };
  }
}

/**
 * Check if an address is a valid split
 */
export async function isValidSplit(splitAddress: Address): Promise<boolean> {
  try {
    await publicClient.readContract({
      address: SPLIT_MAIN,
      abi: SPLIT_MAIN_ABI,
      functionName: 'getSplitInfo',
      args: [splitAddress],
    });
    return true;
  } catch {
    return false;
  }
}

export const splitsService = {
  createSplit,
  getSplitInfo,
  getSplitBalance,
  distributeToken,
  distributeETH,
  isValidSplit,
  SPLIT_MAIN,
};
