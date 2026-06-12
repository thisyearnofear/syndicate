"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/components/ui/Button";
import { CompactCard, CompactStack } from "@/shared/components/premium/CompactLayout";
import { useUnifiedWallet } from "@/hooks";
import {
  ArrowLeft,
  Settings as SettingsIcon,
  Zap,
  Pause,
  Play,
  Trash2,
  Wallet,
  Bell,
  Shield,
  TrendingUp,
} from "lucide-react";

interface StoredAutomationTask {
  id: string;
  taskId?: string;
  frequency: string;
  amountPerPeriod: string;
  status: "active" | "paused" | "disabled" | "cancelled";
  createdAt: number;
  strategy?: string;
}

interface StoredYieldAllocation {
  ticketsPercentage: number;
  causesPercentage: number;
}

const AUTOMATION_STORAGE_KEY = "syndicate_automation_task";
const ALLOCATION_STORAGE_KEY = "vault_yield_allocation";

export default function SettingsPage() {
  const router = useRouter();
  const { address, isConnected } = useUnifiedWallet();
  const [automationTask, setAutomationTask] = useState<StoredAutomationTask | null>(null);
  const [allocation, setAllocation] = useState<StoredYieldAllocation | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedTask = localStorage.getItem(AUTOMATION_STORAGE_KEY);
      if (storedTask) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAutomationTask(JSON.parse(storedTask));
      }
    } catch {}
    try {
      const storedAllocation = localStorage.getItem(ALLOCATION_STORAGE_KEY);
      if (storedAllocation) {
         
        setAllocation(JSON.parse(storedAllocation));
      }
    } catch {}
    try {
      const notifPref = localStorage.getItem("syndicate_notifications");
      if (notifPref !== null) {
         
        setNotificationsEnabled(JSON.parse(notifPref));
      }
    } catch {}
  }, []);

  const handleToggleAutomation = () => {
    if (!automationTask) return;
    const newStatus = automationTask.status === "active" ? "paused" : "active";
    const updated = { ...automationTask, status: newStatus as typeof automationTask.status };
    setAutomationTask(updated);
    localStorage.setItem(AUTOMATION_STORAGE_KEY, JSON.stringify(updated));
  };

  const handleCancelAutomation = () => {
    if (!automationTask) return;
    localStorage.removeItem(AUTOMATION_STORAGE_KEY);
    setAutomationTask(null);
  };

  const handleToggleNotifications = () => {
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);
    localStorage.setItem("syndicate_notifications", JSON.stringify(newValue));
  };

  const handleAllocationChange = (tickets: number) => {
    const newAllocation = { ticketsPercentage: tickets, causesPercentage: 100 - tickets };
    setAllocation(newAllocation);
    localStorage.setItem(ALLOCATION_STORAGE_KEY, JSON.stringify(newAllocation));
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-3xl mx-auto py-8">
        <Button
          variant="ghost"
          className="mb-6 text-gray-400 hover:text-white"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <p className="text-gray-400 text-sm">Manage your automation, allocations, and preferences</p>
          </div>
        </div>

        <CompactStack spacing="lg">
          {/* Active Permissions Panel */}
          <CompactCard variant="premium" padding="lg">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-bold text-white">Active Permissions</h2>
            </div>

            {automationTask ? (
              <div className="space-y-4">
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-white">
                        {automationTask.strategy === "yield-autopilot"
                          ? "Yield Autopilot"
                          : automationTask.strategy === "no-loss"
                          ? "Prize Savings Agent"
                          : automationTask.strategy === "autonomous"
                          ? "Autonomous Agent"
                          : "Scheduled Public Play"}
                      </p>
                      <p className="text-sm text-gray-400">
                        {automationTask.frequency} &middot; {formatCurrency(automationTask.amountPerPeriod)}/period
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        automationTask.status === "active"
                          ? "bg-green-900/30 text-green-400"
                          : automationTask.status === "paused"
                          ? "bg-yellow-900/30 text-yellow-400"
                          : "bg-gray-700/50 text-gray-400"
                      }`}
                    >
                      {automationTask.status.charAt(0).toUpperCase() + automationTask.status.slice(1)}
                    </span>
                  </div>

                  {automationTask.status !== "cancelled" && (
                    <div className="flex gap-2 pt-2 border-t border-slate-700">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={handleToggleAutomation}
                      >
                        {automationTask.status === "active" ? (
                          <>
                            <Pause className="w-3 h-3 mr-1" /> Pause
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 mr-1" /> Resume
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-400 border-red-400/30 hover:bg-red-500/10"
                        onClick={handleCancelAutomation}
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> Cancel
                      </Button>
                    </div>
                  )}
                </div>

                <p className="text-xs text-gray-500">
                  Created {new Date(automationTask.createdAt * 1000).toLocaleDateString()}
                </p>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400">
                <Zap className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No active automation permissions</p>
                <p className="text-xs text-gray-500 mt-1">
                  Set up auto-purchase from the purchase flow to get started
                </p>
              </div>
            )}
          </CompactCard>

          {/* Yield Allocation Panel */}
          <CompactCard variant="premium" padding="lg">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white">Yield Allocation</h2>
            </div>

            {allocation ? (
              <div className="space-y-4">
                <div className="relative h-3 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-yellow-500 to-yellow-400 transition-all duration-300"
                    style={{ width: `${allocation.ticketsPercentage}%` }}
                  />
                  <div
                    className="absolute top-0 h-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-300"
                    style={{
                      width: `${allocation.causesPercentage}%`,
                      left: `${allocation.ticketsPercentage}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-yellow-400">
                    Tickets: {allocation.ticketsPercentage}%
                  </span>
                  <span className="text-red-400">Causes: {allocation.causesPercentage}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={allocation.ticketsPercentage}
                  onChange={(e) => handleAllocationChange(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No yield allocation configured</p>
                <p className="text-xs text-gray-500 mt-1">
                  Configure allocation when setting up a yield strategy
                </p>
              </div>
            )}
          </CompactCard>

          {/* Connected Wallets Panel */}
          <CompactCard variant="premium" padding="lg">
            <div className="flex items-center gap-3 mb-4">
              <Wallet className="w-5 h-5 text-green-400" />
              <h2 className="text-lg font-bold text-white">Connected Wallets</h2>
            </div>

            {isConnected && address ? (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <div>
                      <p className="text-sm font-medium text-white">Connected</p>
                      <p className="text-xs text-gray-400 font-mono">
                        {address.slice(0, 6)}...{address.slice(-4)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400">
                <Wallet className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No wallet connected</p>
              </div>
            )}
          </CompactCard>

          {/* Notification Preferences */}
          <CompactCard variant="premium" padding="lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-amber-400" />
                <div>
                  <h2 className="text-lg font-bold text-white">Notifications</h2>
                  <p className="text-sm text-gray-400">Receive alerts for activity and yield events</p>
                </div>
              </div>
              <button
                onClick={handleToggleNotifications}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                  notificationsEnabled ? "bg-indigo-500" : "bg-gray-600"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 ${
                    notificationsEnabled ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </CompactCard>
        </CompactStack>
      </div>
    </div>
  );
}
