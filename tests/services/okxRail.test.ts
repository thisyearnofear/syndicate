/**
 * OKX X LAYER TICKET RAIL — UNIT TESTS
 *
 * Covers handleTicketPurchase (recipient validation + payer derivation,
 * idempotent claim/replay, settle failure mapping, journaling) and the
 * /api/okx/tickets route (fail-closed 503 without constructing the SDK;
 * PAYMENT-RESPONSE post-processing via a stubbed wrapped handler).
 * No network, no chain — all deps injected or mocked.
 */

// jsdom's crypto lacks Web Crypto subtle; the route runs on the nodejs
// runtime where globalThis.crypto.subtle exists. Polyfill for tests.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { webcrypto } = require('crypto');
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

jest.mock('@vercel/postgres', () => ({ sql: jest.fn() }));

jest.mock('@/lib/db/repositories/agentRunRepository', () => ({
  appendAgentRunEvent: jest.fn(() => Promise.resolve()),
  ensureAgentRunEventsTable: jest.fn(() => Promise.resolve()),
  getLatestAgentRunSessionBySource: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('@/lib/db/repositories/purchaseStatusRepository', () => ({
  claimPurchaseIfAbsent: jest.fn(),
  getPurchaseStatusByTxId: jest.fn(),
  upsertPurchaseStatus: jest.fn(() => Promise.resolve()),
  recordSourceSettlementTx: jest.fn(() => Promise.resolve()),
}));

jest.mock('@okxweb3/x402-next', () => ({
  withX402: jest.fn(() => jest.fn()),
}));

jest.mock('@/config/okxRail', () => {
  const actual = jest.requireActual('@/config/okxRail');
  return { ...actual, isOkxRailConfigured: jest.fn() };
});

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { NextRequest, NextResponse } from 'next/server';
import {
  handleTicketPurchase,
  decodePayerFromPaymentHeader,
  journalSettlementOutcome,
  type TicketRailDeps,
} from '@/services/okxRail/ticketRailService';
import { isOkxRailConfigured } from '@/config/okxRail';
import { appendAgentRunEvent } from '@/lib/db/repositories/agentRunRepository';
import {
  getPurchaseStatusByTxId,
  recordSourceSettlementTx,
  upsertPurchaseStatus,
} from '@/lib/db/repositories/purchaseStatusRepository';
import { POST } from '@/app/api/okx/tickets/route';
import { setWrappedHandlerForTests } from '@/app/api/okx/tickets/wrappedStore';
import { GET as purchaseStatusGET, POST as purchaseStatusPOST } from '@/app/api/purchase-status/route';
import { GET as traceGET } from '@/app/api/agent/trace/route';
import { sql } from '@vercel/postgres';
import type { SettlementResult } from '@/services/stacks/stacksSettlementService';

const PAYER = '0x2222222222222222222222222222222222222222';
const RECIPIENT = '0x3333333333333333333333333333333333333333';
const KEY = '0x' + '22'.repeat(32);

function paymentHeaderFor(payer?: string): string {
  const payload = payer
    ? { x402Version: 2, payload: { authorization: { from: payer } } }
    : { x402Version: 2, payload: {} };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

const HEADER = paymentHeaderFor(PAYER);

function okSettle(txHash = '0xbase1'): SettlementResult {
  return {
    ok: true,
    complete: true,
    stages: [
      { stage: 'funds_leg', ok: true },
      { stage: 'cctp_relay', ok: true, skipped: true },
      { stage: 'purchase', ok: true, txHash },
      { stage: 'verify', ok: true },
    ],
    purchaseTxHash: txHash as `0x${string}`,
  };
}

function makeDeps(overrides: Partial<TicketRailDeps> = {}) {
  const settle = jest.fn(() => Promise.resolve(okSettle()));
  const claimRow = jest.fn(() => Promise.resolve(true));
  const getRow = jest.fn(() => Promise.resolve(null));
  const journal = jest.fn(() => Promise.resolve());
  const failRow = jest.fn(() => Promise.resolve());
  return { settle, claimRow, getRow, journal, failRow, ...overrides };
}

describe('handleTicketPurchase', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV, OKX_RAIL_KEEPER_PRIVATE_KEY: KEY };
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('rejects with 400 when recipient is invalid and no payer is derivable', async () => {
    const deps = makeDeps();
    const res = await handleTicketPurchase(
      { recipient: 'not-an-address', paymentHeader: paymentHeaderFor(), origin: 'https://app' },
      deps,
    );
    expect(res.status).toBe(400);
    expect(deps.settle).not.toHaveBeenCalled();
    expect(deps.claimRow).not.toHaveBeenCalled();
  });

  it('falls back to the payer when the explicit recipient is invalid', async () => {
    const deps = makeDeps();
    const res = await handleTicketPurchase(
      { recipient: 'not-an-address', paymentHeader: HEADER, origin: 'https://app' },
      deps,
    );
    expect(res.status).toBe(200);
    expect(res.body.recipient).toBe(PAYER);
    expect(res.body.recipientSource).toBe('payer');
  });

  it('requires a recipient when the payer cannot be derived', async () => {
    const res = await handleTicketPurchase(
      { paymentHeader: paymentHeaderFor(), origin: 'https://app' },
      makeDeps(),
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('could not derive payer');
  });

  it('defaults the recipient to the payer decoded from the payment header', async () => {
    const deps = makeDeps();
    const res = await handleTicketPurchase(
      { paymentHeader: HEADER, origin: 'https://app' },
      deps,
    );
    expect(res.status).toBe(200);
    expect(res.body.recipient).toBe(PAYER);
    expect(res.body.recipientSource).toBe('payer');
    expect(deps.settle).toHaveBeenCalledWith(
      expect.objectContaining({ baseAddress: PAYER, sourceChain: 'xlayer' }),
      8453,
      KEY,
    );
  });

  it('prefers an explicit valid recipient over the payer', async () => {
    const deps = makeDeps();
    const res = await handleTicketPurchase(
      { recipient: RECIPIENT, paymentHeader: HEADER, origin: 'https://app' },
      deps,
    );
    expect(res.status).toBe(200);
    expect(res.body.recipient).toBe(RECIPIENT);
    expect(res.body.recipientSource).toBe('explicit');
    expect(res.body.traceUrl).toContain('/purchase-status?chain=xlayer&txId=okx-');
    expect(res.body.purchaseTxHash).toBe('0xbase1');
  });

  it('returns the stored result on replay without settling again', async () => {
    const deps = makeDeps({
      claimRow: jest.fn(() => Promise.resolve(false)),
      getRow: jest.fn(() =>
        Promise.resolve({
          sourceTxId: 'okx-x',
          sourceChain: 'xlayer',
          status: 'complete',
          baseTxId: '0xstored',
          recipientBaseAddress: RECIPIENT,
        }),
      ),
    });
    const res = await handleTicketPurchase(
      { recipient: RECIPIENT, paymentHeader: HEADER, origin: 'https://app' },
      deps,
    );
    expect(res.status).toBe(200);
    expect(res.body.purchaseTxHash).toBe('0xstored');
    expect(deps.settle).not.toHaveBeenCalled();
  });

  it('returns 409 when the claimed row is still in progress', async () => {
    const deps = makeDeps({
      claimRow: jest.fn(() => Promise.resolve(false)),
      getRow: jest.fn(() =>
        Promise.resolve({ sourceTxId: 'okx-x', sourceChain: 'xlayer', status: 'settling' }),
      ),
    });
    const res = await handleTicketPurchase(
      { recipient: RECIPIENT, paymentHeader: HEADER, origin: 'https://app' },
      deps,
    );
    expect(res.status).toBe(409);
    expect(deps.settle).not.toHaveBeenCalled();
  });

  it('returns 502 when a previous attempt failed', async () => {
    const deps = makeDeps({
      claimRow: jest.fn(() => Promise.resolve(false)),
      getRow: jest.fn(() =>
        Promise.resolve({
          sourceTxId: 'okx-x',
          sourceChain: 'xlayer',
          status: 'error',
          error: 'boom',
        }),
      ),
    });
    const res = await handleTicketPurchase(
      { recipient: RECIPIENT, paymentHeader: HEADER, origin: 'https://app' },
      deps,
    );
    expect(res.status).toBe(502);
    expect(res.body.error).toContain('boom');
  });

  it('maps insufficient float to 503 and journals a fail entry', async () => {
    const deps = makeDeps({
      settle: jest.fn(() =>
        Promise.resolve({
          ok: false,
          complete: false,
          stages: [{ stage: 'funds_leg', ok: false, error: 'float 0 < 1000000' }],
          error: 'float 0 < 1000000',
        } as SettlementResult),
      ),
    });
    const res = await handleTicketPurchase(
      { recipient: RECIPIENT, paymentHeader: HEADER, origin: 'https://app' },
      deps,
    );
    expect(res.status).toBe(503);
    expect(res.body.error).toContain('float');
    expect(deps.journal).toHaveBeenCalledWith(
      'fail',
      expect.any(String),
      expect.objectContaining({ toolId: expect.stringMatching(/^okx-/), chain: 'base' }),
    );
    expect(deps.failRow).toHaveBeenCalledWith(
      expect.objectContaining({ sourceTxId: expect.stringMatching(/^okx-/), recipientBaseAddress: RECIPIENT }),
    );
  });

  it('does not journal skipped stages (no CCTP leg on this rail)', async () => {
    const deps = makeDeps();
    await handleTicketPurchase(
      { recipient: RECIPIENT, paymentHeader: HEADER, origin: 'https://app' },
      deps,
    );
    const labels = (deps.journal as jest.Mock).mock.calls.map(
      (c: unknown[]) => c[1] as string,
    );
    expect(labels.some((l: string) => l.includes('cctp_relay'))).toBe(false);
  });

  it('keeps recipient and purchase tx on the row when verify fails after purchase', async () => {
    const deps = makeDeps({
      settle: jest.fn(() =>
        Promise.resolve({
          ok: false,
          complete: false,
          stages: [
            { stage: 'funds_leg', ok: true },
            { stage: 'cctp_relay', ok: true, skipped: true },
            { stage: 'purchase', ok: true, txHash: '0xlanded' },
            { stage: 'verify', ok: false, error: 'unverified purchase' },
          ],
          purchaseTxHash: '0xlanded',
          error: 'unverified purchase',
        } as SettlementResult),
      ),
    });
    const res = await handleTicketPurchase(
      { recipient: RECIPIENT, paymentHeader: HEADER, origin: 'https://app' },
      deps,
    );
    expect(res.status).toBe(502);
    expect(deps.failRow).toHaveBeenCalledWith(
      expect.objectContaining({ recipientBaseAddress: RECIPIENT, baseTxId: '0xlanded' }),
    );
  });

  it('produces distinct journal ids between the handler and the settle post-processor', async () => {
    // Real journal (not injected) so the id scheme is under test.
    const deps = makeDeps();
    delete (deps as Partial<TicketRailDeps>).journal;
    const res = await handleTicketPurchase(
      { recipient: RECIPIENT, paymentHeader: HEADER, origin: 'https://app' },
      deps,
    );
    expect(res.status).toBe(200);

    const settleHeader = Buffer.from(
      JSON.stringify({ success: true, status: 'success', transaction: '0xsettle1' }),
    ).toString('base64');
    await journalSettlementOutcome({
      status: 200,
      paymentResponseHeader: settleHeader,
      sourceTxId: res.sourceTxId,
      sessionId: res.sessionId,
    });

    const ids = (appendAgentRunEvent as jest.Mock).mock.calls.map((c) => c[0].id as string);
    expect(ids.length).toBeGreaterThan(1);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('decodePayerFromPaymentHeader', () => {
  it('reads the Permit2 payload shape too', () => {
    const header = Buffer.from(
      JSON.stringify({ payload: { permit2Authorization: { from: PAYER } } }),
    ).toString('base64');
    expect(decodePayerFromPaymentHeader(header)).toBe(PAYER);
  });

  it('returns null on malformed input', () => {
    expect(decodePayerFromPaymentHeader('not-base64!!')).toBeNull();
    expect(decodePayerFromPaymentHeader(null)).toBeNull();
  });
});

describe('POST /api/okx/tickets', () => {
  const OLD_ENV = process.env;
  const configured = isOkxRailConfigured as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV, OKX_RAIL_KEEPER_PRIVATE_KEY: KEY };
    setWrappedHandlerForTests(null);
  });
  afterAll(() => {
    process.env = OLD_ENV;
    setWrappedHandlerForTests(null);
  });

  const req = () =>
    new NextRequest('https://app/api/okx/tickets', {
      method: 'POST',
      body: JSON.stringify({ recipient: RECIPIENT }),
      headers: { 'content-type': 'application/json' },
    });

  it('returns 503 without constructing the SDK when unconfigured', async () => {
    configured.mockReturnValue(false);
    const { withX402 } = jest.requireMock('@okxweb3/x402-next');
    const res = await POST(req());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.missing).toBeInstanceOf(Array);
    expect(withX402).not.toHaveBeenCalled();
  });

  it('journals the X Layer settlement when PAYMENT-RESPONSE reports success', async () => {
    configured.mockReturnValue(true);
    const settleHeader = Buffer.from(
      JSON.stringify({ success: true, status: 'success', transaction: '0xsettle1', network: 'eip155:196' }),
    ).toString('base64');
    setWrappedHandlerForTests(async () => {
      const res = NextResponse.json({ ok: true }, { status: 200 });
      res.headers.set('payment-response', settleHeader);
      res.headers.set('x-okx-rail-source', 'okx-abc');
      return res;
    });

    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(appendAgentRunEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'complete',
        source: 'xlayer-rail',
        chain: 'xlayer',
        toolId: 'okx-abc',
        txHash: '0xsettle1',
      }),
    );
    expect(recordSourceSettlementTx).toHaveBeenCalledWith('okx-abc', 'xlayer', '0xsettle1');
    // Internal headers are stripped before returning.
    expect(res.headers.get('x-okx-rail-source')).toBeNull();
  });

  it('journals a fail entry when a 200 lacks a settlement header', async () => {
    configured.mockReturnValue(true);
    setWrappedHandlerForTests(async () => {
      const res = NextResponse.json({ ok: true }, { status: 200 });
      res.headers.set('x-okx-rail-source', 'okx-abc');
      return res;
    });

    await POST(req());
    expect(appendAgentRunEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'fail', source: 'xlayer-rail', chain: 'xlayer' }),
    );
    expect(recordSourceSettlementTx).not.toHaveBeenCalled();
  });

  it('does not journal a settlement failure for replays', async () => {
    configured.mockReturnValue(true);
    setWrappedHandlerForTests(async () => {
      const res = NextResponse.json({ ok: true, replay: true }, { status: 200 });
      res.headers.set('x-okx-rail-source', 'okx-abc');
      res.headers.set('x-okx-rail-replay', '1');
      return res;
    });

    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(appendAgentRunEvent).not.toHaveBeenCalled();
    expect(recordSourceSettlementTx).not.toHaveBeenCalled();
    expect(res.headers.get('x-okx-rail-replay')).toBeNull();
  });
});

describe('purchase-status rail guards', () => {
  beforeEach(() => jest.clearAllMocks());

  const postBody = (over: Record<string, unknown>) =>
    new NextRequest('https://app/api/purchase-status', {
      method: 'POST',
      body: JSON.stringify({
        sourceTxId: 'deadbeef',
        sourceChain: 'stacks',
        status: 'complete',
        ...over,
      }),
      headers: { 'content-type': 'application/json' },
    });

  it('rejects unauthenticated writes to xlayer rows', async () => {
    const res = await purchaseStatusPOST(postBody({ sourceChain: 'xlayer' }));
    expect(res.status).toBe(403);
    expect(upsertPurchaseStatus).not.toHaveBeenCalled();
  });

  it('rejects writes whose sourceTxId is a rail id regardless of claimed chain', async () => {
    const res = await purchaseStatusPOST(postBody({ sourceTxId: 'okx-' + 'ab'.repeat(32) }));
    expect(res.status).toBe(403);
    expect(upsertPurchaseStatus).not.toHaveBeenCalled();
  });

  it('still allows other chains through', async () => {
    const res = await purchaseStatusPOST(postBody({}));
    expect(res.status).toBe(200);
    expect(upsertPurchaseStatus).toHaveBeenCalled();
  });

  it('returns not_found for an unknown okx- txId instead of broadcasting', async () => {
    (getPurchaseStatusByTxId as jest.Mock).mockResolvedValue(null);
    const res = await purchaseStatusGET(
      new NextRequest(`https://app/api/purchase-status?txId=okx-${'ab'.repeat(32)}`),
    );
    const body = await res.json();
    expect(body.status).toBe('not_found');
  });

  it('returns xlayer receipts with oklink source explorer and paymentSettled', async () => {
    (getPurchaseStatusByTxId as jest.Mock).mockResolvedValue({
      sourceTxId: 'okx-' + 'ab'.repeat(32),
      sourceChain: 'xlayer',
      status: 'complete',
      baseTxId: '0xbase1',
      bridgeId: '0xsettle1',
      recipientBaseAddress: RECIPIENT,
    });
    const res = await purchaseStatusGET(
      new NextRequest(`https://app/api/purchase-status?txId=okx-${'ab'.repeat(32)}`),
    );
    const body = await res.json();
    expect(body.paymentSettled).toBe(true);
    expect(body.receipt.sourceExplorer).toBe('https://www.oklink.com/x-layer/tx/0xsettle1');
    expect(body.receipt.baseExplorer).toBe('https://basescan.org/tx/0xbase1');
    expect(body.receipt.stacksExplorer).toBeUndefined();
  });
});

describe('GET /api/agent/trace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (sql as unknown as jest.Mock).mockResolvedValue({ rows: [] });
  });

  it('rejects an unknown source', async () => {
    const res = await traceGET(
      new NextRequest('https://app/api/agent/trace?source=nope&sourceTxId=abc'),
    );
    expect(res.status).toBe(400);
  });

  it('rejects a malformed xlayer-rail sourceTxId', async () => {
    const res = await traceGET(
      new NextRequest('https://app/api/agent/trace?source=xlayer-rail&sourceTxId=okx-zz'),
    );
    expect(res.status).toBe(400);
    expect(sql).not.toHaveBeenCalled();
  });

  it('returns rail runs with chain on each entry', async () => {
    (sql as unknown as jest.Mock).mockResolvedValue({
      rows: [
        {
          id: 'e1',
          session_id: 's1',
          kind: 'complete',
          label: 'Payment settled on X Layer',
          detail: null,
          tool_id: 'okx-' + 'ab'.repeat(32),
          tx_hash: '0xsettle1',
          chain: 'xlayer',
          created_at: 1,
        },
      ],
    });
    const res = await traceGET(
      new NextRequest(
        `https://app/api/agent/trace?source=xlayer-rail&sourceTxId=okx-${'ab'.repeat(32)}`,
      ),
    );
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.found).toBe(true);
    expect(body.runs[0].entries[0].chain).toBe('xlayer');
    expect(body.runs[0].entries[0].txHash).toBe('0xsettle1');
  });

  it('normalizes 0x-prefixed stacks ids', async () => {
    const res = await traceGET(
      new NextRequest(`https://app/api/agent/trace?source=stacks-keeper&sourceTxId=0xdeadbeef`),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.sourceTxId).toBe('deadbeef');
  });
});
