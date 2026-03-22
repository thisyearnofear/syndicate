"use client";

import { PuzzlePiece } from '@/shared/components/premium/PuzzlePiece';
import { CompactStack } from '@/shared/components/premium/CompactLayout';
import { CountUpText } from '@/shared/components/ui/CountUpText';
import { useLottery } from '@/domains/lottery/hooks/useLottery';

export function StatsPieces() {
  const { jackpotStats, isLoading } = useLottery();

  const totalRaised = jackpotStats
    ? jackpotStats.ticketsSoldCount * jackpotStats.ticketPrice
    : null;

  const activePlayers = jackpotStats?.activePlayers ?? null;

  const stats = [
    {
      label: "Total Raised",
      value: totalRaised !== null ? totalRaised : 0,
      prefix: "$",
      color: "green",
      isLive: totalRaised !== null,
    },
    {
      label: "Drift Vault APY",
      value: 22.5,
      suffix: "%",
      color: "indigo",
      isLive: false,
    },
    {
      label: "Players",
      value: activePlayers !== null ? activePlayers : 0,
      prefix: "",
      color: "blue",
      isLive: activePlayers !== null,
    },
    {
      label: "Donated to Causes",
      value: 47000,
      prefix: "$",
      color: "yellow",
      isLive: false,
    },
  ];

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto">
      <CompactStack spacing="md" align="center">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
          {stats.map((stat, index) => (
            <PuzzlePiece
              key={index}
              variant="primary"
              size="sm"
              shape="rounded"
              className={`animate-fade-in-up stagger-${index + 1}`}
            >
              <CompactStack spacing="xs" align="center">
                <div className="flex items-center gap-1">
                  <CountUpText
                    value={stat.value}
                    prefix={stat.prefix}
                    suffix={stat.suffix || ''}
                    className={`text-2xl font-black text-${stat.color}-400`}
                  />
                  {stat.isLive && (
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  )}
                </div>
                <p className="text-xs text-center text-gray-400 leading-relaxed">
                  {stat.label}
                </p>
              </CompactStack>
            </PuzzlePiece>
          ))}
        </div>
        {isLoading && (
          <p className="text-[10px] text-gray-600 text-center">
            Loading live data...
          </p>
        )}
        {!isLoading && totalRaised === null && (
          <p className="text-[10px] text-gray-600 text-center">
            Stats sourced from on-chain data — some values are historical estimates
          </p>
        )}
      </CompactStack>
    </div>
  );
}
