/**
 * DEPRECATED: Use ImprovedYieldStrategySelector instead
 * 
 * This component is kept for backward compatibility only.
 * It now delegates to ImprovedYieldStrategySelector with simplified props.
 * 
 * Core Principles Applied:
 * - CONSOLIDATION: Delegates to unified component
 * - ENHANCEMENT FIRST: Maintains backward compatibility while encouraging migration
 */

import React from 'react';
import { ImprovedYieldStrategySelector } from './ImprovedYieldStrategySelector';
import type { SyndicateInfo } from '@/domains/lottery/types';

interface YieldStrategySelectorProps {
  selectedStrategy: SyndicateInfo['vaultStrategy'] | null;
  onStrategySelect: (strategy: SyndicateInfo['vaultStrategy'] | undefined) => void;
  className?: string;
  userAddress?: string;
}

export function YieldStrategySelector(props: YieldStrategySelectorProps) {
  return (
    <ImprovedYieldStrategySelector
      {...props}
      showDetailView={false}
      showAllocationControls={false}
    />
  );
}