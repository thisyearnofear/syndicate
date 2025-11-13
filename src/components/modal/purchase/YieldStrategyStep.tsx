import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/Button';
import { CompactStack } from '@/shared/components/premium/CompactLayout';
import { ImprovedYieldStrategySelector } from '../../yield/ImprovedYieldStrategySelector';
import type { SyndicateInfo } from '@/domains/lottery/types';

interface YieldStrategyStepProps {
  selectedStrategy: SyndicateInfo['vaultStrategy'] | null;
  onStrategySelect: (strategy: SyndicateInfo['vaultStrategy']) => void;
  ticketsAllocation: number;
  causesAllocation: number;
  onAllocationChange: (tickets: number, causes: number) => void;
  onNext: () => void;
  onBack: () => void;
  className?: string;
  userAddress?: string;
}

export function YieldStrategyStep({ 
  selectedStrategy, 
  onStrategySelect, 
  ticketsAllocation, 
  causesAllocation,
  onAllocationChange,
  onNext,
  onBack,
  userAddress,
  className = '' 
}: YieldStrategyStepProps) {
  const [localTicketsAllocation, setLocalTicketsAllocation] = useState(ticketsAllocation);
  const [localCausesAllocation, setLocalCausesAllocation] = useState(causesAllocation);

  const handleAllocationChange = (tickets: number, causes: number) => {
    setLocalTicketsAllocation(tickets);
    setLocalCausesAllocation(causes);
    onAllocationChange(tickets, causes);
  };

  const canProceed = selectedStrategy !== null;

  return (
    <div className={`w-full ${className}`}>
      <div className="mb-6">
        <h3 className="text-xl font-bold text-white mb-2">Yield Strategy Configuration</h3>
        <p className="text-gray-400">
          Choose how your ticket purchase generates yield to support causes and amplify your participation
        </p>
      </div>
      
      <CompactStack spacing="lg">
        <ImprovedYieldStrategySelector 
          selectedStrategy={selectedStrategy} 
          onStrategySelect={onStrategySelect}
          ticketsAllocation={localTicketsAllocation}
          causesAllocation={localCausesAllocation}
          onAllocationChange={handleAllocationChange}
          userAddress={userAddress}
        />
        
        <div className="flex gap-3 pt-4">
          <Button 
            variant="outline" 
            onClick={onBack}
            className="flex-1"
          >
            Back
          </Button>
          <Button 
            variant="default" 
            onClick={onNext}
            disabled={!canProceed}
            className="flex-1"
          >
            Continue
          </Button>
        </div>
      </CompactStack>
    </div>
  );
}