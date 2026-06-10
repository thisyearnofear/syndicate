"use client";

import { useState, useEffect } from "react";
import { Bot, Activity, Pause, Play, Clock, Zap } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";

interface AgentActivity {
  status: "active" | "idle" | "paused";
  lastReasoning: string | null;
  recentTransactions: { hash: string; description: string; timestamp: number }[];
  totalTicketsPurchased: number;
}

interface AgentActivityPanelProps {
  className?: string;
}

const AGENT_STORAGE_KEY = "syndicate_agent_activity";

export function AgentActivityPanel({ className = "" }: AgentActivityPanelProps) {
  const [activity, setActivity] = useState<AgentActivity | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadActivity = async () => {
      try {
        const stored = localStorage.getItem(AGENT_STORAGE_KEY);
        if (stored) {
          setActivity(JSON.parse(stored));
        } else {
          setActivity({
            status: "idle",
            lastReasoning: null,
            recentTransactions: [],
            totalTicketsPurchased: 0,
          });
        }
      } catch {
        setActivity({
          status: "idle",
          lastReasoning: null,
          recentTransactions: [],
          totalTicketsPurchased: 0,
        });
      } finally {
        setIsLoading(false);
      }
    };
    loadActivity();
  }, []);

  const handleToggleAgent = () => {
    if (!activity) return;
    const newStatus = activity.status === "active" ? "paused" : "active";
    const updated = { ...activity, status: newStatus };
    setActivity(updated);
    localStorage.setItem(AGENT_STORAGE_KEY, JSON.stringify(updated));
  };

  if (isLoading) {
    return (
      <div className={`${className}`}>
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-40 mb-4" />
          <div className="h-4 bg-gray-700 rounded w-full mb-2" />
          <div className="h-4 bg-gray-700 rounded w-3/4" />
        </div>
      </div>
    );
  }

  const statusColor =
    activity?.status === "active"
      ? "text-green-400"
      : activity?.status === "paused"
      ? "text-yellow-400"
      : "text-gray-400";

  const statusBg =
    activity?.status === "active"
      ? "bg-green-900/30"
      : activity?.status === "paused"
      ? "bg-yellow-900/30"
      : "bg-gray-700/50";

  return (
    <div className={`${className}`}>
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">Syndicate Strategist</h3>
              <p className="text-xs text-gray-400">AI-powered yield optimization agent</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusBg} ${statusColor}`}>
              {activity?.status === "active"
                ? "Active"
                : activity?.status === "paused"
                ? "Paused"
                : "Idle"}
            </span>
            {activity && activity.status !== "idle" && (
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white"
                onClick={handleToggleAgent}
              >
                {activity.status === "active" ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs text-gray-400">Tickets Purchased</span>
            </div>
            <p className="text-lg font-bold text-white">
              {activity?.totalTicketsPurchased ?? 0}
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs text-gray-400">Recent Actions</span>
            </div>
            <p className="text-lg font-bold text-white">
              {activity?.recentTransactions.length ?? 0}
            </p>
          </div>
        </div>

        {/* Latest reasoning */}
        {activity?.lastReasoning && (
          <div className="bg-violet-950/30 border border-violet-600/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-xs font-medium text-violet-300">Latest Analysis</span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">{activity.lastReasoning}</p>
          </div>
        )}

        {/* Recent transactions */}
        {activity && activity.recentTransactions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-400">Recent Activity</p>
            {activity.recentTransactions.slice(0, 3).map((tx) => (
              <div
                key={tx.hash}
                className="flex items-center justify-between bg-slate-800/30 rounded-lg px-3 py-2"
              >
                <span className="text-xs text-gray-300">{tx.description}</span>
                <span className="text-xs text-gray-500">
                  {new Date(tx.timestamp).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}

        {!activity?.lastReasoning && activity.recentTransactions.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-2">
            The agent hasn&apos;t taken any actions yet. Enable auto-purchase to activate.
          </p>
        )}
      </div>
    </div>
  );
}
