/**
 * Season campaign chain — single source for nav banners, HQ, and overlays.
 *
 * Capability is testnet-first (docs/SEASON.md). Override with
 * NEXT_PUBLIC_SEASON_CHAIN_ID=8453|84532 when the active row lives elsewhere.
 */

import { CHAIN_IDS } from '@/config/contracts';

export function getSeasonCampaignChainId(): number {
  const raw = Number(process.env.NEXT_PUBLIC_SEASON_CHAIN_ID ?? '');
  if (raw === CHAIN_IDS.BASE || raw === CHAIN_IDS.BASE_SEPOLIA) return raw;
  return CHAIN_IDS.BASE_SEPOLIA;
}

/** Preferred then alternate — UI probes both so a mainnet-only row still surfaces. */
export function getSeasonCampaignChainCandidates(): number[] {
  const preferred = getSeasonCampaignChainId();
  const other =
    preferred === CHAIN_IDS.BASE ? CHAIN_IDS.BASE_SEPOLIA : CHAIN_IDS.BASE;
  return [preferred, other];
}

/** Temporal containment: active status and inside the draw window. */
export function isSeasonTemporallyActive(
  season: { status: string; drawWindowEnd: number },
  now: number,
): boolean {
  if (season.status !== 'active') return false;
  if (season.drawWindowEnd > 0 && now >= season.drawWindowEnd) return false;
  return true;
}
