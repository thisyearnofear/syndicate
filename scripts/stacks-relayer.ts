
import { StacksApiSocketClient, StacksApiWebSocketClient } from '@stacks/blockchain-api-client';
import { StacksMainnet } from '@stacks/network';
import dotenv from 'dotenv';
import crossfetch from 'cross-fetch';
import { createPublicClient, http, Abi } from 'viem';
import { base } from 'viem/chains';
import { promises as fs } from 'fs';
import path from 'path';
import { TrackerStatus } from '../src/components/bridge/CrossChainTracker'; // Import status type

// Load environment variables from .env file
dotenv.config();

// --- Constants ---
const STACKS_API_URL = process.env.NEXT_PUBLIC_STACKS_API_URL || 'https://api.stacks.co';
const MEGAPOT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_MEGAPOT_CONTRACT || "0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95";
const LOTTERY_CONTRACT_ADDRESS = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'; // Replace with your contract address
const LOTTERY_CONTRACT_NAME = 'stacks-lottery';
const BRIDGE_API_URL = 'http://localhost:3000/api/stacks-lottery?endpoint=/bridge/sbtc-to-base';
const CROSS_CHAIN_API_URL = 'http://localhost:3000/api/cross-chain-purchases';


// --- Status Persistence ---
const STATUS_FILE_PATH = path.join(__dirname, 'purchase-status.json');

type PurchaseStatus = {
    status: TrackerStatus;
    stacksTxId: string;
    stacksAddress: string;
    baseTxId?: string;
    sbtcAmount: string;
    ticketCount: number;
    recipientBaseAddress: string;
    error?: string;
    updatedAt: string;
};

async function readStatuses(): Promise<Record<string, PurchaseStatus>> {
    try {
        await fs.access(STATUS_FILE_PATH);
        const data = await fs.readFile(STATUS_FILE_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        // File might not exist yet, which is fine
        return {};
    }
}

async function updateStatus(txId: string, updates: Partial<PurchaseStatus>) {
    const statuses = await readStatuses();
    const existing = statuses[txId] || { stacksTxId: txId };
    statuses[txId] = { ...existing, ...updates, updatedAt: new Date().toISOString() } as PurchaseStatus;
    await fs.writeFile(STATUS_FILE_PATH, JSON.stringify(statuses, null, 2));
    console.log(`[Relayer] Status updated for ${txId}: ${updates.status}`);
}


// --- Viem Client for Base ---
const baseClient = createPublicClient({
  chain: base,
  transport: http(),
});

// --- Megapot Contract on Base ---
const megapotAbi: Abi = [
    {
        "inputs": [
            { "internalType": "address", "name": "referrer", "type": "address" },
            { "internalType": "uint256", "name": "usdcAmount", "type": "uint256" },
            { "internalType": "address", "name": "recipient", "type": "address" }
        ],
        "name": "purchaseTickets",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];


async function handleBridgeAndPurchase(event: any) {
  const { tx_id, sender_address } = event;
  const statuses = await readStatuses();

  if (statuses[tx_id] && statuses[tx_id].status === 'complete') {
      console.log(`[Relayer] Skipping already completed transaction: ${tx_id}`);
      return;
  }

  const eventDetails = event.contract_call.events.find((e: any) => e.event_type === 'contract_log' && e.data.event?.repr === '"bridge-to-base-initiated"')?.data;
  if (!eventDetails) return;

  const baseAddress = eventDetails.base_address.repr;
  const ticketCount = BigInt(eventDetails.ticket_count.repr.replace('u', ''));
  const sbtcAmount = BigInt(eventDetails.sbtc_amount.repr.replace('u', ''));

  console.log(`[Relayer] Detected bridge-to-base-initiated event in tx ${tx_id}`);
  
  await updateStatus(tx_id, { 
      status: 'confirmed_stacks',
      stacksAddress: sender_address,
      recipientBaseAddress: baseAddress,
      ticketCount: Number(ticketCount),
      sbtcAmount: sbtcAmount.toString(),
  });

  try {
    // Step 1: Call the bridge API
    await updateStatus(tx_id, { status: 'bridging' });
    const bridgeResponse = await crossfetch(BRIDGE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            stacksTxId: tx_id,
            sbtcAmount: sbtcAmount.toString(),
            recipientBaseAddress: baseAddress,
        }),
    });

    if (!bridgeResponse.ok) {
        throw new Error(`Bridge API failed with status ${bridgeResponse.status}: ${await bridgeResponse.text()}`);
    }

    const bridgeResult = await bridgeResponse.json();
    console.log('[Relayer] Bridge API call successful:', bridgeResult);
    
    await new Promise(resolve => setTimeout(resolve, 30000)); // Simulate 30s bridge time

    // Step 2: Purchase tickets on Base
    await updateStatus(tx_id, { status: 'purchasing' });
    console.log(`[Relayer] (Simulated) Purchasing ${ticketCount} tickets on Base for ${baseAddress}...`);
    const simulatedBaseTxId = `0x${Buffer.from(tx_id).toString('hex').slice(0, 64)}`;
    await new Promise(resolve => setTimeout(resolve, 15000)); // Simulate 15s purchase time
    await updateStatus(tx_id, { status: 'complete', baseTxId: simulatedBaseTxId });

    // Step 3: Report the cross-chain purchase for tracking
    console.log(`[Relayer] Reporting cross-chain purchase for tx ${tx_id}...`);
    const reportResponse = await crossfetch(CROSS_CHAIN_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            stacksAddress: sender_address,
            evmAddress: baseAddress,
            stacksTxId: tx_id,
            baseTxId: simulatedBaseTxId,
            ticketCount: Number(ticketCount),
        }),
    });

    if (!reportResponse.ok) {
        // This is a non-critical error, so we just log it
        console.error(`[Relayer] Failed to report cross-chain purchase: ${await reportResponse.text()}`);
    } else {
        console.log(`[Relayer] Successfully reported cross-chain purchase for tx ${tx_id}.`);
    }

    console.log(`[Relayer] Successfully processed transaction ${tx_id}`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Relayer] Error processing transaction ${tx_id}:`, errorMessage);
    await updateStatus(tx_id, { status: 'error', error: errorMessage });
  }
}

async function listenForTransactions() {
  console.log('[Relayer] Starting Stacks transaction listener...');

  const socket = StacksApiSocketClient.connect({ url: STACKS_API_URL });

  await socket.connect(async (client: StacksApiWebSocketClient) => {
    console.log('[Relayer] Connected to Stacks API WebSocket.');

    await client.subscribeAddressTransactions(
        `${LOTTERY_CONTRACT_ADDRESS}.${LOTTERY_CONTRACT_NAME}`, 
        (event) => {
            if (event.tx_status === 'success' && event.tx_type === 'contract_call') {
                const contractCall = event.contract_call;
                if (contractCall.function_name === 'bridge-and-purchase-tickets') {
                    const hasBridgeEvent = contractCall.events.some(
                        (e: any) => e.event_type === 'contract_log' && e.data.event?.repr === '"bridge-to-base-initiated"'
                    );
                    if (hasBridgeEvent) {
                        handleBridgeAndPurchase(event);
                    }
                }
            }
        }
    );
  });
}

listenForTransactions().catch(console.error);

console.log('[Relayer] Script initialized.');
