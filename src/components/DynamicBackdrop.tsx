"use client";

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useJackpotDisplay } from '@/providers/MegapotProvider';
import { useOptimizedParticles } from '@/hooks/performance/useOptimizedAnimation';
import { performanceBudgetManager } from '@/services/performance/PerformanceBudgetManager';

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
  opacity: number;
}

interface DynamicBackdropProps {
  children: React.ReactNode;
  className?: string;
}

export default function DynamicBackdrop({ children, className = '' }: DynamicBackdropProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isJackpotGrowing, setIsJackpotGrowing] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const { currentPrize, isLoading } = useJackpotDisplay();
  
  // PERFORMANT: Check device capabilities
  const deviceCapabilities = useMemo(() => performanceBudgetManager.getStatus().capabilities, []);
  const supportsAdvancedEffects = performanceBudgetManager.supportsAdvancedEffects();

  // PERFORMANT: Window size tracking with debouncing
  useEffect(() => {
    const updateWindowSize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };

    updateWindowSize();
    
    let timeoutId: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateWindowSize, 150);
    };

    window.addEventListener('resize', debouncedResize);
    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(timeoutId);
    };
  }, []);

  // PERFORMANT: Create floating element factory
  const createFloatingElement = (): FloatingElement => {
    const elementTypes: FloatingElement['type'][] = ['ticket', 'coin', 'star', 'heart', 'diamond'];
    const colors = [
      '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', 
      '#96CEB4', '#FFEAA7', '#DDA0DD', '#98FB98'
    ];

    return {
      id: Math.random(),
      x: Math.random() * (windowSize.width || 1000),
      y: Math.random() * (windowSize.height || 800),
      size: Math.random() * 15 + 8, // Smaller particles for better performance
      speed: Math.random() * 0.3 + 0.1, // Slower for better performance
      type: elementTypes[Math.floor(Math.random() * elementTypes.length)],
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 1.5, // Slower rotation
      opacity: Math.random() * 0.6 + 0.4,
    };
  };

  // PERFORMANT: Update floating element
  const updateFloatingElement = (element: FloatingElement, deltaTime: number): FloatingElement => {
    const newY = element.y - element.speed * deltaTime * 0.06; // 60fps normalized
    const newRotation = element.rotation + element.rotationSpeed * deltaTime * 0.06;

    // Reset position when element goes off screen
    if (newY < -50) {
      return {
        ...element,
        y: (windowSize.height || 800) + 50,
        x: Math.random() * (windowSize.width || 1000),
        rotation: newRotation,
      };
    }

    return {
      ...element,
      y: newY,
      rotation: newRotation,
    };
  };

  // PERFORMANT: Use optimized particle system
  const baseParticleCount = deviceCapabilities.tier === 'high' ? 12 : deviceCapabilities.tier === 'medium' ? 6 : 3;
  const particleCount = supportsAdvancedEffects ? baseParticleCount : Math.min(baseParticleCount, 3);

  const {
    particles: elements,
    isActive: isAnimating,
  } = useOptimizedParticles(
    particleCount,
    createFloatingElement,
    updateFloatingElement,
    {
      id: 'backdrop-particles',
      priority: 'low',
      enabled: supportsAdvancedEffects,
      respectReducedMotion: true,
      frameRate: deviceCapabilities.tier === 'high' ? 60 : 30,
    }
  );

  // PERFORMANT: Throttled mouse tracking (only if advanced effects supported)
  useEffect(() => {
    if (!supportsAdvancedEffects) return;

    let timeoutId: NodeJS.Timeout;
    const handleMouseMove = (e: MouseEvent) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setMousePosition({ x: e.clientX, y: e.clientY });
      }, 50); // Throttle to 20fps
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeoutId);
    };
  }, [supportsAdvancedEffects]);

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

        {/* PERFORMANT: Conditional interactive mouse glow */}
        {supportsAdvancedEffects && deviceCapabilities.tier !== 'low' && (
          <div 
            className="absolute w-96 h-96 rounded-full bg-gradient-radial from-purple-500/15 to-transparent pointer-events-none transition-transform duration-500"
            style={{
              left: mousePosition.x - 192,
              top: mousePosition.y - 192,
              transform: 'translate3d(0, 0, 0)',
              willChange: 'transform'
            }}
          />
        )}
      </div>

      {/* PERFORMANT: Optimized floating elements */}
      {supportsAdvancedEffects && isAnimating && (
        <div className="absolute inset-0 pointer-events-none">
          {elements.map((element) => (
            <div
              key={element.id}
              className="absolute will-change-transform"
              style={{
                left: element.x,
                top: element.y,
                transform: `translate3d(0, 0, 0) rotate(${element.rotation}deg)`,
                fontSize: element.size,
                color: element.color,
                opacity: element.opacity,
                filter: deviceCapabilities.tier === 'high' ? 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.2))' : 'none'
              }}
            >
              {getElementSymbol(element.type)}
            </div>
          ))}
        </div>
      )}

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