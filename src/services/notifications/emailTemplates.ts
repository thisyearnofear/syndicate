/**
 * EMAIL TEMPLATES — Notification content for yield and draw events.
 *
 * Plain-text templates (the ACP binary handles delivery).
 * Each template receives typed data and returns { subject, body }.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface YieldEarnedData {
  recipientName?: string;
  yieldAmountUsd: number;
  ticketsEarned: number;
  vaultProtocol: string;
  totalDeposited: number;
  period: string; // e.g., "this week", "today"
}

export interface DrawResultData {
  recipientName?: string;
  drawId: number;
  prizePoolUsd: number;
  ticketsSold: number;
  isResolved: boolean;
  winningTicket?: number;
  userTicketCount: number;
  userWonAmount?: number;
}

// ─── Templates ────────────────────────────────────────────────────────────────

export function yieldEarnedEmail(data: YieldEarnedData): { subject: string; body: string } {
  const greeting = data.recipientName ? `Hi ${data.recipientName},` : "Hi,";
  const ticketWord = data.ticketsEarned === 1 ? "ticket" : "tickets";

  return {
    subject: `Your yield earned ${data.ticketsEarned} ${ticketWord} ${data.period}`,
    body: `${greeting}

Your ${data.vaultProtocol} vault earned $${data.yieldAmountUsd.toFixed(2)} in yield ${data.period}.

That's ${data.ticketsEarned} ${ticketWord} automatically entered into upcoming draws — no action needed from you.

Summary:
- Deposited: $${data.totalDeposited.toFixed(2)}
- Yield earned: $${data.yieldAmountUsd.toFixed(2)}
- Tickets purchased: ${data.ticketsEarned}

Your principal stays safe. Your yield works for you.

— Syndicate
https://syndicateapp.vercel.app/portfolio
`,
  };
}

export function drawResultEmail(data: DrawResultData): { subject: string; body: string } {
  const greeting = data.recipientName ? `Hi ${data.recipientName},` : "Hi,";

  if (data.userWonAmount && data.userWonAmount > 0) {
    // Winner email
    return {
      subject: `You won $${data.userWonAmount.toFixed(2)} in Draw #${data.drawId}!`,
      body: `${greeting}

Congratulations! You won $${data.userWonAmount.toFixed(2)} in Draw #${data.drawId}.

Your winnings have been paid directly to your wallet — no claiming needed.

Draw Summary:
- Prize pool: $${data.prizePoolUsd.toFixed(0)}
- Tickets sold: ${data.ticketsSold.toLocaleString()}
- Your tickets: ${data.userTicketCount}

Keep playing or let your yield vaults earn tickets automatically.

— Syndicate
https://syndicateapp.vercel.app/portfolio
`,
    };
  }

  // Non-winner email (participation summary)
  const resultLine = data.isResolved
    ? `Winning ticket: #${data.winningTicket?.toLocaleString() ?? "unknown"}`
    : "No jackpot winner — the prize rolls into the next draw.";

  return {
    subject: `Draw #${data.drawId} results — ${data.isResolved ? "winner found" : "prize rolled over"}`,
    body: `${greeting}

Draw #${data.drawId} has completed.

${resultLine}

Draw Summary:
- Prize pool: $${data.prizePoolUsd.toFixed(0)}
- Tickets sold: ${data.ticketsSold.toLocaleString()}
- Your tickets: ${data.userTicketCount}

${data.isResolved
  ? "Better luck next time! Your yield vaults are still earning tickets for future draws."
  : "The prize pool grows! Your existing tickets and future yield-purchased tickets carry into the next draw."}

— Syndicate
https://syndicateapp.vercel.app/portfolio
`,
  };
}
