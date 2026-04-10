/**
 * EMPTY VAULT STATE
 *
 * Educational empty state when no vaults match filters
 */

"use client";

import React from 'react';
import { Globe, RefreshCw, Filter, Sparkles } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';

interface EmptyVaultStateProps {
  hasFilters?: boolean;
  onClearFilters?: () => void;
  onRetry?: () => void;
  error?: boolean;
}

export function EmptyVaultState({
  hasFilters = false,
  onClearFilters,
  onRetry,
  error = false,
}: EmptyVaultStateProps) {
  if (error) {
    return (
      <div className="text-center py-12 px-4">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <Globe className="w-8 h-8 text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Unable to Load Vaults</h3>
        <p className="text-sm text-gray-400 max-w-md mx-auto mb-4">
          We couldn&apos;t fetch the latest vault data from LI.FI Earn. This might be a temporary network issue.
        </p>
        <Button
          variant="outline"
          className="border-white/20 text-white hover:bg-white/10"
          onClick={onRetry}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  if (hasFilters) {
    return (
      <div className="text-center py-12 px-4">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
          <Filter className="w-8 h-8 text-gray-500" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No Vaults Match Your Filters</h3>
        <p className="text-sm text-gray-400 max-w-md mx-auto mb-4">
          Try adjusting your chain or APY filters to see more opportunities.
        </p>
        <Button
          variant="outline"
          className="border-white/20 text-white hover:bg-white/10"
          onClick={onClearFilters}
        >
          Clear Filters
        </Button>
      </div>
    );
  }

  return (
    <div className="text-center py-12 px-4">
      <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
        <Sparkles className="w-8 h-8 text-indigo-400" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">No Vaults Available</h3>
      <p className="text-sm text-gray-400 max-w-md mx-auto mb-4">
        We&apos;re currently syncing with LI.FI Earn. Check back soon for cross-chain yield opportunities.
      </p>
      <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
        <span>Supported:</span>
        {['Aave', 'Morpho', 'Compound', 'Curve'].map((protocol) => (
          <span key={protocol} className="px-2 py-0.5 rounded-full bg-white/5">
            {protocol}
          </span>
        ))}
        <span>+16 more</span>
      </div>
    </div>
  );
}
