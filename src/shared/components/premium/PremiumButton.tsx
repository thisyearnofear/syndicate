/**
 * PREMIUM BUTTON COMPONENT
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced button with premium styling
 * - MODULAR: Composable button variants
 * - PERFORMANT: CSS-only animations
 * - CLEAN: Clear prop interface
 */

import React, { forwardRef } from 'react';
import { premiumDesign } from '@/config/design';

interface PremiumButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'premium' | 'jackpot' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  glow?: boolean;
  pulse?: boolean;
}

const variantStyles = {
  primary: `
    bg-gradient-to-r from-blue-600 to-purple-600 
    hover:from-blue-700 hover:to-purple-700
    text-white shadow-lg hover:shadow-xl
    border border-blue-500/20
  `,
  secondary: `
    bg-gradient-to-r from-emerald-500 to-teal-600
    hover:from-emerald-600 hover:to-teal-700
    text-white shadow-lg hover:shadow-xl
    border border-emerald-400/20
  `,
  premium: `
    bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600
    hover:from-purple-700 hover:via-pink-700 hover:to-blue-700
    text-white shadow-2xl hover:shadow-purple-500/25
    border border-purple-400/30
  `,
  jackpot: `
    bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500
    hover:from-yellow-500 hover:via-orange-600 hover:to-red-600
    text-white shadow-2xl hover:shadow-yellow-500/30
    border border-yellow-400/30
  `,
  ghost: `
    bg-white/5 hover:bg-white/10
    text-white border border-white/20 hover:border-white/30
    backdrop-blur-sm
  `,
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
  xl: 'px-8 py-4 text-xl',
};

const glowStyles = {
  primary: 'hover:shadow-blue-500/50',
  secondary: 'hover:shadow-emerald-500/50',
  premium: 'hover:shadow-purple-500/50',
  jackpot: 'hover:shadow-yellow-500/50',
  ghost: 'hover:shadow-white/20',
};

export const PremiumButton = forwardRef<HTMLButtonElement, PremiumButtonProps>(
  ({ 
    variant = 'primary',
    size = 'md',
    isLoading = false,
    leftIcon,
    rightIcon,
    glow = false,
    pulse = false,
    children,
    className = '',
    disabled,
    ...props
  }, ref) => {
    const baseClasses = `
      relative inline-flex items-center justify-center
      font-semibold rounded-xl
      transition-all duration-300 ease-out
      transform hover:scale-105 active:scale-95
      focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
      disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
      overflow-hidden
    `;

    const classes = [
      baseClasses,
      variantStyles[variant],
      sizeStyles[size],
      glow && glowStyles[variant],
      pulse && 'animate-pulse',
      className,
    ].filter(Boolean).join(' ');

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || isLoading}
        {...props}
      >
        {/* Shimmer effect */}
        <div className="absolute inset-0 -top-px overflow-hidden rounded-xl">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 -translate-x-full group-hover:animate-shimmer" />
        </div>

        {/* Content */}
        <div className="relative flex items-center gap-2">
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : leftIcon ? (
            <span className="flex-shrink-0">{leftIcon}</span>
          ) : null}
          
          <span className="flex-1">{children}</span>
          
          {rightIcon && !isLoading && (
            <span className="flex-shrink-0">{rightIcon}</span>
          )}
        </div>

        {/* Ripple effect container */}
        <div className="absolute inset-0 overflow-hidden rounded-xl">
          <div className="ripple-container" />
        </div>

        <style jsx>{`
          @keyframes shimmer {
            100% {
              transform: translateX(100%) skewX(-12deg);
            }
          }
          
          .group:hover .animate-shimmer {
            animation: shimmer 1.5s ease-out;
          }
        `}</style>
      </button>
    );
  }
);

PremiumButton.displayName = 'PremiumButton';

/**
 * MODULAR: Specialized button variants
 */
export const JackpotButton = (props: Omit<PremiumButtonProps, 'variant'>) => (
  <PremiumButton variant="jackpot" glow pulse {...props} />
);

export const PremiumActionButton = (props: Omit<PremiumButtonProps, 'variant'>) => (
  <PremiumButton variant="premium" glow {...props} />
);

export const GhostButton = (props: Omit<PremiumButtonProps, 'variant'>) => (
  <PremiumButton variant="ghost" {...props} />
);