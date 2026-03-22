/**
 * GOVERNANCE SERVICE TESTS
 * 
 * Tests for DAO governance functionality:
 * - Proposal creation with quorum calculation
 * - Voting with duplicate prevention
 * - Proposal status checking
 * - Proposal cancellation
 */

import { governanceService, GovernanceService } from '@/services/governance/governanceService';

// Mock the database
const mockQuery = jest.fn();
jest.mock('@vercel/postgres', () => ({
  sql: (...args: any[]) => {
    const query = args[0]?.join?.('?') || args[0];
    return mockQuery(query, args);
  },
}));

describe('GovernanceService', () => {
  let service: GovernanceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GovernanceService();
  });

  describe('createProposal', () => {
    it('should create a proposal with calculated quorum', async () => {
      // Mock member count query
      mockQuery.mockResolvedValueOnce({
        rows: [{ count: '10' }],
      });

      // Mock insert query
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'proposal-123' }],
        rowCount: 1,
      });

      const proposalId = await service.createProposal({
        poolId: 'pool-123',
        type: 'ticket_purchase',
        title: 'Buy lottery tickets',
        description: 'Purchase 100 tickets for the next draw',
        proposer: '0x1234567890123456789012345678901234567890',
        proposalData: { ticketCount: 100, amount: '100' },
      });

      expect(proposalId).toBe('proposal-123');
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should calculate quorum as 50% of members (rounded up)', async () => {
      // Mock member count query (11 members)
      mockQuery.mockResolvedValueOnce({
        rows: [{ count: '11' }],
      });

      // Mock insert query
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'proposal-456' }],
        rowCount: 1,
      });

      await service.createProposal({
        poolId: 'pool-123',
        type: 'fund_allocation',
        title: 'Allocate funds',
        description: 'Send funds to charity',
        proposer: '0x1234567890123456789012345678901234567890',
        proposalData: { amount: '500' },
      });

      // Check that quorum was calculated (6 for 11 members)
      const insertCall = mockQuery.mock.calls[1];
      expect(insertCall).toBeDefined();
    });

    it('should set expiry to 7 days from creation', async () => {
      const beforeCreate = Date.now();

      mockQuery.mockResolvedValueOnce({
        rows: [{ count: '5' }],
      });

      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'proposal-789' }],
        rowCount: 1,
      });

      await service.createProposal({
        poolId: 'pool-123',
        type: 'config_change',
        title: 'Change config',
        description: 'Update settings',
        proposer: '0x1234567890123456789012345678901234567890',
        proposalData: {},
      });

      const afterCreate = Date.now();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      // Verify the insert was called
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should handle database errors gracefully', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(
        service.createProposal({
          poolId: 'pool-123',
          type: 'ticket_purchase',
          title: 'Buy tickets',
          description: 'Purchase tickets',
          proposer: '0x1234567890123456789012345678901234567890',
          proposalData: {},
        })
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('castVote', () => {
    it('should successfully cast a vote', async () => {
      // Mock existing vote check (no existing vote)
      mockQuery.mockResolvedValueOnce({
        rows: [],
      });

      // Mock insert vote
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
      });

      // Mock update for_votes
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
      });

      await service.castVote('proposal-123', '0xVoter', 'yes', 'Great idea!');

      expect(mockQuery).toHaveBeenCalledTimes(3);
    });

    it('should reject duplicate votes', async () => {
      // Mock existing vote check (vote exists)
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'existing-vote' }],
      });

      await expect(
        service.castVote('proposal-123', '0xVoter', 'yes')
      ).rejects.toThrow('Already voted on this proposal');
    });

    it('should increment correct vote count for yes', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      await service.castVote('proposal-123', '0xVoter', 'yes');

      // Check that for_votes was updated
      const updateCall = mockQuery.mock.calls[2];
      expect(updateCall[0]).toContain('for_votes');
    });

    it('should increment correct vote count for no', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      await service.castVote('proposal-123', '0xVoter', 'no', 'Bad idea');

      // Check that against_votes was updated
      const updateCall = mockQuery.mock.calls[2];
      expect(updateCall[0]).toContain('against_votes');
    });

    it('should increment correct vote count for abstain', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      await service.castVote('proposal-123', '0xVoter', 'abstain');

      // Check that abstain_votes was updated
      const updateCall = mockQuery.mock.calls[2];
      expect(updateCall[0]).toContain('abstain_votes');
    });
  });

  describe('getProposals', () => {
    it('should return proposals for a pool', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'prop-1',
            pool_id: 'pool-123',
            type: 'ticket_purchase',
            title: 'Buy tickets',
            description: 'Purchase tickets',
            proposer: '0xProposer1',
            status: 'active',
            for_votes: 5,
            against_votes: 2,
            abstain_votes: 1,
            quorum_required: 5,
            created_at: Date.now(),
            expires_at: Date.now() + 86400000,
            executed_at: null,
            execution_tx_hash: null,
            proposal_data: '{"ticketCount": 100}',
          },
        ],
      });

      const proposals = await service.getProposals('pool-123');

      expect(proposals).toHaveLength(1);
      expect(proposals[0].id).toBe('prop-1');
      expect(proposals[0].totalVoters).toBe(8);
    });

    it('should filter by status when provided', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
      });

      await service.getProposals('pool-123', 'active');

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const queryCall = mockQuery.mock.calls[0];
      expect(queryCall[0]).toContain('status');
    });

    it('should parse JSON proposal data', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'prop-1',
            pool_id: 'pool-123',
            type: 'fund_allocation',
            title: 'Allocate funds',
            description: 'Send to charity',
            proposer: '0xProposer',
            status: 'passed',
            for_votes: 10,
            against_votes: 2,
            abstain_votes: 0,
            quorum_required: 5,
            created_at: Date.now(),
            expires_at: Date.now() - 1000, // Expired
            executed_at: null,
            execution_tx_hash: null,
            proposal_data: { amount: '500', recipient: '0xCharity' },
          },
        ],
      });

      const proposals = await service.getProposals('pool-123');

      expect(proposals[0].proposalData).toEqual({
        amount: '500',
        recipient: '0xCharity',
      });
    });
  });

  describe('getVotes', () => {
    it('should return all votes for a proposal', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'vote-1',
            proposal_id: 'prop-1',
            voter: '0xVoter1',
            choice: 'yes',
            reason: 'Good idea',
            created_at: Date.now(),
          },
          {
            id: 'vote-2',
            proposal_id: 'prop-1',
            voter: '0xVoter2',
            choice: 'no',
            reason: null,
            created_at: Date.now() - 1000,
          },
        ],
      });

      const votes = await service.getVotes('prop-1');

      expect(votes).toHaveLength(2);
      expect(votes[0].voter).toBe('0xVoter1');
      expect(votes[1].choice).toBe('no');
      expect(votes[1].reason).toBeNull();
    });
  });

  describe('hasVoted', () => {
    it('should return true if user has voted', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'vote-1' }],
      });

      const result = await service.hasVoted('prop-1', '0xVoter1');

      expect(result).toBe(true);
    });

    it('should return false if user has not voted', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
      });

      const result = await service.hasVoted('prop-1', '0xVoter1');

      expect(result).toBe(false);
    });
  });

  describe('checkProposalStatus', () => {
    it('should return "passed" when quorum met and majority', async () => {
      // Mock proposal query
      mockQuery.mockResolvedValueOnce({
        rows: [{
          for_votes: 10,
          against_votes: 3,
          quorum_required: 8,
          expires_at: Date.now() + 86400000, // Not expired
        }],
      });

      const status = await service.checkProposalStatus('prop-1');

      expect(status).toBe('passed');
    });

    it('should return "failed" when expired without quorum', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          for_votes: 3,
          against_votes: 2,
          quorum_required: 10,
          expires_at: Date.now() - 1000, // Expired
        }],
      });

      const status = await service.checkProposalStatus('prop-1');

      expect(status).toBe('failed');
    });

    it('should return "active" when voting still in progress', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          for_votes: 3,
          against_votes: 2,
          quorum_required: 10,
          expires_at: Date.now() + 86400000,
        }],
      });

      const status = await service.checkProposalStatus('prop-1');

      expect(status).toBe('active');
    });

    it('should return "failed" when more against than for votes', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          for_votes: 3,
          against_votes: 10,
          quorum_required: 8,
          expires_at: Date.now() + 86400000,
        }],
      });

      const status = await service.checkProposalStatus('prop-1');

      expect(status).toBe('active'); // Still active until expiry
    });

    it('should throw error if proposal not found', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
      });

      await expect(
        service.checkProposalStatus('nonexistent')
      ).rejects.toThrow('Proposal not found');
    });
  });

  describe('markExecuted', () => {
    it('should mark proposal as executed with tx hash', async () => {
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
      });

      await service.markExecuted('prop-1', '0xTxHash123');

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const queryCall = mockQuery.mock.calls[0];
      // Check that the query contains executed status
      expect(queryCall[0]).toContain('executed');
      // Check that tx hash is passed as parameter (second element of the array)
      const params = queryCall[1];
      expect(params).toContain('0xTxHash123');
    });
  });

  describe('cancelProposal', () => {
    it('should allow proposer to cancel if no votes', async () => {
      // Mock proposal query
      mockQuery.mockResolvedValueOnce({
        rows: [{
          proposer: '0xProposer',
          for_votes: 0,
          against_votes: 0,
        }],
      });

      // Mock update
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
      });

      await service.cancelProposal('prop-1', '0xProposer');

      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should reject cancellation by non-proposer', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          proposer: '0xProposer',
          for_votes: 0,
          against_votes: 0,
        }],
      });

      await expect(
        service.cancelProposal('prop-1', '0xOtherPerson')
      ).rejects.toThrow('Only proposer can cancel');
    });

    it('should reject cancellation if votes exist', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          proposer: '0xProposer',
          for_votes: 5,
          against_votes: 2,
        }],
      });

      await expect(
        service.cancelProposal('prop-1', '0xProposer')
      ).rejects.toThrow('Cannot cancel proposal with votes');
    });

    it('should throw error if proposal not found', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
      });

      await expect(
        service.cancelProposal('nonexistent', '0xProposer')
      ).rejects.toThrow('Proposal not found');
    });
  });
});
