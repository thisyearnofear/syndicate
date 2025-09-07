"use client";

import { getTicketPrice } from '@/lib/contract';
import { useEffect, useState } from 'react';

export function TicketPrice() {
  const [ticketPrice, setTicketPrice] = useState<number | null>(null);

  useEffect(() => {
    const fetchTicketPrice = async () => {
      const price = await getTicketPrice();
      setTicketPrice(price || null);
    };
    
    fetchTicketPrice();
  }, []);

  return (
    <div className="text-center">
      <h2 className="text-lg font-medium text-gray-400 mb-2">
        Ticket Price
      </h2>
      <p className="text-2xl font-bold text-white mb-4">
        {ticketPrice !== null ? `$${ticketPrice}` : 'Loading...'} USDC
      </p>
    </div>
  );
}
