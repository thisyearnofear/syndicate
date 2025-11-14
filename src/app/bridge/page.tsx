"use client";

import React from 'react';
import { BridgeForm } from '@/components/bridge/BridgeForm';

export default function BridgePage() {
  return (
    <div className="max-w-xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-semibold mb-4">Bridge</h1>
      <p className="text-sm text-gray-400 mb-6">
        Bridge USDC to Base to get ready to buy tickets. This page is experimental and minimal.
      </p>
      <BridgeForm />
    </div>
  );
}
