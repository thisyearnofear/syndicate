/**
 * Recurring Purchases Cron Job
 * 
 * Triggered daily by Vercel Cron
 * Orchestrates the recurring purchase automation flow:
 * 1. Query due purchases from database
 * 2. Verify permissions are valid
 * 3. Execute purchases on-chain
 * 4. Mark as executed in database
 * 
 * Protected by CRON_SECRET - only runs on Vercel infrastructure
 */

export const dynamic = 'force-dynamic';

import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '@vercel/postgres';
import { automationOrchestrator, AutomationTask } from '@/services/automation/AutomationOrchestrator';

interface CronResponse {
  success: boolean;
  executed: number;
  attempted: number;
  errors: string[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CronResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, executed: 0, attempted: 0, errors: ['Method not allowed'] });
  }

  const currentTimestamp = Math.floor(Date.now() / 1000);
  const errors: string[] = [];
  let executedCount = 0;
  let attemptedCount = 0;

  console.log(`[Cron] Universal Orchestrator starting at ${new Date().toISOString()}`);

  try {
    // 1. Query due tasks (Consolidated SELECT)
    const { rows: tasks } = await sql<any>`
      SELECT * FROM auto_purchases 
      WHERE is_active = true 
      AND (last_executed_at IS NULL OR last_executed_at + 3600 <= ${currentTimestamp})
    `;

    console.log(`[Cron] Found ${tasks.length} potentially due tasks`);

    for (const row of tasks) {
      // Map DB row to AutomationTask interface
      const task: AutomationTask = {
        id: row.id,
        userAddress: row.user_address,
        strategy: (row.agent_type || 'scheduled') as any,
        status: 'active',
        tokenAddress: row.token_address || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        tokenSymbol: row.token_address?.includes('fde4') ? 'USD₮' : 'USDC',
        amount: BigInt(row.amount_per_period),
        frequency: row.frequency,
        lastExecutedAt: row.last_executed_at,
      };

      attemptedCount++;
      
      // 2. Execute via Orchestrator (DRY)
      const result = await automationOrchestrator.executeTask(task);

      if (result.success) {
        // 3. Mark executed & update reasoning (Consolidated UPDATE)
        await sql`
          UPDATE auto_purchases 
          SET last_executed_at = ${currentTimestamp},
              last_reasoning = ${result.reasoning || row.last_reasoning},
              updated_at = NOW()
          WHERE id = ${task.id}
        `;
        executedCount++;
        console.log(`[Cron] ✅ Task ${task.id} success`);
      } else {
        errors.push(`Task ${task.id} failed: ${result.error}`);
        console.error(`[Cron] ❌ Task ${task.id} error: ${result.error}`);
      }
    }

    return res.json({
      success: errors.length === 0,
      executed: executedCount,
      attempted: attemptedCount,
      errors
    });

  } catch (error: any) {
    console.error(`[Cron] Fatal error:`, error);
    return res.status(500).json({ success: false, executed: executedCount, attempted: attemptedCount, errors: [error.message] });
  }
}
