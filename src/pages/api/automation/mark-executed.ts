/**
 * API Route: Mark purchases as executed
 * 
 * Called by: Gelato Web3 Function (onSuccess callback)
 * Purpose: Update Neon Postgres after successful on-chain execution
 * 
 * Updates: last_executed_at timestamp in auto_purchases table
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '@vercel/postgres';

interface MarkExecutedResponse {
  updated: number;
  timestamp: number;
}

/**
 * Verify Gelato's internal API key
 */
function verifyGelatoAuth(req: NextApiRequest): boolean {
  const authHeader = req.headers.authorization;
  const expectedToken = `Bearer ${process.env.GELATO_INTERNAL_API_KEY}`;
  return authHeader === expectedToken;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MarkExecutedResponse | { error: string }>
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
    const { recordIds, executedAt } = req.body as {
      recordIds: string[];
      executedAt: number;
    };

    if (!Array.isArray(recordIds) || recordIds.length === 0) {
      return res.status(400).json({ error: 'Invalid recordIds' });
    }

    if (!executedAt || typeof executedAt !== 'number') {
      return res
        .status(400)
        .json({ error: 'Missing or invalid executedAt timestamp' });
    }

    // Update all executed records
    const result = await sql`
      UPDATE auto_purchases
      SET 
        last_executed_at = ${executedAt},
        updated_at = NOW()
      WHERE id = ANY(${recordIds}::uuid[])
      RETURNING id
    `;

    console.log(
      `[API] Marked ${result.rowCount} purchases as executed at ${new Date(executedAt * 1000).toISOString()}`
    );

    return res.status(200).json({
      updated: result.rowCount || 0,
      timestamp: executedAt,
    });
  } catch (error) {
    console.error('[API] Error marking purchases as executed:', error);
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Internal server error',
    });
  }
}
