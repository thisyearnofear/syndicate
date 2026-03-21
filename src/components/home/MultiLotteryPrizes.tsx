"use client";

import { memo } from "react";
import { useMultiLottery } from "@/domains/lottery/hooks/useMultiLottery";
import { Button } from "@/shared/components/ui/Button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { CountUpText } from "@/shared/components/ui/CountUpText";

interface MultiLotteryPrizesProps {
  onBuyClick: (protocol?: string) => void;
}

export function MultiLotteryPrizes({ onBuyClick }: MultiLotteryPrizesProps) {
  const { lotteries, isLoading, error, refresh, totalPrizeUsd } = useMultiLottery();

  if (isLoading) {
    return (
      <div className="glass-premium rounded-2xl p-6 border border-white/20 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <LoadingSpinner size="sm" color="white" />
          <span className="text-gray-300">Loading prizes...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-premium rounded-2xl p-6 border border-red-500/30 bg-red-500/10">
        <div className="flex items-center justify-between mb-4">
          <span className="text-red-400 font-semibold">⚠️ Failed to load prizes</span>
          <Button variant="ghost" size="sm" onClick={refresh}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          <h3 className="text-lg font-bold text-white">All Prizes</h3>
        </div>
        <span className="text-sm text-gray-400">
          ${totalPrizeUsd.toLocaleString()} total
        </span>
      </div>

      {/* Lottery Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {lotteries.map((lottery) => (
          <div
            key={lottery.protocol}
            className={`relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br ${lottery.color} p-1`}
          >
            <div className="bg-slate-900/90 rounded-lg p-4 h-full">
              {/* Badge */}
              {lottery.isNoLoss && (
                <div className="absolute top-2 right-2 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  No Loss
                </div>
              )}

              {/* Icon & Name */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{lottery.icon}</span>
                <div>
                  <h4 className="font-bold text-white text-sm">{lottery.name}</h4>
                  <span className="text-[10px] text-gray-400">{lottery.chain}</span>
                </div>
              </div>

              {/* Prize Amount */}
              <div className="mb-3">
                {lottery.prizeUsd === '∞' ? (
                  <span className="text-2xl font-black text-white">∞</span>
                ) : (
                  <span className="text-2xl font-black text-white">
                    ${parseFloat(lottery.prizeUsd).toLocaleString()}
                  </span>
                )}
                {lottery.apy && (
                  <span className="text-xs text-emerald-400 ml-2">
                    {lottery.apy}% APY
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                {lottery.description}
              </p>

              {/* CTA */}
              <Button
                variant="default"
                size="sm"
                className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20"
                onClick={() => onBuyClick(lottery.protocol)}
              >
                {lottery.isNoLoss ? 'Deposit' : 'Buy Tickets'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(MultiLotteryPrizes);
</path>
<task_progress>
- [x] Investigate why only Megapot is shown on frontend
- [x] Check PremiumJackpotPiece component
- [x] Check useLottery hook
- [x] Check PoolTogether service for prize data
- [x] Add prize fetching to PoolTogetherService
- [x] Create useMultiLottery hook
- [x] Create MultiLotteryPrizes component
- [ ] Add component to main page
</task_progress>
</write_to_file>