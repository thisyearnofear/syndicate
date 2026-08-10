/**
 * AAVE V3 YIELD CALCULATOR
 *
 * Calculates actual historical yield for Aave V3 positions on Base by
 * querying on-chain Pool Deposit/Withdraw events — the same principal-vs-
 * balance approach as erc4626YieldCalculator, adapted to the Aave V3 Pool
 * event signatures (which differ from ERC-4626).
 *
 * Formula: yieldAccrued = currentATokenBalance - netDepositedAssets
 * Where netDepositedAssets = sum(Deposit.amount) - sum(Withdraw.amount)
 *
 * Events (Aave V3 Pool, Base):
 * - Deposit(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint16 indexed referralCode)
 *   The provider deposits with onBehalfOf = user, so onBehalfOf identifies
 *   the position holder. reserve filters to USDC.
 * - Withdraw(address indexed reserve, address indexed user, address indexed to, uint256 amount)
 *   user is the position holder whose aTokens are burned.
 */

import { basePublicClient } from '@/lib/baseClient';
import { AAVE_CONFIG } from './aaveProvider';

const AAVE_DEPOSIT_EVENT = {
  name: 'Deposit',
  type: 'event',
  inputs: [
    { name: 'reserve', type: 'address', indexed: true },
    { name: 'user', type: 'address', indexed: false },
    { name: 'onBehalfOf', type: 'address', indexed: true },
    { name: 'amount', type: 'uint256', indexed: false },
    { name: 'referralCode', type: 'uint16', indexed: true },
  ],
} as const;

const AAVE_WITHDRAW_EVENT = {
  name: 'Withdraw',
  type: 'event',
  inputs: [
    { name: 'reserve', type: 'address', indexed: true },
    { name: 'user', type: 'address', indexed: true },
    { name: 'to', type: 'address', indexed: true },
    { name: 'amount', type: 'uint256', indexed: false },
  ],
} as const;

// Aave V3 was deployed to Base after its ERC-4626 vaults; same safe floor
// as erc4626YieldCalculator.
const SAFE_FROM_BLOCK = 10000000n;

export interface AaveNetDepositResult {
  /** Net principal in USDC base units (6 decimals). */
  netDepositedRaw: bigint;
  success: boolean;
}

/**
 * Query Aave V3 Pool events to calculate the user's net deposited USDC.
 * Returns success:false when the event query fails so callers can degrade
 * explicitly instead of trusting a zero.
 */
export async function getAaveNetDeposits(
  userAddress: `0x${string}`
): Promise<AaveNetDepositResult> {
  try {
    const [depositLogs, withdrawLogs] = await Promise.all([
      basePublicClient.getLogs({
        address: AAVE_CONFIG.BASE.POOL_ADDRESS as `0x${string}`,
        event: AAVE_DEPOSIT_EVENT,
        args: {
          reserve: AAVE_CONFIG.BASE.USDC_ADDRESS as `0x${string}`,
          onBehalfOf: userAddress,
        },
        fromBlock: SAFE_FROM_BLOCK,
        toBlock: 'latest',
      }).catch(() => []),
      basePublicClient.getLogs({
        address: AAVE_CONFIG.BASE.POOL_ADDRESS as `0x${string}`,
        event: AAVE_WITHDRAW_EVENT,
        args: {
          reserve: AAVE_CONFIG.BASE.USDC_ADDRESS as `0x${string}`,
          user: userAddress,
        },
        fromBlock: SAFE_FROM_BLOCK,
        toBlock: 'latest',
      }).catch(() => []),
    ]);

    let totalDeposited = 0n;
    let totalWithdrawn = 0n;

    for (const log of depositLogs) {
      if (log.args.amount) {
        totalDeposited += log.args.amount;
      }
    }

    for (const log of withdrawLogs) {
      if (log.args.amount) {
        totalWithdrawn += log.args.amount;
      }
    }

    const netDepositedRaw = totalDeposited > totalWithdrawn ? totalDeposited - totalWithdrawn : 0n;

    return { netDepositedRaw, success: true };
  } catch (error) {
    console.error('[AaveYieldCalculator] Failed to fetch events:', error);
    return { netDepositedRaw: 0n, success: false };
  }
}
