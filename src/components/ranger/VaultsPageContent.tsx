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

const STATUS_MAP: Record<SupportedYieldStrategyId, { label: string; style: string }> = {
  aave: { label: 'Live on Base Sepolia', style: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  morpho: { label: 'Live on Base Sepolia', style: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  spark: { label: 'Live on Base Sepolia', style: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  pooltogether: { label: 'Live on Base Sepolia', style: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  octant: { label: 'MVP Mock', style: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  uniswap: { label: 'Coming Soon', style: 'text-gray-400 border-gray-500/30 bg-gray-500/10' },
  lifiearn: { label: 'Live Cross-Chain', style: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10' },
  fhenix: { label: 'Live on Base Sepolia', style: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
};

// Privacy vault treatment — coordinate (violet) tokens, pre-composed in design.ts
const FEATURED = {
  card: 'border-violet-500/40 bg-violet-500/[0.04] hover:border-violet-500/60 hover:bg-violet-500/[0.08] shadow-lg shadow-violet-500/10',
  chip: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  title: 'text-violet-200',
  arrow: 'text-violet-400',
  value: 'text-violet-400',
  divider: 'border-violet-500/20',
  note: 'text-violet-300/70',
} as const;

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
        badge={{ label: 'Fhenix on testnet', tone: 'violet' }}
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
        {/* Fhenix — featured full-width card at top */}
        {(() => {
          const fhenix = YIELD_STRATEGIES.find(s => s.id === 'fhenix');
          if (!fhenix) return null;
          const apy = APY_MAP[fhenix.id];
          const status = STATUS_MAP[fhenix.id];
          const href = buildVaultExecutionHref('strategies', 'vaults', { strategy: fhenix.id });

          return (
            <Link
              key={fhenix.id}
              href={href}
              onClick={() =>
                trackEvent({
                  eventName: 'vault_card_click',
                  properties: { strategy: fhenix.id, source: showOperatorTools ? 'operator' : 'public' },
                })
              }
              className={`group relative flex flex-col justify-between rounded-2xl border p-6 transition-all ${FEATURED.card}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <span className="text-3xl">{fhenix.icon}</span>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${FEATURED.chip}`}>
                        Private
                      </span>
                      <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-300/80">
                        Testnet
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${status.style}`}>
                        {status.label}
                      </span>
                    </div>
                    <h3 className={`text-xl font-bold ${FEATURED.title}`}>{fhenix.name}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-gray-400 max-w-lg">{fhenix.description}</p>
                  </div>
                </div>
                <ArrowRight className={`h-5 w-5 transition-transform group-hover:translate-x-1 mt-2 ${FEATURED.arrow}`} />
              </div>
              <div className={`mt-5 flex items-center gap-6 border-t pt-4 ${FEATURED.divider}`}>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">APY</p>
                  <p className={`text-xl font-black ${FEATURED.value}`}>{apy}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Risk</p>
                  <p className="text-sm font-bold text-white">{fhenix.risk}</p>
                </div>
                <div className={`ml-auto text-xs font-medium ${FEATURED.note}`}>
                  Balances encrypted inside the vault · Private governance · Local balance reveal
                </div>
              </div>
            </Link>
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
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${status.style}`}>
                        {status.label}
                      </span>
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
              Vaults support both public yield flows and privacy-native coordinated capital experiences.
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
