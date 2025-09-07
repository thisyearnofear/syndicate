"use client";

import { getLastJackpotResults } from '@/lib/contract';
import { useEffect, useState } from 'react';
import { zeroAddress } from 'viem';

interface LastJackpotEvent {
  time: number;
  winner: string;
  winningTicket: number;
  winAmount: number;
  ticketsPurchasedTotalBps: number;
}

export function LastJackpot() {
  const [lastJackpot, setLastJackpot] = useState<LastJackpotEvent | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLastJackpot = async () => {
      const lastJackpot = await getLastJackpotResults();
      if (lastJackpot) {
        const lastJackpotEvent = {
          time: lastJackpot.time,
          winner: lastJackpot.winner,
          winningTicket: lastJackpot.winningTicket,
          winAmount: lastJackpot.winAmount,
          ticketsPurchasedTotalBps: lastJackpot.ticketsPurchasedTotalBps,
        };
        setLastJackpot(lastJackpotEvent);
      }
      setIsLoading(false);
    };
    
    fetchLastJackpot();
  }, []);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700">
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-xl font-bold text-white mb-4">Last Jackpot Results</h2>
          
          {lastJackpot && !isLoading ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Date:</span>
                <span className="text-white font-medium">
                  {formatDate(lastJackpot.time)}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Winner:</span>
                <span className="text-emerald-400 font-medium">
                  {lastJackpot.winner === zeroAddress
                    ? '🏦 Liquidity Providers'
                    : truncateAddress(lastJackpot.winner)}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Winning Ticket:</span>
                <span className="text-white font-medium">
                  #{lastJackpot.winningTicket.toLocaleString()}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Prize Amount:</span>
                <span className="text-emerald-400 font-bold text-lg">
                  ${(lastJackpot.winAmount / 10 ** 6).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          ) : isLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-700 rounded"></div>
            </div>
          ) : (
            <p className="text-gray-400">No previous jackpot data available</p>
          )}
        </div>
      </div>
    </div>
  );
}
