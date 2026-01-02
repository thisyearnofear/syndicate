/**
 * GELATO WEBHOOK TEST SCRIPT
 * 
 * Tests the Gelato webhook endpoint with signature verification
 * Simulates task execution, failure, and cancellation events
 * 
 * Usage:
 *   npm run test:gelato-webhook
 * 
 * Environment:
 *   Requires GELATO_WEBHOOK_SECRET and local dev server running
 */

import crypto from 'crypto';

// =============================================================================
// CONFIG
// =============================================================================

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/api/gelato/webhook';
const WEBHOOK_SECRET = process.env.GELATO_WEBHOOK_SECRET || 'test-secret-key-12345';

// =============================================================================
// TEST EVENTS
// =============================================================================

const testEvents = [
  {
    name: 'Task Executed',
    event: 'task.executed',
    payload: {
      taskId: 'task_123_executed',
      chainId: 8453,
      executedData: '0xabcd1234',
      transactionHash: '0xdef567890abcdef567890abcdef567890abcdef567890abcdef567890abcd',
      status: 'executed',
      executionTimestamp: Math.floor(Date.now() / 1000),
      amountExecuted: '100000000', // 100 USDC (6 decimals)
      gasUsed: '150000',
      referrer: '0x0000000000000000000000000000000000000000',
    },
  },
  {
    name: 'Task Failed',
    event: 'task.failed',
    payload: {
      taskId: 'task_456_failed',
      chainId: 8453,
      executedData: '0xabcd5678',
      status: 'failed',
      executionTimestamp: Math.floor(Date.now() / 1000),
      error: 'Insufficient balance in relayer account',
    },
  },
  {
    name: 'Task Cancelled',
    event: 'task.cancelled',
    payload: {
      taskId: 'task_789_cancelled',
      chainId: 8453,
      executedData: '0xabcd9999',
      status: 'cancelled',
      executionTimestamp: Math.floor(Date.now() / 1000),
    },
  },
];

// =============================================================================
// HELPERS
// =============================================================================

function createSignature(body: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
}

async function sendWebhook(eventName: string, taskId: string, event: string, payload: any) {
  const webhook = {
    taskId,
    event,
    payload,
    timestamp: Math.floor(Date.now() / 1000),
  };

  const body = JSON.stringify(webhook);
  const signature = createSignature(body, WEBHOOK_SECRET);

  console.log(`\n📤 Testing: ${eventName}`);
  console.log(`   Event: ${event}`);
  console.log(`   TaskId: ${taskId}`);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-gelato-signature': signature,
      },
      body,
    });

    const result = await response.json();

    if (response.ok) {
      console.log(`   ✅ Success (${response.status})`);
      console.log(`   Response:`, result);
    } else {
      console.log(`   ❌ Failed (${response.status})`);
      console.log(`   Error:`, result);
    }
  } catch (error) {
    console.error(`   ❌ Error:`, error);
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('🚀 Gelato Webhook Test Suite');
  console.log(`📍 Endpoint: ${WEBHOOK_URL}`);
  console.log(`🔐 Secret: ${WEBHOOK_SECRET}`);
  console.log('');

  // Give user time to see config
  await new Promise(r => setTimeout(r, 1000));

  // Run tests
  for (const test of testEvents) {
    await sendWebhook(test.name, test.payload.taskId, test.event, test.payload);
    await new Promise(r => setTimeout(r, 500)); // Brief delay between requests
  }

  console.log('\n✨ Test suite complete!');
}

main().catch(console.error);
