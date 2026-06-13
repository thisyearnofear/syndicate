/**
 * VAULT DEPOSIT/WITHDRAW ROUTER
 *
 * Pure routing table that maps a `VaultProtocol` to the right underlying
 * vault service. Extracted from `useVaultDeposit` so it can be unit-tested
 * without a React tree or wallet client.
 *
 * The router is the "integration" layer between the hook UI and the
 * individual vault services — it encodes protocol-specific knowledge
 * (which addresses map to which protocols, which flows are unsupported,
 * which require a coordinator-signed tx, etc.).
 */

import { MORPHO_CONFIG } from './morphoProvider';
import { SPARK_CONFIG } from './sparkProvider';
import { PRIZE_VAULT } from './poolTogetherProvider';
import { FHENIX_POOL_CONFIG } from '@/services/syndicate/poolProviders/fhenixProvider';
import type { VaultProtocol } from './vaultProvider';

/** USDC on Base. */
export const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

/** Aave V3 Pool on Base. */
export const AAVE_POOL_BASE = '0xA238Dd80F259641441B1517C16c08D1B4BcD6019' as const;

export type DepositRoute =
  | { kind: 'aave_v3'; label: string }
  | { kind: 'erc4626'; vaultAddress: `0x${string}`; label: string }
  | { kind: 'fhenix_encrypted'; label: string; vaultAddress: `0x${string}`; usdcAddress: `0x${string}` }
  | { kind: 'octant_mock'; label: string; vaultId: string }
  | { kind: 'unsupported'; reason: string };

export type WithdrawRoute =
  | { kind: 'aave_v3' }
  | { kind: 'erc4626'; vaultAddress: `0x${string}` }
  | { kind: 'fhenix_attested'; vaultAddress: `0x${string}` }
  | { kind: 'octant_mock'; vaultId: string }
  | { kind: 'unsupported'; reason: string };

/**
 * Pure router: protocol → deposit action.
 * Mirrors the if/else chain in `useVaultDeposit.deposit`.
 */
export function selectDepositRoute(protocol: VaultProtocol): DepositRoute {
  switch (protocol) {
    case 'aave':
      return { kind: 'aave_v3', label: 'Aave V3 (Base)' };
    case 'morpho':
      return {
        kind: 'erc4626',
        vaultAddress: MORPHO_CONFIG.BASE.VAULT_ADDRESS as `0x${string}`,
        label: 'Morpho Blue USDC (Base)',
      };
    case 'spark':
      return {
        kind: 'erc4626',
        vaultAddress: SPARK_CONFIG.BASE.VAULT_ADDRESS as `0x${string}`,
        label: 'Spark sUSDC (Base)',
      };
    case 'pooltogether':
      return {
        kind: 'erc4626',
        vaultAddress: PRIZE_VAULT as `0x${string}`,
        label: 'PoolTogether PrizeVault (Base)',
      };
    case 'fhenix':
      return {
        kind: 'fhenix_encrypted',
        label: 'Fhenix FHE vault',
        vaultAddress: FHENIX_POOL_CONFIG.VAULT_ADDRESS,
        usdcAddress: FHENIX_POOL_CONFIG.USDC_ADDRESS as `0x${string}`,
      };
    case 'octant':
      return { kind: 'octant_mock', label: 'Octant V2 (mock)', vaultId: 'mock:octant-usdc' };
    case 'uniswap':
      return {
        kind: 'unsupported',
        reason: 'Uniswap V3 deposits require position management UI. Coming soon.',
      };
    case 'lifiearn':
      return {
        kind: 'unsupported',
        reason: 'LI.FI Earn requires cross-chain deposit. Use useLifiEarnVaultDeposit hook for Composer execution.',
      };
  }
}

/**
 * Pure router: protocol → withdraw action.
 * Mirrors the if/else chain in `useVaultDeposit.withdraw`.
 */
export function selectWithdrawRoute(protocol: VaultProtocol): WithdrawRoute {
  switch (protocol) {
    case 'aave':
      return { kind: 'aave_v3' };
    case 'morpho':
      return { kind: 'erc4626', vaultAddress: MORPHO_CONFIG.BASE.VAULT_ADDRESS as `0x${string}` };
    case 'spark':
      return { kind: 'erc4626', vaultAddress: SPARK_CONFIG.BASE.VAULT_ADDRESS as `0x${string}` };
    case 'pooltogether':
      return { kind: 'erc4626', vaultAddress: PRIZE_VAULT as `0x${string}` };
    case 'octant':
      return { kind: 'octant_mock', vaultId: 'mock:octant-usdc' };
    case 'fhenix':
      return { kind: 'fhenix_attested', vaultAddress: FHENIX_POOL_CONFIG.VAULT_ADDRESS };
    case 'uniswap':
      return {
        kind: 'unsupported',
        reason: 'Uniswap V3 withdrawals require position management UI. Coming soon.',
      };
    case 'lifiearn':
      return {
        kind: 'unsupported',
        reason: 'LI.FI Earn withdrawals are not yet supported.',
      };
  }
}

/**
 * True if the error message indicates the user cancelled / rejected the
 * wallet signature. Mirrors the substring check in `useVaultDeposit.deposit`.
 */
export function isUserCancellation(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  return lower.includes('cancel') || lower.includes('reject') || lower.includes('denied');
}

/**
 * Map an error to a user-facing message, translating cancellations to
 * "Transaction cancelled" and falling back to the supplied default.
 */
export function mapErrorMessage(
  error: unknown,
  defaultMessage: string,
): string {
  const raw = error instanceof Error ? error.message : defaultMessage;
  return isUserCancellation(error) ? 'Transaction cancelled' : raw;
}
