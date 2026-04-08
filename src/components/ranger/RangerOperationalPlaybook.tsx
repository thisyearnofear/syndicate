'use client';

import { ExternalLink, TerminalSquare } from 'lucide-react';

import { CompactCard } from '@/shared/components/premium/CompactLayout';
import { Button } from '@/shared/components/ui/Button';

const playbookSteps = [
  {
    title: '1. Create The Vault',
    body: 'Use Ranger’s vault creation UI first. Save the resulting vault public key immediately because every later management and verification step depends on it.',
    links: [
      {
        label: 'Vault Creation UI',
        href: 'https://vaults.ranger.finance/create',
      },
      {
        label: 'Quick Start UI Guide',
        href: 'https://docs.ranger.finance/ranger-earn/for-vault-managers/vault-initialization-guide/quick-start-ui',
      },
    ],
  },
  {
    title: '2. Add Adaptors And Configure',
    body: 'After creation, move to the vault manage page to add adaptors and update admin-level configuration. This is the handoff point from vault setup into strategy setup.',
    links: [
      {
        label: 'Vault Owner Overview',
        href: 'https://docs.ranger.finance/vault-owners/overview',
      },
      {
        label: 'Workshop Repo',
        href: 'https://github.com/ranger-finance/hackathon-workshop-01',
      },
    ],
  },
  {
    title: '3. Initialize Strategy And Allocate',
    body: 'The vault does not earn yield until the strategy is initialized and idle funds are allocated into the chosen venues. For this build, the primary path is the Solana USDC carry allocator.',
    links: [
      {
        label: 'Workshop Repo Scripts',
        href: 'https://github.com/ranger-finance/hackathon-workshop-01',
      },
      {
        label: 'Vault API Endpoints',
        href: 'https://docs.ranger.finance/developers/endpoints/vault',
      },
    ],
  },
  {
    title: '4. Run Bot And Capture Evidence',
    body: 'Execute the rebalance or automation path at least once, then record the tx links, wallets, and vault pubkey in the tracker for submission evidence and the demo video.',
    links: [
      {
        label: 'Vault API Endpoints',
        href: 'https://docs.ranger.finance/developers/endpoints/vault',
      },
      {
        label: 'Workshop Repo',
        href: 'https://github.com/ranger-finance/hackathon-workshop-01',
      },
    ],
  },
];

export function RangerOperationalPlaybook() {
  return (
    <CompactCard variant="glass" padding="lg" className="border border-white/10 bg-white/[0.04]">
      <div className="flex items-center gap-2 text-white">
        <TerminalSquare className="h-5 w-5 text-lime-300" />
        <h2 className="text-xl font-bold">Operational Playbook</h2>
      </div>

      <div className="mt-6 space-y-4">
        {playbookSteps.map((step) => (
          <div
            key={step.title}
            className="rounded-2xl border border-white/10 bg-slate-950/50 p-5"
          >
            <h3 className="text-lg font-bold text-white">{step.title}</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{step.body}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {step.links.map((link) => (
                <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                  <Button
                    variant="outline"
                    className="border-lime-500/30 bg-lime-500/10 text-lime-100 hover:bg-lime-500/20"
                  >
                    {link.label}
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </CompactCard>
  );
}
