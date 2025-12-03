import React, { useState } from 'react';
import { PuzzlePiece } from '@/shared/components/premium/PuzzlePiece';
import { Heart, Trophy } from 'lucide-react';

interface YieldAllocationControlProps {
  ticketsAllocation: number; // Percentage allocated to tickets (0-100)
  causesAllocation: number;  // Percentage allocated to causes (0-100)
  onAllocationChange: (tickets: number, causes: number) => void;
  className?: string;
}

export function YieldAllocationControl({ 
  ticketsAllocation, 
  causesAllocation, 
  onAllocationChange, 
  className = '' 
}: YieldAllocationControlProps) {
  const [localTickets, setLocalTickets] = useState(ticketsAllocation);
  const [localCauses, setLocalCauses] = useState(causesAllocation);

  const handleSliderChange = (value: number) => {
    const newTickets = value;
    const newCauses = 100 - value;
    
    setLocalTickets(newTickets);
    setLocalCauses(newCauses);
    onAllocationChange(newTickets, newCauses);
  };

  return (
    <div className={`w-full ${className}`}>
      <h3 className="text-lg font-bold text-white mb-4">Yield Allocation</h3>
      <p className="text-gray-400 text-sm mb-6">
        How should your yield be allocated? More tickets = more chances to win, more causes = direct impact
      </p>
      
      <PuzzlePiece variant="secondary" size="md" shape="rounded" className="relative">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Allocation Visualization */}
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-medium text-white">Tickets: {localTickets}%</span>
              </div>
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-400" />
                <span className="text-sm font-medium text-white">Causes: {localCauses}%</span>
              </div>
            </div>
            
            <div className="relative h-3 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-yellow-500 to-yellow-400"
                style={{ width: `${localTickets}%` }}
              />
              <div 
                className="absolute top-0 right-0 h-full bg-gradient-to-r from-red-500 to-red-400"
                style={{ width: `${localCauses}%`, left: `${localTickets}%` }}
              />
            </div>
            
            <div className="flex justify-between text-xs text-gray-400">
              <span>More tickets = More chances to win</span>
              <span>More causes = Direct impact</span>
            </div>
          </div>
          
          {/* Slider Control */}
          <div className="space-y-4">
            <label className="flex items-center justify-between text-sm text-gray-300">
              Ticket Amplification Focus
              <span className="text-yellow-400 font-bold">{localTickets}%</span>
            </label>
            
            <input
              type="range"
              min="0"
              max="100"
              value={localTickets}
              onChange={(e) => handleSliderChange(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer 
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 
                        [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full 
                        [&::-webkit-slider-thumb]:bg-yellow-400"
            />
            
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Conservative Impact</span>
              <span>Max Amplification</span>
            </div>
          </div>
        </div>
        
        {/* Allocation Summary */}
        <div className="mt-6 pt-4 border-t border-white/10">
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-premium p-3 rounded-lg border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-gray-400">Ticket Impact</span>
              </div>
              <p className="text-sm font-bold text-yellow-400">
                {localTickets}% yield → lottery tickets
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Amplifies your participation in draws
              </p>
            </div>
            
            <div className="glass-premium p-3 rounded-lg border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <Heart className="w-4 h-4 text-red-400" />
                <span className="text-xs text-gray-400">Direct Impact</span>
              </div>
              <p className="text-sm font-bold text-red-400">
                {localCauses}% yield → causes
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Consistent funding regardless of wins
              </p>
            </div>
          </div>
        </div>
      </PuzzlePiece>
    </div>
  );
}