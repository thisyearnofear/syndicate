"use client";

import { getTimeRemaining, formatTimeRemaining } from '@/lib/contract';
import { useEffect, useState } from 'react';

export function Countdown() {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  useEffect(() => {
    // Fetch initial time remaining
    const fetchTimeRemaining = async () => {
      const timeRemaining = await getTimeRemaining();
      if (timeRemaining !== undefined) {
        setTimeRemaining(timeRemaining);
      }
    };
    
    fetchTimeRemaining();

    // Update time remaining every second
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);

    // Refresh from contract every 5 minutes
    const refreshTimer = setInterval(fetchTimeRemaining, 300000);

    return () => {
      clearInterval(timer);
      clearInterval(refreshTimer);
    };
  }, []);

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700">
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-lg font-medium text-gray-300 mb-2">
            Time Remaining
          </h2>
          <p className="text-3xl font-bold text-white font-mono">
            {timeRemaining !== null
              ? formatTimeRemaining(timeRemaining)
              : '--:--:--'}
          </p>
          {timeRemaining !== null && timeRemaining <= 3600 && (
            <p className="text-sm text-orange-400 mt-2">
              ⚡ Less than 1 hour remaining!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
