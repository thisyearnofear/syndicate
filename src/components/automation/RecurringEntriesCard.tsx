"use client";

/**
 * RECURRING ENTRIES — the Play-surface home for scheduled ticket purchases.
 *
 * Reads the same localStorage task Settings manages (`syndicate_automation_task`),
 * so power users can see and control their recurring entries where their tickets
 * live, without visiting Settings. Setup stays in the purchase flow (where the
 * permission is actually granted); this card surfaces the path and the status.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { Zap, Pause, Play, Trash2, Settings as SettingsIcon, ArrowRight } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";

interface StoredAutomationTask {
  id: string;
  taskId?: string;
  frequency: string;
  amountPerPeriod: string;
  status: "active" | "paused" | "disabled" | "cancelled";
  createdAt: number;
  strategy?: string;
}

const STORAGE_KEY = "syndicate_automation_task";

const STRATEGY_LABELS: Record<string, string> = {
  "yield-autopilot": "Yield Autopilot",
  "no-loss": "Prize Savings Agent",
  autonomous: "Autonomous Agent",
  scheduled: "Scheduled entries",
};

function formatCurrency(value: string | number) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
}

export function RecurringEntriesCard() {
  const [task, setTask] = useState<StoredAutomationTask | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTask(JSON.parse(stored) as StoredAutomationTask);
      }
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  const persist = (next: StoredAutomationTask | null) => {
    setTask(next);
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  };

  const toggle = () => {
    if (!task) return;
    persist({ ...task, status: task.status === "active" ? "paused" : "active" });
  };

  const cancel = () => persist(null);

  const live = task && task.status !== "cancelled" && task.status !== "disabled";

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 md:p-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-amber-400/15 flex items-center justify-center">
          <Zap className="w-5 h-5 text-amber-300" />
        </div>
        <div>
          <h2 className="font-bold text-2xl text-white">Recurring entries</h2>
          <p className="text-sm text-gray-400">Scheduled ticket purchases, running without you</p>
        </div>
      </div>

      {live ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-white">
                {task.strategy ? (STRATEGY_LABELS[task.strategy] ?? "Scheduled entries") : "Scheduled entries"}
              </p>
              <p className="text-sm text-gray-400">
                {task.frequency} &middot; {formatCurrency(task.amountPerPeriod)}/period
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                task.status === "active"
                  ? "bg-emerald-900/30 text-emerald-400"
                  : "bg-yellow-900/30 text-yellow-400"
              }`}
            >
              {task.status === "active" ? "Active" : "Paused"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 pt-3 mt-3 border-t border-white/10">
            <Button variant="outline" size="sm" onClick={toggle}>
              {task.status === "active" ? (
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
              onClick={cancel}
            >
              <Trash2 className="w-3 h-3 mr-1" /> Cancel
            </Button>
            <Link href="/settings" className="ml-auto">
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                <SettingsIcon className="w-3 h-3 mr-1" /> Manage in Settings
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <p className="text-sm text-gray-400 max-w-md">
            Never miss a draw. Set a recurring purchase and your entries run on
            schedule — set up from the purchase flow.
          </p>
          <Link href="/#quick-purchase" className="sm:ml-auto">
            <Button variant="ghost" size="sm" className="border border-white/10 text-gray-200 hover:bg-white/10 hover:text-white">
              Set up in the purchase flow
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      )}
    </section>
  );
}
