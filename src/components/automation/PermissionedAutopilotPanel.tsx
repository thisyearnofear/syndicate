"use client";

import { Activity, TimerReset, Zap } from "lucide-react";
import {
  usePermissionedAutopilotPolicies,
  useYieldAutopilotActivity,
  useYieldAutopilotExecution,
  useYieldAutopilotExecutionLog,
} from "@/hooks";
import { PolicyApprovalCard } from "@/components/agent/PolicyApprovalCard";
import { ReceiptStrip } from "@/components/proof/ReceiptStrip";
import { explorerTxForChain } from "@/config/explorers";

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
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-300" />
          Yield Autopilot Activity
        </h3>
        <span className="text-[10px] font-bold text-cyan-200 bg-cyan-500/15 border border-cyan-500/30 px-2 py-1 rounded">
          MetaMask policy
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {activePolicies.map((policy) => {
          const currentActivity = activity.find((item) => item.policyId === policy.id);
          const executionPlan = currentActivity?.executionPlan;
          const latestEntry = entries.find((entry) => entry.policyId === policy.id);
          const ready = currentActivity?.status === "ready" && !!executionPlan;

          return (
          <div key={policy.id} className="space-y-3">
            <PolicyApprovalCard
              title="Yield autopilot policy"
              mechanism="Enters every draw for you — yield only, never principal."
              description={`Use ${policy.sourceVault} yield for up to ${policy.ticketCount} tickets, capped at $${formatUsdc(policy.maxSpendPerPeriod)} per ${policy.period}.`}
              bounds={[
                { label: "Tickets", value: String(policy.ticketCount) },
                {
                  label: "Cap / period",
                  value: `$${formatUsdc(policy.maxSpendPerPeriod)} / ${policy.period}`,
                },
                { label: "Expires", value: formatDate(policy.expiresAt) },
                {
                  label: "Relayer",
                  value: policy.relayer === "1shot" ? "1Shot" : "Direct",
                },
              ]}
              onRevoke={() => deactivatePolicy(policy.id)}
              revokeLabel="Revoke this policy"
              onSkip={ready ? refresh : undefined}
              skipLabel="Skip this draw"
              onApprove={
                ready
                  ? () => void submitPlan(executionPlan)
                  : undefined
              }
              approveLabel={isSubmitting ? "Submitting…" : "Approve this draw"}
              approveDisabled={isSubmitting || isChecking}
              approving={isSubmitting}
            />

            {(() => {
              return (
                <div className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 font-mono text-[11px] space-y-2">
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
                    </div>
                  )}
                  {latestEntry && (
                    <div className="text-slate-500 border-t border-slate-800 pt-2 space-y-1.5">
                      <div>last.intent: {latestEntry.status} - {latestEntry.message}</div>
                      {latestEntry.transactionHash ? (
                        <ReceiptStrip
                          label="last.tx"
                          txHash={latestEntry.transactionHash}
                          explorerUrl={explorerTxForChain(latestEntry.transactionHash, "base")}
                          status={
                            latestEntry.status === "direct-submitted" ||
                            latestEntry.status === "relayer-submitted"
                              ? "verified"
                              : "pending"
                          }
                          compact
                        />
                      ) : null}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                  <Zap className="w-3 h-3" />
                  <span className="text-[10px] font-bold uppercase">Next action</span>
                </div>
                <p className="text-xs font-semibold text-white">
                  {ready ? 'Approve this draw' : 'Check accrued yield'}
                </p>
              </div>
              <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                  <TimerReset className="w-3 h-3" />
                  <span className="text-[10px] font-bold uppercase">Expires</span>
                </div>
                <p className="text-xs font-semibold text-white">{formatDate(policy.expiresAt)}</p>
              </div>
            </div>

            <div className="border-t border-white/10 pt-3 font-mono text-[11px] text-gray-400 space-y-1">
              <div>policy.created: {new Date(policy.createdAt).toISOString()}</div>
              <div>permission.id: {policy.permissionId}</div>
              <div>target: {policy.targetFunction} @ {policy.targetContract}</div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
