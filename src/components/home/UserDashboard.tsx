"use client";

import { useState, useEffect } from "react";
import { useUnifiedWallet, useTicketInfo } from "@/hooks";
import { Button } from "@/shared/components/ui/Button";
import Link from "next/link";
import { Zap } from "lucide-react";

export default function UserDashboard() {
  const { address } = useUnifiedWallet();
  const { userTicketInfo, claimWinnings, isClaimingWinnings } = useTicketInfo();
  const [automationActive, setAutomationActive] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem("syndicate_automation_task");
      if (stored) {
        const task = JSON.parse(stored);
        if (task.status === "active") setAutomationActive(true);
      }
    } catch {}
  }, []);

  if (!address) return null;

  const hasTickets = userTicketInfo && userTicketInfo.ticketsPurchased > 0;
  const hasWinnings = userTicketInfo && Number(userTicketInfo.winningsClaimable) > 0;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl md:text-3xl font-bold text-white text-center">
        Your Dashboard
      </h2>

      {/* Automation active banner */}
      {automationActive && (
        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-indigo-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-indigo-300">Auto-purchase active</p>
              <p className="text-xs text-gray-400">Recurring purchases are running in the background</p>
            </div>
          </div>
          <Link href="/settings">
            <Button variant="outline" size="sm" className="text-xs flex-shrink-0">
              Manage
            </Button>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Tickets */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center text-2xl">
              🎫
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">My Tickets</h3>
              <p className="text-sm text-gray-400">Active entries</p>
            </div>
          </div>
          <div className="text-3xl font-black text-white mb-4">
            {hasTickets ? userTicketInfo.ticketsPurchased : 0}
          </div>
          <Link href="/my-tickets">
            <Button variant="outline" size="sm" className="w-full">
              View All Tickets
            </Button>
          </Link>
        </div>

        {/* Winnings */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center text-2xl">
              💰
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Winnings</h3>
              <p className="text-sm text-gray-400">Claimable prizes</p>
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-400 mb-4">
            ${hasWinnings ? parseFloat(userTicketInfo.winningsClaimable).toFixed(2) : "0.00"}
          </div>
          {hasWinnings ? (
            <Button
              variant="default"
              size="sm"
              className="w-full bg-emerald-500 hover:bg-emerald-600"
              onClick={claimWinnings}
              disabled={isClaimingWinnings}
            >
              {isClaimingWinnings ? "Claiming..." : "Claim Winnings"}
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="w-full" disabled>
              No Winnings Yet
            </Button>
          )}
        </div>

        {/* Vaults */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center text-2xl">
              📈
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Vaults</h3>
              <p className="text-sm text-gray-400">Yield strategies</p>
            </div>
          </div>
          <div className="text-3xl font-black text-white mb-4">
            -
          </div>
          <Link href="/vaults">
            <Button variant="outline" size="sm" className="w-full">
              Manage Vaults
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
