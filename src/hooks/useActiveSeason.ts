'use client';

import { useEffect, useState } from 'react';
import { useCapability } from '@/hooks/useCapability';
import { CHAIN_IDS } from '@/config/contracts';
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

export function useActiveSeason(chainId: number = CHAIN_IDS.BASE) {
  const { ctaState, message } = useCapability('season');
  const [season, setSeason] = useState<SeasonSummary | null>(null);
  const [crews, setCrews] = useState<CrewSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ctaState === 'hidden') return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/season?chainId=${chainId}`);
        if (!res.ok) throw new Error('season fetch failed');
        const data = (await res.json()) as {
          season?: SeasonSummary | null;
          crews?: CrewSummary[];
        };
        if (cancelled) return;
        setSeason(data.season ?? null);
        setCrews(data.crews ?? []);
      } catch {
        if (!cancelled) {
          setSeason(null);
          setCrews([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chainId, ctaState]);

  const visible = ctaState !== 'hidden' && season != null;
  const shownSeason = ctaState === 'hidden' ? null : season;
  const shownCrews = ctaState === 'hidden' ? [] : crews;
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
