import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { JsonRpcProvider } from '@near-js/providers';

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC || '/api/solana-rpc';
const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const NEAR_RPC_URL = process.env.NEXT_PUBLIC_NEAR_RPC_URL || 'https://rpc.mainnet.near.org';
const STACKS_API_BASE_URL = process.env.NEXT_PUBLIC_STACKS_API_URL || 'https://api.mainnet.hiro.so';
const STACKS_API_KEY = process.env.NEXT_PUBLIC_STACKS_API_KEY;

// USDC contract addresses
const SOLANA_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const BASE_USDC_ADDRESS = process.env.NEXT_PUBLIC_BASE_USDC_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const NEAR_USDC_ID = '17208628f84f5d6ad33f0558bac3802d3bbdd174726366e1.factory.bridge.near';

/**
 * Internal function to handle balance fetching
 */
async function handleBalanceRequest(address: string, chainId?: number, rpcUrl?: string) {
  if (!address) {
    return NextResponse.json(
      { error: 'Missing address parameter' },
      { status: 400 }
    );
  }
// Detect wallet type from address format
const isEvmAddress = /^0x[a-fA-F0-9]{40}$/.test(address);
const isSolanaAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address); // More flexible Solana address detection
const isNearAddress = address.endsWith('.near') || /^[0-9a-f]{64}$/.test(address);
const isStarknetAddress = /^0x[a-fA-F0-9]{50,66}$/.test(address); // Starknet addresses are longer than EVM
const isStacksAddress = /^(SP|ST)[0-9A-Z]{25,45}$/.test(address);

if (!isEvmAddress && !isSolanaAddress && !isNearAddress && !isStarknetAddress && !isStacksAddress) {
  return NextResponse.json(
    { error: 'Invalid address format - must be EVM (0x...), Solana, NEAR, Starknet, or Stacks address' },
    { status: 400 }
  );
}

// Route based on address type
if (isSolanaAddress) {
  return await getSolanaBalance(address, rpcUrl);
} else if (isNearAddress && !isEvmAddress) {
  return await getNearBalance(address);
} else if (isStacksAddress) {
   return await getStacksBalance(address);
} else if (isStarknetAddress && !isEvmAddress) {
    // Starknet balance currently returns 0 placeholder as it's handled via bridge estimation
    return NextResponse.json({
      usdc: '0',
      balance: '0',
      wallet: address,
      chain: 'starknet'
    });
  } else {
    // For EVM, use provided chainId or default to Base
    const targetChainId = chainId || 8453;
    return await getEvmBalance(address, targetChainId);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const chainId = searchParams.get('chainId') ? parseInt(searchParams.get('chainId')!) : undefined;
    
    // Resolve absolute URL for relative RPC paths
    let rpcUrl = SOLANA_RPC_URL;
    if (rpcUrl.startsWith('/')) {
      const url = new URL(request.url);
      rpcUrl = `${url.origin}${rpcUrl}`;
    }

    return handleBalanceRequest(address || '', chainId, rpcUrl);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Balance API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balance', details: msg },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, chainId } = body;
    
    // Resolve absolute URL for relative RPC paths
    let rpcUrl = SOLANA_RPC_URL;
    if (rpcUrl.startsWith('/')) {
      const url = new URL(request.url);
      rpcUrl = `${url.origin}${rpcUrl}`;
    }

    return handleBalanceRequest(address, chainId, rpcUrl);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Balance API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balance', details: msg },
      { status: 500 }
    );
  }
}

async function getSolanaBalance(walletAddress: string, rpcOverride?: string): Promise<NextResponse> {
  try {
    const rpcUrl = rpcOverride || SOLANA_RPC_URL;
    // Fetch token accounts for the wallet
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [
          walletAddress,
          { mint: SOLANA_USDC_MINT },
          { encoding: 'jsonParsed' }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Solana RPC error: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      console.error('Solana RPC error:', data.error);
      return NextResponse.json(
        { solana: '0', base: '0', total: '0' },
        { status: 200 }
      );
    }

    // Extract USDC balance from token accounts
    let usdcBalance = '0';
    if (data.result?.value && data.result.value.length > 0) {
      const tokenAccount = data.result.value[0];
      const amount = tokenAccount.account?.data?.parsed?.info?.tokenAmount?.uiAmount;
      usdcBalance = amount ? amount.toString() : '0';
    }

    // Also try to get Base balance if we have an Ethereum wallet connected
    // For now, return Solana balance only
    return NextResponse.json({
      solana: usdcBalance,
      base: '0',
      total: usdcBalance,
      wallet: walletAddress,
      chain: 'solana'
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Failed to fetch Solana balance:', error);
    return NextResponse.json(
      { solana: '0', base: '0', total: '0', error: msg },
      { status: 200 }
    );
  }
}

async function getEvmBalance(walletAddress: string, chainId: number): Promise<NextResponse> {
  try {
    // Determine RPC URL based on chain
    let rpcUrl = BASE_RPC_URL;
    let usdcAddress = BASE_USDC_ADDRESS;

    if (chainId === 1) {
      rpcUrl = 'https://eth.llamarpc.com';
      usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // Ethereum USDC
    } else if (chainId === 42161) {
      rpcUrl = 'https://arb1.arbitrum.io/rpc';
      usdcAddress = '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5F8f'; // Arbitrum USDC
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const usdcAbi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];
    const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, provider);

    const balance = await usdcContract.balanceOf(walletAddress);
    const decimals = await usdcContract.decimals();
    const usdcBalance = ethers.formatUnits(balance, decimals);

    return NextResponse.json({
      usdc: usdcBalance,
      balance: usdcBalance,
      wallet: walletAddress,
      chain: chainId === 8453 ? 'base' : chainId === 1 ? 'ethereum' : 'unknown',
      chainId
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Failed to fetch EVM balance:', error);
    return NextResponse.json(
      { usdc: '0', balance: '0', error: msg },
      { status: 200 }
    );
  }
}

async function getStacksBalance(address: string): Promise<NextResponse> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (STACKS_API_KEY) {
      headers['x-hiro-api-key'] = STACKS_API_KEY;
    }

    const response = await fetch(
      `${STACKS_API_BASE_URL}/extended/v1/address/${address}/balances`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Stacks API error: ${response.status}`);
    }

    const data = await response.json();
    const fungibleTokens = data.fungible_tokens || {};

    // USDCx (6 decimals)
    const usdcxKey = Object.keys(fungibleTokens).find(key =>
      key.startsWith('SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx')
    );
    const usdcxRaw = usdcxKey ? fungibleTokens[usdcxKey]?.balance || '0' : '0';
    const usdcx = (parseFloat(usdcxRaw) / Math.pow(10, 6)).toString();

    // sBTC (8 decimals)
    const sbtcKey = Object.keys(fungibleTokens).find(key =>
      key.startsWith('SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token')
    );
    const sbtcRaw = sbtcKey ? fungibleTokens[sbtcKey]?.balance || '0' : '0';
    const sbtc = (parseFloat(sbtcRaw) / Math.pow(10, 8)).toString();

    return NextResponse.json({
      usdcx,
      sbtc,
      balance: usdcx,
      wallet: address,
      chain: 'stacks'
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Failed to fetch Stacks balance:', error);
    return NextResponse.json(
      { usdcx: '0', sbtc: '0', balance: '0', error: msg },
      { status: 200 }
    );
  }
}

async function getNearBalance(accountId: string): Promise<NextResponse> {
  try {
    const provider = new JsonRpcProvider({ url: NEAR_RPC_URL });
    
    // Get native NEAR balance
    // Note: We handle type any here because near-api-js types can be tricky in Next.js edge/server environment
    const account = await provider.query<any>({
      request_type: 'view_account',
      finality: 'final',
      account_id: accountId,
    });
    const nearBalance = ethers.formatUnits(account.amount, 24); // NEAR has 24 decimals

    // Get USDC balance (view call)
    let usdcBalance = '0';
    try {
      const res = await provider.query<any>({
        request_type: 'call_function',
        account_id: NEAR_USDC_ID,
        method_name: 'ft_balance_of',
        args_base64: Buffer.from(JSON.stringify({ account_id: accountId })).toString('base64'),
        finality: 'final',
      });
      // Result is an array of bytes (ASCII digits string for balance)
      const resultBuffer = Buffer.from(res.result);
      const resultStr = resultBuffer.toString();
      // ft_balance_of returns a string (wrapped in quotes in JSON usually, but here it's raw bytes of the JSON string)
      // Actually, near view call returns JSON-serialized result as bytes.
      // If it returns "1000", bytes are [34, 49, 48, 48, 48, 34]
      const parsed = JSON.parse(resultStr); 
      usdcBalance = ethers.formatUnits(parsed, 6); // USDC has 6 decimals
    } catch (e) {
      console.warn('Failed to fetch NEAR USDC balance:', e);
    }

    return NextResponse.json({
      usdc: usdcBalance,
      balance: usdcBalance,
      native: nearBalance,
      wallet: accountId,
      chain: 'near'
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Failed to fetch NEAR balance:', error);
    return NextResponse.json(
      { usdc: '0', balance: '0', error: msg },
      { status: 200 }
    );
  }
}
