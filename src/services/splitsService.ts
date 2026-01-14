/**
 * SplitsService - Snapshot and distribution management
 * 
 * Core Principles Applied:
 * - DRY: Uses distributionService for all calculations
 * - ENHANCEMENT FIRST: Refactored to use shared distribution logic
 * - CLEAN: Clear separation - snapshots here, distribution logic in distributionService
 * - AGGRESSIVE CONSOLIDATION: Removed duplicate calculation logic
 * 
 * Manages participant snapshots for lottery winnings distribution.
 * Delegates actual distribution calculations to distributionService.
 */
import { distributionService, type DistributionConfig } from './distributionService';

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
  total: string;
  allocations: Array<{ address: string; amount: string }>;
}

class SplitsService {
  private snapshots: Map<string, Snapshot> = new Map();

  /**
   * Create a snapshot of participants with their weights
   * Snapshots are locked for a period to prevent free-riding
   */
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

    console.log('[SplitsService] Snapshot created:', {
      strategyId,
      participantsCount: participants.length,
      lockUntil,
    });

    return snap;
  }

  /**
   * Get snapshot for a strategy
   */
  getSnapshot(strategyId: string): Snapshot | null {
    return this.snapshots.get(strategyId) || null;
  }

  /**
   * Compute distribution using distributionService (DRY principle)
   * @deprecated Use distributionService.calculateProportionalShares() directly
   */
  computeDistribution(total: string, strategyId: string): DistributionResult {
    const snap = this.snapshots.get(strategyId);
    if (!snap) {
      return { total, allocations: [] };
    }

    // Use distributionService for calculation (DRY)
    const weights = snap.participants.map(p => ({
      address: p.address,
      weightBps: p.weightBps,
    }));

    const allocations = distributionService.calculateProportionalShares(total, weights);

    return {
      total,
      allocations: allocations.map(a => ({
        address: a.address,
        amount: a.amount,
      })),
    };
  }

  /**
   * Distribute winnings using distributionService (DRY principle)
   * ENHANCEMENT FIRST: Refactored to use shared distribution logic
   */
  async distributeWinnings(
    total: string,
    strategyId: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    const snap = this.snapshots.get(strategyId);
    if (!snap) {
      return { success: false, error: 'No snapshot found for strategy' };
    }

    // Use distributionService for calculation and execution (DRY)
    const weights = snap.participants.map(p => ({
      address: p.address,
      weightBps: p.weightBps,
    }));

    const allocations = distributionService.calculateProportionalShares(total, weights);

    if (allocations.length === 0) {
      return { success: false, error: 'No allocations available for distribution' };
    }

    // Execute distribution via distributionService
    const config: DistributionConfig = {
      totalAmount: total,
      recipients: allocations,
      distributionType: 'vault', // Splits are typically for vault/yield strategies
      poolOrVaultId: strategyId,
    };

    const result = await distributionService.distributeToAddresses(config);

    console.log('[SplitsService] Distribution executed:', {
      strategyId,
      totalAmount: total,
      recipientsCount: allocations.length,
      success: result.success,
    });

    return {
      success: result.success,
      txHash: result.txHash,
      error: result.error,
    };
  }

  /**
   * Clear all snapshots (useful for testing)
   */
  clearSnapshots(): void {
    this.snapshots.clear();
  }

  /**
   * Get all active snapshots
   */
  getAllSnapshots(): Snapshot[] {
    return Array.from(this.snapshots.values());
  }
}

export const splitsService = new SplitsService();
