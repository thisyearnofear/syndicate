/**
 * SEASON REPOSITORY
 *
 * Registry state for the Season of Tickets campaign layer described in
 * docs/SEASON.md. This layer only records season/crew/auction metadata and
 * public receipt hashes. It never creates money movement by itself; real
 * Megapot entries and payouts flow through the existing purchase, syndicate,
 * and prize-distribution rails.
 *
 * Runtime code must not create tables — schema lives in
 * src/lib/db/migrations/017-add-season.sql.
 */

import { sql } from '@vercel/postgres';
import { assertTableExists } from '../assertTable';

export type SeasonStatus = 'scheduled' | 'active' | 'closed';
export type SeasonCrewKind = 'quick' | 'syndicate';
export type SeasonSeatStatus = 'active' | 'freed_exit' | 'freed_inactive';
export type SeasonCallRoundStatus = 'open' | 'settling' | 'settled' | 'failed';
export type SeasonBidStatus = 'live' | 'won' | 'lost' | 'void';

export interface SeasonRow {
  id: string;
  name: string;
  chainId: number;
  drawWindowStart: number;
  drawWindowEnd: number;
  status: SeasonStatus;
  minChestUsdc: string;
  inactivityDraws: number;
  createdAt: string;
}

export interface SeasonCrewRow {
  id: string;
  seasonId: string;
  name: string;
  crestAccent: string;
  kind: SeasonCrewKind;
  syndicatePoolId: string | null;
  coordinatorAddress: string;
  referrerCode: string;
  status: 'active' | 'archived';
  createdAt: string;
  activeMembers?: number;
}

export interface SeasonCrewMemberRow {
  id: string;
  crewId: string;
  memberAddress: string;
  seatStatus: SeasonSeatStatus;
  joinedAt: string;
  freedAt: string | null;
  lastContributionDraw: string | null;
  cutBps: number;
  joinTxHash: string | null;
}

export interface SeasonCallRoundRow {
  id: string;
  crewId: string;
  chestSnapshotUsdc: string;
  openedAt: string;
  cutoffAt: string;
  status: SeasonCallRoundStatus;
  winningBidId: string | null;
  settleTxHash: string | null;
  callerPayoutTxHash: string | null;
  crewBonusTxHash: string | null;
}

export interface SeasonBidRow {
  id: string;
  roundId: string;
  bidderAddress: string;
  discountBps: number;
  placedAt: string;
  revisedAt: string | null;
  status: SeasonBidStatus;
}

export interface SeasonEventRow {
  id: string;
  seasonId: string | null;
  crewId: string | null;
  kind: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

const SEASON_TABLES = [
  'seasons',
  'season_crews',
  'season_crew_members',
  'season_call_rounds',
  'season_bids',
  'season_events',
] as const;

export async function ensureSeasonTables(): Promise<void> {
  for (const table of SEASON_TABLES) {
    await assertTableExists(table);
  }
}

function mapSeason(row: Record<string, unknown>): SeasonRow {
  return {
    id: row.id as string,
    name: row.name as string,
    chainId: Number(row.chain_id),
    drawWindowStart: Number(row.draw_window_start),
    drawWindowEnd: Number(row.draw_window_end),
    status: row.status as SeasonStatus,
    minChestUsdc: String(row.min_chest_usdc ?? '0'),
    inactivityDraws: Number(row.inactivity_draws),
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

function mapCrew(row: Record<string, unknown>): SeasonCrewRow {
  return {
    id: row.id as string,
    seasonId: row.season_id as string,
    name: row.name as string,
    crestAccent: row.crest_accent as string,
    kind: row.kind as SeasonCrewKind,
    syndicatePoolId: (row.syndicate_pool_id as string | null) ?? null,
    coordinatorAddress: row.coordinator_address as string,
    referrerCode: row.referrer_code as string,
    status: row.status as 'active' | 'archived',
    createdAt: new Date(row.created_at as string).toISOString(),
    activeMembers: row.active_members === undefined ? undefined : Number(row.active_members),
  };
}

function mapMember(row: Record<string, unknown>): SeasonCrewMemberRow {
  return {
    id: row.id as string,
    crewId: row.crew_id as string,
    memberAddress: row.member_address as string,
    seatStatus: row.seat_status as SeasonSeatStatus,
    joinedAt: new Date(row.joined_at as string).toISOString(),
    freedAt: row.freed_at ? new Date(row.freed_at as string).toISOString() : null,
    lastContributionDraw: (row.last_contribution_draw as string | null) ?? null,
    cutBps: Number(row.cut_bps),
    joinTxHash: (row.join_tx_hash as string | null) ?? null,
  };
}

function mapRound(row: Record<string, unknown>): SeasonCallRoundRow {
  return {
    id: row.id as string,
    crewId: row.crew_id as string,
    chestSnapshotUsdc: String(row.chest_snapshot_usdc ?? '0'),
    openedAt: new Date(row.opened_at as string).toISOString(),
    cutoffAt: new Date(row.cutoff_at as string).toISOString(),
    status: row.status as SeasonCallRoundStatus,
    winningBidId: (row.winning_bid_id as string | null) ?? null,
    settleTxHash: (row.settle_tx_hash as string | null) ?? null,
    callerPayoutTxHash: (row.caller_payout_tx_hash as string | null) ?? null,
    crewBonusTxHash: (row.crew_bonus_tx_hash as string | null) ?? null,
  };
}

function mapBid(row: Record<string, unknown>): SeasonBidRow {
  return {
    id: row.id as string,
    roundId: row.round_id as string,
    bidderAddress: row.bidder_address as string,
    discountBps: Number(row.discount_bps),
    placedAt: new Date(row.placed_at as string).toISOString(),
    revisedAt: row.revised_at ? new Date(row.revised_at as string).toISOString() : null,
    status: row.status as SeasonBidStatus,
  };
}

function mapEvent(row: Record<string, unknown>): SeasonEventRow {
  return {
    id: row.id as string,
    seasonId: (row.season_id as string | null) ?? null,
    crewId: (row.crew_id as string | null) ?? null,
    kind: row.kind as string,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

// ─── Seasons ────────────────────────────────────────────────────────────────

export async function getActiveSeason(chainId: number): Promise<SeasonRow | null> {
  await ensureSeasonTables();
  const result = await sql`
    SELECT *
    FROM seasons
    WHERE chain_id = ${chainId}
      AND status = 'active'
    ORDER BY draw_window_end ASC, created_at DESC
    LIMIT 1;
  `;
  return result.rows.length ? mapSeason(result.rows[0]) : null;
}

export async function getSeasonById(seasonId: string): Promise<SeasonRow | null> {
  await ensureSeasonTables();
  const result = await sql`
    SELECT * FROM seasons WHERE id = ${seasonId} LIMIT 1;
  `;
  return result.rows.length ? mapSeason(result.rows[0]) : null;
}

export async function createSeason(params: {
  id: string;
  name: string;
  chainId: number;
  drawWindowStart: number;
  drawWindowEnd: number;
  status?: SeasonStatus;
  minChestUsdc?: string;
  inactivityDraws?: number;
}): Promise<SeasonRow> {
  await ensureSeasonTables();
  const result = await sql`
    INSERT INTO seasons (
      id,
      name,
      chain_id,
      draw_window_start,
      draw_window_end,
      status,
      min_chest_usdc,
      inactivity_draws
    )
    VALUES (
      ${params.id},
      ${params.name},
      ${params.chainId},
      ${params.drawWindowStart},
      ${params.drawWindowEnd},
      ${params.status ?? 'scheduled'},
      ${params.minChestUsdc ?? '1'},
      ${params.inactivityDraws ?? 3}
    )
    RETURNING *;
  `;
  return mapSeason(result.rows[0]);
}

// ─── Crews ──────────────────────────────────────────────────────────────────

export async function listSeasonCrews(seasonId: string): Promise<SeasonCrewRow[]> {
  await ensureSeasonTables();
  const result = await sql`
    SELECT
      c.*,
      COUNT(m.id) AS active_members
    FROM season_crews c
    LEFT JOIN season_crew_members m
      ON m.crew_id = c.id
     AND m.seat_status = 'active'
    WHERE c.season_id = ${seasonId}
      AND c.status = 'active'
    GROUP BY c.id
    ORDER BY c.created_at ASC;
  `;
  return result.rows.map(mapCrew);
}

export async function getCrewById(crewId: string): Promise<SeasonCrewRow | null> {
  await ensureSeasonTables();
  const result = await sql`
    SELECT
      c.*,
      COUNT(m.id) AS active_members
    FROM season_crews c
    LEFT JOIN season_crew_members m
      ON m.crew_id = c.id
     AND m.seat_status = 'active'
    WHERE c.id = ${crewId}
    GROUP BY c.id
    LIMIT 1;
  `;
  return result.rows.length ? mapCrew(result.rows[0]) : null;
}

export async function getCrewByReferrerCode(referrerCode: string): Promise<SeasonCrewRow | null> {
  await ensureSeasonTables();
  const result = await sql`
    SELECT *
    FROM season_crews
    WHERE referrer_code = ${referrerCode}
    LIMIT 1;
  `;
  return result.rows.length ? mapCrew(result.rows[0]) : null;
}

export async function createCrew(params: {
  id: string;
  seasonId: string;
  name: string;
  crestAccent?: string;
  kind: SeasonCrewKind;
  syndicatePoolId?: string | null;
  coordinatorAddress: string;
  referrerCode: string;
}): Promise<SeasonCrewRow> {
  await ensureSeasonTables();
  const result = await sql`
    INSERT INTO season_crews (
      id,
      season_id,
      name,
      crest_accent,
      kind,
      syndicate_pool_id,
      coordinator_address,
      referrer_code,
      status
    )
    VALUES (
      ${params.id},
      ${params.seasonId},
      ${params.name},
      ${params.crestAccent ?? 'play'},
      ${params.kind},
      ${params.syndicatePoolId ?? null},
      ${params.coordinatorAddress},
      ${params.referrerCode},
      'active'
    )
    RETURNING *;
  `;
  return mapCrew(result.rows[0]);
}

// ─── Members / cuts ─────────────────────────────────────────────────────────

export async function listCrewMembers(crewId: string): Promise<SeasonCrewMemberRow[]> {
  await ensureSeasonTables();
  const result = await sql`
    SELECT *
    FROM season_crew_members
    WHERE crew_id = ${crewId}
    ORDER BY joined_at ASC, id ASC;
  `;
  return result.rows.map(mapMember);
}

export async function upsertCrewMember(params: {
  id: string;
  crewId: string;
  memberAddress: string;
  joinTxHash?: string | null;
}): Promise<SeasonCrewMemberRow> {
  await ensureSeasonTables();
  const result = await sql`
    INSERT INTO season_crew_members (
      id,
      crew_id,
      member_address,
      seat_status,
      joined_at,
      join_tx_hash
    )
    VALUES (
      ${params.id},
      ${params.crewId},
      ${params.memberAddress},
      'active',
      NOW(),
      ${params.joinTxHash ?? null}
    )
    ON CONFLICT (crew_id, member_address)
    DO UPDATE SET
      seat_status = 'active',
      joined_at = NOW(),
      freed_at = NULL,
      join_tx_hash = COALESCE(EXCLUDED.join_tx_hash, season_crew_members.join_tx_hash)
    RETURNING *;
  `;
  await recalculateCrewCuts(params.crewId);
  const member = await sql`
    SELECT * FROM season_crew_members WHERE id = ${result.rows[0].id as string} LIMIT 1;
  `;
  return mapMember(member.rows[0]);
}

export async function freeCrewSeat(
  crewId: string,
  memberAddress: string,
  reason: Exclude<SeasonSeatStatus, 'active'>,
): Promise<SeasonCrewMemberRow | null> {
  await ensureSeasonTables();
  const result = await sql`
    UPDATE season_crew_members
    SET seat_status = ${reason},
        freed_at = NOW()
    WHERE crew_id = ${crewId}
      AND member_address = ${memberAddress}
      AND seat_status = 'active'
    RETURNING *;
  `;
  if (!result.rows.length) return null;
  await recalculateCrewCuts(crewId);
  return mapMember(result.rows[0]);
}

/**
 * The tontine rule: the crew claim is shared equally across active seats.
 * When a seat frees, the remaining active seats renormalize to 100%.
 */
export async function recalculateCrewCuts(crewId: string): Promise<void> {
  await ensureSeasonTables();
  const active = await sql`
    SELECT id
    FROM season_crew_members
    WHERE crew_id = ${crewId}
      AND seat_status = 'active'
    ORDER BY joined_at ASC, id ASC;
  `;

  const count = active.rows.length;
  if (count === 0) return;

  const base = Math.floor(10000 / count);
  const remainder = 10000 - base * count;

  for (let i = 0; i < count; i += 1) {
    const cut = base + (i < remainder ? 1 : 0);
    const id = active.rows[i].id as string;
    await sql`
      UPDATE season_crew_members
      SET cut_bps = ${cut}
      WHERE id = ${id};
    `;
  }
}

// ─── Call-the-pot rounds and bids ───────────────────────────────────────────

export async function createCallRound(params: {
  id: string;
  crewId: string;
  chestSnapshotUsdc: string;
  cutoffAt: string;
}): Promise<SeasonCallRoundRow> {
  await ensureSeasonTables();
  const result = await sql`
    INSERT INTO season_call_rounds (
      id,
      crew_id,
      chest_snapshot_usdc,
      cutoff_at,
      status
    )
    VALUES (
      ${params.id},
      ${params.crewId},
      ${params.chestSnapshotUsdc},
      ${params.cutoffAt},
      'open'
    )
    RETURNING *;
  `;
  return mapRound(result.rows[0]);
}

export async function getOpenCallRound(crewId: string): Promise<SeasonCallRoundRow | null> {
  await ensureSeasonTables();
  const result = await sql`
    SELECT *
    FROM season_call_rounds
    WHERE crew_id = ${crewId}
      AND status = 'open'
    ORDER BY opened_at DESC
    LIMIT 1;
  `;
  return result.rows.length ? mapRound(result.rows[0]) : null;
}

export async function getCallRoundById(roundId: string): Promise<SeasonCallRoundRow | null> {
  await ensureSeasonTables();
  const result = await sql`
    SELECT * FROM season_call_rounds WHERE id = ${roundId} LIMIT 1;
  `;
  return result.rows.length ? mapRound(result.rows[0]) : null;
}

export async function listRoundBids(roundId: string): Promise<SeasonBidRow[]> {
  await ensureSeasonTables();
  const result = await sql`
    SELECT *
    FROM season_bids
    WHERE round_id = ${roundId}
      AND status IN ('live', 'won')
    ORDER BY discount_bps ASC, placed_at ASC;
  `;
  return result.rows.map(mapBid);
}

export async function placeOrReviseBid(params: {
  id: string;
  roundId: string;
  bidderAddress: string;
  discountBps: number;
  antiSnipeExtensionMs?: number;
}): Promise<{ bid: SeasonBidRow; round: SeasonCallRoundRow }> {
  await ensureSeasonTables();
  const round = await getCallRoundById(params.roundId);
  if (!round) throw new Error('Call round not found.');
  if (round.status !== 'open') throw new Error('Call round is not open.');
  if (Date.parse(round.cutoffAt) <= Date.now()) throw new Error('Call round has closed.');

  const existing = await sql`
    SELECT *
    FROM season_bids
    WHERE round_id = ${params.roundId}
      AND bidder_address = ${params.bidderAddress}
      AND status = 'live'
    LIMIT 1;
  `;

  let bidRow: Record<string, unknown>;
  if (existing.rows.length) {
    const updated = await sql`
      UPDATE season_bids
      SET discount_bps = ${params.discountBps},
          revised_at = NOW()
      WHERE id = ${existing.rows[0].id as string}
      RETURNING *;
    `;
    bidRow = updated.rows[0];
  } else {
    const inserted = await sql`
      INSERT INTO season_bids (
        id,
        round_id,
        bidder_address,
        discount_bps,
        status
      )
      VALUES (
        ${params.id},
        ${params.roundId},
        ${params.bidderAddress},
        ${params.discountBps},
        'live'
      )
      RETURNING *;
    `;
    bidRow = inserted.rows[0];
  }

  const extension = params.antiSnipeExtensionMs ?? 5 * 60 * 1000;
  const cutoffMs = Date.parse(round.cutoffAt);
  if (cutoffMs - Date.now() < extension) {
    await sql`
      UPDATE season_call_rounds
      SET cutoff_at = to_timestamp(${(cutoffMs + extension) / 1000})
      WHERE id = ${round.id};
    `;
  }

  const updatedRound = await getCallRoundById(round.id);
  if (!updatedRound) throw new Error('Call round disappeared after bid.');
  return { bid: mapBid(bidRow), round: updatedRound };
}

// ─── Events / public feed ───────────────────────────────────────────────────

export async function appendSeasonEvent(params: {
  id: string;
  seasonId?: string | null;
  crewId?: string | null;
  kind: string;
  payload?: Record<string, unknown>;
}): Promise<SeasonEventRow> {
  await ensureSeasonTables();
  const result = await sql`
    INSERT INTO season_events (
      id,
      season_id,
      crew_id,
      kind,
      payload
    )
    VALUES (
      ${params.id},
      ${params.seasonId ?? null},
      ${params.crewId ?? null},
      ${params.kind},
      ${JSON.stringify(params.payload ?? {})}
    )
    RETURNING *;
  `;
  return mapEvent(result.rows[0]);
}

export async function listSeasonEvents(seasonId: string, limit = 50): Promise<SeasonEventRow[]> {
  await ensureSeasonTables();
  const result = await sql`
    SELECT *
    FROM season_events
    WHERE season_id = ${seasonId}
    ORDER BY created_at DESC
    LIMIT ${limit};
  `;
  return result.rows.map(mapEvent);
}

export async function listCrewEvents(crewId: string, limit = 50): Promise<SeasonEventRow[]> {
  await ensureSeasonTables();
  const result = await sql`
    SELECT *
    FROM season_events
    WHERE crew_id = ${crewId}
    ORDER BY created_at DESC
    LIMIT ${limit};
  `;
  return result.rows.map(mapEvent);
}

// ─── Settlement (receipt-verified state transitions) ────────────────────────

/**
 * Mark a call round as settled and resolve the auction:
 * - winning bid → 'won', all other live bids → 'lost'
 * - round records the payout/bonus tx hashes (already receipt-verified by
 *   the caller before this runs)
 * - the caller's seat frees with reason 'freed_exit'
 * - cuts renormalize across surviving seats
 *
 * Callers MUST verify receipts on-chain first; this function only records
 * the resulting state.
 */
export async function settleCallRound(params: {
  roundId: string;
  winningBidId: string;
  callerPayoutTxHash: string;
  crewBonusTxHash: string;
  settleTxHash?: string | null;
  verification: Record<string, unknown>;
}): Promise<void> {
  await ensureSeasonTables();

  const round = await getCallRoundById(params.roundId);
  if (!round) throw new Error('Call round not found.');
  if (round.status === 'settled') return; // idempotent replay
  if (round.status === 'open' || round.status === 'settling') {
    await sql`
      UPDATE season_call_rounds
      SET status = 'settled',
          winning_bid_id = ${params.winningBidId},
          caller_payout_tx_hash = ${params.callerPayoutTxHash},
          crew_bonus_tx_hash = ${params.crewBonusTxHash},
          settle_tx_hash = ${params.settleTxHash ?? null}
      WHERE id = ${params.roundId};
    `;
  } else {
    throw new Error(`Round status ${round.status} cannot be settled.`);
  }

  await sql`
    UPDATE season_bids
    SET status = CASE WHEN id = ${params.winningBidId} THEN 'won' ELSE 'lost' END
    WHERE round_id = ${params.roundId}
      AND status = 'live';
  `;

  // Free the winning bidder's seat (they took the early payout).
  const winningBid = await sql`
    SELECT bidder_address FROM season_bids WHERE id = ${params.winningBidId} LIMIT 1;
  `;
  if (winningBid.rows.length) {
    const bidder = winningBid.rows[0].bidder_address as string;
    await freeCrewSeat(round.crewId, bidder, 'freed_exit');
    await appendSeasonEvent({
      id: crypto.randomUUID(),
      crewId: round.crewId,
      kind: 'seat.freed',
      payload: {
        address: bidder,
        reason: 'freed_exit',
        roundId: params.roundId,
        verification: params.verification,
      },
    });
  }

  await appendSeasonEvent({
    id: crypto.randomUUID(),
    crewId: round.crewId,
    kind: 'round.settled',
    payload: {
      roundId: params.roundId,
      winningBidId: params.winningBidId,
      callerPayoutTxHash: params.callerPayoutTxHash,
      crewBonusTxHash: params.crewBonusTxHash,
      chestUsdc: round.chestSnapshotUsdc,
    },
  });
}

/**
 * Expire an open round past its cutoff with no acceptable settlement —
 * marks it failed and journals the reason. The chest is untouched (nothing
 * was paid out), so it rolls into the next round naturally.
 */
export async function expireCallRound(roundId: string, reason: string): Promise<void> {
  await ensureSeasonTables();
  const round = await getCallRoundById(roundId);
  if (!round || round.status !== 'open') return;

  await sql`
    UPDATE season_call_rounds
    SET status = 'failed'
    WHERE id = ${roundId};
  `;
  await sql`
    UPDATE season_bids
    SET status = 'void'
    WHERE round_id = ${roundId}
      AND status = 'live';
  `;
  await appendSeasonEvent({
    id: crypto.randomUUID(),
    crewId: round.crewId,
    kind: 'round.failed',
    payload: { roundId, reason },
  });
}

/**
 * Record a verified on-chain contribution for a crew member (their real
 * ticket purchase, journaled from an event-log scan). Also updates the
 * seat's last_contribution_draw marker used by the keeper's inactivity
 * auto-free logic.
 */
export async function recordContribution(params: {
  crewId: string;
  memberAddress: string;
  drawId: string;
  tickets: number;
  txHash: string;
}): Promise<void> {
  await ensureSeasonTables();
  await sql`
    UPDATE season_crew_members
    SET last_contribution_draw = ${params.drawId}
    WHERE crew_id = ${params.crewId}
      AND member_address = ${params.memberAddress}
      AND seat_status = 'active';
  `;
  const crew = await getCrewById(params.crewId);
  await appendSeasonEvent({
    id: crypto.randomUUID(),
    seasonId: crew?.seasonId ?? null,
    crewId: params.crewId,
    kind: 'contribution',
    payload: {
      address: params.memberAddress,
      tickets: params.tickets,
      txHash: params.txHash,
      drawId: params.drawId,
    },
  });
}

// ─── Keeper queries (season-keeper cron) ────────────────────────────────────

/**
 * Active seats eligible for inactivity auto-free: joined before the cutoff
 * and never recorded a contribution since. The cutoff is computed by the
 * keeper from the season's inactivity_draws setting.
 */
export async function getInactiveSeats(
  seasonId: string,
  joinedBeforeIso: string,
): Promise<Array<{ id: string; crewId: string; memberAddress: string }>> {
  await ensureSeasonTables();
  const result = await sql`
    SELECT m.id, m.crew_id, m.member_address
    FROM season_crew_members m
    JOIN season_crews c ON c.id = m.crew_id
    WHERE c.season_id = ${seasonId}
      AND m.seat_status = 'active'
      AND m.joined_at < ${joinedBeforeIso}::timestamptz
      AND NOT EXISTS (
        SELECT 1
        FROM season_events e
        WHERE e.crew_id = m.crew_id
          AND e.kind = 'contribution'
          AND e.payload->>'address' = m.member_address
          AND e.created_at > m.joined_at
      );
  `;
  return result.rows.map((row) => ({
    id: row.id as string,
    crewId: row.crew_id as string,
    memberAddress: row.member_address as string,
  }));
}

/** Open call rounds whose cutoff has passed (candidates for expiry). */
export async function listOpenRoundsPastCutoff(): Promise<SeasonCallRoundRow[]> {
  await ensureSeasonTables();
  const result = await sql`
    SELECT *
    FROM season_call_rounds
    WHERE status = 'open'
      AND cutoff_at < NOW();
  `;
  return result.rows.map(mapRound);
}
