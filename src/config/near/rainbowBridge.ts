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
