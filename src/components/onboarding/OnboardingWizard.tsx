/**
 * Onboarding Wizard — 3-step intro for first-time visitors.
 * Concise, outcome-focused, matches landing page tone.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, Ticket, TrendingUp, Users } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';

interface OnboardingState {
  currentStep: number;
  completed: boolean;
  completedAt: string | null;
}

const STEPS = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'how', title: 'How it works' },
  { id: 'start', title: 'Get started' },
];

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('syndicate_onboarding');
      if (stored) {
        const state: OnboardingState = JSON.parse(stored);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (state.completed) { setLoading(false); return; }
        setStep(state.currentStep);
      }
      setShow(true);
    } catch {
      setShow(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const save = (s: number, done = false) => {
    localStorage.setItem('syndicate_onboarding', JSON.stringify({
      currentStep: s,
      completed: done,
      completedAt: done ? new Date().toISOString() : null,
    }));
  };

  const next = () => {
    if (step >= STEPS.length - 1) { complete(); return; }
    setStep(step + 1);
    save(step + 1);
  };
  const prev = () => { setStep(Math.max(0, step - 1)); save(Math.max(0, step - 1)); };
  const complete = () => { save(step, true); setShow(false); };

  if (loading || !show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex gap-2 mb-5">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= step ? 'bg-brand-500' : 'bg-gray-700'}`} />
          ))}
        </div>

        <div className="rounded-2xl border border-white/15 bg-slate-900/95 backdrop-blur-xl p-7">
          {step === 0 && <StepWelcome />}
          {step === 1 && <StepHow />}
          {step === 2 && <StepStart router={router} onComplete={complete} />}

          {/* Nav */}
          <div className="flex items-center justify-between mt-7 pt-5 border-t border-white/10">
            {step > 0 ? (
              <Button variant="ghost" size="sm" onClick={prev}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={complete}>
                Skip
              </Button>
            )}
            {step < STEPS.length - 1 && (
              <Button size="sm" onClick={next}>
                Next <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Steps ──────────────────────────────────────────────────────────────────

function StepWelcome() {
  return (
    <div className="text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl border border-amber-400/35 bg-slate-800 flex items-center justify-center mx-auto">
        <span className="text-amber-200 font-bold text-xl">S</span>
      </div>
      <h2 className="text-2xl font-bold text-white">Sit at the table. Then buy a ticket.</h2>
      <p className="text-gray-400 max-w-sm mx-auto">
        $1 to enter a real Megapot draw. Your deposit back forever. Season is the crew table those tickets feed.
      </p>
    </div>
  );
}

function StepHow() {
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-white text-center">One session</h2>
      <div className="space-y-3">
        <div className="flex items-center gap-4 rounded-xl bg-white/5 p-4">
          <div className="w-10 h-10 rounded-lg bg-[#c9a227]/20 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-[#e3c887]" />
          </div>
          <div>
            <p className="text-white font-semibold">Take a seat</p>
            <p className="text-sm text-gray-400">Joining a crew registers you. It does not move money.</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl bg-white/5 p-4">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Ticket className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-white font-semibold">Buy a real ticket</p>
            <p className="text-sm text-gray-400">$1, daily draw. Your wallet&apos;s purchase scores the crew on-chain.</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl bg-white/5 p-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-white font-semibold">Grow later</p>
            <p className="text-sm text-gray-400">Deposit when you want yield to enter draws for you. Withdraw anytime.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepStart({ router, onComplete }: { router: { push: (p: string) => void }; onComplete: () => void }) {
  const go = (path: string) => { onComplete(); router.push(path); };

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-white text-center">Start this session</h2>
      <div className="grid grid-cols-1 gap-3">
        <button
          onClick={() => go('/season')}
          className="flex items-center gap-4 rounded-xl border border-[#c9a227]/30 bg-[#c9a227]/5 p-4 text-left transition-colors hover:bg-[#c9a227]/10"
        >
          <Users className="w-5 h-5 text-[#e3c887] flex-shrink-0" />
          <div>
            <p className="text-white font-semibold">Take a seat</p>
            <p className="text-xs text-gray-400">See the table. Joining moves no money.</p>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-600 ml-auto" />
        </button>
        <button
          onClick={() => go('/')}
          className="flex items-center gap-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-left transition-colors hover:bg-amber-500/10"
        >
          <Ticket className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-white font-semibold">Buy a ticket</p>
            <p className="text-xs text-gray-400">$1 into today&apos;s live Megapot draw</p>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-600 ml-auto" />
        </button>
        <button
          onClick={() => go('/vaults')}
          className="flex items-center gap-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-left transition-colors hover:bg-emerald-500/10"
        >
          <TrendingUp className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-white font-semibold">Deposit &amp; grow</p>
            <p className="text-xs text-gray-400">Set it and forget it — yield does the work</p>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-600 ml-auto" />
        </button>
        <button
          onClick={() => go('/coordinate')}
          className="flex items-center gap-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-left transition-colors hover:bg-blue-500/10"
        >
          <Users className="w-5 h-5 text-blue-400 flex-shrink-0" />
          <div>
            <p className="text-white font-semibold">Start a syndicate</p>
            <p className="text-xs text-gray-400">Coordinate capital with your group</p>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-600 ml-auto" />
        </button>
      </div>
    </div>
  );
}

export default OnboardingWizard;
