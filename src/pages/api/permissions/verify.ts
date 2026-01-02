/**
 * API Route: Verify permission is still valid
 * 
 * Called by: Gelato Web3 Function before execution
 * Purpose: Check that user still has valid permission and sufficient allowance
 * 
 * Returns: isValid flag and remaining allowance
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '@vercel/postgres';

interface PermissionVerification {
  isValid: boolean;
  remaining: string;
  reason?: string;
}

/**
 * Verify Gelato's internal API key
 */
function verifyGelatoAuth(req: NextApiRequest): boolean {
  const authHeader = req.headers.authorization;
  const expectedToken = `Bearer ${process.env.GELATO_INTERNAL_API_KEY}`;
  return authHeader === expectedToken;
}

interface PermissionRecord {
  id: string;
  isActive: boolean;
  remaining: string;
  expiresAt: number | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PermissionVerification | { error: string }>
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
    const { permissionId, userAddress, requiredAmount } = req.body as {
      permissionId: string;
      userAddress: string;
      requiredAmount: string;
    };

    if (!permissionId || !userAddress || !requiredAmount) {
      return res
        .status(400)
        .json({
          error: 'Missing permissionId, userAddress, or requiredAmount',
        });
    }

    // Query permission from database (adjust table/column names to match your schema)
    const result = await sql<PermissionRecord>`
      SELECT 
        id,
        is_active AS "isActive",
        remaining,
        expires_at AS "expiresAt"
      FROM advanced_permissions
      WHERE id = ${permissionId}
        AND user_address = ${userAddress}
      LIMIT 1
    `;

    if (result.rowCount === 0) {
      return res.status(200).json({
        isValid: false,
        remaining: '0',
        reason: 'Permission not found',
      });
    }

    const permission = result.rows[0];
    const now = Math.floor(Date.now() / 1000);
    const remaining = BigInt(permission.remaining);
    const required = BigInt(requiredAmount);

    // Verify permission is still active
    if (!permission.isActive) {
      return res.status(200).json({
        isValid: false,
        remaining: permission.remaining,
        reason: 'Permission is not active',
      });
    }

    // Check if permission has expired
    if (permission.expiresAt && permission.expiresAt < now) {
      return res.status(200).json({
        isValid: false,
        remaining: permission.remaining,
        reason: 'Permission has expired',
      });
    }

    // Check if remaining allowance is sufficient
    if (remaining < required) {
      return res.status(200).json({
        isValid: false,
        remaining: permission.remaining,
        reason: `Insufficient allowance: ${permission.remaining} < ${requiredAmount}`,
      });
    }

    // All checks passed
    return res.status(200).json({
      isValid: true,
      remaining: permission.remaining,
    });
  } catch (error) {
    console.error('[API] Error verifying permission:', error);
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Internal server error',
    });
  }
}
