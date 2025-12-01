import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

// USDC contract addresses
const SOLANA_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const BASE_USDC_ADDRESS = process.env.NEXT_PUBLIC_BASE_USDC_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

/**
 * Internal function to handle balance fetching
 */
async function handleBalanceRequest(address: string, chainId?: number) {
  if (!address) {
    return NextResponse.json(
      { error: 'Missing address parameter' },
      { status: 400 }
    );
  }

  // Detect wallet type from address format
  const isEvmAddress = /^0x[a-fA-F0-9]{40}$/.test(address);
  const isSolanaAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address); // More flexible Solana address detection

  if (!isEvmAddress && !isSolanaAddress) {
    return NextResponse.json(
      { error: 'Invalid address format - must be EVM (0x...) or Solana address' },
      { status: 400 }
    );
  }

  // Route based on address type, ignore chainId for Solana
  if (isSolanaAddress) {
    return await getSolanaBalance(address);
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
    return handleBalanceRequest(address || '', chainId);
  } catch (error: any) {
    console.error('Balance API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balance', details: error?.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, chainId } = body;
    return handleBalanceRequest(address, chainId);
  } catch (error: any) {
    console.error('Balance API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balance', details: error?.message },
      { status: 500 }
    );
  }
}

async function getSolanaBalance(walletAddress: string): Promise<NextResponse> {
  try {
    // Fetch token accounts for the wallet
    const response = await fetch(SOLANA_RPC_URL, {
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
  } catch (error: any) {
    console.error('Failed to fetch Solana balance:', error);
    return NextResponse.json(
      { solana: '0', base: '0', total: '0', error: error?.message },
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
  } catch (error: any) {
    console.error('Failed to fetch EVM balance:', error);
    return NextResponse.json(
      { usdc: '0', balance: '0', error: error?.message },
      { status: 200 }
    );
  }
}
