/**
 * Product mode ladder.
 *
 * Single source of truth for how Syndicate should be explained in product copy:
 * 1. Private Vaults
 * 2. Yield That Plays For You
 * 3. Public Play
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
    id: 'private_vaults',
    icon: '🔒',
    badge: 'Core product',
    title: 'Private Vaults',
    shortTitle: 'Private Vaults',
    tagline: 'Coordinate capital privately with selective disclosure.',
    description:
      'Create or join privacy-native vaults where sensitive balances stay encrypted by default and authorized users reveal them only when needed.',
    supportingCopy:
      'Best for syndicates, treasury groups, clubs, and coordinated capital where discretion matters.',
    href: '/create-syndicate',
    audience: 'Coordinated capital',
  },
  {
    id: 'yield_to_tickets',
    icon: '📈',
    badge: 'Signature mechanic',
    title: 'Yield That Plays For You',
    shortTitle: 'Yield-to-Tickets',
    tagline: 'Let your yield buy participation automatically.',
    description:
      'Deposit into vault strategies on Base and auto-convert earnings into lottery tickets or cause allocations without manually re-entering every draw.',
    supportingCopy:
      'Best for users who want smarter, more capital-efficient participation with principal-preserving flows.',
    href: '/vaults',
    audience: 'Smart participation',
  },
  {
    id: 'public_play',
    icon: '🎫',
    badge: 'Fast entry',
    title: 'Public Play',
    shortTitle: 'Megapot Access',
    tagline: 'Access Megapot directly through Syndicate.',
    description:
      'Buy tickets directly on Base through Syndicate when you want the fastest path into public prize participation.',
    supportingCopy:
      'Best for first-time users, quick entry, and lightweight public play.',
    href: '/',
    audience: 'Instant access',
  },
] as const;

export function getProductModeById(id: ProductModeId): ProductModeConfig | undefined {
  return PRODUCT_MODES.find(mode => mode.id === id);
}
