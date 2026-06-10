"use client";

import { ArrowRight, Shield, TrendingUp, Ticket } from "lucide-react";

interface YieldPipelineVizProps {
  depositAmount: number;
  apy: number;
  ticketPrice: number;
  className?: string;
}

export function YieldPipelineViz({
  depositAmount,
  apy,
  ticketPrice,
  className = "",
}: YieldPipelineVizProps) {
  const annualYield = depositAmount * (apy / 100);
  const ticketsPerYear = ticketPrice > 0 ? Math.floor(annualYield / ticketPrice) : 0;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

  const stages = [
    {
      label: "Deposit",
      value: formatCurrency(depositAmount),
      sub: "USDC",
      icon: <Shield className="w-5 h-5 text-blue-400" />,
      bg: "from-blue-500/20 to-blue-600/10",
      border: "border-blue-500/30",
    },
    {
      label: "Yield Vault",
      value: `${apy.toFixed(1)}% APY`,
      sub: "accruing",
      icon: <TrendingUp className="w-5 h-5 text-indigo-400" />,
      bg: "from-indigo-500/20 to-indigo-600/10",
      border: "border-indigo-500/30",
    },
    {
      label: "Annual Yield",
      value: formatCurrency(annualYield),
      sub: "per year",
      icon: <TrendingUp className="w-5 h-5 text-green-400" />,
      bg: "from-green-500/20 to-green-600/10",
      border: "border-green-500/30",
    },
    {
      label: "Tickets",
      value: `${ticketsPerYear}`,
      sub: "per year",
      icon: <Ticket className="w-5 h-5 text-amber-400" />,
      bg: "from-amber-500/20 to-amber-600/10",
      border: "border-amber-500/30",
    },
  ];

  return (
    <div className={`w-full ${className}`}>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-0">
        {stages.map((stage, i) => (
          <div key={stage.label} className="flex items-center flex-1">
            <div
              className={`flex-1 bg-gradient-to-br ${stage.bg} border ${stage.border} rounded-xl p-3 sm:p-4 text-center transition-all duration-300 hover:scale-[1.02]`}
            >
              <div className="flex justify-center mb-2">{stage.icon}</div>
              <p className="text-xs text-gray-400 mb-1">{stage.label}</p>
              <p className="text-lg font-bold text-white">{stage.value}</p>
              <p className="text-xs text-gray-500">{stage.sub}</p>
            </div>
            {i < stages.length - 1 && (
              <ArrowRight className="w-4 h-4 text-gray-500 mx-1 sm:mx-2 flex-shrink-0 hidden sm:block" />
            )}
          </div>
        ))}
      </div>

      {/* Principal safety callout */}
      <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-400">
        <Shield className="w-3.5 h-3.5 text-green-400" />
        <span>
          Your {formatCurrency(depositAmount)} principal stays safe — only yield funds tickets
        </span>
      </div>
    </div>
  );
}
