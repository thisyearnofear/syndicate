/**
 * DEPENDENCY STUBS
 * 
 * This module provides lightweight stubs for heavy dependencies that are
 * temporarily disabled for the Zcash hackathon to reduce build times.
 * 
 * DISABLED PACKAGES (~750MB saved):
 * - @solana/* - Solana wallet/blockchain support
 * - @wormhole-foundation/* - Wormhole bridge protocol
 * - @web3auth/* - Social login (Google, Twitter, etc.)
 * - @reown/* - Duplicate WalletConnect functionality
 * - @bonfida/* - Solana name service
 * 
 * KEPT PACKAGES (needed for hackathon):
 * - @near-js/* - NEAR blockchain (for NEAR Intents bounty)
 * - @near-wallet-selector/* - NEAR wallet connection
 * - @defuse-protocol/intents-sdk - Cross-chain intents
 * - @rainbow-me/rainbowkit - EVM wallet connection
 * - wagmi, viem - EVM blockchain interaction
 * - @coordinationlabs/megapot-ui-kit - Core UI
 * 
 * TO RE-ENABLE A PACKAGE:
 * 1. Add it back to package.json
 * 2. Find files importing from '@/stubs/[package]'
 * 3. Replace with original import (e.g., '@solana/web3.js')
 * 4. Run npm install
 * 
 * See individual stub files for specific package restore instructions.
 */

export * from './solana';
export * from './wormhole';
export * from './web3auth';

// Feature flags for runtime checks
export { SOLANA_ENABLED } from './solana';
export { WORMHOLE_ENABLED } from './wormhole';
export { WEB3AUTH_ENABLED } from './web3auth';
