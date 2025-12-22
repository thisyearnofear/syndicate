/**
 * Register Chainhook 2.0 (Hosted) for Stacks Bridge
 * 
 * This script registers the bridge event listener with Hiro's Chainhooks 2.0 API.
 * 
 * Prerequisites:
 * - CHAINHOOK_API_KEY environment variable (from https://platform.hiro.so)
 * - CHAINHOOK_WEBHOOK_URL (your endpoint, e.g., https://yourdomain.com/api/chainhook)
 * - CHAINHOOK_SECRET_TOKEN (for verifying incoming webhooks)
 */

import { ChainhooksClient, StacksNetwork } from '@hirosystems/chainhooks-client';

const API_KEY = process.env.CHAINHOOK_API_KEY;
const WEBHOOK_URL = process.env.CHAINHOOK_WEBHOOK_URL || 'https://syndicateapp.vercel.app/api/chainhook';
const SECRET_TOKEN = process.env.CHAINHOOK_SECRET_TOKEN;

if (!API_KEY) {
  console.error('❌ CHAINHOOK_API_KEY environment variable not set');
  process.exit(1);
}

if (!SECRET_TOKEN) {
  console.error('❌ CHAINHOOK_SECRET_TOKEN environment variable not set');
  process.exit(1);
}

async function registerChainhook() {
  try {
    const client = new ChainhooksClient({
      apiKey: API_KEY,
      network: StacksNetwork.mainnet, // or testnet for testing
    });

    console.log('📝 Registering Chainhook 2.0...');
    console.log(`   Webhook URL: ${WEBHOOK_URL}`);
    console.log(`   Network: mainnet`);

    const chainhook = await client.registerChainhook({
      uuid: 'stacks-lottery-bridge-v2',
      name: 'Stacks Lottery Bridge (V2)',
      description: 'Listen for bridge-purchase-initiated events and trigger cross-chain purchases',
      enabled: true,
      network: StacksNetwork.mainnet,
      filter: {
        scope: 'contract_log',
        contract_identifier: 'SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3',
        contains: 'bridge-purchase-initiated',
      },
      action: {
        type: 'http_post',
        url: WEBHOOK_URL,
        authorization_header: `Bearer ${SECRET_TOKEN}`,
      },
    });

    console.log('✅ Chainhook registered successfully!');
    console.log('   UUID:', chainhook.uuid);
    console.log('   Status:', chainhook.enabled ? 'Enabled' : 'Disabled');
    console.log('\n📊 Next steps:');
    console.log('   1. Verify the webhook is receiving events');
    console.log('   2. Monitor logs at: https://platform.hiro.so');
    console.log('   3. Test with a transaction on mainnet');

  } catch (error) {
    console.error('❌ Failed to register chainhook:', error);
    process.exit(1);
  }
}

registerChainhook();
