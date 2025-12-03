/**
 * SYNDICATE SERVICE
 * 
 * Core Principles Applied:
 * - MODULAR: Isolated syndicate logic
 * - CLEAN: Clear service interface
 */

import type { SyndicatePool } from '../types';
import type { SyndicateInfo } from '@/domains/lottery/types';
import { web3Service } from '@/services/web3Service';
import { splitsService, type ParticipantShare } from '@/services/splitsService';
import { ethers } from 'ethers';

export class SyndicateService {
  async getActivePools(): Promise<SyndicatePool[]> {
    // Implementation here
    return [];
  }

  async getActiveSyndicates(): Promise<SyndicateInfo[]> {
    const res = await fetch('/api/syndicates');
    if (!res.ok) return [];
    const data = await res.json();
    return data as SyndicateInfo[];
  }

  async joinPool(): Promise<boolean> {
    // Implementation here
    return true;
  }

  async createPool(): Promise<string> {
    // Implementation here
    return 'new-pool-id';
  }

  async prepareAdHocBatchPurchase(syndicateId: string, ticketCount: number): Promise<{ success: boolean; txHash?: string; error?: string; recipient?: string }> {
    const syndicates = await this.getActiveSyndicates();
    const s = syndicates.find(x => x.id === syndicateId);
    if (!s?.poolAddress) return { success: false, error: 'Pool address unavailable' };
    const result = await web3Service.purchaseTickets(ticketCount, s.poolAddress);
    return { success: result.success, txHash: result.txHash, error: result.error, recipient: s.poolAddress };
  }

  snapshotProportionalWeights(syndicateId: string, participants: Array<{ address: string; contributionUsd: number }>, lockMinutes: number, roundId?: string) {
    const total = participants.reduce((acc, p) => acc + p.contributionUsd, 0);
    const shares: ParticipantShare[] = participants.map(p => ({ address: p.address, weightBps: Math.floor((p.contributionUsd / Math.max(total, 1)) * 10000) }));
    const strategyId = `${syndicateId}:${roundId ?? 'adhoc'}`;
    return splitsService.snapshotParticipants(strategyId, shares, lockMinutes, roundId);
  }

  async distributeProportionalRemainder(totalUsd: string, syndicateId: string, causePercent: number | undefined): Promise<{ success: boolean; txHash?: string; error?: string; donateUsd: string; remainderUsd: string }> {
    const totalWei = ethers.parseUnits(totalUsd, 6);
    const donateWei = causePercent && causePercent > 0 ? (totalWei * BigInt(causePercent)) / BigInt(100) : BigInt(0);
    const remainderWei = totalWei - donateWei;
    const remainderUsd = ethers.formatUnits(remainderWei, 6);
    const donateUsd = ethers.formatUnits(donateWei, 6);
    const strategyId = `${syndicateId}:adhoc`;
    const dist = await splitsService.distributeWinnings(remainderUsd, strategyId);
    return { success: dist.success, txHash: dist.txHash, error: dist.error, donateUsd, remainderUsd };
  }
}

export const syndicateService = new SyndicateService();