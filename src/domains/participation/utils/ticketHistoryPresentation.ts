import type { TicketPurchaseHistory } from '@/hooks/useTicketHistory';

export interface TicketHistoryStatusMeta {
  label: string;
  icon: string;
  className: string;
}

/**
 * Status badges are state grammar (docs/DESIGN.md): each state takes its
 * color from the accent ladder, never an off-ladder hue.
 * won → amber (play), claimed → emerald (money secured), drawn → violet
 * (round resolved through the pool), active/default → neutral.
 */
export function getTicketHistoryStatusMeta(
  status: TicketPurchaseHistory['status'],
): TicketHistoryStatusMeta {
  switch (status) {
    case 'won':
      return {
        label: 'Winner',
        icon: '🏆',
        className: 'text-amber-300 bg-amber-500/15 border-amber-400/30',
      };
    case 'claimed':
      return {
        label: 'Claimed',
        icon: '✅',
        className: 'text-emerald-300 bg-emerald-500/15 border-emerald-400/30',
      };
    case 'drawn':
      return {
        label: 'Drawn',
        icon: '🧾',
        className: 'text-violet-300 bg-violet-500/15 border-violet-400/30',
      };
    case 'active':
    default:
      return {
        label: 'Completed',
        icon: '✅',
        className: 'text-gray-300 bg-white/10 border-white/20',
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

