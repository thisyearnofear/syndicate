"use client";

import { memo } from "react";

export type TabType = "lottery" | "transactions" | "dashboard";

interface NavigationTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const NavigationTabs = memo(
  ({ activeTab, onTabChange }: NavigationTabsProps) => (
    <div className="flex justify-center mb-8">
      <div className="bg-gray-800 rounded-lg p-1 border border-gray-700">
        <button
          onClick={() => onTabChange("lottery")}
          className={`px-6 py-3 rounded-md transition-all ${
            activeTab === "lottery"
              ? "bg-blue-600 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          🎯 Play Lottery
        </button>
        <button
          onClick={() => onTabChange("transactions")}
          className={`px-6 py-3 rounded-md transition-all ${
            activeTab === "transactions"
              ? "bg-blue-600 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          📊 My Activity
        </button>
        <button
          onClick={() => onTabChange("dashboard")}
          className={`px-6 py-3 rounded-md transition-all ${
            activeTab === "dashboard"
              ? "bg-blue-600 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          🌉 Cross-Chain
        </button>
      </div>
    </div>
  )
);

NavigationTabs.displayName = "NavigationTabs";
