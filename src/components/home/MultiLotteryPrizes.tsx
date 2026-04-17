"use client";

import { memo } from "react";
import { useMultiLottery } from "@/domains/lottery/hooks/useMultiLottery";
import { Button } from "@/shared/components/ui/Button";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { CountUpText } from "@/shared/components/ui/CountUpText";

interface MultiLotteryPrizesProps {
  onBuyClick: (protocol?: string) => void;
}

export function MultiLotteryPrizes({ onBuyClick }: MultiLotteryPrizesProps) {
  const { lotteries, isLoading, error, refresh, totalPrizeUsd } = useMultiLottery();

  if (isLoading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <LoadingSpinner size="sm" color="white" />
          <span className="text-gray-300">Loading prizes...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/5 border border-red-500/30 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-red-400 font-semibold">⚠️ Failed to load prizes</span>
          <Button variant="ghost" size="sm" onClick={refresh}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Empty state - no prizes available (APIs down)
  if (lotteries.length === 0 && !isLoading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">⚠️</span>
          <div>
            <h4 className="text-white font-semibold">Prizes Temporarily Unavailable</h4>
            <p className="text-sm text-gray-400">
              Prize data is currently being fetched. Please try again in a few moments.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          Retry
        </Button>
      </div>
    );
  }

  // Filter out Megapot since it's already displayed as the hero jackpot
  const gridLotteries = lotteries.filter(l => l.protocol !== 'megapot');

  if (gridLotteries.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          <h3 className="text-lg font-bold text-white">More Ways to Win</h3>
        </div>
        <span className="text-sm text-gray-400">
          ${totalPrizeUsd.toLocaleString()} total
        </span>
      </div>

      {/* Lottery Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {gridLotteries.map((lottery) => (
          <div
            key={lottery.protocol}
            className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-all p-6"
          >
            {/* Badge */}
            {lottery.isNoLoss && (
              <div className="absolute top-4 right-4 bg-emerald-500/20 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full uppercase">
                No Loss
              </div>
            )}

            {/* Icon & Name */}
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${lottery.color} flex items-center justify-center text-2xl shadow-lg`}>
                {lottery.icon}
              </div>
              <div>
                <h4 className="font-bold text-white text-lg">{lottery.name}</h4>
                <span className="text-xs text-gray-400">{lottery.chain}</span>
              </div>
            </div>

            {/* Prize Amount */}
            <div className="mb-4">
              {lottery.prizeUsd === '∞' ? (
                <span className="text-3xl font-black text-white">∞</span>
              ) : (
                <span className="text-3xl font-black text-white">
                  ${parseFloat(lottery.prizeUsd).toLocaleString()}
                </span>
              )}
              {lottery.apy && (
                <span className="inline-block text-sm text-emerald-400 ml-2 font-semibold">
                  {lottery.apy}% APY
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
              {lottery.description}
            </p>

            {/* CTA */}
            <Button
              variant="default"
              size="default"
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
              onClick={() => onBuyClick(lottery.protocol)}
            >
              {lottery.isNoLoss ? '💰 Deposit Now' : '🎫 Buy Tickets'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(MultiLotteryPrizes);
