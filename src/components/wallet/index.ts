/**
 * WALLET COMPONENTS INDEX
 * 
 * Core Principles Applied:
 * - CLEAN: Single source of truth for wallet selection
 * - MODULAR: Composable wallet components
 * - ENHANCEMENT FIRST: Consolidated duplicate components
 * - AGGRESSIVE CONSOLIDATION: Deleted ConnectWallet.tsx, WalletInfoContainer.tsx, SolanaWalletConnection.tsx
 * 
 * Architecture: Single Active Wallet (any chain origin)
 * - User connects ONE wallet from their native chain
 * - System auto-routes bridging based on wallet type
 * - No manual wallet switching needed
 */

// Primary wallet connection component (consolidated)
export { WalletConnectionCard } from './WalletConnectionCard';

// Wallet state & display
export { default as WalletInfo } from './WalletInfo';

// Wallet connection management
export { default as WalletConnectionManager } from './WalletConnectionManager';
export { default as WalletConnectionOptions } from './WalletConnectionOptions';

// Error handling
export { Web3AuthErrorBoundary } from './Web3AuthErrorBoundary';