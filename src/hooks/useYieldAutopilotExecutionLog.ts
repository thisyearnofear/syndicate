"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  YIELD_AUTOPILOT_EXECUTION_LOG_EVENT,
  type YieldAutopilotExecutionLogEntry,
  yieldAutopilotExecutionLog,
} from '@/services/agents/yieldAutopilotExecutionLog';
import type { OneShotRelayerStatus } from '@/services/metamask/oneShotRelayerService';

interface RelayerStatusResponse {
  success: boolean;
  status?: OneShotRelayerStatus;
  error?: string;
}

export function useYieldAutopilotExecutionLog(policyId?: string) {
  const [entries, setEntries] = useState<YieldAutopilotExecutionLogEntry[]>(() => (
    typeof window === 'undefined' ? [] : yieldAutopilotExecutionLog.getEntries()
  ));

  const refresh = useCallback(() => {
    setEntries(yieldAutopilotExecutionLog.getEntries());
  }, []);

  useEffect(() => {
    window.addEventListener(YIELD_AUTOPILOT_EXECUTION_LOG_EVENT, refresh);
    window.addEventListener('storage', refresh);

    return () => {
      window.removeEventListener(YIELD_AUTOPILOT_EXECUTION_LOG_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [refresh]);

  useEffect(() => {
    const pollableEntries = entries.filter((entry) => (
      entry.relayer === '1shot'
      && entry.relayerRequestId
      && entry.status === 'relayer-submitted'
      && entry.relayerTaskStatus !== 200
      && entry.relayerTaskStatus !== 400
      && entry.relayerTaskStatus !== 500
    ));

    if (pollableEntries.length === 0) return;

    let cancelled = false;

    const poll = async () => {
      await Promise.all(pollableEntries.map(async (entry) => {
        if (!entry.relayerRequestId) return;

        try {
          const response = await fetch(`/api/agent/autopilot/relayer-status?taskId=${entry.relayerRequestId}&chainId=8453`);
          const body = await response.json() as RelayerStatusResponse;
          if (cancelled || !body.success || !body.status) return;

          yieldAutopilotExecutionLog.updateRelayerStatus(entry.id, {
            relayerTaskStatus: body.status.status,
            relayerTaskMessage: body.status.message,
            transactionHash: body.status.receipt?.transactionHash ?? body.status.hash,
          });
        } catch {
          // Keep the submitted entry; the next polling interval can retry.
        }
      }));
    };

    void poll();
    const interval = window.setInterval(() => void poll(), 6000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [entries]);

  const filteredEntries = useMemo(
    () => policyId ? entries.filter((entry) => entry.policyId === policyId) : entries,
    [entries, policyId]
  );

  return {
    entries: filteredEntries,
    refresh,
  };
}
