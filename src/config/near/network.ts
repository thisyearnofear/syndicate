// NEAR Configuration based on bridge-sdk-js patterns
export const NEAR_CONFIG = {
  networkId: 'mainnet',
  nodeUrl: 'https://rpc.mainnet.near.org',
  walletUrl: 'https://wallet.mainnet.near.org',
  helperUrl: 'https://helper.mainnet.near.org',
  explorerUrl: 'https://nearblocks.io',
  apiBaseUrl: 'https://1click.chaindefuser.com',
};

// Environment-specific overrides
export const getNearConfig = () => {
  return {
    ...NEAR_CONFIG,
    
    // Contract addresses from environment
    contracts: {
      mpc: process.env.NEXT_PUBLIC_MPC_CONTRACT,
      chainSignature: process.env.NEXT_PUBLIC_CHAIN_SIGNATURE_CONTRACT,
      bridge: process.env.NEXT_PUBLIC_RAINBOW_BRIDGE_CONTRACT,
    },
  };
};