import { NextRequest, NextResponse } from 'next/server';
import { stacksBridgeOperator } from '@/services/stacksBridgeOperator';

/**
 * Chainhooks 2.0 Payload Handler
 * 
 * Chainhooks 2.0 uses a different structure than v1:
 * - Transactions have `operations` array instead of `metadata.receipt.events`
 * - Print events are `contract_log` operations with type `contract_log`
 * - Clarity values are in `value` field with `repr` string representation
 */

export async function POST(req: NextRequest) {
  try {
    console.log('[Chainhook] POST received at', new Date().toISOString());
    
    // Verify authorization
    const SECRET_TOKEN = process.env.CHAINHOOK_SECRET_TOKEN;
    if (!SECRET_TOKEN) {
      console.error('[Chainhook] CHAINHOOK_SECRET_TOKEN not configured');
      return NextResponse.json({ error: 'Chainhook not configured' }, { status: 500 });
    }

    const authHeader = req.headers.get('authorization');
    const bearer = authHeader?.replace('Bearer ', '');

    if (!authHeader || bearer !== SECRET_TOKEN) {
      console.warn('[Chainhook] Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Chainhooks 2.0 structure: { event: { apply: [], rollback: [] }, chainhook: {...} }
    const blocks = body.event?.apply || [];
    
    console.log(`[Chainhook] Received payload with ${blocks.length} blocks`);
    console.log(`[Chainhook] Full payload (first 2000 chars):`, JSON.stringify(body, null, 2).substring(0, 2000));

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

        // Operations array contains all state changes (contract calls, logs, transfers, etc)
        const operations = tx.operations || [];
        console.log(`[Chainhook] Tx has ${operations.length} operations`);

        // Look for contract_log operations (print statements)
        for (const op of operations) {
          console.log(`[Chainhook] Operation type: ${op.type}`);

          // In Chainhooks 2.0, print events are contract_log operations
          if (op.type === 'contract_log') {
            const logValue = op.data?.value?.repr || '';
            console.log(`[Chainhook] Contract log repr: ${logValue.substring(0, 100)}...`);

            // Check if this is our bridge event
            if (logValue.includes('bridge-purchase-initiated')) {
              console.log(`[Chainhook] ✅ FOUND MATCHING EVENT in tx ${txId}`);

              // Parse the Clarity tuple
              // In Chainhooks 2.0, the value is a string representation of the Clarity value
              // We need to extract the fields from the tuple
              const eventData = op.data?.value?.data;
              
              if (eventData) {
                console.log(`[Chainhook] Event data keys: ${Object.keys(eventData).join(', ')}`);
                console.log(`[Chainhook] Event data structure:`, JSON.stringify(eventData, null, 2).substring(0, 1000));

                // Extract fields from the Clarity tuple
                // Fields can be keyed with dashes or underscores
                const baseAddress = extractField(eventData, 'base-address');
                const ticketCount = extractNumericField(eventData, 'ticket-count');
                const amount = extractBigIntField(eventData, 'sbtc-amount');
                const tokenPrincipal = extractField(eventData, 'token') || 'SP3Y2ZSH8P7D50B0VB0PVXAD455SCSY5A2JSTX9C9.usdc-token';

                console.log(`[Chainhook] Extracted - baseAddress: "${baseAddress}", ticketCount: ${ticketCount}, amount: ${amount}, token: ${tokenPrincipal}`);

                if (baseAddress && ticketCount > 0) {
                  console.log(`[Chainhook] ✅ Valid event data, processing: ${ticketCount} tickets for ${baseAddress}`);

                  try {
                    const result = await stacksBridgeOperator.processBridgeEvent(
                      txId,
                      baseAddress,
                      ticketCount,
                      amount,
                      tokenPrincipal
                    );
                    console.log(`[Chainhook] ✅ Bridge event processing completed:`, result);
                  } catch (processingError) {
                    console.error(`[Chainhook] ❌ Error processing bridge event:`, processingError);
                    throw processingError;
                  }
                } else {
                  console.log(`[Chainhook] ⚠️  Invalid event data - baseAddress: "${baseAddress}" (empty=${!baseAddress}), ticketCount: ${ticketCount} (<=0=${ticketCount <= 0})`);
                }
              } else {
                console.log(`[Chainhook] ⚠️  Event data is undefined`);
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
