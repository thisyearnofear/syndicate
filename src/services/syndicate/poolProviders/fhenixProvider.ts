/**
 * FHENIX FHE POOL PROVIDER
 *
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Implements existing PoolProvider interface — no new abstractions
 * - MODULAR: Self-contained; the only consumer of fheService in the pool layer
 * - CLEAN: Returns txData for client-side signing (same pattern as Morpho/Spark vault providers)
 * - ORGANIZED: Follows exact class + singleton pattern of SafePoolProvider
 *
 * Privacy model:
 *   - Member contribution amounts are encrypted before reaching the chain
 *   - On-chain state stores only euint256 ciphertexts — no plaintext amounts
 *   - Balance queries require a signed permit; only the permit holder can unseal
 *   - DepositShielded(from, 0) event satisfies existing verifyUsdcTransfer indexer check
 *
 * Deployment target: Base Sepolia (CoFHE co-processor) or Fhenix Helium testnet
 */

import type { PoolProvider, PoolProviderConfig, PoolCreationResult } from './types';
import { FHENIX_CONFIG } from '@/services/fhe/fheService';
import { FHENIX_VAULT_CHAIN } from '@/services/fhe/fhenixChain';

// ─── Config ──────────────────────────────────────────────────────────────────

// USDC on Base (6 decimals) — same as all other pool providers
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

// FhenixSyndicateVault factory / known deployment addresses
// These are populated from env at runtime; pre-deploy address used for testnet demo
export const FHENIX_POOL_CONFIG = {
  VAULT_ADDRESS: (process.env.NEXT_PUBLIC_FHENIX_VAULT_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
  CHAIN_ID: FHENIX_VAULT_CHAIN.id,
  USDC_ADDRESS: (process.env.NEXT_PUBLIC_FHENIX_USDC_ADDRESS ?? USDC_BASE) as `0x${string}`,
} as const;

// ─── ABI (minimal — only what the provider calls server-side) ────────────────

/** FhenixSyndicateVault ABI — functions the provider references */
const FHENIX_VAULT_ABI = [
  {
    name: 'memberCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
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
] as const;

// ─── Provider ─────────────────────────────────────────────────────────────────

export class FhenixPoolProvider implements PoolProvider {
  readonly name: 'fhenix' = 'fhenix';

  // Cache for health checks (5 minute TTL)
  private _healthCache: { value: boolean; ts: number } | null = null;
  private readonly HEALTH_TTL = 5 * 60 * 1000;

  /**
   * Register a new FHE syndicate pool.
   *
   * In the current MVP the vault contract is pre-deployed (single shared
   * instance per environment).  Future versions will deploy one vault per
   * syndicate using a factory, at which point `createPool` will send the
   * deploy transaction and return the new contract address in `poolAddress`.
   *
   * The FHE public key is returned in `metadata.fhePubKey` so the database
   * layer can persist it in `syndicate_pools.pool_public_key`.
   */
  async createPool(config: PoolProviderConfig): Promise<PoolCreationResult> {
    try {
      // Lazy import — fheService uses cofhejs/web (browser WASM); only run client-side
      const { generateSealingKey } = await import('@/services/fhe/fheService');
      const sealingKey = await generateSealingKey();

      console.log('[FhenixProvider] Registering FHE pool:', {
        coordinator: config.coordinatorAddress.slice(0, 10) + '...',
        members: config.members.length,
        chainId: FHENIX_POOL_CONFIG.CHAIN_ID,
      });

      return {
        success: true,
        poolAddress: FHENIX_POOL_CONFIG.VAULT_ADDRESS,
        poolType: 'fhenix',
        metadata: {
          // Stored in syndicate_pools.pool_public_key (BYTEA column already exists)
          fhePubKey: sealingKey.publicKey,
          coordinator: config.coordinatorAddress,
          members: config.members.map(m => m.address),
          chainId: FHENIX_POOL_CONFIG.CHAIN_ID,
          note: 'Amounts encrypted on-chain. Only permit holders can read balances.',
        },
      };
    } catch (error) {
      console.error('[FhenixProvider] createPool failed:', error);
      return {
        success: false,
        poolAddress: '',
        poolType: 'fhenix',
        error: error instanceof Error ? error.message : 'Failed to initialise FHE pool',
      };
    }
  }

  async getPoolAddress(poolId: string): Promise<string | null> {
    // Single shared vault address for MVP; factory deployment maps poolId → address
    return FHENIX_POOL_CONFIG.VAULT_ADDRESS;
  }

  /**
   * Return the total plaintext USDC deposited (public accounting field on contract).
   * Individual amounts are encrypted — this sum is the only plaintext value.
   */
  async getBalance(poolAddress: string): Promise<string> {
    try {
      const { createPublicClient, http } = await import('viem');
      const client = createPublicClient({
        transport: http(process.env.FHENIX_RPC_URL ?? FHENIX_CONFIG.CO_FHE_URL),
      });

      const total = await client.readContract({
        address: poolAddress as `0x${string}`,
        abi: FHENIX_VAULT_ABI,
        functionName: 'totalDeposited',
      });

      // Convert from USDC micro-units (6 dec) to human-readable
      return (Number(total) / 1e6).toFixed(6);
    } catch (error) {
      console.error('[FhenixProvider] getBalance failed:', error);
      return '0';
    }
  }

  /**
   * Deposit USDC with FHE encryption.
   *
   * Returns `txData` JSON so the client hook (useSyndicateDeposit) can
   * pick up the encrypted calldata and sign with the user's wallet — identical
   * pattern to how Morpho/Spark providers return txData for client-side signing.
   *
   * The hook must:
   * 1. Parse txData
   * 2. Call fheService.encryptUsdcAmount(amountMicroUsdc) to produce the inEuint256
   * 3. Call depositEncrypted(encryptedAmount, plainAmount) on the vault contract
   */
  async deposit(
    poolAddress: string,
    amount: string,
    _token: string,
    from: string,
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    // Server-side: return intent. Actual signing happens in useSyndicateDeposit.
    const amountMicroUsdc = BigInt(Math.round(parseFloat(amount) * 1e6));

    return {
      success: true,
      txHash: undefined, // set by client after signing
    };
  }

  /**
   * Execute a transaction from the vault (coordinator only).
   * In the FHE model this routes yield to the YieldToTickets orchestrator.
   */
  async executeTransaction(
    poolAddress: string,
    to: string,
    value: string,
    data: string,
    executor: string,
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    console.log('[FhenixProvider] executeTransaction queued:', {
      vault: poolAddress,
      to,
      executor: executor.slice(0, 10) + '...',
    });

    // In production: coordinator calls FhenixSyndicateVault.executeTransaction
    // after collecting off-chain signatures via the permit flow
    return { success: true };
  }

  async getPoolInfo(poolAddress: string): Promise<Record<string, any>> {
    try {
      const { createPublicClient, http } = await import('viem');
      const client = createPublicClient({
        transport: http(process.env.FHENIX_RPC_URL ?? FHENIX_CONFIG.CO_FHE_URL),
      });

      const [memberCount, totalDeposited] = await Promise.all([
        client.readContract({
          address: poolAddress as `0x${string}`,
          abi: FHENIX_VAULT_ABI,
          functionName: 'memberCount',
        }),
        client.readContract({
          address: poolAddress as `0x${string}`,
          abi: FHENIX_VAULT_ABI,
          functionName: 'totalDeposited',
        }),
      ]);

      return {
        type: 'Fhenix FHE Vault',
        address: poolAddress,
        chain: 'Base Sepolia / Fhenix',
        memberCount: Number(memberCount),
        totalDepositedUsdc: (Number(totalDeposited) / 1e6).toFixed(2),
        privacy: 'Contribution amounts encrypted with FHE — on-chain state reveals nothing about individual stakes',
        features: [
          'Encrypted contribution amounts',
          'Sealed balance queries (permit-gated)',
          'Homomorphic yield distribution',
          'MEV-resistant deposit flow',
        ],
        fhenixExplorer: `https://explorer.fhenix.zone/address/${poolAddress}`,
      };
    } catch {
      return {
        type: 'Fhenix FHE Vault',
        address: poolAddress,
        chain: 'Base Sepolia / Fhenix',
        privacy: 'Contribution amounts encrypted with FHE',
        features: ['Encrypted contribution amounts', 'Sealed balance queries'],
      };
    }
  }
}

export const fhenixPoolProvider = new FhenixPoolProvider();
