/**
 * POST /api/crons/notify-draw
 *
 * Cron job: after a draw resolves, notify all users who had tickets.
 * Reads the latest draw state, queries users with active tasks (who have
 * recipientEmail), and sends draw result notifications.
 *
 * Trigger: call from Vercel cron or external scheduler after draw time (17:00 UTC daily).
 * Auth: requires AUTOMATION_API_KEY bearer token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { basePublicClient } from '@/lib/baseClient';
import { MEGAPOT_ABI } from '@/config/contracts';
import { formatUnits } from 'viem';
import { emailNotificationService } from '@/services/notifications';
import { getVirtualsTaskRepository } from '@/lib/db/schema/virtualsTasks';
import { logger } from '@/lib/logger';

const MEGAPOT_V2_ADDRESS = '0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2' as const;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.AUTOMATION_API_KEY;
  if (!secret) return true; // No auth configured = allow (dev mode)
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  return token === secret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Read latest completed draw
    const currentId = await basePublicClient.readContract({
      address: MEGAPOT_V2_ADDRESS,
      abi: MEGAPOT_ABI,
      functionName: 'currentDrawingId',
    }) as bigint;

    const lastDrawId = currentId > 1n ? currentId - 1n : currentId;

    const state = await basePublicClient.readContract({
      address: MEGAPOT_V2_ADDRESS,
      abi: MEGAPOT_ABI,
      functionName: 'getDrawingState',
      args: [lastDrawId],
    }) as {
      prizePool: bigint;
      globalTicketsBought: bigint;
      drawingTime: bigint;
      winningTicket: bigint;
      jackpotLock: boolean;
    };

    const prizePoolUsd = parseFloat(formatUnits(state.prizePool, 6));
    const ticketsSold = Number(state.globalTicketsBought);
    const isResolved = Number(state.winningTicket) > 0 || state.jackpotLock;

    // 2. Find all users with active tasks who have email addresses
    const repo = getVirtualsTaskRepository();
    const allTasks = await repo.getTasksDueForExecution(Date.now() + 86_400_000); // Wide window
    const emailableUsers = allTasks
      .filter((t) => t.recipientEmail && t.isActive)
      .reduce((map, t) => {
        if (!map.has(t.recipientEmail)) {
          map.set(t.recipientEmail, t.userAddress);
        }
        return map;
      }, new Map<string, string>());

    if (emailableUsers.size === 0) {
      logger.info('[NotifyDraw] No users to notify');
      return NextResponse.json({ notified: 0, drawId: Number(lastDrawId) });
    }

    // 3. Send notifications
    const recipients = [...emailableUsers.entries()].map(([email]) => ({
      email,
      data: {
        drawId: Number(lastDrawId),
        prizePoolUsd,
        ticketsSold,
        isResolved,
        winningTicket: Number(state.winningTicket),
        userTicketCount: 0, // Would need per-user ticket count lookup
        userWonAmount: undefined,
      },
    }));

    const result = await emailNotificationService.notifyDrawResultBatch(recipients);

    logger.info('[NotifyDraw] Complete', { drawId: Number(lastDrawId), ...result });
    return NextResponse.json({
      drawId: Number(lastDrawId),
      ...result,
      prizePoolUsd,
      isResolved,
    });
  } catch (err) {
    logger.error('[NotifyDraw] Failed', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Notification job failed' }, { status: 500 });
  }
}
