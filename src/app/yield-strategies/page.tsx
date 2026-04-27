"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Globe,
  Info,
  Layers,
  Loader,
  Shield,
  Wallet,
  Zap,
} from "lucide-react";
import { Button } from "@/shared/components/ui/Button";
import {
  CompactCard,
  CompactContainer,
  CompactSection,
  CompactStack,
} from "@/shared/components/premium/CompactLayout";
import { useUnifiedWallet } from "@/hooks";
import { useVaultDeposit } from "@/hooks/useVaultDeposit";
import { useBalance } from "wagmi";
import { base } from "wagmi/chains";
import { ImprovedYieldStrategySelector } from "@/components/yield/ImprovedYieldStrategySelector";
import { YieldAllocationControl } from "@/components/yield/YieldAllocationControl";
import { LifiEarnVaultSelector } from "@/components/yield/LifiEarnVaultSelector";
import { yieldToTicketsService } from "@/services/yieldToTicketsService";
import type { VaultProtocol } from "@/services/vaults";
import {
  getStrategyById,
  type SupportedYieldStrategyId,
} from "@/config/yieldStrategies";
import { getWalletRouting } from "@/domains/wallet/types";
import { persistVaultDepositActivityRecord } from "@/services/activity/activityClient";
import { updateBridgeActivity } from "@/utils/bridgeStateManager";
import {
  createVaultActivityId,
  recordVaultDepositActivity,
} from "@/utils/vaultActivityManager";
import {
  VAULTS_ROUTE,
  YIELD_ENTRY_BRIDGE,
  YIELD_ENTRY_PARAM,
  hasYieldExecutionIntent,
} from "@/constants/vaultRouting";

const ALLOCATION_STORAGE_KEY = "vault_yield_allocation";
const DIRECT_DEPOSIT_STRATEGIES = [
  "aave",
  "morpho",
  "spark",
  "pooltogether",
] as const;

type FlowStep = 1 | 2 | 3;

const FLOW_STEPS: Array<{
  id: FlowStep;
  title: string;
  eyebrow: string;
}> = [
  { id: 1, title: "Choose strategy", eyebrow: "Step 1" },
  { id: 2, title: "Set allocation", eyebrow: "Step 2" },
  { id: 3, title: "Deposit", eyebrow: "Step 3" },
];

function getInitialFlowStep(
  tabParam: string | null,
  isBridgeEntry: boolean,
  targetStrategy: string | null
): FlowStep {
  if (tabParam === "allocation") return 2;
  if (isBridgeEntry && targetStrategy) return 2;
  // Auto-advance past strategy selection when pre-selected from card click
  if (targetStrategy) return 2;
  return 1;
}

function getStrategyApyLabel(strategy: SupportedYieldStrategyId | null): string {
  switch (strategy) {
    case "morpho":
      return "~6.7%";
    case "spark":
      return "~4.0%";
    case "pooltogether":
      return "~3.5%";
    case "aave":
      return "~4.5%";
    case "octant":
      return "~10%";
    case "uniswap":
      return "~8.5%";
    default:
      return "Variable";
  }
}

function getStrategyRiskLabel(strategy: SupportedYieldStrategyId | null): string {
  switch (strategy) {
    case "morpho":
      return "Low to medium";
    case "spark":
      return "Low";
    default:
      return "Low";
  }
}

function getStrategyLockupLabel(strategy: SupportedYieldStrategyId | null): string {
  if (strategy === "pooltogether") return "Withdraw anytime";
  if (strategy === "aave") return "Withdraw anytime";
  if (strategy === "spark") return "No lockup";
  if (strategy === "morpho") return "Withdraw anytime (may vary by vault)";
  if (strategy === "octant") return "Epoch-based (mock)";
  if (strategy === "lifiearn") return "Depends on destination vault";
  return "Withdraw anytime";
}

function YieldStrategiesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address, walletType } = useUnifiedWallet();
  const {
    isDepositing,
    status,
    txHash,
    error: depositError,
    deposit,
    reset,
  } = useVaultDeposit();

  const walletRouting = walletType ? getWalletRouting(walletType) : null;

  // Fetch USDC balance on Base for deposit context
  const { data: usdcBalanceData } = useBalance({
    address: address as `0x${string}` | undefined,
    token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    chainId: base.id,
    query: { enabled: Boolean(address) },
  });
  const usdcBalance = usdcBalanceData
    ? parseFloat(usdcBalanceData.formatted)
    : null;

  const protocolParam = searchParams?.get("protocol");
  const strategyParam = searchParams?.get("strategy");
  const tabParam = searchParams?.get("tab");
  const entryParam = searchParams?.get(YIELD_ENTRY_PARAM);
  const amountParam = searchParams?.get("amount");
  const bridgeActivityIdParam = searchParams?.get("bridgeActivityId");
  const hasExecutionIntent = hasYieldExecutionIntent(searchParams);
  const isBridgeEntry = entryParam === YIELD_ENTRY_BRIDGE;

  const [flowStep, setFlowStep] = useState<FlowStep>(1);
  const [selectedStrategy, setSelectedStrategy] = useState<SupportedYieldStrategyId | null>(null);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [yieldToTickets, setYieldToTickets] = useState(85);
  const [yieldToCauses, setYieldToCauses] = useState(15);
  const [depositSuccess, setDepositSuccess] = useState(false);

  const selectedStrategyConfig = selectedStrategy
    ? getStrategyById(selectedStrategy)
    : undefined;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(ALLOCATION_STORAGE_KEY);
      if (!saved) return;
      const { tickets, causes } = JSON.parse(saved);
      setYieldToTickets(tickets);
      setYieldToCauses(causes);
    } catch {}
  }, []);

  const handleAllocationChange = useCallback(
    (tickets: number, causes: number) => {
      setYieldToTickets(tickets);
      setYieldToCauses(causes);

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            ALLOCATION_STORAGE_KEY,
            JSON.stringify({ tickets, causes })
          );
        } catch {}
      }

      if (address && selectedStrategy && (selectedStrategy === "spark" || selectedStrategy === "aave")) {
        yieldToTicketsService.setupAutoYieldStrategy(address, {
          vaultProtocol: selectedStrategy as unknown as VaultProtocol,
          userAddress: address,
          ticketsAllocation: tickets,
          causesAllocation: causes,
          causeWallet: "0x0000000000000000000000000000000000000000",
          ticketPrice: "1",
        });
      }
    },
    [address, selectedStrategy]
  );

  useEffect(() => {
    if (!hasExecutionIntent) {
      router.replace(VAULTS_ROUTE);
    }
  }, [hasExecutionIntent, router]);

  useEffect(() => {
    const targetStrategy = strategyParam ?? protocolParam;
    setFlowStep(getInitialFlowStep(tabParam ?? null, isBridgeEntry, targetStrategy ?? null));

    if (
      targetStrategy === "aave" ||
      targetStrategy === "morpho" ||
      targetStrategy === "spark" ||
      targetStrategy === "pooltogether" ||
      targetStrategy === "octant" ||
      targetStrategy === "uniswap" ||
      targetStrategy === "lifiearn"
    ) {
      setSelectedStrategy(targetStrategy as SupportedYieldStrategyId);
    }
  }, [isBridgeEntry, protocolParam, strategyParam, tabParam]);

  useEffect(() => {
    if (!selectedStrategy && flowStep !== 1) {
      setFlowStep(1);
    }
  }, [flowStep, selectedStrategy]);

  useEffect(() => {
    if (!amountParam) return;
    const parsedAmount = Number(amountParam);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return;
    setDepositAmount((current) => (current > 0 ? current : parsedAmount));
  }, [amountParam]);

  const handleDeposit = useCallback(async () => {
    if (!selectedStrategy || depositAmount <= 0) return;
    if (
      !DIRECT_DEPOSIT_STRATEGIES.includes(
        selectedStrategy as (typeof DIRECT_DEPOSIT_STRATEGIES)[number]
      )
    ) {
      return;
    }

    const vaultProtocol = selectedStrategy as unknown as VaultProtocol;

    setDepositSuccess(false);
    const result = await deposit(vaultProtocol, depositAmount.toString());

    if (result.success) {
      if (address && result.txHash) {
        const depositRecord = {
          id: createVaultActivityId(),
          walletAddress: address,
          protocol: vaultProtocol,
          amount: depositAmount.toString(),
          txHash: result.txHash,
          timestamp: Date.now(),
          bridgeActivityId: bridgeActivityIdParam || undefined,
        };

        recordVaultDepositActivity(depositRecord);
        void persistVaultDepositActivityRecord(depositRecord).catch((error) => {
          console.warn("[YieldStrategies] Failed to persist vault deposit activity:", error);
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

  useEffect(() => {
    reset();
    setDepositSuccess(false);
  }, [depositAmount, selectedStrategy, reset]);

  const getDepositStatusLabel = () => {
    switch (status) {
      case "building_tx":
        return "Building transaction...";
      case "checking_allowance":
        return "Checking USDC allowance...";
      case "approving":
        return "Approving USDC spending...";
      case "depositing":
        return "Depositing to vault...";
      case "signing":
        return "Sign in your wallet...";
      case "confirming":
        return "Confirming on-chain...";
      case "complete":
        return "Deposit complete!";
      default:
        return null;
    }
  };

  const renderSelectedStrategySummary = () => {
    if (!selectedStrategy) return null;

    return (
      <CompactCard variant="glass" padding="md" className="border-blue-500/20 bg-blue-500/5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20 text-blue-200`}>
              {selectedStrategyConfig?.icon || <Shield className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">Selected Vault</p>
              <h3 className="text-lg font-bold text-white">{selectedStrategyConfig?.name}</h3>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Target Yield</p>
              <p className="font-bold text-emerald-400">{getStrategyApyLabel(selectedStrategy)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Risk Profile</p>
              <p className="font-bold text-white">{getStrategyRiskLabel(selectedStrategy)}</p>
            </div>
          </div>
        </div>
      </CompactCard>
    );
  };

  const renderStrategyStep = () => (
    <CompactStack spacing="lg">
      <div className="px-1">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Layers className="h-5 w-5 text-blue-400" />
          Choose your vault
        </h2>
        <p className="mt-1 text-sm text-gray-400">
          Select a strategy that matches your risk appetite and yield goals.
        </p>
      </div>

      <ImprovedYieldStrategySelector
        selectedStrategy={selectedStrategy}
        onStrategySelect={(strategy) => setSelectedStrategy(strategy ?? null)}
        ticketsAllocation={yieldToTickets}
        causesAllocation={yieldToCauses}
        onAllocationChange={handleAllocationChange}
        userAddress={address || undefined}
        allowInternalDetailView={false}
        compactCards
        showIntro={false}
      />

      {selectedStrategy && (
        <div className="flex justify-end pt-4">
          <Button
            variant="default"
            size="lg"
            className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 min-w-[200px] shadow-lg shadow-blue-500/20"
            onClick={() => setFlowStep(2)}
          >
            Continue to allocation
          </Button>
        </div>
      )}
    </CompactStack>
  );

  const renderAllocationStep = () => (
    <CompactStack spacing="lg">
      {renderSelectedStrategySummary()}

      <div className="px-1">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-400" />
          Set the yield split
        </h2>
        <p className="mt-1 text-sm text-gray-400">
          Decide how much yield converts to lottery tickets vs supporting causes.
        </p>
      </div>

      <CompactCard variant="premium" padding="lg" className="bg-white/[0.02]">
        <YieldAllocationControl
          ticketsAllocation={yieldToTickets}
          causesAllocation={yieldToCauses}
          onAllocationChange={handleAllocationChange}
        />
      </CompactCard>

      <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:justify-between">
        <Button variant="outline" className="border-white/10 hover:bg-white/5" onClick={() => setFlowStep(1)}>
          Back to strategies
        </Button>
        <div className="flex gap-3">
          <Button
            variant="ghost"
            className="text-gray-400 hover:text-white"
            onClick={() => setFlowStep(3)}
          >
            Use defaults ({yieldToTickets}/{yieldToCauses})
          </Button>
          <Button
            variant="default"
            size="lg"
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 min-w-[200px] shadow-lg shadow-emerald-500/20"
            onClick={() => setFlowStep(3)}
          >
            Continue to deposit
          </Button>
        </div>
      </div>
    </CompactStack>
  );

  const renderDirectDepositPanel = () => (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-6">
        <div className="px-1">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-400" />
            Fund your vault
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Enter the amount of USDC to deposit and start generating yield.
          </p>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-semibold text-gray-400">
              Deposit amount (USDC)
            </label>
            {usdcBalance !== null && (
              <button
                type="button"
                onClick={() => setDepositAmount(Math.floor(usdcBalance))}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors"
              >
                <Wallet className="h-3 w-3" />
                Balance: <span className="font-bold text-gray-300">{usdcBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC</span>
              </button>
            )}
          </div>
          <div className="relative">
            <input
              type="number"
              min={0}
              step={100}
              value={depositAmount || ""}
              onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
              placeholder="0.00"
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-5 text-2xl font-bold text-white outline-none transition focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <span className="text-sm font-bold text-gray-500">USDC</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Principal is preserved. Only the yield is used for tickets/causes.
          </p>
        </div>

        {depositSuccess && txHash ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
                <Check className="h-5 w-5 text-emerald-300" />
              </div>
              <div>
                <p className="font-semibold text-emerald-200">Deposit complete</p>
                <p className="text-sm text-emerald-100/70">
                  Your vault is active and generating yield.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href={`https://basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/10"
              >
                View Transaction
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
              <Link
                href={VAULTS_ROUTE}
                className="inline-flex items-center rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/20"
              >
                Go to Portfolio
              </Link>
            </div>
          </div>
        ) : depositError ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
            <p className="text-sm text-red-200 mb-4">{depositError}</p>
            <Button onClick={handleDeposit} className="w-full" variant="destructive">
              Retry Deposit
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleDeposit}
            disabled={!depositAmount || depositAmount <= 0 || isDepositing}
            size="lg"
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 py-8 text-lg font-bold shadow-xl shadow-blue-500/20"
          >
            {isDepositing ? (
              <span className="flex items-center gap-3">
                <Loader className="h-5 w-5 animate-spin" />
                {getDepositStatusLabel()}
              </span>
            ) : (
              `Deposit ${depositAmount > 0 ? `${depositAmount.toLocaleString()} USDC` : "Funds"}`
            )}
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Execution Review</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Expected APY</span>
              <span className="text-sm font-bold text-emerald-400">{getStrategyApyLabel(selectedStrategy)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Yield Split</span>
              <span className="text-sm font-bold text-white">{yieldToTickets}% / {yieldToCauses}%</span>
            </div>
            <div className="flex items-center justify-between border-t border-white/5 pt-4">
              <span className="text-sm text-gray-400">Terms</span>
              <span className="text-xs text-right font-medium text-gray-300">{getStrategyLockupLabel(selectedStrategy)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-blue-300 uppercase tracking-wider mb-1">No Loss</p>
              <p className="text-xs leading-relaxed text-blue-100/60">
                Your initial deposit remains safe and can be withdrawn according to vault terms. Only yield is put at risk for upside.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderLifiDepositPanel = () => (
    <CompactStack spacing="lg">
      <div className="px-1">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Globe className="h-5 w-5 text-indigo-400" />
          Cross-chain deposit
        </h2>
        <p className="mt-1 text-sm text-gray-400">
          Fund your vault from any supported network. LI.FI handles the bridge automatically.
        </p>
      </div>

      <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6">
        <label className="mb-3 block text-sm font-semibold text-gray-400">
          Amount to Bridge (USDC)
        </label>
        <div className="relative">
          <input
            type="number"
            min={0}
            step={100}
            value={depositAmount || ""}
            onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
            placeholder="0.00"
            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-5 text-2xl font-bold text-white outline-none transition focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
          />
        </div>
      </div>

      <LifiEarnVaultSelector
        onVaultSelect={(vault) => console.log("Selected vault:", vault)}
        depositAmount={depositAmount.toString()}
        userAddress={address || undefined}
      />
    </CompactStack>
  );

  if (!hasExecutionIntent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500" />
          <p className="text-sm text-gray-400">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_40%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.05),transparent_40%)] p-4 md:p-8">
      <CompactContainer maxWidth="2xl">
        <CompactSection spacing="xl">
          {/* Header Area */}
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <Link href={VAULTS_ROUTE} className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-white transition-colors mb-2">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Discovery
              </Link>
              <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl lg:text-5xl">
                {selectedStrategyConfig ? `Setting up ${selectedStrategyConfig.name}` : "Vault Setup"}
              </h1>
              <p className="text-gray-400 max-w-xl">
                {selectedStrategyConfig
                  ? `${selectedStrategyConfig.description}`
                  : "Set up your vault strategy and yield routing in a few simple steps."}
              </p>
            </div>

            {/* Wallet Status Area */}
            <div className="min-w-[320px] rounded-2xl border border-white/5 bg-white/[0.02] p-5 shadow-2xl backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Wallet Status</p>
                <div className="flex items-center gap-1.5">
                  <div className={`h-1.5 w-1.5 rounded-full ${address ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]'}`} />
                  <span className={`text-[10px] font-bold ${address ? 'text-emerald-500' : 'text-amber-500'}`}>{address ? 'Connected' : 'Not Connected'}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">EVM Wallet</span>
                  <span className="text-xs font-mono text-gray-300">{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}</span>
                </div>
                
                {walletRouting && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Origin Chain</span>
                      <span className="text-xs font-bold text-white">{walletRouting.nativeChain}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Bridge Protocol</span>
                      <span className="text-xs font-bold text-blue-400">{walletRouting.bridgeProtocol}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Destination</span>
                      <span className="text-xs font-bold text-white">{walletRouting.destination}</span>
                    </div>
                  </>
                )}
                
                <div className="pt-2 border-t border-white/5 mt-2 flex justify-end">
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] text-gray-500 hover:text-white" onClick={() => reset()}>
                    Switch Wallet
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Stepper Area */}
          <div className="grid grid-cols-3 gap-3">
            {FLOW_STEPS.map((step) => {
              const isCurrent = flowStep === step.id;
              const isComplete = flowStep > step.id;
              const isUnlocked = step.id === 1 || Boolean(selectedStrategy);
              
              return (
                <button
                  key={step.id}
                  onClick={() => isUnlocked && setFlowStep(step.id)}
                  disabled={!isUnlocked}
                  className={`relative flex flex-col gap-2 rounded-xl border p-3 text-left transition-all ${
                    isCurrent 
                      ? "border-blue-500/50 bg-blue-500/10 shadow-lg shadow-blue-500/5" 
                      : isComplete
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-white/5 bg-white/[0.02] opacity-40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isCurrent ? 'text-blue-400' : isComplete ? 'text-emerald-400' : 'text-gray-500'}`}>
                      {step.eyebrow}
                    </span>
                    {isComplete && <Check className="h-3 w-3 text-emerald-400" />}
                  </div>
                  <span className={`text-xs font-bold ${isCurrent ? 'text-white' : 'text-gray-400'}`}>{step.title}</span>
                  {isCurrent && <div className="absolute -bottom-[1px] left-0 h-[2px] w-full bg-blue-500" />}
                </button>
              );
            })}
          </div>

          {/* Content Area */}
          <div className="min-h-[400px]">
            {flowStep === 1 && renderStrategyStep()}
            {flowStep === 2 && selectedStrategy && renderAllocationStep()}
            {flowStep === 3 && selectedStrategy && (
              <CompactStack spacing="xl">
                {renderSelectedStrategySummary()}
                {selectedStrategy === "lifiearn"
                  ? renderLifiDepositPanel()
                  : renderDirectDepositPanel()}
                <div className="flex justify-start">
                  <Button variant="ghost" className="text-gray-500 hover:text-white" onClick={() => setFlowStep(2)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Allocation
                  </Button>
                </div>
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
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
        </div>
      }
    >
      <YieldStrategiesContent />
    </Suspense>
  );
}
