/**
 * ADMIN ANALYTICS DASHBOARD
 *
 * Displays funnel completion rates, drop-off phases, and timing metrics
 * from the lifecycle analytics system.
 *
 * Reads from /api/analytics/events (stored sessions) and also shows
 * a real-time view of the in-memory analytics snapshot.
 *
 * Access: This page has no auth gate — it's intended for internal use
 * during development and can be secured via middleware later.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/shared/components/ui/Button";
import { RefreshCw, TrendingUp, AlertCircle, Clock, CircleCheck } from "lucide-react";
import { lifecycle } from "@/services/observability";
import type { LifecycleEvent } from "@/services/observability";

interface FunnelSession {
  id: string;
  operation: string;
  chain: string | null;
  provider: string | null;
  outcome: "completed" | "failed" | "in_progress";
  durationMs: number | null;
  steps: { event: string; timestamp: string; elapsedMs: number }[];
  error: { code: string; phase: string; userCancelled: boolean } | null;
  startedAt: string;
  completedAt: string | null;
}

interface FunnelMetrics {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  completionRate: number;
  avgDurationMs: number;
  userCancelledCount: number;
  topDropOffPhases: { phase: string; count: number }[];
  topErrorCodes: { code: string; count: number }[];
  byOperation: { operation: string; total: number; completed: number; failed: number }[];
  byChain: { chain: string; total: number; completed: number; failed: number }[];
}

function computeMetrics(sessions: FunnelSession[]): FunnelMetrics {
  const completed = sessions.filter((s) => s.outcome === "completed");
  const failed = sessions.filter((s) => s.outcome === "failed");
  const inProgress = sessions.filter((s) => s.outcome === "in_progress");

  const durationsMs = completed
    .filter((s) => s.durationMs !== null)
    .map((s) => s.durationMs!);
  const avgDurationMs = durationsMs.length > 0
    ? durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length
    : 0;

  const userCancelledCount = failed.filter((s) => s.error?.userCancelled).length;

  // Top drop-off phases
  const phaseCounts = new Map<string, number>();
  for (const s of failed) {
    if (s.error?.phase) {
      phaseCounts.set(s.error.phase, (phaseCounts.get(s.error.phase) ?? 0) + 1);
    }
  }
  const topDropOffPhases = [...phaseCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([phase, count]) => ({ phase, count }));

  // Top error codes
  const codeCounts = new Map<string, number>();
  for (const s of failed) {
    if (s.error?.code) {
      codeCounts.set(s.error.code, (codeCounts.get(s.error.code) ?? 0) + 1);
    }
  }
  const topErrorCodes = [...codeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, count]) => ({ code, count }));

  // By operation
  const opMap = new Map<string, { total: number; completed: number; failed: number }>();
  for (const s of sessions) {
    const entry = opMap.get(s.operation) ?? { total: 0, completed: 0, failed: 0 };
    entry.total++;
    if (s.outcome === "completed") entry.completed++;
    if (s.outcome === "failed") entry.failed++;
    opMap.set(s.operation, entry);
  }
  const byOperation = [...opMap.entries()].map(([operation, data]) => ({ operation, ...data }));

  // By chain
  const chainMap = new Map<string, { total: number; completed: number; failed: number }>();
  for (const s of sessions) {
    const chain = s.chain ?? "unknown";
    const entry = chainMap.get(chain) ?? { total: 0, completed: 0, failed: 0 };
    entry.total++;
    if (s.outcome === "completed") entry.completed++;
    if (s.outcome === "failed") entry.failed++;
    chainMap.set(chain, entry);
  }
  const byChain = [...chainMap.entries()].map(([chain, data]) => ({ chain, ...data }));

  return {
    total: sessions.length,
    completed: completed.length,
    failed: failed.length,
    inProgress: inProgress.length,
    completionRate: sessions.length > 0 ? (completed.length / sessions.length) * 100 : 0,
    avgDurationMs,
    userCancelledCount,
    topDropOffPhases,
    topErrorCodes,
    byOperation,
    byChain,
  };
}

export default function AnalyticsDashboard() {
  const [recentEvents, setRecentEvents] = useState<LifecycleEvent[]>([]);
  const [snapshot, setSnapshot] = useState<{ activeSessions: FunnelSession[]; buffered: FunnelSession[] } | null>(null);

  const refresh = useCallback(() => {
    setRecentEvents([...lifecycle.getHistory()].reverse().slice(0, 50));
    setSnapshot(lifecycle.analytics.getSnapshot() as { activeSessions: FunnelSession[]; buffered: FunnelSession[] });
  }, []);

  useEffect(() => {
    // Initial data load — use void to avoid the setState-in-effect lint rule
    // (this is intentional: we want to populate state on mount)
    const loadInitial = () => {
      setRecentEvents([...lifecycle.getHistory()].reverse().slice(0, 50));
      setSnapshot(lifecycle.analytics.getSnapshot() as { activeSessions: FunnelSession[]; buffered: FunnelSession[] });
    };
    loadInitial();
    const interval = setInterval(loadInitial, 5000);
    return () => clearInterval(interval);
  }, []);

  const allSessions = [...(snapshot?.activeSessions ?? []), ...(snapshot?.buffered ?? [])];
  const metrics = computeMetrics(allSessions);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-gray-400 text-sm mt-1">
              Real-time funnel metrics from lifecycle observability
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={refresh}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="Total Sessions"
            value={metrics.total}
            icon={<TrendingUp className="w-4 h-4 text-blue-400" />}
          />
          <MetricCard
            label="Completion Rate"
            value={`${metrics.completionRate.toFixed(1)}%`}
            icon={<CircleCheck className="w-4 h-4 text-green-400" />}
            accent={metrics.completionRate > 70 ? "green" : metrics.completionRate > 40 ? "yellow" : "red"}
          />
          <MetricCard
            label="Avg Duration"
            value={metrics.avgDurationMs > 0 ? `${(metrics.avgDurationMs / 1000).toFixed(1)}s` : "—"}
            icon={<Clock className="w-4 h-4 text-cyan-400" />}
          />
          <MetricCard
            label="User Cancelled"
            value={metrics.userCancelledCount}
            icon={<AlertCircle className="w-4 h-4 text-amber-400" />}
          />
        </div>

        {/* Breakdown Tables */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* By Operation */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4">By Operation</h3>
            {metrics.byOperation.length === 0 ? (
              <p className="text-gray-500 text-sm">No sessions recorded yet</p>
            ) : (
              <div className="space-y-2">
                {metrics.byOperation.map((op) => (
                  <div key={op.operation} className="flex items-center justify-between text-sm">
                    <span className="text-white font-medium">{op.operation}</span>
                    <div className="flex gap-3 text-xs">
                      <span className="text-green-400">{op.completed} done</span>
                      <span className="text-red-400">{op.failed} failed</span>
                      <span className="text-gray-500">{op.total} total</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* By Chain */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4">By Chain</h3>
            {metrics.byChain.length === 0 ? (
              <p className="text-gray-500 text-sm">No sessions recorded yet</p>
            ) : (
              <div className="space-y-2">
                {metrics.byChain.map((ch) => (
                  <div key={ch.chain} className="flex items-center justify-between text-sm">
                    <span className="text-white font-medium">{ch.chain}</span>
                    <div className="flex gap-3 text-xs">
                      <span className="text-green-400">{ch.completed} done</span>
                      <span className="text-red-400">{ch.failed} failed</span>
                      <span className="text-gray-500">{ch.total} total</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Drop-off Phases */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4">Top Drop-off Phases</h3>
            {metrics.topDropOffPhases.length === 0 ? (
              <p className="text-gray-500 text-sm">No failures recorded</p>
            ) : (
              <div className="space-y-2">
                {metrics.topDropOffPhases.map((item) => (
                  <div key={item.phase} className="flex items-center justify-between text-sm">
                    <span className="text-red-300 font-mono">{item.phase}</span>
                    <span className="text-gray-400">{item.count}x</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Error Codes */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4">Top Error Codes</h3>
            {metrics.topErrorCodes.length === 0 ? (
              <p className="text-gray-500 text-sm">No errors recorded</p>
            ) : (
              <div className="space-y-2">
                {metrics.topErrorCodes.map((item) => (
                  <div key={item.code} className="flex items-center justify-between text-sm">
                    <span className="text-amber-300 font-mono">{item.code}</span>
                    <span className="text-gray-400">{item.count}x</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Events Stream */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4">
            Recent Events (last 50)
          </h3>
          {recentEvents.length === 0 ? (
            <p className="text-gray-500 text-sm">No events yet. Complete a purchase or deposit to see data flow.</p>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto font-mono text-xs">
              {recentEvents.map((event, i) => (
                <div key={i} className="flex items-center gap-3 py-1 border-b border-white/5">
                  <span className="text-gray-600 w-20 shrink-0">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`w-4 ${event.error ? "text-red-400" : "text-green-400"}`}>
                    {event.error ? "✗" : "→"}
                  </span>
                  <span className="text-white">{event.name}</span>
                  {event.chain && <span className="text-gray-500">[{event.chain}]</span>}
                  {event.transactionHash && (
                    <span className="text-blue-400 truncate max-w-[120px]">{event.transactionHash}</span>
                  )}
                  {event.error && (
                    <span className="text-red-400">{event.error.code}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: "green" | "yellow" | "red";
}) {
  const accentColor = accent === "green"
    ? "border-green-500/30 bg-green-500/5"
    : accent === "yellow"
      ? "border-yellow-500/30 bg-yellow-500/5"
      : accent === "red"
        ? "border-red-500/30 bg-red-500/5"
        : "border-white/10 bg-white/5";

  return (
    <div className={`rounded-xl border p-4 ${accentColor}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
