/**
 * Governance Service
 * 
 * Handles DAO governance for syndicates:
 * - Create proposals (ticket purchases, fund allocation, member changes)
 * - Voting (yes/no/abstain)
 * - Execute approved proposals
 * 
 * Proposal Types:
 * - ticket_purchase: Buy lottery tickets with pooled funds
 * - fund_allocation: Allocate funds to a specific cause
 * - member_add: Add new member to multisig
 * - member_remove: Remove member from multisig
 * - config_change: Change syndicate configuration
 */

import { sql } from '@vercel/postgres';

export type ProposalType = 
  | 'ticket_purchase'
  | 'fund_allocation'
  | 'member_add'
  | 'member_remove'
  | 'config_change';

export type ProposalStatus = 
  | 'pending'
  | 'active'
  | 'passed'
  | 'failed'
  | 'executed'
  | 'cancelled';

export type VoteChoice = 'yes' | 'no' | 'abstain';

export interface Proposal {
  id: string;
  poolId: string;
  type: ProposalType;
  title: string;
  description: string;
  proposer: string;
  status: ProposalStatus;
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
  totalVoters: number;
  quorumRequired: number;
  createdAt: Date;
  expiresAt: Date;
  executedAt: Date | null;
  executionTxHash: string | null;
  proposalData: Record<string, unknown>;
}

export interface Vote {
  id: string;
  proposalId: string;
  voter: string;
  choice: VoteChoice;
  reason: string | null;
  createdAt: Date;
}

export interface CreateProposalParams {
  poolId: string;
  type: ProposalType;
  title: string;
  description: string;
  proposer: string;
  proposalData: Record<string, unknown>;
}

export class GovernanceService {

  /**
   * Create a new proposal
   */
  async createProposal(params: CreateProposalParams): Promise<string> {
    // Calculate expiry (7 days from now)
    const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);

    // Calculate quorum (50% of members)
    const membersResult = await sql`
      SELECT COUNT(*) as count
      FROM syndicate_members
      WHERE pool_id = ${params.poolId}
    `;
    const memberCount = parseInt(membersResult.rows[0]?.count || '1');
    const quorumRequired = Math.ceil(memberCount / 2);

    const result = await sql`
      INSERT INTO governance_proposals (
        pool_id,
        type,
        title,
        description,
        proposer,
        status,
        proposal_data,
        quorum_required,
        created_at,
        expires_at
      ) VALUES (
        ${params.poolId},
        ${params.type},
        ${params.title},
        ${params.description},
        ${params.proposer},
        'active',
        ${JSON.stringify(params.proposalData)},
        ${quorumRequired},
        ${Date.now()},
        ${expiresAt}
      )
      RETURNING id
    `;

    return result.rows[0].id;
  }

  /**
   * Cast a vote on a proposal
   */
  async castVote(
    proposalId: string,
    voter: string,
    choice: VoteChoice,
    reason?: string
  ): Promise<void> {
    // Check if already voted
    const existing = await sql`
      SELECT id FROM governance_votes
      WHERE proposal_id = ${proposalId} AND voter = ${voter}
    `;

    if (existing.rows.length > 0) {
      throw new Error('Already voted on this proposal');
    }

    // Record vote
    await sql`
      INSERT INTO governance_votes (
        proposal_id,
        voter,
        choice,
        reason,
        created_at
      ) VALUES (
        ${proposalId},
        ${voter},
        ${choice},
        ${reason || null},
        ${Date.now()}
      )
    `;

    // Update vote counts
    if (choice === 'yes') {
      await sql`
        UPDATE governance_proposals
        SET for_votes = for_votes + 1
        WHERE id = ${proposalId}
      `;
    } else if (choice === 'no') {
      await sql`
        UPDATE governance_proposals
        SET against_votes = against_votes + 1
        WHERE id = ${proposalId}
      `;
    } else {
      await sql`
        UPDATE governance_proposals
        SET abstain_votes = abstain_votes + 1
        WHERE id = ${proposalId}
      `;
    }
  }

  /**
   * Get proposals for a syndicate
   */
  async getProposals(poolId: string, status?: ProposalStatus): Promise<Proposal[]> {
    const result = status
      ? await sql`
          SELECT * FROM governance_proposals
          WHERE pool_id = ${poolId} AND status = ${status}
          ORDER BY created_at DESC
        `
      : await sql`
          SELECT * FROM governance_proposals
          WHERE pool_id = ${poolId}
          ORDER BY created_at DESC
        `;

    return result.rows.map((row: any) => ({
      id: row.id,
      poolId: row.pool_id,
      type: row.type,
      title: row.title,
      description: row.description,
      proposer: row.proposer,
      status: row.status,
      forVotes: row.for_votes,
      againstVotes: row.against_votes,
      abstainVotes: row.abstain_votes,
      totalVoters: row.for_votes + row.against_votes + row.abstain_votes,
      quorumRequired: row.quorum_required,
      createdAt: new Date(row.created_at),
      expiresAt: new Date(row.expires_at),
      executedAt: row.executed_at ? new Date(row.executed_at) : null,
      executionTxHash: row.execution_tx_hash,
      proposalData: typeof row.proposal_data === 'string' 
        ? JSON.parse(row.proposal_data) 
        : row.proposal_data,
    }));
  }

  /**
   * Get votes for a proposal
   */
  async getVotes(proposalId: string): Promise<Vote[]> {
    const result = await sql`
      SELECT * FROM governance_votes
      WHERE proposal_id = ${proposalId}
      ORDER BY created_at DESC
    `;

    return result.rows.map((row: any) => ({
      id: row.id,
      proposalId: row.proposal_id,
      voter: row.voter,
      choice: row.choice,
      reason: row.reason,
      createdAt: new Date(row.created_at),
    }));
  }

  /**
   * Check if user has voted on a proposal
   */
  async hasVoted(proposalId: string, voter: string): Promise<boolean> {
    const result = await sql`
      SELECT id FROM governance_votes
      WHERE proposal_id = ${proposalId} AND voter = ${voter}
    `;
    return result.rows.length > 0;
  }

  /**
   * Check if proposal should be executed (passed quorum and majority)
   */
  async checkProposalStatus(proposalId: string): Promise<ProposalStatus> {
    const result = await sql`
      SELECT 
        for_votes,
        against_votes,
        quorum_required,
        expires_at
      FROM governance_proposals
      WHERE id = ${proposalId}
    `;

    if (result.rows.length === 0) {
      throw new Error('Proposal not found');
    }

    const proposal = result.rows[0];
    const totalVotes = proposal.for_votes + proposal.against_votes;
    const now = Date.now();
    const expiresAt = new Date(proposal.expires_at).getTime();

    // Check if expired
    if (now > expiresAt) {
      if (totalVotes >= proposal.quorum_required && proposal.for_votes > proposal.against_votes) {
        return 'passed';
      }
      return 'failed';
    }

    // Check if quorum met and majority
    if (totalVotes >= proposal.quorum_required && proposal.for_votes > proposal.against_votes) {
      return 'passed';
    }

    return 'active';
  }

  /**
   * Mark proposal as executed
   */
  async markExecuted(proposalId: string, txHash: string): Promise<void> {
    await sql`
      UPDATE governance_proposals
      SET 
        status = 'executed',
        executed_at = ${Date.now()},
        execution_tx_hash = ${txHash}
      WHERE id = ${proposalId}
    `;
  }

  /**
   * Cancel a proposal (only by proposer if no votes)
   */
  async cancelProposal(proposalId: string, canceller: string): Promise<void> {
    const result = await sql`
      SELECT proposer, for_votes, against_votes
      FROM governance_proposals
      WHERE id = ${proposalId}
    `;

    if (result.rows.length === 0) {
      throw new Error('Proposal not found');
    }

    const proposal = result.rows[0];
    
    if (proposal.proposer !== canceller) {
      throw new Error('Only proposer can cancel');
    }

    if (proposal.for_votes > 0 || proposal.against_votes > 0) {
      throw new Error('Cannot cancel proposal with votes');
    }

    await sql`
      UPDATE governance_proposals
      SET status = 'cancelled'
      WHERE id = ${proposalId}
    `;
  }
}

export const governanceService = new GovernanceService();
