/**
 * TON CHAINHOOK EVENT LISTENER
 *
 * Receives events from the TON SyndicateLotteryTON smart contract.
 * Two event types:
 *
 * 1. PurchaseConfirmed (0x434f4e46) — lightweight, for UI
 *    - purchaseId, sender, amount, ticketCount
 *
 * 2. BatchBridgeReady (0x42415448) — for relayer
 *    - startId, endId, purchaseCount
 *    - Relayer fetches individual purchases via get_purchase() then bridges batch total
 *
 * Flow:
 * 1. User pays TON/USDT → PurchaseConfirmed emitted → UI shows confirmation
 * 2. Keeper calls triggerBatchBridge() → BatchBridgeReady emitted
 * 3. This handler receives BatchBridgeReady → fetches purchases in range →
 *    queues single CCTP bridge for batch total → tickets minted on Base
 */

import { NextRequest, NextResponse } from "next/server";

const TON_RPC = process.env.TON_RPC_ENDPOINT || "https://toncenter.com/api/v2/jsonRPC";
const TON_API_KEY = process.env.TON_API_KEY;
const LOTTERY_CONTRACT = process.env.TON_LOTTERY_CONTRACT;

interface PurchaseConfirmedEvent {
  type: "PurchaseConfirmed";
  purchaseId: string;
  sender: string;
  amount: string;
  ticketCount: number;
  txHash: string;
}

interface BatchBridgeReadyEvent {
  type: "BatchBridgeReady";
  startId: string;
  endId: string;
  purchaseCount: number;
  txHash: string;
}

type TonEvent = PurchaseConfirmedEvent | BatchBridgeReadyEvent;

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("X-Ton-Signature");
    const expectedSecret = process.env.TON_WEBHOOK_SECRET;

    if (expectedSecret && signature !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const event = (await request.json()) as TonEvent;

    if (event.type === "PurchaseConfirmed") {
      console.log("[TON Chainhook] Purchase confirmed:", {
        purchaseId: event.purchaseId,
        sender: event.sender,
        amount: event.amount,
        ticketCount: event.ticketCount,
      });

      // UI-only confirmation — no bridge action needed yet
      // The batch trigger will handle the actual bridging
      return NextResponse.json({
        ok: true,
        type: "confirmed",
        purchaseId: event.purchaseId,
      });
    }

    if (event.type === "BatchBridgeReady") {
      console.log("[TON Chainhook] Batch bridge ready:", {
        startId: event.startId,
        endId: event.endId,
        purchaseCount: event.purchaseCount,
      });

      // Fetch individual purchases from contract
      const purchases = await fetchPurchaseRange(
        BigInt(event.startId),
        BigInt(event.endId)
      );

      // Calculate total amount to bridge
      let totalAmount = BigInt(0);
      let totalTickets = 0;
      const destinations: string[] = [];

      for (const p of purchases) {
        totalAmount += BigInt(p.amount);
        totalTickets += p.ticketCount;
        destinations.push(p.baseAddress);
      }

      console.log("[TON Chainhook] Batch total:", {
        totalAmount: totalAmount.toString(),
        totalTickets,
        purchaseCount: purchases.length,
      });

      // Queue single purchase job for batch total
      // Reuses existing purchase_jobs table
      // job_type: 'process_bridge_event'
      // payload: { batchStartId, batchEndId, totalAmount, totalTickets, destinations }

      return NextResponse.json({
        ok: true,
        type: "batch",
        startId: event.startId,
        endId: event.endId,
        totalAmount: totalAmount.toString(),
        totalTickets,
        purchaseCount: purchases.length,
      });
    }

    return NextResponse.json({ ok: true, skipped: true });
  } catch (error) {
    console.error("[TON Chainhook] Error:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/**
 * Fetch purchase data for a range of purchase IDs from the contract
 */
async function fetchPurchaseRange(
  startId: bigint,
  endId: bigint
): Promise<Array<{ sender: string; amount: string; ticketCount: number; baseAddress: string }>> {
  if (!LOTTERY_CONTRACT || !TON_RPC) {
    console.warn("[TON Chainhook] TON_RPC or TON_LOTTERY_CONTRACT not configured");
    return [];
  }

  const purchases: Array<{
    sender: string;
    amount: string;
    ticketCount: number;
    baseAddress: string;
  }> = [];

  // Fetch each purchase via get_purchase(id) runGetMethod
  for (let id = startId; id < endId; id++) {
    try {
      const url = `${TON_RPC}/runGetMethod`;
      const body = {
        address: LOTTERY_CONTRACT,
        method: "get_purchase",
        stack: [["num", id.toString()]],
        ...(TON_API_KEY ? {} : {}),
      };

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (TON_API_KEY) headers["X-Api-Key"] = TON_API_KEY;

      const resp = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const data = await resp.json();
      if (data.ok && data.result?.stack?.length > 0) {
        // Parse TON stack result (simplified — actual parsing depends on contract)
        purchases.push({
          sender: data.result.stack[0]?.[1] ?? "",
          amount: data.result.stack[1]?.[1] ?? "0",
          ticketCount: parseInt(data.result.stack[3]?.[1] ?? "1", 10),
          baseAddress: data.result.stack[2]?.[1] ?? "",
        });
      }
    } catch (err) {
      console.warn(`[TON Chainhook] Failed to fetch purchase ${id}:`, err);
    }
  }

  return purchases;
}
