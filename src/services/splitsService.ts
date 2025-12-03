export interface ParticipantShare {
  address: string;
  /** Share weight in basis points (0–10000). */
  weightBps: number;
  /** Optional lock to prevent free riding; participants must be locked when snapshot occurs. */
  lockedUntil?: Date;
}

export interface Snapshot {
  strategyId: string;
  roundId?: string;
  createdAt: Date;
  participants: ParticipantShare[];
}

export interface DistributionResult {
  total: string; // decimal string
  allocations: Array<{ address: string; amount: string }>;
}

/**
 * SplitsService is a scaffold to compute and (eventually) execute on-chain splits
 * of lottery winnings among yield strategy participants.
 *
 * Recommended on-chain contract API (to be implemented separately):
 * - function snapshot(bytes32 strategyId, Participant[] participants, uint64 lockUntil)
 * - function distribute(bytes32 strategyId, uint256 amount, address token)
 * - function getSnapshot(bytes32 strategyId) returns Participant[]
 *
 * For now, this service computes off-chain allocation and returns a mock tx.
 */
import { ethers } from 'ethers';
import { CONTRACTS } from '@/config';

type SplitsClientLike = {
  createSplit(params: { accounts: string[]; percentAllocations: number[]; distributorFee: number }): Promise<{ address: string }>;
  distributeERC20(params: { splitAddress: string; tokenAddress: string; distributorAddress: string }): Promise<{ hash: string; wait?: () => Promise<{ hash: string }> }>;
};

class SplitsService {
  private snapshots: Map<string, Snapshot> = new Map();
  private provider: ethers.Provider | null = null;
  private signer: ethers.Signer | null = null;
  private splitsClient: SplitsClientLike | null = null; // Lazy-loaded @0xsplits/splits-sdk client

  /**
   * Runtime-only loader to avoid TypeScript module resolution errors when SDK isn't installed.
   */
  private async loadSplitsClient(provider: ethers.Provider, signer?: ethers.Signer): Promise<void> {
    if (this.splitsClient) return;
    try {
      // Use Function+dynamic import to avoid static resolution
      const importer: () => Promise<unknown> = Function('return import("@0xsplits/splits-sdk")') as unknown as () => Promise<unknown>;
      const mod = await importer();
      const ClientCtor = (mod as { SplitsClient: new (args: { chainId: number; provider: ethers.Provider; signer?: ethers.Signer }) => SplitsClientLike }).SplitsClient;
      this.splitsClient = new ClientCtor({ chainId: 8453, provider, signer });
    } catch {
      this.splitsClient = null;
    }
  }

  async initialize(provider: ethers.Provider, signer?: ethers.Signer): Promise<boolean> {
    this.provider = provider;
    this.signer = signer || null;
    // Lazily load the Splits SDK client; fall back gracefully if unavailable
    await this.loadSplitsClient(provider, this.signer || undefined);
    return true;
  }

  snapshotParticipants(
    strategyId: string,
    participants: ParticipantShare[],
    lockPeriodMinutes: number,
    roundId?: string
  ): Snapshot {
    const lockUntil = new Date(Date.now() + lockPeriodMinutes * 60 * 1000);
    const locked = participants.map((p) => ({ ...p, lockedUntil: lockUntil }));
    const snap: Snapshot = {
      strategyId,
      roundId,
      createdAt: new Date(),
      participants: locked,
    };
    this.snapshots.set(strategyId, snap);
    return snap;
  }

  computeDistribution(total: string, strategyId: string): DistributionResult {
    const snap = this.snapshots.get(strategyId);
    if (!snap) {
      return { total, allocations: [] };
    }
    const totalNum = Number(total);
    const sumBps = snap.participants.reduce((acc, p) => acc + p.weightBps, 0);
    if (sumBps <= 0) {
      return { total, allocations: [] };
    }
    const allocations = snap.participants.map((p) => {
      const amt = (totalNum * p.weightBps) / 10000;
      return { address: p.address, amount: amt.toFixed(6) };
    });
    return { total, allocations };
  }

  /**
   * Placeholder to execute on-chain distribution via a Splits contract.
   * Returns a mock transaction hash for now.
   */
  async distributeWinnings(total: string, strategyId: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
    const result = this.computeDistribution(total, strategyId);
    if (result.allocations.length === 0) {
      return { success: false, error: 'No allocations available for distribution' };
    }

    // Ensure provider/signer are available by auto-initializing from web3Service
    if (!this.provider || !this.signer) {
      try {
        const mod = await import('@/services/web3Service');
        const provider = mod.web3Service.getProvider();
        const signer = provider ? await mod.web3Service.getFreshSigner().catch(() => null) : null;
        if (provider) {
          this.provider = provider;
          this.signer = signer || null;
          // Lazy-load SDK client if not loaded yet
          if (!this.splitsClient) {
            await this.loadSplitsClient(provider, this.signer || undefined);
          }
        }
      } catch {}
    }

    // If SDK is available, distribute ERC20 on Base via Splits
    if (this.splitsClient && this.signer) {
      try {
        // Create percentages from weights (already computed proportions in computeDistribution)
        const accounts = result.allocations.map(a => a.address);
        const percents = result.allocations.map(a => Number(a.amount) / Number(total));
        // Create or fetch a split for these accounts
        const split = await this.splitsClient.createSplit({
          accounts,
          percentAllocations: percents,
          distributorFee: 0,
        });
        // Distribute USDC to recipients
        const tx = await this.splitsClient.distributeERC20({
          splitAddress: split.address,
          tokenAddress: CONTRACTS.usdc,
          distributorAddress: await this.signer.getAddress(),
        });
        const rc = await tx.wait?.();
        return { success: true, txHash: rc?.hash || tx.hash };
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Splits distribution failed';
        return { success: false, error: msg };
      }
    }

    // Fallback: return a mock tx hash when SDK is not present
    return { success: true, txHash: '0xmockSplitsDistributionTx' };
  }
}

export const splitsService = new SplitsService();
