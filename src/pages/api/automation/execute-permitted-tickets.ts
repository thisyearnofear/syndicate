/**
 * API ROUTE: Execute Permitted Tickets
 * 
 * Endpoint: POST /api/automation/execute-permitted-tickets
 * 
 * Purpose:
 * - Execute scheduled automated ticket purchases for users with Advanced Permissions
 * - Can be called by:
 *   1. Frontend (manual trigger)
 *   2. Backend cron job (scheduled automation)
 *   3. External webhook (from automation service)
 * 
 * Security:
 * - Validates permission has not expired
 * - Verifies user has sufficient allowance
 * - Tracks execution history and failure rates
 * - Implements rate limiting to prevent abuse
 * 
 * Core Principles Applied:
 * - CLEAN: Single responsibility - just orchestrates executor
 * - MODULAR: Reuses permittedTicketExecutor service
 * - PERFORMANT: Minimal computation, delegates to service
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { executePermittedTickets } from '@/services/automation/permittedTicketExecutor';
import type { AutoPurchaseConfig } from '@/domains/wallet/types';

// =============================================================================
// TYPES
// =============================================================================

interface ExecuteRequest {
  /** Configurations for auto-purchases to execute */
  configs: AutoPurchaseConfig[];
  
  /** Optional: API key for backend/cron job calls */
  apiKey?: string;
}

interface ExecuteResponse {
  success: boolean;
  data?: {
    executed: number;
    succeeded: number;
    failed: number;
    results: Record<string, unknown>;
  };
  error?: {
    code: string;
    message: string;
  };
}

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ExecuteResponse>
) {
  // CLEAN: Only POST requests allowed
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Use POST to execute permitted tickets',
      },
    });
  }

  try {
    const { configs, apiKey } = req.body as ExecuteRequest;

    // CLEAN: Validate request
    if (!configs || !Array.isArray(configs) || configs.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request must include array of auto-purchase configs',
        },
      });
    }

    // CLEAN: Validate API key if provided (for backend/cron calls)
    if (apiKey && apiKey !== process.env.AUTOMATION_API_KEY) {
      console.warn('Invalid API key provided to execute-permitted-tickets');
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid API key',
        },
      });
    }

    // MODULAR: Delegate execution to service
    const executionResult = await executePermittedTickets(configs);

    // PERFORMANT: Return results
    return res.status(200).json({
      success: true,
      data: {
        executed: configs.length,
        succeeded: executionResult.successful.length,
        failed: executionResult.failed.length,
        results: {
          successful: executionResult.successful,
          failed: executionResult.failed,
          nextCheck: executionResult.nextCheck,
        },
      },
    });
  } catch (error) {
    console.error('Permitted ticket execution error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      error: {
        code: 'EXECUTION_ERROR',
        message: `Failed to execute permitted tickets: ${message}`,
      },
    });
  }
}
