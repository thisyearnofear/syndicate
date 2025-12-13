
import { StacksApiSocketClient, StacksApiWebSocketClient } from '@stacks/blockchain-api-client';
import { StacksMainnet } from '@stacks/network';
import { config } from 'dotenv';
import crossfetch from 'cross-fetch';
import { createPublicClient, http, getContract, Abi } from 'viem';
import { base } from 'viem/chains';

// Load environment variables from .env file
config();

// Constants
const STACKS_API_URL = process.env.NEXT_PUBLIC_STACKS_API_URL || 'https://api.stacks.co';
const MEGAPOT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_MEGAPOT_CONTRACT || "0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95";
const LOTTERY_CONTRACT_ADDRESS = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'; // Replace with your contract address principal if different
const LOTTERY_CONTRACT_NAME = 'stacks-lottery';
const BRIDGE_API_URL = 'http://localhost:3000/api/stacks-lottery?endpoint=/bridge/sbtc-to-base'; // Assuming local dev server

// Keep track of processed transaction IDs to avoid duplicates
const processedTxs = new Set<string>();

// Vercel KV for persistence (optional, can be replaced with a local file or DB)
// You would need to set up Vercel KV for this to work.
// import { kv } from '@vercel/kv';
// async function markTxAsProcessed(txId: string) {
//   await kv.sadd('processed-stacks-txs', txId);
// }
// async function isTxProcessed(txId: string): Promise<boolean> {
//   return (await kv.sismember('processed-stacks-txs', txId)) === 1;
// }


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
    // Add other functions if needed
];


async function handleBridgeAndPurchase(event: any) {
  const { tx_id, contract_call } = event;
  const eventDetails = event.contract_call.events[0].data;

  if (processedTxs.has(tx_id)) {
      console.log(`[Relayer] Skipping already processed transaction: ${tx_id}`);
      return;
  }
  
  // Example event data from the contract print statement
  // { event: "bridge-to-base-initiated", buyer: tx-sender, base-address: base-address, ticket-count: ticket-count, sbtc-amount: total-cost }
  const baseAddress = eventDetails.base_address.repr;
  const ticketCount = BigInt(eventDetails.ticket_count.repr.replace('u', ''));
  const sbtcAmount = BigInt(eventDetails.sbtc_amount.repr.replace('u', ''));

  console.log(`[Relayer] Detected bridge-to-base-initiated event in tx ${tx_id}`);
  console.log(`[Relayer]   - Base Address: ${baseAddress}`);
  console.log(`[Relayer]   - Ticket Count: ${ticketCount}`);
  console.log(`[Relayer]   - sBTC Amount: ${sbtcAmount}`);

  try {
    // Step 1: Call the bridge API
    console.log(`[Relayer] Calling bridge API for tx ${tx_id}...`);
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
    
    // Assuming the bridge is synchronous for this example.
    // In a real-world scenario, the bridge would be asynchronous.
    // You would need a mechanism (e.g., webhooks, polling) to know when the funds have arrived on Base.

    // Step 2: Purchase tickets on Base
    console.log(`[Relayer] Purchasing ${ticketCount} tickets on Base for ${baseAddress}...`);
    
    // This is a placeholder for the actual purchase logic.
    // You would need a wallet with funds on Base to pay for the transaction fees.
    // The `purchaseTickets` function on the Megapot contract would be called here.
    // The amount of USDC to use would be derived from the `sbtcAmount`.

    // const { request } = await baseClient.simulateContract({
    //     address: MEGAPOT_CONTRACT_ADDRESS as `0x${string}`,
    //     abi: megapotAbi,
    //     functionName: 'purchaseTickets',
    //     args: [baseAddress, ticketCount * 1_000_000n, baseAddress], // Assuming 1 USDC per ticket
    //     // You need an account to sign this transaction
    //     // account: your_relayer_account
    // });
    // const txHash = await baseClient.writeContract(request);
    // console.log(`[Relayer] Submitted Base transaction: ${txHash}`);
    // await baseClient.waitForTransactionReceipt({ hash: txHash });
    console.log('[Relayer] (Simulated) Purchase successful!');


    // Mark transaction as processed
    processedTxs.add(tx_id);
    console.log(`[Relayer] Marked transaction ${tx_id} as processed.`);

  } catch (error) {
    console.error(`[Relayer] Error processing transaction ${tx_id}:`, error);
  }
}

async function listenForTransactions() {
  console.log('[Relayer] Starting Stacks transaction listener...');

  const network = new StacksMainnet({ url: STACKS_API_URL });
  const socket = new StacksApiSocketClient(network);

  await socket.connect(async (client: StacksApiWebSocketClient) => {
    console.log('[Relayer] Connected to Stacks API WebSocket.');

    await client.subscribeAddressTransactions(
        `${LOTTERY_CONTRACT_ADDRESS}.${LOTTERY_CONTRACT_NAME}`, 
        (event) => {
            if (event.tx_status === 'success' && event.tx_type === 'contract_call') {
                const contractCall = event.contract_call;
                if (contractCall.function_name === 'bridge-and-purchase-tickets') {
                    // Check for the custom event print
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
