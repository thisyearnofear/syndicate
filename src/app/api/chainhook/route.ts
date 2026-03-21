import { NextRequest, NextResponse } from 'next/server';
import { getPurchaseStatusByTxId } from '@/lib/db/repositories/purchaseStatusRepository';
import { enqueueJob, jobExistsForTxId, ensurePurchaseJobsTable } from '@/lib/db/repositories/purchaseJobRepository';

/**
 * Chainhooks 2.0 Payload Handler - DECENTRALIZED
 * 
 * CONSOLIDATION: Removed operator dependency
 * CLEAN: Only tracks status, attestation + CCTP handles actual bridging
 * 
 * Flow:
 * 1. Chainhook detects Stacks contract event
 * 2. This handler records status in DB
 * 3. Circle xReserve/CCTP bridges tokens automatically (no operator key)
 * 4. Base proxy receives USDC → purchases tickets automatically
 * 
 * Chainhooks 2.0 structure:
 * - Transactions have `operations` array instead of `metadata.receipt.events`
 * - Print events are `contract_log` operations with type `contract_log`
 * - Clarity values are in `value` field with `repr` string representation
 */

export async function POST(req: NextRequest) {
  try {
    console.log('[Chainhook] POST received at', new Date().toISOString());

    // Ensure job queue table exists (idempotent)
    await ensurePurchaseJobsTable();
    
    // Verify authorization - check both testnet and mainnet secrets
    const SECRET_TOKEN_TESTNET = process.env.CHAINHOOK_SECRET_TOKEN_TESTNET;
    const SECRET_TOKEN_MAINNET = process.env.CHAINHOOK_SECRET_TOKEN_MAINNET;
    
    if (!SECRET_TOKEN_TESTNET && !SECRET_TOKEN_MAINNET) {
      console.error('[Chainhook] CHAINHOOK_SECRET_TOKEN not configured');
      return NextResponse.json({ error: 'Chainhook not configured' }, { status: 500 });
    }

    const authHeader = req.headers.get('authorization');
    const bearer = authHeader?.replace('Bearer ', '');

    // Accept either testnet or mainnet secret
    const isAuthorized = bearer === SECRET_TOKEN_TESTNET || bearer === SECRET_TOKEN_MAINNET;
    
    if (!authHeader || !isAuthorized) {
      console.warn('[Chainhook] Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Chainhooks 2.0 structure: { event: { apply: [], rollback: [] }, chainhook: {...} }
    const blocks = body.event?.apply || [];
    
    console.log(`[Chainhook] Received payload with ${blocks.length} blocks`);

    // Process each block
    for (const block of blocks) {
      const blockHash = block.block_identifier?.hash;
      console.log(`[Chainhook] Processing block ${blockHash}`);
      
      const transactions = block.transactions || [];
      console.log(`[Chainhook] Block has ${transactions.length} transactions`);

      // Process each transaction
      for (const tx of transactions) {
        const txId = tx.transaction_identifier?.hash;
        console.log(`[Chainhook] Processing tx ${txId}`);

        // Idempotency: skip if this txId was already enqueued or processed
        if (txId) {
          const alreadyQueued = await jobExistsForTxId(txId);
          if (alreadyQueued) {
            console.log(`[Chainhook] Skipping already-queued tx ${txId}`);
            continue;
          }
          const existing = await getPurchaseStatusByTxId(txId);
          if (existing && existing.status !== 'error') {
            console.log(`[Chainhook] Skipping already-processed tx ${txId} (status: ${existing.status})`);
            continue;
          }
        }

        // Operations array contains all state changes (contract calls, logs, transfers, etc)
        const operations = tx.operations || [];

        // Look for contract_log operations (print statements)
        for (const op of operations) {
          console.log(`[Chainhook] Operation type: ${op.type}`);

          // In Chainhooks 2.0, print events are contract_log operations
          if (op.type === 'contract_log') {
            const logValue = op.data?.value?.repr || '';

            // Check if this is our bridge event
            if (logValue.includes('bridge-purchase-initiated')) {
              console.log(`[Chainhook] ✅ FOUND MATCHING EVENT in tx ${txId}`);

              // Parse the Clarity tuple
              // In Chainhooks 2.0, the value is a string representation of the Clarity value
              // We need to extract the fields from the tuple
              const eventData = op.data?.value?.data;
              
              if (eventData) {
                // Extract fields from the Clarity tuple
                // Fields can be keyed with dashes or underscores
                const baseAddress = extractField(eventData, 'base-address');
                const stacksUser = extractField(eventData, 'stacks-user');
                const ticketCount = extractNumericField(eventData, 'ticket-count');
                const amount = extractBigIntField(eventData, 'sbtc-amount');
                const purchaseId = extractNumericField(eventData, 'purchase-id');
                const tokenPrincipal = extractField(eventData, 'token') || 'SP3Y2ZSH8P7D50B0VB0PVXAD455SCSY5A2JSTX9C9.usdc-token';

                if (baseAddress && ticketCount > 0) {

                  try {
                    // Enqueue durable job — protects against server restarts
                    const jobId = await enqueueJob('process_bridge_event', {
                      txId,
                      baseAddress,
                      ticketCount,
                      amount: amount.toString(),
                      tokenPrincipal,
                      purchaseId,
                      stacksAddress: stacksUser,
                    });
                    console.log(`[Chainhook] ✅ Enqueued job ${jobId} for tx ${txId}`);
                  } catch (processingError) {
                    console.error(`[Chainhook] ❌ Error enqueuing job:`, processingError);
                    throw processingError;
                  }
                } else {
                  console.warn(`[Chainhook] ⚠️  Invalid event data in tx ${txId} - missing baseAddress or ticketCount`);
                }
              } else {
                console.warn(`[Chainhook] ⚠️  Event data undefined in tx ${txId}`);
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ status: 'received' }, { status: 200 });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('[Chainhook] Error processing request:', errorMsg);
    console.error('[Chainhook] Stack:', errorStack);
    return NextResponse.json({ 
      error: 'Internal Server Error',
      details: errorMsg 
    }, { status: 500 });
  }
}

/**
 * Extract a string field from Clarity tuple data
 * Tries both dash and underscore variants
 */
function extractField(data: any, dashKey: string): string {
  if (!data) return '';
  const underscoreKey = dashKey.replace(/-/g, '_');
  
  const value = data[dashKey]?.repr || data[underscoreKey]?.repr || '';
  // Remove quotes if present
  return typeof value === 'string' ? value.replace(/"/g, '') : '';
}

/**
 * Extract a numeric field from Clarity tuple data
 */
function extractNumericField(data: any, dashKey: string): number {
  const value = extractField(data, dashKey);
  // Remove 'u' suffix if present (unsigned integer in Clarity)
  const cleaned = value.replace(/u/g, '');
  return parseInt(cleaned) || 0;
}

/**
 * Extract a BigInt field from Clarity tuple data
 */
function extractBigIntField(data: any, dashKey: string): bigint {
  const value = extractField(data, dashKey);
  // Remove 'u' suffix if present (unsigned integer in Clarity)
  const cleaned = value.replace(/u/g, '');
  try {
    return BigInt(cleaned || '0');
  } catch {
    return 0n;
  }
}
