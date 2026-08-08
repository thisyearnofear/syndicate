/**
 * Portfolio activity components.
 *
 * Extracted from src/app/portfolio/page.tsx to shrink the page monolith.
 * Renders the lifecycle rows and cards for funding (bridge), deposits, and
 * ticket purchases, plus the shared formatting helpers they use.
 */

import {
  ArrowRight,
  Clock,
  ExternalLink,
  Ticket,
  Zap,
} from 'lucide-react';
import { CompactCard } from '@/shared/components/premium/CompactLayout';
import type { TicketPurchaseHistory } from '@/hooks/useTicketHistory';
import type { BridgeActivityRecord } from '@/utils/bridgeStateManager';
import type { VaultDepositActivityRecord } from '@/utils/vaultActivityManager';

export type PortfolioLifecycleEvent =
  | {
      id: string;
      timestamp: number;
      type: 'bridge';
      bridge: BridgeActivityRecord;
    }
  | {
      id: string;
      timestamp: number;
      type: 'deposit';
      deposit: VaultDepositActivityRecord;
      bridge?: BridgeActivityRecord;
    }
  | {
      id: string;
      timestamp: number;
      type: 'ticket';
      purchase: TicketPurchaseHistory;
    };

export function formatBridgeStatus(status: string) {
  return status.replace(/_/g, ' ');
}

export function formatCurrencyValue(amount: string) {
  const parsed = Number(amount);
  if (Number.isNaN(parsed)) return amount;
  return parsed.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });
}

export function getBridgeProtocolLabel(protocol: string) {
  switch (protocol) {
    case 'cctp':
      return 'Circle CCTP';
    case 'wormhole':
      return 'Wormhole';
    case 'lifi':
      return 'LI.FI';
    case 'debridge':
      return 'deBridge';
    case 'near-intents':
      return 'NEAR Intents';
    case 'base-solana-bridge':
      return 'Base Bridge';
    default:
      return protocol;
  }
}

export function getExplorerUrl(chain: string, txHash?: string) {
  if (!txHash) return null;

  switch (chain) {
    case 'solana':
      return `https://explorer.solana.com/tx/${txHash}`;
    case 'ethereum':
      return `https://etherscan.io/tx/${txHash}`;
    case 'base':
      return `https://basescan.org/tx/${txHash}`;
    case 'near':
      return `https://nearblocks.io/txns/${txHash}`;
    case 'starknet':
      return `https://voyager.online/tx/${txHash}`;
    default:
      return null;
  }
}

export function TicketActivityRow({ purchase }: { purchase: TicketPurchaseHistory }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">
            {purchase.ticketCount} ticket{purchase.ticketCount !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-gray-400">
            {purchase.timestamp ? new Date(purchase.timestamp).toLocaleString() : 'Timestamp unavailable'}
          </p>
        </div>
        <span className="text-sm font-medium text-amber-300">${purchase.totalCost}</span>
      </div>
    </div>
  );
}

export function BridgeActivityRow({ activity }: { activity: BridgeActivityRecord }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">
            {getBridgeProtocolLabel(activity.protocol)} from {activity.sourceChain}
          </p>
          <p className="text-xs text-gray-400">
            {formatCurrencyValue(activity.amount)} • {formatBridgeStatus(activity.status)}
          </p>
        </div>
        <span className="text-xs font-medium text-brand-300">
          {new Date(activity.updatedAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

export function VaultDepositActivityRow({ deposit }: { deposit: VaultDepositActivityRecord }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">
            Deposit into {deposit.protocol.toUpperCase()}
          </p>
          <p className="text-xs text-gray-400">
            {formatCurrencyValue(deposit.amount)} • {new Date(deposit.timestamp).toLocaleString()}
          </p>
        </div>
        <span className="text-xs font-medium text-emerald-300">
          deposited
        </span>
      </div>
    </div>
  );
}

export function TicketActivityCard({ purchase }: { purchase: TicketPurchaseHistory }) {
  return (
    <CompactCard variant="glass" padding="sm" hover={false} className="rounded-xl border border-white/20">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white">
              {purchase.ticketCount} ticket{purchase.ticketCount !== 1 ? 's' : ''} purchased
            </h3>
            <p className="text-sm text-gray-400">
              {purchase.timestamp ? new Date(purchase.timestamp).toLocaleString() : 'Timestamp unavailable'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
              {purchase.jackpotRoundId ? (
                <span className="rounded-full bg-white/10 px-2 py-1 text-gray-300">
                  Round {purchase.jackpotRoundId}
                </span>
              ) : null}
              {purchase.status ? (
                <span className="rounded-full bg-amber-500/20 px-2 py-1 text-amber-200">
                  {purchase.status}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-400">Cost</p>
          <p className="font-bold text-amber-300">${purchase.totalCost}</p>
        </div>
      </div>

      {purchase.txHash ? (
        <div className="mt-4 pt-4 border-t border-white/10">
          <a
            href={`https://basescan.org/tx/${purchase.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200"
          >
            <Clock className="w-4 h-4" />
            View transaction
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      ) : null}
    </CompactCard>
  );
}

export function BridgeActivityCard({ activity }: { activity: BridgeActivityRecord }) {
  const sourceExplorerUrl = getExplorerUrl(activity.sourceChain, activity.sourceTxHash);
  const destinationExplorerUrl = getExplorerUrl(activity.destinationChain, activity.destinationTxHash);

  return (
    <CompactCard variant="glass" padding="sm" hover={false} className="rounded-xl border border-white/20">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white">
            <ArrowRight className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white">
              {getBridgeProtocolLabel(activity.protocol)} funding route
            </h3>
            <p className="text-sm text-gray-400">
              {activity.sourceChain} to {activity.destinationChain} • {formatBridgeStatus(activity.status)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
              <span className="rounded-full bg-white/10 px-2 py-1 text-gray-300">
                {formatCurrencyValue(activity.amount)}
              </span>
              <span className="rounded-full bg-white/10 px-2 py-1 text-gray-300">
                {new Date(activity.updatedAt).toLocaleString()}
              </span>
              {activity.error ? (
                <span className="rounded-full bg-red-500/15 px-2 py-1 text-red-300">
                  {activity.error}
                </span>
              ) : null}
              {activity.redirectUrl ? (
                <a
                  href={activity.redirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-brand-500/15 px-2 py-1 text-brand-300 hover:text-brand-200"
                >
                  Complete manually
                </a>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 text-xs">
          {sourceExplorerUrl ? (
            <a
              href={sourceExplorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-300 hover:text-brand-200"
            >
              Source Tx
            </a>
          ) : null}
          {destinationExplorerUrl ? (
            <a
              href={destinationExplorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-300 hover:text-green-200"
            >
              Destination Tx
            </a>
          ) : null}
        </div>
      </div>
    </CompactCard>
  );
}

export function VaultDepositActivityCard({
  deposit,
  bridge,
}: {
  deposit: VaultDepositActivityRecord;
  bridge?: BridgeActivityRecord;
}) {
  return (
    <CompactCard variant="glass" padding="sm" hover={false} className="rounded-xl border border-white/20">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white">
              {deposit.protocol.toUpperCase()} deposit
            </h3>
            <p className="text-sm text-gray-400">
              {formatCurrencyValue(deposit.amount)} allocated into the strategy
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
              <span className="rounded-full bg-white/10 px-2 py-1 text-gray-300">
                {new Date(deposit.timestamp).toLocaleString()}
              </span>
              {bridge ? (
                <span className="rounded-full bg-brand-500/15 px-2 py-1 text-brand-300">
                  From {getBridgeProtocolLabel(bridge.protocol)} on {bridge.sourceChain}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 text-xs">
          <a
            href={`https://basescan.org/tx/${deposit.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-300 hover:text-emerald-200"
          >
            Deposit Tx
          </a>
        </div>
      </div>
    </CompactCard>
  );
}

export function LifecycleEventCard({ event }: { event: PortfolioLifecycleEvent }) {
  if (event.type === 'bridge') {
    return (
      <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">
              Funding routed via {getBridgeProtocolLabel(event.bridge.protocol)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {event.bridge.sourceChain} to {event.bridge.destinationChain} • {formatCurrencyValue(event.bridge.amount)}
            </p>
          </div>
          <span className="text-xs text-brand-200">
            {new Date(event.timestamp).toLocaleString()}
          </span>
        </div>
      </div>
    );
  }

  if (event.type === 'deposit') {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">
              Capital deposited into {event.deposit.protocol.toUpperCase()}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {formatCurrencyValue(event.deposit.amount)}
              {event.bridge ? ` • sourced from ${getBridgeProtocolLabel(event.bridge.protocol)} on ${event.bridge.sourceChain}` : ''}
            </p>
          </div>
          <span className="text-xs text-emerald-200">
            {new Date(event.timestamp).toLocaleString()}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">
            {event.purchase.ticketCount} ticket{event.purchase.ticketCount !== 1 ? 's' : ''} purchased
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {event.purchase.totalCost ? `$${event.purchase.totalCost}` : 'Cost unavailable'}
            {event.purchase.jackpotRoundId ? ` • round ${event.purchase.jackpotRoundId}` : ''}
          </p>
        </div>
        <span className="text-xs text-amber-200">
          {event.purchase.timestamp ? new Date(event.purchase.timestamp).toLocaleString() : 'Timestamp unavailable'}
        </span>
      </div>
    </div>
  );
}
