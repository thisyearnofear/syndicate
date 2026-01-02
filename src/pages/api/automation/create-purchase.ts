/**
 * Create Auto-Purchase Record
 * 
 * Called when user grants MetaMask Advanced Permission
 * Stores auto-purchase config in database for Vercel Cron to execute
 * 
 * Flow:
 * 1. User grants permission in modal
 * 2. Frontend calls this endpoint
 * 3. Creates record in auto_purchases table
 * 4. Vercel Cron finds it hourly and executes
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '@vercel/postgres';

interface CreatePurchaseRequest {
  userAddress: string;
  permissionId: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  amountPerPeriod: string; // Bigint as string (e.g., "50000000")
}

interface CreatePurchaseResponse {
  success: boolean;
  purchaseId?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CreatePurchaseResponse>
) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userAddress, permissionId, frequency, amountPerPeriod } =
      req.body as CreatePurchaseRequest;

    // Validate inputs
    if (!userAddress || !permissionId || !frequency || !amountPerPeriod) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
      return res.status(400).json({ error: 'Invalid frequency' });
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);

    // Insert into database
    const result = await sql`
      INSERT INTO auto_purchases (
        id,
        user_address,
        permission_id,
        frequency,
        amount_per_period,
        is_active,
        last_executed_at,
        nonce,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        ${userAddress},
        ${permissionId},
        ${frequency},
        ${amountPerPeriod},
        true,
        ${currentTimestamp},
        0,
        NOW(),
        NOW()
      )
      RETURNING id
    `;

    const purchaseId = result.rows[0]?.id;

    if (!purchaseId) {
      return res.status(500).json({ error: 'Failed to create purchase record' });
    }

    console.log('[API] Auto-purchase created:', {
      purchaseId,
      userAddress,
      permissionId,
      frequency,
      amount: amountPerPeriod,
    });

    return res.status(201).json({
      success: true,
      purchaseId,
    });
  } catch (error) {
    console.error('[API] Error creating auto-purchase:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Failed to create purchase record';

    return res.status(500).json({
      error: errorMessage,
    });
  }
}
