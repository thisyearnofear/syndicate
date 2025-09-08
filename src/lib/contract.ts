import { formatUnits, erc20Abi } from 'viem';
import { base } from 'viem/chains';
import { CONTRACT_ADDRESS, ERC20_TOKEN_ADDRESS } from './constants';
import { getPublicClient } from './viem-client';
import { BaseJackpotAbi } from './megapot-abi';

/**
 * Get the current jackpot amount in USDC (lpPoolTotal - actual prize pool)
 */
export async function getJackpotAmount(chainId: number = base.id): Promise<number | undefined> {
  try {
    const client = getPublicClient(chainId);
    const result = await client.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: BaseJackpotAbi,
      functionName: 'lpPoolTotal',
    });

    const amount = Number(formatUnits(result as bigint, 6));
    console.log('[DEBUG] Contract lpPoolTotal (USDC):', amount);
    
    // For debugging, also log userPoolTotal for comparison
    const userPoolResult = await client.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: BaseJackpotAbi,
      functionName: 'userPoolTotal',
    });
    const userPoolAmount = Number(formatUnits(userPoolResult as bigint, 6));
    console.log('[DEBUG] Contract userPoolTotal (for comparison):', userPoolAmount);
    
    return amount;
  } catch (error) {
    console.error('Error fetching jackpot amount (lpPoolTotal):', error);
    return undefined;
  }
}

/**
 * Get LP pool total (same as getJackpotAmount - exported for direct access)
 */
export async function getLpPoolTotal(chainId: number = base.id): Promise<number | undefined> {
  return getJackpotAmount(chainId);
}

/**
 * Get the ticket price in USDC
 */
export async function getTicketPrice(chainId: number = base.id): Promise<number | undefined> {
  try {
    const client = getPublicClient(chainId);
    const result = await client.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: BaseJackpotAbi,
      functionName: 'ticketPrice',
    });

    // Convert from wei to USDC (6 decimals)
    return Number(formatUnits(result as bigint, 6));
  } catch (error) {
    console.error('Error fetching ticket price:', error);
    return undefined;
  }
}

/**
 * Get time remaining until next draw (in seconds)
 */
export async function getTimeRemaining(chainId: number = base.id): Promise<number | undefined> {
  try {
    const client = getPublicClient(chainId);
    const result = await client.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: BaseJackpotAbi,
      functionName: 'lastJackpotEndTime',
    });

    // Calculate time remaining from end time
    const endTime = Number(result as bigint);
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, endTime - now);
  } catch (error) {
    console.error('Error fetching time remaining:', error);
    return undefined;
  }
}

/**
 * Get user's USDC balance
 */
export async function getTokenBalance(userAddress: string, chainId: number = base.id): Promise<number | undefined> {
  try {
    const client = getPublicClient(chainId);
    const result = await client.readContract({
      address: ERC20_TOKEN_ADDRESS as `0x${string}`,
      abi: erc20Abi,
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
export async function getTokenAllowance(userAddress: string, chainId: number = base.id): Promise<number | undefined> {
  try {
    const client = getPublicClient(chainId);
    const result = await client.readContract({
      address: ERC20_TOKEN_ADDRESS as `0x${string}`,
      abi: erc20Abi,
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
export async function getUsersInfo(userAddress: string, chainId: number = base.id): Promise<{
  winningsClaimable: number;
  ticketsPurchased: number;
} | undefined> {
  try {
    const client = getPublicClient(chainId);
    const result = await client.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: BaseJackpotAbi,
      functionName: 'usersInfo',
      args: [userAddress as `0x${string}`],
    });

    // The result should be a tuple with [ticketsPurchasedTotalBps, winningsClaimable, active]
    const [ticketsPurchasedTotalBps, winningsClaimable] = result as [bigint, bigint, boolean];

    return {
      winningsClaimable: Number(formatUnits(winningsClaimable, 6)),
      ticketsPurchased: Number(ticketsPurchasedTotalBps) / 10000, // Convert from basis points
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
export async function getJackpotOdds(chainId: number = base.id): Promise<number | undefined> {
  try {
    const client = getPublicClient(chainId);
    // Use ticketCountTotalBps to calculate odds
    const result = await client.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: BaseJackpotAbi,
      functionName: 'ticketCountTotalBps',
    });

    // Convert from basis points to actual ticket count
    const totalTickets = Number(result as bigint) / 10000;
    return totalTickets > 0 ? totalTickets : 1;
  } catch (error) {
    console.error('Error fetching jackpot odds:', error);
    return undefined;
  }
}

/**
 * Get total tickets in current jackpot
 */
export async function getTotalTickets(chainId: number = base.id): Promise<number | undefined> {
  try {
    const client = getPublicClient(chainId);
    const result = await client.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: BaseJackpotAbi,
      functionName: 'ticketCountTotalBps',
    });

    // Convert from basis points to actual ticket count
    return Number(result as bigint) / 10000;
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
