import { NextRequest, NextResponse } from 'next/server';
import { stacksBridgeOperator } from '@/services/stacksBridgeOperator';

// Must be set via environment variable
const SECRET_TOKEN = process.env.CHAINHOOK_SECRET_TOKEN;

if (!SECRET_TOKEN) {
  throw new Error('CHAINHOOK_SECRET_TOKEN environment variable is required');
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authorization Check
    const authHeader = req.headers.get('authorization');
    const bearer = authHeader?.replace('Bearer ', '');

    // DEBUG LOG
    const fs = require('fs');
    const timestamp = new Date().toISOString();
    fs.appendFileSync('scripts/chainhook-debug.log', `[${timestamp}] [Chainhook Entry] Auth: ${bearer === SECRET_TOKEN ? 'OK' : 'FAIL'} | Bearer: ${bearer?.substring(0, 20)}...\n`);

    if (!authHeader || bearer !== SECRET_TOKEN) {
      console.warn('[Chainhook] Unauthorized attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse Body
    const body = await req.json();

    // Chainhook payloads are arrays of blocks/transactions
    // We need to iterate through them to find our events
    const events = body.apply || [];
    
    fs.appendFileSync('scripts/chainhook-debug.log', `[${timestamp}] [Chainhook] Received payload with ${events.length} blocks\n`);

    for (const blockEvent of events) {
      for (const tx of blockEvent.transactions) {
        const txId = tx.transaction_identifier.hash;
        const txEvents = tx.metadata?.receipt?.events || [];

        for (const event of txEvents) {
          // Look for the specific contract log/print event
          if (event.type === 'SmartContractEvent' &&
            event.data?.value?.repr?.includes('bridge-purchase-initiated')) {

            console.log(`[Chainhook] Received bridge purchase event in tx ${txId}`);

            // Extract Data from the event
            // The structure in Chainhook for a print event is:
            // event.data.value.data contains the tuple fields if it's a tuple
            const eventData = event.data.value.data;

            if (eventData) {
              const baseAddress = (eventData['base-address']?.repr || eventData.base_address?.repr || '').replace(/"/g, '');
              const ticketCount = parseInt((eventData['ticket-count']?.repr || eventData.ticket_count?.repr || '0').replace('u', ''));
              const amount = BigInt((eventData['sbtc-amount']?.repr || eventData.sbtc_amount?.repr || '0').replace('u', ''));
              const tokenPrincipal = (eventData['token']?.repr || eventData.token?.repr || 'SP3Y2ZSH8P7D50B0VB0PVXAD455SCSY5A2JSTX9C9.usdc-token');

              if (baseAddress && ticketCount > 0) {
                console.log(`[Chainhook] Processing: ${ticketCount} tickets for ${baseAddress} using ${tokenPrincipal}`);

                // Execute the bridge & purchase
                await stacksBridgeOperator.processBridgeEvent(
                  txId,
                  baseAddress,
                  ticketCount,
                  amount,
                  tokenPrincipal
                );
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ status: 'received' }, { status: 200 });

  } catch (error) {
    console.error('[Chainhook] Error processing request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

