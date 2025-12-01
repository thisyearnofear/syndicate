/**
 * WALLET COMPONENTS INDEX
 * 
 * Core Principles Applied:
 * - CLEAN: Clear exports
 * - MODULAR: Single entry point
 * - ENHANCEMENT FIRST: Restored multi-wallet support
 */

// Multi-wallet support (restored)

export { default as SolanaWalletConnection } from './SolanaWalletConnection';
export { default as WalletConnectionOptions } from './WalletConnectionOptions';
export { default as WalletConnectionManager } from './WalletConnectionManager';

// Core components
export { WalletConnectionCard } from './WalletConnectionCard';
export { default as WalletInfo } from './WalletInfo';
export { default as ConnectWallet } from './ConnectWallet';
export { default as WalletInfoContainer } from './WalletInfoContainer';
export { Web3AuthErrorBoundary } from './Web3AuthErrorBoundary';