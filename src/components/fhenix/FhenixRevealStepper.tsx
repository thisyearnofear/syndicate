'use client';

import React from 'react';
import {
  Shield,
  KeyRound,
  Download,
  Eye,
  ShieldCheck,
  Loader,
  Check,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';

type Status = 'idle' | 'initializing' | 'permit' | 'reading' | 'unsealing' | 'ready' | 'error';

interface FhenixRevealStepperProps {
  status: Status;
  balanceMicro?: bigint | null;
  formattedBalance?: string | null;
  error?: string | null;
  onReveal: () => void;
  compact?: boolean;
  className?: string;
}

const STEPS = [
  { key: 'initializing', label: 'Initialize', icon: Shield, desc: 'cofhejs init' },
  { key: 'permit', label: 'Permit', icon: KeyRound, desc: 'Create permission' },
  { key: 'reading', label: 'Read', icon: Download, desc: 'Contract query' },
  { key: 'unsealing', label: 'Decrypt', icon: Eye, desc: 'Local decrypt' },
  { key: 'ready', label: 'Done', icon: ShieldCheck, desc: 'Balance visible' },
] as const;

const STATUS_LABELS: Record<Status, string> = {
  idle: 'Private by default',
  initializing: 'Initializing privacy layer',
  permit: 'Activating permit',
  reading: 'Reading encrypted balance',
  unsealing: 'Revealing locally',
  ready: 'Visible only to you',
  error: 'Reveal unavailable',
};

/* ── Status badge mapping ──────────────────────────────────────── */

const STATUS_BADGE: Record<Status, { color: string; text: string }> = {
  idle: { color: 'bg-white/10 text-gray-200', text: 'Private by default' },
  initializing: { color: 'bg-blue-500/20 text-blue-300 animate-pulse', text: 'Initializing…' },
  permit: { color: 'bg-amber-500/20 text-amber-300 animate-pulse', text: 'Permitting…' },
  reading: { color: 'bg-amber-500/20 text-amber-300 animate-pulse', text: 'Reading…' },
  unsealing: { color: 'bg-amber-500/20 text-amber-300 animate-pulse', text: 'Unsealing…' },
  ready: { color: 'bg-emerald-500/20 text-emerald-300', text: 'Revealed' },
  error: { color: 'bg-red-500/20 text-red-300', text: 'Failed' },
};

/* ── Determine step states ─────────────────────────────────────── */

type StepState = 'pending' | 'current' | 'completed' | 'error';

function getStepState(stepIdx: number, status: Status): StepState {
  if (status === 'idle') return 'pending';
  if (status === 'error') return 'pending';

  const order: Status[] = ['initializing', 'permit', 'reading', 'unsealing', 'ready'];
  const currentIdx = order.indexOf(status);

  if (currentIdx === -1) return 'pending';
  if (stepIdx < currentIdx) return 'completed';
  return stepIdx === currentIdx ? 'current' : 'pending';
}

function isActive(status: Status): boolean {
  return ['initializing', 'permit', 'reading', 'unsealing'].includes(status);
}

/* ── Compact variant (list button) ─────────────────────────────── */

function CompactRevealButton({
  status,
  balanceMicro,
  formattedBalance,
  error: _error,
  onReveal,
}: {
  status: Status;
  balanceMicro?: bigint | null;
  formattedBalance?: string | null;
  error?: string | null;
  onReveal: () => void;
}) {
  const busy = isActive(status);

  if (balanceMicro != null) {
    return (
      <div className="text-right">
        <p className="text-emerald-400 font-medium">
          ${Number(formattedBalance ?? 0).toFixed(6)}
        </p>
        <span className="text-[10px] text-gray-500">Revealed via permit</span>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 h-auto py-1 text-xs"
      onClick={onReveal}
      disabled={busy}
    >
      {busy ? (          <><Loader className="w-3 h-3 mr-1 animate-spin" />{STATUS_LABELS[status]}</>
      ) : status === 'error' ? (
        <><AlertCircle className="w-3 h-3 mr-1" />Retry Reveal</>
      ) : (
        <><Eye className="w-3 h-3 mr-1" />Reveal</>
      )}
    </Button>
  );
}

/* ── Full stepper (yield dashboard / portfolio) ────────────────── */

function FullRevealStepper({
  status,
  balanceMicro,
  formattedBalance,
  error,
  onReveal,
}: {
  status: Status;
  balanceMicro?: bigint | null;
  formattedBalance?: string | null;
  error?: string | null;
  onReveal: () => void;
}) {
  const busy = isActive(status);
  const badge = STATUS_BADGE[status];

  return (
    <div className="space-y-4">
      {/* Status badge */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-300">
          Private Vault
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${badge.color}`}>
          {badge.text}
        </span>
      </div>

      {/* Step progress bar */}
      <div className="flex items-center gap-0">
        {STEPS.map((step, idx) => {
          const state = getStepState(idx, status);
          const StepIcon = step.icon;

          return (
            <React.Fragment key={step.key}>
              {/* Step circle */}
              <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                <div
                  className={`
                    relative w-9 h-9 rounded-full flex items-center justify-center
                    transition-all duration-500 ease-out
                    ${state === 'completed'
                      ? 'bg-emerald-500/20 border-2 border-emerald-400 scale-100'
                      : state === 'current'
                      ? 'bg-amber-500/20 border-2 border-amber-400 scale-110 shadow-lg shadow-amber-500/20'
                      : 'bg-white/5 border border-white/10 scale-95'}
                  `}
                >
                  {/* Hover tooltip indicator */}
                  {state === 'current' && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                  )}

                  {state === 'completed' ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <StepIcon
                      className={`
                        w-4 h-4 transition-all duration-300
                        ${state === 'current' ? 'text-amber-300' : 'text-gray-500'}
                        ${state === 'current' ? 'animate-pulse' : ''}
                      `}
                    />
                  )}
                </div>
                {/* Step label (desktop) */}
                <span
                  className={`
                    hidden sm:block text-[10px] font-medium truncate max-w-full text-center
                    transition-colors duration-300
                    ${state === 'completed' ? 'text-emerald-400' : state === 'current' ? 'text-amber-300' : 'text-gray-500'}
                  `}
                >
                  {step.label}
                </span>
                <span
                  className={`
                    hidden sm:block text-[9px] font-medium truncate max-w-full text-center
                    transition-colors duration-300
                    ${state === 'completed' ? 'text-emerald-400/60' : state === 'current' ? 'text-amber-300/60' : 'text-gray-600'}
                  `}
                >
                  {step.desc}
                </span>
              </div>

              {/* Connecting line */}
              {idx < STEPS.length - 1 && (
                <div className="flex-1 h-[2px] mx-1 self-start mt-4 rounded-full overflow-hidden">
                  <div
                    className={`
                      h-full rounded-full transition-all duration-700 ease-out
                      ${getStepState(idx, status) === 'completed'
                        ? 'bg-emerald-500/60 w-full'
                        : getStepState(idx, status) === 'current'
                        ? 'bg-gradient-to-r from-emerald-500/60 via-amber-400 to-white/10 w-full'
                        : 'bg-white/10 w-full'}
                    `}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Balance / privacy notice */}
      <div className="space-y-2">
        {balanceMicro != null ? (
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>
              Private balance revealed:{' '}
              <span className="font-mono text-white">${Number(formattedBalance ?? 0).toFixed(6)}</span>
            </span>
          </div>
        ) : (
          <p className="text-xs text-gray-300">
            This balance is encrypted on-chain and hidden by default.
          </p>
        )}

        <p className="text-[11px] text-gray-400">
          Transaction activity may be public. The contribution amount remains private until you reveal it.
        </p>

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-400">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Reveal button */}
      <Button
        variant="outline"
        size="sm"
        className="border-amber-400/30 bg-white/5 text-white hover:bg-white/10 min-w-[160px]"
        onClick={onReveal}
        disabled={busy}
      >
        {busy ? (
          <><Loader className="w-4 h-4 mr-2 animate-spin" />{STATUS_LABELS[status]}</>
        ) : status === 'error' ? (
          <><RefreshCw className="w-4 h-4 mr-2" />Retry Reveal</>
        ) : balanceMicro != null ? (
          <><RefreshCw className="w-4 h-4 mr-2" />Refresh Private Balance</>
        ) : (
          <><Eye className="w-4 h-4 mr-2" />Reveal Private Balance</>
        )}
      </Button>
    </div>
  );
}

/* ── Main export ──────────────────────────────────────────────── */

export function FhenixRevealStepper({
  status,
  balanceMicro,
  formattedBalance,
  error,
  onReveal,
  compact = false,
  className = '',
}: FhenixRevealStepperProps) {
  if (compact) {
    return (
      <div className={className}>
        <CompactRevealButton
          status={status}
          balanceMicro={balanceMicro}
          formattedBalance={formattedBalance}
          error={error}
          onReveal={onReveal}
        />
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <FullRevealStepper
        status={status}
        balanceMicro={balanceMicro}
        formattedBalance={formattedBalance}
        error={error}
        onReveal={onReveal}
      />
    </div>
  );
}

export default FhenixRevealStepper;
