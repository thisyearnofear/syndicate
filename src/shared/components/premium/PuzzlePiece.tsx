/**
 * PUZZLE PIECE LAYOUT COMPONENTS
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced layout with interlocking design
 * - MODULAR: Composable puzzle piece components
 * - PERFORMANT: CSS-only animations and effects
 * - CLEAN: Clear component interfaces
 */

import React from 'react';
import { premiumDesign } from '@/config/design';

interface PuzzlePieceProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'accent' | 'neutral';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'rounded' | 'organic' | 'angular' | 'blob';
  glow?: boolean;
  floating?: boolean;
  className?: string;
}

const variantStyles = {
  primary: `
    bg-gradient-to-br from-blue-500/20 to-purple-600/20
    border border-blue-400/30 backdrop-blur-md
    hover:from-blue-500/30 hover:to-purple-600/30
  `,
  secondary: `
    bg-gradient-to-br from-emerald-500/20 to-teal-600/20
    border border-emerald-400/30 backdrop-blur-md
    hover:from-emerald-500/30 hover:to-teal-600/30
  `,
  accent: `
    bg-gradient-to-br from-pink-500/20 to-rose-600/20
    border border-pink-400/30 backdrop-blur-md
    hover:from-pink-500/30 hover:to-rose-600/30
  `,
  neutral: `
    bg-white/5 border border-white/10 backdrop-blur-md
    hover:bg-white/10 hover:border-white/20
  `,
};

const sizeStyles = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
  xl: 'p-10',
};

const shapeStyles = {
  rounded: 'rounded-2xl',
  organic: 'rounded-[2rem_1rem_2rem_1rem]',
  angular: 'rounded-tl-3xl rounded-br-3xl rounded-tr-lg rounded-bl-lg',
  blob: 'rounded-[3rem_2rem_3rem_1rem]',
};

export function PuzzlePiece({
  children,
  variant = 'neutral',
  size = 'md',
  shape = 'rounded',
  glow = false,
  floating = false,
  className = '',
}: PuzzlePieceProps) {
  const baseClasses = `
    relative transition-all duration-500 ease-out
    transform hover:scale-105 hover:-translate-y-1
    group cursor-pointer
  `;

  const classes = [
    baseClasses,
    variantStyles[variant],
    sizeStyles[size],
    shapeStyles[shape],
    floating && 'animate-float',
    glow && 'hover:shadow-2xl hover:shadow-current/20',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {/* Glow effect */}
      {glow && (
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-inherit blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
      )}
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>

      {/* Floating animation */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-10px) rotate(1deg); }
          66% { transform: translateY(-5px) rotate(-1deg); }
        }
        
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

/**
 * MODULAR: Interlocking puzzle grid layout
 */
interface PuzzleGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
  staggered?: boolean;
  className?: string;
}

const gridStyles = {
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
};

const gapStyles = {
  sm: 'gap-4',
  md: 'gap-6',
  lg: 'gap-8',
};

export function PuzzleGrid({
  children,
  columns = 3,
  gap = 'md',
  staggered = false,
  className = '',
}: PuzzleGridProps) {
  const classes = [
    'grid',
    gridStyles[columns],
    gapStyles[gap],
    staggered && 'staggered-grid',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {React.Children.map(children, (child, index) => (
        <div 
          className={staggered ? `stagger-${index % 3}` : ''}
          style={staggered ? { animationDelay: `${index * 100}ms` } : {}}
        >
          {child}
        </div>
      ))}

      <style>{`
        .staggered-grid .stagger-0 { transform: translateY(0); }
        .staggered-grid .stagger-1 { transform: translateY(1rem); }
        .staggered-grid .stagger-2 { transform: translateY(0.5rem); }
        
        @media (min-width: 768px) {
          .staggered-grid .stagger-0 { transform: translateY(0); }
          .staggered-grid .stagger-1 { transform: translateY(2rem); }
          .staggered-grid .stagger-2 { transform: translateY(1rem); }
        }
      `}</style>
    </div>
  );
}

/**
 * MODULAR: Overlapping puzzle pieces container
 */
interface OverlappingPiecesProps {
  children: React.ReactNode;
  overlap?: 'sm' | 'md' | 'lg';
  direction?: 'horizontal' | 'vertical';
  className?: string;
}

const overlapStyles = {
  sm: '-space-x-4',
  md: '-space-x-8',
  lg: '-space-x-12',
};

const overlapVerticalStyles = {
  sm: '-space-y-4',
  md: '-space-y-8',
  lg: '-space-y-12',
};

export function OverlappingPieces({
  children,
  overlap = 'md',
  direction = 'horizontal',
  className = '',
}: OverlappingPiecesProps) {
  const classes = [
    'flex',
    direction === 'horizontal' ? 'flex-row' : 'flex-col',
    direction === 'horizontal' ? overlapStyles[overlap] : overlapVerticalStyles[overlap],
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {React.Children.map(children, (child, index) => (
        <div 
          className="relative hover:z-10 transition-all duration-300"
          style={{ zIndex: React.Children.count(children) - index }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

/**
 * MODULAR: Magnetic puzzle pieces that attract on hover
 */
export function MagneticPiece({
  children,
  magnetStrength = 10,
  ...props
}: PuzzlePieceProps & { magnetStrength?: number }) {
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = (e.clientX - centerX) / rect.width;
    const deltaY = (e.clientY - centerY) / rect.height;
    
    e.currentTarget.style.transform = `
      translate(${deltaX * magnetStrength}px, ${deltaY * magnetStrength}px)
      scale(1.05)
    `;
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = 'translate(0, 0) scale(1)';
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="transition-transform duration-300 ease-out"
    >
      <PuzzlePiece {...props}>
        {children}
      </PuzzlePiece>
    </div>
  );
}
