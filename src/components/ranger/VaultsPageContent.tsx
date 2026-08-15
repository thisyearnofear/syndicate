'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Shield,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import { Button } from '@/shared/components/ui/Button';
import { PageShell, PageHeader, ShellSection } from '@/components/layout/PageShell';
import { ACCENTS } from '@/config/design';
import { YIELD_STRATEGIES } from '@/config/yieldStrategies';
import type { SupportedYieldStrategyId } from '@/config/yieldStrategies';
import { HonestyChip } from '@/components/layout/HonestyChip';
import { getCapability } from '@/config/capabilities';
import { buildVaultExecutionHref } from '@/constants/vaultRouting';
import { trackEvent } from '@/services/analytics/client';

interface VaultsPageContentProps {
  showOperatorTools?: boolean;
}

const APY_MAP: Record<SupportedYieldStrategyId, string> = {
  aave: '~4.5%',
  morpho: '~6.7%',
  spark: '~4.0%',
  pooltogether: '~3.5%',
  octant: '~10%',
  uniswap: '~8.5%',
  lifiearn: '~3.5%',
  fhenix: '~5.0%',
};

const STATUS_MAP: Partial<Record<SupportedYieldStrategyId, { label: string; style: string }>> = {
  octant: { label: 'Preview', style: 'text-gray-400 border-white/15' },
  uniswap: { label: 'Soon', style: 'text-gray-400 border-white/15' },
};

export function VaultsPageContent({
  showOperatorTools = false,
}: VaultsPageContentProps) {
  const grow = ACCENTS.grow;

  return (
    <PageShell width="wide">
      <PageHeader
        title="Grow"
        accent="grow"
        supportingLine="Deposit once. Yield buys tickets every cycle. Withdraw your full principal anytime."
      >
        {showOperatorTools ? (
          <Link href="/vaults">
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-white text-xs">
              Public View
            </Button>
          </Link>
        ) : (
          <Link href="/portfolio">
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-white text-xs">
              <Wallet className="mr-1.5 h-3.5 w-3.5" />
              Portfolio
            </Button>
          </Link>
        )}
      </PageHeader>

      {/* Back nav */}
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-white transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Home
        </Link>
      </div>

      <ShellSection className="space-y-4">
        {/* Fhenix — paused; shown so the gap is honest, not a deposit CTA */}
        {(() => {
          const fhenix = YIELD_STRATEGIES.find(s => s.id === 'fhenix');
          if (!fhenix) return null;
          const pauseNote =
            getCapability('fhenix_privacy').availabilityMessage ?? fhenix.description;

          return (
            <div
              className="relative rounded-2xl border border-white/10 bg-white/[0.02] p-6 opacity-80"
              aria-disabled="true"
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl grayscale">{fhenix.icon}</span>
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <HonestyChip capability="fhenix_privacy" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-300">{fhenix.name}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-gray-500 max-w-2xl">{pauseNote}</p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Other vaults grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {YIELD_STRATEGIES.filter(s => s.id !== 'uniswap' && s.id !== 'fhenix').map((strategy) => {
            const apy = APY_MAP[strategy.id];
            const status = STATUS_MAP[strategy.id];
            const href = buildVaultExecutionHref('strategies', 'vaults', { strategy: strategy.id });

            return (
              <Link
                key={strategy.id}
                href={href}
                onClick={() =>
                  trackEvent({
                    eventName: 'vault_card_click',
                    properties: { strategy: strategy.id, source: showOperatorTools ? 'operator' : 'public' },
                  })
                }
                className={`group relative flex flex-col justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-all hover:bg-white/[0.04] ${grow.border}`}
              >
                {/* Top row */}
                <div>
                  <div className="flex items-start justify-between">
                    <span className="text-2xl">{strategy.icon}</span>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {status && (
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${status.style}`}>
                          {status.label}
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="mt-3 text-lg font-bold text-white">{strategy.name}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-gray-400">{strategy.description}</p>
                </div>

                {/* Bottom row */}
                <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-4">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">APY</p>
                      <p className="text-lg font-black text-emerald-400">{apy}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Risk</p>
                      <p className="text-sm font-bold text-white">{strategy.risk}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-600 transition-transform group-hover:translate-x-1 group-hover:text-white" />
                </div>
              </Link>
            );
          })}
        </div>
      </ShellSection>

      {/* Bottom info — minimal */}
      <ShellSection>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-4">
          <div className="flex items-center gap-3">
            <Shield className="h-4 w-4 text-blue-400" />
            <p className="text-sm text-gray-400">
              Public vaults on Base are live. The Fhenix privacy rail is deprecated and paused — do not send funds to it.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/portfolio">
              <Button variant="ghost" size="sm" className="text-xs text-gray-500 hover:text-white">
                <TrendingUp className="mr-1.5 h-3.5 w-3.5" />
                View Portfolio
              </Button>
            </Link>
            {showOperatorTools && (
              <a href="https://docs.ranger.finance/vault-owners/overview" target="_blank" rel="noreferrer">
                <Button variant="ghost" size="sm" className="text-xs text-gray-500 hover:text-white">
                  Ranger Docs
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </a>
            )}
          </div>
        </div>
      </ShellSection>
    </PageShell>
  );
}
