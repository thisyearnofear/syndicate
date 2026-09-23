/**
 * POST /api/okx/tickets — x402 pay-per-call ticket rail for OKX.AI agents.
 *
 * Agents pay $1.00 USD₮0 on X Layer mainnet (eip155:196); the operator buys
 * 1 real Megapot ticket on Base for the recipient, receipt-verified
 * (docs/OKX_DEV_DAY.md §4). The SDK settles the payment only when the inner
 * handler returns < 400, so any failure leaves the payer uncharged.
 *
 * Fail-closed: returns 503 without constructing the SDK unless every
 * OKX_RAIL_* and OKX_* env var is present and valid.
 *
 * GET returns a free JSON description of the service.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getOkxFacilitatorCredentials,
  getOkxRailPayTo,
  isOkxRailConfigured,
  missingOkxRailConfig,
  OKX_RAIL,
} from '@/config/okxRail';
import {
  handleTicketPurchase,
  journalSettlementOutcome,
} from '@/services/okxRail/ticketRailService';
import { getInjectedWrappedHandler, type WrappedHandler } from './wrappedStore';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const SESSION_HEADER = 'x-okx-rail-session';
const SOURCE_HEADER = 'x-okx-rail-source';
const REPLAY_HEADER = 'x-okx-rail-replay';

async function inner(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as { recipient?: string };
  const paymentHeader =
    request.headers.get('payment-signature') ?? request.headers.get('x-payment');
  const result = await handleTicketPurchase({
    recipient: body?.recipient,
    paymentHeader,
    origin: request.nextUrl.origin,
  });
  const response = NextResponse.json(result.body, { status: result.status });
  // Internal headers for post-settlement journaling; stripped before return.
  response.headers.set(SESSION_HEADER, result.sessionId);
  if (result.sourceTxId) response.headers.set(SOURCE_HEADER, result.sourceTxId);
  // Replays return a stored result; the SDK's settle attempt on the reused
  // authorization is expected to fail, so post-processing must not journal
  // a false "operator absorbed" failure.
  if (result.body.replay === true) response.headers.set(REPLAY_HEADER, '1');
  return response;
}

let wrappedHandler: WrappedHandler | null = null;

async function buildWrappedHandler(): Promise<WrappedHandler> {
  const [{ withX402 }, { x402ResourceServer }, { OKXFacilitatorClient }, { ExactEvmScheme }] =
    await Promise.all([
      import('@okxweb3/x402-next'),
      import('@okxweb3/x402-core/server'),
      import('@okxweb3/x402-core/facilitator'),
      import('@okxweb3/x402-evm/exact/server'),
    ]);
  const creds = getOkxFacilitatorCredentials();
  const payTo = getOkxRailPayTo();
  if (!creds || !payTo) {
    throw new Error('OKX rail configuration disappeared between checks');
  }
  // syncSettle: the facilitator waits for on-chain confirmation so the
  // PAYMENT-RESPONSE header carries a final status, not 'pending'.
  const facilitator = new OKXFacilitatorClient({ ...creds, syncSettle: true });
  const server = new x402ResourceServer(facilitator).register(
    OKX_RAIL.network,
    new ExactEvmScheme(),
  );
  return withX402(
    inner,
    {
      accepts: {
        scheme: 'exact',
        price: OKX_RAIL.price,
        network: OKX_RAIL.network,
        payTo,
        maxTimeoutSeconds: OKX_RAIL.maxTimeoutSeconds,
      },
      description:
        'Buy 1 real Megapot ticket on Base for a recipient; receipt-verified',
      mimeType: 'application/json',
    },
    server,
  );
}

export async function POST(request: NextRequest) {
  if (!isOkxRailConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: 'X Layer ticket rail is not configured',
        missing: missingOkxRailConfig(),
      },
      { status: 503 },
    );
  }

  try {
    const handler =
      getInjectedWrappedHandler() ?? (wrappedHandler ??= await buildWrappedHandler());
    const response = await handler(request);

    // Post-settlement loop: journal the X Layer payment outcome (and persist
    // its tx on the purchase row) without altering the client response.
    const paymentResponseHeader =
      response.headers.get('payment-response') ??
      response.headers.get('x-payment-response');
    const sourceTxId = response.headers.get(SOURCE_HEADER) ?? undefined;
    const sessionId = response.headers.get(SESSION_HEADER) ?? undefined;
    const isReplay = response.headers.get(REPLAY_HEADER) === '1';
    if (!isReplay) {
      await journalSettlementOutcome({
        status: response.status,
        paymentResponseHeader,
        sourceTxId,
        sessionId,
      });
    }
    response.headers.delete(SESSION_HEADER);
    response.headers.delete(SOURCE_HEADER);
    response.headers.delete(REPLAY_HEADER);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[OkxRail] Tickets route failed', { message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'X Layer ticket rail',
    pricing: `${OKX_RAIL.price} USD₮0 per call on ${OKX_RAIL.network} (x402 exact)`,
    ticketsPerCall: OKX_RAIL.ticketsPerCall,
    purchaseChain: 'Base',
    description:
      'Pay USD₮0 on X Layer; our operator buys 1 real Megapot ticket on Base for your recipient — receipts prove it.',
    configured: isOkxRailConfigured(),
  });
}
