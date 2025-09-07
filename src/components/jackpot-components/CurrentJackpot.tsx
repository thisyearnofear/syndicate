"use client";

import { getJackpotAmount } from '@/lib/contract';
import { useEffect, useState } from 'react';

export function CurrentJackpot() {
  const [jackpotAmount, setJackpotAmount] = useState<number | undefined>(undefined);

  useEffect(() => {
    const fetchJackpotAmount = async () => {
      const jackpotAmount = await getJackpotAmount();
      setJackpotAmount(jackpotAmount);
    };
    
    fetchJackpotAmount();
    
    // Update every 30 seconds
    const interval = setInterval(fetchJackpotAmount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-gradient-to-r from-blue-900 to-purple-900 rounded-xl shadow-lg border border-blue-700">
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-lg font-medium text-blue-200 mb-2">
            Current Jackpot
          </h2>
          <p className="text-4xl font-bold text-white">
            {jackpotAmount !== undefined
              ? `$${jackpotAmount.toLocaleString('en-US', { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                })}`
              : 'Loading...'}
          </p>
        </div>
      </div>
    </div>
  );
}
