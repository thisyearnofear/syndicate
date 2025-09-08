"use client";

import React, { useState, useEffect } from 'react';
import { Ticket, Sparkles } from 'lucide-react';

interface TicketPurchaseAnimationProps {
  isVisible: boolean;
  ticketCount: number;
  onComplete: () => void;
}

export default function TicketPurchaseAnimation({ 
  isVisible, 
  ticketCount, 
  onComplete 
}: TicketPurchaseAnimationProps) {
  const [stage, setStage] = useState<'purchasing' | 'success' | 'complete'>('purchasing');
  const [tickets, setTickets] = useState<Array<{ id: number; delay: number }>>([]);

  useEffect(() => {
    if (isVisible) {
      setStage('purchasing');
      
      // DELIGHT: Generate ticket animations
      const newTickets = Array.from({ length: Math.min(ticketCount, 10) }, (_, i) => ({
        id: i,
        delay: i * 100
      }));
      setTickets(newTickets);

      // Progress through stages
      const timer1 = setTimeout(() => setStage('success'), 1500);
      const timer2 = setTimeout(() => {
        setStage('complete');
        onComplete();
      }, 3000);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [isVisible, ticketCount, onComplete]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-gradient-to-br from-purple-900 to-blue-900 rounded-2xl p-8 max-w-sm w-full mx-4 text-center border border-purple-500/30">
        
        {stage === 'purchasing' && (
          <div className="space-y-6">
            <div className="animate-spin w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
            <h3 className="text-xl font-bold text-white">Purchasing Tickets...</h3>
            <div className="flex justify-center gap-2">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center animate-bounce"
                  style={{ animationDelay: `${ticket.delay}ms` }}
                >
                  <Ticket className="w-4 h-4 text-white" />
                </div>
              ))}
            </div>
          </div>
        )}

        {stage === 'success' && (
          <div className="space-y-6 animate-fade-in">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">Success!</h3>
              <p className="text-gray-300">
                {ticketCount} ticket{ticketCount > 1 ? 's' : ''} purchased successfully!
              </p>
            </div>
            <div className="text-yellow-400 text-sm animate-bounce">
              Good luck! ★
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}