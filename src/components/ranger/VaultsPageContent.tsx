'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  Shield,
  Target,
  Wallet,
  Waves,
} from 'lucide-react';

import { Button } from '@/shared/components/ui/Button';
import {
  CompactCard,
  CompactContainer,
  CompactGrid,
  CompactSection,
  CompactStack,
} from '@/shared/components/premium/CompactLayout';
import {
  getPrimaryRangerStrategy,
  rangerMainTrackCandidates,
  rangerMainTrackRules,
} from '@/services/ranger';
import { RangerExecutionTracker } from '@/components/ranger/RangerExecutionTracker';
import { RangerApiConfigPanel } from '@/components/ranger/RangerApiConfigPanel';
import { RangerVaultInspector } from '@/components/ranger/RangerVaultInspector';
import { RangerOperationalPlaybook } from '@/components/ranger/RangerOperationalPlaybook';
import { VaultWaitlistCard } from '@/components/ranger/VaultWaitlistCard';
import { trackEvent } from '@/services/analytics/client';
import { buildYieldStrategiesHref } from '@/constants/vaultRouting';

interface VaultsPageContentProps {
  showOperatorTools?: boolean;
}

const benefits = [
  {
    title: 'Principal First',
    body: 'The vault experience is built around capital preservation. Yield is meant to create upside without turning the base deposit into a ticket spend.',
  },
  {
    title: 'USDC Simplicity',
    body: 'The primary strategy path is a USDC-denominated Solana carry allocator, which is easier for users to understand and easier for us to verify.',
  },
  {
    title: 'Visible Rules',
    body: 'We surface strategy constraints, venue concentration limits, and rebalance discipline as product features rather than hidden internals.',
  },
];

const userFlow = [
  'Choose the vault strategy and review the risk posture.',
  'Deposit USDC into the vault flow.',
  'Track strategy status, yield posture, and next actions in Syndicate.',
  'Decide whether to use yield for tickets, causes, or long-term compounding.',
];

function getStatusStyle(status: string): string {
  switch (status) {
    case 'buildable':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
    case 'needs_validation':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
    case 'rejected':
      return 'border-rose-500/40 bg-rose-500/10 text-rose-200';
    default:
      return 'border-slate-500/40 bg-slate-500/10 text-slate-200';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'buildable':
      return 'Buildable';
    case 'needs_validation':
      return 'Needs Validation';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Candidate';
  }
}

export function VaultsPageContent({
  showOperatorTools = false,
}: VaultsPageContentProps) {
  const primaryStrategy = getPrimaryRangerStrategy();
  const secondaryCandidates = rangerMainTrackCandidates.filter(
    (candidate) => candidate.id !== primaryStrategy?.id
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.16),transparent_25%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.16),transparent_24%),linear-gradient(180deg,#020617_0%,#0f172a_46%,#111827_100%)] px-4 py-8">
      <CompactContainer maxWidth="2xl">
        <CompactSection spacing="lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/">
              <Button variant="ghost" className="text-slate-300 hover:text-white">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </Link>

            <div className="flex flex-wrap gap-2">
              <Link href={buildYieldStrategiesHref('strategies')}>
                <Button
                  variant="outline"
                  className="border-cyan-500/30 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
                  onClick={() =>
                    trackEvent({
                      eventName: 'vaults_deposit_flow_click',
                      properties: { source: showOperatorTools ? 'operator' : 'public-header' },
                    })
                  }
                >
                  Deposit Flow
                </Button>
              </Link>
              <Link href={showOperatorTools ? '/vaults' : '/ranger'}>
                <Button
                  variant="outline"
                  className="border-slate-500/30 bg-slate-500/10 text-slate-100 hover:bg-slate-500/20"
                >
                  {showOperatorTools ? 'Public View' : 'Operator Mode'}
                </Button>
              </Link>
            </div>
          </div>

          <CompactCard
            variant="glass"
            padding="lg"
            className="overflow-hidden border border-cyan-500/20 bg-black/20"
          >
            <CompactStack spacing="lg">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-sm font-semibold text-cyan-100">
                <Waves className="h-4 w-4" />
                {showOperatorTools ? 'Vault Operator Workspace' : 'Vaults'}
              </div>

              <div className="space-y-4">
                <h1 className="max-w-4xl text-4xl font-black tracking-tight text-white md:text-6xl">
                  Stable vault yield, designed for real users.
                </h1>
                <p className="max-w-4xl text-lg leading-8 text-slate-300 md:text-xl">
                  Syndicate Vaults is the product-facing entry point for our yield experience:
                  principal-preserving USDC strategies, visible rules, and a cleaner path from
                  deposit to recurring upside.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href={buildYieldStrategiesHref('strategies')}>
                  <Button
                    className="bg-gradient-to-r from-cyan-500 to-emerald-500 text-white hover:from-cyan-600 hover:to-emerald-600"
                    onClick={() =>
                      trackEvent({
                        eventName: 'vaults_start_click',
                        properties: { source: showOperatorTools ? 'operator' : 'public-hero' },
                      })
                    }
                  >
                    <Wallet className="mr-2 h-4 w-4" />
                    Start With Vaults
                  </Button>
                </Link>
                <a
                  href="https://docs.ranger.finance/vault-owners/overview"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button
                    variant="outline"
                    className="border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
                  >
                    Ranger Docs
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </a>
              </div>

              <CompactGrid columns={3} gap="sm">
                {benefits.map((benefit) => (
                  <CompactCard
                    key={benefit.title}
                    variant="glass"
                    padding="md"
                    className="border border-white/10 bg-white/[0.04]"
                  >
                    <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
                      {benefit.title}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{benefit.body}</p>
                  </CompactCard>
                ))}
              </CompactGrid>
            </CompactStack>
          </CompactCard>

          {primaryStrategy && (
            <CompactGrid columns={2} gap="md">
              <CompactCard variant="premium" padding="lg">
                <div className="flex items-center gap-2 text-white">
                  <Target className="h-5 w-5 text-cyan-300" />
                  <h2 className="text-xl font-bold">Primary Strategy</h2>
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="mb-3 inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
                        Current Focus
                      </div>
                      <h3 className="text-xl font-bold text-white">{primaryStrategy.name}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {primaryStrategy.thesis}
                      </p>
                    </div>
                    <div
                      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getStatusStyle(
                        primaryStrategy.status
                      )}`}
                    >
                      {getStatusLabel(primaryStrategy.status)}
                    </div>
                  </div>

                  <div className="mt-5 space-y-2">
                    {primaryStrategy.returnDrivers.map((driver) => (
                      <div key={driver} className="flex items-start gap-2 text-sm text-slate-200">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                        <span>{driver}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {primaryStrategy.venues.map((venue) => (
                      <span
                        key={venue}
                        className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-100"
                      >
                        {venue}
                      </span>
                    ))}
                  </div>
                </div>
              </CompactCard>

              <CompactCard variant="premium" padding="lg">
                <div className="flex items-center gap-2 text-white">
                  <Shield className="h-5 w-5 text-emerald-300" />
                  <h2 className="text-xl font-bold">Risk Rules</h2>
                </div>

                <div className="mt-5 space-y-3">
                  {primaryStrategy.guardrails.map((guardrail) => (
                    <div
                      key={guardrail.id}
                      className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                    >
                      <div className="text-sm font-semibold text-white">{guardrail.limit}</div>
                      <p className="mt-1 text-sm leading-6 text-slate-300">
                        {guardrail.rationale}
                      </p>
                    </div>
                  ))}
                </div>
              </CompactCard>
            </CompactGrid>
          )}

          <CompactGrid columns={2} gap="md">
            <CompactCard variant="glass" padding="lg" className="border border-white/10 bg-white/[0.04]">
              <div className="flex items-center gap-2 text-white">
                <ArrowRight className="h-5 w-5 text-cyan-300" />
                <h2 className="text-xl font-bold">How Users Experience It</h2>
              </div>
              <div className="mt-5 space-y-3">
                {userFlow.map((step, index) => (
                  <div
                    key={step}
                    className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-bold text-cyan-100">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-6 text-slate-200">{step}</p>
                  </div>
                ))}
              </div>
            </CompactCard>

            <CompactCard variant="glass" padding="lg" className="border border-white/10 bg-white/[0.04]">
              <div className="flex items-center gap-2 text-white">
                <AlertTriangle className="h-5 w-5 text-amber-300" />
                <h2 className="text-xl font-bold">What Users Should Know</h2>
              </div>
              <div className="mt-5 space-y-3">
                {rangerMainTrackRules.slice(0, 3).map((rule) => (
                  <div
                    key={rule.id}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200"
                  >
                    {rule.summary}
                  </div>
                ))}
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.05] px-4 py-3 text-sm text-slate-200">
                  Regular users should live on this page. The build and operational controls stay in
                  <Link href="/ranger" className="ml-1 text-cyan-200 underline underline-offset-4">
                    operator mode
                  </Link>
                  .
                </div>
              </div>
            </CompactCard>
          </CompactGrid>

          {!showOperatorTools && <VaultWaitlistCard />}

          {showOperatorTools && (
            <>
              <RangerExecutionTracker />
              <RangerApiConfigPanel />
              <RangerVaultInspector />
              <RangerOperationalPlaybook />

              <CompactCard variant="glass" padding="lg" className="border border-white/10 bg-white/[0.04]">
                <div className="flex items-center gap-2 text-white">
                  <AlertTriangle className="h-5 w-5 text-amber-300" />
                  <h2 className="text-xl font-bold">Secondary Candidates</h2>
                </div>

                <div className="mt-6 space-y-5">
                  {secondaryCandidates.map((candidate) => (
                    <div
                      key={candidate.id}
                      className="rounded-2xl border border-white/10 bg-slate-950/50 p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-bold text-white">{candidate.name}</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-300">{candidate.thesis}</p>
                        </div>
                        <div
                          className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getStatusStyle(
                            candidate.status
                          )}`}
                        >
                          {getStatusLabel(candidate.status)}
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        {candidate.reasons.map((reason) => (
                          <div key={reason} className="text-sm leading-6 text-slate-200">
                            {reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CompactCard>
            </>
          )}
        </CompactSection>
      </CompactContainer>
    </div>
  );
}
