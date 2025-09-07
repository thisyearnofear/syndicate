// Megapot constants based on their documentation
// https://docs.megapot.io/developers/add-jackpot/standalone/example

export const MEGAPOT_CONTRACT_ADDRESS = '0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95'; // Megapot Jackpot Contract
export const ERC20_TOKEN_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC on Base
export const CONTRACT_START_BLOCK = 27077440;
export const PURCHASE_TICKET_TOPIC = '0xd72c70202ab87b3549553b1d4ceb2a632c83cb96fa2dfe65c30282862fe11ade';
export const JACKPOT_RUN_TOPIC = '0x3208da215cdfa0c44cf3d81565b27f57d4c505bf1a48e40957e53aaf3ba2aa82';

// Referral address - change this to your own referral address to earn fees
// This allows you to earn referral fees on each ticket you sell through your interface
export const REFERRER_ADDRESS = process.env.NEXT_PUBLIC_MEGAPOT_REFERRER_ADDRESS || '0x0000000000000000000000000000000000000000';

// Megapot API configuration
export const MEGAPOT_API_BASE_URL = 'https://api.megapot.io/api/v1';
export const MEGAPOT_API_KEY = process.env.NEXT_PUBLIC_MEGAPOT_API_KEY || '';

// Megapot API endpoints
export const MEGAPOT_ENDPOINTS = {
  ACTIVE_JACKPOT: '/jackpot-round-stats/active',
  TICKET_PURCHASES: '/ticket-purchases',
  DAILY_GIVEAWAY_WINNERS: '/giveaways/daily-giveaway-winners',
} as const;

// Ticket price in USDC (6 decimals)
export const TICKET_PRICE_USDC = 1000000; // 1 USDC

// Fee structure (basis points)
export const FEE_BPS = 3000; // 30%
export const REFERRAL_FEE_BPS = 1000; // 10%