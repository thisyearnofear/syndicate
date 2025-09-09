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

      // Log performance metrics (replace with your analytics)
      console.log("Performance Metrics:", {
        walletConnectionTime: connectionTime,
        connectedWallets: walletConnection.connectedWallets,
        hasMultipleWallets: walletConnection.hasMultipleWallets,
        primaryWallet: walletConnection.primaryWallet,
      });
    }
  }, [walletConnection.isAnyConnected]);

  // Monitor component mount times
  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === "navigation") {
          const navEntry = entry as PerformanceNavigationTiming;
          console.log("Page Load Performance:", {
            loadComplete: navEntry.loadEventEnd - navEntry.loadEventStart,
            domContentLoaded:
              navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart,
          });
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
