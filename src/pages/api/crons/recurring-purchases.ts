/**
 * Recurring Purchases Cron Job
 * 
 * Triggered hourly by Vercel Cron
 * Orchestrates the recurring purchase automation flow:
 * 1. Query due purchases from database
 * 2. Verify permissions are valid
 * 3. Execute purchases on-chain
 * 4. Mark as executed in database
 * 
 * No authentication needed - only runs on Vercel infrastructure
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '@vercel/postgres';
import { ethers } from 'ethers';

interface AutoPurchaseRecord {
  id: string;
  user_address: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  amount_per_period: string;
  is_active: boolean;
  last_executed_at: number;
  permission_id: string;
}

interface CronResponse {
  success: boolean;
  executed: number;
  attempted: number;
  errors: string[];
}

// ============================================================================
// HELPERS
// ============================================================================

function getFrequencySeconds(frequency: 'daily' | 'weekly' | 'monthly'): number {
  const intervals = {
    daily: 24 * 60 * 60,
    weekly: 7 * 24 * 60 * 60,
    monthly: 30 * 24 * 60 * 60,
  };
  return intervals[frequency];
}

function isPurchaseDue(
  frequency: 'daily' | 'weekly' | 'monthly',
  lastExecutedAt: number,
  currentTimestamp: number
): boolean {
  const intervalSeconds = getFrequencySeconds(frequency);
  const secondsSinceLastExecution = currentTimestamp - lastExecutedAt;
  // 5-minute grace period for processing delays
  return secondsSinceLastExecution >= intervalSeconds - 300;
}

async function verifyPermission(
  permissionId: string,
  userAddress: string,
  requiredAmount: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'}/api/permissions/verify`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GELATO_INTERNAL_API_KEY || ''}`,
        },
        body: JSON.stringify({
          permissionId,
          userAddress,
          requiredAmount,
        }),
      }
    );

    if (!response.ok) {
      console.log(`[Cron] Permission verification failed for ${permissionId}: ${response.status}`);
      return false;
    }

    const data = (await response.json()) as {
      isValid: boolean;
      remaining: string;
    };

    return data.isValid && BigInt(data.remaining) >= BigInt(requiredAmount);
  } catch (error) {
    console.error('[Cron] Permission verification error:', error);
    return false;
  }
}

async function executePermittedTickets(
  userAddress: string,
  amountUsdc: string,
  permissionId: string,
  recordId: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'}/api/automation/execute-purchase-tickets`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAddress,
          amountUsdc,
          permissionId,
          recordId,
        }),
      }
    );

    if (!response.ok) {
      console.error(
        `[Cron] Execution failed for ${recordId}: ${response.status} ${response.statusText}`
      );
      return false;
    }

    const data = (await response.json()) as { success: boolean };
    return data.success;
  } catch (error) {
    console.error(`[Cron] Execution error for ${recordId}:`, error);
    return false;
  }
}

async function markExecuted(recordId: string, executedAt: number): Promise<boolean> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'}/api/automation/mark-executed`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GELATO_INTERNAL_API_KEY || ''}`,
        },
        body: JSON.stringify({
          recordIds: [recordId],
          executedAt,
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error(`[Cron] Mark executed error for ${recordId}:`, error);
    return false;
  }
}

// ============================================================================
// MAIN CRON HANDLER
// ============================================================================

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CronResponse>
) {
  // Only allow POST (Vercel Cron sends POST)
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      executed: 0,
      attempted: 0,
      errors: ['Method not allowed'],
    });
  }

  const currentTimestamp = Math.floor(Date.now() / 1000);
  const errors: string[] = [];
  let executedCount = 0;
  let attemptedCount = 0;

  console.log(`[Cron] Starting recurring purchases check at ${new Date().toISOString()}`);

  try {
    // STEP 1: Query all active auto-purchases
    const result = await sql<AutoPurchaseRecord>`
      SELECT 
        id,
        user_address,
        frequency,
        amount_per_period,
        is_active,
        last_executed_at,
        permission_id
      FROM auto_purchases
      WHERE is_active = true
      ORDER BY last_executed_at ASC
    `;

    const purchases = result.rows;
    console.log(`[Cron] Found ${purchases.length} active purchases`);

    if (purchases.length === 0) {
      return res.json({
        success: true,
        executed: 0,
        attempted: 0,
        errors: [],
      });
    }

    // STEP 2: Filter for purchases that are due
    const duePurchases = purchases.filter(p =>
      isPurchaseDue(p.frequency, p.last_executed_at, currentTimestamp)
    );

    console.log(`[Cron] ${duePurchases.length} purchases are due for execution`);

    // STEP 3: Process each due purchase
    for (const purchase of duePurchases) {
      attemptedCount++;

      // Verify permission is still valid
      const isEligible = await verifyPermission(
        purchase.permission_id,
        purchase.user_address,
        purchase.amount_per_period
      );

      if (!isEligible) {
        const error = `Permission verification failed for ${purchase.id}`;
        console.log(`[Cron] ${error}`);
        errors.push(error);
        continue;
      }

      // Execute purchase on-chain
      const success = await executePermittedTickets(
        purchase.user_address,
        purchase.amount_per_period,
        purchase.permission_id,
        purchase.id
      );

      if (!success) {
        const error = `Execution failed for ${purchase.id}`;
        console.error(`[Cron] ${error}`);
        errors.push(error);
        continue;
      }

      // Mark as executed in database
      const marked = await markExecuted(purchase.id, currentTimestamp);

      if (marked) {
        executedCount++;
        console.log(`[Cron] ✅ Executed purchase ${purchase.id} for ${purchase.user_address}`);
      } else {
        const error = `Failed to mark ${purchase.id} as executed`;
        console.error(`[Cron] ${error}`);
        errors.push(error);
      }
    }

    console.log(
      `[Cron] Completed: ${executedCount}/${attemptedCount} purchases executed successfully`
    );

    return res.json({
      success: executedCount > 0 || errors.length === 0,
      executed: executedCount,
      attempted: attemptedCount,
      errors,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Cron] Fatal error:`, error);
    errors.push(errorMessage);

    return res.json({
      success: false,
      executed: executedCount,
      attempted: attemptedCount,
      errors,
    });
  }
}
