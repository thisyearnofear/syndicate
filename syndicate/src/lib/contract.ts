import { createPublicClient, http, formatUnits, parseUnits } from 'viem';
import { base } from 'viem/chains';
import { CONTRACT_ADDRESS, ERC20_TOKEN_ADDRESS } from './constants';

// Create a public client for Base chain
const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://base-mainnet.g.alchemy.com/v2/zXTB8midlluEtdL8Gay5bvz5RI-FfsDH'),
});

// Megapot Contract ABI (minimal required functions)
const MEGAPOT_ABI = [
  'function getCurrentJackpot() external view returns (uint256)',
  'function getTicketPrice() external view returns (uint256)',
  'function getTimeRemaining() external view returns (uint256)',
  'function purchaseTickets(address referrer, uint256 amount, address recipient) external',
  'function getUserInfo(address user) external view returns (uint256 winningsClaimable, uint256 ticketsPurchased)',
  'function claimWinnings() external',
  'function withdrawWinnings() external',
  'function getJackpotOdds() external view returns (uint256)',
  'function getTotalTickets() external view returns (uint256)',
] as const;

// USDC Contract ABI
const ERC20_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
] as const;

/**
 * Get the current jackpot amount in USDC
 */
export async function getJackpotAmount(): Promise<number | undefined> {
  try {
    const result = await publicClient.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: MEGAPOT_ABI,
      functionName: 'getCurrentJackpot',
    });
    
    // Convert from wei to USDC (6 decimals)
    return Number(formatUnits(result, 6));
  } catch (error) {
    console.error('Error fetching jackpot amount:', error);
    return undefined;
  }
}

/**
 * Get the ticket price in USDC
 */
export async function getTicketPrice(): Promise<number | undefined> {
  try {
    const result = await publicClient.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: MEGAPOT_ABI,
      functionName: 'getTicketPrice',
    });
    
    // Convert from wei to USDC (6 decimals)
    return Number(formatUnits(result, 6));
  } catch (error) {
    console.error('Error fetching ticket price:', error);
    return undefined;
  }
}

/**
 * Get time remaining until next draw (in seconds)
 */
export async function getTimeRemaining(): Promise<number | undefined> {
  try {
    const result = await publicClient.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: MEGAPOT_ABI,
      functionName: 'getTimeRemaining',
    });
    
    return Number(result);
  } catch (error) {
    console.error('Error fetching time remaining:', error);
    return undefined;
  }
}

/**
 * Get user's USDC balance
 */
export async function getTokenBalance(userAddress: string): Promise<number | undefined> {
  try {
    const result = await publicClient.readContract({
      address: ERC20_TOKEN_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [userAddress as `0x${string}`],
    });
    
    // Convert from wei to USDC (6 decimals)
    return Number(formatUnits(result, 6));
  } catch (error) {
    console.error('Error fetching token balance:', error);
    return undefined;
  }
}

/**
 * Get user's USDC allowance for the Megapot contract
 */
export async function getTokenAllowance(userAddress: string): Promise<number | undefined> {
  try {
    const result = await publicClient.readContract({
      address: ERC20_TOKEN_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [userAddress as `0x${string}`, CONTRACT_ADDRESS as `0x${string}`],
    });
    
    // Convert from wei to USDC (6 decimals)
    return Number(formatUnits(result, 6));
  } catch (error) {
    console.error('Error fetching token allowance:', error);
    return undefined;
  }
}

/**
 * Get user's info (winnings claimable, tickets purchased)
 */
export async function getUsersInfo(userAddress: string): Promise<{
  winningsClaimable: number;
  ticketsPurchased: number;
} | undefined> {
  try {
    const result = await publicClient.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: MEGAPOT_ABI,
      functionName: 'getUserInfo',
      args: [userAddress as `0x${string}`],
    });
    
    return {
      winningsClaimable: Number(formatUnits(result[0], 6)),
      ticketsPurchased: Number(result[1]),
    };
  } catch (error) {
    console.error('Error fetching user info:', error);
    return undefined;
  }
}

/**
 * Calculate winning odds based on tickets purchased
 */
export function calculateWinningOdds(ticketsPurchased: number, totalTickets: number = 1000000): number {
  if (totalTickets === 0) return 0;
  return (ticketsPurchased / totalTickets) * 100;
}

/**
 * Get jackpot odds (1 in X chance of winning)
 */
export async function getJackpotOdds(): Promise<number | undefined> {
  try {
    const result = await publicClient.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: MEGAPOT_ABI,
      functionName: 'getJackpotOdds',
    });

    return Number(result);
  } catch (error) {
    console.error('Error fetching jackpot odds:', error);
    return undefined;
  }
}

/**
 * Get total tickets in current jackpot
 */
export async function getTotalTickets(): Promise<number | undefined> {
  try {
    const result = await publicClient.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: MEGAPOT_ABI,
      functionName: 'getTotalTickets',
    });

    return Number(result);
  } catch (error) {
    console.error('Error fetching total tickets:', error);
    return undefined;
  }
}

/**
 * Get last jackpot results from events
 */
export async function getLastJackpotResults(): Promise<{
  time: number;
  winner: string;
  winningTicket: number;
  winAmount: number;
  ticketsPurchasedTotalBps: number;
} | undefined> {
  try {
    // This would typically fetch from an API route that queries BaseScan
    // For now, return mock data
    return {
      time: Date.now() - 86400000, // 24 hours ago
      winner: '0x1234567890123456789012345678901234567890',
      winningTicket: 12345,
      winAmount: 50000 * 10**6, // $50,000 in USDC wei
      ticketsPurchasedTotalBps: 10000,
    };
  } catch (error) {
    console.error('Error fetching last jackpot results:', error);
    return undefined;
  }
}

/**
 * Format time remaining into human readable format
 */
export function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return '00:00:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}
