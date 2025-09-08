"use client";

import { getJackpotAmount } from '@/lib/contract';
import { useEffect, useState } from 'react';

export function CurrentJackpot() {
  const [jackpotAmount, setJackpotAmount] = useState<number | undefined>(undefined);
  const [previousAmount, setPreviousAmount] = useState<number | undefined>(undefined);
  const [isGrowing, setIsGrowing] = useState(false);
  const [displayAmount, setDisplayAmount] = useState<number>(0);

  useEffect(() => {
    const fetchJackpotAmount = async () => {
      const newAmount = await getJackpotAmount();
      if (newAmount !== undefined) {
        setPreviousAmount(jackpotAmount);
        setJackpotAmount(newAmount);
        
        // DELIGHT: Trigger growing animation if amount increased
        if (jackpotAmount !== undefined && newAmount > jackpotAmount) {
          setIsGrowing(true);
          setTimeout(() => setIsGrowing(false), 2000);
        }
      }
    };
    
    fetchJackpotAmount();
    
    // Update every 30 seconds
    const interval = setInterval(fetchJackpotAmount, 30000);
    return () => clearInterval(interval);
  }, [jackpotAmount]);

  // DELIGHT: Animated counter effect
  useEffect(() => {
    if (jackpotAmount !== undefined) {
      const startAmount = previousAmount || 0;
      const endAmount = jackpotAmount;
      const duration = 1500; // 1.5 seconds
      const startTime = Date.now();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentAmount = startAmount + (endAmount - startAmount) * easeOutQuart;
        
        setDisplayAmount(currentAmount);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
    }
  }, [jackpotAmount, previousAmount]);

  return (
    <div className={`bg-gray-800/50 rounded-lg px-6 py-4 border border-gray-600 transition-all duration-500 ${
      isGrowing ? 'scale-105 border-green-400 shadow-lg shadow-green-400/20' : ''
    }`}>
      <div className="text-center">
        <div className="text-sm text-gray-400 mb-1 flex items-center justify-center gap-2">
          Current Jackpot
          {isGrowing && (
            <span className="text-green-400 animate-pulse">↗</span>
          )}
        </div>
        <div className={`text-2xl font-bold transition-all duration-300 ${
          isGrowing ? 'text-green-400 scale-110' : 'text-white'
        }`}>
          {jackpotAmount !== undefined
            ? `$${displayAmount.toLocaleString('en-US', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              })}`
            : (
              <span className="animate-pulse">Loading...</span>
            )}
        </div>
        {isGrowing && (
          <div className="text-xs text-green-400 mt-1 animate-bounce">
            ★ Jackpot Growing!
          </div>
        )}
      </div>
    </div>
  );
}