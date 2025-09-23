/**
 * ENHANCED LOADING SPINNER
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced existing loader with better UX
 * - MODULAR: Composable with different sizes and styles
 * - PERFORMANT: CSS-only animations
 * - CLEAN: Clear prop interface
 */

import React from 'react';
import { design } from '@/config';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'white';
  className?: string;
  label?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

const colorClasses = {
  primary: 'border-blue-500',
  secondary: 'border-green-500',
  white: 'border-white',
};

/**
 * PERFORMANT: CSS-only loading spinner with accessibility
 */
export function LoadingSpinner({ 
  size = 'md', 
  color = 'primary', 
  className = '',
  label = 'Loading...'
}: LoadingSpinnerProps) {
  return (
    <div 
      className={`inline-flex items-center justify-center ${className}`}
      role="status"
      aria-label={label}
    >
      <div
        className={`
          ${sizeClasses[size]}
          ${colorClasses[color]}
          border-2 border-t-transparent rounded-full animate-spin
        `}
        style={{
          animationDuration: `${design.animation.duration * 3}s`,
        }}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * MODULAR: Full-screen loading overlay
 */
export function LoadingOverlay({ 
  isVisible, 
  message = 'Loading...' 
}: { 
  isVisible: boolean; 
  message?: string; 
}) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-700 text-center">
        <LoadingSpinner size="lg" color="primary" className="mb-4" />
        <p className="text-white font-medium">{message}</p>
      </div>
    </div>
  );
}