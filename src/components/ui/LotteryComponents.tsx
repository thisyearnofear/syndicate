"use client";

import { memo } from "react";
import ConnectWallet from "@/components/wallet/ConnectWallet";

export const IndividualTicketSection = memo(() => (
  <div className="max-w-md mx-auto">
    <div className="bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-xl p-6 border border-purple-500/20 backdrop-blur-sm">
      <div className="text-center mb-4">
        <h3 className="text-xl font-bold text-white mb-2">
          🎫 Individual Tickets
        </h3>
        <p className="text-gray-300 text-sm">
          Quick entry - buy tickets directly on any supported chain
        </p>
      </div>
      <ConnectWallet />
    </div>
  </div>
));

IndividualTicketSection.displayName = "IndividualTicketSection";

interface SyndicateCreationSectionProps {
  onCreateSyndicate: () => void;
}

export const SyndicateCreationSection = memo(
  ({ onCreateSyndicate }: SyndicateCreationSectionProps) => (
    <div className="max-w-4xl mx-auto">
      <div className="bg-gradient-to-br from-blue-900/50 to-green-900/50 rounded-xl p-6 border border-blue-500/20 backdrop-blur-sm">
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-white mb-2">
            👥 Create Syndicate
          </h3>
          <p className="text-gray-300 text-sm">
            Pool resources with friends for better odds and shared winnings
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600">
            <h4 className="text-white font-semibold mb-2">🎯 Better Odds</h4>
            <p className="text-gray-400 text-sm">
              Buy more tickets collectively than you could alone
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600">
            <h4 className="text-white font-semibold mb-2">🤝 Social Impact</h4>
            <p className="text-gray-400 text-sm">
              Support causes together with your community
            </p>
          </div>
        </div>

        <div className="text-center mt-6">
          <button
            onClick={onCreateSyndicate}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Create New Syndicate
          </button>
        </div>
      </div>
    </div>
  )
);

SyndicateCreationSection.displayName = "SyndicateCreationSection";
