"use client";

/**
 * ENHANCEMENT FIRST: Optimized Animation Hook
 * 
 * Replaces multiple animation hooks with a single, performance-aware system
 * Respects performance budgets and user preferences
 * 
 * Core Principles:
 * - PERFORMANT: Budget-aware animation management
 * - DRY: Single animation system for all components
 * - CLEAN: Clear animation lifecycle management
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { performanceBudgetManager } from '@/services/performance/PerformanceBudgetManager';

export interface AnimationConfig {
  id: string;
  priority: 'high' | 'medium' | 'low';
  frameRate?: number;
  enabled?: boolean;
  respectReducedMotion?: boolean;
}

export interface AnimationState {
  isActive: boolean;
  frameCount: number;
  lastFrameTime: number;
  averageFrameTime: number;
}

export function useOptimizedAnimation(
  animationFn: (deltaTime: number, frameCount: number) => void,
  config: AnimationConfig
) {
  const animationRef = useRef<number | null>(null);
  const [state, setState] = useState<AnimationState>({
    isActive: false,
    frameCount: 0,
    lastFrameTime: 0,
    averageFrameTime: 16.67, // 60fps baseline
  });
  
  const frameTimesRef = useRef<number[]>([]);
  const lastTimeRef = useRef<number>(0);
  const configRef = useRef(config);
  
  // Update config ref when config changes
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // PERFORMANT: Optimized animation loop with performance monitoring
  const animate = useCallback((currentTime: number) => {
    const config = configRef.current;
    
    if (!config.enabled) {
      setState(prev => ({ ...prev, isActive: false }));
      return;
    }

    const deltaTime = currentTime - lastTimeRef.current;
    lastTimeRef.current = currentTime;

    // Respect target frame rate
    const targetFrameTime = 1000 / (config.frameRate || performanceBudgetManager.getOptimizedFrameRate());
    
    if (deltaTime < targetFrameTime * 0.9) {
      // Skip frame to maintain target frame rate
      animationRef.current = requestAnimationFrame(animate);
      return;
    }

    // Update performance metrics
    frameTimesRef.current.push(deltaTime);
    if (frameTimesRef.current.length > 10) {
      frameTimesRef.current.shift();
    }
    
    const averageFrameTime = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;

    setState(prev => ({
      isActive: true,
      frameCount: prev.frameCount + 1,
      lastFrameTime: currentTime,
      averageFrameTime,
    }));

    // Execute animation function
    try {
      animationFn(deltaTime, state.frameCount);
    } catch (error) {
      console.warn(`Animation error in ${config.id}:`, error);
    }

    // Continue animation loop
    animationRef.current = requestAnimationFrame(animate);
  }, [animationFn, state.frameCount]);

  // CLEAN: Start animation with budget check
  const startAnimation = useCallback(() => {
    if (animationRef.current) return; // Already running

    // Check performance budget
    if (!performanceBudgetManager.requestAnimation(config.id, config.priority)) {
      console.warn(`Animation ${config.id} denied due to performance budget`);
      return false;
    }

    // Check reduced motion preference
    if (config.respectReducedMotion && performanceBudgetManager.getStatus().capabilities.preferReducedMotion) {
      if (config.priority !== 'high') {
        return false;
      }
    }

    lastTimeRef.current = performance.now();
    animationRef.current = requestAnimationFrame(animate);
    return true;
  }, [config.id, config.priority, config.respectReducedMotion, animate]);

  // CLEAN: Stop animation and release budget
  const stopAnimation = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    performanceBudgetManager.releaseAnimation(config.id);
    setState(prev => ({ ...prev, isActive: false }));
  }, [config.id]);

  // PERFORMANT: Auto-start/stop based on config
  useEffect(() => {
    if (config.enabled) {
      startAnimation();
    } else {
      stopAnimation();
    }

    return stopAnimation;
  }, [config.enabled, startAnimation, stopAnimation]);

  // PERFORMANT: Listen for performance cleanup events
  useEffect(() => {
    const handleCleanup = (event: CustomEvent) => {
      if (config.priority === 'low' || (config.priority === 'medium' && event.detail.reason === 'memory-pressure')) {
        stopAnimation();
      }
    };

    window.addEventListener('performance-cleanup', handleCleanup as EventListener);
    return () => window.removeEventListener('performance-cleanup', handleCleanup as EventListener);
  }, [config.priority, stopAnimation]);

  // CLEAN: Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAnimation();
    };
  }, [stopAnimation]);

  return {
    isActive: state.isActive,
    frameCount: state.frameCount,
    averageFrameTime: state.averageFrameTime,
    fps: Math.round(1000 / state.averageFrameTime),
    startAnimation,
    stopAnimation,
  };
}

// MODULAR: Specialized hook for particle animations
export function useOptimizedParticles<T>(
  particleCount: number,
  createParticle: () => T,
  updateParticle: (particle: T, deltaTime: number) => T,
  config: Omit<AnimationConfig, 'id'> & { id: string }
) {
  const [particles, setParticles] = useState<T[]>([]);
  
  // PERFORMANT: Optimize particle count based on device capabilities
  const optimizedCount = performanceBudgetManager.getOptimizedParticleCount(particleCount);
  
  // Initialize particles
  useEffect(() => {
    const newParticles = Array.from({ length: optimizedCount }, createParticle);
    setParticles(newParticles);
  }, [optimizedCount, createParticle]);

  // Animation function for particles
  const animateParticles = useCallback((deltaTime: number) => {
    setParticles(prevParticles => 
      prevParticles.map(particle => updateParticle(particle, deltaTime))
    );
  }, [updateParticle]);

  const animation = useOptimizedAnimation(animateParticles, config);

  return {
    particles,
    setParticles,
    ...animation,
    optimizedCount,
  };
}

// MODULAR: Hook for counter animations
export function useOptimizedCounter(
  targetValue: number,
  duration: number = 2000,
  config: Omit<AnimationConfig, 'id'> & { id: string }
) {
  const [currentValue, setCurrentValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const startValueRef = useRef(0);
  const startTimeRef = useRef(0);

  const animateCounter = useCallback((deltaTime: number, frameCount: number) => {
    if (!isAnimating) return;

    const elapsed = performance.now() - startTimeRef.current;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function
    const easeOutCubic = 1 - Math.pow(1 - progress, 3);
    
    const newValue = startValueRef.current + (targetValue - startValueRef.current) * easeOutCubic;
    setCurrentValue(newValue);

    if (progress >= 1) {
      setIsAnimating(false);
      setCurrentValue(targetValue);
    }
  }, [targetValue, duration, isAnimating]);

  const animation = useOptimizedAnimation(animateCounter, {
    ...config,
    enabled: isAnimating,
  });

  // Start counter animation when target changes
  useEffect(() => {
    if (targetValue !== currentValue) {
      startValueRef.current = currentValue;
      startTimeRef.current = performance.now();
      setIsAnimating(true);
    }
  }, [targetValue, currentValue]);

  return {
    value: currentValue,
    isAnimating,
    ...animation,
  };
}