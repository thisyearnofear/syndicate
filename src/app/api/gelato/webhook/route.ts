/**
 * GELATO WEBHOOK ENDPOINT
 * 
 * Core Principles Applied:
 * - CLEAN: Single webhook endpoint for all Gelato events
 * - SECURE: HMAC-SHA256 signature verification (Gelato standard)
 * - MODULAR: Delegates to service layer for handling
 * - ORGANIZED: Positioned in /api/gelato/ for domain clarity
 * 
 * Webhook Events:
 * - task.executed: Task ran successfully
 * - task.failed: Task execution failed
 * - task.cancelled: Task was cancelled
 * 
 * Vercel Postgres Integration:
 * - Records execution history
 * - Updates task status
 * - Tracks errors for monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getGelatoTaskRepository } from '@/lib/db/schema/gelatoTasks';

// =============================================================================
// TYPES
// =============================================================================

interface GelatoWebhookPayload {
  taskId: string;
  taskRecordId?: string;
  chainId: number;
  executedData: string;
  transactionHash?: string;
  status: 'executed' | 'failed' | 'cancelled';
  executionTimestamp: number;
  error?: string;
  gasUsed?: string;
  amountExecuted?: string;
  referrer?: string;
}

interface GelatoWebhookRequest {
  taskId: string;
  event: string;
  payload: GelatoWebhookPayload;
  timestamp: number;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Verify Gelato webhook signature (HMAC-SHA256)
 * Prevents unauthorized webhook calls
 */
function verifyGelatoSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Extract task ID and user ID from database record
 */
async function resolveTaskRecord(taskId: string): Promise<{ taskRecordId: string; userId: string } | null> {
  try {
    const repo = getGelatoTaskRepository();
    const task = await repo.getTaskByGelatoId(taskId);

    if (!task) return null;

    return {
      taskRecordId: task.id,
      userId: task.userId,
    };
  } catch (error) {
    console.error('[Gelato Webhook] Failed to resolve task record:', error);
    return null;
  }
}

/**
 * Handle task execution event
 */
async function handleTaskExecution(
  payload: GelatoWebhookPayload,
  taskRecord: { taskRecordId: string; userId: string }
) {
  const repo = getGelatoTaskRepository();

  try {
    // Record execution in database
    const execution = {
      id: `exec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      taskId: payload.taskId,
      taskRecordId: taskRecord.taskRecordId,
      userId: taskRecord.userId,
      executedAt: payload.executionTimestamp,
      transactionHash: payload.transactionHash,
      success: payload.status === 'executed',
      error: payload.error,
      amountExecuted: payload.amountExecuted ? BigInt(payload.amountExecuted) : undefined,
      referrer: payload.referrer || '0x0000000000000000000000000000000000000000',
      gelatoExecutionId: payload.taskId,
      gasUsed: payload.gasUsed ? BigInt(payload.gasUsed) : undefined,
      createdAt: Math.floor(Date.now() / 1000),
    };

    await repo.recordExecution(execution);

    // Update task status
    const now = Math.floor(Date.now() / 1000);
    await repo.updateTask(taskRecord.taskRecordId, {
      lastExecutedAt: now,
      executionCount: (await repo.getTask(taskRecord.taskRecordId))?.executionCount ?? 0 + 1,
      lastError: payload.error || null,
    });

    console.log('[Gelato Webhook] Recorded execution for task:', {
      taskId: payload.taskId,
      status: payload.status,
      txHash: payload.transactionHash,
    });
  } catch (error) {
    console.error('[Gelato Webhook] Failed to record execution:', error);
    throw error;
  }
}

/**
 * Handle task failure event
 */
async function handleTaskFailure(
  payload: GelatoWebhookPayload,
  taskRecord: { taskRecordId: string; userId: string }
) {
  const repo = getGelatoTaskRepository();

  try {
    // Record failed execution
    const execution = {
      id: `exec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      taskId: payload.taskId,
      taskRecordId: taskRecord.taskRecordId,
      userId: taskRecord.userId,
      executedAt: payload.executionTimestamp,
      transactionHash: payload.transactionHash,
      success: false,
      error: payload.error || 'Unknown error',
      createdAt: Math.floor(Date.now() / 1000),
    };

    await repo.recordExecution(execution);

    // Update task with error
    await repo.updateTask(taskRecord.taskRecordId, {
      lastError: payload.error || 'Task execution failed',
    });

    console.warn('[Gelato Webhook] Task execution failed:', {
      taskId: payload.taskId,
      error: payload.error,
    });
  } catch (error) {
    console.error('[Gelato Webhook] Failed to handle task failure:', error);
    throw error;
  }
}

/**
 * Handle task cancellation event
 */
async function handleTaskCancellation(
  payload: GelatoWebhookPayload,
  taskRecord: { taskRecordId: string; userId: string }
) {
  const repo = getGelatoTaskRepository();

  try {
    await repo.updateTask(taskRecord.taskRecordId, {
      status: 'cancelled',
    });

    console.log('[Gelato Webhook] Task cancelled:', payload.taskId);
  } catch (error) {
    console.error('[Gelato Webhook] Failed to handle task cancellation:', error);
    throw error;
  }
}

// =============================================================================
// WEBHOOK HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const signature = request.headers.get('x-gelato-signature');
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      );
    }

    const secret = process.env.GELATO_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[Gelato Webhook] GELATO_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      );
    }

    // Get raw body for signature verification
    const body = await request.text();

    // Verify signature
    if (!verifyGelatoSignature(body, signature, secret)) {
      console.warn('[Gelato Webhook] Invalid signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse payload
    const webhook = JSON.parse(body) as GelatoWebhookRequest;
    const { taskId, event, payload } = webhook;

    console.log('[Gelato Webhook] Received event:', { taskId, event });

    // Resolve task record from database
    const taskRecord = await resolveTaskRecord(taskId);
    if (!taskRecord) {
      console.warn('[Gelato Webhook] Task not found in database:', taskId);
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Handle event
    switch (event) {
      case 'task.executed':
        await handleTaskExecution(payload, taskRecord);
        break;

      case 'task.failed':
        await handleTaskFailure(payload, taskRecord);
        break;

      case 'task.cancelled':
        await handleTaskCancellation(payload, taskRecord);
        break;

      default:
        console.warn('[Gelato Webhook] Unknown event type:', event);
        return NextResponse.json(
          { error: 'Unknown event type' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      taskId,
      event,
    });
  } catch (error) {
    console.error('[Gelato Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// HEALTH CHECK (GET)
// =============================================================================

export async function GET() {
  return NextResponse.json({
    status: 'ready',
    endpoint: '/api/gelato/webhook',
  });
}
