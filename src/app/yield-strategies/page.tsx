"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/shared/components/ui/Button";
import { 
  TrendingUp, 
  Shield, 
  Heart, 
  Trophy, 
  ArrowLeft,
  Zap,
  Check,
  ExternalLink,
  Loader
} from "lucide-react";
import { CompactCard, CompactStack, CompactContainer, CompactSection } from '@/shared/components/premium/CompactLayout';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { useVaultDeposit } from '@/hooks/useVaultDeposit';
import WalletConnectionManager from '@/components/wallet/WalletConnectionManager';

import { ImprovedYieldStrategySelector } from '@/components/yield/ImprovedYieldStrategySelector';
import { YieldAllocationControl } from '@/components/yield/YieldAllocationControl';
import { YieldDashboard } from '@/components/yield/YieldDashboard';
import { CivicGateProvider } from '@/components/civic/CivicGateProvider';
import { CivicVerificationGate } from '@/components/civic/CivicVerificationGate';
import { getRequiredKycTier, getComplianceRationale } from '@/utils/kycTiers';
import { yieldToTicketsService } from '@/services/yieldToTicketsService';
import type { VaultProtocol } from '@/services/vaults';
import Link from "next/link";

const ALLOCATION_STORAGE_KEY = 'vault_yield_allocation';

function YieldStrategiesContent() {
  const { address } = useWalletConnection();
  const { isDepositing, status, txHash, error: depositError, deposit, reset } = useVaultDeposit();
  const searchParams = useSearchParams();
  const protocolParam = searchParams?.get('protocol');
  
  const [activeTab, setActiveTab] = useState<'overview' | 'strategies' | 'allocation'>('strategies');
  const [selectedStrategy, setSelectedStrategy] = useState<VaultProtocol | 'uniswap' | 'octant' | 'pooltogether' | null>(null);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [yieldToTickets, setYieldToTickets] = useState(85);
  const [yieldToCauses, setYieldToCauses] = useState(15);
  const [depositSuccess, setDepositSuccess] = useState(false);

  // Load persisted allocation from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(ALLOCATION_STORAGE_KEY);
      if (saved) {
        const { tickets, causes } = JSON.parse(saved);
        setYieldToTickets(tickets);
        setYieldToCauses(causes);
      }
    } catch {}
  }, []);

  // Persist allocation changes to localStorage + yieldToTicketsService
  const handleAllocationChange = useCallback((tickets: number, causes: number) => {
    setYieldToTickets(tickets);
    setYieldToCauses(causes);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(ALLOCATION_STORAGE_KEY, JSON.stringify({ tickets, causes }));
      } catch {}
    }
    // Update active strategy if one is selected
    if (address && selectedStrategy && (selectedStrategy === 'drift' || selectedStrategy === 'aave')) {
      yieldToTicketsService.setupAutoYieldStrategy(address, {
        vaultProtocol: selectedStrategy,
        userAddress: address,
        ticketsAllocation: tickets,
        causesAllocation: causes,
        causeWallet: '0x0000000000000000000000000000000000000000',
        ticketPrice: '1',
      });
    }
  }, [address, selectedStrategy]);

  // Pre-select strategy based on URL parameter
  useEffect(() => {
    if (protocolParam === 'pooltogether') {
      setSelectedStrategy('pooltogether');
      setActiveTab('strategies');
    } else if (protocolParam === 'drift') {
      setSelectedStrategy('drift');
      setActiveTab('strategies');
    }
  }, [protocolParam]);

  // Handle deposit - now supports all vault protocols
  const handleDeposit = async () => {
    if (!selectedStrategy || depositAmount <= 0) return;
    // Support all vault protocols (drift, aave, morpho, pooltogether)
    const vaultProtocols: VaultProtocol[] = ['drift', 'aave', 'morpho', 'pooltogether'];
    if (!vaultProtocols.includes(selectedStrategy as VaultProtocol)) return;

    setDepositSuccess(false);
    const result = await deposit(selectedStrategy as VaultProtocol, depositAmount.toString());
    if (result.success) {
      setDepositSuccess(true);
    }
  };

  // Reset deposit state when amount or strategy changes
  useEffect(() => {
    reset();
    setDepositSuccess(false);
  }, [depositAmount, selectedStrategy, reset]);

  const getDepositStatusLabel = () => {
    switch (status) {
      case 'building_tx': return 'Building transaction...';
      case 'checking_allowance': return 'Checking USDC allowance...';
      case 'approving': return 'Approving USDC spending...';
      case 'depositing': return 'Depositing to vault...';
      case 'signing': return 'Sign in your wallet...';
      case 'confirming': return 'Confirming on-chain...';
      case 'complete': return 'Deposit complete!';
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4">
      <CompactContainer maxWidth="2xl">
        <CompactSection spacing="lg">
          {/* Header */}
          <div className="mb-8">
            <Link href="/">
              <Button 
                variant="ghost" 
                className="mb-4 text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500/20 to-teal-500/20 px-4 py-2 rounded-full border border-green-500/30 mb-4">
                <Zap className="w-4 h-4 text-green-400" />
                <span className="text-sm font-semibold text-green-300">YIELD STRATEGIES</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-blue-400 via-purple-500 to-pink-400 bg-clip-text text-transparent mb-4">
                Capital Preservation + Dual Impact
              </h1>
              
              <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
                Leverage yield-bearing strategies while simultaneously supporting public goods and 
                amplifying your lottery participation. Your capital is preserved while generating 
                dual benefits: consistent cause funding and potential lottery wins.
              </p>
              
              {/* Wallet Connection Status */}
              <div className="flex justify-center mt-6">
                <WalletConnectionManager />
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            <Button
              variant={activeTab === 'overview' ? 'default' : 'outline'}
              className={`border-blue-500/50 ${activeTab === 'overview' ? 'bg-blue-500/20' : 'text-blue-300 hover:bg-blue-500/10'}`}
              onClick={() => setActiveTab('overview')}
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Overview
            </Button>
            <Button
              variant={activeTab === 'strategies' ? 'default' : 'outline'}
              className={`border-purple-500/50 ${activeTab === 'strategies' ? 'bg-purple-500/20' : 'text-purple-300 hover:bg-purple-500/10'}`}
              onClick={() => setActiveTab('strategies')}
            >
              <Shield className="w-4 h-4 mr-2" />
              Strategies
            </Button>
            <Button
              variant={activeTab === 'allocation' ? 'default' : 'outline'}
              className={`border-green-500/50 ${activeTab === 'allocation' ? 'bg-green-500/20' : 'text-green-300 hover:bg-green-500/10'}`}
              onClick={() => setActiveTab('allocation')}
            >
              <Heart className="w-4 h-4 mr-2" />
              Allocation
            </Button>
          </div>

          {/* Tab Content */}
          <div className="w-full">
            {activeTab === 'overview' && (
              <YieldDashboard />
            )}
            
            {activeTab === 'strategies' && (
              <CivicGateProvider depositAmount={depositAmount}>
                <CompactStack spacing="lg">
                  <ImprovedYieldStrategySelector 
                    selectedStrategy={selectedStrategy} 
                    onStrategySelect={(strategy) => setSelectedStrategy(strategy || null)}
                    ticketsAllocation={yieldToTickets}
                    causesAllocation={yieldToCauses}
                    onAllocationChange={handleAllocationChange}
                    userAddress={address || undefined}
                  />
                  
                  {selectedStrategy && (
                    <>
                      {/* Deposit Amount Input — drives tiered KYC */}
                      <CompactCard variant="premium" padding="lg">
                        <label className="block text-sm font-semibold text-gray-300 mb-2">
                          Deposit Amount (USDC)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={100}
                          value={depositAmount || ''}
                          onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
                          placeholder="Enter amount to deposit"
                          className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-lg"
                        />

                        {/* Dynamic tier indicator */}
                        {depositAmount > 0 && (
                          <div className="mt-3 flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                              depositAmount >= 10_000
                                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                : depositAmount >= 1_000
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-green-500/20 text-green-300 border border-green-500/30'
                            }`}>
                              <Shield className="w-3.5 h-3.5" />
                              {getRequiredKycTier(depositAmount).label}
                            </span>
                            <span className="text-xs text-gray-400">
                              {getComplianceRationale(depositAmount)}
                            </span>
                          </div>
                        )}
                      </CompactCard>

                      {/* Use compact mode for small deposits - less intimidating */}
                      <CivicVerificationGate
                        message={depositAmount < 1000 
                          ? "Quick anti-bot check needed. Takes 30 seconds."
                          : "Identity verification required for larger deposits."}
                        depositAmount={depositAmount}
                        compact={depositAmount < 1000}
                      >
                        {/* Strategy detail + Deposit action (shown after KYC pass) */}
                        <CompactCard variant="premium" padding="lg">
                          <div className="flex items-start gap-4">
                            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                              <Shield className="w-8 h-8 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-xl font-bold text-white">
                                  {selectedStrategy.toUpperCase()} Strategy
                                </h3>
                                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Verified
                                </span>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div className="glass-premium p-4 rounded-lg border border-white/10">
                                  <p className="text-sm text-gray-400 mb-1">Risk Level</p>
                                  <p className="font-bold text-white">
                                    {selectedStrategy === 'drift' ? 'Medium (Hedged)' : 'Low to Medium'}
                                  </p>
                                </div>
                                <div className="glass-premium p-4 rounded-lg border border-white/10">
                                  <p className="text-sm text-gray-400 mb-1">Current APY</p>
                                  <p className="font-bold text-green-400">
                                    {selectedStrategy === 'drift' ? '~22.5%' : 
                                     selectedStrategy === 'morpho' ? '~6.7%' :
                                     selectedStrategy === 'pooltogether' ? '~3.5%' :
                                     selectedStrategy === 'aave' ? '~4.5%' : 'Variable'}
                                  </p>
                                </div>
                                <div className="glass-premium p-4 rounded-lg border border-white/10">
                                  <p className="text-sm text-gray-400 mb-1">Allocation</p>
                                  <p className="font-bold text-white">
                                    {yieldToTickets}% tickets / {yieldToCauses}% causes
                                  </p>
                                </div>
                              </div>

                              {/* Deposit Button + Status */}
                              {depositSuccess && txHash ? (
                                <div className="p-5 rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-500/10 border border-green-500/30">
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                      <Check className="w-6 h-6 text-green-400" />
                                    </div>
                                    <div>
                                      <p className="font-bold text-green-300">Deposit Successful!</p>
                                      <p className="text-xs text-green-200/70">Your funds are now earning yield</p>
                                    </div>
                                  </div>
                                  <div className="flex gap-3 mt-4">
                                    <a
                                      href={`https://basescan.org/tx/${txHash}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex-1 text-center text-xs text-green-400 hover:text-green-300 underline py-2 border border-green-500/30 rounded-lg"
                                    >
                                      View TX <ExternalLink className="w-3 h-3 inline ml-1" />
                                    </a>
                                    <Link 
                                      href="/yield-strategies"
                                      className="flex-1 text-center text-xs text-blue-400 hover:text-blue-300 underline py-2 border border-blue-500/30 rounded-lg"
                                    >
                                      View Dashboard →
                                    </Link>
                                  </div>
                                </div>
                              ) : depositError ? (
                                <div className="space-y-3">
                                  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                                    <p className="text-sm text-red-300">{depositError}</p>
                                  </div>
                                  <Button
                                    onClick={handleDeposit}
                                    disabled={!depositAmount || depositAmount <= 0 || isDepositing}
                                    className="w-full"
                                    variant="default"
                                  >
                                    Retry Deposit
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  onClick={handleDeposit}
                                  disabled={!depositAmount || depositAmount <= 0 || isDepositing}
                                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                                  variant="default"
                                >
                                  {isDepositing ? (
                                    <span className="flex items-center gap-2">
                                      <Loader className="w-4 h-4 animate-spin" />
                                      {getDepositStatusLabel()}
                                    </span>
                                  ) : (
                                    `Deposit ${depositAmount > 0 ? `${depositAmount.toLocaleString()} USDC` : ''} into ${selectedStrategy.toUpperCase()}`
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        </CompactCard>
                      </CivicVerificationGate>
                    </>
                  )}
                </CompactStack>
              </CivicGateProvider>
            )}
            
            {activeTab === 'allocation' && (
              <CompactStack spacing="lg">
                <YieldAllocationControl
                  ticketsAllocation={yieldToTickets}
                  causesAllocation={yieldToCauses}
                  onAllocationChange={handleAllocationChange}
                />
                
                <CompactCard variant="premium" padding="lg">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    How It Works
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        1
                      </div>
                      <div>
                        <h4 className="font-bold text-white">Deposit Into Vaults</h4>
                        <p className="text-gray-400">
                          Transfer USDC into premium delta-neutral or lending vaults (like Drift JLP or Aave).
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        2
                      </div>
                      <div>
                        <h4 className="font-bold text-white">Generate Yield</h4>
                        <p className="text-gray-400">
                          Your capital earns yield through selected DeFi strategies
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        3
                      </div>
                      <div>
                        <h4 className="font-bold text-white">Auto-Route Yield</h4>
                        <p className="text-gray-400">
                          Our smart orchestrator sweeps your yield to buy lottery tickets automatically. Principal stays locked and safe.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500 to-orange-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        4
                      </div>
                      <div>
                        <h4 className="font-bold text-white">Maximize Impact</h4>
                        <p className="text-gray-400">
                          Reap both amplified lottery participation and consistent cause support
                        </p>
                      </div>
                    </div>
                  </div>
                </CompactCard>
              </CompactStack>
            )}
          </div>
        </CompactSection>
      </CompactContainer>
    </div>
  );
}

export default function YieldStrategiesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    }>
      <YieldStrategiesContent />
    </Suspense>
  );
}
