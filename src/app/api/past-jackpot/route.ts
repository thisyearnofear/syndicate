import { CONTRACT_ADDRESS, CONTRACT_START_BLOCK, JACKPOT_RUN_TOPIC } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // For now, we'll use a mock response since we don't have BaseScan API key
    // In production, you would uncomment the actual API call below
    
    /*
    const urlParams = new URLSearchParams({
      module: 'logs',
      action: 'getLogs',
      address: CONTRACT_ADDRESS,
      topic0: JACKPOT_RUN_TOPIC,
      apikey: process.env.BASESCAN_API_KEY || '',
      fromBlock: CONTRACT_START_BLOCK.toString(),
    });

    const response = await fetch(
      `https://api.basescan.org/api?${urlParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();
    // reverse the data to get most recent first
    const reversedData = data.result.reverse();

    return NextResponse.json(reversedData);
    */

    // Mock data for development
    const mockJackpotResults = [
      {
        timeStamp: Math.floor((Date.now() - 86400000) / 1000).toString(16), // 24 hours ago
        data: '0x' + [
          '0000000000000000000000001234567890123456789012345678901234567890', // winner
          '0000000000000000000000000000000000000000000000000000000000003039', // winning ticket (12345)
          '00000000000000000000000000000000000000000000000000000002faf080', // win amount (50M wei = $50)
          '0000000000000000000000000000000000000000000000000000000000002710', // tickets purchased (10000)
        ].join(''),
        topics: [
          JACKPOT_RUN_TOPIC,
        ],
      },
      {
        timeStamp: Math.floor((Date.now() - 172800000) / 1000).toString(16), // 48 hours ago
        data: '0x' + [
          '0000000000000000000000000000000000000000000000000000000000000000', // zero address (LPs won)
          '0000000000000000000000000000000000000000000000000000000000001a85', // winning ticket (6789)
          '00000000000000000000000000000000000000000000000000000001c9c380', // win amount (30M wei = $30)
          '0000000000000000000000000000000000000000000000000000000000001388', // tickets purchased (5000)
        ].join(''),
        topics: [
          JACKPOT_RUN_TOPIC,
        ],
      },
    ];

    return NextResponse.json(mockJackpotResults);
  } catch (error) {
    console.error('Error fetching past jackpot results:', error);
    return NextResponse.json(
      { message: 'Error fetching data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Handle POST requests the same way for compatibility
  return GET(request);
}
