/**
 * COMPONENT OPTIMIZATION PATTERNS
 *
 * Extracted reusable patterns for optimizing React components
 * Reduces code duplication and provides consistent optimization strategies
 *
 * Core Principles:
 * - PERFORMANT: Memoization and efficient re-rendering
 * - DRY: Reusable optimization utilities
 * - CLEAN: Clear performance boundaries
 */

import { useMemo } from 'react';
import { performanceBudgetManager } from '@/services/performance/PerformanceBudgetManager';

/**
 * PERFORMANT: Custom comparison function for React.memo
 * Prevents unnecessary re-renders by comparing only relevant props
 */
export function createMemoComparator<T extends Record<string, any>>(
    compareKeys: (keyof T)[]
) {
    return (prevProps: T, nextProps: T): boolean => {
        return compareKeys.every(key => prevProps[key] === nextProps[key]);
    };
}

/**
 * PERFORMANT: Device-aware styling hook
 * Returns optimized class names based on device capabilities
 */
export function useDeviceAwareStyling(
    baseClasses: string,
    advancedClasses?: string,
    reducedClasses?: string
) {
    return useMemo(() => {
        const capabilities = performanceBudgetManager.getStatus().capabilities;
        const supportsAdvanced = performanceBudgetManager.supportsAdvancedEffects();

        if (!supportsAdvanced && reducedClasses) {
            return `${baseClasses} ${reducedClasses}`;
        }

        if (supportsAdvanced && advancedClasses) {
            return `${baseClasses} ${advancedClasses}`;
        }

        return baseClasses;
    }, [baseClasses, advancedClasses, reducedClasses]);
}

/**
 * PERFORMANT: Conditional rendering based on performance budget
 */
export function usePerformanceAwareRendering(
    shouldRender: boolean,
    priority: 'high' | 'medium' | 'low' = 'medium'
) {
    return useMemo(() => {
        const capabilities = performanceBudgetManager.getStatus().capabilities;

        // Always render high priority components
        if (priority === 'high') return shouldRender;

        // Check device capabilities for medium/low priority
        if (capabilities.tier === 'low' && priority === 'medium') {
            return false;
        }

        return shouldRender;
    }, [shouldRender, priority]);
}

/**
 * PERFORMANT: Optimized loading state configuration
 */
export function useOptimizedLoadingConfig(
    isLoading: boolean,
    skeletonClassName?: string
) {
    return useMemo(() => {
        if (!isLoading) return { shouldRender: false };

        // Default skeleton with device-aware styling
        const skeletonClasses = useDeviceAwareStyling(
            'animate-pulse bg-gray-700 rounded',
            skeletonClassName,
            'bg-gray-800' // Reduced motion fallback
        );

        return {
            shouldRender: true,
            className: skeletonClasses,
            structure: ['h-4 bg-gray-600 rounded mb-2', 'h-8 bg-gray-600 rounded']
        };
    }, [isLoading, skeletonClassName]);
}

/**
 * PERFORMANT: Data transformation with memoization
 */
export function useMemoizedDataTransform<T, R>(
    data: T,
    transform: (data: T) => R,
    dependencies: any[] = []
) {
    return useMemo(() => {
        if (!data) return null;
        return transform(data);
    }, [data, ...dependencies]);
}

/**
 * PERFORMANT: Component display name helper
 */
export function setDisplayName<T extends { displayName?: string }>(
    component: T,
    name: string
): T {
    component.displayName = name;
    return component;
}

/**
 * PERFORMANT: Batch state updates for better performance
 */
export function createBatchedStateUpdater<T>(
    setState: React.Dispatch<React.SetStateAction<T>>
) {
    let batchedUpdates: Partial<T>[] = [];
    let timeoutId: NodeJS.Timeout | null = null;

    return (update: Partial<T>) => {
        batchedUpdates.push(update);

        if (timeoutId) clearTimeout(timeoutId);

        timeoutId = setTimeout(() => {
            setState(prevState => {
                let newState = { ...prevState };
                batchedUpdates.forEach(update => {
                    newState = { ...newState, ...update };
                });
                batchedUpdates = [];
                return newState;
            });
            timeoutId = null;
        }, 0);
    };
}