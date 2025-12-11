// MPC and Chain Signature Contracts (Real NEAR Chain Signatures)
export const MPC_CONTRACTS = {
  // Real Chain Signatures contract on NEAR mainnet
  multichain: 'v1.signer',
  
  // Chain signature contract (same as multichain)
  chainSignature: 'v1.signer',
  
  // MPC public key (retrieved from contract)
  publicKey: '', // Will be fetched from v1.signer contract
};

// Derivation paths for chain signatures (NEAR Chain Signatures format)
export const DERIVATION_PATHS = {
  ethereum: "ethereum-1",
  base: "ethereum-1", // Base uses Ethereum derivation
  avalanche: "ethereum-1", // Avalanche C-Chain uses Ethereum derivation  
  bitcoin: "bitcoin-1",
};
