/**
 * SEASON KEEPER PROCESSOR — server-side operator loop (cron).
 *
 * Keeps the Tontine Pot moving between visitors (docs/SEASON.md §4, mirrors
 * the xlayer-keeper pattern). Each tick chains every housekeeping stage the
 * current state allows, so a single daily Hobby-tier cron run completes a
 * whole epoch:
 *
 *   1. Free inactive seats — active seats joined before the season's
 *      inactivity_draws grace window with no recorded contribution since
 *      (reason 'freed_inactive', zero bonus; the tontine's retention rule).
 *   2. Expire open call rounds past their cutoff without a settlement
 *      (reason journaled; the chest is untouched and rolls into the next
 *      round — nothing was paid out, so nothing is refunded).
 *
 * This keeper signs nothing and holds no keys: settlement is receipt-driven
 * (the winner executes the real purchases client-side; POST
 * /api/season/rounds/[id]/settle verifies the receipts before journaling).
 * The gate is therefore an explicit opt-in flag, fail-closed:
 *
 *   SEASON_KEEPER_ENABLED=true
 *
 * Every transition is persisted to agent_run_events (source
 * 'season-keeper') so the run replays publicly at
 * /api/agent/season/latest-run.
 */

import { randomBytes } from 'node:crypto';
import {
  appendAgentRunEvent,
  type AgentRunKind,
} from '@/lib/db/repositories/agentRunRepository';
import {
  ensureSeasonTables,
  getActiveSeason,
  getInactiveSeats,
  listOpenRoundsPastCutoff,
  freeCrewSeat,
  expireCallRound,
  appendSeasonEvent,
} from '@/lib/db/repositories/seasonRepository';
import { CHAIN_IDS } from '@/config/contracts';
import { logger } from '@/lib/logger';

export interface SeasonKeeperAction {
  stage: string;
  detail: string;
}

export interface SeasonKeeperRunResult {
  attempted: boolean;
  reason?: string;
  sessionId?: string;
  actions: SeasonKeeperAction[];
}

const DAY_MS = 86_400_000;

async function record(
  sessionId: string,
  seq: number,
  kind: AgentRunKind,
  label: string,
  detail?: string,
): Promise<void> {
  await appendAgentRunEvent({
    id: `${sessionId}_${seq}`,
    sessionId,
    kind,
    label,
    detail: detail ?? null,
    toolId: null,
    txHash: null,
    source: 'season-keeper',
    createdAt: Date.now(),
  });
}

export async function runSeasonKeeper(): Promise<SeasonKeeperRunResult> {
  if (process.env.SEASON_KEEPER_ENABLED !== 'true') {
    return {
      attempted: false,
      reason: 'Season keeper is not enabled (set SEASON_KEEPER_ENABLED=true).',
      actions: [],
    };
  }

  const sessionId = `seasonkeeper_${Date.now()}_${randomBytes(3).toString('hex')}`;
  const actions: SeasonKeeperAction[] = [];
  let seq = 0;

  try {
    await ensureSeasonTables();
    await record(sessionId, seq++, 'plan', 'Season keeper tick started');

    // ── Stage 1: per-active-season seat + round housekeeping ───────────
    for (const chainId of [CHAIN_IDS.BASE, CHAIN_IDS.BASE_SEPOLIA]) {
      const season = await getActiveSeason(chainId);
      if (!season) continue;

      const chainLabel = chainId === CHAIN_IDS.BASE ? 'base' : 'base_sepolia';
      await record(
        sessionId, seq++, 'execute',
        `Season ${season.name} (${chainLabel}): housekeeping`,
      );

      // 1a. Free inactive seats.
      const cutoffMs = Date.now() - season.inactivityDraws * DAY_MS;
      const cutoffIso = new Date(cutoffMs).toISOString();
      const inactive = await getInactiveSeats(season.id, cutoffIso);
      for (const seat of inactive) {
        const freed = await freeCrewSeat(seat.crewId, seat.memberAddress, 'freed_inactive');
        if (!freed) continue;
        await appendSeasonEvent({
          id: crypto.randomUUID(),
          seasonId: season.id,
          crewId: seat.crewId,
          kind: 'seat.freed',
          payload: { address: seat.memberAddress, reason: 'freed_inactive' },
        });
        actions.push({
          stage: 'free_inactive_seat',
          detail: `${seat.memberAddress} on crew ${seat.crewId} (${chainLabel})`,
        });
        await record(
          sessionId, seq++, 'execute',
          `Freed inactive seat ${seat.memberAddress.slice(0, 8)}…`,
          `crew ${seat.crewId}; zero bonus; cuts renormalized`,
        );
      }

      // 1b. Expire open rounds past cutoff.
      const expired = await listOpenRoundsPastCutoff();
      for (const round of expired) {
        await expireCallRound(
          round.id,
          'cutoff passed without settlement; chest rolls into next round',
        );
        actions.push({ stage: 'expire_round', detail: `round ${round.id} (${chainLabel})` });
        await record(
          sessionId, seq++, 'execute',
          `Expired call round ${round.id.slice(0, 8)}…`,
          'no settlement received after cutoff; chest untouched',
        );
      }
    }

    await record(
      sessionId, seq++, 'complete',
      `Season keeper tick complete: ${actions.length} action(s)`,
    );
    logger.info('[SeasonKeeper] Tick complete', { sessionId, actions: actions.length });
    return { attempted: true, sessionId, actions };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await record(sessionId, seq++, 'fail', 'Season keeper tick failed', message);
    } catch {
      /* journaling failure is itself reported via the return value */
    }
    logger.error('[SeasonKeeper] Tick failed:', { message });
    return { attempted: true, sessionId, actions, reason: message };
  }
}
