'use client';

/**
 * CREW CREST — heraldic identity, derived not authored.
 *
 * A crew without an emblem is a row in a table. `crest_accent` has been in the
 * schema since migration 017 and was never rendered; this component finally
 * consumes it, and derives everything else (field division, tinctures, charge)
 * deterministically from the crew id.
 *
 * Why derived: a crew is created by a player typing a name into a form. There
 * is no upload step, no moderation queue, and no asset pipeline — so identity
 * has to be free. Hashing the id gives every crew a stable, distinct, period-
 * correct device at zero cost, and the same crest follows the crew through the
 * ladder, the seat table, the syndicate overlay and the share card.
 *
 * Heraldry is genuine-ish: a shield, a division of the field (per pale, per
 * fess, quarterly, per bend, per chevron), a metal-on-colour tincture pair,
 * and one charge. Engraved hatching over the field keeps it in the same
 * copperplate register as the arena surface.
 */

import { useMemo } from 'react';

interface CrewCrestProps {
  /** Crew id — the entropy source. Stable for the life of the crew. */
  crewId: string;
  /** Crew name — supplies the initial struck on the shield when there is room. */
  name?: string;
  /** `crest_accent` from the crews table; picks the colour family. */
  accent?: string;
  size?: number;
  /** Ring the crest in brass (used for the leading crew on the ladder). */
  crowned?: boolean;
  className?: string;
}

/* ── Tinctures ────────────────────────────────────────────────────────────── */
// Heraldic families, warmed to sit on the arena's ink ground. Each entry is
// [field dark, field light, charge metal].
const TINCTURES: Record<string, [string, string, string]> = {
  // gules (red) — the arena default, matches the oxblood vignette
  play: ['#5e1912', '#8f2a1e', '#e3c887'],
  // vert (green)
  grow: ['#12351f', '#1d5230', '#e3c887'],
  // purpure (purple)
  coordinate: ['#2c1a4a', '#452a6f', '#e3c887'],
  // azure (blue)
  autopilot: ['#132a4d', '#1e3f70', '#e3c887'],
  // sable (black) with brass
  neutral: ['#1a1712', '#2b261c', '#e3c887'],
};

const TINCTURE_ORDER = ['play', 'grow', 'coordinate', 'autopilot', 'neutral'] as const;

/** FNV-1a — small, stable, and no dependency. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/* ── Field divisions ─────────────────────────────────────────────────────── */
// Each returns the path of the *lighter* half laid over the darker field.
const DIVISIONS = [
  // per pale (vertical split)
  'M50 4 H92 V52 Q92 84 50 108 Z',
  // per fess (horizontal split)
  'M8 4 H92 V50 H8 Z',
  // quarterly
  'M50 4 H92 V50 H50 Z M8 50 H50 V108 Q8 84 8 50 Z',
  // per bend
  'M8 4 H92 L8 92 Z',
  // per chevron
  'M50 40 L92 84 V52 Q92 84 50 108 Q8 84 8 52 V84 Z',
  // plain field with a fess (horizontal band)
  'M8 44 H92 V64 H8 Z',
] as const;

/* ── Charges ─────────────────────────────────────────────────────────────── */
// Simple, readable devices at 24px. Drawn in a 100×112 shield viewBox,
// centred around (50, 52).
const CHARGES = [
  // mullet (star) — the lottery draw
  'M50 30 L56 46 L73 46 L59 56 L64 72 L50 62 L36 72 L41 56 L27 46 L44 46 Z',
  // fleur-de-lis — de Tonti's French court
  'M50 26 C46 34 40 38 40 46 C40 52 45 55 50 55 C55 55 60 52 60 46 C60 38 54 34 50 26 Z M36 50 C30 52 28 58 32 63 C36 68 44 66 46 60 Z M64 50 C70 52 72 58 68 63 C64 68 56 66 54 60 Z M42 66 H58 V70 H42 Z M46 70 H54 V78 H46 Z',
  // crescent
  'M50 28 A22 22 0 1 0 50 76 A17 17 0 1 1 50 28 Z',
  // key — the coordinator's charge
  'M50 26 A9 9 0 1 0 50 44 A9 9 0 1 0 50 26 Z M47 44 H53 V76 H47 Z M53 56 H63 V61 H53 Z M53 66 H61 V71 H53 Z',
  // lozenge (the ticket)
  'M50 28 L70 52 L50 76 L30 52 Z',
  // roundel with rays (the pot)
  'M50 34 A18 18 0 1 0 50 70 A18 18 0 1 0 50 34 Z',
  // chevron
  'M50 30 L72 62 L64 68 L50 46 L36 68 L28 62 Z',
  // pale (vertical band) with a cross
  'M46 28 H54 V76 H46 Z M32 46 H68 V54 H32 Z',
  // escallop (scallop shell)
  'M50 30 C34 30 26 42 28 58 L50 72 L72 58 C74 42 66 30 50 30 Z',
  // annulet trio
  'M50 30 A8 8 0 1 0 50 46 A8 8 0 1 0 50 30 Z M36 54 A8 8 0 1 0 36 70 A8 8 0 1 0 36 54 Z M64 54 A8 8 0 1 0 64 70 A8 8 0 1 0 64 54 Z',
] as const;

/** Shield outline — a French/heater shield, period-appropriate. */
const SHIELD = 'M8 4 H92 V52 Q92 88 50 108 Q8 88 8 52 Z';

export function CrewCrest({
  crewId,
  name,
  accent,
  size = 40,
  crowned = false,
  className = '',
}: CrewCrestProps) {
  const design = useMemo(() => {
    const h = hash(crewId || 'crew');
    const family =
      accent && TINCTURES[accent]
        ? accent
        : TINCTURE_ORDER[h % TINCTURE_ORDER.length];
    const [dark, light, metal] = TINCTURES[family] ?? TINCTURES.play;
    return {
      dark,
      light,
      metal,
      division: DIVISIONS[(h >>> 3) % DIVISIONS.length],
      charge: CHARGES[(h >>> 7) % CHARGES.length],
      clipId: `crest-clip-${(h >>> 0).toString(36)}`,
      hatchId: `crest-hatch-${(h >>> 0).toString(36)}`,
    };
  }, [crewId, accent]);

  const initial = name?.trim()?.[0]?.toUpperCase() ?? '';

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={name ? `${name} crest` : 'Crew crest'}
    >
      <svg
        viewBox="0 0 100 112"
        width={size}
        height={size}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          <clipPath id={design.clipId}>
            <path d={SHIELD} />
          </clipPath>
          {/* Copperplate hatching, same register as the arena ground. */}
          <pattern
            id={design.hatchId}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(135)"
          >
            <line x1="0" y1="0" x2="0" y2="6" stroke="#f7ead0" strokeWidth="1" opacity="0.09" />
          </pattern>
        </defs>

        <g clipPath={`url(#${design.clipId})`}>
          <rect x="0" y="0" width="100" height="112" fill={design.dark} />
          <path d={design.division} fill={design.light} />
          <rect x="0" y="0" width="100" height="112" fill={`url(#${design.hatchId})`} />
          {/* Charge */}
          <path
            d={design.charge}
            fill={design.metal}
            stroke="rgba(10,7,4,0.55)"
            strokeWidth="1"
          />
          {/* Chief light — makes the shield read as pressed metal, not a flat icon. */}
          <path d="M8 4 H92 V26 Q50 40 8 26 Z" fill="#f7ead0" opacity="0.07" />
        </g>

        {/* Brass border */}
        <path
          d={SHIELD}
          fill="none"
          stroke={crowned ? '#f7ead0' : '#c9a227'}
          strokeWidth={crowned ? 4 : 3}
          opacity={crowned ? 0.95 : 0.7}
        />

        {initial && (
          <text
            x="50"
            y="98"
            textAnchor="middle"
            className="font-display"
            fontSize="17"
            fontWeight="700"
            fill="#f7ead0"
            opacity="0.85"
          >
            {initial}
          </text>
        )}
      </svg>
    </span>
  );
}
