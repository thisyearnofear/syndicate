'use client';

/**
 * OPERATORS — the public proof surface.
 *
 * Four operators (Agent Pool, Season, Stacks settlement, Agent Rail) are one
 * crew of server-side operators: fail-closed keys, receipt-verified writes,
 * public run replays. This page is where that story becomes visible — every
 * claim the product makes about automation is auditable here without a wallet.
 *
 * Design law: default surface, neutral accent, font-mono figures (the lab
 * register borrowed for one page because operators ARE the machine room),
 * RoundOrb for liveness, shared OperatorRunTimeline for every replay.
 * Worlds stay flagged: each card carries its own honesty chip and links
 * into its home world. See docs/POSITIONING.md "Proof".
 */

import Link from 'next/link';
import { ArrowRight, Bot, Crown, Globe, Waypoints } from 'lucide-react';
import { PageHeader, PageShell } from '@/components/layout/PageShell';
import { RoundOrb } from '@/components/motion/RoundOrb';
import { OperatorRunTimeline } from '@/components/operators/OperatorRunTimeline';
import { useOperatorRun } from '@/hooks/useOperatorRuns';
import { xLayerExplorerTx } from '@/config/xlayer';
import { explorerTxForChain } from '@/config/explorers';
import { getCapability, honestyChip } from '@/config/capabilities';
import { CHAINS } from '@/config/index';

function baseSepoliaTx(hash: string): string {
  return `${CHAINS.baseSepolia.explorerUrl}/tx/${hash}`;
}

/** Season receipts settle on either ladder chain; route by prefix is unsafe,
 * so link Base Mainnet for 8453-shaped hashes and Sepolia otherwise by env.
 * The keepers only ever write verified hashes, so the link target is
 * best-effort navigation, never proof (the hash itself is the proof). */
function seasonTx(hash: string): string {
  return baseSepoliaTx(hash);
}

/** Rail entries span X Layer (payment) and Base (ticket) — route by the
 * entry's own chain tag, falling back to the purchase chain. */
function railTx(hash: string, chain?: string | null): string {
  return explorerTxForChain(hash, chain, baseSepoliaTx);
}

const railStatus = getCapability('rail_xlayer').status;
const railChip =
  railStatus === 'live' ? 'Mainnet' : (honestyChip(railStatus)?.label ?? 'Paused');

const WORLDS = [
  {
    world: 'xlayer' as const,
    name: 'Agent Pool',
    icon: Bot,
    explorerTx: xLayerExplorerTx,
    role: 'Treasurer of the X Layer prize pool',
    cadence:
      'Opens epochs, seeds the demo oracle, fulfills randomness, claims only when it wins. No outside players yet — the operator seeds its own entries.',
    chip: 'Testnet',
    footHref: '/xlayer',
    footLabel: 'Open Agent Pool',
  },
  {
    world: 'season' as const,
    name: 'Season Referee',
    icon: Crown,
    explorerTx: seasonTx,
    role: 'Housekeeping for the Season of Tickets',
    cadence: 'Frees inactive seats, expires stale rounds; settlements stay receipt-driven.',
    chip: 'Keyless',
    footHref: '/season',
    footLabel: 'Open Season',
  },
  {
    world: 'stacks' as const,
    name: 'Stacks Settlement',
    icon: Globe,
    explorerTx: baseSepoliaTx,
    role: 'Completes Stacks → Base purchases',
    cadence: 'Float check → optional CCTP relay → Megapot purchase → receipt verification.',
    chip: 'Testnet',
    footHref: '/purchase-status?chain=stacks',
    footLabel: 'Trace a purchase by its Stacks tx id',
  },
  {
    world: 'rail' as const,
    name: 'Agent Rail · Syndicate Tickets',
    icon: Waypoints,
    explorerTx: railTx,
    role: 'Settles agent purchases paid on X Layer',
    cadence:
      'Payment verified → float check → Megapot purchase on Base → receipt verified → payment settled.',
    chip: railChip,
    footHref: '/ways-in#agents',
    footLabel: 'How agents enter',
  },
] as const;

function OperatorOrb({ status }: { status: 'idle' | 'loading' | 'ok' | 'error' }) {
  if (status === 'error') return <RoundOrb state="resolving" size={18} />;
  if (status === 'ok') return <RoundOrb state="settled" size={18} />;
  return <RoundOrb state="idle" size={18} />;
}

export default function OperatorsPage() {
  const xlayer = useOperatorRun('xlayer');
  const season = useOperatorRun('season');
  const stacks = useOperatorRun('stacks');
  const rail = useOperatorRun('rail');

  const states = { xlayer, season, stacks, rail } as const;

  return (
    <PageShell accent="neutral" width="wide">
      <PageHeader
        title="Operators"
        supportingLine="The house staff that runs while you sleep — every action receipted, every run replayable. No wallet required to audit."
        eyebrow="Proof, not promises"
        orb="idle"
      />

      <section className="mb-8">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-gray-300">
            Automation here is not a promise — it is a public crew with keys scoped by policy,
            writes verified on-chain, and runs anyone can replay. Four operators, one contract:{' '}
            <span className="font-mono text-xs text-gray-400">
              fail-closed → execute → receipt
            </span>
            .
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {WORLDS.map(({ world, name, icon: Icon, footHref, explorerTx, role, cadence, chip, footLabel }) => {
          const state = states[world];
          const lastEntry = state.entries[state.entries.length - 1];
          return (
            <div
              key={world}
              className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06]">
                    <Icon className="h-4.5 w-4.5 text-gray-200" aria-hidden />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-white">{name}</h2>
                    <p className="text-xs text-gray-500">{role}</p>
                  </div>
                </div>
                <OperatorOrb status={state.status} />
              </div>

              <p className="mb-4 text-xs leading-relaxed text-gray-400">{cadence}</p>

              <div className="mb-4 flex items-center gap-2">
                <span className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-gray-400">
                  {chip}
                </span>
                {state.status === 'error' && (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-rose-400">
                    replay offline
                  </span>
                )}
                {state.status === 'ok' && lastEntry && (
                  <span className="font-mono text-[10px] text-gray-500">
                    last seen {new Date(lastEntry.createdAt).toLocaleString()}
                  </span>
                )}
              </div>

              <div className="mb-5 flex-1">
                <OperatorRunTimeline
                  entries={state.entries.slice(-6)}
                  explorerTx={explorerTx}
                  emptyMessage={
                    state.status === 'loading' || state.status === 'idle'
                      ? 'Reading the latest run…'
                      : 'No run recorded yet.'
                  }
                />
              </div>

              <Link
                href={footHref}
                className="mt-auto inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-white"
              >
                {footLabel}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          );
        })}
      </section>
    </PageShell>
  );
}
