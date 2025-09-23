/**
 * PREMIUM TYPOGRAPHY COMPONENTS
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced typography with premium styling
 * - MODULAR: Composable text components
 * - CLEAN: Consistent typography system
 * - PERFORMANT: Optimized font loading and rendering
 */

import React from 'react';
import { premiumDesign } from '@/config/design';

interface TypographyProps {
  children: React.ReactNode;
  className?: string;
  gradient?: boolean;
  glow?: boolean;
  animate?: boolean;
}

// =============================================================================
// DISPLAY TYPOGRAPHY
// =============================================================================

export function DisplayText({ 
  children, 
  className = '', 
  gradient = false, 
  glow = false,
  animate = false 
}: TypographyProps) {
  const baseClasses = `
    font-black text-4xl md:text-6xl lg:text-7xl
    leading-tight tracking-tight
  `;

  const gradientClasses = gradient 
    ? 'bg-gradient-to-r from-purple-400 via-blue-500 to-green-400 bg-clip-text text-transparent'
    : 'text-white';

  const glowClasses = glow 
    ? 'drop-shadow-[0_0_30px_rgba(59,130,246,0.5)]'
    : '';

  const animateClasses = animate 
    ? 'animate-pulse'
    : '';

  const classes = [baseClasses, gradientClasses, glowClasses, animateClasses, className]
    .filter(Boolean).join(' ');

  return (
    <h1 className={classes}>
      {children}
    </h1>
  );
}

export function HeadlineText({ 
  children, 
  className = '', 
  gradient = false,
  glow = false 
}: TypographyProps) {
  const baseClasses = `
    font-bold text-2xl md:text-4xl lg:text-5xl
    leading-tight tracking-tight
  `;

  const gradientClasses = gradient 
    ? 'bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent'
    : 'text-white';

  const glowClasses = glow 
    ? 'drop-shadow-[0_0_20px_rgba(59,130,246,0.4)]'
    : '';

  const classes = [baseClasses, gradientClasses, glowClasses, className]
    .filter(Boolean).join(' ');

  return (
    <h2 className={classes}>
      {children}
    </h2>
  );
}

// =============================================================================
// BODY TYPOGRAPHY
// =============================================================================

export function BodyText({ 
  children, 
  className = '',
  size = 'base',
  weight = 'normal',
  color = 'gray-300'
}: TypographyProps & {
  size?: 'sm' | 'base' | 'lg' | 'xl';
  weight?: 'light' | 'normal' | 'medium' | 'semibold' | 'bold';
  color?: string;
}) {
  const sizeClasses = {
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  };

  const weightClasses = {
    light: 'font-light',
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
  };

  const classes = [
    sizeClasses[size],
    weightClasses[weight],
    `text-${color}`,
    'leading-relaxed',
    className,
  ].filter(Boolean).join(' ');

  return (
    <p className={classes}>
      {children}
    </p>
  );
}

// =============================================================================
// SPECIAL EFFECTS TYPOGRAPHY
// =============================================================================

export function GlowText({ 
  children, 
  className = '',
  color = 'blue' 
}: TypographyProps & { color?: 'blue' | 'purple' | 'green' | 'yellow' | 'pink' }) {
  const glowColors = {
    blue: 'text-blue-400 drop-shadow-[0_0_20px_rgba(59,130,246,0.6)]',
    purple: 'text-purple-400 drop-shadow-[0_0_20px_rgba(147,51,234,0.6)]',
    green: 'text-green-400 drop-shadow-[0_0_20px_rgba(34,197,94,0.6)]',
    yellow: 'text-yellow-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.6)]',
    pink: 'text-pink-400 drop-shadow-[0_0_20px_rgba(236,72,153,0.6)]',
  };

  const classes = [
    'font-semibold',
    glowColors[color],
    'animate-pulse',
    className,
  ].filter(Boolean).join(' ');

  return (
    <span className={classes}>
      {children}
    </span>
  );
}

export function TypewriterText({ 
  text, 
  speed = 100,
  className = '' 
}: { 
  text: string; 
  speed?: number; 
  className?: string; 
}) {
  const [displayText, setDisplayText] = React.useState('');
  const [currentIndex, setCurrentIndex] = React.useState(0);

  React.useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, speed);

      return () => clearTimeout(timeout);
    }
  }, [currentIndex, text, speed]);

  return (
    <span className={`font-mono ${className}`}>
      {displayText}
      <span className="animate-pulse">|</span>
    </span>
  );
}

export function CountUpText({ 
  value, 
  duration = 2000,
  prefix = '',
  suffix = '',
  className = '' 
}: { 
  value: number; 
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string; 
}) {
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      setCount(Math.floor(progress * value));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [value, duration]);

  return (
    <span className={`font-mono font-bold ${className}`}>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
}

// =============================================================================
// PREMIUM BADGE TYPOGRAPHY
// =============================================================================

export function PremiumBadge({ 
  children, 
  variant = 'primary',
  size = 'md',
  className = '' 
}: TypographyProps & {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
}) {
  const variantClasses = {
    primary: 'bg-gradient-to-r from-blue-500 to-purple-600 text-white',
    secondary: 'bg-gradient-to-r from-gray-600 to-gray-700 text-white',
    success: 'bg-gradient-to-r from-green-500 to-emerald-600 text-white',
    warning: 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white',
    error: 'bg-gradient-to-r from-red-500 to-pink-600 text-white',
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const classes = [
    'inline-flex items-center font-semibold rounded-full',
    'shadow-lg backdrop-blur-sm',
    'transform hover:scale-105 transition-transform duration-200',
    variantClasses[variant],
    sizeClasses[size],
    className,
  ].filter(Boolean).join(' ');

  return (
    <span className={classes}>
      {children}
    </span>
  );
}