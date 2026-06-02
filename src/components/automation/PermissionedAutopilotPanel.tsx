"use client";

import { Activity, ShieldCheck, TimerReset, Zap } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";
import {
  usePermissionedAutopilotPolicies,
  useYieldAutopilotActivity,
  useYieldAutopilotExecution,
  useYieldAutopilotExecutionLog,
} from "@/hooks";

function formatUsdc(amount: string): string {
  const value = Number(BigInt(amount)) / 1_000_000;
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: value >= 1 ? 0 : 2,
  });
}

function formatDate(ms: number | null): string {
  if (!ms) return "No expiry recorded";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(ms);
}

function formatRelayerTaskStatus(status?: number): string {
  switch (status) {
    case 100:
      return "pending";
    case 110:
      return "submitted";
    case 200:
      return "confirmed";
    case 400:
      return "rejected";
    case 500:
      return "reverted";
    default:
      return "checking";
  }
}

export function PermissionedAutopilotPanel() {
  const { activePolicies, deactivatePolicy } = usePermissionedAutopilotPolicies();
  const { activity, isChecking, refresh } = useYieldAutopilotActivity();
  const { isSubmitting, submitPlan } = useYieldAutopilotExecution();
  const { entries } = useYieldAutopilotExecutionLog();

  if (activePolicies.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-600" />
          Yield Autopilot Activity
        </h3>
        <span className="text-[10px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-100 px-2 py-1 rounded">
          MetaMask policy
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {activePolicies.map((policy) => (
          <div key={policy.id} className="bg-white border border-cyan-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-4 h-4 text-cyan-600" />
                  <h4 className="font-bold text-gray-900 text-sm">Principal-preserving ticket policy</h4>
                </div>
                <p className="text-xs text-gray-500">
                  Use {policy.sourceVault} yield for up to {policy.ticketCount} tickets, capped at ${formatUsdc(policy.maxSpendPerPeriod)} per {policy.period}.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => deactivatePolicy(policy.id)}
              >
                Disable
              </Button>
            </div>

            {(() => {
              const currentActivity = activity.find((item) => item.policyId === policy.id);
              const executionPlan = currentActivity?.executionPlan;
              const latestEntry = entries.find((entry) => entry.policyId === policy.id);
              return (
                <div className="mt-4 bg-slate-950 rounded-lg px-3 py-2 font-mono text-[11px] space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className={
                        currentActivity?.status === 'ready'
                          ? 'text-emerald-300'
                          : currentActivity?.status === 'blocked'
                            ? 'text-amber-300'
                            : 'text-slate-300'
                      }>
                        {currentActivity?.message ?? 'Checking accrued yield...'}
                      </span>
                      <button
                        className="text-cyan-300 hover:text-cyan-100"
                        onClick={refresh}
                        disabled={isChecking}
                      >
                        {isChecking ? 'Checking' : 'Refresh'}
                      </button>
                  </div>
                  {executionPlan && (
                    <div className="text-slate-400 space-y-1 border-t border-slate-800 pt-2">
                      <div>prepared.to: {executionPlan.to}</div>
                      <div>prepared.calldata: {executionPlan.data.slice(0, 18)}...{executionPlan.data.slice(-8)}</div>
                      <div>prepared.relayer: {executionPlan.relayer === "1shot" ? "1Shot" : "direct"}</div>
                      {executionPlan.relayer === "1shot" && (
                        <div>prepared.permissionContext: {executionPlan.permissionContext?.length ? `${executionPlan.permissionContext.length} delegation(s)` : "missing"}</div>
                      )}
                      <button
                        className="mt-2 text-emerald-300 hover:text-emerald-100 disabled:text-slate-600"
                        onClick={() => void submitPlan(executionPlan)}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 'Submitting intent...' : 'Submit execution intent'}
                      </button>
                    </div>
                  )}
                  {latestEntry && (
                    <div className="text-slate-500 border-t border-slate-800 pt-2 space-y-1">
                      <div>last.intent: {latestEntry.status} - {latestEntry.message}</div>
                      {latestEntry.approvalHash && (
                        <div>last.approval: {latestEntry.approvalHash.slice(0, 18)}...{latestEntry.approvalHash.slice(-8)}</div>
                      )}
                      {latestEntry.transactionHash && (
                        <div>last.tx: {latestEntry.transactionHash.slice(0, 18)}...{latestEntry.transactionHash.slice(-8)}</div>
                      )}
                      {latestEntry.relayerRequestId && (
                        <div>last.1shot.task: {latestEntry.relayerRequestId.slice(0, 18)}...{latestEntry.relayerRequestId.slice(-8)}</div>
                      )}
                      {latestEntry.relayerRequestId && (
                        <div>last.1shot.status: {formatRelayerTaskStatus(latestEntry.relayerTaskStatus)}</div>
                      )}
                      {latestEntry.relayerTaskMessage && (
                        <div>last.1shot.message: {latestEntry.relayerTaskMessage}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              <div className="bg-cyan-50/70 border border-cyan-100 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-cyan-700 mb-1">
                  <Zap className="w-3 h-3" />
                  <span className="text-[10px] font-bold uppercase">Next action</span>
                </div>
                <p className="text-xs font-semibold text-gray-900">
                  {activity.find((item) => item.policyId === policy.id)?.status === 'ready'
                    ? 'Prepare purchase'
                    : 'Check accrued yield'}
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-slate-600 mb-1">
                  <TimerReset className="w-3 h-3" />
                  <span className="text-[10px] font-bold uppercase">Expires</span>
                </div>
                <p className="text-xs font-semibold text-gray-900">{formatDate(policy.expiresAt)}</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-slate-600 mb-1">
                  <Activity className="w-3 h-3" />
                  <span className="text-[10px] font-bold uppercase">Relayer</span>
                </div>
                <p className="text-xs font-semibold text-gray-900">{policy.relayer === "1shot" ? "1Shot" : "Direct execution"}</p>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-3 font-mono text-[11px] text-slate-500 space-y-1">
              <div>policy.created: {new Date(policy.createdAt).toISOString()}</div>
              <div>permission.id: {policy.permissionId}</div>
              <div>target: {policy.targetFunction} @ {policy.targetContract}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
