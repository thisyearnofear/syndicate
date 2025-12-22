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

import { ChainhooksClient, CHAINHOOKS_BASE_URL } from '@hirosystems/chainhooks-client';

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
      baseUrl: CHAINHOOKS_BASE_URL.mainnet,
      apiKey: API_KEY,
    });

    console.log('📝 Registering Chainhook 2.0...');
    console.log(`   Webhook URL: ${WEBHOOK_URL}`);
    console.log(`   Network: mainnet`);

    const chainhook = await client.registerChainhook({
      name: 'stacks-lottery-bridge-v2',
      chain: 'stacks',
      network: 'mainnet',
      version: '1',
      filters: {
        events: [
          {
            type: 'contract_log',
            contract_identifier: 'SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3',
          },
        ],
      },
      action: {
        type: 'http_post',
        url: WEBHOOK_URL,
      },
      options: {
        enable_on_registration: true,
      },
    });

    console.log('✅ Chainhook registered successfully!');
    console.log('   UUID:', chainhook.uuid);
    console.log('   Status:', JSON.stringify(chainhook.status, null, 2));

    // Get the consumer secret
    const secretResponse = await client.getConsumerSecret();
    if (secretResponse.secret) {
      console.log('\n🔐 Consumer Secret:');
      console.log('   Value:', secretResponse.secret.substring(0, 20) + '...');
      console.log('   Use in Authorization header: Bearer ' + secretResponse.secret);
      console.log('\n💾 Add to .env.local:');
      console.log(`   CHAINHOOK_SECRET_TOKEN=${secretResponse.secret}`);
    }

    console.log('\n📊 Next steps:');
    console.log('   1. Add CHAINHOOK_SECRET_TOKEN to your .env.local');
    console.log('   2. Deploy your app to update the webhook handler');
    console.log('   3. Verify the webhook is receiving events in logs');
    console.log('   4. Monitor on https://platform.hiro.so');
    console.log('   5. Trigger a test transaction on Stacks mainnet');

  } catch (error) {
    console.error('❌ Failed to register chainhook:', error);
    process.exit(1);
  }
}

registerChainhook();
