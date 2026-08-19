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
// LADDER COLOR LANGUAGE (added by the reveal-grammar design system)
// =============================================================================
//
// The rulebook is docs/DESIGN.md: pages may only take accent colors from
// ACCENTS, mapped to their domain via DOMAIN_ACCENT. The ladder is the
// identity: Play=amber, Grow=emerald, Coordinate=violet; infrastructure
// pages stay neutral. No page invents a new accent family.

import type { ProductModeId } from '@/config/productModes';

export type DesignAccent = 'play' | 'grow' | 'coordinate' | 'neutral' | 'experimental' | 'arena';

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
    gradientText: 'bg-gradient-to-r from-amber-200 via-yellow-300 to-orange-400 bg-clip-text text-transparent',
    tile: 'bg-amber-400/15',
    badge: 'text-amber-300/70',
    border: 'hover:border-amber-400/40 hover:shadow-[0_10px_40px_-12px_rgba(251,191,36,0.30)]',
    icon: 'text-amber-300',
    hairline: 'from-amber-400/70 via-amber-400/20 to-transparent',
    glow: {
      top: 'bg-amber-500/[0.07]',
      bottom: 'bg-orange-500/[0.05]',
    },
  },
  grow: {
    gradientText: 'bg-gradient-to-r from-emerald-200 via-emerald-300 to-teal-400 bg-clip-text text-transparent',
    tile: 'bg-emerald-400/15',
    badge: 'text-emerald-300/70',
    border: 'hover:border-emerald-400/40 hover:shadow-[0_10px_40px_-12px_rgba(52,211,153,0.30)]',
    icon: 'text-emerald-300',
    hairline: 'from-emerald-400/70 via-emerald-400/20 to-transparent',
    glow: {
      top: 'bg-emerald-500/[0.07]',
      bottom: 'bg-teal-500/[0.05]',
    },
  },
  coordinate: {
    gradientText: 'bg-gradient-to-r from-violet-200 via-purple-300 to-fuchsia-400 bg-clip-text text-transparent',
    tile: 'bg-violet-400/15',
    badge: 'text-violet-300/70',
    border: 'hover:border-violet-400/40 hover:shadow-[0_10px_40px_-12px_rgba(167,139,250,0.30)]',
    icon: 'text-violet-300',
    hairline: 'from-violet-400/70 via-violet-400/20 to-transparent',
    glow: {
      top: 'bg-violet-500/[0.08]',
      bottom: 'bg-fuchsia-500/[0.05]',
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
      top: 'bg-blue-500/[0.05]',
      bottom: 'bg-indigo-500/[0.04]',
    },
  },
  /**
   * Experimental surfaces (X Layer). A fifth meaning — "this is the R&D
   * engine" — must always pair with a Testnet badge (docs/DESIGN.md).
   */
  experimental: {
    gradientText: 'bg-gradient-to-r from-cyan-200 via-blue-300 to-indigo-300 bg-clip-text text-transparent',
    tile: 'bg-cyan-400/15',
    badge: 'text-cyan-300/70',
    border: 'hover:border-cyan-400/40 hover:shadow-[0_10px_40px_-12px_rgba(34,211,238,0.30)]',
    icon: 'text-cyan-300',
    hairline: 'from-cyan-400/70 via-cyan-400/20 to-transparent',
    glow: {
      top: 'bg-cyan-500/[0.08]',
      bottom: 'bg-blue-500/[0.05]',
    },
  },
  /**
   * ARENA — the game layer (Season of Tickets). Antique gold and oxblood:
   * the 1653 tontine, not a fintech dashboard. Pairs with
   * `<PageShell surface="arena">` and the .vellum / .ledger-rule utilities
   * in globals.css. See docs/DESIGN.md "The arena surface".
   *
   * Deliberately distinct from `play` amber: play is bright amber on cool
   * slate, arena is aged brass on warm ink. The surface carries most of the
   * difference; this accent only has to stay in period with it.
   */
  arena: {
    gradientText:
      'bg-gradient-to-r from-[#f7ead0] via-[#e3c887] to-[#b8891f] bg-clip-text text-transparent',
    tile: 'bg-[#c9a227]/15',
    badge: 'text-[#e3c887]/80',
    border: 'hover:border-[#c9a227]/45 hover:shadow-[0_10px_40px_-12px_rgba(201,162,39,0.35)]',
    icon: 'text-[#e3c887]',
    hairline: 'from-[#c9a227]/80 via-[#c9a227]/25 to-transparent',
    glow: {
      top: 'bg-[#7a2018]/[0.22]',
      bottom: 'bg-[#c9a227]/[0.10]',
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

/** Route domain → accent. Landing/product-mode accents alias these. */
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

/** Alias for the landing's mode ladder (was page-local in app/page.tsx). */
export const MODE_ACCENTS: Record<ProductModeId, AccentTokens> = {
  public_play: ACCENTS.play,
  yield_to_tickets: ACCENTS.grow,
  private_vaults: ACCENTS.coordinate,
};
