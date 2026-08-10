/**
 * CAPABILITY REGISTRY
 *
 * Single source of truth for what is available at runtime.
 *
 * Every product surface and chain declares:
 *   - its readiness status
 *   - whether reads and writes are enabled
 *   - supported chains
 *   - eligibility/privacy requirements
 *   - user-facing risk/availability copy
 *
 * Components, navigation, CTAs, and route guards consume this registry
 * instead of ad-hoc feature flags or conditional copy scattered across the app.
 *
 * The registry is derived from env vars, feature flags, and deploy-time
 * configuration — it never makes network calls itself.
 */

import { FEATURES } from '@/config';
import { XLAYER_HOOK_IS_CONFIGURED } from '@/config/xlayer';

/**
 * X Layer write gate: enabled when the hook deployment is configured AND
 * the operator has explicitly opted in via env var.
 * Set NEXT_PUBLIC_XLAYER_WRITES_ENABLED=true to activate testnet writes.
 */
const XLAYER_WRITES_ENABLED =
  XLAYER_HOOK_IS_CONFIGURED &&
  process.env.NEXT_PUBLIC_XLAYER_WRITES_ENABLED === 'true';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Readiness tier for a capability.
 * Matches the AGENTS.md status vocabulary.
 */
export type CapabilityStatus =
  | 'live'           // Production-ready, actively serving users
  | 'testnet'        // Deployed on testnet, not production
  | 'read_only'      // Data visible but no write/mutation available
  | 'partial'        // Some paths work, others require hardening
  | 'paused'         // Code exists but is intentionally gated off
  | 'placeholder';   // Interface stub only, no real implementation

export type CapabilityChain =
  | 'base'
  | 'ethereum'
  | 'avalanche'
  | 'solana'
  | 'stacks'
  | 'near'
  | 'starknet'
  | 'ton'
  | 'xlayer_testnet'
  | 'fhenix_testnet';

export type CapabilityId =
  // Product surfaces
  | 'megapot'
  | 'vaults'
  | 'syndicates'
  | 'syndicate_distribution'
  | 'fhenix_privacy'
  | 'yield_to_tickets'
  | 'automation_virtuals'
  | 'automation_erc7715'
  | 'xlayer_prize_pool'
  | 'portfolio'
  // Funding rails
  | 'bridge_base'
  | 'bridge_stacks'
  | 'bridge_solana'
  | 'bridge_near'
  | 'bridge_starknet'
  | 'bridge_ton'
  // Verification
  | 'verification';

export interface Capability {
  /** Unique identifier. */
  id: CapabilityId;
  /** Human-readable name for UI display. */
  label: string;
  /** Current readiness tier. */
  status: CapabilityStatus;
  /** Chains this capability operates on. */
  chains: readonly CapabilityChain[];
  /** Whether reads (balance checks, list views) are available. */
  readsEnabled: boolean;
  /** Whether writes (transactions, mutations) are available. */
  writesEnabled: boolean;
  /** Whether this capability requires explicit user opt-in. */
  requiresOptIn: boolean;
  /** Whether this is restricted to testnet operation. */
  testnetOnly: boolean;
  /** Risk/availability message shown when the capability is not fully live. */
  availabilityMessage: string | null;
  /** Specific wallet/network requirements (e.g., "EVM wallet on Base"). */
  walletRequirement: string | null;
  /** Related product mode, if any. */
  productMode: 'private_vaults' | 'yield_to_tickets' | 'public_play' | null;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * The full capability registry.
 *
 * This is the single place where feature status is declared. If the status
 * of a feature changes (e.g., X Layer moves from read_only to live), update
 * it here and every consuming component adapts automatically.
 */
export const CAPABILITIES: readonly Capability[] = [
  // ── Product surfaces ──────────────────────────────────────────────────────
  {
    id: 'megapot',
    label: 'Play Megapot',
    status: 'live',
    chains: ['base'],
    readsEnabled: true,
    writesEnabled: true,
    requiresOptIn: false,
    testnetOnly: false,
    availabilityMessage: null,
    walletRequirement: 'EVM wallet on Base',
    productMode: 'public_play',
  },
  {
    id: 'vaults',
    label: 'Vault Strategies',
    status: 'live',
    chains: ['base'],
    readsEnabled: true,
    writesEnabled: true,
    requiresOptIn: false,
    testnetOnly: false,
    availabilityMessage: null,
    walletRequirement: 'EVM wallet on Base',
    productMode: 'yield_to_tickets',
  },
  {
    id: 'syndicates',
    label: 'Syndicates',
    status: 'live',
    chains: ['base'],
    readsEnabled: true,
    writesEnabled: true,
    requiresOptIn: false,
    testnetOnly: false,
    availabilityMessage: null,
    walletRequirement: 'EVM wallet on Base',
    productMode: 'private_vaults',
  },
  {
    id: 'syndicate_distribution',
    label: 'Syndicate Winnings Payouts',
    // Winnings reads + coordinator claim are real; member payouts execute
    // through the pool's own rail (Safe app / 0xSplits / Cabana) — the app
    // guides and journals but does not custody a distribution step.
    status: 'partial',
    chains: ['base'],
    readsEnabled: true,
    writesEnabled: false,
    requiresOptIn: false,
    testnetOnly: false,
    availabilityMessage: 'Payouts to members execute on-chain via your pool type (Safe, Splits, or Cabana). The app verifies the payout transaction and records it when the coordinator pastes the tx hash.',
    walletRequirement: 'Pool coordinator wallet on Base',
    productMode: 'private_vaults',
  },
  {
    id: 'fhenix_privacy',
    label: 'Private Vaults (Fhenix)',
    status: 'testnet',
    chains: ['fhenix_testnet'],
    readsEnabled: true,
    writesEnabled: true,
    requiresOptIn: true,
    testnetOnly: true,
    availabilityMessage: 'Preview mode — try privacy features with testnet funds (no real money).',
    walletRequirement: 'EVM wallet on Fhenix testnet',
    productMode: 'private_vaults',
  },
  {
    id: 'yield_to_tickets',
    label: 'Yield-to-Tickets',
    status: 'live',
    chains: ['base'],
    readsEnabled: true,
    writesEnabled: true,
    requiresOptIn: false,
    testnetOnly: false,
    availabilityMessage: null,
    walletRequirement: 'EVM wallet on Base',
    productMode: 'yield_to_tickets',
  },
  {
    id: 'automation_virtuals',
    label: 'Virtuals ACP Automation',
    status: 'live',
    chains: ['base'],
    readsEnabled: true,
    writesEnabled: true,
    requiresOptIn: false,
    testnetOnly: false,
    availabilityMessage: null,
    walletRequirement: 'EVM wallet on Base',
    productMode: null,
  },
  {
    id: 'automation_erc7715',
    label: 'ERC-7715 Auto-Purchase',
    status: FEATURES.enableERC7715SmartSessions ? 'live' : 'paused',
    chains: ['base'],
    // Paused means gated off entirely: no read or write surfaces while the
    // smart-accounts-kit integration is incomplete.
    readsEnabled: FEATURES.enableERC7715SmartSessions,
    writesEnabled: FEATURES.enableERC7715SmartSessions,
    requiresOptIn: true,
    testnetOnly: false,
    availabilityMessage: FEATURES.enableERC7715SmartSessions
      ? null
      : 'Auto-purchase is not available in this environment yet.',
    walletRequirement: 'EVM wallet on Base with session key support',
    productMode: null,
  },
  {
    id: 'xlayer_prize_pool',
    label: 'X Layer Prize Pool',
    status: XLAYER_WRITES_ENABLED ? 'testnet' : XLAYER_HOOK_IS_CONFIGURED ? 'read_only' : 'paused',
    chains: ['xlayer_testnet'],
    readsEnabled: XLAYER_HOOK_IS_CONFIGURED,
    writesEnabled: XLAYER_WRITES_ENABLED,
    requiresOptIn: false,
    testnetOnly: true,
    availabilityMessage: XLAYER_WRITES_ENABLED
      ? 'Preview mode — testnet funds only (no real money).'
      : XLAYER_HOOK_IS_CONFIGURED
        ? 'Dashboard live. Set NEXT_PUBLIC_XLAYER_WRITES_ENABLED=true for testnet deposits.'
        : 'Coming soon — not yet available in this environment.',
    walletRequirement: 'EVM wallet on X Layer testnet',
    productMode: null,
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    status: 'live',
    chains: ['base'],
    readsEnabled: true,
    writesEnabled: false,
    requiresOptIn: false,
    testnetOnly: false,
    availabilityMessage: null,
    walletRequirement: 'Any connected wallet',
    productMode: null,
  },

  // ── Funding rails ─────────────────────────────────────────────────────────
  {
    id: 'bridge_base',
    label: 'Bridge to Base',
    status: 'live',
    chains: ['base', 'ethereum', 'avalanche'],
    readsEnabled: true,
    writesEnabled: true,
    requiresOptIn: false,
    testnetOnly: false,
    availabilityMessage: null,
    walletRequirement: 'EVM wallet',
    productMode: null,
  },
  {
    id: 'bridge_stacks',
    label: 'Bridge from Stacks',
    status: 'live',
    chains: ['stacks', 'base'],
    readsEnabled: true,
    writesEnabled: true,
    requiresOptIn: false,
    testnetOnly: false,
    availabilityMessage: null,
    walletRequirement: 'Stacks wallet',
    productMode: null,
  },
  {
    id: 'bridge_solana',
    label: 'Bridge from Solana',
    status: 'partial',
    chains: ['solana', 'base'],
    readsEnabled: true,
    writesEnabled: true,
    requiresOptIn: false,
    testnetOnly: false,
    availabilityMessage: 'Available — transfers typically take 15-20 minutes via CCTP.',
    walletRequirement: 'Solana wallet',
    productMode: null,
  },
  {
    id: 'bridge_near',
    label: 'Bridge from NEAR',
    status: 'partial',
    chains: ['near', 'base'],
    readsEnabled: true,
    writesEnabled: true,
    requiresOptIn: false,
    testnetOnly: false,
    availabilityMessage: 'Available — transfers typically take 10-15 minutes via NEAR Intents.',
    walletRequirement: 'NEAR wallet',
    productMode: null,
  },
  {
    id: 'bridge_starknet',
    label: 'Bridge from Starknet',
    status: 'partial',
    chains: ['starknet', 'base'],
    readsEnabled: true,
    writesEnabled: true,
    requiresOptIn: false,
    testnetOnly: false,
    availabilityMessage: 'Available — transfers typically take 2-5 minutes via Orbiter.',
    walletRequirement: 'Starknet wallet',
    productMode: null,
  },
  {
    id: 'bridge_ton',
    label: 'Bridge from TON',
    status: 'paused',
    chains: ['ton', 'base'],
    readsEnabled: false,
    writesEnabled: false,
    requiresOptIn: false,
    testnetOnly: false,
    availabilityMessage: 'Coming soon — TON support is in development.',
    walletRequirement: 'TON wallet',
    productMode: null,
  },

  // ── Verification ──────────────────────────────────────────────────────────
  {
    id: 'verification',
    label: 'Identity Verification',
    status: 'live',
    chains: ['base'],
    readsEnabled: true,
    writesEnabled: true,
    requiresOptIn: true,
    testnetOnly: false,
    availabilityMessage: 'Optional — not required to buy tickets or use vaults.',
    walletRequirement: null,
    productMode: null,
  },
] as const;

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/** Get a capability by its ID. */
export function getCapability(id: CapabilityId): Capability {
  const cap = CAPABILITIES.find((c) => c.id === id);
  if (!cap) throw new Error(`Unknown capability: ${id}`);
  return cap;
}

/** Check if a capability's writes are available. */
export function isWriteEnabled(id: CapabilityId): boolean {
  return getCapability(id).writesEnabled;
}

/** Check if a capability's reads are available. */
export function isReadEnabled(id: CapabilityId): boolean {
  return getCapability(id).readsEnabled;
}

/** Check if a capability is fully live (production, reads + writes). */
export function isLive(id: CapabilityId): boolean {
  const cap = getCapability(id);
  return cap.status === 'live' && cap.readsEnabled && cap.writesEnabled;
}

/** Check if a capability is visible in the UI (reads available, not paused). */
export function isVisible(id: CapabilityId): boolean {
  const cap = getCapability(id);
  return cap.readsEnabled && cap.status !== 'paused';
}

/** Get the user-facing availability message, or null if fully live. */
export function getAvailabilityMessage(id: CapabilityId): string | null {
  return getCapability(id).availabilityMessage;
}

/** Get all capabilities for a given chain. */
export function getCapabilitiesForChain(chain: CapabilityChain): Capability[] {
  return CAPABILITIES.filter((c) => c.chains.includes(chain));
}

/** Get all capabilities that are not fully production-live. */
export function getNonLiveCapabilities(): Capability[] {
  return CAPABILITIES.filter((c) => c.status !== 'live');
}

/**
 * Determine whether a CTA should be shown as enabled, disabled, or hidden.
 *
 * Use this to drive button/link state from a single source:
 *   - 'enabled': normal interaction
 *   - 'disabled': show but grey out, with availabilityMessage as tooltip
 *   - 'hidden': do not render
 */
export function getCtaState(id: CapabilityId): 'enabled' | 'disabled' | 'hidden' {
  const cap = getCapability(id);
  if (cap.status === 'paused' || (!cap.readsEnabled && !cap.writesEnabled)) return 'hidden';
  if (!cap.writesEnabled) return 'disabled';
  return 'enabled';
}

/**
 * Navigation visibility helper: should a nav item for this capability be shown?
 */
export function isNavVisible(id: CapabilityId): boolean {
  const cap = getCapability(id);
  // Show in nav if reads are available (even if writes aren't — e.g., read-only dashboards)
  return cap.readsEnabled && cap.status !== 'paused';
}
