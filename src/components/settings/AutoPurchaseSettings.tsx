/**
 * AUTO-PURCHASE SETTINGS (AGENT AUTOMATION HUB)
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Replaces simple settings with a comprehensive agent hub
 * - UI/UX: Distinct visual tiers for different levels of autonomy
 * - CLEAN: Centralized management of all automation types
 * - ORGANIZED: Sectioned by agent type with clear action paths
 */

"use client";

import React, { useState, useEffect } from "react";
import { 
  Bot, 
  Zap, 
  Clock, 
  ChevronRight, 
  Plus, 
  Brain,
  Terminal,
  Wallet,
  Coins,
  TrendingUp
} from "lucide-react";
import { Button } from "@/shared/components/ui/Button";
import { AgentRegistryService, AgentStatus, AgentType } from "@/services/automation/agentRegistryService";
import { useUnifiedWallet } from "@/hooks";
import { AutoPurchaseModal } from "@/components/modal/AutoPurchaseModal";

export function AutoPurchaseSettings() {
  const { address, walletType } = useUnifiedWallet();
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedAgentType, setSelectedAgentType] = useState<AgentType | null>(null);

  const registry = AgentRegistryService.getInstance();

  const fetchAgents = async () => {
    if (!address) return;
    setIsLoading(true);
    const userAgents = await registry.getUserAgents(address);
    
    // UI/UX: Sort agents to prioritize those matching the user's wallet type
    const sortedAgents = [...userAgents].sort((a, b) => {
      const aMatches = a.tokenSymbol === (walletType === 'solana' ? 'USD₮' : 'USDC');
      const bMatches = b.tokenSymbol === (walletType === 'solana' ? 'USD₮' : 'USDC');
      return aMatches === bMatches ? 0 : aMatches ? -1 : 1;
    });

    setAgents(sortedAgents);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAgents();
  }, [address]);

  const handleActivateAgent = (type: AgentType) => {
    setSelectedAgentType(type);
    setShowModal(true);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4 animate-pulse">
        <Bot className="w-12 h-12 text-indigo-300" />
        <div className="h-4 w-48 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Bot className="w-6 h-6 text-indigo-600" />
            Syndicate Agent Hub
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Deploy and manage autonomous bots that maximize your prize exposure.
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchAgents}
          className="text-xs"
        >
          Refresh Status
        </Button>
      </div>

      {/* AGENT TIERS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* TIERS: WE WOULD ITERATE THROUGH AGENTS HERE */}
        {agents.map((agent) => (
          <AgentCard 
            key={agent.id} 
            agent={agent} 
            currentWalletType={walletType}
            onManage={() => console.log('Manage', agent.id)} 
          />
        ))}

        {/* EMPTY STATE / SUGGESTED AGENTS */}
        {!agents.some(a => a.type === 'autonomous') && (
          <div className="border-2 border-dashed border-indigo-200 rounded-xl p-6 flex flex-col items-center justify-center text-center space-y-4 bg-indigo-50/30">
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
              <Plus className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Deploy AI Agent</h4>
              <p className="text-xs text-gray-500 max-w-[200px] mx-auto mt-1">
                Deploy an autonomous WDK bot to manage your USD₮ purchases.
              </p>
            </div>
            <Button 
              size="sm" 
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={() => handleActivateAgent('autonomous')}
            >
              Activate "The Voyager"
            </Button>
          </div>
        )}
      </div>

      {/* DISCOVER OPPORTUNITIES */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-amber-500" />
          Discover Diverse Lotteries
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* POOLTOGETHER V5 */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all group">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Coins className="w-6 h-6 text-indigo-600" />
            </div>
            <h4 className="font-bold text-gray-900 text-sm">PoolTogether v5</h4>
            <p className="text-[10px] text-gray-500 mt-1 mb-3">No-loss prize savings. 100% principal protection on Base.</p>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Yield + Prizes</span>
              <Button size="sm" variant="outline" onClick={() => handleActivateAgent('scheduled')}>Explore</Button>
            </div>
          </div>

          {/* PANCAKESWAP */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all group">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6 text-orange-600" />
            </div>
            <h4 className="font-bold text-gray-900 text-sm">PancakeSwap</h4>
            <p className="text-[10px] text-gray-500 mt-1 mb-3">High-frequency lottery with multi-chain jackpots.</p>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">High Volume</span>
              <Button size="sm" variant="outline" onClick={() => handleActivateAgent('scheduled')}>View</Button>
            </div>
          </div>

          {/* NEAR NOMAD */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all group">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6 text-emerald-600" />
            </div>
            <h4 className="font-bold text-gray-900 text-sm">NEAR Nomad</h4>
            <p className="text-[10px] text-gray-500 mt-1 mb-3">Atomic cross-chain purchases via NEAR Chain Signatures.</p>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">MPC Powered</span>
              <Button size="sm" variant="outline" onClick={() => handleActivateAgent('scheduled')}>Activate</Button>
            </div>
          </div>

          {/* STACKS SENTINEL */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all group">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
            <h4 className="font-bold text-gray-900 text-sm">Stacks Sentinel</h4>
            <p className="text-[10px] text-gray-500 mt-1 mb-3">Bitcoin-secured automation using SIP-018 signatures.</p>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">BTC Security</span>
              <Button size="sm" variant="outline" onClick={() => handleActivateAgent('scheduled')}>Deploy</Button>
            </div>
          </div>
          </div>
          </div>


      {/* AI REASONING TERMINAL (Only if AI agent active) */}
      {agents.some(a => a.type === 'autonomous' && a.isEnabled) && (
        <div className="bg-slate-900 rounded-xl overflow-hidden shadow-xl border border-slate-800">
          <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-mono text-slate-300">Syndicate-Agent-v1.0.4-Reasoning-Log</span>
            </div>
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-slate-600"></div>
              <div className="w-2 h-2 rounded-full bg-slate-600"></div>
              <div className="w-2 h-2 rounded-full bg-slate-600"></div>
            </div>
          </div>
          <div className="p-4 font-mono text-sm space-y-2">
            <div className="flex gap-2 text-slate-500">
              <span>[2026-03-21 14:02:11]</span>
              <span className="text-blue-400">INFO</span>
              <span>Analyzing market conditions on Base...</span>
            </div>
            <div className="flex gap-2 text-slate-500">
              <span>[2026-03-21 14:02:12]</span>
              <span className="text-purple-400">YIELD</span>
              <span>Spark Protocol: 4.0% APY (Sky Savings Rate)</span>
            </div>
            <div className="flex gap-2 text-slate-500">
              <span>[2026-03-21 14:02:13]</span>
              <span className="text-emerald-400">AGENT</span>
              <span className="text-slate-100">Decision: Opportunistic purchase window open. Buy amount: 5 USD₮.</span>
            </div>
            <div className="animate-pulse flex gap-2">
              <span className="text-slate-500">_</span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL */}
      <AutoPurchaseModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        onSuccess={() => {
          setShowModal(false);
          fetchAgents();
        }}
      />
    </div>
  );
}

function AgentCard({ agent, onManage, currentWalletType }: { agent: AgentStatus; onManage: () => void; currentWalletType: string | null }) {
  const isAI = agent.type === 'autonomous';
  const matchesWallet = (agent.chainName === 'Base' && (currentWalletType === 'evm' || !currentWalletType)) ||
                        (agent.chainName === 'Solana' && currentWalletType === 'solana') ||
                        (agent.chainName === 'Stacks' && currentWalletType === 'stacks') ||
                        (agent.chainName === 'NEAR' && currentWalletType === 'near');
  
  return (
    <div className={`relative overflow-hidden rounded-xl border-2 p-5 transition-all ${
      agent.isEnabled 
        ? (isAI ? 'border-indigo-500 bg-indigo-50/10 shadow-indigo-100' : 'border-blue-500 bg-blue-50/10')
        : (matchesWallet ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 opacity-60')
    }`}>
      {/* GLOW EFFECT FOR AI */}
      {isAI && agent.isEnabled && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
      )}

      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isAI ? 'bg-indigo-600 text-white' : 'bg-blue-600 text-white'
          }`}>
            {isAI ? <Brain className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900">{agent.name}</h3>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                agent.chainName === 'Base' ? 'bg-blue-100 text-blue-700' :
                agent.chainName === 'Solana' ? 'bg-purple-100 text-purple-700' :
                agent.chainName === 'Stacks' ? 'bg-orange-100 text-orange-700' :
                'bg-emerald-100 text-emerald-700'
              }`}>
                {agent.chainName}
              </span>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
              {isAI ? 'Tether WDK / Autonomous' : 'ERC-7715 / Scheduled'}
            </span>
          </div>
        </div>
        <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
          agent.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'
        }`}>
          {agent.status}
        </div>
      </div>

      <p className="text-xs text-gray-600 mb-6 leading-relaxed">
        {agent.description}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white/50 rounded-lg p-2 border border-gray-200/50 shadow-sm">
          <div className="flex items-center gap-1.5 text-gray-500 mb-1">
            <Coins className="w-3 h-3" />
            <span className="text-[10px] font-semibold uppercase">Balance</span>
          </div>
          <p className="text-sm font-bold text-gray-900">
            {agent.balance ? `$${Number(agent.balance) / 10**6}` : '---'} {agent.tokenSymbol}
          </p>
        </div>
        <div className="bg-white/50 rounded-lg p-2 border border-gray-200/50 shadow-sm">
          <div className="flex items-center gap-1.5 text-gray-500 mb-1">
            <Zap className="w-3 h-3" />
            <span className="text-[10px] font-semibold uppercase">Strategy</span>
          </div>
          <p className="text-sm font-bold text-gray-900 capitalize">{agent.frequency}</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="flex items-center gap-2">
          {isAI && agent.isEnabled && (
            <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold animate-pulse">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
              <span>Agent Online</span>
            </div>
          )}
          {!matchesWallet && !agent.isEnabled && (
            <span className="text-[9px] text-amber-600 font-medium italic">Requires {agent.chainName} wallet</span>
          )}
        </div>
        <button 
          onClick={onManage}
          className={`text-xs font-bold flex items-center gap-1 hover:gap-2 transition-all ${
            agent.isEnabled ? 'text-gray-900' : 'text-indigo-600'
          }`}
        >
          {agent.isEnabled ? 'Modify Settings' : 'Deploy Now'}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
