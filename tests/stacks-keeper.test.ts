/**
 * STACKS SETTLEMENT KEEPER — UNIT TESTS
 *
 * Covers the three layers of the settlement stack with injected mock clients
 * (no network, no chain):
 *
 *   1. stacksSettlementService.settleStacksPurchase — stage machine behavior:
 *      float gate, CCTP relay skip, purchase, receipt-verified completion
 *      (ok → status complete; rejected → settle.rejected, never complete).
 *   2. stacksKeeperProcessor.runStacksKeeper — fail-closed gates (disabled,
 *      bad key), happy path with a claimed row, no requeue on success.
 *   3. stacksX402Service.executeAutoPurchase — limit enforcement and honest
 *      failure when the keeper is disabled.
 *
 * House rules under test: never fabricate a tx hash, never persist pending
 * as success, and fail closed when the key/env gates are absent.
 */

jest.mock('@vercel/postgres', () => ({
  sql: jest.fn(),
}));

jest.mock('@/services/season/megapotReceipts', () => ({
  verifyTicketPurchaseReceipt: jest.fn(),
  getMegapotAddressesForChain: jest.fn(() => []),
}));

jest.mock('@/lib/db/repositories/purchaseStatusRepository', () => ({
  upsertPurchaseStatus: jest.fn(),
  claimPendingStacksPurchases: jest.fn(() => Promise.resolve([])),
  requeueFailedSettlement: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/lib/db/repositories/purchaseJobRepository', () => ({
  getBridgeEventPayloadByTxId: jest.fn(() => Promise.resolve(null)),
  jobExistsForTxId: jest.fn(() => Promise.resolve(false)),
  ensurePurchaseJobsTable: jest.fn(() => Promise.resolve()),
  enqueueJob: jest.fn(() => Promise.resolve(1)),
}));

jest.mock('@/lib/db/repositories/agentRunRepository', () => ({
  appendAgentRunEvent: jest.fn(() => Promise.resolve()),
  ensureAgentRunEventsTable: jest.fn(() => Promise.resolve()),
  getLatestAgentRunSessionBySource: jest.fn(() => Promise.resolve(null)),
}));

// The keeper builds clients through the settlement service's factory seam;
// swap it so no network is touched during keeper runs.
const factoryClients = () => ({
  walletClient: {
    account: { address: OPERATOR_SEED_ADDRESS },
    writeContract: () => Promise.resolve('0xhash0' as const),
  },
  publicClient: {
    readContract: (args: { functionName: string }) => {
      if (args.functionName === 'balanceOf') return Promise.resolve(10n * 1_000_000n);
      if (args.functionName === 'allowance') return Promise.resolve(0n);
      if (args.functionName === 'ticketPrice') return Promise.resolve(1_000_000n);
      return Promise.resolve(0n);
    },
    waitForTransactionReceipt: () => Promise.resolve({ status: 'success' }),
  },
});

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { sql } from '@vercel/postgres';
import {
  settleStacksPurchase,
  completeSettlement,
  setKeeperClientsFactory,
  resetKeeperClientsFactory,
  type KeeperClients,
} from '@/services/stacks/stacksSettlementService';
import { runStacksKeeper } from '@/services/jobs/stacksKeeperProcessor';
import { stacksX402Service } from '@/domains/wallet/services/stacksX402Service';
import { verifyTicketPurchaseReceipt } from '@/services/season/megapotReceipts';
import {
  upsertPurchaseStatus,
  claimPendingStacksPurchases,
  requeueFailedSettlement,
} from '@/lib/db/repositories/purchaseStatusRepository';

const OPERATOR_SEED_ADDRESS = '0x00000000000000000000000000000000000000b1';
const OPERATOR = OPERATOR_SEED_ADDRESS;

function makeClients(overrides: {
  readContract?: (args: { functionName: string }) => Promise<unknown>;
  writeContract?: (args: { functionName: string }) => Promise<`0x${string}`>;
} = {}): KeeperClients {
  const readContract =
    overrides.readContract ??
    ((args: { functionName: string }) => {
      if (args.functionName === 'balanceOf') return Promise.resolve(10n * 1_000_000n);
      if (args.functionName === 'allowance') return Promise.resolve(0n);
      if (args.functionName === 'ticketPrice') return Promise.resolve(1_000_000n);
      return Promise.resolve(0n);
    });
  const writeContract =
    overrides.writeContract ?? (() => Promise.resolve('0xhash0' as `0x${string}`));

  return {
    walletClient: {
      account: { address: OPERATOR as `0x${string}` },
      writeContract: jest.fn(writeContract),
    },
    publicClient: {
      readContract: jest.fn(readContract),
      waitForTransactionReceipt: jest.fn(() =>
        Promise.resolve({ status: 'success' as const, blockNumber: 1n, transactionHash: '0xhash0' as `0x${string}` }),
      ),
    },
  } as unknown as KeeperClients;
}

const baseInput = {
  sourceTxId: 'abc123',
  baseAddress: '0x1111111111111111111111111111111111111111',
  ticketCount: 2,
  amount: 2_000_000n,
};

describe('settleStacksPurchase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (sql as unknown as jest.Mock).mockReset();
  });

  it('fails closed when the keeper float cannot cover the purchase', async () => {
    const clients = makeClients({
      readContract: () => Promise.resolve(0n), // balanceOf = 0
    });

    const result = await settleStacksPurchase(
      baseInput,
      84532,
      '0x' + '11'.repeat(32),
      clients,
    );

    expect(result.complete).toBe(false);
    expect(result.stages.some((s) => s.stage === 'funds_leg' && !s.ok)).toBe(true);
    // Nothing was written on-chain.
    expect(clients.publicClient.waitForTransactionReceipt).not.toHaveBeenCalled();
    expect(clients.walletClient.writeContract).not.toHaveBeenCalled();
  });

  it('skips the CCTP relay when no message is supplied and purchases via the classic entry', async () => {
    (verifyTicketPurchaseReceipt as jest.Mock).mockResolvedValue({
      ok: true,
      txHash: '0xhash0',
      buyer: baseInput.baseAddress,
      ticketCount: 2,
    });

    const clients = makeClients();

    const result = await settleStacksPurchase(
      baseInput,
      84532,
      '0x' + '11'.repeat(32),
      clients,
    );

    expect(result.complete).toBe(true);
    expect(result.purchaseTxHash).toBe('0xhash0');

    const stages = result.stages.map((s) => s.stage);
    expect(stages).toEqual(['funds_leg', 'cctp_relay', 'purchase', 'verify']);
    const relay = result.stages.find((s) => s.stage === 'cctp_relay');
    expect(relay?.skipped).toBe(true);

    // approve + purchase calls hit the token + megapot contracts
    const writeFunctionNames = (clients.walletClient.writeContract as jest.Mock).mock.calls.map(
      (c: Array<{ functionName: string }>) => c[0].functionName,
    );
    expect(writeFunctionNames).toEqual(['approve', 'purchaseTickets']);

    // Row flipped to complete with the real purchase hash.
    const upsert = (upsertPurchaseStatus as jest.Mock).mock.calls[0][0];
    expect(upsert.status).toBe('complete');
    expect(upsert.baseTxId).toBe('0xhash0');
  });

  it('journals settle.rejected and never completes when receipt attribution fails', async () => {
    (verifyTicketPurchaseReceipt as jest.Mock).mockResolvedValue({
      ok: false,
      reason: 'No logs from a known Megapot contract in this transaction.',
    });

    const result = await settleStacksPurchase(
      baseInput,
      84532,
      '0x' + '11'.repeat(32),
      makeClients(),
    );

    expect(result.complete).toBe(false);
    const upsert = (upsertPurchaseStatus as jest.Mock).mock.calls[0][0];
    expect(upsert.status).toBe('error');
    expect(upsert.error).toContain('settle.rejected');
  });

  it('refuses to purchase when the on-chain ticket price breaks the 1-per-ticket assumption', async () => {
    const clients = makeClients({
      readContract: (args: { functionName: string }) => {
        if (args.functionName === 'ticketPrice') return Promise.resolve(2_000_000n);
        if (args.functionName === 'balanceOf') return Promise.resolve(10n * 1_000_000n);
        return Promise.resolve(0n);
      },
    });

    const result = await settleStacksPurchase(
      baseInput,
      84532,
      '0x' + '11'.repeat(32),
      clients,
    );

    expect(result.complete).toBe(false);
    expect(result.error).toContain('ticket price');
    // No writes happened: the price gate fires before approve/purchase.
    expect(clients.walletClient.writeContract).not.toHaveBeenCalled();
  });
});

describe('completeSettlement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('flips the row to complete only after verification attributes the purchase', async () => {
    (verifyTicketPurchaseReceipt as jest.Mock).mockResolvedValue({
      ok: true,
      txHash: '0xgood',
      buyer: baseInput.baseAddress,
      ticketCount: 1,
    });

    const { ok } = await completeSettlement(baseInput, 84532, '0xgood');
    expect(ok).toBe(true);

    const upsert = (upsertPurchaseStatus as jest.Mock).mock.calls[0][0];
    expect(upsert.status).toBe('complete');
    expect(upsert.baseTxId).toBe('0xgood');
  });

  it('leaves the row incomplete when verification fails', async () => {
    (verifyTicketPurchaseReceipt as jest.Mock).mockResolvedValue({
      ok: false,
      reason: 'Transaction reverted or failed on-chain.',
    });

    const { ok } = await completeSettlement(baseInput, 84532, '0xbad');
    expect(ok).toBe(false);

    const upsert = (upsertPurchaseStatus as jest.Mock).mock.calls[0][0];
    expect(upsert.status).toBe('error');
    expect(upsert.error).toContain('settle.rejected');
  });
});

describe('runStacksKeeper gates', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    (claimPendingStacksPurchases as jest.Mock).mockResolvedValue([]);
    process.env = { ...OLD_ENV };
    setKeeperClientsFactory(() => factoryClients() as unknown as KeeperClients);
  });

  afterAll(() => {
    process.env = OLD_ENV;
    resetKeeperClientsFactory();
  });

  it('is fail-closed when disabled', async () => {
    delete process.env.STACKS_KEEPER_ENABLED;
    delete process.env.STACKS_KEEPER_PRIVATE_KEY;
    delete process.env.STACKS_BRIDGE_OPERATOR_KEY;

    const result = await runStacksKeeper();

    expect(result.attempted).toBe(false);
    expect(result.reason).toContain('not enabled');
    expect(claimPendingStacksPurchases).not.toHaveBeenCalled();
  });

  it('is fail-closed with a malformed key', async () => {
    process.env.STACKS_KEEPER_ENABLED = 'true';
    process.env.STACKS_KEEPER_PRIVATE_KEY = 'not-a-key';

    const result = await runStacksKeeper();

    expect(result.attempted).toBe(false);
    expect(result.reason).toContain('fail-closed');
  });

  it('records a no-op run when enabled with a valid key but no pending rows', async () => {
    process.env.STACKS_KEEPER_ENABLED = 'true';
    process.env.STACKS_KEEPER_PRIVATE_KEY = '0x' + '11'.repeat(32);
    process.env.STACKS_KEEPER_CHAIN_ID = '84532';

    const result = await runStacksKeeper();

    expect(result.attempted).toBe(true);
    expect(result.settlements).toEqual([]);
    expect(claimPendingStacksPurchases).toHaveBeenCalledWith(3);
  });

  it('settles a claimed row and skips requeue on success', async () => {
    process.env.STACKS_KEEPER_ENABLED = 'true';
    process.env.STACKS_KEEPER_PRIVATE_KEY = '0x' + '11'.repeat(32);
    process.env.STACKS_KEEPER_CHAIN_ID = '84532';

    (claimPendingStacksPurchases as jest.Mock).mockResolvedValue([
      {
        sourceTxId: 'deadbeef',
        stacksTxId: 'deadbeef',
        recipientBaseAddress: baseInput.baseAddress,
        purchaseId: 7,
      },
    ]);

    // Receipt verification succeeds → full settlement completes.
    (verifyTicketPurchaseReceipt as jest.Mock).mockResolvedValue({
      ok: true,
      buyer: baseInput.baseAddress,
      ticketCount: 1,
    });

    const result = await runStacksKeeper();

    expect(result.settlements).toHaveLength(1);
    expect(result.settlements[0].complete).toBe(true);
    expect(result.settlements[0].purchaseTxHash).toBeTruthy();
    expect(requeueFailedSettlement).not.toHaveBeenCalled();
  });

  it('requeues a row when settlement does not complete', async () => {
    process.env.STACKS_KEEPER_ENABLED = 'true';
    process.env.STACKS_KEEPER_PRIVATE_KEY = '0x' + '11'.repeat(32);
    process.env.STACKS_KEEPER_CHAIN_ID = '84532';

    (claimPendingStacksPurchases as jest.Mock).mockResolvedValue([
      {
        sourceTxId: 'deadbeef',
        stacksTxId: 'deadbeef',
        recipientBaseAddress: baseInput.baseAddress,
        purchaseId: null,
      },
    ]);

    // Receipt verification rejects the purchase → settle.rejected, requeued.
    (verifyTicketPurchaseReceipt as jest.Mock).mockResolvedValue({
      ok: false,
      reason: 'No logs from a known Megapot contract in this transaction.',
    });

    const result = await runStacksKeeper();

    expect(result.settlements[0].complete).toBe(false);
    // Verification failures journal settle.rejected inside the service; the
    // processor additionally requeues the row for the next tick.
    expect(requeueFailedSettlement).toHaveBeenCalledWith(
      'deadbeef',
      expect.any(String),
    );
  });
});

describe('stacksX402Service.executeAutoPurchase', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('enforces authorization limits before touching the keeper', async () => {
    const result = await stacksX402Service.executeAutoPurchase(
      'does-not-exist',
      1_000_000n,
      1,
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('LIMIT_EXCEEDED');
  });

  it('reports an honest failure when the keeper is disabled', async () => {
    // Register an authorization directly (client-side service state).
    const service = stacksX402Service as unknown as {
      authorizations: Map<
        string,
        { isActive: boolean; userEvmAddress: string; expiresAt: number; maxAmountPerPurchase: bigint; ticketsPerPurchase: number }
      >;
    };
    service.authorizations.set('auth-x', {
      isActive: true,
      userEvmAddress: baseInput.baseAddress,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      maxAmountPerPurchase: 10_000_000n,
      ticketsPerPurchase: 5,
    });

    delete process.env.STACKS_KEEPER_ENABLED;

    const result = await stacksX402Service.executeAutoPurchase('auth-x', 1_000_000n, 1);

    expect(result.success).toBe(false);
    // The honest-failure contract: an explicit error, never a tx id.
    expect(result.transactionId).toBeUndefined();
    expect(result.error).toBeTruthy();
  });
});
