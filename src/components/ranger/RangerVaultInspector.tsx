'use client';

import { useMemo, useState } from 'react';
import { Database, ExternalLink, RefreshCw } from 'lucide-react';

import { CompactCard, CompactGrid } from '@/shared/components/premium/CompactLayout';
import { Button } from '@/shared/components/ui/Button';
import { useRangerExecutionTracker } from '@/hooks/useRangerExecutionTracker';
import {
  createRangerDepositTransaction,
  fetchRangerVaultDetails,
  getRangerVaultManageUrl,
  usdcToLamports,
  type RangerPreparedTransaction,
  type RangerVaultDetails,
} from '@/services/ranger';

export function RangerVaultInspector() {
  const { state } = useRangerExecutionTracker();
  const [vaultDetails, setVaultDetails] = useState<RangerVaultDetails | null>(null);
  const [preparedDeposit, setPreparedDeposit] =
    useState<RangerPreparedTransaction | null>(null);
  const [depositAmount, setDepositAmount] = useState('10');
  const [isLoadingVault, setIsLoadingVault] = useState(false);
  const [isPreparingDeposit, setIsPreparingDeposit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const manageUrl = useMemo(() => {
    return state.vaultPubkey ? getRangerVaultManageUrl(state.vaultPubkey) : null;
  }, [state.vaultPubkey]);

  const handleLoadVault = async () => {
    if (!state.vaultPubkey) {
      setError('Add a vault pubkey in the execution tracker first.');
      return;
    }

    setIsLoadingVault(true);
    setError(null);

    try {
      const details = await fetchRangerVaultDetails(state.vaultPubkey);
      setVaultDetails(details);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load vault.');
      setVaultDetails(null);
    } finally {
      setIsLoadingVault(false);
    }
  };

  const handlePrepareDeposit = async () => {
    if (!state.vaultPubkey) {
      setError('Add a vault pubkey in the execution tracker first.');
      return;
    }

    if (!state.depositWallet) {
      setError('Add the deposit wallet in the execution tracker first.');
      return;
    }

    setIsPreparingDeposit(true);
    setError(null);

    try {
      const prepared = await createRangerDepositTransaction(state.vaultPubkey, {
        userPubkey: state.depositWallet,
        lamportAmount: usdcToLamports(depositAmount),
        assetMint: vaultDetails?.asset?.mint,
      });
      setPreparedDeposit(prepared);
    } catch (prepareError) {
      setError(
        prepareError instanceof Error
          ? prepareError.message
          : 'Failed to prepare deposit transaction.'
      );
      setPreparedDeposit(null);
    } finally {
      setIsPreparingDeposit(false);
    }
  };

  return (
    <CompactCard variant="glass" padding="lg" className="border border-sky-500/20 bg-sky-500/[0.04]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-white">
            <Database className="h-5 w-5 text-sky-300" />
            <h2 className="text-xl font-bold">Vault Inspector</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Inspect the live Ranger vault and prepare a deposit transaction against the documented
            vault endpoints.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-sky-500/30 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20"
            onClick={handleLoadVault}
            disabled={isLoadingVault}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {isLoadingVault ? 'Loading Vault...' : 'Fetch Vault Details'}
          </Button>

          {manageUrl && (
            <a href={manageUrl} target="_blank" rel="noreferrer">
              <Button
                type="button"
                variant="outline"
                className="border-slate-500/30 bg-slate-500/10 text-slate-100 hover:bg-slate-500/20"
              >
                Open Manage Page
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </a>
          )}
        </div>
      </div>

      <CompactGrid columns={2} gap="sm" className="mt-6">
        <CompactCard variant="glass" padding="md" className="border border-white/10 bg-white/[0.03]">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">
            Vault Pubkey
          </label>
          <div className="rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white">
            {state.vaultPubkey || 'Not set'}
          </div>
        </CompactCard>

        <CompactCard variant="glass" padding="md" className="border border-white/10 bg-white/[0.03]">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">
            Deposit Wallet
          </label>
          <div className="rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white">
            {state.depositWallet || 'Not set'}
          </div>
        </CompactCard>
      </CompactGrid>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      {vaultDetails && (
        <CompactGrid columns={2} gap="sm" className="mt-6">
          <CompactCard variant="glass" padding="md" className="border border-white/10 bg-white/[0.03]">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-200">
              Vault Summary
            </h3>
            <div className="mt-3 space-y-2 text-sm text-slate-200">
              <div>Name: {vaultDetails.name || 'Unknown'}</div>
              <div>Symbol: {vaultDetails.symbol || 'Unknown'}</div>
              <div>Asset: {vaultDetails.asset?.symbol || vaultDetails.asset?.mint || 'Unknown'}</div>
              <div>APY: {typeof vaultDetails.apy === 'number' ? `${vaultDetails.apy}%` : 'Unavailable'}</div>
              <div>TVL: {vaultDetails.tvl || 'Unavailable'}</div>
            </div>
          </CompactCard>

          <CompactCard variant="glass" padding="md" className="border border-white/10 bg-white/[0.03]">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-200">
              Allocations
            </h3>
            <div className="mt-3 space-y-2 text-sm text-slate-200">
              {vaultDetails.allocations && vaultDetails.allocations.length > 0 ? (
                vaultDetails.allocations.map((allocation, index) => (
                  <div key={`${allocation.adaptor || allocation.strategy || 'allocation'}-${index}`}>
                    {allocation.adaptor || allocation.strategy || 'Allocation'}{' '}
                    {allocation.value ? `• ${allocation.value}` : ''}
                    {typeof allocation.weightBps === 'number'
                      ? ` • ${(allocation.weightBps / 100).toFixed(2)}%`
                      : ''}
                  </div>
                ))
              ) : (
                <div>No allocation data returned yet.</div>
              )}
            </div>
          </CompactCard>
        </CompactGrid>
      )}

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-200">
          Prepare Deposit Transaction
        </h3>

        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,220px)_auto]">
          <input
            value={depositAmount}
            onChange={(event) => setDepositAmount(event.target.value)}
            placeholder="USDC amount"
            className="rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-sky-400"
          />
          <Button
            type="button"
            variant="outline"
            className="border-sky-500/30 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20"
            onClick={handlePrepareDeposit}
            disabled={isPreparingDeposit}
          >
            {isPreparingDeposit ? 'Preparing...' : 'Prepare Deposit'}
          </Button>
        </div>

        <div className="mt-3 text-sm text-slate-300">
          This uses Ranger’s documented `POST /vault/{'{pubkey}'}/deposit` flow and converts USDC
          to 6-decimal lamports.
        </div>
      </div>

      {preparedDeposit && (
        <CompactCard variant="glass" padding="md" className="mt-6 border border-white/10 bg-white/[0.03]">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-200">
            Prepared Transaction Response
          </h3>
          <div className="mt-3 space-y-2 text-sm text-slate-200">
            <div>
              Serialized tx present:{' '}
              {preparedDeposit.transaction || preparedDeposit.tx ? 'yes' : 'no'}
            </div>
            {preparedDeposit.message && <div>Message: {preparedDeposit.message}</div>}
          </div>
          <pre className="mt-4 max-h-72 overflow-auto rounded-xl border border-white/10 bg-slate-950/70 p-4 text-xs text-slate-300">
            {JSON.stringify(preparedDeposit.raw, null, 2)}
          </pre>
        </CompactCard>
      )}
    </CompactCard>
  );
}
