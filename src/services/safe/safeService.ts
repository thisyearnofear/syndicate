/**
 * SAFE SERVICE
 * 
 * Creates and manages Gnosis Safe multisigs on Base.
 * Uses Safe Protocol Kit for Safe deployment and transaction execution.
 * 
 * March 2026: Safe{Core} Protocol Kit on Base
 * - Safe Proxy Factory: 0xa951BE5AF0Fb62a79a4D70954A8D69553207041E
 * - Safe Singleton (L2): 0x41675C099F32341bf84BFc5382aF534df5C7461a
 */

import { 
  createWalletClient, 
  http, 
  encodeFunctionData,
  type Address,
  type WalletClient,
  type PublicClient,
  parseUnits,
} from 'viem';
import { base } from 'viem/chains';
import { basePublicClient } from '@/lib/baseClient';

const BASE_CHAIN_ID = 8453;

// Safe contracts on Base (v1.4.1)
const SAFE_PROXY_FACTORY = '0xa951BE5AF0Fb62a79a4D70954A8D69553207041E' as const;
const SAFE_SINGLETON_L2 = '0x41675C099F32341bf84BFc5382aF534df5C7461a' as const;

// USDC on Base
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

// Safe Proxy Factory ABI
const SAFE_PROXY_FACTORY_ABI = [
  {
    name: 'createProxyWithNonce',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_singleton', type: 'address' },
      { name: 'initializer', type: 'bytes' },
      { name: 'saltNonce', type: 'uint256' },
    ],
    outputs: [{ name: 'proxy', type: 'address' }],
  },
  {
    name: 'proxyCreationCode',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes' }],
  },
] as const;

// Safe singleton ABI (minimal)
const SAFE_ABI = [
  {
    name: 'getOwners',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    name: 'getThreshold',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getNonce',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getTransactionHash',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
      { name: 'safeTxGas', type: 'uint256' },
      { name: 'baseGas', type: 'uint256' },
      { name: 'gasPrice', type: 'uint256' },
      { name: 'gasToken', type: 'address' },
      { name: 'refundReceiver', type: 'address' },
      { name: '_nonce', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    name: 'execTransaction',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
      { name: 'safeTxGas', type: 'uint256' },
      { name: 'baseGas', type: 'uint256' },
      { name: 'gasPrice', type: 'uint256' },
      { name: 'gasToken', type: 'address' },
      { name: 'refundReceiver', type: 'address' },
      { name: 'signatures', type: 'bytes' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
  {
    name: 'checkNSignatures',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'dataHash', type: 'bytes32' },
      { name: 'data', type: 'bytes' },
      { name: 'signatures', type: 'bytes' },
      { name: 'requiredSignatures', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

// ERC20 ABI for balance checks
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export interface SafeConfig {
  owners: Address[];
  threshold: number;
  saltNonce?: bigint;
}

export interface SafeInfo {
  address: Address;
  owners: Address[];
  threshold: number;
  nonce: number;
  chainId: number;
}

export interface CreateSafeResult {
  success: boolean;
  safeAddress?: Address;
  txHash?: string;
  error?: string;
}

export interface SafeTransaction {
  to: Address;
  value: bigint;
  data: `0x${string}`;
  operation: number; // 0 = Call, 1 = DelegateCall
  safeTxGas: bigint;
  baseGas: bigint;
  gasPrice: bigint;
  gasToken: Address;
  refundReceiver: Address;
}

const publicClient = basePublicClient as any;

/**
 * Encode the Safe setup initializer
 */
function encodeSafeSetup(config: SafeConfig): `0x${string}` {
  return encodeFunctionData({
    abi: [{
      name: 'setup',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: '_owners', type: 'address[]' },
        { name: '_threshold', type: 'uint256' },
        { name: 'to', type: 'address' },
        { name: 'data', type: 'bytes' },
        { name: 'fallbackHandler', type: 'address' },
        { name: 'paymentToken', type: 'address' },
        { name: 'payment', type: 'uint256' },
        { name: 'paymentReceiver', type: 'address' },
      ],
      outputs: [],
    }],
    functionName: 'setup',
    args: [
      config.owners,
      BigInt(config.threshold),
      '0x0000000000000000000000000000000000000000', // No fallback handler
      '0x', // No initialization data
      '0x0000000000000000000000000000000000000000', // No fallback handler
      '0x0000000000000000000000000000000000000000', // No payment token (ETH)
      0n, // No payment
      '0x0000000000000000000000000000000000000000', // No payment receiver
    ],
  }) as `0x${string}`;
}

/**
 * Create a new Safe multisig on Base
 */
export async function createSafe(
  config: SafeConfig,
  walletClient: WalletClient
): Promise<CreateSafeResult> {
  try {
    const { owners, threshold, saltNonce = BigInt(Date.now()) } = config;

    // Validate threshold
    if (threshold < 1 || threshold > owners.length) {
      return {
        success: false,
        error: `Invalid threshold: ${threshold}. Must be between 1 and ${owners.length}`,
      };
    }

    // Validate owners
    if (owners.length === 0) {
      return {
        success: false,
        error: 'At least one owner is required',
      };
    }

    // Encode the initializer
    const initializer = encodeSafeSetup(config);

    // Encode the createProxyWithNonce call
    const data = encodeFunctionData({
      abi: SAFE_PROXY_FACTORY_ABI,
      functionName: 'createProxyWithNonce',
      args: [SAFE_SINGLETON_L2, initializer, saltNonce],
    });

    const [account] = await walletClient.getAddresses();
    if (!account) {
      return { success: false, error: 'No account connected' };
    }

    // Send transaction to create Safe
    const txHash = await walletClient.sendTransaction({
      account,
      to: SAFE_PROXY_FACTORY,
      data,
      chain: base,
    });

    console.log('[SafeService] Create Safe transaction sent:', {
      txHash,
      owners,
      threshold,
      saltNonce: saltNonce.toString(),
    });

    // Wait for receipt to get the Safe address
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    
    // Parse logs to find ProxyCreation event
    // The Safe address is in the logs
    // For now, we need to decode it from the receipt logs
    
    // Look for the ProxyCreation event
    let safeAddress: Address | undefined;
    for (const log of receipt.logs) {
      // ProxyCreation event signature
      // event ProxyCreation(IProxy proxy, address singleton)
      const PROXY_CREATION_TOPIC = '0x4f517c9ee79777b8670ea8f029e752a4890f8205000000000000000000000000';
      if (log.topics[0]?.toLowerCase() === PROXY_CREATION_TOPIC.toLowerCase()) {
        // The proxy address is in topics[1]
        if (log.topics[1]) {
          safeAddress = `0x${log.topics[1].slice(26)}` as Address;
          break;
        }
      }
    }

    // If we couldn't find the address from logs, try to get it from the transaction
    // by looking at the 'return' data or using an alternative method
    if (!safeAddress) {
      // Alternative: use eth_call to simulate and get the return value
      // For now, we'll log a warning and return the txHash
      console.warn('[SafeService] Could not extract Safe address from logs. Transaction may need manual verification.');
    }

    return {
      success: true,
      safeAddress,
      txHash,
    };
  } catch (error) {
    console.error('[SafeService] Failed to create Safe:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create Safe',
    };
  }
}

/**
 * Get Safe information from chain
 */
export async function getSafeInfo(safeAddress: Address): Promise<SafeInfo | null> {
  try {
    const [owners, threshold, nonce] = await Promise.all([
      publicClient.readContract({
        address: safeAddress,
        abi: SAFE_ABI,
        functionName: 'getOwners',
      }),
      publicClient.readContract({
        address: safeAddress,
        abi: SAFE_ABI,
        functionName: 'getThreshold',
      }),
      publicClient.readContract({
        address: safeAddress,
        abi: SAFE_ABI,
        functionName: 'getNonce',
      }),
    ]);

    return {
      address: safeAddress,
      owners: owners as Address[],
      threshold: Number(threshold),
      nonce: Number(nonce),
      chainId: BASE_CHAIN_ID,
    };
  } catch (error) {
    console.error('[SafeService] Failed to get Safe info:', error);
    return null;
  }
}

/**
 * Get Safe USDC balance
 */
export async function getSafeBalance(safeAddress: Address): Promise<string> {
  try {
    const balance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [safeAddress],
    });
    return (Number(balance) / 1e6).toFixed(2); // USDC has 6 decimals
  } catch {
    return '0.00';
  }
}

/**
 * Check if an address is a valid Safe
 */
export async function isValidSafe(safeAddress: Address): Promise<boolean> {
  try {
    await publicClient.readContract({
      address: safeAddress,
      abi: SAFE_ABI,
      functionName: 'getOwners',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Calculate transaction hash for signing
 */
export async function getTransactionHash(
  safeAddress: Address,
  tx: SafeTransaction,
  nonce: number
): Promise<`0x${string}`> {
  const hash = await publicClient.readContract({
    address: safeAddress,
    abi: SAFE_ABI,
    functionName: 'getTransactionHash',
    args: [
      tx.to,
      tx.value,
      tx.data,
      tx.operation,
      tx.safeTxGas,
      tx.baseGas,
      tx.gasPrice,
      tx.gasToken,
      tx.refundReceiver,
      BigInt(nonce),
    ],
  });
  return hash as `0x${string}`;
}

/**
 * Encode signature from v, r, s
 */
export function encodeSignature(v: number, r: `0x${string}`, s: `0x${string}`): `0x${string}` {
  // Safe signature format: r + s + v (65 bytes)
  // For EIP-1271 contracts, use a different format
  const signature = r.slice(2) + s.slice(2) + v.toString(16).padStart(2, '0');
  return `0x${signature}` as `0x${string}`;
}

/**
 * Execute a Safe transaction (requires collected signatures)
 * This is typically called after threshold signatures are collected
 */
export async function executeSafeTransaction(
  safeAddress: Address,
  tx: SafeTransaction,
  signatures: `0x${string}`,
  walletClient: WalletClient
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const data = encodeFunctionData({
      abi: SAFE_ABI,
      functionName: 'execTransaction',
      args: [
        tx.to,
        tx.value,
        tx.data,
        tx.operation,
        tx.safeTxGas,
        tx.baseGas,
        tx.gasPrice,
        tx.gasToken,
        tx.refundReceiver,
        signatures,
      ],
    });

    const [account] = await walletClient.getAddresses();

    const txHash = await walletClient.sendTransaction({
      account,
      to: safeAddress,
      data,
      chain: base,
    });

    console.log('[SafeService] Safe transaction executed:', {
      txHash,
      safeAddress,
    });

    return { success: true, txHash };
  } catch (error) {
    console.error('[SafeService] Failed to execute Safe transaction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute Safe transaction',
    };
  }
}

/**
 * Create a USDC transfer transaction from Safe
 */
export function createUSDCTransfer(
  recipient: Address,
  amountUsdc: number
): SafeTransaction {
  const amountWei = parseUnits(String(amountUsdc), 6);

  const transferData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [recipient, amountWei],
  });

  return {
    to: USDC_ADDRESS,
    value: 0n,
    data: transferData,
    operation: 0, // Call
    safeTxGas: 0n,
    baseGas: 0n,
    gasPrice: 0n,
    gasToken: '0x0000000000000000000000000000000000000000',
    refundReceiver: '0x0000000000000000000000000000000000000000',
  };
}

export const safeService = {
  createSafe,
  getSafeInfo,
  getSafeBalance,
  isValidSafe,
  getTransactionHash,
  encodeSignature,
  executeSafeTransaction,
  createUSDCTransfer,
  SAFE_PROXY_FACTORY,
  SAFE_SINGLETON_L2,
};
