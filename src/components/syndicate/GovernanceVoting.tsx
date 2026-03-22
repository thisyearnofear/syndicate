"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/shared/components/ui/Button";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { Vote, Plus, CircleCheck, X, Clock, Users, AlertCircle, ChevronDown, ChevronUp, Send, Ban } from "lucide-react";

interface Proposal {
  id: string;
  poolId: string;
  type: 'ticket_purchase' | 'fund_allocation' | 'member_add' | 'member_remove' | 'config_change';
  title: string;
  description: string;
  proposer: string;
  status: 'pending' | 'active' | 'passed' | 'failed' | 'executed' | 'cancelled';
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
  quorum: number;
  expiresAt: string;
  executedAt?: string;
  txHash?: string;
  proposalData?: Record<string, unknown>;
  createdAt: string;
}

interface VoteRecord {
  id: string;
  proposalId: string;
  voter: string;
  choice: 'yes' | 'no' | 'abstain';
  reason?: string;
  createdAt: string;
}

interface GovernanceVotingProps {
  poolId: string;
}

export function GovernanceVoting({ poolId }: GovernanceVotingProps) {
  const { address } = useWalletConnection();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedProposal, setExpandedProposal] = useState<string | null>(null);
  const [votingFor, setVotingFor] = useState<string | null>(null);
  const [userVotes, setUserVotes] = useState<Set<string>>(new Set());

  const fetchProposals = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/governance?poolId=${encodeURIComponent(poolId)}`);
      if (!response.ok) throw new Error('Failed to fetch proposals');
      const data = await response.json();
      setProposals(data.proposals || []);
      
      // Fetch user votes if connected
      if (address) {
        const votesResponse = await fetch(`/api/governance?poolId=${encodeURIComponent(poolId)}&voter=${encodeURIComponent(address)}`);
        if (votesResponse.ok) {
          const votesData = await votesResponse.json();
          setUserVotes(new Set(votesData.votes?.map((v: VoteRecord) => v.proposalId) || []));
        }
      }
    } catch (err) {
      console.error('Error fetching governance proposals:', err);
      setError(err instanceof Error ? err.message : 'Failed to load proposals');
    } finally {
      setLoading(false);
    }
  }, [poolId, address]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const handleVote = async (proposalId: string, choice: 'yes' | 'no' | 'abstain', reason?: string) => {
    if (!address) return;
    
    setVotingFor(proposalId);
    try {
      const response = await fetch('/api/governance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'vote',
          proposalId,
          voter: address,
          choice,
          reason
        })
      });
      
      if (!response.ok) throw new Error('Failed to cast vote');
      
      // Update local state
      setUserVotes(prev => new Set([...prev, proposalId]));
      fetchProposals();
    } catch (err) {
      console.error('Error casting vote:', err);
      setError(err instanceof Error ? err.message : 'Failed to cast vote');
    } finally {
      setVotingFor(null);
    }
  };

  const getTypeIcon = (type: Proposal['type']) => {
    switch (type) {
      case 'ticket_purchase': return '🎟️';
      case 'fund_allocation': return '💰';
      case 'member_add': return '➕';
      case 'member_remove': return '➖';
      case 'config_change': return '⚙️';
      default: return '📋';
    }
  };

  const getTypeLabel = (type: Proposal['type']) => {
    switch (type) {
      case 'ticket_purchase': return 'Ticket Purchase';
      case 'fund_allocation': return 'Fund Allocation';
      case 'member_add': return 'Add Member';
      case 'member_remove': return 'Remove Member';
      case 'config_change': return 'Config Change';
      default: return 'Proposal';
    }
  };

  const getStatusBadge = (status: Proposal['status']) => {
    const baseClasses = "text-xs px-2 py-1 rounded-full font-medium";
    switch (status) {
      case 'active':
        return <span className={`${baseClasses} bg-green-500/20 text-green-400`}>Active</span>;
      case 'passed':
        return <span className={`${baseClasses} bg-blue-500/20 text-blue-400`}>Passed</span>;
      case 'failed':
        return <span className={`${baseClasses} bg-red-500/20 text-red-400`}>Failed</span>;
      case 'executed':
        return <span className={`${baseClasses} bg-purple-500/20 text-purple-400`}>Executed</span>;
      case 'pending':
        return <span className={`${baseClasses} bg-yellow-500/20 text-yellow-400`}>Pending</span>;
      case 'cancelled':
        return <span className={`${baseClasses} bg-gray-500/20 text-gray-400`}>Cancelled</span>;
      default:
        return <span className={`${baseClasses} bg-gray-500/20 text-gray-400`}>{status}</span>;
    }
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="glass-premium rounded-2xl p-6 border border-white/20">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Vote className="w-5 h-5 text-blue-400" />
            Governance
          </h2>
        </div>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-700 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-premium rounded-2xl p-6 border border-white/20">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Vote className="w-5 h-5 text-blue-400" />
            Governance
          </h2>
        </div>
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 mb-4">{error}</p>
          <Button onClick={fetchProposals} variant="outline">Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-premium rounded-2xl p-6 border border-white/20">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Vote className="w-5 h-5 text-blue-400" />
          Governance
        </h2>
        {address && (
          <Button onClick={() => setShowCreateModal(true)} size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            New Proposal
          </Button>
        )}
      </div>

      {proposals.length === 0 ? (
        <div className="text-center py-12">
          <Vote className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">No Proposals Yet</h3>
          <p className="text-gray-500 mb-4">Create the first governance proposal for this syndicate</p>
          {address && (
            <Button onClick={() => setShowCreateModal(true)} variant="outline">
              Create Proposal
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {proposals.map((proposal) => (
            <div key={proposal.id} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
              {/* Header */}
              <div 
                className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setExpandedProposal(expandedProposal === proposal.id ? null : proposal.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xl">{getTypeIcon(proposal.type)}</span>
                      <h3 className="text-lg font-semibold text-white">{proposal.title}</h3>
                      {getStatusBadge(proposal.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {proposal.forVotes + proposal.againstVotes + proposal.abstainVotes} votes
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {isExpired(proposal.expiresAt) ? 'Expired' : `Expires ${formatDate(proposal.expiresAt)}`}
                      </span>
                      <span>{getTypeLabel(proposal.type)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {expandedProposal === proposal.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
                
                {/* Vote Progress Bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-green-400">For: {proposal.forVotes}</span>
                    <span className="text-red-400">Against: {proposal.againstVotes}</span>
                    <span className="text-gray-400">Abstain: {proposal.abstainVotes}</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden flex">
                    <div 
                      className="bg-green-500 transition-all duration-300"
                      style={{ width: `${(proposal.forVotes / Math.max(proposal.forVotes + proposal.againstVotes + proposal.abstainVotes, 1)) * 100}%` }}
                    ></div>
                    <div 
                      className="bg-red-500 transition-all duration-300"
                      style={{ width: `${(proposal.againstVotes / Math.max(proposal.forVotes + proposal.againstVotes + proposal.abstainVotes, 1)) * 100}%` }}
                    ></div>
                    <div 
                      className="bg-gray-500 transition-all duration-300"
                      style={{ width: `${(proposal.abstainVotes / Math.max(proposal.forVotes + proposal.againstVotes + proposal.abstainVotes, 1)) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs mt-1 text-gray-500">
                    <span>Quorum: {proposal.forVotes + proposal.againstVotes + proposal.abstainVotes}/{proposal.quorum}</span>
                    <span>Proposer: {proposal.proposer.slice(0, 6)}…{proposal.proposer.slice(-4)}</span>
                  </div>
                </div>
              </div>
              
              {/* Expanded Content */}
              {expandedProposal === proposal.id && (
                <div className="px-4 pb-4 border-t border-white/10">
                  <div className="pt-4">
                    <p className="text-gray-300 mb-4">{proposal.description}</p>
                    
                    {/* Voting Actions */}
                    {address && proposal.status === 'active' && !isExpired(proposal.expiresAt) && !userVotes.has(proposal.id) ? (
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-gray-400">Cast Your Vote</h4>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={() => handleVote(proposal.id, 'yes')}
                            disabled={votingFor === proposal.id}
                            className="gap-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 border-green-500/30"
                            variant="outline"
                          >
                            <CircleCheck className="w-4 h-4" />
                            {votingFor === proposal.id ? 'Voting...' : 'Vote For'}
                          </Button>
                          <Button
                            onClick={() => handleVote(proposal.id, 'no')}
                            disabled={votingFor === proposal.id}
                            className="gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30"
                            variant="outline"
                          >
                            <X className="w-4 h-4" />
                            {votingFor === proposal.id ? 'Voting...' : 'Vote Against'}
                          </Button>
                          <Button
                            onClick={() => handleVote(proposal.id, 'abstain')}
                            disabled={votingFor === proposal.id}
                            className="gap-2 bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 border-gray-500/30"
                            variant="outline"
                          >
                            <Ban className="w-4 h-4" />
                            {votingFor === proposal.id ? 'Voting...' : 'Abstain'}
                          </Button>
                        </div>
                      </div>
                    ) : userVotes.has(proposal.id) ? (
                      <div className="flex items-center gap-2 text-green-400 bg-green-500/10 p-3 rounded-lg">
                        <CircleCheck className="w-5 h-5" />
                        <span>You have voted on this proposal</span>
                      </div>
                    ) : proposal.status !== 'active' || isExpired(proposal.expiresAt) ? (
                      <div className="flex items-center gap-2 text-yellow-400 bg-yellow-500/10 p-3 rounded-lg">
                        <Clock className="w-5 h-5" />
                        <span>Voting has ended for this proposal</span>
                      </div>
                    ) : null}
                    
                    {/* Transaction Hash */}
                    {proposal.txHash && (
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <a
                          href={`https://basescan.org/tx/${proposal.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                        >
                          View Transaction <Send className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Proposal Modal */}
      {showCreateModal && address && (
        <CreateProposalModal
          poolId={poolId}
          proposer={address}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchProposals();
          }}
        />
      )}
    </div>
  );
}

// Create Proposal Modal Component
interface CreateProposalModalProps {
  poolId: string;
  proposer: string;
  onClose: () => void;
  onSuccess: () => void;
}

function CreateProposalModal({ poolId, proposer, onClose, onSuccess }: CreateProposalModalProps) {
  const [formData, setFormData] = useState({
    type: 'ticket_purchase' as Proposal['type'],
    title: '',
    description: '',
    proposalData: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) return;
    
    setSubmitting(true);
    setError(null);
    
    try {
      const response = await fetch('/api/governance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          poolId,
          type: formData.type,
          title: formData.title.trim(),
          description: formData.description.trim(),
          proposer,
          proposalData: formData.proposalData ? JSON.parse(formData.proposalData) : undefined
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create proposal');
      }
      
      onSuccess();
    } catch (err) {
      console.error('Error creating proposal:', err);
      setError(err instanceof Error ? err.message : 'Failed to create proposal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 w-full max-w-md border border-white/10 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">Create Proposal</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            ×
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Proposal Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as Proposal['type'] })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ticket_purchase">🎟️ Ticket Purchase</option>
              <option value="fund_allocation">💰 Fund Allocation</option>
              <option value="member_add">➕ Add Member</option>
              <option value="member_remove">➖ Remove Member</option>
              <option value="config_change">⚙️ Config Change</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Brief title for your proposal"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
              placeholder="Detailed description of what this proposal aims to achieve..."
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Proposal Data (JSON, optional)</label>
            <textarea
              value={formData.proposalData}
              onChange={(e) => setFormData({ ...formData, proposalData: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              placeholder='{"amount": 1000, "recipient": "0x..."}'
              rows={3}
            />
          </div>
          
          {error && (
            <div className="flex items-center gap-2 text-red-400 bg-red-500/10 p-3 rounded-lg">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}
          
          <div className="flex gap-3 pt-4">
            <Button type="button" onClick={onClose} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !formData.title.trim() || !formData.description.trim()} className="flex-1">
              {submitting ? 'Creating...' : 'Create Proposal'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
