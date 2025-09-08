"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useJackpotDisplay } from '@/providers/MegapotProvider';

interface FloatingElement {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  type: 'ticket' | 'coin' | 'star' | 'heart' | 'diamond';
  color: string;
  rotation: number;
  rotationSpeed: number;
}

interface DynamicBackdropProps {
  children: React.ReactNode;
  className?: string;
}

export default function DynamicBackdrop({ children, className = '' }: DynamicBackdropProps) {
  const [elements, setElements] = useState<FloatingElement[]>([]);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isJackpotGrowing, setIsJackpotGrowing] = useState(false);
  const animationRef = useRef<number>();
  const { currentPrize, isLoading } = useJackpotDisplay();

  // DELIGHT: Create floating elements based on lottery theme
  useEffect(() => {
    const createElements = () => {
      const newElements: FloatingElement[] = [];
      const elementTypes: FloatingElement['type'][] = ['ticket', 'coin', 'star', 'heart', 'diamond'];
      const colors = [
        '#FFD700', // Gold
        '#FF6B6B', // Red
        '#4ECDC4', // Teal
        '#45B7D1', // Blue
        '#96CEB4', // Green
        '#FFEAA7', // Yellow
        '#DDA0DD', // Plum
        '#98FB98'  // Pale Green
      ];

      for (let i = 0; i < 25; i++) {
        newElements.push({
          id: i,
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          size: Math.random() * 20 + 10,
          speed: Math.random() * 0.5 + 0.2,
          type: elementTypes[Math.floor(Math.random() * elementTypes.length)],
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 2
        });
      }
      setElements(newElements);
    };

    createElements();
    window.addEventListener('resize', createElements);
    return () => window.removeEventListener('resize', createElements);
  }, []);

  // DELIGHT: Animate floating elements
  useEffect(() => {
    const animate = () => {
      setElements(prev => prev.map(element => ({
        ...element,
        y: element.y - element.speed,
        rotation: element.rotation + element.rotationSpeed,
        // Reset position when element goes off screen
        ...(element.y < -50 ? {
          y: window.innerHeight + 50,
          x: Math.random() * window.innerWidth
        } : {})
      })));
      
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // DELIGHT: Track mouse for interactive effects
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // DELIGHT: React to jackpot changes
  useEffect(() => {
    if (!isLoading && currentPrize !== '$0') {
      setIsJackpotGrowing(true);
      setTimeout(() => setIsJackpotGrowing(false), 3000);
    }
  }, [currentPrize, isLoading]);

  const getElementSymbol = (type: FloatingElement['type']) => {
    switch (type) {
      case 'ticket': return '🎫';
      case 'coin': return '🪙';
      case 'star': return '⭐';
      case 'heart': return '💖';
      case 'diamond': return '💎';
      default: return '✨';
    }
  };

  return (
    <div className={`relative min-h-screen overflow-hidden ${className}`}>
      {/* DELIGHT: Dynamic gradient background that responds to theme */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
        {/* Lottery ball pattern overlay */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-10 left-10 w-32 h-32 rounded-full border-4 border-white/20"></div>
          <div className="absolute top-40 right-20 w-24 h-24 rounded-full border-4 border-yellow-400/20"></div>
          <div className="absolute bottom-32 left-1/4 w-28 h-28 rounded-full border-4 border-green-400/20"></div>
          <div className="absolute bottom-20 right-1/3 w-20 h-20 rounded-full border-4 border-red-400/20"></div>
        </div>

        {/* DELIGHT: Jackpot excitement overlay */}
        {isJackpotGrowing && (
          <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 animate-pulse"></div>
        )}

        {/* DELIGHT: Interactive mouse glow */}
        <div 
          className="absolute w-96 h-96 rounded-full bg-gradient-radial from-purple-500/20 to-transparent pointer-events-none transition-all duration-300"
          style={{
            left: mousePosition.x - 192,
            top: mousePosition.y - 192,
            transform: 'translate3d(0, 0, 0)'
          }}
        />
      </div>

      {/* DELIGHT: Floating lottery-themed elements */}
      <div className="absolute inset-0 pointer-events-none">
        {elements.map((element) => (
          <div
            key={element.id}
            className="absolute transition-all duration-100 ease-linear"
            style={{
              left: element.x,
              top: element.y,
              transform: `rotate(${element.rotation}deg)`,
              fontSize: element.size,
              color: element.color,
              filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.3))'
            }}
          >
            {getElementSymbol(element.type)}
          </div>
        ))}
      </div>

      {/* DELIGHT: Syndicate connection lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-10">
        <defs>
          <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
        {/* Dynamic connection lines representing syndicate networks */}
        {Array.from({ length: 8 }, (_, i) => (
          <line
            key={i}
            x1={`${(i * 12.5) % 100}%`}
            y1="0%"
            x2={`${((i * 12.5) + 50) % 100}%`}
            y2="100%"
            stroke="url(#connectionGradient)"
            strokeWidth="1"
            className="animate-pulse"
            style={{ animationDelay: `${i * 0.5}s` }}
          />
        ))}
      </svg>

      {/* DELIGHT: Cause impact ripples */}
      <div className="absolute bottom-10 left-10 pointer-events-none">
        <div className="relative">
          <div className="w-4 h-4 bg-green-400 rounded-full animate-ping"></div>
          <div className="absolute inset-0 w-4 h-4 bg-green-400 rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
          <div className="absolute inset-0 w-4 h-4 bg-green-400 rounded-full animate-ping" style={{ animationDelay: '2s' }}></div>
        </div>
      </div>

      {/* DELIGHT: Success celebration particles (when jackpot grows) */}
      {isJackpotGrowing && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 20 }, (_, i) => (
            <div
              key={i}
              className="absolute animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                fontSize: '24px'
              }}
            >
              ✨
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>

      <style jsx>{`
        .bg-gradient-radial {
          background: radial-gradient(circle, var(--tw-gradient-stops));
        }
      `}</style>
    </div>
  );
}