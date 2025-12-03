"use client";

import { Button } from "@/shared/components/ui/Button";
import { CompactStack, CompactFlex } from "@/shared/components/premium/CompactLayout";
import type { SyndicateInfo } from "@/domains/lottery/types";

interface ModeStepProps {
  purchaseMode: 'individual' | 'syndicate' | 'yield';
  setPurchaseMode: (mode: 'individual' | 'syndicate' | 'yield') => void;
  selectedSyndicate: SyndicateInfo | null;
  setSelectedSyndicate: (syndicate: SyndicateInfo | null) => void;
  syndicates: SyndicateInfo[];
  setStep: (step: 'select' | 'yield') => void;
}

export function ModeStep({
  purchaseMode,
  setPurchaseMode,
  selectedSyndicate,
  setSelectedSyndicate,
  syndicates,
  setStep,
}: ModeStepProps) {
  return (
    <CompactStack spacing="lg">
      <div className="text-center mb-4">
        <h3 className="text-xl font-bold text-white mb-2">Choose Purchase Mode</h3>
        <p className="text-gray-400">How would you like to buy tickets?</p>
      </div>

      {/* Purchase Mode Options */}
      <CompactStack spacing="md">
        {/* Individual Mode */}
        <div
          onClick={() => {
            setPurchaseMode('individual');
            setSelectedSyndicate(null);
            setStep('select');
          }}
          className={`glass p-6 rounded-2xl cursor-pointer transition-all duration-300 hover:scale-105 ${purchaseMode === 'individual'
            ? 'ring-2 ring-blue-500 bg-blue-500/10'
            : 'hover:bg-white/5'
            }`}
        >
          <CompactFlex align="center" gap="md">
            <div className="text-3xl">🎫</div>
            <div className="flex-1">
              <h4 className="font-bold text-white mb-1">Buy for Myself</h4>
              <p className="text-sm text-gray-400">Keep 100% of winnings</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                  ✓ Full Control
                </span>
                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
                  ⚡ Instant
                </span>
              </div>
            </div>
          </CompactFlex>
        </div>

        {/* Syndicate Mode */}
        <div
          onClick={() => {
            setPurchaseMode('syndicate');
            // Don't go to select step yet, let user choose syndicate first
          }}
          className={`glass p-6 rounded-2xl cursor-pointer transition-all duration-300 hover:scale-105 ${purchaseMode === 'syndicate'
            ? 'ring-2 ring-purple-500 bg-purple-500/10'
            : 'hover:bg-white/5'
            }`}
        >
          <CompactFlex align="center" gap="md">
            <div className="text-3xl">🌊</div>
            <div className="flex-1">
              <h4 className="font-bold text-white mb-1">Join Pool & Support Cause</h4>
              <p className="text-sm text-gray-400">Pool tickets with others, support causes</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full">
                  🤝 Community
                </span>
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                  🌍 Impact
                </span>
                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">
                  🔥 Popular
                </span>
              </div>
            </div>
          </CompactFlex>
        </div>

        {/* Yield Strategies Mode */}
        <div
          onClick={() => {
            setPurchaseMode('yield');
            setSelectedSyndicate(null);
            setStep('yield');
          }}
          className={`glass p-6 rounded-2xl cursor-pointer transition-all duration-300 hover:scale-105 ${purchaseMode === 'yield'
            ? 'ring-2 ring-yellow-500 bg-yellow-500/10'
            : 'hover:bg-white/5'
            }`}
        >
          <CompactFlex align="center" gap="md">
            <div className="text-3xl">💰</div>
            <div className="flex-1">
              <h4 className="font-bold text-white mb-1">Yield Strategies</h4>
              <p className="text-sm text-gray-400">Buy tickets with yield, capital preservation</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">
                  💎 Capital Preserved
                </span>
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                  📈 Yield Generated
                </span>
                <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full">
                  🔬 Advanced
                </span>
              </div>
            </div>
          </CompactFlex>
        </div>
      </CompactStack>

      {/* Syndicate Selection */}
      {purchaseMode === 'syndicate' && (
        <CompactStack spacing="md">
          <div className="text-center">
            <h4 className="font-semibold text-white mb-2">Choose a Pool</h4>
            <p className="text-sm text-gray-400">Select which cause you&#39;d like to support</p>
          </div>

          <CompactStack spacing="sm">
            {syndicates.map((syndicate) => (
              <div
                key={syndicate.id}
                onClick={() => {
                  setSelectedSyndicate(syndicate);
                  setStep('select');
                }}
                className={`glass p-4 rounded-xl cursor-pointer transition-all duration-300 hover:scale-105 ${selectedSyndicate?.id === syndicate.id
                  ? 'ring-2 ring-green-500 bg-green-500/10'
                  : 'hover:bg-white/5'
                  }`}
              >
                <CompactFlex align="center" gap="md">
                  <div className="text-2xl">
                    {syndicate.cause.name === 'Ocean Cleanup' ? '🌊' :
                      syndicate.cause.name === 'Education Access' ? '📚' :
                        syndicate.cause.name === 'Climate Action' ? '🌍' :
                          syndicate.cause.name === 'Food Security' ? '🌾' : '✨'}
                  </div>
                  <div className="flex-1">
                    <h5 className="font-semibold text-white">{syndicate.name}</h5>
                    <p className="text-xs text-gray-400">{syndicate.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs">
                      <span className="text-blue-400">
                        👥 {syndicate.membersCount.toLocaleString()} members
                      </span>
                      <span className="text-green-400">
                        🎯 {syndicate.cause.name}
                      </span>
                      <span className="text-yellow-300">
                        🕒 {new Date(syndicate.executionDate).toLocaleString()}
                      </span>
                      <span className="text-gray-300">
                        ⛔ {new Date(syndicate.cutoffDate).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CompactFlex>
              </div>
            ))}
          </CompactStack>
        </CompactStack>
      )}

      {/* Continue Button for Syndicate Mode */}
      {purchaseMode === 'syndicate' && selectedSyndicate && (
        <Button
          variant="default"
          size="lg"
          onClick={() => setStep('select')}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl"
        >
          Continue with {selectedSyndicate.name}
        </Button>
      )}
    </CompactStack>
  );
}
