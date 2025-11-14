"use client";

import React from 'react';

export function BridgeStatus({
  logs,
  error,
}: {
  logs: Array<{ stage: string; info?: any }>;
  error?: string | null;
}) {
  if (!logs?.length && !error) return null;
  return (
    <div className="mt-4 p-3 border rounded text-sm">
      <div className="font-medium mb-2">Status</div>
      <div className="space-y-1">
        {logs.map((l, idx) => (
          <div key={idx} className="text-gray-300">
            • {l.stage}
          </div>
        ))}
        {error && <div className="text-red-400">Error: {error}</div>}
      </div>
    </div>
  );
}
