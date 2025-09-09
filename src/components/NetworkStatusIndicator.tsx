"use client";

import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export function NetworkStatusIndicator() {
  const { isOnline, isSlowConnection } = useNetworkStatus();

  if (isOnline && !isSlowConnection) {
    return null; // Don't show anything when everything is fine
  }

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
      {!isOnline ? (
        <div className="bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <span className="w-2 h-2 bg-red-300 rounded-full animate-pulse"></span>
          <span className="text-sm font-medium">No internet connection</span>
        </div>
      ) : isSlowConnection ? (
        <div className="bg-yellow-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <span className="w-2 h-2 bg-yellow-300 rounded-full animate-pulse"></span>
          <span className="text-sm font-medium">Slow connection detected</span>
        </div>
      ) : null}
    </div>
  );
}
