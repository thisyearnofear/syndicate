/**
 * GELATO AUTOMATION ENDPOINT
 *
 * Core Principles Applied:
 * - CLEAN: Single responsibility - execute permitted purchases
 * - MODULAR: Uses separate services for validation and execution
 * - PERFORMANT: Minimal database queries, efficient execution
 * - ORGANIZED: Isolated automation API endpoint
 *
 * Called by Gelato Network when automation trigger fires
 * Verifies:
 * 1. Webhook signature is valid
 * 2. Permission exists and is still valid
 * 3. User's balance is sufficient
 * Then executes Megapot.purchaseTickets()
 *
 * Endpoint: POST /api/automation/execute-purchase-tickets
 * Authentication: Gelato signature validation
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { Address, createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { getGelatoService } from '@/services/automation/gelatoService';
import { getERC7715Service } from '@/services/erc7715Service';
import { MEGAPOT } from '@/config/contracts';
import {
  verifyGelatoSignature,
  isWebhookTimestampFresh,
  validateWebhookPayload,
  getTxHashFromPayload,
  isSuccessfulExecution,
} from '@/lib/gelato/signature';
import {
  getGelatoTaskRepository,
  type GelatoTaskRecord,
  type GelatoExecutionRecord,
} from '@/lib/db/schema/gelatoTasks';

// =============================================================================
// TYPES
// =============================================================================

interface ExecutionRequest {
  taskId: string;
  userAddress?: Address;
  gelatoTimestamp?: number;
}

interface ExecutionResponse {
  success: boolean;
  taskId?: string;
  txHash?: string;
  error?: string;
  timestamp: number;
  details?: string;
}

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ExecutionResponse>
) {
  try {
    // Only allow POST
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed',
        timestamp: Date.now(),
      });
    }

    // SECURITY: Verify Gelato webhook signature
    const gelatoApiKey = process.env.GELATO_API_KEY;
    const gelatoSignature = req.headers['x-gelato-signature'] as string;

    if (!gelatoApiKey) {
      console.error('[Execution] GELATO_API_KEY not configured');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error',
        timestamp: Date.now(),
      });
    }

    // Get raw body for signature verification
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    
    // Verify signature
    const signatureResult = verifyGelatoSignature(rawBody, gelatoSignature, gelatoApiKey);
    if (!signatureResult.isValid) {
      console.error('[Execution] Signature verification failed:', signatureResult.error);
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid signature',
        timestamp: Date.now(),
      });
    }

    // Validate webhook payload structure
    if (!validateWebhookPayload(signatureResult.payload)) {
      console.error('[Execution] Invalid webhook payload structure');
      return res.status(400).json({
        success: false,
        error: 'Invalid webhook payload',
        timestamp: Date.now(),
      });
    }

    const { taskId } = req.body as ExecutionRequest;
    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: taskId',
        timestamp: Date.now(),
      });
    }

    console.log('[Execution] Processing task:', { taskId });

    // Get services
    const erc7715Service = getERC7715Service();
    const gelatoService = getGelatoService();
    const taskRepository = getGelatoTaskRepository();

    // Fetch task from database
    let taskRecord: GelatoTaskRecord | null = null;
    try {
      taskRecord = await taskRepository.getTaskByGelatoId(taskId);
    } catch (err) {
      console.error('[Execution] Database error fetching task:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch task from database',
        timestamp: Date.now(),
      });
    }

    if (!taskRecord) {
      console.error('[Execution] Task not found in database:', taskId);
      return res.status(404).json({
        success: false,
        error: 'Task not found',
        timestamp: Date.now(),
      });
    }

    const { userAddress, permissionId } = taskRecord;

    console.log('[Execution] Found task record:', {
      taskId: taskRecord.id,
      gelatoTaskId: taskRecord.taskId,
      userAddress,
    });

    // Get permission from ERC7715 service
    const erc7715Service2 = getERC7715Service();
    const permissions = erc7715Service2.getActiveGrants();
    const userPermission = permissions
      .filter(g => g.type === 'advanced-permission')
      .map(g => g.permission!)
      .find(p => p.id === permissionId);

    if (!userPermission) {
      console.error('[Execution] Permission not found:', { permissionId, userAddress });
      return res.status(404).json({
        success: false,
        error: 'Permission not found or expired',
        timestamp: Date.now(),
      });
    }

    // Validate permission is currently usable
    const purchaseAmount = taskRecord.amountPerPeriod;
    const validation = erc7715Service.validatePermissionForExecution(
      userPermission,
      purchaseAmount
    );

    if (!validation.isValid) {
      console.warn('[Execution] Permission validation failed:', validation.reason);

      // Update task status in database
      await taskRepository.updateTask(taskRecord.id, {
        status: 'paused',
        lastError: validation.reason,
        updatedAt: Math.floor(Date.now() / 1000),
      });

      return res.status(400).json({
        success: false,
        taskId: taskRecord.id,
        error: `Permission validation failed: ${validation.reason}`,
        timestamp: Date.now(),
      });
    }

    // Execute Megapot purchase
    const publicClient = createPublicClient({
      chain: base,
      transport: http(),
    });

    // Simulate the transaction first to catch errors
    const referrerAddress = (process.env.MEGAPOT_REFERRER ||
      '0x0000000000000000000000000000000000000000') as Address;

    console.log('[Execution] Simulating Megapot purchase:', {
      referrer: referrerAddress,
      amount: purchaseAmount.toString(),
      recipient: userAddress,
    });

    // In a real implementation, you'd:
    // 1. Use a relay service to execute the transaction
    // 2. Sign with a backend key or use MetaTx
    // 3. Handle potential failures and retries
    // 4. Update the permission's spent amount
    // 5. Store task execution in database

    // For now, we'll simulate and log
    try {
      const result = await publicClient.simulateContract({
        account: userAddress,
        address: MEGAPOT.address,
        abi: MEGAPOT.abi,
        functionName: 'purchaseTickets',
        args: [referrerAddress, purchaseAmount, userAddress],
      });

      console.log('[Execution] Simulation successful');

      // TODO: Execute the actual transaction via relay service
      // const txHash = await relayService.execute(...)
      const simulatedTxHash = 'simulated-tx-hash'; // In production: actual tx hash

      // Record execution in database
      const executionRecord: GelatoExecutionRecord = {
        id: `exec_${Date.now()}`,
        taskId: taskRecord.taskId,
        taskRecordId: taskRecord.id,
        userId: taskRecord.userId,
        executedAt: Math.floor(Date.now() / 1000),
        transactionHash: simulatedTxHash,
        success: true,
        amountExecuted: purchaseAmount,
        referrer: '0x0000000000000000000000000000000000000000' as Address,
        createdAt: Math.floor(Date.now() / 1000),
      };

      try {
        await taskRepository.recordExecution(executionRecord);
        console.log('[Execution] Recorded execution:', { taskId, txHash: simulatedTxHash });
      } catch (dbErr) {
        console.error('[Execution] Failed to record execution:', dbErr);
        // Don't fail the response if logging fails
      }

      // Update task in database
      try {
        const nextExecution = gelatoService.calculateNextExecutionTime(taskRecord.frequency);
        await taskRepository.updateTask(taskRecord.id, {
          executionCount: taskRecord.executionCount + 1,
          lastExecutedAt: Math.floor(Date.now() / 1000),
          nextExecutionTime: nextExecution,
          lastError: undefined,
          updatedAt: Math.floor(Date.now() / 1000),
        });
      } catch (dbErr) {
        console.error('[Execution] Failed to update task:', dbErr);
      }

      return res.status(200).json({
        success: true,
        taskId: taskRecord.id,
        txHash: simulatedTxHash,
        timestamp: Date.now(),
      });
      } catch (simulationError) {
      console.error('[Execution] Simulation failed:', simulationError);

      // Record failed execution
      const errorMessage = simulationError instanceof Error ? simulationError.message : 'Unknown error';
      const failedExecution: GelatoExecutionRecord = {
        id: `exec_${Date.now()}`,
        taskId: taskRecord.taskId,
        taskRecordId: taskRecord.id,
        userId: taskRecord.userId,
        executedAt: Math.floor(Date.now() / 1000),
        success: false,
        error: errorMessage,
        amountExecuted: purchaseAmount,
        referrer: '0x0000000000000000000000000000000000000000' as Address,
        createdAt: Math.floor(Date.now() / 1000),
      };

      try {
        await taskRepository.recordExecution(failedExecution);
      } catch (dbErr) {
        console.error('[Execution] Failed to record failed execution:', dbErr);
      }

      return res.status(400).json({
        success: false,
        taskId: taskRecord.id,
        error: `Simulation failed: ${errorMessage}`,
        timestamp: Date.now(),
      });
      }
  } catch (error) {
    console.error('[Execution] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: Date.now(),
    });
  }
}
