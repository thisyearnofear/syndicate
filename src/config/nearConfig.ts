// NEAR Configuration based on bridge-sdk-js patterns
export const NEAR_CONFIG = {
  networkId: 'mainnet',
  nodeUrl: 'https://rpc.mainnet.near.org',
  walletUrl: 'https://wallet.mainnet.near.org',
  helperUrl: 'https://helper.mainnet.near.org',
  explorerUrl: 'https://nearblocks.io',
};

// MPC and Chain Signature Contracts (from bridge-sdk-js analysis)
export const MPC_CONTRACTS = {
  // Main MPC contract for chain signatures
  multichain: 'multichain-mpc.near',
  
  // Chain signature contract
  chainSignature: 'v1.signer.near',
  
  // MPC public key (this would be retrieved from the contract)
  publicKey: 'secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3',
};

// Rainbow Bridge Contracts (official addresses)
export const RAINBOW_BRIDGE_CONTRACTS = {
  // NEAR side contracts
  near: {
    // Main bridge contract
    bridge: 'rainbow-bridge.near',
    
    // Token locker for bridging
    locker: 'token.sweat',
    
    // Wrapped ETH on NEAR
    weth: 'aurora',
    
    // USDC on NEAR
    usdc: 'a0b86991c431e50b4f4b4e8a3c02c5d0c2f10d5d.factory.bridge.near',
  },
  
  // Ethereum/Base side contracts
  ethereum: {
    // Rainbow bridge on Ethereum
    bridge: '0x23ddd3e3692d1861ed57ede224608875809e127f',
    
    // Token locker
    locker: '0x6BFaD42cFC4EfC96f529D786D643Ff4A8B89FA52',
    
    // USDC on Ethereum
    usdc: '0xA0b86991c431e50B4f4b4e8A3c02c5d0C2f10d5D',
  },
  
  // Base chain contracts (derived from Ethereum)
  base: {
    // Base bridge (if available, otherwise use Ethereum bridge)
    bridge: '0x23ddd3e3692d1861ed57ede224608875809e127f', // May need update
    
    // USDC on Base
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    
    // Megapot contract on Base
    megapot: '0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95',
  },
  
  // Avalanche contracts (for cross-chain support)
  avalanche: {
    // USDC on Avalanche
    usdc: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    
    // Avalanche bridge (if using Wormhole or other)
    bridge: '0x0e082F06FF657D94310cB8cE8B0D9a04541d8052', // Example Wormhole
  },
};

// Derivation paths for chain signatures
export const DERIVATION_PATHS = {
  ethereum: "ethereum,1",
  base: "ethereum,8453", // Base chain ID
  avalanche: "ethereum,43114", // Avalanche chain ID
  bitcoin: "bitcoin,0",
};

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

// Supported chains for cross-chain operations
export const SUPPORTED_CHAINS = {
  near: {
    chainId: 'near',
    name: 'NEAR Protocol',
    nativeCurrency: { name: 'NEAR', symbol: 'NEAR', decimals: 24 },
    rpcUrl: NEAR_CONFIG.nodeUrl,
    explorerUrl: NEAR_CONFIG.explorerUrl,
  },
  
  ethereum: {
    chainId: 1,
    name: 'Ethereum',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
    rpcUrl: 'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io',
  },
  
  base: {
    chainId: 8453,
    name: 'Base',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
  },
  
  avalanche: {
    chainId: 43114,
    name: 'Avalanche',
    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    explorerUrl: 'https://snowtrace.io',
  },
};

// Contract ABIs (minimal required functions)
export const CONTRACT_ABIS = {
  megapot: [
    'function purchaseTickets(uint256 count) external payable',
    'function getTicketPrice() external view returns (uint256)',
    'function getCurrentJackpot() external view returns (uint256)',
  ],
  
  erc20: [
    'function transfer(address to, uint256 amount) external returns (bool)',
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function balanceOf(address account) external view returns (uint256)',
    'function allowance(address owner, address spender) external view returns (uint256)',
  ],
  
  bridge: [
    'function deposit(address token, uint256 amount, string memory recipient) external payable',
    'function withdraw(bytes memory proof) external',
    'function getFee(address token, uint256 amount) external view returns (uint256)',
  ],
};

// Environment-specific overrides
export const getConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    ...NEAR_CONFIG,
    
    // Override for development
    ...(isProduction ? {} : {
      networkId: 'testnet',
      nodeUrl: 'https://rpc.testnet.near.org',
      walletUrl: 'https://wallet.testnet.near.org',
      helperUrl: 'https://helper.testnet.near.org',
      explorerUrl: 'https://testnet.nearblocks.io',
    }),
    
    // Contract addresses from environment
    contracts: {
      mpc: process.env.NEXT_PUBLIC_MPC_CONTRACT || MPC_CONTRACTS.multichain,
      chainSignature: process.env.NEXT_PUBLIC_CHAIN_SIGNATURE_CONTRACT || MPC_CONTRACTS.chainSignature,
      bridge: process.env.NEXT_PUBLIC_RAINBOW_BRIDGE_CONTRACT || RAINBOW_BRIDGE_CONTRACTS.near.bridge,
    },
  };
};
