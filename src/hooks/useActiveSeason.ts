'use client';

import { useEffect, useState } from 'react';
import { useCapability } from '@/hooks/useCapability';
import {
  getSeasonCampaignChainCandidates,
  isSeasonTemporallyActive,
} from '@/config/season';
import type { CrewSummary, SeasonSummary } from '@/components/season/types';

export const SEATED_CREW_STORAGE_KEY = 'syndicate_season_crew_id';

export function rememberSeatedCrew(crewId: string): void {
  try {
    sessionStorage.setItem(SEATED_CREW_STORAGE_KEY, crewId);
  } catch {
    /* private mode */
  }
}

export function readSeatedCrewId(): string | null {
  try {
    return sessionStorage.getItem(SEATED_CREW_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** True when this wallet holds an active seat on the given crew. */
export function memberHoldsSeat(
  members: Array<{ memberAddress: string; seatStatus: string }>,
  address: string | null | undefined,
): boolean {
  if (!address) return false;
  const you = address.toLowerCase();
  return members.some(
    (member) => member.memberAddress.toLowerCase() === you && member.seatStatus === 'active',
  );
}

/**
 * Active campaign season for nav / home banner / overlays.
 * Probes campaign chain candidates; hides when capability off, no row,
 * or the draw window has ended (checked at fetch + once per minute).
 */
export function useActiveSeason(chainId?: number) {
  const { ctaState, message } = useCapability('season');
  const [season, setSeason] = useState<SeasonSummary | null>(null);
  const [crews, setCrews] = useState<CrewSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ctaState === 'hidden') return;
    let cancelled = false;

    const load = async () => {
      try {
        const candidates = chainId
          ? [chainId]
          : getSeasonCampaignChainCandidates();
        let found: { season: SeasonSummary; crews: CrewSummary[] } | null = null;
        const now = Date.now();
        for (const id of candidates) {
          const res = await fetch(`/api/season?chainId=${id}`);
          if (!res.ok) continue;
          const data = (await res.json()) as {
            season?: SeasonSummary | null;
            crews?: CrewSummary[];
          };
          if (data.season && isSeasonTemporallyActive(data.season, now)) {
            found = { season: data.season, crews: data.crews ?? [] };
            break;
          }
        }
        if (cancelled) return;
        setSeason(found?.season ?? null);
        setCrews(found?.crews ?? []);
      } catch {
        if (!cancelled) {
          setSeason(null);
          setCrews([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const timer = setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [chainId, ctaState]);

  // Derive visibility — do not sync-clear state in the effect when hidden.
  const visible = ctaState !== 'hidden' && season != null;
  const shownSeason = visible ? season : null;
  const shownCrews = visible ? crews : [];
  const shownLoading = ctaState === 'hidden' ? false : loading;

  return {
    ctaState,
    message,
    season: shownSeason,
    crews: shownCrews,
    loading: shownLoading,
    visible,
  };
}
