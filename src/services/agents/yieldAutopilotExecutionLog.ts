import type {
  YieldAutopilotExecutionPlan,
  YieldAutopilotExecutionResult,
} from './yieldAutopilotAgent';
import type { OneShotTaskStatusCode } from '@/services/metamask/oneShotRelayerService';

const STORAGE_KEY = 'syndicate:yield-autopilot-execution-log';
export const YIELD_AUTOPILOT_EXECUTION_LOG_EVENT = 'syndicate:yield-autopilot-execution-log-updated';

export interface YieldAutopilotExecutionLogEntry {
  id: string;
  policyId: string;
  permissionId: string;
  relayer: YieldAutopilotExecutionPlan['relayer'];
  ticketsPlanned: number;
  status: YieldAutopilotExecutionResult['status'];
  message: string;
  approvalHash?: string;
  transactionHash?: string;
  relayerRequestId?: string;
  relayerTaskStatus?: OneShotTaskStatusCode;
  relayerTaskMessage?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface YieldAutopilotRelayerStatusUpdate {
  relayerTaskStatus: OneShotTaskStatusCode;
  relayerTaskMessage?: string;
  transactionHash?: string;
}

class YieldAutopilotExecutionLog {
  getEntries(): YieldAutopilotExecutionLogEntry[] {
    if (typeof window === 'undefined') return [];

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  append(plan: YieldAutopilotExecutionPlan, result: YieldAutopilotExecutionResult): void {
    if (typeof window === 'undefined') return;

    const entries = this.getEntries();
    entries.unshift({
      id: `exec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      policyId: plan.policyId,
      permissionId: plan.permissionId,
      relayer: plan.relayer,
      ticketsPlanned: plan.ticketsPlanned,
      status: result.status,
      message: result.message,
      approvalHash: result.approvalHash,
      transactionHash: result.transactionHash,
      relayerRequestId: result.relayerResult?.relayerRequestId,
      createdAt: Date.now(),
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 25)));
    window.dispatchEvent(new Event(YIELD_AUTOPILOT_EXECUTION_LOG_EVENT));
  }

  updateRelayerStatus(entryId: string, update: YieldAutopilotRelayerStatusUpdate): void {
    if (typeof window === 'undefined') return;

    const entries = this.getEntries().map((entry) => (
      entry.id === entryId
        ? {
          ...entry,
          relayerTaskStatus: update.relayerTaskStatus,
          relayerTaskMessage: update.relayerTaskMessage,
          transactionHash: update.transactionHash ?? entry.transactionHash,
          updatedAt: Date.now(),
        }
        : entry
    ));

    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    window.dispatchEvent(new Event(YIELD_AUTOPILOT_EXECUTION_LOG_EVENT));
  }
}

export const yieldAutopilotExecutionLog = new YieldAutopilotExecutionLog();
