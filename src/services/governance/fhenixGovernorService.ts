/**
 * FHENIX GOVERNOR SERVICE
 *
 * Client-side service for encrypted on-chain governance operations.
 * Handles:
 * - Creating proposals (coordinator only)
 * - Casting encrypted votes (members)
 * - Reading proposals and vote status
 * - Revealing and finalizing tallies (coordinator only)
 *
 * Encryption model:
 *   Votes are encrypted on the client via cofhejs before being submitted to
 *   the FhenixGovernor contract. The contract accumulates encrypted tallies
 *   homomorphically using FHE.eq + FHE.add. After the deadline, the coordinator
 *   seals each tally via revealTally(), decrypts the sealed outputs, and
 *   finalizes the proposal with plaintext results.
 *
 * Vote encoding:
 *   1 = Yes (for)
 *   2 = No  (against)
 *   3 = Abstain
 */

import { encryptUsdcAmount, getPermission, decryptSealedOutput } from '@/services/fhe/fheService';
import { encodeFunctionData } from 'viem';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Types ──────────────────────────────────────────────────────────────────

export type ProposalState = 'Pending' | 'Active' | 'Passed' | 'Failed' | 'Executed';

export interface FhenixProposal {
  id: number;
  title: string;
  description: string;
  target: string;
  data: string;
  createdAt: Date;
  deadline: Date;
  voteCount: number;
  state: ProposalState;
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
  proposer: string;
  tallyRevealed: boolean;
  hasVoted: boolean; // Whether the current user has voted
}

export interface FhenixGovernorConfig {
  governorAddress: `0x${string}`;
  vaultAddress: `0x${string}`;
  coordinatorAddress: string;
  quorumBps: number;
}

// ─── ABI (minimal — only what the service calls) ─────────────────────────────

const GOVERNOR_READ_ABI = [
  {
    name: 'proposalCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getProposal',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'target', type: 'address' },
      { name: 'data', type: 'bytes' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'voteCount', type: 'uint256' },
      { name: 'state', type: 'uint8' },
      { name: 'forVotes', type: 'uint256' },
      { name: 'againstVotes', type: 'uint256' },
      { name: 'abstainVotes', type: 'uint256' },
      { name: 'proposer', type: 'address' },
      { name: 'tallyRevealed', type: 'bool' },
    ],
  },
  {
    name: 'checkVoted',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      { name: 'voter', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'getVoterCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'coordinator',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

const GOVERNOR_WRITE_ABI_CREATE = [
  {
    name: 'createProposal',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'target', type: 'address' },
      { name: 'data', type: 'bytes' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

const GOVERNOR_VOTE_ABI = [
  {
    name: 'vote',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      {
        name: 'encryptedChoice',
        type: 'tuple',
        components: [
          { name: 'data', type: 'bytes' },
          { name: 'securityZone', type: 'int32' },
        ],
      },
    ],
    outputs: [],
  },
] as const;

const GOVERNOR_FINALIZE_ABI = [
  {
    name: 'finalizeProposal',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      { name: 'forVotes', type: 'uint256' },
      { name: 'againstVotes', type: 'uint256' },
      { name: 'abstainVotes', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

const GOVERNOR_EXECUTE_ABI = [
  {
    name: 'executeProposal',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [],
  },
] as const;

const GOVERNOR_REVEAL_ABI = [
  {
    name: 'revealTally',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      {
        name: 'permission',
        type: 'tuple',
        components: [
          { name: 'publicKey', type: 'bytes32' },
          { name: 'signature', type: 'bytes' },
        ],
      },
    ],
    outputs: [
      { name: 'forVotesSealed', type: 'string' },
      { name: 'againstVotesSealed', type: 'string' },
      { name: 'abstainVotesSealed', type: 'string' },
    ],
  },
] as const;

// ─── Vote Choice Encoding ─────────────────────────────────────────────────────

const VOTE_ENCODING = {
  YES: 1n,
  NO: 2n,
  ABSTAIN: 3n,
} as const;

export type VoteChoice = 'yes' | 'no' | 'abstain';

function encodeVoteChoice(choice: VoteChoice): bigint {
  switch (choice) {
    case 'yes': return VOTE_ENCODING.YES;
    case 'no': return VOTE_ENCODING.NO;
    case 'abstain': return VOTE_ENCODING.ABSTAIN;
  }
}

// ─── Encoding Helpers ────────────────────────────────────────────────────────

const VAULT_ABI_EXECUTE_TRANSFER = [
  {
    name: 'executeTransfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

export function encodeVaultTransfer(to: string, amount: bigint): string {
  return encodeFunctionData({
    abi: VAULT_ABI_EXECUTE_TRANSFER,
    functionName: 'executeTransfer',
    args: [to as `0x${string}`, amount],
  });
}

// ─── State mapping ───────────────────────────────────────────────────────────

const PROPOSAL_STATE_MAP: Record<number, ProposalState> = {
  0: 'Pending',
  1: 'Active',
  2: 'Passed',
  3: 'Failed',
  4: 'Executed',
};

// ─── Service ─────────────────────────────────────────────────────────────────

export class FhenixGovernorService {
  private config: FhenixGovernorConfig;

  constructor(config: FhenixGovernorConfig) {
    this.config = config;
  }

  // ─── Read Operations ─────────────────────────────────────────────────────

  /**
   * Get the coordinator address from the governor contract
   */
  async getCoordinator(publicClient: any): Promise<string> {
    return publicClient.readContract({
      address: this.config.governorAddress,
      abi: GOVERNOR_READ_ABI,
      functionName: 'coordinator',
    }) as Promise<string>;
  }

  /**
   * Fetch all proposals from the governor contract
   */
  async getProposals(publicClient: any, userAddress?: string): Promise<FhenixProposal[]> {
    const count = await publicClient.readContract({
      address: this.config.governorAddress,
      abi: GOVERNOR_READ_ABI,
      functionName: 'proposalCount',
    }) as bigint;

    const proposalCount = Number(count);
    const proposals: FhenixProposal[] = [];

    for (let i = 0; i < proposalCount; i++) {
      const result = await publicClient.readContract({
        address: this.config.governorAddress,
        abi: GOVERNOR_READ_ABI,
        functionName: 'getProposal',
        args: [BigInt(i)],
      }) as [string, string, string, string, bigint, bigint, bigint, number, bigint, bigint, bigint, string, boolean];

      const [title, description, target, data, createdAt, deadline, voteCount, state, forVotes, againstVotes, abstainVotes, proposer, tallyRevealed] = result;

      let hasVoted = false;
      if (userAddress) {
        hasVoted = await publicClient.readContract({
          address: this.config.governorAddress,
          abi: GOVERNOR_READ_ABI,
          functionName: 'checkVoted',
          args: [BigInt(i), userAddress as `0x${string}`],
        }) as boolean;
      }

      proposals.push({
        id: i,
        title,
        description,
        target,
        data,
        createdAt: new Date(Number(createdAt) * 1000),
        deadline: new Date(Number(deadline) * 1000),
        voteCount: Number(voteCount),
        state: PROPOSAL_STATE_MAP[state] || 'Pending',
        forVotes: Number(forVotes),
        againstVotes: Number(againstVotes),
        abstainVotes: Number(abstainVotes),
        proposer,
        tallyRevealed,
        hasVoted,
      });
    }

    return proposals;
  }

  // ─── Write Operations ─────────────────────────────────────────────────────

  /**
   * Create a new proposal (coordinator only)
   */
  async createProposal(
    walletClient: any,
    publicClient: any,
    title: string,
    description: string,
    target: string,
    data: string,
    deadlineDays: number, // number of days from now
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + (deadlineDays * 24 * 60 * 60));

      const txHash = await walletClient.writeContract({
        address: this.config.governorAddress,
        abi: GOVERNOR_WRITE_ABI_CREATE,
        functionName: 'createProposal',
        args: [title, description, target as `0x${string}`, data as `0x${string}`, deadline],
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash });

      return { success: true, txHash };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create proposal',
      };
    }
  }

  /**
   * Cast an encrypted vote on a proposal.
   *
   * Flow:
   * 1. Encrypt the vote choice (1=yes, 2=no, 3=abstain) using FHE via cofhejs
   * 2. Submit the encrypted input to the governor contract
   *
   * @returns Transaction hash on success
   */
  async castVote(
    walletClient: any,
    publicClient: any,
    proposalId: number,
    choice: VoteChoice,
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      // Encrypt the vote choice using FHE (reuses encryptUsdcAmount since it's a uint64)
      const encodedChoice = encodeVoteChoice(choice);
      const encResult = await encryptUsdcAmount(encodedChoice);

      if (!encResult.success) {
        return {
          success: false,
          error: `FHE encryption failed: ${encResult.error?.message ?? 'unknown error'}`,
        };
      }

      const encryptedInput = encResult.data[0];

      // Submit encrypted vote
      const txHash = await walletClient.writeContract({
        address: this.config.governorAddress,
        abi: GOVERNOR_VOTE_ABI,
        functionName: 'vote',
        args: [BigInt(proposalId), encryptedInput],
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash });

      return { success: true, txHash };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cast vote',
      };
    }
  }

  /**
   * Reveal the encrypted tally (coordinator only — requires permit).
   *
   * Flow:
   * 1. Get a permission (requires cofhejs initialize + createPermit)
   * 2. Call revealTally on the governor contract
   * 3. Decrypt each sealed output locally
   *
   * @returns Decrypted for/against/abstain counts, or error
   */
  async revealAndDecryptTally(
    publicClient: any,
    proposalId: number,
    userAddress: string,
  ): Promise<{
    success: boolean;
    forVotes?: number;
    againstVotes?: number;
    abstainVotes?: number;
    error?: string;
  }> {
    try {
      // Ensure FHE is initialized with a permit
      const permResult = await getPermission();
      if (!permResult.success || !permResult.data) {
        return { success: false, error: 'No active FHE permit. Call initializeFhe first.' };
      }

      const permission = permResult.data;

      // Call revealTally (view function — no gas)
      const result = await publicClient.readContract({
        address: this.config.governorAddress,
        abi: GOVERNOR_REVEAL_ABI,
        functionName: 'revealTally',
        args: [BigInt(proposalId), permission],
      }) as [string, string, string];

      const [forSealed, againstSealed, abstainSealed] = result;

      // Decrypt each sealed output locally using the active permit
      const forResult = await decryptSealedOutput(forSealed);
      if (!forResult.success) {
        return { success: false, error: `Failed to decrypt forVotes: ${forResult.error?.message}` };
      }

      const againstResult = await decryptSealedOutput(againstSealed);
      if (!againstResult.success) {
        return { success: false, error: `Failed to decrypt againstVotes: ${againstResult.error?.message}` };
      }

      const abstainResult = await decryptSealedOutput(abstainSealed);
      if (!abstainResult.success) {
        return { success: false, error: `Failed to decrypt abstainVotes: ${abstainResult.error?.message}` };
      }

      return {
        success: true,
        forVotes: Number(forResult.data),
        againstVotes: Number(againstResult.data),
        abstainVotes: Number(abstainResult.data),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reveal tally',
      };
    }
  }

  /**
   * Finalize a proposal with decrypted tally results (coordinator only).
   */
  async finalizeProposal(
    walletClient: any,
    publicClient: any,
    proposalId: number,
    forVotes: number,
    againstVotes: number,
    abstainVotes: number,
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const txHash = await walletClient.writeContract({
        address: this.config.governorAddress,
        abi: GOVERNOR_FINALIZE_ABI,
        functionName: 'finalizeProposal',
        args: [BigInt(proposalId), BigInt(forVotes), BigInt(againstVotes), BigInt(abstainVotes)],
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash });

      return { success: true, txHash };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to finalize proposal',
      };
    }
  }

  /**
   * Execute a passed proposal (coordinator only).
   */
  async executeProposal(
    walletClient: any,
    publicClient: any,
    proposalId: number,
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const txHash = await walletClient.writeContract({
        address: this.config.governorAddress,
        abi: GOVERNOR_EXECUTE_ABI,
        functionName: 'executeProposal',
        args: [BigInt(proposalId)],
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash });

      return { success: true, txHash };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute proposal',
      };
    }
  }
}

/**
 * Create a FhenixGovernorService instance from environment config.
 * Uses FHENIX_VAULT_ADDRESS as a proxy for the governor config.
 */
export function createFhenixGovernorService(): FhenixGovernorService | null {
  const governorAddress = process.env.NEXT_PUBLIC_FHENIX_GOVERNOR_ADDRESS;
  const vaultAddress = process.env.NEXT_PUBLIC_FHENIX_VAULT_ADDRESS;

  if (!governorAddress || !vaultAddress) {
    console.warn('[FhenixGovernorService] Missing env vars: NEXT_PUBLIC_FHENIX_GOVERNOR_ADDRESS and NEXT_PUBLIC_FHENIX_VAULT_ADDRESS');
    return null;
  }

  return new FhenixGovernorService({
    governorAddress: governorAddress as `0x${string}`,
    vaultAddress: vaultAddress as `0x${string}`,
    coordinatorAddress: '',
    quorumBps: 2500,
  });
}
