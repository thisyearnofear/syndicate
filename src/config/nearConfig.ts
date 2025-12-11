import { NEAR_CONFIG } from './near/network';
import { MPC_CONTRACTS } from './near/mpc';
import { RAINBOW_BRIDGE_CONTRACTS } from './near/rainbowBridge';
import { SUPPORTED_CHAINS } from './chains';

export * from './near';

// Environment-specific overrides
export const getNearConfig = () => {
  return {
    ...NEAR_CONFIG,
    
    // Contract addresses from environment
    contracts: {
      mpc: process.env.NEXT_PUBLIC_MPC_CONTRACT || MPC_CONTRACTS.multichain,
      chainSignature: process.env.NEXT_PUBLIC_CHAIN_SIGNATURE_CONTRACT || MPC_CONTRACTS.chainSignature,
      bridge: process.env.NEXT_PUBLIC_RAINBOW_BRIDGE_CONTRACT || RAINBOW_BRIDGE_CONTRACTS.near.bridge,
    },
  };
};

export { SUPPORTED_CHAINS };