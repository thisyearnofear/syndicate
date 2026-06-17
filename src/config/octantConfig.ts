/**
 * OCTANT V2 CONFIGURATION
 *
 * Configuration for Octant v2 yield donating strategies
 * Based on official Octant v2 hackathon boilerplate
 *
 * PRODUCTION SETUP:
 * Before enabling Octant in production, deploy a real ERC-4626 USDC vault
 * (e.g., Yearn v3 USDC on Ethereum or Morpho USDC on Base) and set
 * vaults.ethereumUsdcVault to the deployed address. Also update contracts
 * addresses from the Octant team.
 */

export const OCTANT_V2_CONFIG = {
  // Mock mode is gated by the NEXT_PUBLIC_OCTANT_MOCK env flag (see
  // isOctantMockEnabled below), NOT a config constant. Without a real vault
  // address AND without that flag, Octant is disabled and refuses to run.

  // Contract addresses (fill with real addresses from Octant team once available)
  contracts: {
    morphoFactory: '0x...', // MorphoCompounderStrategyFactory (TODO: fill)
    skyFactory: '0x...', // SkyCompounderStrategyFactory (TODO: fill)
    yieldStrategy: '0x...', // YieldDonatingTokenizedStrategy (TODO: fill)
  },

  // Token addresses by network (mainnet and Base)
  tokens: {
    ethereum: {
      usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Ethereum USDC
    },
    base: {
      usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base USDC
    },
  },

  // Vault addresses (replace with real deployed ERC-4626 USDC vault before mainnet)
  vaults: {
    // TODO: Deploy or configure a real ERC-4626 USDC vault and set the address here.
    // Example: Yearn v3 USDC vault on Ethereum or a Morpho USDC vault on Base.
    // Until this is set, the provider will fall back to mock mode (in-memory balances).
    ethereumUsdcVault: '0x...', // e.g. Yearn v3 USDC vault address
  },

  // Default yield allocation percentages
  defaultAllocations: {
    ticketsPercentage: 80, // 80% of yield goes to buying more tickets
    causesPercentage: 20, // 20% of yield goes directly to causes
  },

  // Verified cause wallets (examples for demo)
  verifiedCauses: [
    {
      id: 'climate-action',
      name: 'Climate Action Fund',
      wallet: '0x...', // TODO: Fill with verified climate action wallet
      description: 'Supporting renewable energy and carbon reduction projects',
    },
    {
      id: 'education-access',
      name: 'Education Access Initiative',
      wallet: '0x...', // TODO: Fill with verified education wallet
      description: 'Providing educational resources to underserved communities',
    },
    {
      id: 'ocean-cleanup',
      name: 'Ocean Cleanup Project',
      wallet: '0x...', // TODO: Fill with verified ocean cleanup wallet
      description: 'Removing plastic waste from oceans and waterways',
    },
  ],

  // APY estimates for different strategies
  expectedAPY: {
    morpho: 12.5, // Morpho compounder strategy APY
    sky: 8.5, // Sky protocol strategy APY
    default: 10.0, // Default fallback APY
  },

  // Minimum deposit amounts (in USDC)
  minimumDeposits: {
    individual: 10, // $10 minimum for individual deposits
    strategy: 100, // $100 minimum for yield strategies
  },

  // Lock configuration (5 min for dev/test; increase for production)
  lock: {
    durationSeconds: 5 * 60, // 5 minutes lock for MVP
  },
} as const;

export const OCTANT_CONFIG = OCTANT_V2_CONFIG;

/** In-memory mock vault identifier (no on-chain contract). */
export const OCTANT_MOCK_VAULT_ADDRESS = 'mock:octant-usdc';

/** Placeholder used in config until a real vault address is filled in. */
const OCTANT_VAULT_PLACEHOLDER = '0x...';

/**
 * True when a real ERC-4626 vault address has been configured
 * (i.e. it is not the `0x...` placeholder).
 */
export function isOctantVaultConfigured(): boolean {
  const addr = OCTANT_CONFIG.vaults?.ethereumUsdcVault;
  return !!addr && addr !== OCTANT_VAULT_PLACEHOLDER;
}

/**
 * True when the in-memory mock vault is explicitly opted into via
 * `NEXT_PUBLIC_OCTANT_MOCK`. Mirrors the TON pause pattern: the mock never
 * runs for real users unless a developer turns it on for demos/tests.
 */
export function isOctantMockEnabled(): boolean {
  const flag = (process.env.NEXT_PUBLIC_OCTANT_MOCK ?? '').trim().toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
}

/**
 * Octant is usable only when a real vault is configured OR the mock is
 * explicitly enabled. Otherwise it is disabled and must refuse to run.
 */
export function isOctantEnabled(): boolean {
  return isOctantVaultConfigured() || isOctantMockEnabled();
}

/**
 * Resolve the active Octant vault address:
 * - the real configured address when present,
 * - the mock address when `NEXT_PUBLIC_OCTANT_MOCK` is set,
 * - `null` when Octant is disabled (no real vault, no mock opt-in).
 */
export function resolveOctantVaultAddress(): string | null {
  if (isOctantVaultConfigured()) return OCTANT_CONFIG.vaults.ethereumUsdcVault;
  if (isOctantMockEnabled()) return OCTANT_MOCK_VAULT_ADDRESS;
  return null;
}
