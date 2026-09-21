/**
 * STACKS SETTLEMENT SERVICE — completes Stacks→Base purchases server-side
 *
 * Given a chainhook-recorded purchase (purchase_statuses row in
 * 'confirmed_stacks'), performs the remaining legs so the purchase completes
 * with no user involvement:
 *
 *   Stage A (funds leg, xReserve peg-out):
 *     The Stacks .usdcx-v1 burn settles native USDC on ETHEREUM to the
 *     bridge-address recipient. Settlement evidence comes from the operator's
 *     Ethereum tx hash (CCTP burn step or treasury reconciliation), NOT from
 *     Stacks — a Stacks tx hash can never be used as Base evidence.
 *
 *   Stage B (CCTP relay, optional — only when the funds route through CCTP):
 *     Poll Circle Iris (sandbox for testnets) for the attestation, then call
 *     MessageTransmitter.receiveMessage(message, attestation) on the purchase
 *     chain. Skipped entirely when the keeper's float already holds the token.
 *
 *   Stage C (purchase leg):
 *     Approve the Megapot entrypoint (classic testnet generation) for the
 *     purchase amount, then purchaseTickets(referrer, amount, recipient).
 *     1 USDC = 1 ticket.
 *
 *   Completion:
 *     The Base purchase tx is verified with verifyTicketPurchaseReceipt (the
 *     Season receipt verifier — allowlisted emitters, success status,
 *     recipient attribution) BEFORE the status row is marked 'complete'.
 *     Pending is never persisted as success and no hash is ever fabricated.
 *
 * Client boundary: the repo carries two viem type instances under pnpm, and
 * viem's client generics do not survive module boundaries structurally. The
 * service therefore speaks a minimal loose client interface (method syntax,
 * bivariant) and createKeeperClients adapts real viem clients to it in one
 * contained place. Tests inject mocks through the optional `clients`
 * parameter of settleStacksPurchase.
 *
 * Every step is journaled to agent_run_events (source 'stacks-keeper') by the
 * processor, so a run replays publicly like the xLayer/Season keepers.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  parseUnits,
  toHex,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import {
  CLASSIC_MEGAPOT_ABI,
  MESSAGE_TRANSMITTER_ABI,
  USDC_PER_TICKET,
  getCctpAddressesForChain,
  getMegapotForKeeperChain,
  getPurchaseTokenForChain,
  irisUrlForChain,
} from '@/config/stacksKeeper';
import { verifyTicketPurchaseReceipt } from '@/services/season/megapotReceipts';
import { upsertPurchaseStatus } from '@/lib/db/repositories/purchaseStatusRepository';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Loose client boundary (single viem type context lives in the adapter below)
// ---------------------------------------------------------------------------

export interface LooseWriteArgs {
  address: Address;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  gas?: bigint;
}

export interface LooseReadArgs {
  address: Address;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
}

export interface KeeperWalletClient {
  account: { address: Address };
  writeContract(args: LooseWriteArgs): Promise<Hex>;
}

export interface KeeperPublicClient {
  readContract(args: LooseReadArgs): Promise<unknown>;
  waitForTransactionReceipt(args: { hash: Hex }): Promise<{ status: string }>;
}

export interface KeeperClients {
  walletClient: KeeperWalletClient;
  publicClient: KeeperPublicClient;
}

function chainConfig(chainId: number): { chain: typeof base | typeof baseSepolia; rpc: string } {
  return chainId === base.id
    ? { chain: base, rpc: process.env.BASE_RPC_URL || 'https://mainnet.base.org' }
    : { chain: baseSepolia, rpc: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org' };
}

/**
 * Build the keeper's viem clients and adapt them to the loose boundary.
 * The `as never` casts are the only place the two viem type instances meet.
 */
export function createKeeperClients(chainId: number, privateKey: string): KeeperClients {
  const { chain, rpc } = chainConfig(chainId);
  const transport = http(rpc);
  const account = privateKeyToAccount(privateKey as Hex);
  const walletClient = createWalletClient({ account, chain, transport });
  const publicClient = createPublicClient({ chain, transport });

  return {
    walletClient: {
      account: account,
      writeContract: (args) => walletClient.writeContract(args as never),
    },
    publicClient: {
      readContract: (args) =>
        publicClient.readContract(args as never) as Promise<unknown>,
      waitForTransactionReceipt: (args) => publicClient.waitForTransactionReceipt(args),
    },
  };
}

/**
 * Test seam: swap the client factory for mocks. Always reset afterwards
 * (resetKeeperClientsFactory) — a leaked mock would silently disable all
 * on-chain settlement.
 */
let clientsFactory: (chainId: number, privateKey: string) => KeeperClients =
  createKeeperClients;

export function setKeeperClientsFactory(
  factory: (chainId: number, privateKey: string) => KeeperClients,
): void {
  clientsFactory = factory;
}

export function resetKeeperClientsFactory(): void {
  clientsFactory = createKeeperClients;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StackSettlementInput {
  /** purchase_statuses.source_tx_id (normalized Stacks tx id) */
  sourceTxId: string;
  /** EVM address that receives the tickets */
  baseAddress: string;
  ticketCount: number;
  /** Total cost captured by the Clarity contract in token units (6 decimals) */
  amount: bigint;
  /** Stacks SIP-010 principal of the deposited token (usdcx / sbtc / usdc) */
  tokenPrincipal?: string;
  purchaseId?: number;
  /** Operator tx hash evidencing the funds leg (CCTP burn / peg-out settlement) */
  fundsLegTxHash?: string;
  /** CCTP message bytes for stage B (0x-prefixed) */
  cctpMessage?: string;
  /** Attestation for stage B (0x-prefixed). When omitted, polled from Iris. */
  attestation?: string;
}

export interface SettlementStageResult {
  stage: 'funds_leg' | 'cctp_relay' | 'purchase' | 'verify';
  ok: boolean;
  txHash?: string;
  skipped?: boolean;
  error?: string;
}

export interface SettlementResult {
  ok: boolean;
  complete: boolean;
  stages: SettlementStageResult[];
  purchaseTxHash?: string;
  error?: string;
}

export class StacksSettlementError extends Error {
  constructor(
    message: string,
    readonly stage: SettlementStageResult['stage'],
  ) {
    super(message);
    this.name = 'StacksSettlementError';
  }
}

// ---------------------------------------------------------------------------
// Stage B: CCTP relay
// ---------------------------------------------------------------------------

/** Fetch an attestation from Circle Iris. 404 means "not ready yet". */
export async function fetchIrisAttestation(
  chainId: number,
  messageHash: string,
): Promise<{ status: 'pending' | 'complete' | 'error'; attestation?: string; error?: string }> {
  try {
    const res = await fetch(`${irisUrlForChain(chainId)}/${messageHash}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.status === 404) return { status: 'pending' };
    if (!res.ok) return { status: 'error', error: `Iris returned ${res.status}` };
    const data = (await res.json()) as { status?: string; attestation?: string };
    if (data.status === 'complete' && data.attestation) {
      return { status: 'complete', attestation: data.attestation };
    }
    return { status: 'pending' };
  } catch (err) {
    return {
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** keccak256 of CCTP message bytes (accepts 0x-prefixed or bare hex). */
export function cctpMessageHash(message: string): Hex {
  return keccak256(toHex(message.startsWith('0x') ? message.slice(2) : message));
}

export async function relayCctpMessage(
  chainId: number,
  message: string,
  walletClient: KeeperWalletClient,
  attestation?: string,
): Promise<Hex> {
  const addresses = getCctpAddressesForChain(chainId);
  if (!addresses) {
    throw new StacksSettlementError(
      `No verified CCTP V1 addresses for chain ${chainId}`,
      'cctp_relay',
    );
  }

  if (!attestation) {
    const iris = await fetchIrisAttestation(chainId, cctpMessageHash(message));
    if (iris.status !== 'complete' || !iris.attestation) {
      throw new StacksSettlementError(
        `Attestation not ready (${iris.status}${iris.error ? `: ${iris.error}` : ''})`,
        'cctp_relay',
      );
    }
    attestation = iris.attestation;
  }

  return walletClient.writeContract({
    address: addresses.messageTransmitter,
    abi: MESSAGE_TRANSMITTER_ABI,
    functionName: 'receiveMessage',
    args: [message as Hex, attestation as Hex],
    // Gas headroom: receiveMessage mints + emits; small transfers stay well
    // under this ceiling on Base.
    gas: 400_000n,
  });
}

// ---------------------------------------------------------------------------
// Stage C: purchase leg (classic Megapot generation, testnet-proven)
// ---------------------------------------------------------------------------

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const;

/**
 * Approve (if needed) then purchase. Requires the wallet to hold
 * `ticketCount` worth of the purchase token. Throws StacksSettlementError on
 * any on-chain failure — callers journal the failure, never a fake success.
 */
export async function purchaseTicketsForRecipient(
  chainId: number,
  recipient: Address,
  ticketCount: number,
  clients: KeeperClients,
): Promise<Hex> {
  const { walletClient, publicClient } = clients;
  const megapot = getMegapotForKeeperChain(chainId);
  const token = getPurchaseTokenForChain(chainId);
  const amount = BigInt(ticketCount) * USDC_PER_TICKET;

  // Reads before writes: resolve allowance + price BEFORE approving, so a
  // price sanity failure never burns an approval transaction.
  const [allowance, ticketPrice] = (await Promise.all([
    publicClient.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [walletClient.account.address, megapot],
    }),
    publicClient.readContract({
      address: megapot,
      abi: CLASSIC_MEGAPOT_ABI,
      functionName: 'ticketPrice',
    }),
  ])) as [bigint, bigint];

  // Sanity: price must be 1 unit per ticket for the count math to hold.
  if (ticketPrice !== USDC_PER_TICKET) {
    throw new StacksSettlementError(
      `Unexpected on-chain ticket price ${ticketPrice}; refusing to purchase on stale price assumptions`,
      'purchase',
    );
  }

  // Allowance: top up to the exact purchase amount when short.
  if (allowance < amount) {
    const approveHash = await walletClient.writeContract({
      address: token,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [megapot, amount],
    });
    const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
    if (approveReceipt.status !== 'success') {
      throw new StacksSettlementError('USDC approve reverted on-chain', 'purchase');
    }
  }

  // Classic entrypoint — docs/SEASON.md §218 testnet proof shape.
  const referrer = (process.env.STACKS_KEEPER_REFERRER ||
    '0x0000000000000000000000000000000000000000') as Address;

  const purchaseHash = await walletClient.writeContract({
    address: megapot,
    abi: CLASSIC_MEGAPOT_ABI,
    functionName: 'purchaseTickets',
    args: [referrer, amount, recipient],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: purchaseHash });
  if (receipt.status !== 'success') {
    throw new StacksSettlementError('purchaseTickets reverted on-chain', 'purchase');
  }
  return purchaseHash;
}

// ---------------------------------------------------------------------------
// Completion: receipt-verified status flip
// ---------------------------------------------------------------------------

/**
 * Verify the purchase receipt and — only when it attributes tickets to the
 * expected recipient — mark the purchase_statuses row complete with the real
 * Base tx hash.
 */
export async function completeSettlement(
  input: StackSettlementInput,
  chainId: number,
  purchaseTxHash: Hex,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const verification = await verifyTicketPurchaseReceipt({
      chainId,
      txHash: purchaseTxHash,
      expectedBuyer: input.baseAddress as Address,
    });

    if (!verification.ok) {
      // Journal the failure and leave the row incomplete — a later tick can
      // re-verify once RPC flakes clear.
      await upsertPurchaseStatus({
        sourceTxId: input.sourceTxId,
        sourceChain: 'stacks',
        status: 'error',
        error: `settle.rejected: ${verification.reason ?? 'unverified purchase'}`,
        recipientBaseAddress: input.baseAddress,
        purchaseId: input.purchaseId,
      });
      return { ok: false, error: verification.reason };
    }

    await upsertPurchaseStatus({
      sourceTxId: input.sourceTxId,
      sourceChain: 'stacks',
      status: 'complete',
      baseTxId: purchaseTxHash,
      recipientBaseAddress: input.baseAddress,
      purchaseId: input.purchaseId,
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[StacksSettlement] Completion verification threw', {
      sourceTxId: input.sourceTxId,
      message,
    });
    return { ok: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Orchestration: settle one pending purchase
// ---------------------------------------------------------------------------

/**
 * Run the stages the input allows. Idempotent by design: CCTP relay throws on
 * an already-used nonce (surfaced, never counted as progress); double
 * purchase is prevented by the caller claiming the row first.
 *
 * Pass `clients` to inject mock clients (tests); otherwise clients are built
 * from the keeper key.
 *
 * Returns per-stage outcomes; `complete` is true only after receipt
 * verification attributes the purchase to the recipient.
 */
export async function settleStacksPurchase(
  input: StackSettlementInput,
  chainId: number,
  privateKey: string,
  injectedClients?: KeeperClients,
): Promise<SettlementResult> {
  const stages: SettlementStageResult[] = [];
  const clients = injectedClients ?? clientsFactory(chainId, privateKey);
  const { walletClient, publicClient } = clients;
  const token = getPurchaseTokenForChain(chainId);

  try {
    // ── Stage A: funds leg evidence + float check ─────────────────────────
    const float = (await publicClient.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [walletClient.account.address],
    })) as bigint;

    const needed = BigInt(input.ticketCount) * USDC_PER_TICKET;
    const floatOk = float >= needed;
    stages.push({
      stage: 'funds_leg',
      ok: floatOk,
      txHash: input.fundsLegTxHash,
      error: floatOk
        ? undefined
        : `Keeper float ${float} < required ${needed} of ${token} on chain ${chainId}; ` +
          `top up the keeper wallet (testnet: mint MPUSDC / Circle faucet).`,
    });
    if (!floatOk) {
      return {
        ok: false,
        complete: false,
        stages,
        error: stages[stages.length - 1].error,
      };
    }

    // ── Stage B: CCTP relay (skippable) ───────────────────────────────────
    if (input.cctpMessage) {
      try {
        const relayHash = await relayCctpMessage(
          chainId,
          input.cctpMessage,
          walletClient,
          input.attestation,
        );
        const relayReceipt = await publicClient.waitForTransactionReceipt({ hash: relayHash });
        if (relayReceipt.status !== 'success') {
          throw new StacksSettlementError('receiveMessage reverted on-chain', 'cctp_relay');
        }
        stages.push({ stage: 'cctp_relay', ok: true, txHash: relayHash });
      } catch (err) {
        // An "already used nonce"-style revert means someone relayed first —
        // not a failure of this keeper. Surface, and continue only for that
        // case: the float check above already guarantees local funds.
        const message = err instanceof Error ? err.message : String(err);
        stages.push({ stage: 'cctp_relay', ok: false, error: message });
        if (!/already|used/i.test(message)) {
          return { ok: false, complete: false, stages, error: message };
        }
      }
    } else {
      stages.push({ stage: 'cctp_relay', ok: true, skipped: true });
    }

    // ── Stage C: purchase ─────────────────────────────────────────────────
    const purchaseHash = await purchaseTicketsForRecipient(
      chainId,
      input.baseAddress as Address,
      input.ticketCount,
      clients,
    );
    stages.push({ stage: 'purchase', ok: true, txHash: purchaseHash });

    // ── Completion: receipt verification gates the status flip ───────────
    const completion = await completeSettlement(input, chainId, purchaseHash);
    stages.push({
      stage: 'verify',
      ok: completion.ok,
      error: completion.error,
    });

    return {
      ok: completion.ok,
      complete: completion.ok,
      stages,
      purchaseTxHash: purchaseHash,
      error: completion.error,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[StacksSettlement] Settlement failed', {
      sourceTxId: input.sourceTxId,
      message,
    });
    return { ok: false, complete: false, stages, error: message };
  }
}

// ---------------------------------------------------------------------------
// Helpers shared with the x402 path
// ---------------------------------------------------------------------------

/** Ticket count for a USDC amount (6-decimal units). */
export function ticketsForAmount(amount: bigint): number {
  return Number(amount / USDC_PER_TICKET);
}

/** Parse a human USDC amount into 6-decimal units. */
export function parseUsdc(amount: string): bigint {
  return parseUnits(amount, 6);
}
