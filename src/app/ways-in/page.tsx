'use client';

/**
 * WAYS IN — the chain-agnostic access surface.
 *
 * One prize on Base, many doors. This page lays out every rail into the
 * draw — your own Base wallet, a bridge from another chain, the Stacks
 * operator, or an x402 agent paying on X Layer — with the same five facts
 * for each so custody and proof are comparable at a glance. Nothing here
 * is fabricated: chips come from the capability registry and the proof
 * strip replays the rail operator's real journal.
 */

import { type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PageHeader, PageShell, ShellSection } from '@/components/layout/PageShell';
import { HonestyChip } from '@/components/layout/HonestyChip';
import { OperatorRunTimeline } from '@/components/operators/OperatorRunTimeline';
import { ProofStrip } from '@/components/proof/ProofStrip';
import { useIsMounted } from '@/hooks/useIsMounted';
import { useLatestDraw } from '@/hooks/useLatestDraw';
import { useOperatorRun } from '@/hooks/useOperatorRuns';
import { explorerTxForChain } from '@/config/explorers';
import { getCapability, type CapabilityId } from '@/config/capabilities';
import { OKX_RAIL } from '@/config/okxRail';
import { CHAINS } from '@/config/index';

function baseSepoliaTx(hash: string): string {
  return `${CHAINS.baseSepolia.explorerUrl}/tx/${hash}`;
}

function railTx(hash: string, chain?: string | null): string {
  return explorerTxForChain(hash, chain, baseSepoliaTx);
}

interface Fact {
  label: string;
  value: string;
}

function FactList({ facts }: { facts: Fact[] }) {
  return (
    <dl className="space-y-1.5">
      {facts.map((f) => (
        <div key={f.label} className="flex items-baseline justify-between gap-3">
          <dt className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-gray-500">
            {f.label}
          </dt>
          <dd className="text-right text-xs text-gray-300">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Rail({
  name,
  capability,
  facts,
  note,
  chains,
  cta,
}: {
  name: string;
  capability?: CapabilityId;
  facts: Fact[];
  note?: ReactNode;
  chains?: { label: string; capability: CapabilityId }[];
  cta: { label: string; href: string };
}) {
  const cap = capability ? getCapability(capability) : null;
  return (
    <div className="flex flex-col rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{name}</h3>
        {capability && <HonestyChip capability={capability} />}
      </div>
      <FactList facts={facts} />
      {chains && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chains.map((c) => (
            <span
              key={c.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-gray-400"
            >
              {c.label}
              <HonestyChip capability={c.capability} />
            </span>
          ))}
        </div>
      )}
      {cap && cap.status !== 'live' && cap.availabilityMessage && (
        <p className="mt-3 text-[11px] leading-relaxed text-gray-500">{cap.availabilityMessage}</p>
      )}
      {note && <p className="mt-3 text-[11px] text-gray-500">{note}</p>}
      <Link
        href={cta.href}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-300 transition-colors hover:text-white"
      >
        {cta.label}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}

export default function WaysInPage() {
  // Hydration-safe origin: NEXT_PUBLIC_APP_URL when set, else the real
  // window origin once mounted (SSR renders an empty host rather than a
  // mismatched one).
  const mounted = useIsMounted();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? (mounted ? window.location.origin : '');

  const rail = useOperatorRun('rail');
  const { draw: latestDraw, loaded: drawLoaded } = useLatestDraw();
  const listingUrl = process.env.NEXT_PUBLIC_OKX_AI_LISTING_URL;

  return (
    <PageShell accent="neutral" width="wide">
      <PageHeader
        title="Ways in"
        eyebrow="Access"
        supportingLine="Enter the Base draw from any chain, any wallet, or an agent acting for you. Every entry comes back with a receipt."
      />

      <ShellSection>
        <ProofStrip draw={latestDraw} loaded={drawLoaded} />
      </ShellSection>

      <ShellSection>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Lane 1 — already on Base */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="mb-1 text-base font-semibold text-white">I have a Base wallet</h2>
            <p className="mb-4 text-xs text-gray-500">The direct path — one transaction, one receipt.</p>
            <Rail
              name="Direct on Base"
              capability="megapot"
              facts={[
                { label: 'From', value: 'Base' },
                { label: 'Pay', value: 'USDC' },
                { label: 'Held in transit', value: 'You, throughout' },
                { label: 'Settled by', value: 'Your own transaction' },
                { label: 'Proof', value: 'Base receipt' },
              ]}
              cta={{ label: 'Enter draw', href: '/' }}
            />
          </div>

          {/* Lane 2 — funds elsewhere */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="mb-1 text-base font-semibold text-white">
              My funds are on another chain
            </h2>
            <p className="mb-4 text-xs text-gray-500">
              An operator settles it for you, or you bridge it yourself.
            </p>
            <div className="space-y-4">
              <Rail
                name="Stacks"
                capability="bridge_stacks"
                facts={[
                  { label: 'From', value: 'Stacks' },
                  { label: 'Pay', value: 'USDCx' },
                  { label: 'Held in transit', value: 'Our operator, until its next run' },
                  { label: 'Settled by', value: 'Stacks settlement operator' },
                  { label: 'Proof', value: 'Stacks + Base receipts + operator trace' },
                ]}
                note="No EVM wallet needed."
                cta={{ label: 'Enter from Stacks', href: '/' }}
              />
              <Rail
                name="Bridges"
                facts={[
                  { label: 'From', value: 'Source chain' },
                  { label: 'Pay', value: 'USDC' },
                  { label: 'Held in transit', value: 'Bridge protocol' },
                  { label: 'Settled by', value: 'You, on Base' },
                  { label: 'Proof', value: 'Bridge + Base receipts' },
                ]}
                chains={[
                  { label: 'Solana', capability: 'bridge_solana' },
                  { label: 'NEAR', capability: 'bridge_near' },
                  { label: 'Ethereum', capability: 'bridge_base' },
                  { label: 'Starknet', capability: 'bridge_starknet' },
                ]}
                cta={{ label: 'Fund', href: '/bridge' }}
              />
            </div>
          </div>

          {/* Lane 3 — an agent acts for me */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="mb-1 text-base font-semibold text-white">An agent acts for me</h2>
            <p className="mb-4 text-xs text-gray-500">
              A paid API call; the operator buys the ticket on Base. The rail is a door —
              the pool below is our experiment, not one for you to enter.
            </p>
            <Rail
              name="Syndicate Tickets"
              capability="rail_xlayer"
              facts={[
                { label: 'From', value: 'X Layer' },
                { label: 'Pay', value: `${OKX_RAIL.price.replace('$', '')} USD₮0 via x402` },
                { label: 'Held in transit', value: 'Nothing — charged only after your ticket is verified' },
                { label: 'Settled by', value: 'Agent Rail operator' },
                { label: 'Proof', value: 'X Layer + Base receipts + operator trace' },
              ]}
              cta={{ label: 'How it works', href: '#agents' }}
            />
            <Rail
              name="Agent Pool"
              capability="xlayer_prize_pool"
              facts={[
                { label: 'From', value: 'X Layer (testnet)' },
                { label: 'Pay', value: 'Operator-seeded demo entries' },
                { label: 'Held in transit', value: 'Pool operator keys, scoped by policy' },
                { label: 'Settled by', value: 'Agent Pool operator' },
                { label: 'Proof', value: 'X Layer receipts + run replay' },
              ]}
              note="R&D engine, not a door for you — no outside players yet. It seeds its own demo entries; replays live on /operators."
              cta={{ label: 'Open Agent Pool', href: '/xlayer' }}
            />
          </div>
        </div>
      </ShellSection>

      {/* For agents and builders */}
      <ShellSection>
        <div id="agents" className="scroll-mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="mb-2 text-base font-semibold text-white">For agents and builders</h2>
          <p className="mb-1 text-sm text-gray-400">
            Syndicate Tickets is an x402 pay-per-call endpoint: pay{' '}
            {OKX_RAIL.price.replace('$', '')} USD₮0 on X Layer and our operator buys one real
            Megapot ticket on Base for your recipient.
          </p>
          <p className="mb-5 text-sm text-gray-400">
            The purchase is receipt-verified before it is reported, and every step is journaled to a
            public operator trace.
          </p>

          <div className="space-y-3">
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-gray-500">
                Endpoint
              </p>
              <p className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-gray-200 break-all">
                POST {origin}
                /api/okx/tickets <span className="text-gray-500">· {OKX_RAIL.price} per call</span>
              </p>
              <p className="mt-1 font-mono text-xs text-gray-500">
                GET {origin}/api/okx/jackpot <span className="text-gray-600">· free</span>
              </p>
            </div>

            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-gray-500">
                Request / response
              </p>
              <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/30 p-4 font-mono text-[11px] leading-relaxed text-gray-300">
{`// body (recipient optional — defaults to the payer's address)
{ "recipient": "0x…" }

// 200 response
{
  "ok": true,
  "recipient": "0x…",
  "recipientSource": "explicit" | "payer",
  "ticketCount": 1,
  "chainId": 8453,
  "purchaseTxHash": "0x…",
  "explorerUrl": "https://basescan.org/tx/0x…",
  "sourceTxId": "okx-…",
  "traceUrl": "<origin>/purchase-status?chain=xlayer&txId=okx-…"
}`}
              </pre>
            </div>

            <p className="text-xs text-gray-400">
              Any x402 client that can pay USD₮0 on X Layer (eip155:196) can call it.
            </p>
            <p className="text-xs text-gray-400">
              If anything fails, we return an error and your payment is never collected.
            </p>
            <p className="text-xs leading-relaxed text-gray-500">
              Custody: our operator buys the ticket with its own USDC on Base first; your USD₮0 is
              collected on X Layer only after the ticket is verified, and the operator rebalances
              manually. Your ticket lives at the recipient address on Base; winnings are claimed with
              the same wallet.
            </p>
            <p className="text-xs text-gray-500">
              {listingUrl ? (
                <a
                  href={listingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-300 underline-offset-2 hover:text-white hover:underline"
                >
                  Listed on OKX.AI as Syndicate Tickets
                </a>
              ) : (
                'OKX.AI listing (Syndicate Tickets) is pending.'
              )}
            </p>
          </div>
        </div>
      </ShellSection>

      {/* Proof strip */}
      <ShellSection>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Latest agent-rail run</h2>
            <Link
              href="/operators"
              className="text-xs text-gray-400 transition-colors hover:text-white"
            >
              All operators →
            </Link>
          </div>
          <OperatorRunTimeline
            entries={rail.entries.slice(-4)}
            explorerTx={railTx}
            loading={rail.status === 'loading' || rail.status === 'idle'}
            emptyMessage="No agent-rail run recorded yet — the first paid call will appear here."
          />
        </div>
      </ShellSection>
    </PageShell>
  );
}
