'use client';

import { useEffect, useState } from 'react';
import { Network, RefreshCw } from 'lucide-react';

import { CompactCard } from '@/shared/components/premium/CompactLayout';
import { Button } from '@/shared/components/ui/Button';
import {
  getEffectiveRangerApiBaseUrl,
  getStoredRangerApiOverride,
  probeRangerApiBaseUrl,
  setStoredRangerApiOverride,
} from '@/services/ranger';

export function RangerApiConfigPanel() {
  const [baseUrlInput, setBaseUrlInput] = useState('');
  const [effectiveBaseUrl, setEffectiveBaseUrl] = useState('');
  const [statusText, setStatusText] = useState('Not checked yet');
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    setBaseUrlInput(getStoredRangerApiOverride());
    setEffectiveBaseUrl(getEffectiveRangerApiBaseUrl());
  }, []);

  const handleSave = () => {
    setStoredRangerApiOverride(baseUrlInput);
    setEffectiveBaseUrl(getEffectiveRangerApiBaseUrl());
    setStatusText('Saved override locally');
  };

  const handleReset = () => {
    setStoredRangerApiOverride('');
    setBaseUrlInput('');
    setEffectiveBaseUrl(getEffectiveRangerApiBaseUrl());
    setStatusText('Reset to default base URL');
  };

  const handleProbe = async () => {
    setIsChecking(true);
    const result = await probeRangerApiBaseUrl();
    setStatusText(
      result.ok
        ? `Reachable (${result.status ?? 'network ok'})`
        : `Probe failed (${result.status ?? 'network error'}): ${result.body}`
    );
    setEffectiveBaseUrl(getEffectiveRangerApiBaseUrl());
    setIsChecking(false);
  };

  return (
    <CompactCard variant="glass" padding="lg" className="border border-indigo-500/20 bg-indigo-500/[0.04]">
      <div className="flex items-center gap-2 text-white">
        <Network className="h-5 w-5 text-indigo-300" />
        <h2 className="text-xl font-bold">Ranger API Config</h2>
      </div>

      <p className="mt-2 text-sm leading-6 text-slate-300">
        Override the Ranger API base URL locally if the documented host differs from the default.
      </p>

      <div className="mt-5 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
        Effective base URL: <span className="break-all text-indigo-100">{effectiveBaseUrl || 'Unavailable'}</span>
      </div>

      <div className="mt-4">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">
          Local Override
        </label>
        <input
          value={baseUrlInput}
          onChange={(event) => setBaseUrlInput(event.target.value)}
          placeholder="https://api.ranger.finance"
          className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          className="border-indigo-500/30 bg-indigo-500/10 text-indigo-100 hover:bg-indigo-500/20"
          onClick={handleSave}
        >
          Save Override
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-slate-500/30 bg-slate-500/10 text-slate-100 hover:bg-slate-500/20"
          onClick={handleReset}
        >
          Reset
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-indigo-500/30 bg-indigo-500/10 text-indigo-100 hover:bg-indigo-500/20"
          onClick={handleProbe}
          disabled={isChecking}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {isChecking ? 'Checking...' : 'Probe API'}
        </Button>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
        Status: {statusText}
      </div>
    </CompactCard>
  );
}
