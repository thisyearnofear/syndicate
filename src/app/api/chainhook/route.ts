import { NextRequest, NextResponse } from 'next/server';
import { stacksBridgeOperator } from '@/services/stacksBridgeOperator';

// Helper: Extract field from event data, trying both dash and underscore variants
function getField(obj: any, dashKey: string): string | undefined {
  if (!obj) return undefined;
  const underscoreKey = dashKey.replace(/-/g, '_');
  return obj[dashKey]?.repr || obj[underscoreKey]?.repr;
}

export async function POST(req: NextRequest) {
  try {
    // Log every request to verify Chainhook is hitting the endpoint
    console.log('[Chainhook] POST received at', new Date().toISOString());
    
    // Authorization check - prevent unauthorized bridge execution
    // Endpoint is public, so we must verify requests come from Chainhook
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

    // 2. Parse Body
    const body = await req.json();

    // Chainhook payloads are arrays of blocks/transactions
    // We need to iterate through them to find our events
    const events = body.apply || [];
    
    console.log(`[Chainhook] Received payload with ${events.length} blocks`);
    console.log(`[Chainhook] Full payload:`, JSON.stringify(body, null, 2).substring(0, 2000));

    for (const blockEvent of events) {
      console.log(`[Chainhook] Processing block ${blockEvent.block_identifier.hash}`);
      const txs = blockEvent.transactions || [];
      console.log(`[Chainhook] Block has ${txs.length} transactions`);
      
      for (const tx of txs) {
        const txId = tx.transaction_identifier?.hash;
        console.log(`[Chainhook] Processing tx ${txId}`);
        
        const txEvents = tx.metadata?.receipt?.events || [];
        console.log(`[Chainhook] Tx has ${txEvents.length} events`);

        for (const event of txEvents) {
          console.log(`[Chainhook] Event type: ${event.type}, has repr: ${!!event.data?.value?.repr}`);
          
          // Look for the specific contract log/print event
          // Chainhook sends print events as type 'ContractPrintEvent' not 'SmartContractEvent'
          const isMatchingEvent = 
            (event.type === 'ContractPrintEvent' || event.type === 'SmartContractEvent') &&
            event.data?.value?.repr?.includes('bridge-purchase-initiated');
          
          if (isMatchingEvent) {
            console.log(`[Chainhook] ✅ FOUND MATCHING EVENT in tx ${txId}`);

            // Extract Data from the event
            // The structure in Chainhook for a print event is:
            // event.data.value.data contains the tuple fields if it's a tuple
            const eventData = event.data.value.data;
            console.log(`[Chainhook] Event data keys: ${eventData ? Object.keys(eventData).join(', ') : 'UNDEFINED'}`);

            if (eventData) {
              const baseAddressRaw = getField(eventData, 'base-address') || '';
              const baseAddress = baseAddressRaw.replace(/"/g, '');
              const ticketCountRaw = getField(eventData, 'ticket-count') || '0';
              const ticketCount = parseInt(ticketCountRaw.replace(/u/g, ''));
              const amountRaw = getField(eventData, 'sbtc-amount') || '0';
              const amount = BigInt(amountRaw.replace(/u/g, ''));
              const tokenPrincipal = getField(eventData, 'token') || 'SP3Y2ZSH8P7D50B0VB0PVXAD455SCSY5A2JSTX9C9.usdc-token';

              console.log(`[Chainhook] Extracted - baseAddress: ${baseAddress}, ticketCount: ${ticketCount}, amount: ${amount}, token: ${tokenPrincipal}`);

              if (baseAddress && ticketCount > 0) {
                console.log(`[Chainhook] ✅ Valid event data, processing: ${ticketCount} tickets for ${baseAddress}`);

                // Execute the bridge & purchase
                try {
                  await stacksBridgeOperator.processBridgeEvent(
                    txId,
                    baseAddress,
                    ticketCount,
                    amount,
                    tokenPrincipal
                  );
                  console.log(`[Chainhook] ✅ Bridge event processing completed for ${txId}`);
                } catch (processingError) {
                  console.error(`[Chainhook] ❌ Error processing bridge event:`, processingError);
                }
              } else {
                console.log(`[Chainhook] ⚠️  Invalid event data - baseAddress empty or ticketCount invalid`);
              }
            } else {
              console.log(`[Chainhook] ⚠️  Event data is undefined`);
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

