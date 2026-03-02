import { NextRequest, NextResponse } from 'next/server';
import { getPendingPurchaseStatusesByChain, upsertPurchaseStatus } from '@/lib/db/repositories/purchaseStatusRepository';
import { getCrossChainPurchaseByStacksTxId } from '@/lib/db/repositories/crossChainPurchaseRepository';
import { CONTRACTS, LOTTERY, CHAINS } from '@/config';
import { ethers } from 'ethers';
import { nearIntentsService } from '@/services/nearIntentsService';

// Force this route to be server-side only — never statically pre-rendered.
// @vercel/postgres requires POSTGRES_URL which is only available at runtime, not build time.
export const dynamic = 'force-dynamic';

const DEBRIDGE_STATS_API = 'https://stats-api.dln.trade/api/Orders';

async function checkDeBridgeOrder(orderId: string) {
  const res = await fetch(`${DEBRIDGE_STATS_API}/${orderId}`, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`deBridge stats error: ${res.status} ${text}`);
  }
  return res.json() as Promise<{
    state: string;
    fulfillTx?: { txHash?: string };
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth = request.headers.get('authorization') || '';
      const token = auth.replace('Bearer ', '');
      if (token !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const pending = await getPendingPurchaseStatusesByChain('solana');

    let updated = 0;
    for (const record of pending) {
      if (!record.bridgeId) continue;
      try {
        const status = await checkDeBridgeOrder(record.bridgeId);
        if (status.state === 'Fulfilled' || status.state === 'ClaimedUnlock') {
          await upsertPurchaseStatus({
            sourceTxId: record.sourceTxId,
            sourceChain: 'solana',
            status: 'complete',
            baseTxId: status.fulfillTx?.txHash || record.baseTxId || null,
            bridgeId: record.bridgeId,
            recipientBaseAddress: record.recipientBaseAddress || null,
          });
          updated++;
        } else if (
          status.state === 'Cancelled' ||
          status.state === 'OrderCancelled' ||
          status.state === 'ClaimedOrderCancel'
        ) {
          await upsertPurchaseStatus({
            sourceTxId: record.sourceTxId,
            sourceChain: 'solana',
            status: 'error',
            bridgeId: record.bridgeId,
            error: `Bridge order ${status.state}`,
            recipientBaseAddress: record.recipientBaseAddress || null,
          });
          updated++;
        }
      } catch (e) {
        console.warn('[recheck-bridges] Failed to check order', record.bridgeId, e);
      }
    }

    const pendingNear = await getPendingPurchaseStatusesByChain('near');
    for (const record of pendingNear) {
      if (!record.bridgeId) continue;
      try {
        const status = await nearIntentsService.getIntentStatus(record.bridgeId);
        if (status.status === 'completed') {
          await upsertPurchaseStatus({
            sourceTxId: record.sourceTxId,
            sourceChain: 'near',
            status: 'complete',
            baseTxId: status.destinationTx || record.baseTxId || null,
            bridgeId: record.bridgeId,
            recipientBaseAddress: record.recipientBaseAddress || null,
          });
          updated++;
        } else if (status.status === 'failed') {
          await upsertPurchaseStatus({
            sourceTxId: record.sourceTxId,
            sourceChain: 'near',
            status: 'error',
            bridgeId: record.bridgeId,
            error: status.error || 'Intent failed',
            recipientBaseAddress: record.recipientBaseAddress || null,
          });
          updated++;
        }
      } catch (e) {
        console.warn('[recheck-bridges] Failed to check NEAR intent', record.bridgeId, e);
      }
    }

    // Handle Stacks → Base (USDCx via attestation/CCTP)
    const pendingStacks = await getPendingPurchaseStatusesByChain('stacks');
    for (const record of pendingStacks) {
      try {
        const stacksTxId = record.sourceTxId || record.stacksTxId || '';
        if (!stacksTxId) continue;

        // Require configured proxy and signer
        const proxyAddress = CONTRACTS.autoPurchaseProxy;
        const signerKey = process.env.AUTO_PURCHASE_SIGNER_KEY;
        if (!proxyAddress || proxyAddress === '0x0000000000000000000000000000000000000000') {
          console.warn('[recheck-bridges] AutoPurchaseProxy not configured; skipping Stacks record', stacksTxId);
          continue;
        }
        if (!signerKey) {
          console.warn('[recheck-bridges] AUTO_PURCHASE_SIGNER_KEY missing; skipping Stacks record', stacksTxId);
          continue;
        }

        // Find ticket count and recipient
        const purchase = await getCrossChainPurchaseByStacksTxId(stacksTxId);
        if (!purchase || !purchase.ticketCount || !record.recipientBaseAddress) {
          console.warn('[recheck-bridges] Missing purchase data for', stacksTxId);
          continue;
        }

        // Compute required USDC amount (6 decimals)
        const amountWei = BigInt(purchase.ticketCount) * LOTTERY.ticketPriceWei;

        // Create provider
        const provider = new ethers.JsonRpcProvider(CHAINS.base.rpcUrl);

        // Optional fast path: detect recent USDC transfers to proxy
        try {
          const currentBlock = await provider.getBlockNumber();
          const fromBlock = Math.max(0, currentBlock - 1500);
          const transferTopic = ethers.id('Transfer(address,address,uint256)');
          const toTopic = ethers.zeroPadValue(proxyAddress, 32);
          const logs = await provider.getLogs({
            address: CONTRACTS.usdc,
            topics: [transferTopic, null, toTopic],
            fromBlock,
            toBlock: currentBlock,
          });
          if (logs.length > 0) {
            // USDC recently arrived — proceed to execute purchase
          }
        } catch (e) {
          // Non-fatal: fall back to balance check
        }

        // Check USDC balance at proxy (safe path)
        const usdc = new ethers.Contract(CONTRACTS.usdc, ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'], provider);
        const balance: bigint = await usdc.balanceOf(proxyAddress);
        if (balance < amountWei) {
          // Not yet delivered; continue
          continue;
        }

        // Execute bridged purchase
        const wallet = new ethers.Wallet(signerKey, provider);
        const proxyIface = new ethers.Interface([
          'function executeBridgedPurchase(uint256 amount, address recipient, address referrer, bytes32 bridgeId) external',
        ]);
        const proxy = new ethers.Contract(proxyAddress, proxyIface.fragments, wallet);
        const bridgeId = ethers.keccak256(ethers.toUtf8Bytes(`stacks-${stacksTxId}`));
        const tx = await proxy.executeBridgedPurchase(amountWei, record.recipientBaseAddress, LOTTERY.referrerAddress, bridgeId, { gasLimit: 300000 });
        const rc = await tx.wait();

        await upsertPurchaseStatus({
          sourceTxId: stacksTxId,
          sourceChain: 'stacks',
          status: 'complete',
          baseTxId: rc?.hash || record.baseTxId || null,
          bridgeId,
          recipientBaseAddress: record.recipientBaseAddress || null,
        });
        updated++;
      } catch (e) {
        console.warn('[recheck-bridges] Failed Stacks purchase finalize', record.sourceTxId, e);
      }
    }

    return NextResponse.json({ success: true, checked: pending.length + pendingNear.length + pendingStacks.length, updated });
  } catch (error) {
    console.error('[recheck-bridges] Failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
