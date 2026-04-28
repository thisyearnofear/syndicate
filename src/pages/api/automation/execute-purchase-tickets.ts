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
 * Then executes Megapot.purchaseTickets() via Relay Service
 *
 * Endpoint: POST /api/automation/execute-purchase-tickets
 * Authentication: Gelato signature validation
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { Address, encodeFunctionData } from 'viem';
import { automationOrchestrator } from '@/services/automation/AutomationOrchestrator';
import { getERC7715Service } from '@/services/automation/erc7715Service';
import type { ERC7715Grant } from '@/services/automation/erc7715Service';
import { MEGAPOT_V2_CONTRACTS } from '@/config/contracts';
import {
  verifyGelatoSignature,
  validateWebhookPayload,
} from '@/lib/gelato/signature';
import {
  getGelatoTaskRepository,
  type GelatoTaskRecord,
  type GelatoExecutionRecord,
} from '@/lib/db/schema/gelatoTasks';
import { relayService } from '@/services/automation/RelayService';

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

    // Get permission from ERC7715 service
    const permissions = erc7715Service.getActiveGrants();
    const userPermission = permissions
      .filter((g: ERC7715Grant) => g.type === 'advanced-permission')
      .map((g: ERC7715Grant) => g.permission!)
      .find((p: ERC7715Grant['permission']) => p!.id === permissionId);

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

    // Execute Megapot purchase via Relay
    const referrerAddress = (process.env.MEGAPOT_REFERRER ||
      '0x0000000000000000000000000000000000000000') as Address;

    try {
      // 1. Encode the function data - use buyTickets with proper ticket structure
      const execData = encodeFunctionData({
        abi: MEGAPOT_V2_CONTRACTS.abi,
        functionName: 'buyTickets',
        args: [[], userAddress, [], [], '0x0000000000000000000000000000000000000000000000000000000000000000'],
      });

      console.log('[Execution] Submitting Megapot purchase via Relay:', {
        taskId: taskRecord.id,
        user: userAddress,
        amount: purchaseAmount.toString()
      });

      // 2. Submit to Relay Service
      const relayResponse = await relayService.relayTransaction({
        chainId: 8453, // Base
        target: MEGAPOT_V2_CONTRACTS.jackpot.address,
        data: execData,
        user: userAddress,
      });

      if (!relayResponse.success) {
        throw new Error(`Relay submission failed: ${relayResponse.error}`);
      }

      // 3. Wait for completion (optional, but good for reliable DB updates)
      // For an API route, we might want to return early if it takes too long, 
      // but here we wait to ensure the DB is updated.
      const finalStatus = await relayService.waitForTaskCompletion(relayResponse.taskId);
      
      if (finalStatus.taskState !== 'ExecSuccess') {
        throw new Error(`Relay execution failed: ${finalStatus.taskState} - ${finalStatus.lastError || 'Unknown error'}`);
      }

      const txHash = finalStatus.transactionHash || '0x';

      // Record execution in database
      const executionRecord: GelatoExecutionRecord = {
        id: `exec_${Date.now()}`,
        taskId: taskRecord.taskId,
        taskRecordId: taskRecord.id,
        userId: taskRecord.userId,
        executedAt: Math.floor(Date.now() / 1000),
        transactionHash: txHash,
        success: true,
        amountExecuted: purchaseAmount,
        referrer: referrerAddress,
        createdAt: Math.floor(Date.now() / 1000),
      };

      await taskRepository.recordExecution(executionRecord);

      // Update task in database
      const nextExecution = automationOrchestrator.calculateNextExecution(taskRecord.frequency);
      await taskRepository.updateTask(taskRecord.id, {
        executionCount: taskRecord.executionCount + 1,
        lastExecutedAt: Math.floor(Date.now() / 1000),
        nextExecutionTime: nextExecution,
        lastError: undefined,
        updatedAt: Math.floor(Date.now() / 1000),
      });

      return res.status(200).json({
        success: true,
        taskId: taskRecord.id,
        txHash: txHash,
        timestamp: Date.now(),
      });
    } catch (executionError) {
      console.error('[Execution] Purchase failed:', executionError);

      const errorMessage = executionError instanceof Error ? executionError.message : 'Unknown error';
      
      // Record failed execution
      const failedExecution: GelatoExecutionRecord = {
        id: `exec_${Date.now()}`,
        taskId: taskRecord.taskId,
        taskRecordId: taskRecord.id,
        userId: taskRecord.userId,
        executedAt: Math.floor(Date.now() / 1000),
        success: false,
        error: errorMessage,
        amountExecuted: purchaseAmount,
        referrer: referrerAddress,
        createdAt: Math.floor(Date.now() / 1000),
      };

      try {
        await taskRepository.recordExecution(failedExecution);
        await taskRepository.updateTask(taskRecord.id, {
          lastError: errorMessage,
          updatedAt: Math.floor(Date.now() / 1000),
        });
      } catch (dbErr) {
        console.error('[Execution] Failed to record failure in DB:', dbErr);
      }

      return res.status(400).json({
        success: false,
        taskId: taskRecord.id,
        error: errorMessage,
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
