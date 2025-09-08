"use client";

import React, { useEffect, useState } from 'react';
import { X, Trophy, Ticket, Star, Gift } from 'lucide-react';

interface CelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  achievement: {
    title: string;
    message: string;
    icon: string;
    tickets?: number;
  };
}

export default function CelebrationModal({ isOpen, onClose, achievement }: CelebrationModalProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; color: string; delay: number }>>([]);

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      
      // DELIGHT: Generate confetti particles
      const newParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        color: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'][Math.floor(Math.random() * 6)],
        delay: Math.random() * 2
      }));
      setParticles(newParticles);

      // Auto-close after 5 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {/* DELIGHT: Confetti Animation */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {particles.map((particle) => (
            <div
              key={particle.id}
              className="absolute w-2 h-2 animate-bounce"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                backgroundColor: particle.color,
                animationDelay: `${particle.delay}s`,
                animationDuration: '3s'
              }}
            />
          ))}
        </div>
      )}

      {/* Modal Content */}
      <div className="bg-gradient-to-br from-purple-900 to-blue-900 rounded-2xl p-8 max-w-md w-full border border-purple-500/30 shadow-2xl transform animate-scale-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center">
          {/* Achievement Icon */}
          <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <span className="text-4xl">{achievement.icon}</span>
          </div>

          {/* Achievement Title */}
          <h2 className="text-3xl font-bold text-white mb-4 animate-fade-in">
            {achievement.title}
          </h2>

          {/* Achievement Message */}
          <p className="text-gray-300 mb-6 leading-relaxed animate-fade-in-delay">
            {achievement.message}
          </p>

          {/* Stats Display */}
          {achievement.tickets && (
            <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center gap-2 text-purple-300">
                <Ticket className="w-5 h-5" />
                <span className="font-semibold">{achievement.tickets} Tickets Purchased</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all transform hover:scale-105 active:scale-95"
            >
              Continue Playing! 🎯
            </button>
            <button
              onClick={() => {
                // DELIGHT: Share achievement (could integrate with social media)
                if (navigator.share) {
                  navigator.share({
                    title: achievement.title,
                    text: achievement.message,
                    url: window.location.href
                  });
                }
              }}
              className="bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-lg transition-all transform hover:scale-105 active:scale-95"
            >
              <Gift className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes scale-in {
          from {
            transform: scale(0.8);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fade-in-delay {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-scale-in {
          animation: scale-in 0.5s ease-out;
        }
        
        .animate-fade-in {
          animation: fade-in 0.6s ease-out 0.2s both;
        }
        
        .animate-fade-in-delay {
          animation: fade-in-delay 0.6s ease-out 0.4s both;
        }
      `}</style>
    </div>
  );
}