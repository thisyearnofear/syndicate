/**
 * POOLTOGETHER VAULT SERVICE
 * 
 * Fetches real vault information from PoolTogether V5 contracts on Base.
 * Uses the PrizeVaultFactory to look up vault metadata.
 * 
 * PoolTogether V5 on Base:
 * - PrizeVaultFactory: 0xa55a74A457D8a24D68DdA0b5d1E0341746d444Bf
 * - PrizePool: 0x45b2010d8a4f08b53c9fa7544c51dfd9733732cb
 * - TwabController: 0x7e63601f7e28c758feccf8cdf02f6598694f44c6
 */

import { createPublicClient, http, formatUnits, type Address } from 'viem';
import { base } from 'viem/chains';

const BASE_CHAIN_ID = 8453;

// PoolTogether V5 contracts on Base
const PRIZE_VAULT_FACTORY = '0xa55a74A457D8a24D68DdA0b5d1E0341746d444Bf' as const;
const PRIZE_POOL = '0x45b2010d8a4f08b53c9fa7544c51dfd9733732cb' as const;

// USDC on Base
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

// Known USDC vaults on Base (from deployment docs)
const KNOWN_USDC_VAULTS: Address[] = [
  '0x6B5a5c55E9dD4bb502Ce25bBfbaA49b69cf7E4dd', // POOL Prize Vault (from docs)
];

// ERC4626 Vault ABI (partial)
const ERC4626_ABI = [
  {
    name: 'asset',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'totalAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'convertToAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// ERC20 ABI for asset info
const ERC20_ABI = [
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;

export interface PoolTogetherVault {
  address: Address;
  name: string;
  symbol: string;
  asset: {
    address: Address;
    name: string;
    symbol: string;
    decimals: number;
  };
  totalAssets: string;
  totalAssetsFormatted: string;
  totalSupply: string;
  isUSDC: boolean;
  chainId: number;
}

export interface PoolTogetherVaultStats {
  vault: PoolTogetherVault;
  apy: number; // Estimated from prize distribution
  tvl: string;
  tvlFormatted: string;
  holderCount: number;
}

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

/**
 * Fetch vault information from a PoolTogether PrizeVault address
 */
export async function fetchVaultInfo(vaultAddress: Address): Promise<PoolTogetherVault | null> {
  try {
    // Fetch vault metadata
    const [name, symbol, decimals, assetAddress] = await Promise.all([
      publicClient.readContract({
        address: vaultAddress,
        abi: ERC4626_ABI,
        functionName: 'name',
      }),
      publicClient.readContract({
        address: vaultAddress,
        abi: ERC4626_ABI,
        functionName: 'symbol',
      }),
      publicClient.readContract({
        address: vaultAddress,
        abi: ERC4626_ABI,
        functionName: 'decimals',
      }),
      publicClient.readContract({
        address: vaultAddress,
        abi: ERC4626_ABI,
        functionName: 'asset',
      }),
    ]);

    // Fetch asset metadata
    const [assetName, assetSymbol, assetDecimals] = await Promise.all([
      publicClient.readContract({
        address: assetAddress,
        abi: ERC20_ABI,
        functionName: 'name',
      }),
      publicClient.readContract({
        address: assetAddress,
        abi: ERC20_ABI,
        functionName: 'symbol',
      }),
      publicClient.readContract({
        address: assetAddress,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }),
    ]);

    // Fetch vault stats
    const [totalAssets, totalSupply] = await Promise.all([
      publicClient.readContract({
        address: vaultAddress,
        abi: ERC4626_ABI,
        functionName: 'totalAssets',
      }),
      publicClient.readContract({
        address: vaultAddress,
        abi: ERC4626_ABI,
        functionName: 'totalSupply',
      }),
    ]);

    const totalAssetsFormatted = formatUnits(totalAssets, assetDecimals);

    return {
      address: vaultAddress,
      name,
      symbol,
      asset: {
        address: assetAddress,
        name: assetName,
        symbol: assetSymbol,
        decimals: assetDecimals,
      },
      totalAssets: totalAssets.toString(),
      totalAssetsFormatted,
      totalSupply: totalSupply.toString(),
      isUSDC: assetAddress.toLowerCase() === USDC_ADDRESS.toLowerCase(),
      chainId: BASE_CHAIN_ID,
    };
  } catch (error) {
    console.error('[PoolTogetherVaultService] Failed to fetch vault info:', error);
    return null;
  }
}

/**
 * Fetch the main USDC PrizeVault on Base
 * This is the vault used for syndicate pooling
 */
export async function fetchUSDCVault(): Promise<PoolTogetherVault | null> {
  // Use the known USDC vault from deployment docs
  const vaultAddress = KNOWN_USDC_VAULTS[0];
  
  if (!vaultAddress) {
    console.error('[PoolTogetherVaultService] No known USDC vault address');
    return null;
  }

  return fetchVaultInfo(vaultAddress);
}

/**
 * Check if an address is a valid PoolTogether vault
 */
export async function isValidVault(vaultAddress: Address): Promise<boolean> {
  try {
    // Try to read vault metadata - if it succeeds, it's likely a valid vault
    await publicClient.readContract({
      address: vaultAddress,
      abi: ERC4626_ABI,
      functionName: 'asset',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get vault statistics for display
 */
export async function fetchVaultStats(vaultAddress: Address): Promise<PoolTogetherVaultStats | null> {
  const vault = await fetchVaultInfo(vaultAddress);
  if (!vault) return null;

  // PoolTogether V5 typically generates 2-5% APY from prizes
  // This is a rough estimate - in production, calculate from prize history
  const estimatedAPY = 3.5;

  return {
    vault,
    apy: estimatedAPY,
    tvl: vault.totalAssets,
    tvlFormatted: `$${parseFloat(vault.totalAssetsFormatted).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    holderCount: 0, // Would need subgraph query for accurate count
  };
}

/**
 * Get user's vault balance
 */
export async function getUserVaultBalance(
  vaultAddress: Address,
  userAddress: Address
): Promise<{ shares: string; assets: string; assetsFormatted: string } | null> {
  try {
    const [shares, assetAddress] = await Promise.all([
      publicClient.readContract({
        address: vaultAddress,
        abi: ERC4626_ABI,
        functionName: 'balanceOf',
        args: [userAddress],
      }),
      publicClient.readContract({
        address: vaultAddress,
        abi: ERC4626_ABI,
        functionName: 'asset',
      }),
    ]);

    const assets = await publicClient.readContract({
      address: vaultAddress,
      abi: ERC4626_ABI,
      functionName: 'convertToAssets',
      args: [shares],
    });

    // Determine decimals from asset (assume 6 for USDC)
    const decimals = assetAddress.toLowerCase() === USDC_ADDRESS.toLowerCase() ? 6 : 18;

    return {
      shares: shares.toString(),
      assets: assets.toString(),
      assetsFormatted: formatUnits(assets, decimals),
    };
  } catch (error) {
    console.error('[PoolTogetherVaultService] Failed to get user balance:', error);
    return null;
  }
}

export const poolTogetherVaultService = {
  fetchVaultInfo,
  fetchUSDCVault,
  isValidVault,
  fetchVaultStats,
  getUserVaultBalance,
  KNOWN_USDC_VAULTS,
};
