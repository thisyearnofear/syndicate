/**
 * COMPACT LAYOUT SYSTEM
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced layout with compact, centered design
 * - MODULAR: Composable layout components
 * - PERFORMANT: Optimized for mobile and desktop
 * - CLEAN: Clear layout hierarchy
 */

import React from 'react';

interface CompactContainerProps {
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  center?: boolean;
  className?: string;
}

const maxWidthStyles = {
  sm: 'max-w-sm',      // 384px
  md: 'max-w-md',      // 448px
  lg: 'max-w-2xl',     // 672px
  xl: 'max-w-4xl',     // 896px
  '2xl': 'max-w-6xl',  // 1152px
  full: 'max-w-full',
};

const paddingStyles = {
  none: '',
  sm: 'px-4 py-2',
  md: 'px-6 py-4',
  lg: 'px-8 py-6',
};

export function CompactContainer({
  children,
  maxWidth = 'xl',
  padding = 'md',
  center = true,
  className = '',
}: CompactContainerProps) {
  const classes = [
    maxWidthStyles[maxWidth],
    paddingStyles[padding],
    center && 'mx-auto',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {children}
    </div>
  );
}

/**
 * MODULAR: Compact grid system with intelligent spacing
 */
interface CompactGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: 'xs' | 'sm' | 'md' | 'lg';
  responsive?: boolean;
  className?: string;
}

const columnStyles = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
};

const gapStyles = {
  xs: 'gap-2',
  sm: 'gap-4',
  md: 'gap-6',
  lg: 'gap-8',
};

export function CompactGrid({
  children,
  columns = 2,
  gap = 'md',
  responsive = true,
  className = '',
}: CompactGridProps) {
  const classes = [
    'grid',
    responsive ? columnStyles[columns] : `grid-cols-${columns}`,
    gapStyles[gap],
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {children}
    </div>
  );
}

/**
 * MODULAR: Compact stack layout with intelligent spacing
 */
interface CompactStackProps {
  children: React.ReactNode;
  spacing?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  align?: 'start' | 'center' | 'end' | 'stretch';
  className?: string;
}

const spacingStyles = {
  xs: 'space-y-1',
  sm: 'space-y-2',
  md: 'space-y-4',
  lg: 'space-y-6',
  xl: 'space-y-8',
};

const alignStyles = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

export function CompactStack({
  children,
  spacing = 'md',
  align = 'stretch',
  className = '',
}: CompactStackProps) {
  const classes = [
    'flex flex-col',
    spacingStyles[spacing],
    alignStyles[align],
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {children}
    </div>
  );
}

/**
 * MODULAR: Compact hero section with centered content
 */
interface CompactHeroProps {
  children: React.ReactNode;
  background?: 'gradient' | 'solid' | 'transparent';
  height?: 'auto' | 'screen' | 'half';
  className?: string;
}

const backgroundStyles = {
  gradient: 'bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900',
  solid: 'bg-gray-900',
  transparent: 'bg-transparent',
};

const heightStyles = {
  auto: 'min-h-fit',
  screen: 'min-h-screen',
  half: 'min-h-[50vh]',
};

export function CompactHero({
  children,
  background = 'gradient',
  height = 'auto',
  className = '',
}: CompactHeroProps) {
  const classes = [
    'flex items-center justify-center',
    backgroundStyles[background],
    heightStyles[height],
    'relative overflow-hidden',
    className,
  ].filter(Boolean).join(' ');

  return (
    <section className={classes}>
      <div className="relative z-10 text-center">
        {children}
      </div>
      
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-green-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }} />
      </div>
    </section>
  );
}

/**
 * MODULAR: Compact card with premium styling
 */
interface CompactCardProps {
  children: React.ReactNode;
  variant?: 'default' | 'premium' | 'glass' | 'solid';
  padding?: 'sm' | 'md' | 'lg';
  hover?: boolean;
  className?: string;
}

const cardVariantStyles = {
  default: 'bg-gray-900/50 border border-gray-700/50 backdrop-blur-sm',
  premium: 'bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/30 backdrop-blur-md',
  glass: 'bg-white/5 border border-white/10 backdrop-blur-md',
  solid: 'bg-gray-800 border border-gray-700',
};

const cardPaddingStyles = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function CompactCard({
  children,
  variant = 'default',
  padding = 'md',
  hover = true,
  className = '',
}: CompactCardProps) {
  const classes = [
    'rounded-xl',
    cardVariantStyles[variant],
    cardPaddingStyles[padding],
    hover && 'transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-current/10',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {children}
    </div>
  );
}

/**
 * MODULAR: Compact section with consistent spacing
 */
interface CompactSectionProps {
  children: React.ReactNode;
  spacing?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sectionSpacingStyles = {
  sm: 'py-8',
  md: 'py-12',
  lg: 'py-16',
  xl: 'py-20',
};

export function CompactSection({
  children,
  spacing = 'md',
  className = '',
}: CompactSectionProps) {
  const classes = [
    sectionSpacingStyles[spacing],
    className,
  ].filter(Boolean).join(' ');

  return (
    <section className={classes}>
      {children}
    </section>
  );
}

/**
 * MODULAR: Compact flex layout with intelligent wrapping
 */
interface CompactFlexProps {
  children: React.ReactNode;
  direction?: 'row' | 'col';
  wrap?: boolean;
  gap?: 'xs' | 'sm' | 'md' | 'lg';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  className?: string;
}

const flexGapStyles = {
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
};

const flexAlignStyles = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

const flexJustifyStyles = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
};

export function CompactFlex({
  children,
  direction = 'row',
  wrap = false,
  gap = 'md',
  align = 'center',
  justify = 'start',
  className = '',
}: CompactFlexProps) {
  const classes = [
    'flex',
    direction === 'row' ? 'flex-row' : 'flex-col',
    wrap && 'flex-wrap',
    flexGapStyles[gap],
    flexAlignStyles[align],
    flexJustifyStyles[justify],
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {children}
    </div>
  );
}