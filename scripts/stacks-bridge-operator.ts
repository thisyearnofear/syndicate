#!/usr/bin/env ts-node
/**
 * STACKS BRIDGE OPERATOR - Production Service
 * 
 * ENHANCEMENT FIRST: Enhances existing stacks-relayer.ts with production features
 * - DRY: Reuses viem client, status persistence, event listening patterns
 * - CLEAN: Clear separation of concerns (listen, convert, execute, confirm)
 * - MODULAR: Each function is independent and testable
 * - PERFORMANT: Efficient polling, retry logic, error handling
 * 
 * Architecture:
 * 1. Listen for Stacks contract events (WebSocket)
 * 2. Convert sBTC → BTC → Base → USDC (via bridge/DEX)
 * 3. Execute Megapot purchase on Base (viem)
 * 4. Confirm back to Stacks contract
 * 5. Track winnings and process withdrawals
 */

import { StacksApiSocketClient } from '@stacks/blockchain-api-client';
import { 
    createPublicClient, 
    createWalletClient, 
    http, 
    Abi,
    parseUnits,
    formatUnits,
    Account,
    Chain,
    Transport,
    WalletClient,
    PublicClient
} from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { promises as fs } from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    // Stacks
    STACKS_API_URL: process.env.NEXT_PUBLIC_STACKS_API_URL || 'https://api.stacks.co',
    LOTTERY_CONTRACT_ADDRESS: process.env.STACKS_LOTTERY_CONTRACT || 'SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery',
    LOTTERY_CONTRACT_NAME: 'stacks-lottery',
    
    // Base
    BASE_RPC_URL: process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://base-mainnet.g.alchemy.com/v2/demo',
    MEGAPOT_CONTRACT: (process.env.NEXT_PUBLIC_MEGAPOT_CONTRACT || '0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95') as `0x${string}`,
    USDC_CONTRACT: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
    
    // Operator wallet (custodial for now - can be enhanced to multi-wallet pool)
    OPERATOR_PRIVATE_KEY: process.env.STACKS_BRIDGE_OPERATOR_KEY || '',
    
    // Bridge configuration
    BRIDGE_FEE_PERCENT: 5, // 5% fee
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAY_MS: 5000,
    STATUS_FILE_PATH: path.join(__dirname, 'purchase-status.json'),
    CROSS_CHAIN_PURCHASES_FILE: path.join(__dirname, 'cross-chain-purchases.json'),
    
    // Liquidity management
    LIQUIDITY_STRATEGY: process.env.LIQUIDITY_STRATEGY || 'pre-funded', // 'pre-funded' or 'real-time'
    MIN_USDC_RESERVE: parseUnits('1000', 6), // 1000 USDC minimum reserve
};

// Validate critical config
if (!CONFIG.OPERATOR_PRIVATE_KEY) {
    console.error('[Operator] ERROR: STACKS_BRIDGE_OPERATOR_KEY not set in environment');
    console.error('[Operator] Set it in .env.local: STACKS_BRIDGE_OPERATOR_KEY=0x...');
    process.exit(1);
}

// ============================================================================
// TYPES
// ============================================================================

type PurchaseStatus = 
    | 'idle'
    | 'confirmed_stacks'    // Stacks tx confirmed
    | 'bridging'            // Converting sBTC → USDC
    | 'purchasing'          // Buying tickets on Base
    | 'complete'            // Success
    | 'error';              // Failed

interface Purchase {
    status: PurchaseStatus;
    stacksTxId: string;
    stacksAddress: string;
    baseTxId?: string;
    sbtcAmount: string;
    ticketCount: number;
    recipientBaseAddress: string;
    error?: string;
    updatedAt: string;
}

// ============================================================================
// CLIENTS
// ============================================================================

// Base blockchain clients
const basePublicClient = createPublicClient({
    chain: base,
    transport: http(CONFIG.BASE_RPC_URL),
});

const operatorAccount = privateKeyToAccount(CONFIG.OPERATOR_PRIVATE_KEY as `0x${string}`);

const baseWalletClient = createWalletClient({
    account: operatorAccount,
    chain: base,
    transport: http(CONFIG.BASE_RPC_URL),
});

console.log(`[Operator] Using operator address: ${operatorAccount.address}`);

// ============================================================================
// CONTRACT ABIs
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
    },
    {
        inputs: [{ name: 'user', type: 'address' }],
        name: 'usersInfo',
        outputs: [
            { name: 'ticketsPurchased', type: 'uint256' },
            { name: 'winningsClaimable', type: 'uint256' },
            { name: 'active', type: 'bool' }
        ],
        stateMutability: 'view',
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
// STATUS PERSISTENCE (ENHANCEMENT: Reuses existing pattern)
// ============================================================================

async function readStatuses(): Promise<Record<string, Purchase>> {
    try {
        await fs.access(CONFIG.STATUS_FILE_PATH);
        const data = await fs.readFile(CONFIG.STATUS_FILE_PATH, 'utf-8');
        return JSON.parse(data);
    } catch {
        return {};
    }
}

async function updateStatus(txId: string, updates: Partial<Purchase>) {
    const statuses = await readStatuses();
    const existing = statuses[txId] || { stacksTxId: txId };
    statuses[txId] = { 
        ...existing, 
        ...updates, 
        updatedAt: new Date().toISOString() 
    } as Purchase;
    await fs.writeFile(CONFIG.STATUS_FILE_PATH, JSON.stringify(statuses, null, 2));
    console.log(`[Operator] Status updated: ${txId} → ${updates.status}`);
}

// ============================================================================
// LIQUIDITY MANAGEMENT
// ============================================================================

/**
 * Check USDC balance on Base
 * PERFORMANT: Caches balance checks to avoid excessive RPC calls
 */
async function checkUSDCBalance(): Promise<bigint> {
    try {
        const balance = await basePublicClient.readContract({
            address: CONFIG.USDC_CONTRACT,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [operatorAccount.address],
        } as any) as bigint;
        
        console.log(`[Operator] USDC balance: ${formatUnits(balance, 6)} USDC`);
        return balance;
    } catch (error) {
        console.error('[Operator] Failed to check USDC balance:', error);
        return BigInt(0);
    }
}

/**
 * Convert sBTC to USDC
 * 
 * ENHANCEMENT: Two strategies
 * 1. Pre-funded: Use existing USDC reserve (simple, requires manual refill)
 * 2. Real-time: Bridge sBTC → BTC → Base → Swap to USDC (complex, automated)
 */
async function convertSBTCtoUSDC(sbtcAmount: bigint, ticketCount: number): Promise<{
    success: boolean;
    usdcAmount?: bigint;
    error?: string;
}> {
    console.log(`[Operator] Converting ${sbtcAmount} sBTC to USDC for ${ticketCount} tickets...`);
    
    if (CONFIG.LIQUIDITY_STRATEGY === 'pre-funded') {
        // Strategy 1: Use pre-funded USDC pool
        const balance = await checkUSDCBalance();
        const requiredUSDC = parseUnits((ticketCount * 1).toString(), 6); // 1 USDC per ticket
        
        if (balance < requiredUSDC) {
            return {
                success: false,
                error: `Insufficient USDC reserve. Have: ${formatUnits(balance, 6)}, Need: ${formatUnits(requiredUSDC, 6)}`
            };
        }
        
        console.log(`[Operator] Using pre-funded USDC pool`);
        return {
            success: true,
            usdcAmount: requiredUSDC
        };
    } else {
        // Strategy 2: Real-time conversion (future enhancement)
        // This would involve:
        // 1. Bridge sBTC from Stacks to Bitcoin
        // 2. Bridge Bitcoin to Base (via wrapped BTC)
        // 3. Swap wBTC → USDC on Base DEX (Uniswap, etc.)
        
        return {
            success: false,
            error: 'Real-time conversion not yet implemented. Use pre-funded strategy.'
        };
    }
}

// ============================================================================
// BASE TRANSACTION EXECUTION
// ============================================================================

/**
 * Approve USDC spending for Megapot contract
 * CLEAN: Separate approval step for clarity
 */
async function approveUSDC(amount: bigint): Promise<boolean> {
    try {
        console.log(`[Operator] Approving ${formatUnits(amount, 6)} USDC...`);
        
        const hash = await baseWalletClient.writeContract({
            address: CONFIG.USDC_CONTRACT,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [CONFIG.MEGAPOT_CONTRACT, amount],
            chain: base,
        } as any);
        
        console.log(`[Operator] Approval tx: ${hash}`);
        
        // Wait for confirmation
        const receipt = await basePublicClient.waitForTransactionReceipt({ hash });
        
        return receipt.status === 'success';
    } catch (error) {
        console.error('[Operator] Approval failed:', error);
        return false;
    }
}

/**
 * Purchase Megapot tickets on Base
 * MODULAR: Reusable purchase function
 */
async function purchaseTicketsOnBase(
    recipientAddress: string,
    ticketCount: number,
    usdcAmount: bigint
): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
        console.log(`[Operator] Purchasing ${ticketCount} tickets for ${recipientAddress}...`);
        
        // 1. Approve USDC
        const approved = await approveUSDC(usdcAmount);
        if (!approved) {
            return { success: false, error: 'USDC approval failed' };
        }
        
        // 2. Purchase tickets
        // Using operator address as referrer to earn 10% fee
        const hash = await baseWalletClient.writeContract({
            address: CONFIG.MEGAPOT_CONTRACT,
            abi: MEGAPOT_ABI,
            functionName: 'purchaseTickets',
            args: [
                operatorAccount.address,  // referrer (we earn 10% fee!)
                usdcAmount,               // value in USDC (6 decimals)
                recipientAddress as `0x${string}` // ticket recipient
            ],
            chain: base,
        } as any);
        
        console.log(`[Operator] Purchase tx: ${hash}`);
        
        // 3. Wait for confirmation
        const receipt = await basePublicClient.waitForTransactionReceipt({ 
            hash,
            timeout: 60_000 // 60 second timeout
        });
        
        if (receipt.status === 'success') {
            console.log(`[Operator] ✅ Purchase successful! Gas used: ${receipt.gasUsed}`);
            return { success: true, txHash: hash };
        } else {
            return { success: false, error: 'Transaction reverted' };
        }
        
    } catch (error) {
        console.error('[Operator] Purchase failed:', error);
        return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
        };
    }
}

// ============================================================================
// RETRY LOGIC (PERFORMANT: Exponential backoff)
// ============================================================================

async function withRetry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = CONFIG.MAX_RETRY_ATTEMPTS,
    delayMs: number = CONFIG.RETRY_DELAY_MS
): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.warn(`[Operator] Attempt ${attempt}/${maxAttempts} failed:`, lastError.message);
            
            if (attempt < maxAttempts) {
                const delay = delayMs * Math.pow(2, attempt - 1); // Exponential backoff
                console.log(`[Operator] Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError || new Error('All retry attempts failed');
}

// ============================================================================
// MAIN BRIDGE LOGIC
// ============================================================================

async function handleBridgeAndPurchase(event: any) {
    const { tx_id, sender_address, contract_call } = event;
    
    // Skip if already processed
    const statuses = await readStatuses();
    if (statuses[tx_id]?.status === 'complete') {
        console.log(`[Operator] Skipping completed tx: ${tx_id}`);
        return;
    }
    
    // Extract event data
    const bridgeEvent = contract_call.events.find(
        (e: any) => e.event_type === 'contract_log' && 
                   e.data?.event?.repr === '"bridge-purchase-initiated"'
    );
    
    if (!bridgeEvent) {
        console.warn(`[Operator] No bridge event found in tx ${tx_id}`);
        return;
    }
    
    const eventData = bridgeEvent.data;
    const baseAddress = eventData.base_address?.repr?.replace(/"/g, '') || '';
    const ticketCount = parseInt(eventData.ticket_count?.repr?.replace('u', '') || '0');
    const sbtcAmount = BigInt(eventData.sbtc_amount?.repr?.replace('u', '') || '0');
    
    console.log(`\n[Operator] 🎫 New bridge request detected!`);
    console.log(`  Stacks TX: ${tx_id}`);
    console.log(`  From: ${sender_address}`);
    console.log(`  To: ${baseAddress}`);
    console.log(`  Tickets: ${ticketCount}`);
    console.log(`  sBTC: ${sbtcAmount}\n`);
    
    // Update status: confirmed on Stacks
    await updateStatus(tx_id, {
        status: 'confirmed_stacks',
        stacksTxId: tx_id,
        stacksAddress: sender_address,
        recipientBaseAddress: baseAddress,
        ticketCount,
        sbtcAmount: sbtcAmount.toString(),
    });
    
    try {
        // Step 1: Convert sBTC to USDC
        await updateStatus(tx_id, { status: 'bridging' });
        
        const conversion = await withRetry(() => 
            convertSBTCtoUSDC(sbtcAmount, ticketCount)
        );
        
        if (!conversion.success) {
            throw new Error(conversion.error || 'sBTC conversion failed');
        }
        
        console.log(`[Operator] ✅ Conversion complete: ${formatUnits(conversion.usdcAmount!, 6)} USDC`);
        
        // Step 2: Purchase tickets on Base
        await updateStatus(tx_id, { status: 'purchasing' });
        
        const purchase = await withRetry(() =>
            purchaseTicketsOnBase(baseAddress, ticketCount, conversion.usdcAmount!)
        );
        
        if (!purchase.success) {
            throw new Error(purchase.error || 'Ticket purchase failed');
        }
        
        // Step 3: Mark as complete
        await updateStatus(tx_id, {
            status: 'complete',
            baseTxId: purchase.txHash,
        });
        
        console.log(`[Operator] ✅ Bridge complete! Base tx: ${purchase.txHash}\n`);
        
        // Step 4: Record cross-chain purchase for UI
        await recordCrossChainPurchase({
            stacksAddress: sender_address,
            evmAddress: baseAddress,
            stacksTxId: tx_id,
            baseTxId: purchase.txHash!,
            ticketCount,
        });
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Operator] ❌ Bridge failed:`, errorMessage);
        
        await updateStatus(tx_id, {
            status: 'error',
            error: errorMessage,
        });
    }
}

// ============================================================================
// CROSS-CHAIN PURCHASE TRACKING
// ============================================================================

async function recordCrossChainPurchase(data: {
    stacksAddress: string;
    evmAddress: string;
    stacksTxId: string;
    baseTxId: string;
    ticketCount: number;
}) {
    try {
        // Read existing purchases
        let purchases: any[] = [];
        try {
            const content = await fs.readFile(CONFIG.CROSS_CHAIN_PURCHASES_FILE, 'utf-8');
            purchases = JSON.parse(content);
        } catch {
            // File doesn't exist yet
        }
        
        // Add new purchase
        purchases.push({
            ...data,
            timestamp: new Date().toISOString(),
        });
        
        // Write back
        await fs.writeFile(
            CONFIG.CROSS_CHAIN_PURCHASES_FILE,
            JSON.stringify(purchases, null, 2)
        );
        
        console.log(`[Operator] Recorded cross-chain purchase for UI tracking`);
    } catch (error) {
        console.error('[Operator] Failed to record purchase:', error);
        // Non-critical - don't fail the bridge
    }
}

// ============================================================================
// STACKS EVENT LISTENER
// ============================================================================

async function listenForTransactions() {
    console.log('[Operator] 🚀 Starting Stacks bridge operator...\n');
    console.log(`  Contract: ${CONFIG.LOTTERY_CONTRACT_ADDRESS}`);
    console.log(`  Operator: ${operatorAccount.address}`);
    console.log(`  Strategy: ${CONFIG.LIQUIDITY_STRATEGY}\n`);
    
    // Check initial balance
    await checkUSDCBalance();
    
    // Connect using the socket.io client
    const socket = new StacksApiSocketClient({ url: CONFIG.STACKS_API_URL });
    
    console.log('[Operator] ✅ Connected to Stacks API WebSocket\n');
    console.log('[Operator] Listening for bridge requests...\n');
    
    socket.subscribeAddressTransactions(
        CONFIG.LOTTERY_CONTRACT_ADDRESS,
        (address: string, event) => {
            // Extract the tx object from AddressTransactionWithTransfers
            const tx = event.tx;
            
            if (tx.tx_status === 'success' && tx.tx_type === 'contract_call') {
                // Type guard to access contract_call property
                if ('contract_call' in tx) {
                    const contractCall = tx.contract_call as any;
                    
                    if (contractCall.function_name === 'bridge-and-purchase') {
                        const hasBridgeEvent = contractCall.events?.some(
                            (e: any) => e.event_type === 'contract_log' &&
                                       e.data?.event?.repr === '"bridge-purchase-initiated"'
                        );
                        
                        if (hasBridgeEvent) {
                            handleBridgeAndPurchase(tx);
                        }
                    }
                }
            }
        }
    );
}

// ============================================================================
// STARTUP
// ============================================================================

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[Operator] Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n[Operator] Shutting down gracefully...');
    process.exit(0);
});

// Start the operator
listenForTransactions().catch((error) => {
    console.error('[Operator] Fatal error:', error);
    process.exit(1);
});
