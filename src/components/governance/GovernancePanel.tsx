/**
 * GovernancePanel — Fhenix encrypted on-chain governance UI
 *
 * Displays proposals from the FhenixGovernor contract and allows:
 * - Members to cast encrypted votes (yes/no/abstain) via FHE
 * - Coordinator to create proposals, reveal tallies, and finalize
 * - All users to see proposal state and results after finalization
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Vote,
  Plus,
  Shield,
  Check,
  X,
  Minus,
  Loader,
  RefreshCw,
  Clock,
  AlertCircle,
  ExternalLink,
  Lock,
  KeyRound,
  Eye,
  FileText,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { useWalletClient, usePublicClient } from 'wagmi';
import { FHENIX_VAULT_CHAIN } from '@/services/fhe/fhenixChain';
import { FhenixGovernorService, type VoteChoice, type FhenixProposal } from '@/services/governance/fhenixGovernorService';

/* ── Types ───────────────────────────────────────────────────────────────── */

interface GovernancePanelProps {
  governorAddress?: `0x${string}`;
  userAddress?: string;
  isCoordinator?: boolean;
  isMember?: boolean;
  className?: string;
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const PROPOSAL_STATE_UI: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  Pending: { label: 'Pending', color: 'text-gray-400 bg-gray-500/10', icon: Clock },
  Active: { label: 'Voting Open', color: 'text-emerald-300 bg-emerald-500/10', icon: Vote },
  Passed: { label: 'Passed', color: 'text-blue-300 bg-blue-500/10', icon: Check },
  Failed: { label: 'Failed', color: 'text-red-300 bg-red-500/10', icon: X },
  Executed: { label: 'Executed', color: 'text-purple-300 bg-purple-500/10', icon: Check },
};

const VOTE_CHOICE_UI: Record<
  VoteChoice,
  { label: string; color: string; icon: React.ElementType }
> = {
  yes: { label: 'For', color: 'text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20', icon: Check },
  no: { label: 'Against', color: 'text-red-400 border-red-500/30 hover:bg-red-500/20', icon: X },
  abstain: { label: 'Abstain', color: 'text-gray-400 border-gray-500/30 hover:bg-gray-500/20', icon: Minus },
};

function formatAddress(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function timeRemaining(deadline: Date): string {
  const now = Date.now();
  const diff = deadline.getTime() - now;
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h remaining`;
}

/* ── Main Component ──────────────────────────────────────────────────────── */

export function GovernancePanel({
  governorAddress,
  userAddress,
  isCoordinator = false,
  isMember = false,
  className = '',
}: GovernancePanelProps) {
  const { data: fhenixWalletClient } = useWalletClient({ chainId: FHENIX_VAULT_CHAIN.id });
  const fhenixPublicClient = usePublicClient({ chainId: FHENIX_VAULT_CHAIN.id });

  const [proposals, setProposals] = useState<FhenixProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createTarget, setCreateTarget] = useState('');
  const [createData, setCreateData] = useState('0x');
  const [createDeadline, setCreateDeadline] = useState(7); // days

  const governorService = governorAddress
    ? new FhenixGovernorService({
        governorAddress,
        vaultAddress: (process.env.NEXT_PUBLIC_FHENIX_VAULT_ADDRESS || '0x') as `0x${string}`,
        coordinatorAddress: '',
        quorumBps: 2500,
      })
    : null;

  /* ── Fetch proposals ──────────────────────────────────────────────────── */

  const fetchProposals = useCallback(async () => {
    if (!governorService || !fhenixPublicClient) return;
    setLoading(true);
    try {
      const result = await governorService.getProposals(fhenixPublicClient, userAddress);
      setProposals(result);
      setError(null);
    } catch (err) {
      console.error('[GovernancePanel] fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load proposals');
    } finally {
      setLoading(false);
    }
  }, [governorService, fhenixPublicClient, userAddress]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  /* ── Create proposal ──────────────────────────────────────────────────── */

  const handleCreateProposal = async () => {
    if (!governorService || !fhenixWalletClient || !fhenixPublicClient) return;
    if (!createTitle.trim()) return;

    setActionLoading('create');
    try {
      const result = await governorService.createProposal(
        fhenixWalletClient,
        fhenixPublicClient,
        createTitle.trim(),
        createDesc.trim(),
        createTarget.trim() || '0x0000000000000000000000000000000000000000',
        createData.trim() || '0x',
        createDeadline,
      );
      if (result.success) {
        setShowCreateForm(false);
        setCreateTitle('');
        setCreateDesc('');
        setCreateTarget('');
        setCreateData('0x');
        setCreateDeadline(7);
        await fetchProposals();
      } else {
        setError(result.error || 'Failed to create proposal');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create proposal');
    } finally {
      setActionLoading(null);
    }
  };

  /* ── Vote ─────────────────────────────────────────────────────────────── */

  const handleVote = async (proposalId: number, choice: VoteChoice) => {
    if (!governorService || !fhenixWalletClient || !fhenixPublicClient) return;

    setActionLoading(`vote-${proposalId}`);
    try {
      const result = await governorService.castVote(
        fhenixWalletClient,
        fhenixPublicClient,
        proposalId,
        choice,
      );
      if (result.success) {
        await fetchProposals();
      } else {
        setError(result.error || 'Failed to cast vote');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cast vote');
    } finally {
      setActionLoading(null);
    }
  };

  /* ── Reveal tally + finalize ──────────────────────────────────────────── */

  const handleRevealAndFinalize = async (proposalId: number) => {
    if (!governorService || !fhenixPublicClient || !userAddress) return;

    setActionLoading(`reveal-${proposalId}`);
    try {
      const tally = await governorService.revealAndDecryptTally(
        fhenixPublicClient,
        proposalId,
        userAddress,
      );
      if (!tally.success) {
        setError(tally.error || 'Failed to reveal tally');
        return;
      }

      if (!fhenixWalletClient) {
        setError('Wallet client not available for finalize transaction');
        return;
      }

      const finalResult = await governorService.finalizeProposal(
        fhenixWalletClient,
        fhenixPublicClient,
        proposalId,
        tally.forVotes ?? 0,
        tally.againstVotes ?? 0,
        tally.abstainVotes ?? 0,
      );

      if (finalResult.success) {
        await fetchProposals();
      } else {
        setError(finalResult.error || 'Failed to finalize proposal');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reveal/finalize');
    } finally {
      setActionLoading(null);
    }
  };

  /* ── Execute ──────────────────────────────────────────────────────────── */

  const handleExecute = async (proposalId: number) => {
    if (!governorService || !fhenixWalletClient || !fhenixPublicClient) return;

    setActionLoading(`exec-${proposalId}`);
    try {
      const result = await governorService.executeProposal(
        fhenixWalletClient,
        fhenixPublicClient,
        proposalId,
      );
      if (result.success) {
        await fetchProposals();
      } else {
        setError(result.error || 'Failed to execute proposal');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute proposal');
    } finally {
      setActionLoading(null);
    }
  };

  /* ── Render ───────────────────────────────────────────────────────────── */

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Vote className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-bold text-white">Governance</h3>
          {proposals.length > 0 && (
            <span className="text-xs text-gray-400">({proposals.length} proposal{proposals.length !== 1 ? 's' : ''})</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-purple-500/10 px-2.5 py-1 text-[11px] font-medium text-purple-300">
            FHE Encrypted Voting
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchProposals}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Privacy notice */}
      <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 px-3 py-2 text-xs text-gray-300 flex items-start gap-2">
        <Lock className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
        <span>
          Votes are encrypted on-chain using FHE. No one — including the coordinator — can see how you voted until the tally is revealed after the deadline.
        </span>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-300 hover:text-red-200">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader className="w-6 h-6 text-purple-400 animate-spin" />
          <span className="ml-3 text-sm text-gray-400">Loading proposals…</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && proposals.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <FileText className="w-10 h-10 text-gray-600" />
          <p className="text-gray-400 text-sm">No proposals yet</p>
          {isCoordinator && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateForm(true)}
              className="border-purple-400/30"
            >
              <Plus className="w-4 h-4 mr-1" />
              Create First Proposal
            </Button>
          )}
        </div>
      )}

      {/* Create proposal form */}
      {showCreateForm && (
        <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-purple-400" />
            New Proposal
          </h4>

          <input
            type="text"
            placeholder="Proposal title"
            value={createTitle}
            onChange={(e) => setCreateTitle(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-purple-400/50 focus:outline-none"
          />

          <textarea
            placeholder="Description (optional)"
            value={createDesc}
            onChange={(e) => setCreateDesc(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-purple-400/50 focus:outline-none resize-none"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Target Address (optional)</label>
              <input
                type="text"
                placeholder="0x…"
                value={createTarget}
                onChange={(e) => setCreateTarget(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-purple-400/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Payload Data (optional)</label>
              <input
                type="text"
                placeholder="0x…"
                value={createData}
                onChange={(e) => setCreateData(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-purple-400/50 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">Voting period (days)</label>
              <input
                type="number"
                min={1}
                max={30}
                value={createDeadline}
                onChange={(e) => setCreateDeadline(Math.max(1, Math.min(30, parseInt(e.target.value) || 7)))}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-purple-400/50 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="default"
              size="sm"
              disabled={!createTitle.trim() || actionLoading === 'create'}
              onClick={handleCreateProposal}
              className="bg-purple-600 hover:bg-purple-500"
            >
              {actionLoading === 'create' ? (
                <><Loader className="w-4 h-4 mr-1 animate-spin" />Creating…</>
              ) : (
                <><Plus className="w-4 h-4 mr-1" />Create Proposal</>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowCreateForm(false);
                setCreateTitle('');
                setCreateDesc('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Create button (when form not shown) */}
      {!showCreateForm && isCoordinator && proposals.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCreateForm(true)}
          className="border-purple-400/30 w-full"
        >
          <Plus className="w-4 h-4 mr-1" />
          New Proposal
        </Button>
      )}

      {/* Proposals list */}
      {!loading && proposals.length > 0 && (
        <div className="space-y-3">
          {proposals.map((proposal) => {
            const stateUI = PROPOSAL_STATE_UI[proposal.state] || PROPOSAL_STATE_UI.Pending;
            const StateIcon = stateUI.icon;

            return (
              <div
                key={proposal.id}
                className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-500">#{proposal.id}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${stateUI.color}`}>
                        <StateIcon className="w-3 h-3" />
                        {stateUI.label}
                      </span>
                      {proposal.state === 'Active' && (
                        <span className="text-[10px] text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {timeRemaining(proposal.deadline)}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-semibold text-white truncate">{proposal.title}</h4>
                    {proposal.description && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{proposal.description}</p>
                    )}
                    {proposal.target !== '0x0000000000000000000000000000000000000000' && (
                      <div className="mt-2 flex items-center gap-2 rounded bg-white/5 px-2 py-1 text-[10px] text-gray-400 border border-white/5">
                        <ExternalLink className="w-3 h-3" />
                        <span className="truncate">Target: {formatAddress(proposal.target)}</span>
                        {proposal.data !== '0x' && (
                          <>
                            <span className="text-gray-600">|</span>
                            <span className="truncate">Data: {proposal.data.slice(0, 10)}…</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-500 shrink-0">
                    by {formatAddress(proposal.proposer)}
                  </span>
                </div>

                {/* Vote counts (when tally revealed) */}
                {(proposal.tallyRevealed || proposal.state === 'Passed' || proposal.state === 'Failed' || proposal.state === 'Executed') && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-emerald-500/10 p-2 text-center">
                      <p className="text-lg font-bold text-emerald-400">{proposal.forVotes}</p>
                      <p className="text-[10px] text-gray-400">For</p>
                    </div>
                    <div className="rounded-lg bg-red-500/10 p-2 text-center">
                      <p className="text-lg font-bold text-red-400">{proposal.againstVotes}</p>
                      <p className="text-[10px] text-gray-400">Against</p>
                    </div>
                    <div className="rounded-lg bg-gray-500/10 p-2 text-center">
                      <p className="text-lg font-bold text-gray-400">{proposal.abstainVotes}</p>
                      <p className="text-[10px] text-gray-400">Abstain</p>
                    </div>
                  </div>
                )}

                {/* Vote tally encrypting indicator */}
                {proposal.state === 'Active' && !proposal.tallyRevealed && proposal.voteCount > 0 && (
                  <div className="flex items-center gap-2 text-[11px] text-gray-500">
                    <Lock className="w-3 h-3" />
                    <span>{proposal.voteCount} vote{proposal.voteCount !== 1 ? 's' : ''} cast (encrypted)</span>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Vote buttons (active proposals only) */}
                  {proposal.state === 'Active' && isMember && !proposal.hasVoted && (
                    <div className="flex items-center gap-1.5">
                      {(Object.entries(VOTE_CHOICE_UI) as [VoteChoice, typeof VOTE_CHOICE_UI['yes']][]).map(([choice, ui]) => {
                        const Icon = ui.icon;
                        const loadingKey = `vote-${proposal.id}`;
                        const isBusy = actionLoading === loadingKey;

                        return (
                          <Button
                            key={choice}
                            variant="outline"
                            size="sm"
                            disabled={isBusy}
                            onClick={() => handleVote(proposal.id, choice)}
                            className={`border ${ui.color} text-xs h-8`}
                          >
                            {isBusy ? (
                              <Loader className="w-3 h-3 animate-spin" />
                            ) : (
                              <Icon className="w-3 h-3 mr-1" />
                            )}
                            {ui.label}
                          </Button>
                        );
                      })}
                    </div>
                  )}

                  {/* Already voted badge */}
                  {proposal.state === 'Active' && proposal.hasVoted && (
                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Voted
                    </span>
                  )}

                  {/* Coordinator: reveal + finalize */}
                  {isCoordinator && 
                    proposal.state === 'Active' && 
                    !proposal.tallyRevealed && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionLoading === `reveal-${proposal.id}`}
                      onClick={() => handleRevealAndFinalize(proposal.id)}
                      className="border-purple-400/30 text-purple-300 hover:bg-purple-500/20 text-xs h-8"
                    >
                      {actionLoading === `reveal-${proposal.id}` ? (
                        <><Loader className="w-3 h-3 mr-1 animate-spin" />Revealing…</>
                      ) : (
                        <><Eye className="w-3 h-3 mr-1" />Reveal & Finalize</>
                      )}
                    </Button>
                  )}

                  {/* Coordinator: execute */}
                  {isCoordinator && proposal.state === 'Passed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionLoading === `exec-${proposal.id}`}
                      onClick={() => handleExecute(proposal.id)}
                      className="border-blue-400/30 text-blue-300 hover:bg-blue-500/20 text-xs h-8"
                    >
                      {actionLoading === `exec-${proposal.id}` ? (
                        <><Loader className="w-3 h-3 mr-1 animate-spin" />Executing…</>
                      ) : (
                        <><Check className="w-3 h-3 mr-1" />Execute</>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* No FHE wallet notice */}
      {!fhenixPublicClient && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Connect a wallet on Fhenix chain to participate in governance.</span>
        </div>
      )}

      {/* No governor address notice */}
      {!governorAddress && (
        <div className="flex items-center gap-2 rounded-lg border border-gray-500/20 bg-gray-500/10 px-3 py-2 text-xs text-gray-400">
          <Shield className="w-3.5 h-3.5 shrink-0" />
          <span>Fhenix governance contract not deployed for this syndicate.</span>
        </div>
      )}
    </div>
  );
}

export default GovernancePanel;
