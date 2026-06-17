/**
 * VIRTUALS AGENT PANEL
 *
 * The "Manage" modal for the Syndicate Strategist (Virtuals ACP) agent card
 * in AutoPurchaseSettings. Lets the user:
 *
 *   1. Create a new task (amount, frequency, recipient email).
 *   2. See existing tasks with status badges and last reasoning.
 *   3. Pause / resume / delete tasks.
 *   4. See the most recent on-chain tx hash across all tasks.
 *
 * Phase 3.5 — user-facing surface for the Virtuals ACP agent.
 */

'use client';

import { useState } from 'react';
import { Brain, Loader, Pause, Play, Plus, Trash2 } from 'lucide-react';
import { Address } from 'viem';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';
import { useVirtualsTasks, type VirtualsTask, type VirtualsTaskFrequency } from '@/hooks/useVirtualsTasks';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';

interface VirtualsAgentPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FREQUENCY_OPTIONS: { value: VirtualsTaskFrequency; label: string }[] = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'opportunistic', label: 'Opportunistic (every 6h)' },
];

export function VirtualsAgentPanel({ open, onOpenChange }: VirtualsAgentPanelProps) {
  const { address } = useUnifiedWallet();
  const { tasks, isLoading, error, refresh, createTask, updateTask, deleteTask } = useVirtualsTasks(address as Address | null);
  const [amount, setAmount] = useState('10');
  const [frequency, setFrequency] = useState<VirtualsTaskFrequency>('daily');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const agentId = typeof process !== 'undefined'
    ? (process.env.NEXT_PUBLIC_VIRTUALS_AGENT_ID ?? '')
    : '';

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const amt = parseFloat(amount);
    if (!isFinite(amt) || amt <= 0) {
      setFormError('Amount must be a positive number');
      return;
    }
    if (!recipientEmail) {
      setFormError('Recipient email is required');
      return;
    }
    if (!agentId) {
      setFormError('Virtuals agent is not configured (NEXT_PUBLIC_VIRTUALS_AGENT_ID missing)');
      return;
    }
    setIsCreating(true);
    const task = await createTask({ agentId, amount: amt, frequency, recipientEmail });
    setIsCreating(false);
    if (task) {
      setAmount('10');
      setRecipientEmail('');
    } else {
      setFormError(error || 'Failed to create task');
    }
  };

  const handleTogglePause = async (task: VirtualsTask) => {
    await updateTask(task.id, { isActive: !task.isActive });
  };

  const handleDelete = async (task: VirtualsTask) => {
    if (!confirm(`Cancel and remove task for ${task.recipientEmail}?`)) return;
    await deleteTask(task.id);
  };

  const activeTasks = tasks.filter(t => t.status !== 'cancelled');
  const lastTxHash = activeTasks.find(t => t.lastTxHash)?.lastTxHash;
  const lastReasoning = activeTasks.find(t => t.lastReasoning)?.lastReasoning;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-600" />
            <DialogTitle>Syndicate Strategist (Virtuals)</DialogTitle>
          </div>
          <DialogDescription>
            Autonomous yield strategist for private vaults. Venice AI reasoning → agent wallet execution → email report. The cron at <code className="text-[10px]">/api/crons/process-jobs</code> picks up due tasks daily.
          </DialogDescription>
        </DialogHeader>

        {!address && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Connect an EVM wallet to manage Virtuals tasks.
          </div>
        )}

        {address && (
          <div className="space-y-6">
            {/* Create form */}
            <form
              onSubmit={handleCreate}
              className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 space-y-3"
            >
              <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> New task
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-gray-700">Amount (USDC)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-gray-700">Frequency</span>
                  <select
                    value={frequency}
                    onChange={e => setFrequency(e.target.value as VirtualsTaskFrequency)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {FREQUENCY_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-gray-700">Recipient email (for the post-execution report)</span>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={e => setRecipientEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              {formError && (
                <p className="text-xs text-red-600">{formError}</p>
              )}
              <Button
                type="submit"
                disabled={isCreating}
                className="w-full bg-indigo-600 hover:bg-indigo-700"
              >
                {isCreating ? (
                  <><Loader className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
                ) : (
                  <><Plus className="w-4 h-4 mr-2" /> Create task</>
                )}
              </Button>
            </form>

            {/* Tasks list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-gray-900">
                  Active tasks ({activeTasks.length})
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refresh}
                  disabled={isLoading}
                  className="text-xs"
                >
                  {isLoading ? <Loader className="w-3 h-3 animate-spin" /> : 'Refresh'}
                </Button>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-2">
                  {error}
                </div>
              )}

              {isLoading && activeTasks.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm text-gray-500">
                  <Loader className="w-4 h-4 mr-2 animate-spin" /> Loading tasks...
                </div>
              ) : activeTasks.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                  No active tasks yet. Create one above to start the cron-driven review cycle.
                </div>
              ) : (
                <div className="space-y-2">
                  {activeTasks.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onTogglePause={() => handleTogglePause(task)}
                      onDelete={() => handleDelete(task)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Recent activity */}
            {(lastReasoning || lastTxHash) && (
              <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
                <h4 className="text-sm font-bold text-gray-900">Recent activity</h4>
                {lastReasoning && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                      Latest reasoning
                    </p>
                    <p className="text-sm text-gray-800 leading-relaxed">{lastReasoning}</p>
                  </div>
                )}
                {lastTxHash && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                      Latest tx
                    </p>
                    <a
                      href={`https://basescan.org/tx/${lastTxHash}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-xs font-mono text-indigo-600 hover:underline break-all"
                    >
                      {lastTxHash}
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Safety note */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-[11px] text-gray-600 leading-relaxed">
              <strong>Safety:</strong> Tasks auto-pause after 3 consecutive failures. Delete a task to cancel it permanently. The cron uses the <code className="text-[10px]">is_active</code> flag as a hard kill switch.
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Task row subcomponent
// ---------------------------------------------------------------------------

function TaskRow({ task, onTogglePause, onDelete }: {
  task: VirtualsTask;
  onTogglePause: () => void;
  onDelete: () => void;
}) {
  const statusColor = {
    active: 'bg-emerald-100 text-emerald-700',
    paused: 'bg-amber-100 text-amber-700',
    failed: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-200 text-gray-600',
  }[task.status];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-gray-900">
              ${(Number(task.amount) / 1_000_000).toFixed(2)} USDC
            </span>
            <span className="text-xs text-gray-500 capitalize">· {task.frequency}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${statusColor}`}>
              {task.status}
            </span>
          </div>
          <p className="text-xs text-gray-600 truncate">{task.recipientEmail}</p>
          <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500 font-mono">
            <span>Runs: {task.executionCount}</span>
            {task.lastExecutedAt && (
              <span>Last: {new Date(task.lastExecutedAt).toLocaleString()}</span>
            )}
            <span>Next: {new Date(task.nextExecutionAt).toLocaleString()}</span>
          </div>
          {task.lastError && (
            <p className="mt-1 text-[10px] text-red-600 truncate">
              Last error: {task.lastError}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onTogglePause}
            className="text-xs h-7 px-2"
            title={task.isActive ? 'Pause task' : 'Resume task'}
          >
            {task.isActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-xs h-7 px-2 text-red-600 hover:text-red-700"
            title="Cancel and remove task"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
