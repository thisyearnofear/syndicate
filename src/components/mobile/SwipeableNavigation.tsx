// Enhanced Mobile Navigation with Gesture Support
// Consolidates mobile navigation logic and adds swipe gestures
// Follows Core Principles: ENHANCEMENT FIRST, MODULAR, PERFORMANT

"use client";

import React, { useRef, useCallback } from 'react';
import { useGestures, mobileGestureService, MobileGestureService } from '@/services/mobileGestureService';

interface SwipeableNavigationProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  className?: string;
  disabled?: boolean;
}

export default function SwipeableNavigation({
  children,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  className = '',
  disabled = false
}: SwipeableNavigationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSwipe = useCallback((event: any) => {
    if (disabled) return;

    // Add haptic feedback
    MobileGestureService.triggerHapticFeedback('light');

    switch (event.direction) {
      case 'left':
        onSwipeLeft?.();
        break;
      case 'right':
        onSwipeRight?.();
        break;
      case 'up':
        onSwipeUp?.();
        break;
      case 'down':
        onSwipeDown?.();
        break;
    }
  }, [disabled, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  const handleTap = useCallback((event: any) => {
    if (disabled) return;

    if (event.isDoubleTap) {
      // Double tap to toggle menu or perform quick action
      MobileGestureService.triggerHapticFeedback('medium');
    }
  }, [disabled]);

  // Register gesture handlers
  useGestures(containerRef, {
    onSwipe: handleSwipe,
    onTap: handleTap
  });

  return (
    <div 
      ref={containerRef}
      className={`swipeable-navigation ${className}`}
      style={{
        touchAction: disabled ? 'auto' : 'pan-y', // Allow vertical scrolling but capture horizontal swipes
        userSelect: 'none', // Prevent text selection during gestures
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none'
      }}
    >
      {children}
    </div>
  );
}

// Hook for tab navigation with swipe gestures
export function useSwipeableTabNavigation<T extends string>(
  tabs: readonly T[],
  activeTab: T,
  onTabChange: (tab: T) => void
) {
  const currentIndex = tabs.indexOf(activeTab);

  const swipeToNextTab = useCallback(() => {
    const nextIndex = (currentIndex + 1) % tabs.length;
    onTabChange(tabs[nextIndex]);
  }, [currentIndex, tabs, onTabChange]);

  const swipeToPrevTab = useCallback(() => {
    const prevIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
    onTabChange(tabs[prevIndex]);
  }, [currentIndex, tabs, onTabChange]);

  return {
    swipeToNextTab,
    swipeToPrevTab,
    currentIndex,
    totalTabs: tabs.length
  };
}