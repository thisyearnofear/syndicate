'use client';

import { ExternalLink, RefreshCcw, Wallet } from 'lucide-react';

import { Button } from '@/shared/components/ui/Button';
import { CompactCard, CompactGrid } from '@/shared/components/premium/CompactLayout';
import {
  useRangerExecutionTracker,
  type RangerExecutionChecklist,
} from '@/hooks/useRangerExecutionTracker';

const checklistLabels: Record<keyof RangerExecutionChecklist, string> = {
  createVault: 'Vault created on Ranger',
  addAdaptors: 'Adapters added to vault',
  initializeStrategies: 'Strategies initialized',
  allocateFunds: 'Funds allocated into the strategy',
  runBot: 'Rebalance bot executed at least once',
  collectEvidence: 'Submission evidence and tx links collected',
};

function formatUpdatedAt(timestamp: number | null): string {
  if (!timestamp) return 'No live execution data yet';
  return new Date(timestamp).toLocaleString();
}

export function RangerExecutionTracker() {
  const { state, isLoaded, updateField, toggleChecklistItem, reset } =
    useRangerExecutionTracker();

  const completedCount = Object.values(state.checklist).filter(Boolean).length;
  const totalCount = Object.keys(state.checklist).length;
  const manageUrl = state.vaultPubkey
    ? `https://vaults.ranger.finance/manage/${state.vaultPubkey}`
    : null;
  const vaultEndpointUrl = state.vaultPubkey
    ? `https://docs.ranger.finance/developers/endpoints/vault`
    : 'https://docs.ranger.finance/developers/endpoints/vault';

  return (
    <CompactCard variant="glass" padding="lg" className="border border-cyan-500/20 bg-cyan-500/[0.04]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-white">
            <Wallet className="h-5 w-5 text-cyan-300" />
            <h2 className="text-xl font-bold">Live Execution Tracker</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Track the real Ranger vault setup here as addresses and transactions become available.
          </p>
        </div>

        <div className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100">
          {completedCount}/{totalCount} steps complete
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
        {isLoaded ? `Last updated: ${formatUpdatedAt(state.updatedAt)}` : 'Loading tracker state...'}
      </div>

      <CompactGrid columns={2} gap="sm" className="mt-6">
        <CompactCard variant="glass" padding="md" className="border border-white/10 bg-white/[0.03]">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            Vault Pubkey
          </label>
          <input
            value={state.vaultPubkey}
            onChange={(event) => updateField('vaultPubkey', event.target.value)}
            placeholder="Ranger vault public key"
            className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
          />
        </CompactCard>

        <CompactCard variant="glass" padding="md" className="border border-white/10 bg-white/[0.03]">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            Admin Wallet
          </label>
          <input
            value={state.adminWallet}
            onChange={(event) => updateField('adminWallet', event.target.value)}
            placeholder="Vault admin wallet"
            className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
          />
        </CompactCard>

        <CompactCard variant="glass" padding="md" className="border border-white/10 bg-white/[0.03]">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            Manager Wallet
          </label>
          <input
            value={state.managerWallet}
            onChange={(event) => updateField('managerWallet', event.target.value)}
            placeholder="Strategy manager wallet"
            className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
          />
        </CompactCard>

        <CompactCard variant="glass" padding="md" className="border border-white/10 bg-white/[0.03]">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            Deposit Wallet
          </label>
          <input
            value={state.depositWallet}
            onChange={(event) => updateField('depositWallet', event.target.value)}
            placeholder="Wallet used for live test deposit"
            className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
          />
        </CompactCard>
      </CompactGrid>

      <CompactGrid columns={2} gap="sm" className="mt-4">
        <CompactCard variant="glass" padding="md" className="border border-white/10 bg-white/[0.03]">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            Selected Adaptors
          </label>
          <input
            value={state.selectedAdaptors}
            onChange={(event) => updateField('selectedAdaptors', event.target.value)}
            placeholder="Kamino Lend, Jupiter Lend"
            className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
          />
        </CompactCard>

        <CompactCard variant="glass" padding="md" className="border border-white/10 bg-white/[0.03]">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            Rebalance Bot Status
          </label>
          <input
            value={state.rebalanceBotStatus}
            onChange={(event) => updateField('rebalanceBotStatus', event.target.value)}
            placeholder="Not started"
            className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
          />
        </CompactCard>
      </CompactGrid>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <a href="https://vaults.ranger.finance/create" target="_blank" rel="noreferrer">
          <Button
            type="button"
            variant="outline"
            className="w-full border-cyan-500/30 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
          >
            Open Create Vault
            <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </a>

        {manageUrl ? (
          <a href={manageUrl} target="_blank" rel="noreferrer">
            <Button
              type="button"
              variant="outline"
              className="w-full border-cyan-500/30 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
            >
              Open Manage Vault
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </a>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled
            className="w-full border-white/10 bg-white/[0.03] text-slate-400"
          >
            Add Vault Pubkey First
          </Button>
        )}

        <a href={vaultEndpointUrl} target="_blank" rel="noreferrer">
          <Button
            type="button"
            variant="outline"
            className="w-full border-cyan-500/30 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
          >
            Open Vault API Docs
            <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </a>
      </div>

      {manageUrl && (
        <div className="mt-4 rounded-xl border border-cyan-500/20 bg-black/20 px-4 py-3 text-sm text-slate-300">
          Active manage URL: <span className="break-all text-cyan-100">{manageUrl}</span>
        </div>
      )}

      <CompactGrid columns={3} gap="sm" className="mt-4">
        <CompactCard variant="glass" padding="md" className="border border-white/10 bg-white/[0.03]">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            Initialization Tx
          </label>
          <input
            value={state.initializationTx}
            onChange={(event) => updateField('initializationTx', event.target.value)}
            placeholder="Solscan tx link or signature"
            className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
          />
        </CompactCard>

        <CompactCard variant="glass" padding="md" className="border border-white/10 bg-white/[0.03]">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            Allocation Tx
          </label>
          <input
            value={state.allocationTx}
            onChange={(event) => updateField('allocationTx', event.target.value)}
            placeholder="Solscan tx link or signature"
            className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
          />
        </CompactCard>

        <CompactCard variant="glass" padding="md" className="border border-white/10 bg-white/[0.03]">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            Bot Run Tx
          </label>
          <input
            value={state.botRunTx}
            onChange={(event) => updateField('botRunTx', event.target.value)}
            placeholder="Solscan tx link or signature"
            className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
          />
        </CompactCard>
      </CompactGrid>

      <CompactCard variant="glass" padding="md" className="mt-4 border border-white/10 bg-white/[0.03]">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
          Execution Notes
        </label>
        <textarea
          value={state.notes}
          onChange={(event) => updateField('notes', event.target.value)}
          placeholder="Operational notes, blockers, or reminders for submission prep"
          rows={5}
          className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
        />
      </CompactCard>

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
          Checklist
        </h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {Object.entries(checklistLabels).map(([key, label]) => {
            const typedKey = key as keyof RangerExecutionChecklist;
            const complete = state.checklist[typedKey];

            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleChecklistItem(typedKey)}
                className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                  complete
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                    : 'border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="text-sm text-slate-300">
          Changes auto-save in local storage on this machine.
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-rose-500/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
          onClick={reset}
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          Reset Tracker
        </Button>
      </div>
    </CompactCard>
  );
}
