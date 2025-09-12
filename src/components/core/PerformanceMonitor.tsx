"use client";

import { useEffect } from "react";
import { useWalletConnection } from "@/hooks/useWalletConnection";

/**
 * Performance monitoring for core user flows
 * Tracks key metrics aligned with our Core Principles
 */
export function usePerformanceMonitoring() {
  const walletConnection = useWalletConnection();

  useEffect(() => {
    // Track wallet connection performance
    const connectionStart = performance.now();

    if (walletConnection.isAnyConnected) {
      const connectionTime = performance.now() - connectionStart;

      // DEBUG: Performance metrics logging disabled for production
    }
  }, [walletConnection.isAnyConnected]);

  // Monitor component mount times
  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === "navigation") {
          const navEntry = entry as PerformanceNavigationTiming;
          // DEBUG: Page load performance logging disabled for production
        }
      }
    });

    observer.observe({ entryTypes: ["navigation"] });

    return () => observer.disconnect();
  }, []);
}

/**
 * Component to track performance metrics without affecting UI
 */
export default function PerformanceMonitor() {
  usePerformanceMonitoring();
  return null; // No UI impact
}
