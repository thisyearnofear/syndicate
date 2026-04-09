"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { useUnifiedWallet } from '@/hooks';
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
import { getStrategyById, type SupportedYieldStrategyId } from '@/config/yieldStrategies';
import { persistVaultDepositActivityRecord } from '@/services/activity/activityClient';
import { updateBridgeActivity } from '@/utils/bridgeStateManager';
import { createVaultActivityId, recordVaultDepositActivity } from '@/utils/vaultActivityManager';
import {
  VAULTS_ROUTE,
  YIELD_ENTRY_BRIDGE,
  YIELD_ENTRY_PARAM,
  hasYieldExecutionIntent,
} from '@/constants/vaultRouting';
import Link from "next/link";

const ALLOCATION_STORAGE_KEY = 'vault_yield_allocation';
const DIRECT_DEPOSIT_STRATEGIES: VaultProtocol[] = ['drift', 'aave', 'morpho', 'pooltogether'];

function YieldStrategiesContent() {
  const router = useRouter();
  const { address } = useUnifiedWallet();
  const { isDepositing, status, txHash, error: depositError, deposit, reset } = useVaultDeposit();
  const searchParams = useSearchParams();
  const protocolParam = searchParams?.get('protocol');
  const strategyParam = searchParams?.get('strategy');
  const tabParam = searchParams?.get('tab');
  const entryParam = searchParams?.get(YIELD_ENTRY_PARAM);
  const amountParam = searchParams?.get('amount');
  const sourceChainParam = searchParams?.get('sourceChain');
  const bridgeActivityIdParam = searchParams?.get('bridgeActivityId');
  const hasExecutionIntent = hasYieldExecutionIntent(searchParams);
  const isBridgeEntry = entryParam === YIELD_ENTRY_BRIDGE;
  
  const [activeTab, setActiveTab] = useState<'overview' | 'strategies' | 'allocation'>('strategies');
  const [selectedStrategy, setSelectedStrategy] = useState<SupportedYieldStrategyId | null>(null);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [yieldToTickets, setYieldToTickets] = useState(85);
  const [yieldToCauses, setYieldToCauses] = useState(15);
  const [depositSuccess, setDepositSuccess] = useState(false);
  const selectedStrategyConfig = selectedStrategy ? getStrategyById(selectedStrategy) : undefined;
  const canDepositIntoSelectedStrategy = Boolean(
    selectedStrategy && DIRECT_DEPOSIT_STRATEGIES.includes(selectedStrategy as VaultProtocol)
  );

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

  // Redirect first-time marketing traffic to the canonical /vaults experience.
  useEffect(() => {
    if (!hasExecutionIntent) {
      router.replace(VAULTS_ROUTE);
    }
  }, [hasExecutionIntent, router]);

  // Pre-select tab and strategy based on URL parameters
  useEffect(() => {
    if (tabParam === 'overview' || tabParam === 'strategies' || tabParam === 'allocation') {
      setActiveTab(tabParam);
    }

    const targetStrategy = strategyParam ?? protocolParam;

    if (targetStrategy === 'pooltogether') {
      setSelectedStrategy('pooltogether');
      setActiveTab(isBridgeEntry ? 'allocation' : 'strategies');
    } else if (targetStrategy === 'drift') {
      setSelectedStrategy('drift');
      setActiveTab(isBridgeEntry ? 'allocation' : 'strategies');
    } else if (targetStrategy === 'aave') {
      setSelectedStrategy('aave');
      setActiveTab(isBridgeEntry ? 'allocation' : 'strategies');
    } else if (targetStrategy === 'morpho') {
      setSelectedStrategy('morpho');
      setActiveTab(isBridgeEntry ? 'allocation' : 'strategies');
    }
  }, [isBridgeEntry, strategyParam, protocolParam, tabParam]);

  useEffect(() => {
    if (!amountParam) return;

    const parsedAmount = Number(amountParam);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return;

    setDepositAmount((current) => (current > 0 ? current : parsedAmount));
  }, [amountParam]);

  // Handle deposit - now supports all vault protocols
  const handleDeposit = useCallback(async () => {
    if (!selectedStrategy || depositAmount <= 0) return;
    // Support all vault protocols (drift, aave, morpho, pooltogether)
    const vaultProtocols: VaultProtocol[] = ['drift', 'aave', 'morpho', 'pooltogether'];
    if (!vaultProtocols.includes(selectedStrategy as VaultProtocol)) return;

    setDepositSuccess(false);
    const result = await deposit(selectedStrategy as VaultProtocol, depositAmount.toString());
    if (result.success) {
      if (address && result.txHash) {
        const depositRecord = {
          id: createVaultActivityId(),
          walletAddress: address,
          protocol: selectedStrategy as VaultProtocol,
          amount: depositAmount.toString(),
          txHash: result.txHash,
          timestamp: Date.now(),
          bridgeActivityId: bridgeActivityIdParam || undefined,
        };
        recordVaultDepositActivity(depositRecord);
        void persistVaultDepositActivityRecord(depositRecord).catch((error) => {
          console.warn('[YieldStrategies] Failed to persist vault deposit activity:', error);
        });
      }
      if (bridgeActivityIdParam && result.txHash) {
        updateBridgeActivity(bridgeActivityIdParam, {
          linkedVaultProtocol: selectedStrategy,
          linkedDepositTxHash: result.txHash,
        });
      }
      setDepositSuccess(true);
    }
  }, [address, bridgeActivityIdParam, deposit, depositAmount, selectedStrategy]);

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

  const renderStrategyExecution = (showAllocationControl: boolean) => (
    <CompactStack spacing="lg">
      {showAllocationControl ? (
        <YieldAllocationControl
          ticketsAllocation={yieldToTickets}
          causesAllocation={yieldToCauses}
          onAllocationChange={handleAllocationChange}
        />
      ) : null}

      <ImprovedYieldStrategySelector 
        selectedStrategy={selectedStrategy} 
        onStrategySelect={(strategy) => setSelectedStrategy(strategy || null)}
        ticketsAllocation={yieldToTickets}
        causesAllocation={yieldToCauses}
        onAllocationChange={handleAllocationChange}
        userAddress={address || undefined}
      />
      
      {selectedStrategy ? (
        <>
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

            {depositAmount > 0 ? (
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
            ) : null}
          </CompactCard>

          <CivicVerificationGate
            message={depositAmount < 1000 
              ? "Quick anti-bot check needed. Takes 30 seconds."
              : "Identity verification required for larger deposits."}
            depositAmount={depositAmount}
            compact={depositAmount < 1000}
          >
            <CompactCard variant="premium" padding="lg">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-bold text-white">
                      {selectedStrategyConfig?.name ?? `${selectedStrategy.toUpperCase()} Strategy`}
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
                        selectedStrategy === 'aave' ? '~4.5%' :
                        selectedStrategy === 'octant' ? '~10%' :
                        selectedStrategy === 'uniswap' ? '~8.5%' : 'Variable'}
                      </p>
                    </div>
                    <div className="glass-premium p-4 rounded-lg border border-white/10">
                      <p className="text-sm text-gray-400 mb-1">Allocation</p>
                      <p className="font-bold text-white">
                        {yieldToTickets}% tickets / {yieldToCauses}% causes
                      </p>
                    </div>
                  </div>

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
                          href="/vaults"
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
                        disabled={!depositAmount || depositAmount <= 0 || isDepositing || !canDepositIntoSelectedStrategy}
                        className="w-full"
                        variant="default"
                      >
                        Retry Deposit
                      </Button>
                    </div>
                  ) : canDepositIntoSelectedStrategy ? (
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
                        `Deposit ${depositAmount > 0 ? `${depositAmount.toLocaleString()} USDC` : ''} into ${selectedStrategyConfig?.name ?? selectedStrategy.toUpperCase()}`
                      )}
                    </Button>
                  ) : (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                      <p className="text-sm text-amber-200">
                        {selectedStrategyConfig?.name ?? 'This strategy'} is not yet available for direct deposit from this flow.
                        Choose Aave, Morpho, PoolTogether, or Drift to complete the current execution path.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CompactCard>
          </CivicVerificationGate>
        </>
      ) : null}
    </CompactStack>
  );

  if (!hasExecutionIntent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-white"></div>
          <p className="text-sm text-gray-300">Redirecting to Vaults...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4">
      <CompactContainer maxWidth="2xl">
        <CompactSection spacing="lg">
          {/* Header */}
          <div className="mb-8">
            <Link href={VAULTS_ROUTE}>
              <Button 
                variant="ghost" 
                className="mb-4 text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Vaults
              </Button>
            </Link>
            
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500/20 to-teal-500/20 px-4 py-2 rounded-full border border-green-500/30 mb-4">
                <Zap className="w-4 h-4 text-green-400" />
                <span className="text-sm font-semibold text-green-300">ALLOCATION FLOW</span>
              </div>

              <div className="mb-4">
                <Link href={VAULTS_ROUTE}>
                  <Button
                    variant="outline"
                    className="border-emerald-500/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
                  >
                    Back To Vaults
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              
              <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-blue-400 via-purple-500 to-pink-400 bg-clip-text text-transparent mb-4">
                Choose Strategy, Allocation, And Deposit
              </h1>
              
              <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
                This is the execution step after vault discovery. Compare the available strategies,
                set how yield should be allocated, and complete the deposit flow without leaving
                the product path.
              </p>

              {isBridgeEntry ? (
                <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-blue-500/30 bg-blue-500/10 px-5 py-4 text-left">
                  <p className="text-sm font-semibold text-blue-200">
                    Funding received from {sourceChainParam || 'bridge flow'}
                  </p>
                  <p className="mt-1 text-sm text-blue-100/80">
                    Your bridged capital is ready for allocation.
                    {amountParam ? ` ${amountParam} USDC has been carried into this step so you can finish the deposit flow immediately.` : ''}
                    {selectedStrategyConfig ? ` The destination strategy is preselected as ${selectedStrategyConfig.name}.` : ''}
                  </p>
                </div>
              ) : null}
              
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
                {renderStrategyExecution(false)}
              </CivicGateProvider>
            )}
            
            {activeTab === 'allocation' && (
              <CivicGateProvider depositAmount={depositAmount}>
                <CompactStack spacing="lg">
                  {renderStrategyExecution(true)}

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
              </CivicGateProvider>
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
