"use client";

import { memo } from "react";

interface AdvancedFeaturesToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export const AdvancedFeaturesToggle = memo(
  ({ enabled, onChange }: AdvancedFeaturesToggleProps) => (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-medium">⚡ Advanced Features</h3>
          <p className="text-gray-400 text-sm">
            Enable gasless transactions and experimental features
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
        </label>
      </div>
      {enabled && (
        <div className="mt-3 p-3 bg-yellow-900/30 border border-yellow-600 rounded">
          <p className="text-yellow-200 text-sm">
            ⚠️ <strong>Note:</strong> Advanced features require{" "}
            <a
              href="https://metamask.io/flask/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-400 hover:text-yellow-300 underline"
            >
              MetaMask Flask
            </a>{" "}
            and may be experimental.
          </p>
        </div>
      )}
    </div>
  )
);

AdvancedFeaturesToggle.displayName = "AdvancedFeaturesToggle";
