/**
 * UNIFIED CROSS-CHAIN SERVICE
 * AGGRESSIVE CONSOLIDATION: Single service for all cross-chain operations
 * DRY: Eliminates duplicate cross-chain functionality
 * MODULAR: Extensible cross-chain architecture
 */

"use client";

import { ethers } from "ethers";
import { parseEther } from "viem";
import { performanceBudgetManager } from './performance/PerformanceBudgetManager';
import { resourceCleanupManager } from './performance/ResourceCleanupManager';

// CLEAN: Unified cross-chain interface
export interface UnifiedCrossChainConfig {
    chains: Record<string, ChainConfig>;
    contracts: ContractAddresses;
    fees: FeeStructure;
}

export interface ChainConfig {
    chainId: number;
    name: string;
    rpcUrl: string;
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    blockExplorer: string;
    derivationPath?: string;
}

export interface ContractAddresses {
    megapot: Record<string, string>;
    usdc: Record<string, string>;
    syndicate: Record<string, any>;
}

export interface FeeStructure {
    bridgeFee: bigint;
    gasFee: bigint;
    totalFee: bigint;
}

export interface CrossChainIntent {
    id: string;
    sourceChain: ChainConfig;
    targetChain: ChainConfig;
    userAddress: string;
    ticketCount: number;
    totalAmount: bigint;
    syndicateId?: string;
    causeAllocation?: number;
    status: 'pending' | 'signed' | 'executed' | 'failed';
    createdAt: Date;
    txHash?: string;
    errorMessage?: string;
}

export interface CrossChainResult {
    intentId: string;
    txHash?: string;
    status: 'success' | 'failed';
    message: string;
}

class UnifiedCrossChainService {
    private static instance: UnifiedCrossChainService;
    private intents = new Map<string, CrossChainIntent>();
    private eventListeners: ((intent: CrossChainIntent) => void)[] = [];
    private isInitialized = false;
    private config: UnifiedCrossChainConfig;

    private constructor() {
        this.config = this.loadConfig();
        this.initializeEventListeners();
    }

    static getInstance(): UnifiedCrossChainService {
        if (!UnifiedCrossChainService.instance) {
            UnifiedCrossChainService.instance = new UnifiedCrossChainService();
        }
        return UnifiedCrossChainService.instance;
    }

    // PERFORMANT: Load configuration with caching
    private loadConfig(): UnifiedCrossChainConfig {
        const cacheKey = 'cross-chain-config';

        // Try to get from cache first
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    return JSON.parse(cached);
                } catch (error) {
                    console.warn('Failed to parse cached config:', error);
                }
            }
        }

        // Default configuration
        const config: UnifiedCrossChainConfig = {
            chains: {
                avalanche: {
                    chainId: 43114,
                    name: "Avalanche",
                    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
                    nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
                    blockExplorer: "https://snowtrace.io",
                },
                base: {
                    chainId: 8453,
                    name: "Base",
                    rpcUrl: "https://mainnet.base.org",
                    nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
                    blockExplorer: "https://basescan.org",
                },
                baseSepolia: {
                    chainId: 84532,
                    name: "Base Sepolia",
                    rpcUrl: "https://sepolia.base.org",
                    nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
                    blockExplorer: "https://sepolia.basescan.org",
                },
                solana: {
                    chainId: 900,
                    name: "Solana",
                    rpcUrl: "https://api.mainnet-beta.solana.com",
                    nativeCurrency: { name: "Solana", symbol: "SOL", decimals: 9 },
                    blockExplorer: "https://solscan.io",
                },
            },
            contracts: {
                megapot: {
                    base: "0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95",
                    baseSepolia: "0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95",
                },
                usdc: {
                    base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                    baseSepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                },
                syndicate: {
                    lensChain: {
                        registry: "0x399f080bB2868371D7a0024a28c92fc63C05536E",
                        factory: "0x4996089d644d023F02Bf891E98a00b143201f133",
                    },
                    base: {
                        ticketRegistry: "0x86e2d8A3eAcfa89295a75116e9489f07CFBd198B",
                        resolver: "0x07B73B99fbB0F82f981A5954A7f3Fd72Ce391c2F",
                    },
                },
            },
            fees: {
                bridgeFee: parseEther("0.001"),
                gasFee: parseEther("0.005"),
                totalFee: parseEther("0.006"),
            },
        };

        // Cache the config
        if (typeof window !== 'undefined') {
            localStorage.setItem(cacheKey, JSON.stringify(config));
        }

        return config;
    }

    // CLEAN: Initialize event listeners
    private initializeEventListeners(): void {
        if (typeof window === 'undefined') return;

        // Listen for performance cleanup events
        window.addEventListener('performance-cleanup', ((event: CustomEvent) => {
            this.handlePerformanceCleanup(event.detail.reason);
        }) as EventListener);

        // Listen for visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseNonCriticalOperations();
            } else {
                this.resumeOperations();
            }
        });
    }

    // PERFORMANT: Create cross-chain intent with validation
    async createIntent(params: {
        sourceChain: string;
        targetChain: string;
        userAddress: string;
        ticketCount: number;
        syndicateId?: string;
        causeAllocation?: number;
    }): Promise<string> {
        if (!this.isInitialized) {
            throw new Error('Service not initialized');
        }

        // Validate parameters
        if (!this.config.chains[params.sourceChain] || !this.config.chains[params.targetChain]) {
            throw new Error('Invalid chain configuration');
        }

        if (params.ticketCount <= 0) {
            throw new Error('Ticket count must be greater than 0');
        }

        const intentId = this.generateIntentId();
        const sourceChain = this.config.chains[params.sourceChain];
        const targetChain = this.config.chains[params.targetChain];

        // Calculate total amount
        const ticketPrice = parseEther("1"); // 1 USDC per ticket
        const totalAmount = ticketPrice * BigInt(params.ticketCount);

        const intent: CrossChainIntent = {
            id: intentId,
            sourceChain,
            targetChain,
            userAddress: params.userAddress,
            ticketCount: params.ticketCount,
            totalAmount,
            syndicateId: params.syndicateId,
            causeAllocation: params.causeAllocation || 20,
            status: 'pending',
            createdAt: new Date(),
        };

        this.intents.set(intentId, intent);
        this.persistIntents();
        this.notifyListeners(intent);

        return intentId;
    }

    // PERFORMANT: Execute cross-chain intent with optimized flow
    async executeIntent(intentId: string): Promise<CrossChainResult> {
        const intent = this.intents.get(intentId);
        if (!intent) {
            throw new Error(`Intent ${intentId} not found`);
        }

        try {
            // Update status to processing
            this.updateIntentStatus(intent, 'signed');

            // Check performance budget before execution
            if (!performanceBudgetManager.requestPolling(`cross-chain-${intentId}`, 5000)) {
                throw new Error('Performance budget exceeded');
            }

            // Execute based on source chain
            let result: CrossChainResult;

            switch (intent.sourceChain.name.toLowerCase()) {
                case 'near':
                    result = await this.executeNearCrossChain(intent);
                    break;
                case 'solana':
                    result = await this.executeSolanaCrossChain(intent);
                    break;
                default:
                    result = await this.executeEVMCrossChain(intent);
            }

            // Update intent with result
            intent.txHash = result.txHash;
            this.updateIntentStatus(intent, result.status === 'success' ? 'executed' : 'failed');

            // Release performance budget
            performanceBudgetManager.releasePolling(`cross-chain-${intentId}`);

            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.updateIntentStatus(intent, 'failed', errorMessage);

            // Release performance budget on error
            performanceBudgetManager.releasePolling(`cross-chain-${intentId}`);

            throw error;
        }
    }

    // CLEAN: NEAR cross-chain execution
    private async executeNearCrossChain(intent: CrossChainIntent): Promise<CrossChainResult> {
        // Implementation would integrate with NEAR chain signatures
        // For now, return mock result
        await new Promise(resolve => setTimeout(resolve, 2000));

        return {
            intentId: intent.id,
            txHash: `0x${Math.random().toString(16).slice(2)}`,
            status: 'success',
            message: 'NEAR cross-chain transaction executed successfully',
        };
    }

    // CLEAN: Solana cross-chain execution
    private async executeSolanaCrossChain(intent: CrossChainIntent): Promise<CrossChainResult> {
        // Implementation would integrate with Solana bridge
        // For now, return mock result
        await new Promise(resolve => setTimeout(resolve, 1500));

        return {
            intentId: intent.id,
            txHash: `0x${Math.random().toString(16).slice(2)}`,
            status: 'success',
            message: 'Solana cross-chain transaction executed successfully',
        };
    }

    // CLEAN: EVM cross-chain execution
    private async executeEVMCrossChain(intent: CrossChainIntent): Promise<CrossChainResult> {
        // Implementation would integrate with EVM bridge
        // For now, return mock result
        await new Promise(resolve => setTimeout(resolve, 1000));

        return {
            intentId: intent.id,
            txHash: `0x${Math.random().toString(16).slice(2)}`,
            status: 'success',
            message: 'EVM cross-chain transaction executed successfully',
        };
    }

    // PERFORMANT: Estimate fees with caching
    async estimateFees(params: {
        sourceChain: string;
        targetChain: string;
        ticketCount: number;
    }): Promise<FeeStructure> {
        const cacheKey = `fees-${params.sourceChain}-${params.targetChain}-${params.ticketCount}`;

        // Check cache first
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    return {
                        bridgeFee: BigInt(parsed.bridgeFee),
                        gasFee: BigInt(parsed.gasFee),
                        totalFee: BigInt(parsed.totalFee),
                    };
                } catch (error) {
                    console.warn('Failed to parse cached fees:', error);
                }
            }
        }

        // Calculate fees
        const ticketPrice = parseEther("1");
        const totalAmount = ticketPrice * BigInt(params.ticketCount);
        const bridgeFee = (totalAmount * BigInt(100)) / BigInt(10000); // 1%
        const gasFee = parseEther("0.005"); // Fixed gas fee

        const fees: FeeStructure = {
            bridgeFee,
            gasFee,
            totalFee: bridgeFee + gasFee,
        };

        // Cache the result
        if (typeof window !== 'undefined') {
            localStorage.setItem(cacheKey, JSON.stringify({
                bridgeFee: fees.bridgeFee.toString(),
                gasFee: fees.gasFee.toString(),
                totalFee: fees.totalFee.toString(),
            }));
        }

        return fees;
    }

    // CLEAN: Get intent by ID
    getIntent(intentId: string): CrossChainIntent | undefined {
        return this.intents.get(intentId);
    }

    // CLEAN: Get all intents for user
    getUserIntents(userAddress: string): CrossChainIntent[] {
        return Array.from(this.intents.values())
            .filter(intent => intent.userAddress.toLowerCase() === userAddress.toLowerCase())
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    // CLEAN: Event system
    onIntentUpdate(callback: (intent: CrossChainIntent) => void): () => void {
        this.eventListeners.push(callback);
        return () => {
            const index = this.eventListeners.indexOf(callback);
            if (index > -1) {
                this.eventListeners.splice(index, 1);
            }
        };
    }

    // PERFORMANT: Performance cleanup handler
    private handlePerformanceCleanup(reason: string): void {
        console.log(`Cross-chain service cleanup triggered: ${reason}`);

        // Clean up failed intents older than 5 minutes
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        const toDelete: string[] = [];

        this.intents.forEach((intent, id) => {
            if (intent.status === 'failed' && intent.createdAt.getTime() < fiveMinutesAgo) {
                toDelete.push(id);
            }
        });

        toDelete.forEach(id => this.intents.delete(id));
        this.persistIntents();
    }

    // CLEAN: Pause non-critical operations
    private pauseNonCriticalOperations(): void {
        // Implementation would pause monitoring of non-critical intents
    }

    // CLEAN: Resume operations
    private resumeOperations(): void {
        // Implementation would resume monitoring
    }

    // CLEAN: Helper methods
    private generateIntentId(): string {
        return `intent_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }

    private updateIntentStatus(intent: CrossChainIntent, status: CrossChainIntent['status'], errorMessage?: string): void {
        intent.status = status;
        if (errorMessage) {
            intent.errorMessage = errorMessage;
        }
        this.intents.set(intent.id, intent);
        this.persistIntents();
        this.notifyListeners(intent);
    }

    private notifyListeners(intent: CrossChainIntent): void {
        this.eventListeners.forEach(listener => {
            try {
                listener(intent);
            } catch (error) {
                console.error('Error in intent listener:', error);
            }
        });
    }

    private persistIntents(): void {
        if (typeof window === 'undefined') return;

        try {
            const intentsArray = Array.from(this.intents.entries());
            localStorage.setItem('unified-cross-chain-intents', JSON.stringify(intentsArray));
        } catch (error) {
            console.warn('Failed to persist intents:', error);
        }
    }

    // CLEAN: Get service status
    getStatus() {
        return {
            initialized: this.isInitialized,
            activeIntents: this.intents.size,
            supportedChains: Object.keys(this.config.chains),
        };
    }

    // CLEAN: Get supported chains
    getSupportedChains(): ChainConfig[] {
        return Object.values(this.config.chains);
    }
}

// DRY: Export singleton instance
export const unifiedCrossChainService = UnifiedCrossChainService.getInstance();

// Types are already exported as interfaces above