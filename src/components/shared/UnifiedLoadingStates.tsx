/**
 * UNIFIED LOADING STATES
 * AGGRESSIVE CONSOLIDATION: Single source of truth for all loading states
 * DRY: Eliminates duplicate loading patterns across the app
 * MODULAR: Configurable loading states for different contexts
 */

import React from 'react';
import UnifiedLoader from './UnifiedLoader';

export interface LoadingStateProps {
  type?: 'inline' | 'card' | 'page' | 'modal' | 'button';
  message?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

/**
 * PERFORMANT: Unified loading state component
 */
export function UnifiedLoadingState({
  type = 'inline',
  message = 'Loading...',
  size = 'md',
  className = ''
}: LoadingStateProps) {
  const baseClasses = {
    inline: 'flex items-center justify-center p-4',
    card: 'bg-gray-900/50 rounded-2xl p-6 border border-gray-700/50 backdrop-blur-md',
    page: 'min-h-screen flex items-center justify-center',
    modal: 'flex items-center justify-center p-12',
    button: 'flex items-center justify-center gap-2'
  };

  const loaderProps = {
    size: size === 'sm' ? 'sm' as const :
          size === 'lg' ? 'lg' as const :
          size === 'xl' ? 'xl' as const : 'md' as const,
    text: message,
    className: type === 'button' ? 'text-white' : undefined
  };

  return (
    <div className={`${baseClasses[type]} ${className}`}>
      <UnifiedLoader {...loaderProps} />
    </div>
  );
}

/**
 * CLEAN: Specialized loading states for common use cases
 */

// Loading state for wallet connections
export function WalletLoadingState({ message = 'Connecting wallet...' }: { message?: string }) {
  return (
    <UnifiedLoadingState
      type="card"
      message={message}
      size="md"
      className="max-w-md mx-auto"
    />
  );
}

// Loading state for cross-chain operations
export function CrossChainLoadingState({ message = 'Processing cross-chain transaction...' }: { message?: string }) {
  return (
    <UnifiedLoadingState
      type="modal"
      message={message}
      size="lg"
    />
  );
}

// Loading state for data fetching
export function DataLoadingState({ message = 'Loading data...' }: { message?: string }) {
  return (
    <UnifiedLoadingState
      type="inline"
      message={message}
      size="sm"
    />
  );
}

// Loading state for page transitions
export function PageLoadingState({ message = 'Loading page...' }: { message?: string }) {
  return (
    <UnifiedLoadingState
      type="page"
      message={message}
      size="xl"
    />
  );
}

// Loading state for buttons
export function ButtonLoadingState({ message = 'Processing...' }: { message?: string }) {
  return (
    <UnifiedLoadingState
      type="button"
      message={message}
      size="sm"
    />
  );
}

/**
 * MODULAR: Loading state with custom content
 */
export function CustomLoadingState({
  children,
  className = ''
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-center p-8 ${className}`}>
      {children}
    </div>
  );
}