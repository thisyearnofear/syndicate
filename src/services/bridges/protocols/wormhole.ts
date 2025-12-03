/**
 * WORMHOLE PROTOCOL - TokenBridge Implementation
 * 
 * STATUS: DISABLED for hackathon (using NEAR Intents instead)
 * 
 * This protocol is stubbed out to reduce build times. The implementation
 * is preserved but will throw errors if called.
 * 
 * TO RE-ENABLE:
 * 1. Add back to package.json:
 *    "@wormhole-foundation/sdk": "^4.0.2",
 *    "@wormhole-foundation/sdk-evm": "^4.0.2",
 *    "@wormhole-foundation/sdk-solana": "^4.0.2"
 * 2. Restore original imports from git history or backup
 * 3. Run npm install
 */

import type {
    BridgeProtocol,
    BridgeParams,
    BridgeResult,
    ProtocolHealth,
    ChainIdentifier,
} from '../types';
import { BridgeError, BridgeErrorCode } from '../types';

// ============================================================================
// Wormhole Protocol Implementation (STUBBED)
// ============================================================================

export class WormholeProtocol implements BridgeProtocol {
    readonly name = 'wormhole' as const;

    supports(_sourceChain: ChainIdentifier, _destinationChain: ChainIdentifier): boolean {
        // Return false so bridge manager won't select this protocol
        return false;
    }

    async estimate(_params: BridgeParams) {
        return {
            fee: '0',
            timeMs: 0,
            gasEstimate: 'N/A - Wormhole disabled',
        };
    }

    async bridge(_params: BridgeParams): Promise<BridgeResult> {
        throw new BridgeError(
            BridgeErrorCode.PROTOCOL_UNAVAILABLE,
            'Wormhole bridge is temporarily disabled. Please use CCTP or NEAR Intents instead.',
            'wormhole'
        );
    }

    async getHealth(): Promise<ProtocolHealth> {
        return {
            protocol: 'wormhole',
            isHealthy: false,
            successRate: 0,
            averageTimeMs: 0,
            consecutiveFailures: 0,
        };
    }

    async validate(_params: BridgeParams): Promise<{ valid: boolean; error?: string }> {
        return { 
            valid: false, 
            error: 'Wormhole is temporarily disabled for the hackathon. Use CCTP or NEAR Intents.' 
        };
    }
}

export const wormholeProtocol = new WormholeProtocol();

/* =============================================================================
 * ORIGINAL IMPLEMENTATION (PRESERVED FOR REFERENCE)
 * =============================================================================
 * 
 * The full implementation used these imports:
 * 
 * import {
 *     wormhole,
 *     signSendWait,
 *     Wormhole,
 *     Chain,
 *     Network
 * } from '@wormhole-foundation/sdk';
 * import { TokenBridge } from '@wormhole-foundation/sdk-definitions';
 * import evm from '@wormhole-foundation/sdk/evm';
 * import solana from '@wormhole-foundation/sdk/solana';
 * 
 * Key methods:
 * - toWormholeChain() - Maps internal chain IDs to Wormhole Chain names
 * - getUsdcAddress() - Returns USDC contract address for each chain
 * - getWormholeSigner() - Adapts wallet signers to Wormhole SDK format
 * - pollForVaa() - Polls for Verified Action Approval attestation
 * 
 * The bridge flow was:
 * 1. Initialize Wormhole SDK with evm/solana platforms
 * 2. Get TokenBridge for source chain
 * 3. Create transfer transaction
 * 4. Sign and send, wait for confirmation
 * 5. Wait for VAA (cross-chain attestation)
 * 6. Redeem on destination chain
 * 
 * See git history for full implementation.
 * =============================================================================
 */
