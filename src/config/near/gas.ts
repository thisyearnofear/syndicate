// Gas limits for different operations
export const GAS_LIMITS = {
  // NEAR gas (in TGas)
  near: {
    chainSignature: 300, // 300 TGas for chain signature
    bridgeTransfer: 200, // 200 TGas for bridge transfer
    mpcSign: 250, // 250 TGas for MPC signing
  },
  
  // EVM gas limits
  evm: {
    ticketPurchase: 150000, // Gas for Megapot ticket purchase
    bridgeDeposit: 100000, // Gas for bridge deposit
    tokenTransfer: 65000, // Gas for token transfer
  },
};

// Fee configuration
export const FEES = {
  // Bridge fees (in basis points, 1 bp = 0.01%)
  bridge: {
    rainbow: 10, // 0.1% bridge fee
    wormhole: 25, // 0.25% bridge fee
  },
  
  // NEAR storage deposit (in NEAR)
  storage: {
    accountRegistration: '0.00125', // 1.25 mN for account registration
    tokenRegistration: '0.0125', // 12.5 mN for token registration
  },
  
  // Gas price multipliers
  gasMultiplier: {
    fast: 1.5,
    standard: 1.0,
    slow: 0.8,
  },
};
