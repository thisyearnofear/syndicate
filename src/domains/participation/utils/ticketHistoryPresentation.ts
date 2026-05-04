import type { TicketPurchaseHistory } from '@/hooks/useTicketHistory';

export interface TicketHistoryStatusMeta {
  label: string;
  icon: string;
  className: string;
}

export function getTicketHistoryStatusMeta(
  status: TicketPurchaseHistory['status'],
): TicketHistoryStatusMeta {
  switch (status) {
    case 'won':
      return {
        label: 'Winner',
        icon: '🏆',
        className: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
      };
    case 'claimed':
      return {
        label: 'Claimed',
        icon: '✅',
        className: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
      };
    case 'drawn':
      return {
        label: 'Drawn',
        icon: '🧾',
        className: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
      };
    case 'active':
    default:
      return {
        label: 'Completed',
        icon: '✅',
        className: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
      };
  }
}

export function formatTicketHistoryDate(timestamp?: string | null): string {
  if (!timestamp) return '';

  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function sortTicketHistoryByRecency(
  ticketHistory: TicketPurchaseHistory[],
): TicketPurchaseHistory[] {
  return [...ticketHistory].sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    if (tb !== ta) return tb - ta;
    return (b.jackpotRoundId || 0) - (a.jackpotRoundId || 0);
  });
}

export function getTicketHistorySummary(ticketHistory: TicketPurchaseHistory[]) {
  return ticketHistory.reduce(
    (summary, ticket) => ({
      totalTickets: summary.totalTickets + ticket.ticketCount,
      totalSpent: summary.totalSpent + parseFloat(ticket.totalCost),
      totalPurchases: summary.totalPurchases + 1,
    }),
    {
      totalTickets: 0,
      totalSpent: 0,
      totalPurchases: 0,
    },
  );
}

