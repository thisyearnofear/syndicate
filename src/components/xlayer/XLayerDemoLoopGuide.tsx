'use client';

import { Check, Circle } from 'lucide-react';
import { useCapability } from '@/hooks/useCapability';
import { CompactCard } from '@/shared/components/premium/CompactLayout';

/**
 * Live demo checklist for the X Layer end-to-end loop.
 * Keeps Base as product home; this is the experimental second-engine path.
 */
export function XLayerDemoLoopGuide({
  potBalanceUsdc,
  minPotUsdc,
  totalShares,
  drawOpen,
  drawResolved,
  drawClaimed,
}: {
  potBalanceUsdc: number;
  minPotUsdc: number;
  totalShares: number;
  drawOpen: boolean;
  drawResolved: boolean;
  drawClaimed: boolean;
}) {
  const { canWrite } = useCapability('xlayer_prize_pool');

  const steps = [
    {
      id: 'writes',
      done: canWrite,
      label: 'Testnet writes enabled',
      detail: canWrite
        ? 'Deposit / join / fundPot are available.'
        : 'Set NEXT_PUBLIC_XLAYER_WRITES_ENABLED=true and restart.',
    },
    {
      id: 'shares',
      done: totalShares > 0,
      label: 'Get shares',
      detail: 'Deposit principal or join via swap surcharge.',
    },
    {
      id: 'pot',
      done: potBalanceUsdc >= minPotUsdc && minPotUsdc > 0,
      label: 'Pot ≥ minimum',
      detail: 'Owner fundPot or accrue swap surcharges.',
    },
    {
      id: 'draw',
      done: drawOpen || drawResolved || drawClaimed,
      label: 'Open draw (HITL)',
      detail: 'Agent plan → approve → sign openDraw.',
    },
    {
      id: 'resolve',
      done: drawResolved || drawClaimed,
      label: 'Oracle → fulfill',
      detail: 'setDemoOracle then fulfillRandomness.',
    },
    {
      id: 'claim',
      done: drawClaimed,
      label: 'Claim (if winner)',
      detail: 'Winner claims; principal shares stay intact.',
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;

  return (
    <CompactCard variant="glass" padding="md" hover={false} className="border-cyan-400/20 bg-cyan-500/[0.04]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
            Demo loop
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Experimental X Layer path — Base remains the product home.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-400">
          {doneCount}/{steps.length}
        </span>
      </div>
      <ol className="space-y-2.5">
        {steps.map((step) => (
          <li key={step.id} className="flex gap-3">
            <span className="mt-0.5 shrink-0">
              {step.done ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Circle className="h-4 w-4 text-slate-600" />
              )}
            </span>
            <div className="min-w-0">
              <p className={`text-sm font-medium ${step.done ? 'text-emerald-200' : 'text-white'}`}>
                {step.label}
              </p>
              <p className="text-xs leading-5 text-slate-500">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </CompactCard>
  );
}
