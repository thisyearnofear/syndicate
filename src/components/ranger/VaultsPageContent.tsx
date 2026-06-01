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
import {
  CompactContainer,
  CompactSection,
} from '@/shared/components/premium/CompactLayout';
import { YIELD_STRATEGIES } from '@/config/yieldStrategies';
import type { SupportedYieldStrategyId } from '@/config/yieldStrategies';
import { getProductModeById } from '@/config/productModes';
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

export function VaultsPageContent({
  showOperatorTools = false,
}: VaultsPageContentProps) {
  const yieldMode = getProductModeById('yield_to_tickets');
  const privateVaultMode = getProductModeById('private_vaults');

  return (
    <div className="min-h-screen bg-[#020617] bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_40%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.05),transparent_40%)] px-4 py-8">
      <CompactContainer maxWidth="2xl">
        <CompactSection spacing="lg">
          {/* Nav */}
          <div className="flex items-center justify-between">
            <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-white transition-colors">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Home
            </Link>
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
          </div>

          {/* Hero — short */}
          <div className="space-y-3 pt-4">
            <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
              Vaults
            </h1>
            <p className="max-w-xl text-gray-400">
              Deposit into vault strategies on Base and auto-convert earnings into lottery tickets or cause allocations. The featured Fhenix vault demonstrates privacy-by-design — encrypted deposits, private governance, and local balance reveal via Fully Homomorphic Encryption.
            </p>
            <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-gray-200">
              <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-300">
                Demo path
              </span>
              <span>Deposit into the Fhenix vault, then reveal the encrypted balance locally from your portfolio.</span>
            </div>
          </div>

          {/* Vault cards */}
          <div className="space-y-4 pt-2">
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
                  className="group relative flex flex-col justify-between rounded-2xl border border-amber-500/40 bg-amber-500/[0.04] p-6 transition-all hover:border-amber-500/60 hover:bg-amber-500/[0.08] shadow-lg shadow-amber-500/10"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <span className="text-3xl">{fhenix.icon}</span>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 border border-amber-500/30">
                            🎯 Buildathon Demo
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${status.style}`}>
                            {status.label}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-amber-200">{fhenix.name}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-gray-400 max-w-lg">{fhenix.description}</p>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-amber-400 transition-transform group-hover:translate-x-1 mt-2" />
                  </div>
                  <div className="mt-5 flex items-center gap-6 border-t border-amber-500/20 pt-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">APY</p>
                      <p className="text-xl font-black text-amber-400">{apy}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Risk</p>
                      <p className="text-sm font-bold text-white">{fhenix.risk}</p>
                    </div>
                    <div className="ml-auto text-xs text-amber-300/70 font-medium">
                      Encrypted deposits · Private governance · Local balance reveal
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
                  className="group relative flex flex-col justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-all hover:border-white/15 hover:bg-white/[0.04] hover:shadow-lg"
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
          </div>

          {/* Bottom info — minimal */}
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
        </CompactSection>
      </CompactContainer>
    </div>
  );
}
