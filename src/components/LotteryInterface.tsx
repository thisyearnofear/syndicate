"use client";
import { useState } from "react";
import { SUPPORTED_CHAINS } from "@/config";

interface LotteryTicket {
  id: string;
  numbers: number[];
  cost: string;
  chain: string;
}

interface Syndicate {
  id: string;
  name: string;
  members: number;
  cause: string;
  causePercentage: number;
  totalTickets: number;
  yourContribution: string;
}

export default function LotteryInterface() {
  const [selectedChain, setSelectedChain] = useState("base");
  const [ticketCount, setTicketCount] = useState(1);
  const [selectedSyndicate, setSelectedSyndicate] = useState<string | null>(null);
  const [isCreatingSyndicate, setIsCreatingSyndicate] = useState(false);

  // Mock data for demonstration
  const availableSyndicates: Syndicate[] = [
    {
      id: "ocean-cleanup",
      name: "Ocean Cleanup Collective",
      members: 47,
      cause: "Ocean Cleanup",
      causePercentage: 25,
      totalTickets: 156,
      yourContribution: "0.05 ETH"
    },
    {
      id: "food-aid",
      name: "Global Food Aid",
      members: 23,
      cause: "Food Security",
      causePercentage: 20,
      totalTickets: 89,
      yourContribution: "0.03 ETH"
    }
  ];

  const ticketPrice = 0.01; // ETH per ticket

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Chain Selection */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-4">Select Your Chain</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(SUPPORTED_CHAINS).map(([key, chain]) => (
            <button
              key={key}
              onClick={() => setSelectedChain(key)}
              className={`p-4 rounded-lg border transition-all ${
                selectedChain === key
                  ? "border-blue-500 bg-blue-500/20 text-blue-300"
                  : "border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500"
              }`}
            >
              <div className="font-semibold">{chain.name}</div>
              <div className="text-sm opacity-75">Native Purchase</div>
            </button>
          ))}
        </div>
        <p className="text-gray-400 text-sm mt-3">
          Purchase Megapot tickets on Base from any supported chain using NEAR chain signatures
        </p>
      </div>

      {/* Syndicate Selection */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Join a Syndicate</h2>
          <button
            onClick={() => setIsCreatingSyndicate(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            Create New
          </button>
        </div>
        
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          {availableSyndicates.map((syndicate) => (
            <div
              key={syndicate.id}
              onClick={() => setSelectedSyndicate(syndicate.id)}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${
                selectedSyndicate === syndicate.id
                  ? "border-green-500 bg-green-500/20"
                  : "border-gray-600 bg-gray-700/50 hover:border-gray-500"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-white">{syndicate.name}</h3>
                <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                  {syndicate.members} members
                </span>
              </div>
              <div className="space-y-1 text-sm text-gray-300">
                <div>Cause: <span className="text-green-400">{syndicate.cause}</span></div>
                <div>Cause allocation: <span className="text-yellow-400">{syndicate.causePercentage}%</span></div>
                <div>Total tickets: <span className="text-blue-400">{syndicate.totalTickets}</span></div>
              </div>
            </div>
          ))}
        </div>

        <button
          className="w-full p-3 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-gray-500 hover:text-gray-300 transition-colors"
          onClick={() => setSelectedSyndicate("solo")}
        >
          Or play solo (no syndicate)
        </button>
      </div>

      {/* Ticket Purchase */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-4">Purchase Tickets</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Number of Tickets
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={ticketCount}
                onChange={(e) => setTicketCount(parseInt(e.target.value) || 1)}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            
            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-300">Ticket Price:</span>
                <span className="text-white">{ticketPrice} ETH each</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-300">Total Cost:</span>
                <span className="text-white">{(ticketPrice * ticketCount).toFixed(3)} ETH</span>
              </div>
              {selectedSyndicate && selectedSyndicate !== "solo" && (
                <div className="flex justify-between text-sm border-t border-gray-600 pt-2">
                  <span className="text-gray-300">Cause Allocation:</span>
                  <span className="text-green-400">
                    {availableSyndicates.find(s => s.id === selectedSyndicate)?.causePercentage}% of winnings
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
              <h3 className="font-semibold text-blue-300 mb-2">Cross-Chain Purchase</h3>
              <p className="text-blue-200 text-sm">
                Your {SUPPORTED_CHAINS[selectedChain as keyof typeof SUPPORTED_CHAINS].name} wallet will sign a transaction 
                that automatically purchases Megapot tickets on Base using NEAR chain signatures.
              </p>
            </div>

            <button
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-lg transition-all transform hover:scale-105"
              disabled={!selectedChain}
            >
              Purchase {ticketCount} Ticket{ticketCount > 1 ? 's' : ''} 
              {selectedSyndicate && selectedSyndicate !== "solo" && (
                <span className="block text-sm opacity-90">
                  via {availableSyndicates.find(s => s.id === selectedSyndicate)?.name}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-4">Recent Activity</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
            <div>
              <div className="text-white font-medium">Ocean Cleanup Collective purchased 12 tickets</div>
              <div className="text-gray-400 text-sm">2 minutes ago • Base Chain</div>
            </div>
            <div className="text-green-400 font-semibold">+12 🎫</div>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
            <div>
              <div className="text-white font-medium">You joined Global Food Aid syndicate</div>
              <div className="text-gray-400 text-sm">5 minutes ago</div>
            </div>
            <div className="text-blue-400 font-semibold">Joined</div>
          </div>
        </div>
      </div>
    </div>
  );
}
