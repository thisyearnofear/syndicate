/**
 * ERC4626 YIELD CALCULATOR
 * 
 * Calculates actual historical yield for ERC4626 vaults by querying on-chain
 * Deposit and Withdraw events, rather than using forward-looking APY estimates.
 * 
 * Formula: yieldAccrued = currentTotalAssets - netDepositedAssets
 * Where netDepositedAssets = sum(all Deposit assets) - sum(all Withdraw assets)
 */

import { basePublicClient } from '@/lib/baseClient';
import { formatUnits } from 'viem';

const DEPOSIT_EVENT = {
  name: 'Deposit',
  type: 'event',
  inputs: [
    { name: 'sender', type: 'address', indexed: true },
    { name: 'owner', type: 'address', indexed: true },
    { name: 'assets', type: 'uint256', indexed: false },
    { name: 'shares', type: 'uint256', indexed: false },
  ],
} as const;

const WITHDRAW_EVENT = {
  name: 'Withdraw',
  type: 'event',
  inputs: [
    { name: 'sender', type: 'address', indexed: true },
    { name: 'receiver', type: 'address', indexed: true },
    { name: 'owner', type: 'address', indexed: true },
    { name: 'assets', type: 'uint256', indexed: false },
    { name: 'shares', type: 'uint256', indexed: false },
  ],
} as const;

// Base block ~10,000,000 is mid-2024, well before these vaults were deployed
const SAFE_FROM_BLOCK = 10000000n;

export interface NetDepositResult {
  netDepositedAssets: number;
  totalDeposited: number;
  totalWithdrawn: number;
  success: boolean;
}

/**
 * Query on-chain events to calculate the user's net deposited assets.
 * This represents the principal, allowing us to calculate exact yield.
 */
export async function getNetDepositedAssets(
  vaultAddress: `0x${string}`,
  userAddress: `0x${string}`,
  decimals: number = 6
): Promise<NetDepositResult> {
  try {
    const [depositLogs, withdrawLogs] = await Promise.all([
      basePublicClient.getLogs({
        address: vaultAddress,
        event: DEPOSIT_EVENT,
        args: { owner: userAddress },
        fromBlock: SAFE_FROM_BLOCK,
        toBlock: 'latest',
      }).catch(() => []),
      basePublicClient.getLogs({
        address: vaultAddress,
        event: WITHDRAW_EVENT,
        args: { owner: userAddress },
        fromBlock: SAFE_FROM_BLOCK,
        toBlock: 'latest',
      }).catch(() => []),
    ]);

    let totalDeposited = 0n;
    let totalWithdrawn = 0n;

    for (const log of depositLogs) {
      if (log.args.assets) {
        totalDeposited += log.args.assets;
      }
    }

    for (const log of withdrawLogs) {
      if (log.args.assets) {
        totalWithdrawn += log.args.assets;
      }
    }

    const netAssets = totalDeposited > totalWithdrawn ? totalDeposited - totalWithdrawn : 0n;

    return {
      netDepositedAssets: Number(formatUnits(netAssets, decimals)),
      totalDeposited: Number(formatUnits(totalDeposited, decimals)),
      totalWithdrawn: Number(formatUnits(totalWithdrawn, decimals)),
      success: true,
    };
  } catch (error) {
    console.error('[ERC4626YieldCalculator] Failed to fetch events:', error);
    return {
      netDepositedAssets: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
      success: false,
    };
  }
}
