import {
  Megapot,
  TicketPurchase,
  WinWithdrawal,
  User,
} from "generated";

Megapot.UserTicketPurchase.handler(async ({ event, context }) => {
  const { recipient, ticketsPurchasedTotalBps, referrer, buyer } = event.params;
  const { block, transaction } = event;

  // Convert BPS to actual tickets (divide by 10000)
  const ticketsCount = ticketsPurchasedTotalBps / 10000n;

  const user = await context.User.get(recipient);
  const userTotalTickets = (user?.totalTickets ?? 0n) + ticketsCount;
  const userTotalWinnings = user?.totalWinnings ?? 0n;

  const userEntity: User = {
    id: recipient,
    totalTickets: userTotalTickets,
    totalWinnings: userTotalWinnings,
  };

  const ticketPurchase: TicketPurchase = {
    id: `${transaction.hash}-${event.logIndex}`,
    recipient: recipient,
    ticketsPurchased: ticketsCount,
    referrer: referrer,
    buyer: buyer,
    transactionHash: transaction.hash,
    blockNumber: block.number,
    timestamp: block.timestamp,
  };

  context.User.set(userEntity);
  context.TicketPurchase.set(ticketPurchase);
});

Megapot.UserWinWithdrawal.handler(async ({ event, context }) => {
  const { user: userAddress, amount } = event.params;
  const { block, transaction } = event;

  const user = await context.User.get(userAddress);
  const userTotalTickets = user?.totalTickets ?? 0n;
  const userTotalWinnings = (user?.totalWinnings ?? 0n) + amount;

  const userEntity: User = {
    id: userAddress,
    totalTickets: userTotalTickets,
    totalWinnings: userTotalWinnings,
  };

  const withdrawal: WinWithdrawal = {
    id: `${transaction.hash}-${event.logIndex}`,
    user: userAddress,
    amount: amount,
    transactionHash: transaction.hash,
    blockNumber: block.number,
    timestamp: block.timestamp,
  };

  context.User.set(userEntity);
  context.WinWithdrawal.set(withdrawal);
});
