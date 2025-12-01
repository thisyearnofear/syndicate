/**
 * CCIP PROTOCOL - Chainlink Cross-Chain Interoperability Protocol
 * 
 * Extracted from bridgeService.ts
 * Supports EVM cross-chain transfers via Chainlink CCIP
 * 
 * Principles:
 * - MODULAR: Independent protocol implementation
 * - CLEAN: Clear separation from other protocols
 * - DRY: Single implementation for all CCIP routes
 */

import { ethers, Contract } from 'ethers';
import type {
    BridgeProtocol,
    BridgeParams,
    BridgeResult,
    ProtocolHealth,
    ChainIdentifier,
} from '../types';
import { BridgeError, BridgeErrorCode } from '../types';
import { ccip as CCIP } from '@/config';

// ============================================================================
// CCIP Protocol Implementation
// ============================================================================

export class CcipProtocol implements BridgeProtocol {
    readonly name = 'ccip' as const;

    // ABIs
    private readonly ERC20_ABI = [
        'function approve(address spender, uint256 amount) external returns (bool)',
        'function allowance(address owner, address spender) external view returns (uint256)',
    ];

    private readonly CCIP_ROUTER_ABI = [
        'function getFee(uint64 destinationChainSelector, bytes memory message) external view returns (uint256 fee)',
        'function ccipSend(uint64 destinationChainSelector, bytes memory message) external payable returns (bytes32 messageId)',
        'function isChainSupported(uint64 chainSelector) external view returns (bool)',
    ];

    // Health tracking
    private successCount = 0;
    private failureCount = 0;
    private totalTimeMs = 0;
    private lastFailure?: Date;

    // ============================================================================
    // BridgeProtocol Interface Implementation
    // ============================================================================

    supports(sourceChain: ChainIdentifier, destinationChain: ChainIdentifier): boolean {
        // CCIP supports EVM chains that are configured
        const supportedChains: ChainIdentifier[] = ['ethereum', 'base', 'polygon', 'avalanche'];
        return supportedChains.includes(sourceChain) && supportedChains.includes(destinationChain);
    }

    async estimate(params: BridgeParams) {
        const { sourceChain, destinationChain, amount, wallet } = params;

        // Get chain configs
        const sourceConfig = CCIP[sourceChain as keyof typeof CCIP];
        const destConfig = CCIP[destinationChain as keyof typeof CCIP];

        if (!sourceConfig || !destConfig) {
            return { fee: '0.005', timeMs: 600000, gasEstimate: 'N/A' };
        }

        try {
            // Get provider
            const { provider } = await this.getEvmProviderSigner(wallet);
            if (!provider) {
                return { fee: '0.005', timeMs: 600000, gasEstimate: '~0.001 ETH' };
            }

            // Create router contract
            const router = new Contract(sourceConfig.router, this.CCIP_ROUTER_ABI, provider);

            // Prepare message for fee estimation
            const amountWei = ethers.parseUnits(amount, 6);
            const tokenAmounts = [{
                token: sourceConfig.usdc,
                amount: amountWei,
            }];

            const message = {
                tokenAmounts,
                receiver: ethers.zeroPadValue(ethers.ZeroAddress, 32),
                data: '0x',
                feeTokenAmount: 0n,
                extraArgs: '0x',
            };

            // Get actual fee from router
            const fee = await router.getFee(destConfig.chainSelector, message);

            return {
                fee: ethers.formatEther(fee),
                timeMs: 5 * 60 * 1000, // ~5 minutes
                gasEstimate: ethers.formatEther(fee),
            };
        } catch (error) {
            console.warn('[CCIP] Fee estimation failed:', error);
            return { fee: '0.005', timeMs: 600000, gasEstimate: '~0.001 ETH' };
        }
    }

    async bridge(params: BridgeParams): Promise<BridgeResult> {
        const startTime = Date.now();
        const { sourceChain, destinationChain, amount, destinationAddress, onStatus, wallet, dryRun } = params;

        // Get provider/signer
        const { provider, signer } = await this.getEvmProviderSigner(wallet);
        if (!signer || !provider) {
            throw new BridgeError(
                BridgeErrorCode.WALLET_REJECTED,
                'No signer available. Connect wallet first.',
                'ccip'
            );
        }

        // Validate chains are supported
        const sourceConfig = CCIP[sourceChain as keyof typeof CCIP];
        const destConfig = CCIP[destinationChain as keyof typeof CCIP];

        if (!sourceConfig || !destConfig) {
            throw new BridgeError(
                BridgeErrorCode.UNSUPPORTED_ROUTE,
                `Unsupported chain combination: ${sourceChain} → ${destinationChain}`,
                'ccip'
            );
        }

        try {
            onStatus?.('validating', { sourceChain, destinationChain, amount });

            // Create CCIP router contract
            const router = new Contract(sourceConfig.router, this.CCIP_ROUTER_ABI, signer);

            // Check if destination chain is supported
            const isSupported = await router.isChainSupported(destConfig.chainSelector);
            if (!isSupported) {
                throw new BridgeError(
                    BridgeErrorCode.UNSUPPORTED_ROUTE,
                    `Destination chain ${destinationChain} not supported by CCIP router`,
                    'ccip'
                );
            }

            // Prepare token transfer
            const amountWei = ethers.parseUnits(amount, 6); // USDC has 6 decimals
            const tokenAmounts = [{
                token: sourceConfig.usdc,
                amount: amountWei,
            }];

            // Encode the CCIP message
            const message = {
                tokenAmounts,
                receiver: ethers.zeroPadValue(destinationAddress, 32),
                data: '0x',
                feeTokenAmount: 0n,
                extraArgs: '0x',
            };

            // Get the fee for the transfer
            onStatus?.('approving');
            const fee = await router.getFee(destConfig.chainSelector, message);

            if (dryRun) {
                return {
                    success: true,
                    protocol: 'ccip',
                    status: 'complete',
                    bridgeId: 'dryrun-ccip',
                    bridgeFee: ethers.formatEther(fee),
                    details: { sourceToken: sourceConfig.usdc, destToken: destConfig.usdc, recipient: destinationAddress },
                };
            }

            // Approve USDC spending
            onStatus?.('approve', { token: sourceConfig.usdc, amount });
            const usdc = new Contract(sourceConfig.usdc, this.ERC20_ABI, signer);
            const allowance = await usdc.allowance(await signer.getAddress(), sourceConfig.router);

            if (allowance < amountWei) {
                const txApprove = await usdc.approve(sourceConfig.router, amountWei);
                const rcApprove = await txApprove.wait();
                onStatus?.('approved', { txHash: rcApprove.hash });
            }

            // Execute the CCIP transfer
            onStatus?.('burning', { fee: ethers.formatEther(fee) });
            const tx = await router.ccipSend(destConfig.chainSelector, message, { value: fee });
            const receipt = await tx.wait();

            onStatus?.('complete', { txHash: receipt.hash });

            // Update health metrics
            this.successCount++;
            this.totalTimeMs += Date.now() - startTime;

            return {
                success: true,
                protocol: 'ccip',
                status: 'complete',
                sourceTxHash: receipt.hash,
                bridgeId: 'ccip-v1',
                bridgeFee: ethers.formatEther(fee),
                details: { sourceToken: sourceConfig.usdc, destToken: destConfig.usdc, recipient: destinationAddress },
            };

        } catch (error) {
            this.failureCount++;
            this.lastFailure = new Date();

            if (error instanceof BridgeError) throw error;

            throw new BridgeError(
                BridgeErrorCode.TRANSACTION_FAILED,
                error instanceof Error ? error.message : 'CCIP transfer failed',
                'ccip'
            );
        }
    }

    async getHealth(): Promise<ProtocolHealth> {
        const total = this.successCount + this.failureCount;
        const successRate = total > 0 ? this.successCount / total : 0.90; // Assume 90% if no data
        const averageTimeMs = this.successCount > 0 ? this.totalTimeMs / this.successCount : 300_000; // 5 min default

        return {
            protocol: 'ccip',
            isHealthy: successRate > 0.7 && this.failureCount < 5,
            successRate,
            averageTimeMs,
            lastFailure: this.lastFailure,
            consecutiveFailures: this.failureCount,
            estimatedFee: '0.005',
        };
    }

    async validate(params: BridgeParams): Promise<{ valid: boolean; error?: string }> {
        if (!this.supports(params.sourceChain, params.destinationChain)) {
            return { valid: false, error: `CCIP doesn't support ${params.sourceChain} → ${params.destinationChain}` };
        }

        if (!params.destinationAddress || !params.destinationAddress.startsWith('0x')) {
            return { valid: false, error: 'Destination address must be valid EVM address (0x...)' };
        }

        if (params.destinationAddress.length !== 42) {
            return { valid: false, error: 'Invalid EVM address length' };
        }

        const amount = parseFloat(params.amount);
        if (isNaN(amount) || amount <= 0) {
            return { valid: false, error: 'Invalid amount' };
        }

        return { valid: true };
    }

    // ============================================================================
    // Helper Methods
    // ============================================================================

    /**
     * Get EVM provider and signer
     */
    private async getEvmProviderSigner(wallet?: any): Promise<{
        provider: ethers.Provider | null;
        signer: ethers.Signer | null;
    }> {
        if (wallet) {
            return { provider: wallet.provider, signer: wallet.signer };
        }

        // Try to get from web3Service
        try {
            const { web3Service } = await import('@/services/web3Service');
            return {
                provider: web3Service.getProvider(),
                signer: await web3Service.getFreshSigner().catch(() => null),
            };
        } catch {
            return { provider: null, signer: null };
        }
    }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const ccipProtocol = new CcipProtocol();
