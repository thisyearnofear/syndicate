/**
 * STACKS SETTLEMENT KEEPER — CONFIG
 *
 * Server-side configuration for completing Stacks→Base Megapot purchases
 * without the user's browser or an EVM wallet. Testnet-first (Base Sepolia),
 * following the Season of Tickets precedent.
 *
 * ── Why a keeper exists ─────────────────────────────────────────────────────
 * USDCx peg-out (Circle xReserve) settles native USDC on ETHEREUM, not Base.
 * The user signed the Clarity contract call; after the chainhook records the
 * event nothing server-side used to happen. This keeper owns the remaining
 * legs so a purchase can complete with no user involvement.
 *
 * ── Custody model ───────────────────────────────────────────────────────────
 * The bridge-address principal on Stacks (set by the contract owner) holds the
 * pegged-out USDC. The keeper pays gas and fronts the purchase from its own
 * EVM float; treasury ops top up the keeper (testnet: faucet/minted MPUSDC).
 * Funds held by the bridge-address principal are reconciled separately — the
 * keeper NEVER custodies user funds beyond the transient CCTP mint recipient.
 *
 * ── Address provenance ──────────────────────────────────────────────────────
 * CCTP V1 addresses verified against Circle docs
 * (developers.circle.com/cctp/v1/evm-smart-contracts) on 2026-09-21.
 * NOTE: the repo previously used 0x1682…8962 as the Base MessageTransmitter;
 * that address is the Base TokenMessenger. The correct MessageTransmitters
 * are 0xAD09…F9D4 (Base mainnet) and 0x7865…BEFD (Base Sepolia / ETH Sepolia).
 */

import { isAddress } from 'viem';
import { CHAIN_IDS, getMegapotAddressForChain } from '@/config/index';
import { TOKENS } from '@/config/contracts';

// ---------------------------------------------------------------------------
// Environment gates (fail closed)
// ---------------------------------------------------------------------------

export function isStacksKeeperEnabled(): boolean {
  return process.env.STACKS_KEEPER_ENABLED === 'true';
}

/**
 * Keeper key resolution: STACKS_KEEPER_PRIVATE_KEY wins, falling back to the
 * documented STACKS_BRIDGE_OPERATOR_KEY (used for the Season testnet proof).
 * Returns null (never throws) when unset or malformed — callers fail closed.
 */
export function getStacksKeeperPrivateKey(): string | null {
  const raw =
    process.env.STACKS_KEEPER_PRIVATE_KEY || process.env.STACKS_BRIDGE_OPERATOR_KEY || '';
  return /^0x[0-9a-fA-F]{64}$/.test(raw) ? raw : null;
}

/** Purchase-leg chain: 84532 (Base Sepolia, default) or 8453 (Base mainnet). */
export function getStacksKeeperChainId(): number {
  const raw = Number(process.env.STACKS_KEEPER_CHAIN_ID ?? CHAIN_IDS.BASE_SEPOLIA);
  return raw === CHAIN_IDS.BASE ? CHAIN_IDS.BASE : CHAIN_IDS.BASE_SEPOLIA;
}

// ---------------------------------------------------------------------------
// CCTP V1 domains + verified addresses
// ---------------------------------------------------------------------------

export const CCTP_DOMAINS = {
  ETHEREUM: 0,
  AVALANCHE: 1,
  OP_MAINNET: 2,
  ARBITRUM: 3,
  BASE: 6,
  POLYGON_POS: 7,
} as const;

/** domain → chainId for the chains this keeper touches. */
export const CCTP_DOMAIN_TO_CHAIN_ID: Record<number, number> = {
  [CCTP_DOMAINS.ETHEREUM]: CHAIN_IDS.ETHEREUM,
  [CCTP_DOMAINS.BASE]: CHAIN_IDS.BASE,
};

export interface CctpChainAddresses {
  tokenMessenger: `0x${string}`;
  messageTransmitter: `0x${string}`;
}

/**
 * CCTP V1 contract addresses by chain id (verified 2026-09-21, see header).
 * Ethereum Sepolia and Base Sepolia share the V1 testnet deployments.
 */
export const CCTP_V1_ADDRESSES: Record<number, CctpChainAddresses> = {
  [CHAIN_IDS.ETHEREUM]: {
    tokenMessenger: '0xBd3fa81B58Ba92a82136038B25aDec7066af3155',
    messageTransmitter: '0x0a992d191DEeC32aFe36203Ad87D7d289a738F81',
  },
  [CHAIN_IDS.SEPOLIA]: {
    tokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
    messageTransmitter: '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
  },
  [CHAIN_IDS.BASE]: {
    tokenMessenger: '0x1682Ae6375C4E4A97e4B583BC394c861A46D8962',
    messageTransmitter: '0xAD09780d193884d503182aD4588450C416D6F9D4',
  },
  [CHAIN_IDS.BASE_SEPOLIA]: {
    tokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
    messageTransmitter: '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
  },
};

export function getCctpAddressesForChain(chainId: number): CctpChainAddresses | null {
  return CCTP_V1_ADDRESSES[chainId] ?? null;
}

/**
 * Minimal V1 MessageTransmitter surface used by the keeper.
 * `usedNonces` semantic note: the mapping is indexed by
 * `nonce ^ bytes32(messageSender)`, so a true "already relayed" probe requires
 * the message hash XOR the local transmitter's caller. When the caller is
 * unknown (pre-send), the raw read is a best-effort idempotency hint only —
 * a false negative simply means we may attempt `receiveMessage`, which the
 * contract itself reverts on if the nonce was already used. Never treat a
 * `usedNonces` read as proof of completion; only a receipt does that.
 */
export const MESSAGE_TRANSMITTER_ABI = [
  'function receiveMessage(bytes message, bytes attestation) external',
  'function usedNonces(bytes32) external view returns (bool)',
] as const;

// ---------------------------------------------------------------------------
// Circle attestation APIs
// ---------------------------------------------------------------------------

export const CIRCLE_IRIS_PRODUCTION = 'https://iris-api.circle.com/attestations';
export const CIRCLE_IRIS_SANDBOX = 'https://iris-api-sandbox.circle.com/attestations';

/** Testnet chains use Circle's sandbox Iris deployment. */
export function irisUrlForChain(chainId: number): string {
  return chainId === CHAIN_IDS.BASE || chainId === CHAIN_IDS.ETHEREUM
    ? CIRCLE_IRIS_PRODUCTION
    : CIRCLE_IRIS_SANDBOX;
}

// ---------------------------------------------------------------------------
// Purchase leg (Megapot) — testnet-first, mirrors docs/SEASON.md proof
// ---------------------------------------------------------------------------

/**
 * Token the keeper spends for tickets on the purchase chain:
 * MPUSDC on Base Sepolia (1:1 with $1, minted for tests), native USDC on mainnet.
 * Override with STACKS_KEEPER_PURCHASE_TOKEN if the Megapot deployment changes.
 */
export function getPurchaseTokenForChain(chainId: number): `0x${string}` {
  const override = process.env.STACKS_KEEPER_PURCHASE_TOKEN;
  if (override && isAddress(override)) return override as `0x${string}`;
  return chainId === CHAIN_IDS.BASE
    ? TOKENS.usdc.address
    : TOKENS.mpusdc.address;
}

/** Megapot entrypoint for the keeper's purchase leg on the given chain. */
export function getMegapotForKeeperChain(chainId: number): `0x${string}` {
  return getMegapotAddressForChain(chainId);
}

/**
 * Classic Megapot purchase entry (Base Sepolia proof, docs/SEASON.md §218):
 * purchaseTickets(referrer, amountUsdc, recipient) — 1 token unit per ticket.
 * This is the sepolia/classic generation; the V2 RandomTicketBuyer shape is
 * NOT deployed for the testnet entrypoint.
 */
export const CLASSIC_MEGAPOT_ABI = [
  {
    name: 'purchaseTickets',
    type: 'function',
    inputs: [
      { name: 'referrer', type: 'address' },
      { name: 'amountUsdc', type: 'uint256' },
      { name: 'recipient', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'ticketPrice',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

/** 1 USDC (6 decimals) = 1 ticket across Megapot generations. */
export const USDC_PER_TICKET = 1_000_000n;
