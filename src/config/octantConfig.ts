/**
 * OCTANT V2 CONFIGURATION
 * 
 * Configuration for Octant v2 yield donating strategies
 * Based on official Octant v2 hackathon boilerplate
 */

export const OCTANT_V2_CONFIG = {
  // Feature flags
  useMockVault: true, // Toggle to use in-memory mock vault for MVP

  // Contract addresses (to be filled with real addresses from Octant team)
  contracts: {
    morphoFactory: '0x...', // MorphoCompounderStrategyFactory
    skyFactory: '0x...', // SkyCompounderStrategyFactory
    yieldStrategy: '0x...', // YieldDonatingTokenizedStrategy
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

  // Vault addresses (fill with real ERC-4626 USDC vault when moving off mock)
  vaults: {
    ethereumUsdcVault: '0x...', // Yearn v3 ERC-4626 USDC or Octant TokenizedStrategy vault
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
      wallet: '0x...', // To be filled with real verified wallet
      description: 'Supporting renewable energy and carbon reduction projects',
    },
    {
      id: 'education-access',
      name: 'Education Access Initiative',
      wallet: '0x...', // To be filled with real verified wallet
      description: 'Providing educational resources to underserved communities',
    },
    {
      id: 'ocean-cleanup',
      name: 'Ocean Cleanup Project',
      wallet: '0x...', // To be filled with real verified wallet
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

  // MVP lock configuration (short lock for demo/testing)
  lock: {
    durationSeconds: 5 * 60, // 5 minutes lock for MVP
  },
} as const;

export const OCTANT_CONFIG = OCTANT_V2_CONFIG;