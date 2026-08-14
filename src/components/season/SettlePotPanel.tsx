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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Gavel, Lock, TriangleAlert } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { useUnifiedPurchase, useUnifiedWallet } from '@/hooks';
import { web3Service } from '@/services/web3Service';
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
  onSettled,
}: SettlePotPanelProps) {
  const { address, isConnected } = useUnifiedWallet();
  const { purchase } = useUnifiedPurchase();

  const [ticketPrice, setTicketPrice] = useState(1);
  const [phase, setPhase] = useState<SettlePhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [callerTxHash, setCallerTxHash] = useState<string | null>(null);
  const [bonusTxHash, setBonusTxHash] = useState<string | null>(null);
  const [result, setResult] = useState<SettlementResult | null>(null);

  const winner = bids.length > 0 ? bids[0] : null;
  const chestUsdc = Number(round.chestSnapshotUsdc) || 0;
  const cutoffPassed = Date.parse(round.cutoffAt) <= now;
  const settled = round.status === 'settled';

  useEffect(() => {
    let active = true;
    web3Service
      .getTicketPrice()
      .then((value) => {
        const parsed = Number(value);
        if (active && Number.isFinite(parsed) && parsed > 0) setTicketPrice(parsed);
      })
      .catch(() => {
        /* keep fallback $1 ticket price */
      });
    return () => {
      active = false;
    };
  }, []);

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
    onSettled,
  ]);

  if (!winner) {
    return (
      <p className="text-xs text-gray-500">
        No live bids at cutoff — the round will expire and the chest rolls into the next round.
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

  return (
    <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/[0.05] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Gavel className="w-4 h-4 text-emerald-300" />
        <p className="text-sm font-bold text-white">Auction closed — settle the pot</p>
      </div>

      <div className="text-xs text-gray-300 space-y-1">
        <p>
          Winner: <span className="font-semibold text-emerald-300">{shortAddr(winner.bidderAddress)}</span>{' '}
          at {(winner.discountBps / 100).toFixed(1)}% discount
        </p>
        <p>
          Caller payout: {split.callerTickets} ticket{split.callerTickets !== 1 ? 's' : ''} (~${split.callerUsdc.toFixed(2)})
        </p>
        <p>
          Crew bonus: {split.bonusTickets} ticket{split.bonusTickets !== 1 ? 's' : ''} (~${split.bonusUsdc.toFixed(2)})
        </p>
        <p className="text-gray-500">
          Ticket price used: ${ticketPrice.toFixed(2)}. Both purchases are real on-chain Megapot entries; receipts are verified before the round is marked settled.
        </p>
      </div>

      {executing && (
        <p className="text-xs text-amber-300 animate-pulse">
          {phase === 'payout' && 'Step 1/3 — purchasing caller payout tickets…'}
          {phase === 'bonus' && 'Step 2/3 — purchasing crew bonus tickets…'}
          {phase === 'journal' && 'Step 3/3 — verifying receipts and journaling settlement…'}
        </p>
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
          variant="default"
          loading={executing}
          disabled={executing}
          onClick={() => void handleSettle()}
        >
          {phase === 'error' && callerTxHash && !bonusTxHash
            ? 'Retry bonus purchase'
            : phase === 'error'
              ? 'Retry settlement'
              : 'Settle pot'}
        </Button>
      ) : (
        <p className="text-xs text-gray-500 inline-flex items-center gap-1">
          <Lock className="w-3 h-3" />
          {isConnected
            ? `Waiting for ${isWinner ? 'you' : `winner ${shortAddr(winner.bidderAddress)} or coordinator`} to settle.`
            : 'Connect the winner or coordinator wallet to settle.'}
        </p>
      )}
    </div>
  );
}
