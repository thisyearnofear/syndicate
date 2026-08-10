/**
 * Product mode ladder.
 *
 * Single source of truth for how Syndicate should be explained in product copy:
 * 1. Play — fastest entry
 * 2. Grow — set-and-forget yield participation
 * 3. Coordinate — group capital with privacy
 */

export type ProductModeId = 'private_vaults' | 'yield_to_tickets' | 'public_play';

export interface ProductModeConfig {
  id: ProductModeId;
  icon: string;
  badge: string;
  title: string;
  shortTitle: string;
  tagline: string;
  description: string;
  supportingCopy: string;
  href: string;
  audience: string;
}

export const PRODUCT_MODES: readonly ProductModeConfig[] = [
  {
    id: 'public_play',
    icon: '🎫',
    badge: '$1 entry',
    title: 'Play',
    shortTitle: 'Megapot',
    tagline: 'Buy tickets. Draw is daily.',
    description:
      '$1 per ticket on Base. Non-custodial, provably fair, paid instantly on win.',
    supportingCopy: 'Fastest way in.',
    href: '/',
    audience: 'Everyone',
  },
  {
    id: 'yield_to_tickets',
    icon: '📈',
    badge: 'Set & forget',
    title: 'Grow',
    shortTitle: 'Yield-to-Tickets',
    tagline: 'Deposit once. Yield enters every draw.',
    description:
      'Your principal earns yield; earnings auto-convert to tickets each cycle. Withdraw the full deposit anytime.',
    supportingCopy: 'Passive, capital-efficient, no-loss.',
    href: '/vaults',
    audience: 'Passive players',
  },
  {
    id: 'private_vaults',
    icon: '🔒',
    badge: 'Group native',
    title: 'Coordinate',
    shortTitle: 'Syndicates',
    tagline: 'Pool capital. Play as a group.',
    description:
      'Multisig Safe pools, 0xSplits shares, or PoolTogether vaults. Winnings are claimed by the coordinator and paid out on-chain — receipt-verified.',
    supportingCopy: 'For syndicates, treasuries, and clubs. Privacy layer in preview.',
    href: '/discover',
    audience: 'Groups & treasuries',
  },
] as const;

export function getProductModeById(id: ProductModeId): ProductModeConfig | undefined {
  return PRODUCT_MODES.find(mode => mode.id === id);
}
