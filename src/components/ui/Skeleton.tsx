"use client";

/**
 * SKELETON COMPONENT
 *
 * Loading skeleton for better perceived performance
 * Reusable across different components
 */

import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  variant?: "default" | "rounded" | "circular";
  animate?: boolean;
}

export function Skeleton({
  className,
  variant = "default",
  animate = true
}: SkeletonProps) {
  const baseClasses = "bg-gray-700/50";

  const variantClasses = {
    default: "",
    rounded: "rounded-lg",
    circular: "rounded-full",
  };

  const animationClasses = animate ? "animate-pulse" : "";

  return (
    <div
      className={cn(
        baseClasses,
        variantClasses[variant],
        animationClasses,
        className
      )}
    />
  );
}

// Specific skeleton components for common use cases
export function WalletCardSkeleton() {
  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="w-2 h-2 rounded-full" />
          <Skeleton className="w-20 h-4" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="w-16 h-6 rounded-full" />
          <Skeleton className="w-20 h-6 rounded-full" />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Skeleton className="w-12 h-3" />
        <Skeleton className="w-24 h-3" />
      </div>

      <div className="flex items-center justify-between">
        <Skeleton className="w-14 h-3" />
        <Skeleton className="w-16 h-3" />
      </div>

      <div className="flex gap-2 pt-2">
        <Skeleton className="flex-1 h-8 rounded" />
        <Skeleton className="flex-1 h-8 rounded" />
      </div>
    </div>
  );
}

export function ModalSkeleton() {
  return (
    <div className="bg-gray-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <Skeleton className="w-32 h-6" />
        <Skeleton className="w-6 h-6 rounded" />
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
          <Skeleton className="w-12 h-12 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="w-24 h-4" />
            <Skeleton className="w-32 h-3" />
          </div>
        </div>

        <div className="space-y-3">
          <Skeleton className="w-24 h-4" />
          <div className="space-y-2">
            <Skeleton className="w-full h-10 rounded-lg" />
            <Skeleton className="w-full h-10 rounded-lg" />
            <Skeleton className="w-full h-10 rounded-lg" />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Skeleton className="flex-1 h-10 rounded" />
          <Skeleton className="flex-1 h-10 rounded" />
        </div>
      </div>
    </div>
  );
}

export function QRScannerSkeleton() {
  return (
    <div className="bg-gray-900 rounded-2xl max-w-md w-full max-h-[90vh] overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <Skeleton className="w-24 h-6" />
        <Skeleton className="w-6 h-6 rounded" />
      </div>

      <div className="relative aspect-square bg-gray-800">
        <div className="absolute inset-4 border-2 border-gray-600 rounded-lg">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 border-2 border-gray-500 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="text-center space-y-2">
          <Skeleton className="w-8 h-8 rounded-full mx-auto" />
          <Skeleton className="w-48 h-4 mx-auto" />
          <Skeleton className="w-32 h-3 mx-auto" />
        </div>

        <Skeleton className="w-full h-10 rounded" />
      </div>
    </div>
  );
}
