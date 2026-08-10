/**
 * PrizeDistribution — Winnings & Payouts for a syndicate pool
 *
 * Honesty contract:
 * - Winnings shown are read on-chain from Megapot `usersInfo(coordinator)`
 *   (tickets purchased by a syndicate credit the coordinator address).
 * - The app never pretends to execute a payout. The coordinator claims via
 *   the solo Megapot path, pays members via the pool's own rail (Safe app /
 *   0xSplits / Cabana), then pastes the payout tx hash here; the API
 *   verifies the receipt (success + coordinator-initiated) before journaling.
 * - Member shares displayed are proportional to contributions, recomputed
 *   from current weights (same semantics as /api/portfolio).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import {
  Trophy,
  Check,
  X,
  Clock,
  Loader,
  ExternalLink,
  Users,
  RefreshCw,
  KeyRound,
  Send,
  ClipboardCheck,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { web3Service } from '@/services/web3Service';

type DistributionStatus =
  | 'pending'
  | 'calculating'
  | 'distributing'
  | 'completed'
  | 'failed';

type PoolType = 'safe' | 'splits' | 'pooltogether' | 'fhenix';

interface MemberShare {
  address: string;
  contribution: number;
  contributionPercent: number;
  shareAmount: number;
}

interface PrizeDistributionRow {
  id: string;
  poolId: string;
  status: DistributionStatus;
  prizeAmount: number;
  memberShares: MemberShare[];
  txHash: string | null;
  createdAt: string;
  completedAt: string | null;
  error: string | null;
}

interface PoolMeta {
  poolType: PoolType;
  coordinatorAddress: string;
  safeAddress: string | null;
  splitAddress: string | null;
  ptVaultAddress: string | null;
  memberCount: number;
}

interface PrizeDistributionProps {
  poolId: string;
  /** Connected viewer address (may be null). */
  address?: string | null;
  className?: string;
}

interface PayoutRail {
  title: string;
  description: string;
  href: string | null;
  hrefLabel: string | null;
}

function payoutRailFor(pool: PoolMeta): PayoutRail {
  switch (pool.poolType) {
    case 'safe':
      return {
        title: 'Pay out via the Safe app',
        description:
          'Claimed USDC sits at the coordinator address. Propose USDC transfers to each member in the Safe multisig dashboard — signatures from agreed owners execute the payout.',
        href: pool.safeAddress
          ? `https://app.safe.global/home?safe=base:${pool.safeAddress}`
          : 'https://app.safe.global',
        hrefLabel: 'Open Safe app',
      };
    case 'splits':
      return {
        title: 'Pay out via 0xSplits',
        description:
          'Deposit the claimed USDC into the pool’s split, then call distributeToken (anyone can). Each member receives their configured percentage automatically.',
        href: pool.splitAddress
          ? `https://app.0xsplits.com/accounts/${pool.splitAddress}/?chainId=8453`
          : 'https://app.0xsplits.com',
        hrefLabel: 'Open 0xSplits',
      };
    case 'pooltogether':
      return {
        title: 'Claim via the Cabana app',
        description:
          'PoolTogether prizes live in the prize vault, not the syndicate. Claim them through the Cabana app with the coordinator wallet, then pay members via your Safe or split.',
        href: 'https://app.cabana.fi',
        hrefLabel: 'Open Cabana',
      };
    case 'fhenix':
      return {
        title: 'Coordinator-signed withdrawal',
        description:
          'Fhenix pool payouts execute through the vault’s permit-bound, coordinator-signed withdrawal path (docs/FHENIX.md). Journal the payout tx hash below once it confirms.',
        href: null,
        hrefLabel: null,
      };
  }
}

export function PrizeDistribution({
  poolId,
  address = null,
  className = '',
}: PrizeDistributionProps) {
  const [distributions, setDistributions] = useState<PrizeDistributionRow[]>([]);
  const [pool, setPool] = useState<PoolMeta | null>(null);
  const [members, setMembers] = useState<MemberShare[]>([]);
  const [claimableUsdc, setClaimableUsdc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [recording, setRecording] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [prizeAmountInput, setPrizeAmountInput] = useState('');
  const [txHashInput, setTxHashInput] = useState('');
  const [selectedDistribution, setSelectedDistribution] = useState<PrizeDistributionRow | null>(null);

  const viewerShare =
    address && members.length > 0
      ? members.find((m) => m.address.toLowerCase() === address.toLowerCase()) ?? null
      : null;

  const fetchData = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      const response = await fetch(`/api/syndicates/prizes?poolId=${encodeURIComponent(poolId)}`);
      if (!response.ok) throw new Error('Failed to fetch distributions');

      const data = await response.json();
      setDistributions(data.distributions || []);
      setPool(data.pool || null);
      setMembers(data.members || []);

      const coordinator = data.pool?.coordinatorAddress as string | undefined;
      if (coordinator) {
        // On-chain read: Megapot usersInfo(coordinator) — syndicate ticket
        // purchases credit the coordinator address.
        web3Service
          .getUserInfoForAddress(coordinator)
          .then((info) => setClaimableUsdc(info?.winningsClaimable ?? null))
          .catch(() => setClaimableUsdc(null));
      } else {
        setClaimableUsdc(null);
      }
    } catch (error) {
      logger.error('Failed to fetch distributions', { error: String(error) });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [poolId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const isCoordinator =
    !!address && !!pool && address.toLowerCase() === pool.coordinatorAddress.toLowerCase();

  const handleClaim = async () => {
    if (!isCoordinator) return;
    setClaiming(true);
    setNotice(null);
    try {
      const txHash = await web3Service.claimWinnings();
      setNotice({
        kind: 'ok',
        text: `Claimed from Megapot. Tx: ${txHash.slice(0, 10)}…${txHash.slice(-6)} — pay members via your rail, then journal it below.`,
      });
      fetchData(true);
    } catch (error) {
      setNotice({
        kind: 'err',
        text: error instanceof Error ? error.message : 'Claim failed',
      });
    } finally {
      setClaiming(false);
    }
  };

  const handleRecord = async () => {
    const prizeAmount = parseFloat(prizeAmountInput);
    if (!prizeAmount || prizeAmount <= 0) {
      setNotice({ kind: 'err', text: 'Enter the payout amount in USDC (> 0).' });
      return;
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHashInput.trim())) {
      setNotice({ kind: 'err', text: 'Enter a valid transaction hash (0x + 64 hex chars).' });
      return;
    }

    setRecording(true);
    setNotice(null);
    try {
      const response = await fetch('/api/syndicates/prizes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record',
          poolId,
          prizeAmount,
          txHash: txHashInput.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setNotice({ kind: 'err', text: result.error || 'Verification failed' });
        return;
      }
      setNotice({ kind: 'ok', text: 'Payout verified on-chain and journaled.' });
      setPrizeAmountInput('');
      setTxHashInput('');
      fetchData(true);
    } catch (error) {
      setNotice({
        kind: 'err',
        text: error instanceof Error ? error.message : 'Failed to record payout',
      });
    } finally {
      setRecording(false);
    }
  };

  const getStatusIcon = (status: DistributionStatus) => {
    switch (status) {
      case 'completed':
        return <Check className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <X className="w-4 h-4 text-red-400" />;
      case 'pending':
      case 'calculating':
      case 'distributing':
        return <Clock className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getStatusColor = (status: DistributionStatus) => {
    switch (status) {
      case 'completed':
        return 'text-green-400';
      case 'failed':
        return 'text-red-400';
      case 'pending':
      case 'calculating':
      case 'distributing':
        return 'text-yellow-400';
    }
  };

  const claimable = claimableUsdc !== null ? parseFloat(claimableUsdc) : null;

  if (loading) {
    return (
      <div className={`glass-premium p-6 rounded-2xl border border-white/10 ${className}`}>
        <div className="flex items-center justify-center gap-3 py-8 text-white/60">
          <Loader className="w-5 h-5 animate-spin" />
          <span>Loading payout journal…</span>
        </div>
      </div>
    );
  }

  const rail = pool ? payoutRailFor(pool) : null;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* ── Claimable winnings panel ──────────────────────────────────── */}
      <div className="glass-premium p-6 rounded-2xl border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#FBCC5C]" />
            <h3 className="text-lg font-bold text-white">Winnings &amp; Payouts</h3>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-white/60 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <p className="text-3xl font-black text-white">
          {claimable !== null && claimable > 0 ? (
            <>${claimable.toLocaleString(undefined, { maximumFractionDigits: 2 })}</>
          ) : claimable !== null ? (
            '$0'
          ) : (
            '—'
          )}
        </p>
        <p className="text-sm text-white/60 mt-1">
          Winnings claimable from Megapot by this pool’s coordinator
          {pool ? (
            <>
              {' '}
              <span className="font-mono text-white/40">
                {pool.coordinatorAddress.slice(0, 6)}…{pool.coordinatorAddress.slice(-4)}
              </span>
            </>
          ) : null}
        </p>

        {viewerShare && claimable !== null && claimable > 0 && (
          <p className="text-sm text-[#FBCC5C] mt-2">
            Your estimated share: $
            {((viewerShare.contributionPercent / 100) * claimable).toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}{' '}
            ({viewerShare.contributionPercent.toFixed(1)}% of contributions)
          </p>
        )}

        {!isCoordinator && (
          <p className="text-xs text-white/50 mt-3">
            Only the pool coordinator can claim winnings and pay them out to members.
          </p>
        )}
      </div>

      {/* ── Coordinator payout flow ────────────────────────────────────── */}
      {isCoordinator && pool && rail && (
        <div className="glass-premium p-6 rounded-2xl border border-[#FBCC5C]/20 space-y-5">
          {notice && (
            <div
              className={`p-3 rounded-lg text-sm ${
                notice.kind === 'ok'
                  ? 'bg-green-500/15 border border-green-500/30 text-green-300'
                  : 'bg-red-500/15 border border-red-500/30 text-red-300'
              }`}
            >
              {notice.text}
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 text-white font-semibold mb-1">
              <KeyRound className="w-4 h-4 text-[#FBCC5C]" />
              1. Claim from Megapot
            </div>
            <p className="text-sm text-white/60 mb-3">
              Signs <span className="font-mono">withdrawWinnings()</span> with your coordinator
              wallet — the same real claim path solo players use.
            </p>
            <Button onClick={handleClaim} disabled={claiming || !claimable || claimable <= 0}>
              {claiming ? 'Claiming…' : claimable !== null && claimable > 0 ? 'Claim winnings' : 'Nothing to claim'}
            </Button>
          </div>

          <div>
            <div className="flex items-center gap-2 text-white font-semibold mb-1">
              <Send className="w-4 h-4 text-[#FBCC5C]" />
              2. {rail.title}
            </div>
            <p className="text-sm text-white/60 mb-3">{rail.description}</p>
            {rail.href && (
              <a
                href={rail.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-[#FBCC5C] hover:underline"
              >
                {rail.hrefLabel}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 text-white font-semibold mb-1">
              <ClipboardCheck className="w-4 h-4 text-[#FBCC5C]" />
              3. Journal the payout
            </div>
            <p className="text-sm text-white/60 mb-3">
              Paste the payout transaction hash. It’s verified on-chain (must have succeeded and
              been sent by you) before this pool’s journal records it.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Amount (USDC)"
                value={prizeAmountInput}
                onChange={(e) => setPrizeAmountInput(e.target.value)}
                className="w-full sm:w-40 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#FBCC5C]/50"
              />
              <input
                type="text"
                placeholder="0x… transaction hash"
                value={txHashInput}
                onChange={(e) => setTxHashInput(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono placeholder:text-white/30 focus:outline-none focus:border-[#FBCC5C]/50"
              />
              <Button onClick={handleRecord} disabled={recording} variant="secondary">
                {recording ? 'Verifying…' : 'Verify & record'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Payout journal ────────────────────────────────────────────── */}
      <div className="glass-premium p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-[#FBCC5C]" />
          <h3 className="text-lg font-bold text-white">Payout Journal</h3>
        </div>

        {distributions.length === 0 ? (
          <p className="text-white/60 text-sm text-center py-6">
            No payouts journaled yet. When this pool wins, the coordinator’s verified payouts will
            appear here.
          </p>
        ) : (
          <div className="space-y-3">
            {distributions.map((dist) => (
              <div
                key={dist.id}
                className="bg-white/5 rounded-xl p-4 hover:bg-white/10 transition-colors cursor-pointer"
                onClick={() =>
                  setSelectedDistribution(
                    selectedDistribution?.id === dist.id ? null : dist
                  )
                }
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(dist.status)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">
                          ${dist.prizeAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                        <span className={`text-xs font-semibold ${getStatusColor(dist.status)}`}>
                          {dist.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-white/50 mt-0.5">
                        {dist.memberShares.length} members • {new Date(dist.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {dist.txHash && (
                    <a
                      href={`https://basescan.org/tx/${dist.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-[#FBCC5C] hover:underline flex items-center gap-1"
                    >
                      {dist.txHash.slice(0, 6)}…{dist.txHash.slice(-4)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {selectedDistribution?.id === dist.id && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-xs text-white/50 uppercase font-semibold mb-2">
                      Estimated member shares
                    </p>
                    <div className="space-y-1.5">
                      {dist.memberShares.slice(0, 10).map((share) => (
                        <div
                          key={share.address}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="font-mono text-white/70">
                            {share.address.slice(0, 6)}…{share.address.slice(-4)}
                          </span>
                          <div className="text-right">
                            <span className="text-white font-semibold">
                              ${share.shareAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-white/40 text-xs ml-2">
                              ({share.contributionPercent.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                      ))}
                      {dist.memberShares.length > 10 && (
                        <p className="text-xs text-white/40 text-center pt-1">
                          + {dist.memberShares.length - 10} more members
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10">
          <p className="text-xs text-white/50">
            Journaled payouts are verified against their on-chain receipts (succeeded and
            coordinator-initiated) before being recorded. Shares are proportional to contributions
            at read time, matching the portfolio view.
          </p>
        </div>
      </div>
    </div>
  );
}
