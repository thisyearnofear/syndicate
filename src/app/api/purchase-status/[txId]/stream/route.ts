import { NextRequest } from 'next/server';
import { getPurchaseStatusByTxId } from '@/lib/db/repositories/purchaseStatusRepository';

// Prevent Next.js from trying to statically generate this dynamic route
export const dynamic = 'force-dynamic';

const POLL_INTERVAL_MS = 3000;
const MAX_DURATION_MS = 10 * 60 * 1000; // 10 minutes

const STATUS_PROGRESS: Record<string, number> = {
  pending: 10,
  confirmed_stacks: 20,
  bridging: 40,
  attesting: 55,
  relaying: 70,
  purchasing: 85,
  complete: 100,
  error: 0,
};

const ESTIMATED_TOTAL_SECONDS: Record<string, number> = {
  stacks: 600,
  near: 180,
  solana: 120,
};

function buildSteps(status: string, record: Record<string, unknown>) {
  const progress = STATUS_PROGRESS[status] ?? 0;
  return [
    { name: 'Transaction Signed',  status: progress >= 20  ? 'complete' : progress > 10  ? 'in_progress' : 'pending', timestamp: record.createdAt ?? null },
    { name: 'Bridging to Base',    status: progress >= 70  ? 'complete' : progress > 20  ? 'in_progress' : 'pending', timestamp: status === 'bridging'   ? record.updatedAt : null },
    { name: 'Purchasing Tickets',  status: progress >= 85  ? 'complete' : progress > 70  ? 'in_progress' : 'pending', timestamp: status === 'purchasing' ? record.updatedAt : null },
    { name: 'Complete',            status: progress === 100 ? 'complete' : 'pending',                                  timestamp: status === 'complete'   ? record.updatedAt : null },
  ];
}

export async function GET(
  request: NextRequest,
  { params }: { params: { txId: string } }
) {
  const { txId } = params;

  if (!txId) {
    return new Response('Transaction ID required', { status: 400 });
  }

  const encoder = new TextEncoder();
  const startTime = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let lastStatus: string | null = null;

      const tick = async () => {
        if (Date.now() - startTime > MAX_DURATION_MS) {
          send({ error: 'Stream timeout', status: 'timeout' });
          controller.close();
          return;
        }

        try {
          const record = await getPurchaseStatusByTxId(txId);

          if (!record) {
            send({ error: 'Purchase not found', status: 'not_found' });
            controller.close();
            return;
          }

          const status = record.status;
          const progress = STATUS_PROGRESS[status] ?? 0;
          const totalTime = ESTIMATED_TOTAL_SECONDS[record.sourceChain] ?? 300;
          const elapsed = record.updatedAt
            ? Math.floor((Date.now() - new Date(record.updatedAt).getTime()) / 1000)
            : 0;
          const estimatedSecondsRemaining = Math.max(0, totalTime - elapsed);

          // Send on first tick or whenever status changes
          if (status !== lastStatus) {
            lastStatus = status;
            send({
              ...record,
              progress,
              estimatedSecondsRemaining,
              steps: buildSteps(status, record as unknown as Record<string, unknown>),
            });
          }

          // Stop streaming on terminal states
          if (status === 'complete' || status === 'error') {
            controller.close();
            return;
          }

          // Schedule next poll
          setTimeout(tick, POLL_INTERVAL_MS);
        } catch (err) {
          console.error('[SSE] Error fetching purchase status:', err);
          send({ error: 'Internal server error' });
          controller.close();
        }
      };

      // Clean up on client disconnect
      request.signal.addEventListener('abort', () => {
        controller.close();
      });

      await tick();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
