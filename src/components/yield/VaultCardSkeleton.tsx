/**
 * VAULT CARD SKELETON
 *
 * Loading state for vault cards with progressive disclosure
 */

"use client";

import React from 'react';

interface VaultCardSkeletonProps {
  count?: number;
}

export function VaultCardSkeleton({ count = 4 }: VaultCardSkeletonProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-4 rounded-xl border border-white/10 bg-white/5 animate-pulse"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-4 w-20 bg-white/10 rounded" />
                <div className="h-4 w-16 bg-white/10 rounded-full" />
              </div>
              <div className="h-3 w-32 bg-white/10 rounded mb-3" />
              <div className="flex gap-1 mb-2">
                <div className="h-3 w-10 bg-white/10 rounded-full" />
                <div className="h-3 w-10 bg-white/10 rounded-full" />
              </div>
              <div className="flex gap-4">
                <div className="h-3 w-16 bg-white/10 rounded" />
                <div className="h-3 w-16 bg-white/10 rounded" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
