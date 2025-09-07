// Megapot Contract Configuration
export const CONTRACT_ADDRESS = '0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95'; // Megapot Jackpot Contract on Base
export const ERC20_TOKEN_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC on Base
export const REFERRER_ADDRESS = process.env.NEXT_PUBLIC_REFERRER_ADDRESS || '0x0000000000000000000000000000000000000000';

// Contract Events
export const CONTRACT_START_BLOCK = 27077440;
export const PURCHASE_TICKET_TOPIC = '0xd72c70202ab87b3549553b1d4ceb2a632c83cb96fa2dfe65c30282862fe11ade';
export const JACKPOT_RUN_TOPIC = '0x3208da215cdfa0c44cf3d81565b27f57d4c505bf1a48e40957e53aaf3ba2aa82';

// Chain Configuration
export const SUPPORTED_CHAIN_IDS = {
  BASE: 8453,
  BASE_SEPOLIA: 84532,
  AVALANCHE: 43114,
  ETHEREUM: 1,
} as const;

// Ticket Configuration
export const TICKET_PRICE_USDC = 1; // $1 per ticket
export const TICKET_PRICE_WEI = BigInt(1 * 10 ** 6); // 1 USDC in wei (6 decimals)

// UI Configuration
export const SYNDICATE_COLORS = {
  primary: '#3B82F6', // Blue
  secondary: '#10B981', // Emerald
  accent: '#8B5CF6', // Purple
  warning: '#F59E0B', // Amber
  error: '#EF4444', // Red
  success: '#10B981', // Emerald
} as const;
