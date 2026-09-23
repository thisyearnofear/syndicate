/**
 * OKX X LAYER TICKET RAIL — server-side configuration
 *
 * The x402 pay-per-call rail for OKX.AI agents (docs/OKX_DEV_DAY.md §4):
 * agents pay USD₮0 on X Layer mainnet (eip155:196), the operator buys a real
 * Megapot ticket on Base for the recipient, receipt-verified.
 *
 * Fail-closed: every accessor returns null/defaults when unset and
 * isOkxRailConfigured() is false until ALL credentials exist. Accessors
 * never log or return secret material beyond validation.
 */

import { isAddress, type Address } from 'viem';
import { CHAIN_IDS } from '@/config/index';

export const OKX_RAIL = {
  /** CAIP-2 network the x402 payment settles on (X Layer mainnet). */
  network: 'eip155:196',
  /** Exact-scheme price per call — 1 USD₮0 ↔ 1 USDC ticket, no markup. */
  price: '$1.00',
  ticketsPerCall: 1,
  /** x402 payment validity window advertised to payers. */
  maxTimeoutSeconds: 300,
} as const;

const PRIVATE_KEY_RE = /^0x[0-9a-fA-F]{64}$/;

export function isOkxRailEnabled(): boolean {
  return process.env.OKX_RAIL_ENABLED === 'true';
}

/** Operator EOA that receives USD₮0 on X Layer (x402 payTo). */
export function getOkxRailPayTo(): Address | null {
  const value = process.env.OKX_RAIL_PAY_TO;
  return value && isAddress(value) ? (value as Address) : null;
}

/** Operator key that funds Megapot purchases on the purchase chain. */
export function getOkxRailKeeperPrivateKey(): `0x${string}` | null {
  const value = process.env.OKX_RAIL_KEEPER_PRIVATE_KEY;
  return value && PRIVATE_KEY_RE.test(value) ? (value as `0x${string}`) : null;
}

/** OKX Developer Portal credentials for the facilitator client. */
export function getOkxFacilitatorCredentials(): {
  apiKey: string;
  secretKey: string;
  passphrase: string;
} | null {
  const apiKey = process.env.OKX_API_KEY;
  const secretKey = process.env.OKX_SECRET_KEY;
  const passphrase = process.env.OKX_PASSPHRASE;
  if (!apiKey || !secretKey || !passphrase) return null;
  return { apiKey, secretKey, passphrase };
}

/**
 * Chain the operator buys tickets on. Base mainnet by default; Base Sepolia
 * allowed for dry runs only.
 */
export function getOkxRailPurchaseChainId(): number {
  const raw = Number(process.env.OKX_RAIL_PURCHASE_CHAIN_ID ?? CHAIN_IDS.BASE);
  return raw === CHAIN_IDS.BASE_SEPOLIA ? CHAIN_IDS.BASE_SEPOLIA : CHAIN_IDS.BASE;
}

/**
 * Names of missing/invalid env vars for diagnostics — names only, never
 * values.
 */
export function missingOkxRailConfig(): string[] {
  const missing: string[] = [];
  if (!isOkxRailEnabled()) missing.push('OKX_RAIL_ENABLED');
  if (!getOkxRailPayTo()) missing.push('OKX_RAIL_PAY_TO');
  if (!getOkxRailKeeperPrivateKey()) missing.push('OKX_RAIL_KEEPER_PRIVATE_KEY');
  if (!process.env.OKX_API_KEY) missing.push('OKX_API_KEY');
  if (!process.env.OKX_SECRET_KEY) missing.push('OKX_SECRET_KEY');
  if (!process.env.OKX_PASSPHRASE) missing.push('OKX_PASSPHRASE');
  return missing;
}

export function isOkxRailConfigured(): boolean {
  return missingOkxRailConfig().length === 0;
}
