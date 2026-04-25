/**
 * FHE SERVICE — SINGLE SOURCE OF TRUTH FOR FHENIX OPERATIONS
 *
 * Core Principles Applied:
 * - DRY: Only file that imports from cofhejs — all other layers call this service
 * - MODULAR: Pure functions, no side effects, independently testable
 * - CLEAN: Explicit error handling via Result type; callers decide how to surface errors
 *
 * Wraps cofhejs (v0.3.1) for use in both browser (cofhejs/web) and server (cofhejs/node) contexts.
 * Browser usage: encrypt inputs, create permits, unseal balances.
 * Server usage: verify deposit events, read encrypted state via node RPC.
 */

import {
  cofhejs,
  Encryptable,
  FheTypes,
  GenerateSealingKey,
  Permit,
  type Permission,
  type Result,
  type CoFheInUint256,
  type AbstractSigner,
  type AbstractProvider,
  type Environment,
} from 'cofhejs/web';

// ─── Config ──────────────────────────────────────────────────────────────────

export const FHENIX_CONFIG = {
  /** Fhenix Helium testnet chain ID */
  CHAIN_ID: parseInt(process.env.NEXT_PUBLIC_FHENIX_CHAIN_ID ?? '8008135', 10),
  /** CoFHE service URL — defaults to public testnet endpoint */
  CO_FHE_URL: process.env.FHENIX_CO_FHE_URL ?? 'https://cofhe-testnet.fhenix.zone',
  /** Threshold network for ZK verification */
  THRESHOLD_NETWORK_URL: process.env.FHENIX_THRESHOLD_URL ?? 'https://tn-testnet.fhenix.zone',
  /** Environment: TESTNET for Helium, MAINNET for production */
  ENVIRONMENT: (process.env.FHENIX_ENVIRONMENT ?? 'TESTNET') as Environment,
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

/** Encrypted uint256 input ready for on-chain submission */
export type EncryptedUint256Input = CoFheInUint256;

/** Serialised permission struct passed to Solidity `Permissioned.sol` */
export type FhePermission = Permission;

/** Result wrapper — success/error discriminated union from cofhejs */
export type FheResult<T> = Result<T>;

// ─── Initialisation ───────────────────────────────────────────────────────────

/**
 * Initialise the Fhenix SDK for browser use.
 * Must be called once (e.g., in a React context or hook) before encrypt/permit calls.
 * Idempotent — safe to call multiple times; cofhejs guards internally.
 *
 * @param viemClient  - A viem public client connected to the Fhenix chain
 * @param viemWalletClient - Optional viem wallet client; when provided, a permit is auto-generated
 */
export async function initializeFhe(
  viemClient: unknown,
  viemWalletClient?: unknown,
): Promise<FheResult<Permit | undefined>> {
  return cofhejs.initializeWithViem({
    viemClient,
    viemWalletClient,
    environment: FHENIX_CONFIG.ENVIRONMENT,
    coFheUrl: FHENIX_CONFIG.CO_FHE_URL,
    thresholdNetworkUrl: FHENIX_CONFIG.THRESHOLD_NETWORK_URL,
    generatePermit: !!viemWalletClient,
  });
}

// ─── Encryption ───────────────────────────────────────────────────────────────

/**
 * Encrypt a USDC amount (6 decimal integer) for submission to a FHE contract.
 *
 * Produces a `CoFheInUint256` — the struct Solidity expects as `inEuint256`.
 * USDC amounts fit comfortably in euint64 but we use euint256 to match the
 * FhenixSyndicateVault contract's storage type (forward-compatible with large pools).
 *
 * @param amountMicroUsdc - Amount in USDC micro-units (e.g., 1_000_000 = 1 USDC)
 */
export async function encryptUsdcAmount(
  amountMicroUsdc: bigint,
): Promise<FheResult<[EncryptedUint256Input]>> {
  return cofhejs.encrypt([Encryptable.uint256(amountMicroUsdc)]);
}

// ─── Permits ─────────────────────────────────────────────────────────────────

/**
 * Create (or retrieve cached) a self-permit for the connected user.
 * The permit authorises the SDK to receive re-encrypted outputs from `contractAddress`.
 *
 * @param userAddress   - The user's EVM address (issuer)
 * @param contractAddress - The FhenixSyndicateVault or FhenixVault contract address
 */
export async function createPermit(
  userAddress: string,
  contractAddress: string,
): Promise<FheResult<Permit>> {
  return cofhejs.createPermit({
    type: 'self',
    issuer: userAddress,
    validatorContract: contractAddress,
    validatorId: 0,
  });
}

/**
 * Extract the on-chain `Permission` struct from the active permit.
 * This is what Solidity's `Permissioned.sol` receives as a function argument.
 */
export function getPermission(permitHash?: string): FheResult<FhePermission> {
  return cofhejs.getPermission(permitHash);
}

// ─── Unsealing ────────────────────────────────────────────────────────────────

/**
 * Unseal an encrypted uint256 returned by a FHE contract's `sealOutput` call.
 *
 * The contract re-encrypts the value with the user's sealing public key
 * so only the permit holder can read the plaintext.
 *
 * @param ctHash  - Ciphertext hash (bigint) returned from the contract call
 * @returns Plaintext bigint (USDC micro-units when used for balances)
 */
export async function unsealBalance(
  ctHash: bigint,
): Promise<FheResult<bigint>> {
  return cofhejs.unseal(ctHash, FheTypes.Uint256) as Promise<FheResult<bigint>>;
}

// ─── Sealing Keys (off-chain) ─────────────────────────────────────────────────

/**
 * Generate a fresh NaCl sealing key pair.
 * Used to create the public key stored in `syndicate_pools.pool_public_key`.
 * The private key is held only by the coordinator — never stored on-chain.
 */
export async function generateSealingKey() {
  return GenerateSealingKey();
}

// ─── Store Accessors ──────────────────────────────────────────────────────────

/**
 * Returns true if the SDK has been initialised with both a provider and signer.
 * Useful for gating UI actions that require FHE capability.
 */
export function isFheReady(): boolean {
  const state = cofhejs.store.getState();
  return state.providerInitialized && state.signerInitialized && state.fheKeysInitialized;
}

/**
 * Returns the active permit if one exists, otherwise null.
 * Use to check whether the user needs to sign a new permit.
 */
export function getActivePermit(): Permit | null {
  const result = cofhejs.getPermit();
  return result.success ? result.data : null;
}
