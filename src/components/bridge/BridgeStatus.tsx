"use client";

import React from 'react';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';

const getStageDisplay = (stage: string) => {
  const stageMap: Record<string, { icon: string; label: string; color: string }> = {
    'initializing': { icon: '🔄', label: 'Initializing bridge...', color: 'text-blue-400' },
    'connecting_wallet': { icon: '🔗', label: 'Connecting wallet...', color: 'text-purple-400' },
    'approving_tokens': { icon: '✅', label: 'Approving tokens...', color: 'text-yellow-400' },
    'burning_tokens': { icon: '🔥', label: 'Burning tokens on source chain...', color: 'text-orange-400' },
    'waiting_attestation': { icon: '⏳', label: 'Waiting for attestation...', color: 'text-blue-400' },
    'ready_to_mint_on_base': { icon: '🎯', label: 'Ready to mint on Base Network', color: 'text-green-400' },
    'minting_on_base': { icon: '⚡', label: 'Minting tokens on Base...', color: 'text-purple-400' },
    'mint_complete': { icon: '🎉', label: 'Bridge completed successfully!', color: 'text-green-400' },
  };
  
  return stageMap[stage] || { icon: '📋', label: stage.replace(/_/g, ' '), color: 'text-gray-400' };
};

export function BridgeStatus({
  logs,
  error,
}: {
  logs: Array<{ stage: string; info?: any }>;
  error?: string | null;
}) {
  if (!logs?.length && !error) return null;
  
  return (
    <div className="glass-premium p-6 rounded-xl border border-white/10 backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center">
          <span className="text-white text-lg">📊</span>
        </div>
        <h3 className="text-white font-semibold">Bridge Status</h3>
      </div>
      
      <div className="space-y-3">
        {logs.map((log, idx) => {
          const stage = getStageDisplay(log.stage);
          const isLatest = idx === logs.length - 1;
          
          return (
            <div key={idx} className="flex items-center gap-3">
              <div className={`flex-shrink-0 w-8 h-8 rounded-lg ${isLatest ? 'bg-gradient-to-r from-blue-400 to-purple-500' : 'bg-gray-600'} flex items-center justify-center`}>
                {isLatest && !error ? (
                  <LoadingSpinner size="sm" color="white" />
                ) : (
                  <span className="text-sm">{stage.icon}</span>
                )}
              </div>
              <div className="flex-1">
                <p className={`font-medium ${stage.color}`}>
                  {stage.label}
                </p>
                {log.info && (
                  <p className="text-xs text-gray-400 mt-1">
                    {typeof log.info === 'object' ? JSON.stringify(log.info, null, 2) : log.info}
                  </p>
                )}
              </div>
              <div className={`w-2 h-2 rounded-full ${isLatest && !error ? 'bg-blue-400 animate-pulse' : 'bg-green-400'}`} />
            </div>
          );
        })}
        
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-400/20">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center">
              <span className="text-white text-lg">❌</span>
            </div>
            <div className="flex-1">
              <p className="font-medium text-red-400 mb-1">Bridge Error</p>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          </div>
        )}
        
        {logs.length === 0 && !error && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-gray-500 to-gray-600 flex items-center justify-center mx-auto mb-3">
              <span className="text-white text-xl">⏳</span>
            </div>
            <p className="text-gray-400">Waiting for bridge to start...</p>
          </div>
        )}
      </div>
    </div>
  );
}
