import { NextRequest, NextResponse } from 'next/server';
import { stacksBridgeOperator } from '@/services/stacksBridgeOperator';

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
          console.log(`[Chainhook] Event type: ${event.type}`);
          console.log(`[Chainhook] Event data keys: ${Object.keys(event.data || {}).join(', ')}`);
          console.log(`[Chainhook] Has repr: ${!!event.data?.value?.repr}`);
          
          // Look for the specific contract log/print event
          // Self-hosted Chainhook 1.x uses SmartContractEvent for print events
          const isMatchingEvent = 
            event.type === 'SmartContractEvent' &&
            event.data?.value?.repr?.includes('bridge-purchase-initiated');
          
          if (isMatchingEvent) {
            console.log(`[Chainhook] ✅ FOUND MATCHING EVENT in tx ${txId}`);

            // Extract Data from the event
            // The structure in Chainhook for a print event is:
            // event.data.value.data contains the tuple fields if it's a tuple
            const eventData = event.data.value.data;
            console.log(`[Chainhook] Event data keys: ${eventData ? Object.keys(eventData).join(', ') : 'UNDEFINED'}`);
            console.log(`[Chainhook] Event data structure:`, JSON.stringify(eventData, null, 2).substring(0, 1000));

            if (eventData) {
              const baseAddress = (eventData['base-address']?.repr || eventData.base_address?.repr || '').replace(/"/g, '');
              const ticketCount = parseInt((eventData['ticket-count']?.repr || eventData.ticket_count?.repr || '0').replace(/u/g, ''));
              const amount = BigInt((eventData['sbtc-amount']?.repr || eventData.sbtc_amount?.repr || '0').replace(/u/g, ''));
              const tokenPrincipal = (eventData['token']?.repr || eventData.token?.repr || 'SP3Y2ZSH8P7D50B0VB0PVXAD455SCSY5A2JSTX9C9.usdc-token');

              console.log(`[Chainhook] Raw baseAddress: "${(eventData['base-address']?.repr || eventData.base_address?.repr || '')}"`);
              console.log(`[Chainhook] Raw ticketCount: "${(eventData['ticket-count']?.repr || eventData.ticket_count?.repr || '0')}"`);
              console.log(`[Chainhook] Extracted - baseAddress: "${baseAddress}", ticketCount: ${ticketCount}, amount: ${amount}, token: ${tokenPrincipal}`);

              if (baseAddress && ticketCount > 0) {
                console.log(`[Chainhook] ✅ Valid event data, processing: ${ticketCount} tickets for ${baseAddress}`);

                // Execute the bridge & purchase
                try {
                  const result = await stacksBridgeOperator.processBridgeEvent(
                    txId,
                    baseAddress,
                    ticketCount,
                    amount,
                    tokenPrincipal
                  );
                  console.log(`[Chainhook] ✅ Bridge event processing completed for ${txId}:`, result);
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

