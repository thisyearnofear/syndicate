import {
    createPublicClient,
    createWalletClient,
    http,
    Abi,
    parseUnits,
    formatUnits,
    Account
} from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import {
    makeContractCall,
    broadcastTransaction,
    uintCV,
    principalCV,
    stringAsciiCV,
} from '@stacks/transactions';
import { upsertPurchaseStatus } from '@/lib/db/repositories/purchaseStatusRepository';
import { insertCrossChainPurchase } from '@/lib/db/repositories/crossChainPurchaseRepository';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    // Stacks
    STACKS_API_URL: process.env.NEXT_PUBLIC_STACKS_API_URL || 'https://api.stacks.co',
    LOTTERY_CONTRACT_ADDRESS: process.env.STACKS_LOTTERY_CONTRACT || 'SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3',
    LOTTERY_CONTRACT_NAME: 'stacks-lottery-v3',

    // Base
    BASE_RPC_URL: process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://base-mainnet.g.alchemy.com/v2/demo',
    MEGAPOT_CONTRACT: (process.env.NEXT_PUBLIC_MEGAPOT_CONTRACT || '0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95') as `0x${string}`,
    USDC_CONTRACT: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
    AUTO_PURCHASE_PROXY: (process.env.NEXT_PUBLIC_AUTO_PURCHASE_PROXY || '0x0000000000000000000000000000000000000000') as `0x${string}`,

    // Operator wallet
    OPERATOR_PRIVATE_KEY: process.env.STACKS_BRIDGE_OPERATOR_KEY || '',

    // Bridge configuration
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAY_MS: 5000,
};

// ============================================================================
// ABIs
// ============================================================================

const MEGAPOT_ABI: Abi = [
    {
        inputs: [
            { name: 'referrer', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'recipient', type: 'address' }
        ],
        name: 'purchaseTickets',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function'
    }
];

const AUTO_PURCHASE_PROXY_ABI: Abi = [
    {
        inputs: [
            { name: 'recipient', type: 'address' },
            { name: 'referrer', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        name: 'purchaseTicketsFor',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function'
    }
];

const ERC20_ABI: Abi = [
    {
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        name: 'approve',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable',
        type: 'function'
    },
    {
        inputs: [{ name: 'account', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function'
    }
];

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class StacksBridgeOperator {
    private basePublicClient: any;
    private baseWalletClient: any;
    private operatorAccount: Account;

    constructor() {
        if (!CONFIG.OPERATOR_PRIVATE_KEY) {
            // In dev, we might not have the key, but we shouldn't crash until used
            console.warn('STACKS_BRIDGE_OPERATOR_KEY not set');
        }

        this.operatorAccount = privateKeyToAccount((CONFIG.OPERATOR_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000000') as `0x${string}`);

        this.basePublicClient = createPublicClient({
            chain: base,
            transport: http(CONFIG.BASE_RPC_URL),
        });

        this.baseWalletClient = createWalletClient({
            account: this.operatorAccount,
            chain: base,
            transport: http(CONFIG.BASE_RPC_URL),
        });
    }
    private normalizeTxId(txId: string): string {
        return txId.startsWith('0x') ? txId.substring(2) : txId;
    }

    /**
     * Persist status updates for UI tracking
     */
    private async updateStatus(txId: string, status: any, updates: any = {}) {
        try {
            const normalizedId = this.normalizeTxId(txId);
            await upsertPurchaseStatus({
                sourceTxId: normalizedId,
                sourceChain: 'stacks',
                stacksTxId: normalizedId,
                status,
                baseTxId: updates.baseTxId,
                recipientBaseAddress: updates.recipientBaseAddress,
                purchaseId: updates.purchaseId,
                error: updates.error,
            });
            console.log(`[StacksBridgeOperator] Status updated (DB): ${normalizedId} → ${status}`);
        } catch (error) {
            console.error('[StacksBridgeOperator] Failed to update status:', error);
        }
    }

    /**
     * Main entry point for processing a bridge request received from Chainhook
     * Returns result for chainhook route to log
     */
    async processBridgeEvent(txId: string, baseAddress: string, ticketCount: number, amount: bigint, tokenPrincipal: string, purchaseId?: number, stacksAddress?: string): Promise<{ success: boolean; baseTxHash?: string; error?: string }> {
        console.log(`[StacksBridgeOperator] Processing bridge request: ${txId} (${tokenPrincipal})`);

        if (!CONFIG.OPERATOR_PRIVATE_KEY) {
            throw new Error('STACKS_BRIDGE_OPERATOR_KEY not set - cannot process bridge event');
        }

        try {
            // 1. Calculate Actual Ticket Count from Value
            // The Stacks contract might have received an "adjusted" ticket count 
            // for tokens with different decimal places (like sUSDT).
            // We calculate the actual value based on the raw amount and token decimals.

            const isEightDecimal = tokenPrincipal.toLowerCase().includes('susdt');
            const unitsPerDollar = isEightDecimal ? 100_000_000n : 1_000_000n;

            // Subtract the 0.10 fee (relative to unitsPerDollar)
            const feeInUnits = unitsPerDollar / 10n;
            const netAmount = amount > feeInUnits ? amount - feeInUnits : 0n;

            // 1 ticket = 1 USD (unitsPerDollar)
            const calculatedTicketCount = Number(netAmount / unitsPerDollar);

            // Safety: Use the higher of the two (contract's reported count vs calculated)
            // But if it's 8-decimal, the contract's count is likely the "inflated" one,
            // so we trust the calculation more.
            const finalTicketCount = isEightDecimal ? calculatedTicketCount : Math.max(ticketCount, calculatedTicketCount);

            console.log(`[StacksBridgeOperator] Raw Amount: ${amount}, Calculated Tickets: ${calculatedTicketCount}, Final Tickets: ${finalTicketCount}`);

            if (finalTicketCount <= 0) {
                await this.updateStatus(txId, 'error', { error: 'Insufficient payment for 1 ticket' });
                throw new Error(`Insufficient payment. Amount: ${amount}, Required for 1 ticket: ${unitsPerDollar + feeInUnits}`);
            }

            const requiredUSDC = parseUnits(finalTicketCount.toString(), 6);
            const balance = await this.checkUSDCBalance();

            if (balance < requiredUSDC) {
                await this.updateStatus(txId, 'error', { error: 'Insufficient bridge liquidity' });
                throw new Error(`Insufficient USDC reserve. Have: ${formatUnits(balance, 6)}, Need: ${formatUnits(requiredUSDC, 6)}`);
            }

            // 2. Approve & Purchase on Base
            await this.updateStatus(txId, 'bridging', {
                purchaseId,
                recipientBaseAddress: baseAddress,
            });
            console.log(`[StacksBridgeOperator] Purchasing ${finalTicketCount} tickets for ${baseAddress}...`);

            const isProxyConfigured = CONFIG.AUTO_PURCHASE_PROXY !== '0x0000000000000000000000000000000000000000';
            
            let purchaseHash: string;
            
            if (isProxyConfigured) {
                // Trustless flow: approve proxy, then call purchaseTicketsFor
                const approveHash = await this.baseWalletClient.writeContract({
                    address: CONFIG.USDC_CONTRACT,
                    abi: ERC20_ABI,
                    functionName: 'approve',
                    args: [CONFIG.AUTO_PURCHASE_PROXY, requiredUSDC],
                    chain: base,
                } as any);

                const approveReceipt = await this.basePublicClient.waitForTransactionReceipt({ hash: approveHash });
                if (approveReceipt.status !== 'success') {
                    await this.updateStatus(txId, 'error', { error: 'USDC approval failed' });
                    throw new Error('USDC approval failed');
                }

                await this.updateStatus(txId, 'purchasing', {
                    purchaseId,
                    recipientBaseAddress: baseAddress,
                });

                purchaseHash = await this.baseWalletClient.writeContract({
                    address: CONFIG.AUTO_PURCHASE_PROXY,
                    abi: AUTO_PURCHASE_PROXY_ABI,
                    functionName: 'purchaseTicketsFor',
                    args: [
                        baseAddress as `0x${string}`,
                        this.operatorAccount.address, // referrer
                        requiredUSDC,
                    ],
                    chain: base,
                } as any);
            } else {
                // Legacy flow: direct Megapot call
                const maxUint256 = BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935');
                const approveHash = await this.baseWalletClient.writeContract({
                    address: CONFIG.USDC_CONTRACT,
                    abi: ERC20_ABI,
                    functionName: 'approve',
                    args: [CONFIG.MEGAPOT_CONTRACT, maxUint256],
                    chain: base,
                } as any);

                const approveReceipt = await this.basePublicClient.waitForTransactionReceipt({ hash: approveHash });
                if (approveReceipt.status !== 'success') {
                    await this.updateStatus(txId, 'error', { error: 'USDC approval failed' });
                    throw new Error('USDC approval failed');
                }

                await this.updateStatus(txId, 'purchasing', {
                    purchaseId,
                    recipientBaseAddress: baseAddress,
                });

                purchaseHash = await this.baseWalletClient.writeContract({
                    address: CONFIG.MEGAPOT_CONTRACT,
                    abi: MEGAPOT_ABI,
                    functionName: 'purchaseTickets',
                    args: [
                        this.operatorAccount.address,
                        requiredUSDC,
                        baseAddress as `0x${string}`
                    ],
                    chain: base,
                } as any);
            }

            const receipt = await this.basePublicClient.waitForTransactionReceipt({ hash: purchaseHash });

            if (receipt.status !== 'success') {
                await this.updateStatus(txId, 'error', { error: 'Base transaction reverted' });
                throw new Error('Base transaction reverted');
            }

            console.log(`[StacksBridgeOperator] ✅ Purchase successful! Base TX: ${purchaseHash}`);

            // 3. Record for UI tracking
            await this.updateStatus(txId, 'complete', {
                baseTxId: purchaseHash,
                error: null,
                purchaseId,
                recipientBaseAddress: baseAddress,
            });
            if (!stacksAddress) {
                console.warn('[StacksBridgeOperator] No stacksAddress provided for cross-chain purchase record');
            }
            await insertCrossChainPurchase({
                sourceChain: 'stacks',
                stacksAddress: stacksAddress || 'unknown',
                evmAddress: baseAddress,
                stacksTxId: txId,
                baseTxId: purchaseHash,
                ticketCount: finalTicketCount,
                purchaseTimestamp: new Date().toISOString(),
            });

            // 4. Confirm purchase on Stacks (best-effort)
            if (purchaseId && purchaseId > 0) {
                try {
                    await this.confirmPurchaseProcessed(purchaseId, purchaseHash);
                } catch (confirmError) {
                    console.error('[StacksBridgeOperator] Failed to confirm purchase on Stacks:', confirmError);
                }
            }

            return {
                success: true,
                baseTxHash: purchaseHash
            };

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            await this.updateStatus(txId, 'error', { error: message });
            console.error(`[StacksBridgeOperator] ❌ Bridge processing failed:`, error);
            return {
                success: false,
                error: message,
            };
        }
    }

    private async confirmPurchaseProcessed(purchaseId: number, baseTxHash: string): Promise<void> {
        if (!CONFIG.OPERATOR_PRIVATE_KEY) {
            throw new Error('STACKS_BRIDGE_OPERATOR_KEY not set');
        }

        const tx = await makeContractCall({
            contractAddress: CONFIG.LOTTERY_CONTRACT_ADDRESS.split('.')[0],
            contractName: CONFIG.LOTTERY_CONTRACT_NAME,
            functionName: 'confirm-purchase-processed',
            functionArgs: [
                uintCV(purchaseId),
                stringAsciiCV(baseTxHash),
            ],
            senderKey: CONFIG.OPERATOR_PRIVATE_KEY,
            network: 'mainnet',
            fee: 10000,
        });

        const txResponse = await broadcastTransaction({
            transaction: tx,
            network: 'mainnet'
        });

        console.log(`[StacksBridgeOperator] ✅ Confirmed purchase on Stacks: ${txResponse.txid}`);
    }

    async recordWinningsOnStacks(data: {
        stacksAddress: string;
        evmAddress: string;
        winningsAmount: bigint;
        round: number;
        tokenPrincipal: string; // NEW: The token the user used
    }): Promise<boolean> {
        try {
            if (!CONFIG.OPERATOR_PRIVATE_KEY) {
                console.error('[StacksBridgeOperator] STACKS_BRIDGE_OPERATOR_KEY not set');
                return false;
            }

            // Format proof (simplified for now)
            const baseTxHashProof = `0x${this.operatorAccount.address.slice(2).padEnd(64, '0')}`;

            console.log(`[StacksBridgeOperator] Recording winnings for ${data.stacksAddress} in ${data.tokenPrincipal}...`);

            const tx = await makeContractCall({
                contractAddress: CONFIG.LOTTERY_CONTRACT_ADDRESS.split('.')[0],
                contractName: CONFIG.LOTTERY_CONTRACT_NAME,
                functionName: 'record-winnings',
                functionArgs: [
                    principalCV(data.stacksAddress),
                    uintCV(data.winningsAmount),
                    uintCV(data.round),
                    stringAsciiCV(baseTxHashProof),
                    principalCV(data.tokenPrincipal), // NEW: Pass the token principal
                ],
                senderKey: CONFIG.OPERATOR_PRIVATE_KEY,
                network: 'mainnet',
                fee: 10000,
            });

            const txResponse = await broadcastTransaction({
                transaction: tx,
                network: 'mainnet'
            });
            console.log(`[StacksBridgeOperator] ✅ Stacks update tx: ${txResponse.txid}`);
            return true;

        } catch (error) {
            console.error('[StacksBridgeOperator] Failed to record winnings on Stacks:', error);
            return false;
        }
    }

    private async checkUSDCBalance(): Promise<bigint> {
        return await this.basePublicClient.readContract({
            address: CONFIG.USDC_CONTRACT,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [this.operatorAccount.address],
        } as any) as bigint;
    }
}

export const stacksBridgeOperator = new StacksBridgeOperator();
