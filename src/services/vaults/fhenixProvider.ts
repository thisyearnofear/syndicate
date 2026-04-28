/**
 * FHENIX FHE VAULT PROVIDER
 *
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Implements existing VaultProvider interface — no new abstractions
 * - MODULAR: Isolated Fhenix integration, independently testable
 * - CLEAN: Returns txData JSON for client-side signing (same pattern as Morpho + Spark)
 * - PERFORMANT: Caches APY and health checks with TTL
 *
 * Privacy model:
 *   - Deposits are encrypted client-side via fheService before hitting the chain
 *   - Balance reads require a signed permit; the sealed output is decrypted locally
 *   - Yield is accumulated as an encrypted value and distributed homomorphically
 *
 * APY source: initially hardcoded (Fhenix testnet); production will read from
 * an on-chain rate oracle once Fhenix mainnet launches.
 */

import type {
  VaultProvider,
  VaultProtocol,
  VaultBalance,
  VaultDepositResult,
  VaultWithdrawResult,
} from './vaultProvider';
import { FHENIX_POOL_CONFIG } from '@/services/syndicate/poolProviders/fhenixProvider';

// ─── Config ───────────────────────────────────────────────────────────────────

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

// Estimated testnet APY — replaced by on-chain oracle in production
const FHENIX_ESTIMATED_APY = 5.0;

// ─── Minimal contract ABI ─────────────────────────────────────────────────────

const FHENIX_VAULT_READ_ABI = [
  {
    name: 'totalDeposited',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'isMember',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'memberCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// ─── Provider ─────────────────────────────────────────────────────────────────

export class FhenixVaultProvider implements VaultProvider {
  readonly name: VaultProtocol = 'fhenix';
  readonly chainId: number = FHENIX_POOL_CONFIG.CHAIN_ID;

  private _apyCache: { value: number; ts: number } | null = null;
  private _healthCache: { value: boolean; ts: number } | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000;

  // ─── getBalance ─────────────────────────────────────────────────────────────

  /**
   * Return the user's encrypted balance, unsealed client-side.
   *
   * On the server (API routes / SSR) we cannot call the Fhenix permit flow
   * because it requires a browser signer. We return a best-effort estimate
   * based on publicly available data (totalDeposited / memberCount) until
   * the client calls the sealed variant directly.
   *
   * The hook `useUserVaults` calls this method. When running in the browser
   * the caller should instead use `fheService.unsealBalance` after obtaining
   * a permit.
   */
  async getBalance(userAddress: string): Promise<VaultBalance> {
    try {
      const { createPublicClient, http } = await import('viem');
      const client = createPublicClient({
        transport: http(
          process.env.FHENIX_RPC_URL ??
          `https://api.fhenix.zone`
        ),
      });

      const vaultAddress = FHENIX_POOL_CONFIG.VAULT_ADDRESS;
      if (vaultAddress === '0x0000000000000000000000000000000000000000') {
        // Contract not yet deployed — return zero until env is configured
        return this._zeroBalance();
      }

      const [isMember, totalDeposited, memberCount] = await Promise.all([
        client.readContract({
          address: vaultAddress,
          abi: FHENIX_VAULT_READ_ABI,
          functionName: 'isMember',
          args: [userAddress as `0x${string}`],
        }),
        client.readContract({
          address: vaultAddress,
          abi: FHENIX_VAULT_READ_ABI,
          functionName: 'totalDeposited',
        }),
        client.readContract({
          address: vaultAddress,
          abi: FHENIX_VAULT_READ_ABI,
          functionName: 'memberCount',
        }),
      ]);

      if (!isMember || Number(memberCount) === 0) return this._zeroBalance();

      // Privacy-preserving estimate: assume equal split across members.
      // Client should unseal the exact value using a permit for precision.
      const estimatedDeposit = Number(totalDeposited) / Number(memberCount) / 1e6;
      const apy = await this.getCurrentAPY();
      const yieldAccrued = estimatedDeposit * (apy / 100) * (1 / 365) * 7;

      return {
        deposited: estimatedDeposit.toFixed(6),
        yieldAccrued: yieldAccrued.toFixed(6),
        totalBalance: estimatedDeposit.toFixed(6),
        apy,
        lastUpdated: Date.now(),
      };
    } catch (error) {
      console.error('[FhenixVault] getBalance failed:', error);
      return this._zeroBalance();
    }
  }

  async getYieldAccrued(userAddress: string): Promise<string> {
    const balance = await this.getBalance(userAddress);
    return balance.yieldAccrued;
  }

  // ─── deposit ─────────────────────────────────────────────────────────────────

  /**
   * Build deposit intent for client-side execution.
   *
   * Returns `txData` JSON containing everything the client hook needs to:
   * 1. Encrypt the amount via `fheService.encryptUsdcAmount(amountMicroUsdc)`
   * 2. Approve USDC on the vault address
   * 3. Call `depositEncrypted(inEuint256, plainAmount)` on the vault
   *
   * This mirrors the Morpho/Spark pattern exactly — the hook (`useVaultDeposit`)
   * handles the `else if (protocol === 'fhenix')` branch and executes these steps.
   */
  async deposit(amount: string, userAddress: string): Promise<VaultDepositResult> {
    const amountMicroUsdc = Math.round(parseFloat(amount) * 1e6);

    return {
      success: true,
      txData: JSON.stringify({
        action: 'fhenix_deposit',
        vault: FHENIX_POOL_CONFIG.VAULT_ADDRESS,
        asset: USDC_BASE,
        amount: amountMicroUsdc.toString(),
        receiver: userAddress,
        // Hook reads this to know it must call fheService.encryptUsdcAmount first
        requiresEncryption: true,
      }),
    };
  }

  // ─── withdraw ────────────────────────────────────────────────────────────────

  /**
   * Build withdraw intent for client-side execution.
   *
   * The plain amount is coordinator-attested off-chain (full privacy model).
   * For MVP, the user provides the amount they deposited; production will use
   * a ZK proof of correct decryption from the Fhenix threshold network.
   */
  async withdraw(amount: string, userAddress: string): Promise<VaultWithdrawResult> {
    const amountMicroUsdc = Math.round(parseFloat(amount) * 1e6);

    return {
      success: true,
      txData: JSON.stringify({
        action: 'fhenix_withdraw',
        vault: FHENIX_POOL_CONFIG.VAULT_ADDRESS,
        asset: USDC_BASE,
        amount: amountMicroUsdc.toString(),
        receiver: userAddress,
      }),
      amountWithdrawn: amount,
    };
  }

  /**
   * Yield withdrawal is handled by the coordinator via `depositYield` + distribution.
   * Individual yield-only withdrawals are not yet supported in the FHE model.
   */
  async withdrawYield(userAddress: string): Promise<VaultWithdrawResult> {
    return {
      success: false,
      error: 'Fhenix vault distributes yield via the coordinator. Use withdraw() to claim principal + yield.',
    };
  }

  // ─── health / APY ─────────────────────────────────────────────────────────────

  async isHealthy(): Promise<boolean> {
    if (this._healthCache && Date.now() - this._healthCache.ts < this.CACHE_TTL) {
      return this._healthCache.value;
    }

    try {
      const vaultAddress = FHENIX_POOL_CONFIG.VAULT_ADDRESS;
      // Undeployed → not healthy yet (shows "Coming Soon" in UI)
      if (vaultAddress === '0x0000000000000000000000000000000000000000') {
        this._healthCache = { value: false, ts: Date.now() };
        return false;
      }

      const { createPublicClient, http } = await import('viem');
      const client = createPublicClient({
        transport: http(process.env.FHENIX_RPC_URL ?? 'https://api.fhenix.zone'),
      });

      // Contract responds → healthy
      await client.readContract({
        address: vaultAddress,
        abi: FHENIX_VAULT_READ_ABI,
        functionName: 'totalDeposited',
      });

      this._healthCache = { value: true, ts: Date.now() };
      return true;
    } catch {
      this._healthCache = { value: false, ts: Date.now() };
      return false;
    }
  }

  async getCurrentAPY(): Promise<number> {
    if (this._apyCache && Date.now() - this._apyCache.ts < this.CACHE_TTL) {
      return this._apyCache.value;
    }

    // Production: read from Fhenix on-chain rate oracle
    // Testnet: use estimate (Spark-equivalent yield routed through FHE layer)
    this._apyCache = { value: FHENIX_ESTIMATED_APY, ts: Date.now() };
    return FHENIX_ESTIMATED_APY;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private _zeroBalance(): VaultBalance {
    return {
      deposited: '0',
      yieldAccrued: '0',
      totalBalance: '0',
      apy: 0,
      lastUpdated: Date.now(),
    };
  }
}

export const fhenixVaultProvider = new FhenixVaultProvider();
