'use client';

/**
 * SETTLE POT PANEL — client-side execution of a finished Call-the-Pot auction.
 *
 * After the auction cutoff, the winning bidder (or the crew coordinator)
 * executes two REAL Megapot purchases through the existing purchase rail:
 *   1. chest × (1 − discount) tickets to the winner's address
 *   2. chest × discount tickets to the coordinator's pooled entry
 * Then both transaction hashes are sent to POST /api/season/rounds/[id]/settle,
 * which verifies receipts on-chain before marking the round settled.
 *
 * No simulated transactions: if a purchase or receipt verification fails, the
 * panel shows an explicit error and allows retry from the failed step.
 */

import { useCallback, useMemo, useState } from 'react';
import { Gavel, Lock, TriangleAlert } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { useUnifiedPurchase, useUnifiedWallet } from '@/hooks';
import { useTicketPrice } from '@/hooks/useTicketPrice';
import { SettlementReveal, type SettlementResult } from './SettlementReveal';

export interface SettleRoundInfo {
  id: string;
  chestSnapshotUsdc: string;
  cutoffAt: string;
  status: string;
}

export interface SettleBidInfo {
  id: string;
  bidderAddress: string;
  discountBps: number;
  placedAt: string;
  revisedAt: string | null;
}

interface SettlePotPanelProps {
  round: SettleRoundInfo;
  bids: SettleBidInfo[];
  coordinatorAddress: string;
  canWrite: boolean;
  /** Parent-supplied clock tick (avoids impure Date.now() during render). */
  now: number;
  /** Chain the season runs on — selects the right block explorer in the reveal. */
  chainId?: number;
  /**
   * Seats still held once the winner exits, and each survivor's renormalized
   * cut. Presentation only — passed straight into the reveal so the growth beat
   * can name a real figure instead of a vague sentence. Omitted when the caller
   * doesn't have the member list to hand.
   */
  survivingSeats?: number;
  survivorCutBps?: number;
  onSettled: (result: SettlementResult) => void;
}

type SettlePhase = 'idle' | 'payout' | 'bonus' | 'journal' | 'done' | 'error';

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function SettlePotPanel({
  round,
  bids,
  coordinatorAddress,
  canWrite,
  now,
  chainId,
  survivingSeats,
  survivorCutBps,
  onSettled,
}: SettlePotPanelProps) {
  const { address, isConnected } = useUnifiedWallet();
  const { purchase } = useUnifiedPurchase();
  // Shared with the offer previews so the price quoted before a bid and the
  // price used at settlement are read from the same place.
  const { ticketPrice } = useTicketPrice();

  const [phase, setPhase] = useState<SettlePhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [callerTxHash, setCallerTxHash] = useState<string | null>(null);
  const [bonusTxHash, setBonusTxHash] = useState<string | null>(null);
  const [result, setResult] = useState<SettlementResult | null>(null);

  const winner = bids.length > 0 ? bids[0] : null;
  const chestUsdc = Number(round.chestSnapshotUsdc) || 0;
  const cutoffPassed = Date.parse(round.cutoffAt) <= now;
  const settled = round.status === 'settled';

  const split = useMemo(() => {
    if (!winner) return null;
    const discount = winner.discountBps / 10_000;
    const callerUsdc = chestUsdc * (1 - discount);
    const bonusUsdc = chestUsdc * discount;
    return {
      callerUsdc,
      bonusUsdc,
      callerTickets: Math.max(1, Math.floor(callerUsdc / ticketPrice)),
      bonusTickets: Math.max(1, Math.floor(bonusUsdc / ticketPrice)),
    };
  }, [winner, chestUsdc, ticketPrice]);

  const lowerAddress = address?.toLowerCase();
  const isWinner = !!winner && !!lowerAddress && winner.bidderAddress.toLowerCase() === lowerAddress;
  const isCoordinator =
    !!lowerAddress && coordinatorAddress.toLowerCase() === lowerAddress;
  const canExecute = canWrite && isConnected && (isWinner || isCoordinator);

  const handleSettle = useCallback(async () => {
    if (!winner || !split || !address || phase === 'done') return;

    setError(null);
    let payoutTx = callerTxHash;
    let bonusTx = bonusTxHash;

    try {
      if (!payoutTx) {
        setPhase('payout');
        const payoutResult = await purchase({
          userAddress: address,
          chain: 'base',
          ticketCount: split.callerTickets,
          recipientAddress: winner.bidderAddress,
        });
        if (!payoutResult.success || !payoutResult.txHash) {
          throw new Error(payoutResult.error?.message ?? 'Caller payout purchase failed');
        }
        payoutTx = payoutResult.txHash;
        setCallerTxHash(payoutTx);
      }

      if (!bonusTx) {
        setPhase('bonus');
        const bonusResult = await purchase({
          userAddress: address,
          chain: 'base',
          ticketCount: split.bonusTickets,
          recipientAddress: coordinatorAddress,
        });
        if (!bonusResult.success || !bonusResult.txHash) {
          throw new Error(bonusResult.error?.message ?? 'Crew bonus purchase failed');
        }
        bonusTx = bonusResult.txHash;
        setBonusTxHash(bonusTx);
      }

      setPhase('journal');
      const response = await fetch(`/api/season/rounds/${round.id}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callerPayoutTxHash: payoutTx,
          crewBonusTxHash: bonusTx,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? 'Settlement journal rejected the receipts');
      }

      const settledResult: SettlementResult = {
        winnerAddress: winner.bidderAddress,
        discountBps: winner.discountBps,
        chestUsdc,
        callerTickets: split.callerTickets,
        bonusTickets: split.bonusTickets,
        callerTxHash: payoutTx,
        bonusTxHash: bonusTx,
        chainId,
        survivingSeats,
        survivorCutBps,
      };
      setResult(settledResult);
      setPhase('done');
      onSettled(settledResult);
    } catch (e) {
      setPhase('error');
      setError(e instanceof Error ? e.message : 'Settlement failed');
    }
  }, [
    winner,
    split,
    address,
    phase,
    callerTxHash,
    bonusTxHash,
    purchase,
    coordinatorAddress,
    round.id,
    chestUsdc,
    chainId,
    survivingSeats,
    survivorCutBps,
    onSettled,
  ]);

  if (!winner) {
    return (
      <p className="text-xs text-[#d8c9ae]/50">
        No live offers at the bell — the round expires and the chest rolls on to the next one.
      </p>
    );
  }

  if (!cutoffPassed && !settled) {
    return null;
  }

  if (phase === 'done' && result) {
    return <SettlementReveal result={result} />;
  }

  if (!split) {
    return null;
  }

  const executing = phase === 'payout' || phase === 'bonus' || phase === 'journal';
  const stepIndex = phase === 'payout' ? 1 : phase === 'bonus' ? 2 : phase === 'journal' ? 3 : 0;

  return (
    <div className="vellum vellum-raised rounded-xl p-4 space-y-3">
      <div>
        <p className="arena-label flex items-center gap-1.5 text-[10px]">
          <Gavel className="h-3 w-3" /> The bell has rung
        </p>
        <p className="font-display text-lg font-bold text-[#f7ead0]">Settle the pot</p>
      </div>

      {/* The division, at a size that matches the reveal it becomes. */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="arena-label text-[9px]">Caller takes</p>
          <p className="font-display text-2xl font-bold leading-none text-[#f7ead0] tabular-nums">
            ${split.callerUsdc.toFixed(2)}
          </p>
          <p className="mt-0.5 text-[11px] text-[#d8c9ae]/55">
            {split.callerTickets} ticket{split.callerTickets !== 1 ? 's' : ''} to{' '}
            {shortAddr(winner.bidderAddress)}
          </p>
        </div>
        <div>
          <p className="arena-label text-[9px]">Crew receives</p>
          <p className="font-display text-2xl font-bold leading-none text-[#e3c887] tabular-nums">
            ${split.bonusUsdc.toFixed(2)}
          </p>
          <p className="mt-0.5 text-[11px] text-[#d8c9ae]/55">
            {split.bonusTickets} bonus ticket{split.bonusTickets !== 1 ? 's' : ''} at{' '}
            {(winner.discountBps / 100).toFixed(1)}%
          </p>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-[#d8c9ae]/45">
        Ticket price ${ticketPrice.toFixed(2)}. Both payouts are real on-chain Megapot purchases;
        the round is only marked settled once both receipts verify.
      </p>

      {/* Three real steps, none of which may look finished early. */}
      {executing && (
        <div className="rounded-lg border border-[#c9a227]/30 bg-[#c9a227]/[0.07] px-3 py-2">
          <p className="arena-label text-[9px]">Step {stepIndex} of 3</p>
          <p className="text-xs text-[#f7ead0]/90">
            {phase === 'payout' && 'Purchasing the caller’s payout tickets…'}
            {phase === 'bonus' && 'Purchasing the crew’s bonus tickets…'}
            {phase === 'journal' && 'Verifying both receipts on-chain and journaling the settlement…'}
          </p>
        </div>
      )}

      {phase === 'error' && error && (
        <p className="text-xs text-red-400 flex items-start gap-1">
          <TriangleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {canExecute ? (
        <Button
          size="sm"
          variant="warning"
          loading={executing}
          disabled={executing}
          onClick={() => void handleSettle()}
        >
          {phase === 'error' && callerTxHash && !bonusTxHash
            ? 'Retry bonus purchase'
            : phase === 'error'
              ? 'Retry settlement'
              : 'Divide the chest'}
        </Button>
      ) : (
        <p className="text-xs text-[#d8c9ae]/50 inline-flex items-center gap-1">
          <Lock className="w-3 h-3" />
          {isConnected
            ? `Waiting for ${isWinner ? 'you' : `${shortAddr(winner.bidderAddress)} or the coordinator`} to settle.`
            : 'Connect the winning or coordinator wallet to settle.'}
        </p>
      )}
    </div>
  );
}
