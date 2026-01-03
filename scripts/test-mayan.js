const fetch = require('node-fetch');

const MAYAN_API = 'https://price-api.mayan.finance/v3';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

async function testMayanQuote() {
  console.log('Testing Mayan Quote (SOL -> USDC)...');
  
  const queryParams = new URLSearchParams({
    amountIn: '1', // 1 SOL
    fromToken: SOL_MINT,
    fromChain: 'solana',
    toToken: USDC_BASE,
    toChain: 'base',
    slippageBps: '100', // 1%
  });

  const url = `${MAYAN_API}/quote?${queryParams.toString()}`;
  console.log('URL:', url);

  try {
    const response = await fetch(url);
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Error:', error);
  }
}

testMayanQuote();