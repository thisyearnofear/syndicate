/**
 * GELATO WEB3 FUNCTION - Recurring Ticket Purchase Automation
 *
 * This is a Gelato Web3 Function that runs off-chain and triggers on-chain purchases.
 * 
 * Deployment:
 * 1. npx gelato-cli create --name syndicate-recurring-purchases
 * 2. Deploy this function to IPFS via Gelato Dashboard
 * 3. Create a time-based task via gelatoService.createAutoPurchaseTask()
 *
 * Flow:
 * 1. Gelato runs this function on schedule (daily/weekly/monthly)
 * 2. Function queries Neon Postgres for users with active purchases
 * 3. For each eligible user, it checks if conditions are met
 * 4. If yes, encodes the purchaseTickets call and returns it
 * 5. Gelato submits the transaction on-chain
 */

import { Contract, ethers } from 'ethers';

// =============================================================================
// TYPES
// =============================================================================

interface TaskContext {
  taskId: string;
  autoBot: string;
  chainId: number;
}

interface AutoPurchaseRecord {
  id: string;
  userAddress: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  amountPerPeriod: string; // USDC amount as string (6 decimals)
  isActive: boolean;
  lastExecutedAt: number; // Unix timestamp
  permissionId: string;
  nonce: number; // For Neon Postgres optimistic locking
}

interface ExecutionContext {
  currentTimestamp: number;
  userAddress: string;
  amountUsdc: string;
  referrer: string;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

// These should match your existing contract config
const MEGAPOT_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'referrer', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'address', name: 'recipient', type: 'address' },
    ],
    name: 'purchaseTickets',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
];

const MEGAPOT_ADDRESS = process.env.MEGAPOT_ADDRESS || '0x'; // Set in Gelato env
const NEON_CONNECTION_STRING =
  process.env.NEON_DATABASE_URL || '';

// =============================================================================
// HELPER: Check if purchase is due based on frequency
// =============================================================================

function isPurchaseDue(
  frequency: 'daily' | 'weekly' | 'monthly',
  lastExecutedAt: number,
  currentTimestamp: number
): boolean {
  const intervals = {
    daily: 24 * 60 * 60, // seconds
    weekly: 7 * 24 * 60 * 60,
    monthly: 30 * 24 * 60 * 60,
  };

  const intervalSeconds = intervals[frequency];
  const secondsSinceLastExecution = currentTimestamp - lastExecutedAt;

  // Allow 5 minute grace period to account for network delays
  return secondsSinceLastExecution >= intervalSeconds - 300;
}

// =============================================================================
// HELPER: Query Neon Postgres for due purchases
// =============================================================================

async function getDuePurchases(
  currentTimestamp: number
): Promise<AutoPurchaseRecord[]> {
  if (!NEON_CONNECTION_STRING) {
    console.log('[Gelato Web3Function] NEON_DATABASE_URL not set, skipping query');
    return [];
  }

  try {
    // Using fetch API to query Postgres via HTTP (Gelato environment limitation)
    // In production, you'd use a REST API endpoint that wraps your Neon queries
    const response = await fetch(
      `${process.env.API_BASE_URL}/api/automation/due-purchases`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GELATO_INTERNAL_API_KEY}`,
        },
        body: JSON.stringify({
          currentTimestamp,
        }),
      }
    );

    if (!response.ok) {
      console.error(
        '[Gelato Web3Function] Failed to fetch due purchases:',
        response.statusText
      );
      return [];
    }

    const data = (await response.json()) as { purchases: AutoPurchaseRecord[] };
    return data.purchases || [];
  } catch (error) {
    console.error('[Gelato Web3Function] Database query error:', error);
    return [];
  }
}

// =============================================================================
// HELPER: Verify purchase is still valid
// =============================================================================

async function verifyPurchaseEligibility(
  record: AutoPurchaseRecord,
  context: TaskContext
): Promise<boolean> {
  try {
    // Check via API endpoint that permission is still active
    const response = await fetch(
      `${process.env.API_BASE_URL}/api/permissions/verify`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GELATO_INTERNAL_API_KEY}`,
        },
        body: JSON.stringify({
          permissionId: record.permissionId,
          userAddress: record.userAddress,
          requiredAmount: record.amountPerPeriod,
        }),
      }
    );

    if (!response.ok) {
      console.log(
        `[Gelato Web3Function] Permission verification failed for ${record.userAddress}`
      );
      return false;
    }

    const data = (await response.json()) as {
      isValid: boolean;
      remaining: string;
    };
    return data.isValid && BigInt(data.remaining) >= BigInt(record.amountPerPeriod);
  } catch (error) {
    console.error(
      '[Gelato Web3Function] Eligibility verification error:',
      error
    );
    return false;
  }
}

// =============================================================================
// MAIN WEB3 FUNCTION
// =============================================================================

/**
 * Main Gelato Web3 Function entrypoint
 * Called by Gelato on schedule, returns execData for on-chain execution
 */
export async function web3Function(
  userArgs: Record<string, unknown>,
  context: TaskContext
) {
  const { taskId, autoBot, chainId } = context;
  const currentTimestamp = Math.floor(Date.now() / 1000);

  console.log(`[Gelato Web3Function] Starting execution at ${currentTimestamp}`);

  try {
    // STEP 1: Query for due purchases
    const duePurchases = await getDuePurchases(currentTimestamp);
    console.log(
      `[Gelato Web3Function] Found ${duePurchases.length} due purchases`
    );

    if (duePurchases.length === 0) {
      return {
        canExec: false,
        reason: 'No purchases due at this time',
      };
    }

    // STEP 2: Filter and verify eligible purchases
    const executablePurchases: Array<{
      record: AutoPurchaseRecord;
      context: ExecutionContext;
    }> = [];

    for (const record of duePurchases) {
      // Check if enough time has passed since last execution
      if (
        !isPurchaseDue(
          record.frequency,
          record.lastExecutedAt,
          currentTimestamp
        )
      ) {
        console.log(
          `[Gelato Web3Function] Purchase ${record.id} not yet due (frequency: ${record.frequency})`
        );
        continue;
      }

      // Verify permission is still valid
      const isEligible = await verifyPurchaseEligibility(record, context);
      if (!isEligible) {
        console.log(
          `[Gelato Web3Function] Purchase ${record.id} no longer eligible`
        );
        // Could disable the purchase in DB here
        continue;
      }

      executablePurchases.push({
        record,
        context: {
          currentTimestamp,
          userAddress: record.userAddress,
          amountUsdc: record.amountPerPeriod,
          referrer: process.env.DEFAULT_REFERRER || '0x0000000000000000000000000000000000000000',
        },
      });
    }

    if (executablePurchases.length === 0) {
      return {
        canExec: false,
        reason: 'No eligible purchases to execute',
      };
    }

    // STEP 3: Encode transaction calls
    const calls = executablePurchases.map(({ record, context: ctx }) => {
      const iface = new ethers.utils.Interface(MEGAPOT_ABI);
      const encoded = iface.encodeFunctionData('purchaseTickets', [
        ctx.referrer,
        ethers.utils.parseUnits(ctx.amountUsdc, 6), // USDC has 6 decimals
        ctx.userAddress,
      ]);

      return {
        to: MEGAPOT_ADDRESS,
        data: encoded,
        value: '0',
        recordId: record.id,
      };
    });

    console.log(
      `[Gelato Web3Function] Encoding ${calls.length} transactions for execution`
    );

    // STEP 4: Return execution data
    // Gelato will submit these transactions
    return {
      canExec: true,
      execData: calls.map(call => ({
        to: call.to,
        data: call.data,
        value: call.value,
      })),
      metadata: {
        timestamp: currentTimestamp,
        count: calls.length,
        recordIds: calls.map(c => c.recordId),
      },
    };
  } catch (error) {
    console.error('[Gelato Web3Function] Execution failed:', error);
    return {
      canExec: false,
      reason: `Execution error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// =============================================================================
// OPTIONAL: Callback after on-chain execution
// =============================================================================

/**
 * Called by Gelato after successful on-chain execution
 * Update Neon database with execution timestamp
 */
export async function onSuccess(
  callData: { recordIds: string[] },
  context: TaskContext
) {
  const currentTimestamp = Math.floor(Date.now() / 1000);

  try {
    await fetch(`${process.env.API_BASE_URL}/api/automation/mark-executed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GELATO_INTERNAL_API_KEY}`,
      },
      body: JSON.stringify({
        recordIds: callData.recordIds,
        executedAt: currentTimestamp,
      }),
    });

    console.log(
      `[Gelato Web3Function] Marked ${callData.recordIds.length} purchases as executed`
    );
  } catch (error) {
    console.error('[Gelato Web3Function] Failed to update database:', error);
  }
}

// =============================================================================
// OPTIONAL: Callback on execution failure
// =============================================================================

/**
 * Called by Gelato if on-chain execution fails
 * Could implement retry logic or user notifications
 */
export async function onFail(
  callData: unknown,
  context: TaskContext,
  reason: string
) {
  console.error(
    `[Gelato Web3Function] Task ${context.taskId} failed: ${reason}`
  );

  // Could notify user, disable automation, etc.
  // await notifyUser(reason);
}
