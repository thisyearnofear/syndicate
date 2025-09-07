"use client";

import { getJackpotOdds } from '@/lib/contract';
import { useEffect, useState } from 'react';

export function WinningOdds() {
  const [jackpotOdds, setJackpotOdds] = useState<number | null>(null);

  useEffect(() => {
    const fetchJackpotOdds = async () => {
      const odds = await getJackpotOdds();
      setJackpotOdds(odds || null);
    };
    
    fetchJackpotOdds();
  }, []);

  return (
    <div className="text-center">
      <p className="text-sm text-gray-400 mb-4">
        Odds of winning: {jackpotOdds !== null 
          ? `1 in ${Number(jackpotOdds).toLocaleString()}`
          : 'Loading...'}
      </p>
    </div>
  );
}
