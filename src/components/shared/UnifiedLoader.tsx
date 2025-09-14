/**
 * UNIFIED LOADER COMPONENT
 * AGGRESSIVE CONSOLIDATION: Single loading component for all use cases
 * DRY: Eliminates duplicate loading states across the app
 * MODULAR: Configurable for different contexts
 */

import React from 'react';

export interface LoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'spinner' | 'dots' | 'pulse' | 'skeleton';
  color?: 'primary' | 'secondary' | 'white' | 'gray';
  text?: string;
  className?: string;
  fullScreen?: boolean;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6', 
  lg: 'h-8 w-8',
  xl: 'h-12 w-12'
};

const colorClasses = {
  primary: 'border-blue-600',
  secondary: 'border-purple-600',
  white: 'border-white',
  gray: 'border-gray-400'
};

/**
 * PERFORMANT: Optimized spinner component
 */
function Spinner({ size = 'md', color = 'primary', className = '' }: LoaderProps) {
  return (
    <div 
      className={`animate-spin rounded-full border-2 border-t-transparent ${sizeClasses[size]} ${colorClasses[color]} ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

/**
 * CLEAN: Animated dots loader
 */
function Dots({ color = 'primary', className = '' }: LoaderProps) {
  const dotColor = color === 'white' ? 'bg-white' : 
                   color === 'gray' ? 'bg-gray-400' :
                   color === 'secondary' ? 'bg-purple-600' : 'bg-blue-600';
  
  return (
    <div className={`flex space-x-1 ${className}`}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`h-2 w-2 rounded-full ${dotColor} animate-pulse`}
          style={{
            animationDelay: `${i * 0.2}s`,
            animationDuration: '1s'
          }}
        />
      ))}
    </div>
  );
}

/**
 * MODULAR: Pulse loader for content placeholders
 */
function Pulse({ className = '' }: LoaderProps) {
  return (
    <div className={`animate-pulse bg-gray-300 rounded ${className}`} />
  );
}

/**
 * CLEAN: Skeleton loader for structured content
 */
function Skeleton({ className = '' }: LoaderProps) {
  return (
    <div className={`animate-pulse space-y-3 ${className}`}>
      <div className="h-4 bg-gray-300 rounded w-3/4"></div>
      <div className="h-4 bg-gray-300 rounded w-1/2"></div>
      <div className="h-4 bg-gray-300 rounded w-5/6"></div>
    </div>
  );
}

/**
 * ENHANCEMENT FIRST: Main unified loader component
 */
export default function UnifiedLoader({
  size = 'md',
  variant = 'spinner',
  color = 'primary',
  text,
  className = '',
  fullScreen = false
}: LoaderProps) {
  const LoaderComponent = {
    spinner: Spinner,
    dots: Dots,
    pulse: Pulse,
    skeleton: Skeleton
  }[variant];

  const content = (
    <div className={`flex flex-col items-center justify-center space-y-3 ${className}`}>
      <LoaderComponent size={size} color={color} variant={variant} />
      {text && (
        <p className={`text-sm ${color === 'white' ? 'text-white' : 'text-gray-600'}`}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 shadow-xl">
          {content}
        </div>
      </div>
    );
  }

  return content;
}

/**
 * MODULAR: Specialized loader components for common use cases
 */

// PERFORMANT: Component loader for lazy-loaded components
export function ComponentLoader() {
  return (
    <div className="flex items-center justify-center p-8">
      <UnifiedLoader size="lg" color="primary" text="Loading component..." />
    </div>
  );
}

// CLEAN: Provider loader for heavy providers
export function ProviderLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <UnifiedLoader size="xl" color="primary" text="Initializing..." />
    </div>
  );
}

// MODULAR: Modal loader for modal content
export function ModalLoader() {
  return (
    <div className="flex items-center justify-center p-12">
      <UnifiedLoader size="lg" variant="dots" color="secondary" />
    </div>
  );
}

// PERFORMANT: Inline loader for buttons and small spaces
export function InlineLoader({ size = 'sm', color = 'white' }: Pick<LoaderProps, 'size' | 'color'>) {
  return <UnifiedLoader size={size} color={color} />;
}

// CLEAN: Page loader for full page loading states
export function PageLoader({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <UnifiedLoader 
        size="xl" 
        color="primary" 
        text={text}
        className="text-center"
      />
    </div>
  );
}

/**
 * ORGANIZED: Export all loader variants
 */
export {
  Spinner,
  Dots,
  Pulse,
  Skeleton
};