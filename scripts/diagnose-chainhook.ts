import { ChainhooksClient, CHAINHOOKS_BASE_URL } from '@hirosystems/chainhooks-client';

const API_KEY = process.env.CHAINHOOK_API_KEY;

if (!API_KEY) {
  console.error('❌ CHAINHOOK_API_KEY environment variable not set');
  process.exit(1);
}

async function diagnose() {
  try {
    const client = new ChainhooksClient({
      baseUrl: CHAINHOOKS_BASE_URL.mainnet,
      apiKey: API_KEY,
    });

    console.log('🔍 Fetching registered chainhooks...');
    const response = await client.getChainhooks();
    // @ts-ignore - The type definition might be slightly off in the client lib or we are seeing raw response
    const hooks = response.results || response; 

    if (!Array.isArray(hooks) || hooks.length === 0) {
      console.log('⚠️  No chainhooks found.');
      return;
    }

    console.log(`✅ Found ${hooks.length} chainhooks:\n`);

    for (const hook of hooks) {
      const def = hook.definition || hook; // Handle different response structures
      const name = def.name;
      const url = def.action?.url;
      
      console.log(`- Name: ${name}`);
      console.log(`  UUID: ${hook.uuid}`);
      console.log(`  Target URL: ${url}`);
      console.log(`  Status: ${hook.status?.status || 'unknown'} (Enabled: ${hook.status?.enabled})`);
      
      if (url && url.includes('/v1/chainhooks')) {
         console.log('  ❌ ISSUE DETECTED: Target URL points to /v1/chainhooks (should be /api/chainhook)');
      } else if (url && url.includes('/api/chainhook')) {
         console.log('  ✅ Target URL looks correct (/api/chainhook)');
      } else {
         console.log('  ❓ Target URL path is unusual');
      }

      if (hook.status?.status === 'interrupted') {
        console.log('  ⚠️  WARNING: Chainhook is INTERRUPTED (disabled due to failures).');
        console.log('      This is likely due to the 401/404 errors.');
      }
      console.log('');
    }

  } catch (error) {
    console.error('❌ Failed to fetch chainhooks:', error);
  }
}

diagnose();