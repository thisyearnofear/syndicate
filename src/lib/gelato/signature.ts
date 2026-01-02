/**
 * GELATO SIGNATURE VERIFICATION
 *
 * Core Principles Applied:
 * - CLEAN: Centralized signature validation logic
 * - PERFORMANT: Efficient verification without external calls
 * - ORGANIZED: Separate module for security-critical code
 *
 * Verifies that webhook requests from Gelato are authentic
 * Reference: https://docs.gelato.network/developer-services/webhooks
 */

import { createHmac } from 'crypto';

// =============================================================================
// TYPES
// =============================================================================

export interface GelatoWebhookPayload {
  taskId: string;
  taskReceipt?: {
    taskId: string;
    status: string;
    lastExecution?: {
      timeExecution: number;
      transactionHash: string;
      blockNumber: number;
      executionData: string;
    };
  };
  executedData?: {
    taskId: string;
    timestamp: number;
    blockNumber: number;
    transactionHash: string;
    gasUsed: string;
    gasPrice: string;
  };
}

export interface VerificationResult {
  isValid: boolean;
  error?: string;
  payload?: GelatoWebhookPayload;
}

// =============================================================================
// SIGNATURE VERIFICATION
// =============================================================================

/**
 * Verify Gelato webhook signature
 *
 * Gelato signs webhooks with HMAC-SHA256 using their API key
 * The signature is sent in the X-Gelato-Signature header
 *
 * IMPORTANT: In production, validate the signature matches Gelato's public key
 * For hackathon phase: verify header presence and timestamp freshness
 */
export function verifyGelatoSignature(
  payload: string,
  signature: string,
  gelatoApiKey: string
): VerificationResult {
  // In production, Gelato provides signature verification
  // This is a placeholder implementation
  // Reference actual Gelato docs for proper verification

  if (!signature) {
    return {
      isValid: false,
      error: 'Missing X-Gelato-Signature header',
    };
  }

  try {
    // Verify HMAC signature
    const expectedSignature = createHmac('sha256', gelatoApiKey)
      .update(payload)
      .digest('hex');

    const isValid = signature === expectedSignature;

    if (!isValid) {
      return {
        isValid: false,
        error: 'Invalid signature',
      };
    }

    // Parse and validate payload
    const data = JSON.parse(payload) as GelatoWebhookPayload;

    return {
      isValid: true,
      payload: data,
    };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Failed to verify signature',
    };
  }
}

/**
 * Verify webhook timestamp is fresh (within 5 minutes)
 * Prevents replay attacks
 */
export function isWebhookTimestampFresh(
  timestamp: number,
  maxAgeSecs: number = 300 // 5 minutes
): boolean {
  const now = Math.floor(Date.now() / 1000);
  const age = now - timestamp;

  if (age < 0) {
    console.warn('[Gelato] Webhook timestamp is in the future:', { timestamp, now });
    return false;
  }

  if (age > maxAgeSecs) {
    console.warn('[Gelato] Webhook timestamp is too old:', { age, maxAgeSecs });
    return false;
  }

  return true;
}

/**
 * Validate webhook payload structure
 */
export function validateWebhookPayload(payload: any): payload is GelatoWebhookPayload {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  // Must have taskId
  if (!payload.taskId || typeof payload.taskId !== 'string') {
    return false;
  }

  // Either has taskReceipt or executedData
  const hasTaskReceipt = payload.taskReceipt && typeof payload.taskReceipt === 'object';
  const hasExecutedData = payload.executedData && typeof payload.executedData === 'object';

  return hasTaskReceipt || hasExecutedData;
}

/**
 * Helper: Extract task ID from webhook payload
 */
export function getTaskIdFromPayload(payload: GelatoWebhookPayload): string {
  return payload.taskId;
}

/**
 * Helper: Check if webhook indicates successful execution
 */
export function isSuccessfulExecution(payload: GelatoWebhookPayload): boolean {
  if (payload.taskReceipt) {
    const status = payload.taskReceipt.status?.toLowerCase() || '';
    return status === 'success' || status === 'executed';
  }

  if (payload.executedData) {
    return !!payload.executedData.transactionHash;
  }

  return false;
}

/**
 * Helper: Get transaction hash from webhook payload
 */
export function getTxHashFromPayload(payload: GelatoWebhookPayload): string | null {
  if (payload.taskReceipt?.lastExecution?.transactionHash) {
    return payload.taskReceipt.lastExecution.transactionHash;
  }

  if (payload.executedData?.transactionHash) {
    return payload.executedData.transactionHash;
  }

  return null;
}

/**
 * Helper: Get execution timestamp from webhook payload
 */
export function getExecutionTimestampFromPayload(payload: GelatoWebhookPayload): number | null {
  if (payload.taskReceipt?.lastExecution?.timeExecution) {
    return payload.taskReceipt.lastExecution.timeExecution;
  }

  if (payload.executedData?.timestamp) {
    return payload.executedData.timestamp;
  }

  return null;
}
