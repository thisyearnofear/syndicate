// src/config/design.ts — the reveal-grammar design system (docs/DESIGN.md).
//
// ACCENTS / SURFACES below are the single source of accent + surface tokens;
// pages may only take colors from here. The shadow tokens are the one legacy
// export still imported elsewhere (InfoTooltip); everything else in the old
// "PREMIUM DESIGN SYSTEM" block was dead code and has been removed.

export const shadows = {
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  
  // Premium glows
  glow: {
    sm: '0 0 10px rgb(59 130 246 / 0.5)',
    md: '0 0 20px rgb(59 130 246 / 0.5)',
    lg: '0 0 30px rgb(59 130 246 / 0.5)',
    primary: '0 0 20px rgb(102 126 234 / 0.6)',
    secondary: '0 0 20px rgb(34 197 94 / 0.6)',
    jackpot: '0 0 30px rgb(251 191 36 / 0.8)',
  },
} as const;

// =============================================================================
// LADDER COLOR LANGUAGE (OKLCH — docs/DESIGN.md)
// =============================================================================
//
// Accents are perceptually balanced in OKLCH (matched lightness/chroma across
// the ladder) so Play/Grow/Coordinate read as one system, not Tailwind defaults
// glued together. Pages take colors only from ACCENTS / RECEIPT below.

export type DesignAccent = 'play' | 'grow' | 'coordinate' | 'neutral' | 'experimental' | 'arena';

/** Canonical OKLCH swatches. Tailwind classes below use the same values. */
export const OKLCH = {
  play: {
    hi: 'oklch(0.90 0.12 85)',
    mid: 'oklch(0.82 0.15 75)',
    lo: 'oklch(0.72 0.16 55)',
  },
  grow: {
    hi: 'oklch(0.90 0.11 165)',
    mid: 'oklch(0.80 0.14 160)',
    lo: 'oklch(0.70 0.12 175)',
  },
  // Indigo-violet (not fuchsia) — avoid the purple→pink AI default.
  coordinate: {
    hi: 'oklch(0.88 0.10 285)',
    mid: 'oklch(0.78 0.14 290)',
    lo: 'oklch(0.68 0.12 300)',
  },
  experimental: {
    hi: 'oklch(0.90 0.10 210)',
    mid: 'oklch(0.80 0.12 220)',
    lo: 'oklch(0.72 0.10 240)',
  },
  arena: {
    hi: 'oklch(0.94 0.04 95)',
    mid: 'oklch(0.86 0.10 85)',
    lo: 'oklch(0.72 0.14 75)',
    oxblood: 'oklch(0.38 0.12 25)',
  },
  receipt: {
    verified: 'oklch(0.78 0.14 155)',
    pending: 'oklch(0.82 0.14 75)',
    absorbed: 'oklch(0.55 0.02 260)',
    hash: 'oklch(0.82 0.02 260)',
  },
} as const;

/** Proof-object tokens — same emerald/amber/mono everywhere (ReceiptStrip). */
export const RECEIPT = {
  hash: 'font-mono text-[oklch(0.82_0.02_260)]',
  verified: 'text-[oklch(0.78_0.14_155)]',
  pending: 'text-[oklch(0.82_0.14_75)]',
  absorbed: 'text-[oklch(0.55_0.02_260)]',
  dotVerified: 'bg-[oklch(0.78_0.14_155)]',
  dotPending: 'bg-[oklch(0.82_0.14_75)] animate-pulse',
  dotAbsorbed: 'bg-[oklch(0.55_0.02_260)]',
} as const;

/**
 * Motion budget (docs/DESIGN.md Hard Rule 5 + Phase 5).
 * One entrance per surface; BeamFrame only on the primary money CTA;
 * ceremony primitives stay route-licensed.
 */
export const MOTION_BUDGET = {
  headerEnterMs: 0,
  contentEnterMs: 120,
  /** Max BeamFrame laps on a money CTA (never Infinity on consumer surfaces). */
  beamLapsMax: 2,
  beamDurationSec: 4,
  countUpDurationMs: 1500,
} as const;

export interface AccentTokens {
  /** Gradient used for heading text and hairlines. neutral keeps plain white. */
  gradientText: string;
  /** Icon tile background */
  tile: string;
  /** Small badge/status line color */
  badge: string;
  /** Hover border + glow for cards in this domain */
  border: string;
  /** Solid icon/check color */
  icon: string;
  /** Hairline gradient under page headers */
  hairline: string;
  /** Ambient backdrop glow blobs (low-opacity, blur-3xl) — brand color as atmosphere */
  glow: {
    top: string;
    bottom: string;
  };
}

export const ACCENTS: Record<DesignAccent, AccentTokens> = {
  play: {
    gradientText:
      'bg-gradient-to-r from-[oklch(0.90_0.12_85)] via-[oklch(0.82_0.15_75)] to-[oklch(0.72_0.16_55)] bg-clip-text text-transparent',
    tile: 'bg-[oklch(0.82_0.15_75_/0.15)]',
    badge: 'text-[oklch(0.82_0.15_75_/0.75)]',
    border:
      'hover:border-[oklch(0.82_0.15_75_/0.40)] hover:shadow-[0_10px_40px_-12px_oklch(0.82_0.15_75_/0.30)]',
    icon: 'text-[oklch(0.82_0.15_75)]',
    hairline: 'from-[oklch(0.82_0.15_75_/0.70)] via-[oklch(0.82_0.15_75_/0.20)] to-transparent',
    glow: {
      top: 'bg-[oklch(0.72_0.16_55_/0.07)]',
      bottom: 'bg-[oklch(0.72_0.16_55_/0.05)]',
    },
  },
  grow: {
    gradientText:
      'bg-gradient-to-r from-[oklch(0.90_0.11_165)] via-[oklch(0.80_0.14_160)] to-[oklch(0.70_0.12_175)] bg-clip-text text-transparent',
    tile: 'bg-[oklch(0.80_0.14_160_/0.15)]',
    badge: 'text-[oklch(0.80_0.14_160_/0.75)]',
    border:
      'hover:border-[oklch(0.80_0.14_160_/0.40)] hover:shadow-[0_10px_40px_-12px_oklch(0.80_0.14_160_/0.30)]',
    icon: 'text-[oklch(0.80_0.14_160)]',
    hairline: 'from-[oklch(0.80_0.14_160_/0.70)] via-[oklch(0.80_0.14_160_/0.20)] to-transparent',
    glow: {
      top: 'bg-[oklch(0.80_0.14_160_/0.07)]',
      bottom: 'bg-[oklch(0.70_0.12_175_/0.05)]',
    },
  },
  coordinate: {
    gradientText:
      'bg-gradient-to-r from-[oklch(0.88_0.10_285)] via-[oklch(0.78_0.14_290)] to-[oklch(0.68_0.12_300)] bg-clip-text text-transparent',
    tile: 'bg-[oklch(0.78_0.14_290_/0.15)]',
    badge: 'text-[oklch(0.78_0.14_290_/0.75)]',
    border:
      'hover:border-[oklch(0.78_0.14_290_/0.40)] hover:shadow-[0_10px_40px_-12px_oklch(0.78_0.14_290_/0.30)]',
    icon: 'text-[oklch(0.78_0.14_290)]',
    hairline: 'from-[oklch(0.78_0.14_290_/0.70)] via-[oklch(0.78_0.14_290_/0.20)] to-transparent',
    glow: {
      top: 'bg-[oklch(0.78_0.14_290_/0.08)]',
      bottom: 'bg-[oklch(0.68_0.12_300_/0.05)]',
    },
  },
  neutral: {
    gradientText: 'text-white',
    tile: 'bg-white/10',
    badge: 'text-gray-400',
    border: 'hover:border-white/25 hover:shadow-[0_10px_40px_-12px_rgba(255,255,255,0.15)]',
    icon: 'text-gray-300',
    hairline: 'from-white/30 via-white/10 to-transparent',
    glow: {
      top: 'bg-[oklch(0.55_0.08_260_/0.05)]',
      bottom: 'bg-[oklch(0.45_0.08_280_/0.04)]',
    },
  },
  /**
   * Experimental surfaces (X Layer). A fifth meaning — "this is the R&D
   * engine" — must always pair with a Testnet badge (docs/DESIGN.md).
   */
  experimental: {
    gradientText:
      'bg-gradient-to-r from-[oklch(0.90_0.10_210)] via-[oklch(0.80_0.12_220)] to-[oklch(0.72_0.10_240)] bg-clip-text text-transparent',
    tile: 'bg-[oklch(0.80_0.12_220_/0.15)]',
    badge: 'text-[oklch(0.80_0.12_220_/0.75)]',
    border:
      'hover:border-[oklch(0.80_0.12_220_/0.40)] hover:shadow-[0_10px_40px_-12px_oklch(0.80_0.12_220_/0.30)]',
    icon: 'text-[oklch(0.80_0.12_220)]',
    hairline: 'from-[oklch(0.80_0.12_220_/0.70)] via-[oklch(0.80_0.12_220_/0.20)] to-transparent',
    glow: {
      top: 'bg-[oklch(0.80_0.12_220_/0.08)]',
      bottom: 'bg-[oklch(0.72_0.10_240_/0.05)]',
    },
  },
  /**
   * ARENA — the game layer (Season of Tickets). Antique gold and oxblood:
   * the 1653 tontine, not a fintech dashboard. Pairs with
   * `<PageShell surface="arena">`. Deliberately distinct from `play` amber.
   */
  arena: {
    gradientText:
      'bg-gradient-to-r from-[oklch(0.94_0.04_95)] via-[oklch(0.86_0.10_85)] to-[oklch(0.72_0.14_75)] bg-clip-text text-transparent',
    tile: 'bg-[oklch(0.72_0.14_75_/0.15)]',
    badge: 'text-[oklch(0.86_0.10_85_/0.85)]',
    border:
      'hover:border-[oklch(0.72_0.14_75_/0.45)] hover:shadow-[0_10px_40px_-12px_oklch(0.72_0.14_75_/0.35)]',
    icon: 'text-[oklch(0.86_0.10_85)]',
    hairline: 'from-[oklch(0.72_0.14_75_/0.80)] via-[oklch(0.72_0.14_75_/0.25)] to-transparent',
    glow: {
      top: 'bg-[oklch(0.38_0.12_25_/0.22)]',
      bottom: 'bg-[oklch(0.72_0.14_75_/0.10)]',
    },
  },
};

// =============================================================================
// SURFACES — the page's ground (docs/DESIGN.md "The surfaces")
// =============================================================================
//
// A surface bundles background, texture and motion licence. There are four,
// and a page picks one; it never invents a fifth inline. `default` is the
// assumption for every utility/money page. `arena`, `lab`, and `grow` must
// be requested explicitly.

export type DesignSurface = 'default' | 'arena' | 'lab' | 'grow';

export interface SurfaceTokens {
  /** Page-level background classes applied by PageShell. */
  background: string;
  /** When true, PageShell renders the ambient accent glow blobs. */
  ambientGlow: boolean;
  /** When true, PageShell renders the arena's licensed ambient ember layer. */
  ambientEmbers: boolean;
  /** When true, PageShell renders the lab's licensed scanline layer. */
  ambientScan: boolean;
  /** When true, PageShell renders the grow's licensed yield-bloom layer. */
  ambientBloom: boolean;
}

export const SURFACES: Record<DesignSurface, SurfaceTokens> = {
  default: {
    background: 'bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950',
    ambientGlow: true,
    ambientEmbers: false,
    ambientScan: false,
    ambientBloom: false,
  },
  arena: {
    // Warm ink + oxblood/brass vignette + copperplate hatching, all in
    // globals.css so the texture is defined once.
    background: 'surface-arena',
    ambientGlow: true,
    ambientEmbers: true,
    ambientScan: false,
    ambientBloom: false,
  },
  lab: {
    // Cool CRT / control-room ground for the Agent Pool (X Layer).
    background: 'surface-lab',
    ambientGlow: true,
    ambientEmbers: false,
    ambientScan: true,
    ambientBloom: false,
  },
  /**
   * GROW — the licensed ambient ground for the yield domain. Yield accrues
   * continuously; a still page says the opposite. A single slow emerald bloom
   * breathes at the bottom of the ground — "capital working" — at the same
   * low amplitude as the arena embers and lab scanline. Figures on grow
   * surfaces should use CountUp so accrual is felt, not just seen.
   */
  grow: {
    background: 'bg-gradient-to-br from-slate-950 via-emerald-950/40 to-slate-950',
    ambientGlow: true,
    ambientEmbers: false,
    ambientScan: false,
    ambientBloom: true,
  },
};

/** Route domain → surface. Everything not listed uses `default`. */
export const DOMAIN_SURFACE: Record<string, DesignSurface> = {
  season: 'arena',
  xlayer: 'lab',
  vaults: 'grow',
  portfolio: 'grow',
  'yield-strategies': 'grow',
};

/** Route domain → accent. */
export const DOMAIN_ACCENT: Record<string, DesignAccent> = {
  home: 'play',
  'my-tickets': 'play',
  vaults: 'grow',
  portfolio: 'grow',
  'yield-strategies': 'grow',
  coordinate: 'coordinate',
  'create-syndicate': 'coordinate',
  syndicate: 'coordinate',
  season: 'arena',
  xlayer: 'experimental',
  bridge: 'neutral',
  settings: 'neutral',
};

