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
import { promises as fs } from 'fs';
import * as path from 'path';

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

    // Operator wallet
    OPERATOR_PRIVATE_KEY: process.env.STACKS_BRIDGE_OPERATOR_KEY || '',

    // Bridge configuration
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAY_MS: 5000,
    CROSS_CHAIN_PURCHASES_FILE: path.join(process.cwd(), 'scripts', 'cross-chain-purchases.json'),
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

    /**
     * Main entry point for processing a bridge request received from Chainhook
     */
    async processBridgeEvent(txId: string, baseAddress: string, ticketCount: number, amount: bigint, tokenPrincipal: string) {
        console.log(`[StacksBridgeOperator] Processing bridge request: ${txId} (${tokenPrincipal})`);

        if (!CONFIG.OPERATOR_PRIVATE_KEY) {
            throw new Error('STACKS_BRIDGE_OPERATOR_KEY not set - cannot process bridge event');
        }

        try {
            // 1. Validate Liquidity (Pre-funded strategy)
            const requiredUSDC = parseUnits(ticketCount.toString(), 6);
            const balance = await this.checkUSDCBalance();

            if (balance < requiredUSDC) {
                throw new Error(`Insufficient USDC reserve. Have: ${formatUnits(balance, 6)}, Need: ${formatUnits(requiredUSDC, 6)}`);
            }

            // 2. Approve & Purchase on Base
            console.log(`[StacksBridgeOperator] Purchasing ${ticketCount} tickets for ${baseAddress}...`);

            // Approve
            const approveHash = await this.baseWalletClient.writeContract({
                address: CONFIG.USDC_CONTRACT,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [CONFIG.MEGAPOT_CONTRACT, requiredUSDC],
                chain: base,
            } as any);

            await this.basePublicClient.waitForTransactionReceipt({ hash: approveHash });

            // Purchase
            const purchaseHash = await this.baseWalletClient.writeContract({
                address: CONFIG.MEGAPOT_CONTRACT,
                abi: MEGAPOT_ABI,
                functionName: 'purchaseTickets',
                args: [
                    this.operatorAccount.address, // referrer
                    requiredUSDC,
                    baseAddress as `0x${string}`
                ],
                chain: base,
            } as any);

            const receipt = await this.basePublicClient.waitForTransactionReceipt({ hash: purchaseHash });

            if (receipt.status !== 'success') {
                throw new Error('Base transaction reverted');
            }

            console.log(`[StacksBridgeOperator] ✅ Purchase successful! Base TX: ${purchaseHash}`);

            // 3. Record for UI tracking
            await this.recordCrossChainPurchase({
                stacksAddress: 'unknown',
                evmAddress: baseAddress,
                stacksTxId: txId,
                baseTxId: purchaseHash,
                ticketCount,
            });

            return {
                success: true,
                baseTxId: purchaseHash
            };

        } catch (error) {
            console.error(`[StacksBridgeOperator] ❌ Bridge processing failed:`, error);
            throw error;
        }
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

    async recordCrossChainPurchase(data: {
        stacksAddress: string;
        evmAddress: string;
        stacksTxId: string;
        baseTxId: string;
        ticketCount: number;
    }) {
        try {
            let purchases: any[] = [];
            try {
                const content = await fs.readFile(CONFIG.CROSS_CHAIN_PURCHASES_FILE, 'utf-8');
                purchases = JSON.parse(content);
            } catch {
                // Ignore if file doesn't exist
            }

            purchases.push({
                ...data,
                sourceChain: 'stacks',
                purchaseTimestamp: new Date().toISOString(),
            });

            await fs.writeFile(
                CONFIG.CROSS_CHAIN_PURCHASES_FILE,
                JSON.stringify(purchases, null, 2)
            );
        } catch (error) {
            console.error('[StacksBridgeOperator] Failed to record purchase:', error);
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
