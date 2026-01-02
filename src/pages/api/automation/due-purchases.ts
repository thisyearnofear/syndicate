/**
 * API Route: Get purchases due for execution
 * 
 * Called by: Gelato Web3 Function
 * Purpose: Query Neon Postgres for active purchases that are scheduled to run
 * 
 * Requires: Valid Authorization header with GELATO_INTERNAL_API_KEY
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '@vercel/postgres';

interface AutoPurchaseRecord {
  id: string;
  userAddress: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  amountPerPeriod: string;
  isActive: boolean;
  lastExecutedAt: number;
  permissionId: string;
  nonce: number;
}

interface DuePurchasesResponse {
  purchases: AutoPurchaseRecord[];
  count: number;
}

/**
 * Verify Gelato's internal API key
 */
function verifyGelatoAuth(req: NextApiRequest): boolean {
  const authHeader = req.headers.authorization;
  const expectedToken = `Bearer ${process.env.GELATO_INTERNAL_API_KEY}`;
  return authHeader === expectedToken;
}

/**
 * Calculate frequency interval in seconds
 */
function getFrequencySeconds(
  frequency: 'daily' | 'weekly' | 'monthly'
): number {
  switch (frequency) {
    case 'daily':
      return 86400; // 24 hours
    case 'weekly':
      return 604800; // 7 days
    case 'monthly':
      return 2592000; // 30 days
    default:
      return 604800;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DuePurchasesResponse | { error: string }>
) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify authentication
  if (!verifyGelatoAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { currentTimestamp } = req.body as { currentTimestamp: number };

    if (!currentTimestamp || typeof currentTimestamp !== 'number') {
      return res
        .status(400)
        .json({ error: 'Missing or invalid currentTimestamp' });
    }

    // Query all active auto-purchases
    const result = await sql<AutoPurchaseRecord>`
      SELECT 
        id,
        user_address AS "userAddress",
        frequency,
        amount_per_period AS "amountPerPeriod",
        is_active AS "isActive",
        last_executed_at AS "lastExecutedAt",
        permission_id AS "permissionId",
        nonce
      FROM auto_purchases
      WHERE is_active = true
      ORDER BY last_executed_at ASC
    `;

    // Filter for purchases that are due
    const purchases = result.rows.filter(record => {
      const frequencySeconds = getFrequencySeconds(record.frequency);
      const secondsSinceLastExecution = currentTimestamp - record.lastExecutedAt;

      // Add 5-minute buffer for network/processing delays
      return secondsSinceLastExecution >= frequencySeconds - 300;
    });

    console.log(
      `[API] Found ${purchases.length} due purchases out of ${result.rows.length} total active`
    );

    return res.status(200).json({
      purchases,
      count: purchases.length,
    });
  } catch (error) {
    console.error('[API] Error fetching due purchases:', error);
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Internal server error',
    });
  }
}
