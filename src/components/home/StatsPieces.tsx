"use client";

import { PuzzlePiece } from '@/shared/components/premium/PuzzlePiece';
import { CompactStack } from '@/shared/components/premium/CompactLayout';
import { CountUpText } from '@/shared/components/ui/CountUpText';

/**
 * MODULAR: Stats Puzzle Pieces (Overlapping)
 */
export function StatsPieces() {
  const stats = [
    { label: "Total Raised", value: 2100000, prefix: "$", color: "green" },
    { label: "Members", value: 4929, prefix: "", color: "blue" },
    { label: "Syndicates", value: 12, prefix: "", color: "purple" },
    { label: "Donated", value: 47000, prefix: "$", color: "yellow" },
  ];

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto">
      <CompactStack spacing="md" align="center">
        {stats.map((stat, index) => (
          <PuzzlePiece
            key={index}
            variant="primary"
            size="sm"
            shape="rounded"
            className={`animate-fade-in-up stagger-${index + 1
              } w-full max-w-xs`}
          >
            <CompactStack spacing="xs" align="center">
              <CountUpText
                value={stat.value}
                prefix={stat.prefix}
                className={`text-2xl font-black text-${stat.color}-400`}
              />
              <p className="text-xs text-center text-gray-400 leading-relaxed">
                {stat.label}
              </p>
            </CompactStack>
          </PuzzlePiece>
        ))}
      </CompactStack>
    </div>
  );
}
