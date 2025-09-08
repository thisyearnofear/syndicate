// Mobile Gesture Service
// Consolidates touch and gesture handling across mobile components
// Follows Core Principles: DRY, CLEAN, MODULAR, PERFORMANT

export interface GestureConfig {
  swipeThreshold: number;
  tapThreshold: number;
  longPressThreshold: number;
  velocityThreshold: number;
}

export interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
}

export interface SwipeEvent {
  direction: 'left' | 'right' | 'up' | 'down';
  distance: number;
  velocity: number;
  startPoint: TouchPoint;
  endPoint: TouchPoint;
}

export interface TapEvent {
  point: TouchPoint;
  isDoubleTap: boolean;
}

export interface LongPressEvent {
  point: TouchPoint;
  duration: number;
}

export type GestureHandler = {
  onSwipe?: (event: SwipeEvent) => void;
  onTap?: (event: TapEvent) => void;
  onLongPress?: (event: LongPressEvent) => void;
  onPinch?: (scale: number) => void;
};

class MobileGestureService {
  private static instance: MobileGestureService;
  private config: GestureConfig = {
    swipeThreshold: 50,
    tapThreshold: 10,
    longPressThreshold: 500,
    velocityThreshold: 0.3
  };

  private activeGestures = new Map<string, {
    element: HTMLElement;
    handlers: GestureHandler;
    touchStart: TouchPoint | null;
    longPressTimer: NodeJS.Timeout | null;
    lastTap: TouchPoint | null;
  }>();

  static getInstance(): MobileGestureService {
    if (!MobileGestureService.instance) {
      MobileGestureService.instance = new MobileGestureService();
    }
    return MobileGestureService.instance;
  }

  // Register gesture handlers for an element
  registerGestures(
    elementId: string, 
    element: HTMLElement, 
    handlers: GestureHandler
  ): () => void {
    // Remove existing handlers if any
    this.unregisterGestures(elementId);

    const gestureState = {
      element,
      handlers,
      touchStart: null,
      longPressTimer: null,
      lastTap: null
    };

    this.activeGestures.set(elementId, gestureState);

    // Add event listeners
    const touchStartHandler = this.handleTouchStart.bind(this, elementId);
    const touchMoveHandler = this.handleTouchMove.bind(this, elementId);
    const touchEndHandler = this.handleTouchEnd.bind(this, elementId);

    element.addEventListener('touchstart', touchStartHandler, { passive: false });
    element.addEventListener('touchmove', touchMoveHandler, { passive: false });
    element.addEventListener('touchend', touchEndHandler, { passive: false });

    // Return cleanup function
    return () => {
      element.removeEventListener('touchstart', touchStartHandler);
      element.removeEventListener('touchmove', touchMoveHandler);
      element.removeEventListener('touchend', touchEndHandler);
      this.unregisterGestures(elementId);
    };
  }

  // Unregister gesture handlers
  unregisterGestures(elementId: string): void {
    const gestureState = this.activeGestures.get(elementId);
    if (gestureState?.longPressTimer) {
      clearTimeout(gestureState.longPressTimer);
    }
    this.activeGestures.delete(elementId);
  }

  // Update gesture configuration with device-specific optimizations
  updateConfig(newConfig: Partial<GestureConfig>): void {
    // Apply device-specific optimizations
    const optimalConfig = typeof window !== 'undefined' ? GestureUtils.getOptimalThresholds() : {};
    this.config = { ...this.config, ...optimalConfig, ...newConfig };
  }

  // Get current configuration
  getConfig(): GestureConfig {
    return { ...this.config };
  }

  // Reset configuration to defaults
  resetConfig(): void {
    this.config = {
      swipeThreshold: 50,
      tapThreshold: 10,
      longPressThreshold: 500,
      velocityThreshold: 0.3
    };
    
    // Apply device-specific optimizations
    const optimalConfig = typeof window !== 'undefined' ? GestureUtils.getOptimalThresholds() : {};
    this.config = { ...this.config, ...optimalConfig };
  }

  private handleTouchStart(elementId: string, event: TouchEvent): void {
    const gestureState = this.activeGestures.get(elementId);
    if (!gestureState) return;

    const touch = event.touches[0];
    const touchPoint: TouchPoint = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    };

    gestureState.touchStart = touchPoint;

    // Start long press timer
    if (gestureState.handlers.onLongPress) {
      gestureState.longPressTimer = setTimeout(() => {
        if (gestureState.touchStart) {
          gestureState.handlers.onLongPress?.({
            point: touchPoint,
            duration: Date.now() - touchPoint.timestamp
          });
        }
      }, this.config.longPressThreshold);
    }

    // Prevent default to avoid scrolling during gestures
    if (gestureState.handlers.onSwipe) {
      event.preventDefault();
    }
  }

  private handleTouchMove(elementId: string, event: TouchEvent): void {
    const gestureState = this.activeGestures.get(elementId);
    if (!gestureState?.touchStart) return;

    const touch = event.touches[0];
    const currentPoint: TouchPoint = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    };

    const deltaX = Math.abs(currentPoint.x - gestureState.touchStart.x);
    const deltaY = Math.abs(currentPoint.y - gestureState.touchStart.y);

    // Cancel long press if moved too much
    if ((deltaX > this.config.tapThreshold || deltaY > this.config.tapThreshold) && 
        gestureState.longPressTimer) {
      clearTimeout(gestureState.longPressTimer);
      gestureState.longPressTimer = null;
    }

    // Prevent scrolling during swipe gestures
    if (gestureState.handlers.onSwipe && 
        (deltaX > this.config.tapThreshold || deltaY > this.config.tapThreshold)) {
      event.preventDefault();
    }
  }

  private handleTouchEnd(elementId: string, event: TouchEvent): void {
    const gestureState = this.activeGestures.get(elementId);
    if (!gestureState?.touchStart) return;

    const touch = event.changedTouches[0];
    const endPoint: TouchPoint = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    };

    // Clear long press timer
    if (gestureState.longPressTimer) {
      clearTimeout(gestureState.longPressTimer);
      gestureState.longPressTimer = null;
    }

    const deltaX = endPoint.x - gestureState.touchStart.x;
    const deltaY = endPoint.y - gestureState.touchStart.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const duration = endPoint.timestamp - gestureState.touchStart.timestamp;
    const velocity = distance / duration;

    // Determine gesture type
    if (distance < this.config.tapThreshold) {
      // Tap gesture
      this.handleTap(gestureState, endPoint);
    } else if (distance > this.config.swipeThreshold && velocity > this.config.velocityThreshold) {
      // Swipe gesture
      this.handleSwipe(gestureState, gestureState.touchStart, endPoint, deltaX, deltaY, distance, velocity);
    }

    gestureState.touchStart = null;
  }

  private handleTap(gestureState: any, point: TouchPoint): void {
    if (!gestureState.handlers.onTap) return;

    const now = Date.now();
    const isDoubleTap = gestureState.lastTap && 
                      (now - gestureState.lastTap.timestamp) < 300 &&
                      Math.abs(point.x - gestureState.lastTap.x) < this.config.tapThreshold &&
                      Math.abs(point.y - gestureState.lastTap.y) < this.config.tapThreshold;

    gestureState.handlers.onTap({
      point,
      isDoubleTap: !!isDoubleTap
    });

    gestureState.lastTap = isDoubleTap ? null : point;
  }

  private handleSwipe(
    gestureState: any, 
    startPoint: TouchPoint, 
    endPoint: TouchPoint, 
    deltaX: number, 
    deltaY: number, 
    distance: number, 
    velocity: number
  ): void {
    if (!gestureState.handlers.onSwipe) return;

    // Determine swipe direction
    let direction: 'left' | 'right' | 'up' | 'down';
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      direction = deltaX > 0 ? 'right' : 'left';
    } else {
      direction = deltaY > 0 ? 'down' : 'up';
    }

    gestureState.handlers.onSwipe({
      direction,
      distance,
      velocity,
      startPoint,
      endPoint
    });
  }

  // Utility method to check if device supports touch
  static isTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  // Utility method to get optimal touch target size
  static getOptimalTouchTargetSize(): number {
    // 44px is Apple's recommended minimum touch target size
    // 48dp is Google's recommendation (roughly 48px at 1x density)
    return Math.max(44, window.devicePixelRatio * 44);
  }

  // Enhanced haptic feedback with fallbacks
  static triggerHapticFeedback(type: 'light' | 'medium' | 'heavy' = 'light'): void {
    if (!GestureUtils.supportsHaptics()) return;

    const patterns = {
      light: [10],
      medium: [20, 10, 20],
      heavy: [30, 20, 30]
    };

    try {
      navigator.vibrate(patterns[type]);
    } catch (error) {
      // Silently fail if vibration is not supported or blocked
      console.debug('Haptic feedback not available:', error);
    }
  }

  // Enhanced haptic patterns for specific actions
  static triggerActionFeedback(action: 'success' | 'error' | 'warning' | 'navigation'): void {
    if (!GestureUtils.supportsHaptics()) return;

    const actionPatterns = {
      success: [50, 50, 100],
      error: [100, 50, 100, 50, 100],
      warning: [30, 30, 30],
      navigation: [15]
    };

    try {
      navigator.vibrate(actionPatterns[action]);
    } catch (error) {
      console.debug('Action haptic feedback not available:', error);
    }
  }
}

export const mobileGestureService = MobileGestureService.getInstance();

// Export the class for static method access
export { MobileGestureService };

// React hook for easy gesture integration
import React from 'react';

export function useGestures(
  elementRef: React.RefObject<HTMLElement | null>,
  handlers: GestureHandler,
  elementId?: string
) {
  React.useEffect(() => {
    const element = elementRef.current;
    if (!element || !MobileGestureService.isTouchDevice()) return;

    const id = elementId || `gesture-${Math.random().toString(36).substr(2, 9)}`;
    const cleanup = mobileGestureService.registerGestures(id, element, handlers);

    return cleanup;
  }, [elementRef, handlers, elementId]);
}

// Enhanced gesture utilities
export const GestureUtils = {
  // Check if device supports haptic feedback
  supportsHaptics(): boolean {
    return 'vibrate' in navigator;
  },

  // Get optimal gesture thresholds based on device
  getOptimalThresholds(): Partial<GestureConfig> {
    if (typeof window === 'undefined') return {}; // SSR safety
    
    const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
    const isMobile = window.innerWidth < 768;
    
    if (isTablet) {
      return {
        swipeThreshold: 60, // Larger threshold for tablets
        tapThreshold: 12,
        velocityThreshold: 0.25
      };
    } else if (isMobile) {
      return {
        swipeThreshold: 40, // Smaller threshold for phones
        tapThreshold: 8,
        velocityThreshold: 0.35
      };
    }
    
    return {}; // Use defaults for desktop
  },

  // Debounce gesture events to prevent rapid firing
  debounce<T extends (...args: any[]) => void>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },

  // Calculate gesture velocity
  calculateVelocity(startPoint: TouchPoint, endPoint: TouchPoint): number {
    const distance = Math.sqrt(
      Math.pow(endPoint.x - startPoint.x, 2) + 
      Math.pow(endPoint.y - startPoint.y, 2)
    );
    const duration = endPoint.timestamp - startPoint.timestamp;
    return duration > 0 ? distance / duration : 0;
  },

  // Get gesture direction with angle
  getGestureDirection(startPoint: TouchPoint, endPoint: TouchPoint): {
    direction: 'left' | 'right' | 'up' | 'down';
    angle: number;
  } {
    const deltaX = endPoint.x - startPoint.x;
    const deltaY = endPoint.y - startPoint.y;
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
    
    let direction: 'left' | 'right' | 'up' | 'down';
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      direction = deltaX > 0 ? 'right' : 'left';
    } else {
      direction = deltaY > 0 ? 'down' : 'up';
    }
    
    return { direction, angle };
  }
};

export default MobileGestureService;