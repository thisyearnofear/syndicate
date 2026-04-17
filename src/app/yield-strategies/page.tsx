"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Globe,
  Heart,
  Loader,
  Shield,
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
import WalletConnectionManager from "@/components/wallet/WalletConnectionManager";
import { ImprovedYieldStrategySelector } from "@/components/yield/ImprovedYieldStrategySelector";
import { YieldAllocationControl } from "@/components/yield/YieldAllocationControl";
import { LifiEarnVaultSelector } from "@/components/yield/LifiEarnVaultSelector";
import { yieldToTicketsService } from "@/services/yieldToTicketsService";
import type { VaultProtocol } from "@/services/vaults";
import {
  getStrategyById,
  type SupportedYieldStrategyId,
} from "@/config/yieldStrategies";
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

function getStrategyVenueLabel(strategy: SupportedYieldStrategyId | null): string {
  switch (strategy) {
    case "lifiearn":
      return "Cross-chain";
    case "octant":
      return "Ethereum / Base";
    default:
      return "Base";
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
  if (strategy === "lifiearn") return "Depends on destination vault";
  return "Standard vault terms";
}

function YieldStrategiesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address } = useUnifiedWallet();
  const {
    isDepositing,
    status,
    txHash,
    error: depositError,
    deposit,
    reset,
  } = useVaultDeposit();

  const protocolParam = searchParams?.get("protocol");
  const strategyParam = searchParams?.get("strategy");
  const tabParam = searchParams?.get("tab");
  const entryParam = searchParams?.get(YIELD_ENTRY_PARAM);
  const amountParam = searchParams?.get("amount");
  const sourceChainParam = searchParams?.get("sourceChain");
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
  const canDepositIntoSelectedStrategy = Boolean(
    selectedStrategy &&
      DIRECT_DEPOSIT_STRATEGIES.includes(
        selectedStrategy as (typeof DIRECT_DEPOSIT_STRATEGIES)[number]
      )
  );

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

  const goToStep = (step: FlowStep) => {
    if (step === 1) {
      setFlowStep(1);
      return;
    }

    if (!selectedStrategy) return;
    setFlowStep(step);
  };

  const renderStepButton = (step: (typeof FLOW_STEPS)[number]) => {
    const isCurrent = flowStep === step.id;
    const isComplete = flowStep > step.id;
    const isUnlocked = step.id === 1 || Boolean(selectedStrategy);

    return (
      <button
        key={step.id}
        type="button"
        onClick={() => goToStep(step.id)}
        disabled={!isUnlocked}
        className={`rounded-2xl border px-4 py-4 text-left transition-all ${
          isCurrent
            ? "border-blue-400/70 bg-blue-500/15 shadow-[0_0_0_1px_rgba(96,165,250,0.35)]"
            : isComplete
              ? "border-emerald-500/40 bg-emerald-500/10"
              : isUnlocked
                ? "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                : "cursor-not-allowed border-white/5 bg-white/[0.03] opacity-50"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
              isComplete
                ? "bg-emerald-500/20 text-emerald-300"
                : isCurrent
                  ? "bg-blue-500/20 text-blue-200"
                  : "bg-white/10 text-gray-300"
            }`}
          >
            {isComplete ? <Check className="h-4 w-4" /> : step.id}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
              {step.eyebrow}
            </p>
            <p className="text-sm font-semibold text-white">{step.title}</p>
          </div>
        </div>
      </button>
    );
  };

  const renderSelectedStrategySummary = () => {
    if (!selectedStrategy) return null;

    return (
      <CompactCard variant="premium" padding="lg">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
              <Shield className="h-3.5 w-3.5" />
              Selected strategy
            </div>
            <h2 className="text-2xl font-bold text-white">
              {selectedStrategyConfig?.name ?? "Vault strategy"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-300">
              {selectedStrategyConfig?.description ??
                "Your yield will be routed into tickets and causes using the split you choose next."}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[320px]">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Yield</p>
              <p className="mt-2 text-lg font-semibold text-emerald-300">
                {getStrategyApyLabel(selectedStrategy)}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Risk</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {getStrategyRiskLabel(selectedStrategy)}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Network</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {getStrategyVenueLabel(selectedStrategy)}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Terms</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {getStrategyLockupLabel(selectedStrategy)}
              </p>
            </div>
          </div>
        </div>
      </CompactCard>
    );
  };

  const renderStrategyStep = () => (
    <CompactStack spacing="lg">
      <CompactCard variant="premium" padding="lg">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold text-white">Pick the vault first</h2>
          <p className="mt-2 text-sm leading-6 text-gray-300">
            Start with the risk and yield profile that matches the user intent.
            The page now keeps this step focused on selection only, so people are not
            comparing strategies and entering money in the same glance.
          </p>
        </div>
      </CompactCard>

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

      {selectedStrategy ? (
        <>
          {renderSelectedStrategySummary()}
          <div className="flex justify-end">
            <Button
              variant="default"
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
              onClick={() => setFlowStep(2)}
            >
              Continue to allocation
            </Button>
          </div>
        </>
      ) : null}
    </CompactStack>
  );

  const renderAllocationStep = () => (
    <CompactStack spacing="lg">
      {renderSelectedStrategySummary()}

      <CompactCard variant="premium" padding="lg">
        <div className="mb-6 max-w-2xl">
          <h2 className="text-2xl font-bold text-white">Choose the yield split</h2>
          <p className="mt-2 text-sm leading-6 text-gray-300">
            This controls what happens to generated yield after deposit. Keep the decision
            separate from strategy selection so the page reads like a flow instead of a dashboard.
          </p>
        </div>

        <YieldAllocationControl
          ticketsAllocation={yieldToTickets}
          causesAllocation={yieldToCauses}
          onAllocationChange={handleAllocationChange}
        />

        <div className="mt-6 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          Current split: {yieldToTickets}% to tickets and {yieldToCauses}% to causes.
        </div>
      </CompactCard>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Button variant="outline" className="border-white/15" onClick={() => setFlowStep(1)}>
          Back to strategies
        </Button>
        <Button
          variant="default"
          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
          onClick={() => setFlowStep(3)}
        >
          Continue to deposit
        </Button>
      </div>
    </CompactStack>
  );

  const renderDirectDepositPanel = () => (
    <CompactCard variant="premium" padding="lg">
      <div className="mb-6 max-w-2xl">
        <h2 className="text-2xl font-bold text-white">Fund the vault</h2>
        <p className="mt-2 text-sm leading-6 text-gray-300">
          Keep the amount entry and action review together in the last step. That removes
          the biggest source of noise from the landing view while still keeping the execution path fast.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-300">
              Deposit amount (USDC)
            </label>
            <input
              type="number"
              min={0}
              step={100}
              value={depositAmount || ""}
              onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
              placeholder="Enter amount to deposit"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-lg text-white outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-2 text-sm text-gray-400">
              The amount stays visible here only, not in earlier steps.
            </p>
          </div>

          {depositSuccess && txHash ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/20 to-teal-500/10 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
                  <Check className="h-5 w-5 text-emerald-300" />
                </div>
                <div>
                  <p className="font-semibold text-emerald-200">Deposit complete</p>
                  <p className="text-sm text-emerald-100/80">
                    Your vault is active and the yield routing preferences are saved.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <a
                  href={`https://basescan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-xl border border-emerald-400/30 px-4 py-3 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/10"
                >
                  View transaction
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
                <Link
                  href={VAULTS_ROUTE}
                  className="inline-flex items-center justify-center rounded-xl border border-blue-400/30 px-4 py-3 text-sm font-medium text-blue-200 transition hover:bg-blue-500/10"
                >
                  Return to vaults
                </Link>
              </div>
            </div>
          ) : depositError ? (
            <div className="space-y-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
              <p className="text-sm text-red-200">{depositError}</p>
              <Button
                onClick={handleDeposit}
                disabled={!depositAmount || depositAmount <= 0 || isDepositing}
                className="w-full"
                variant="default"
              >
                Retry deposit
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
                  <Loader className="h-4 w-4 animate-spin" />
                  {getDepositStatusLabel()}
                </span>
              ) : (
                `Deposit ${depositAmount > 0 ? `${depositAmount.toLocaleString()} USDC` : "USDC"}`
              )}
            </Button>
          ) : (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
              <p className="text-sm text-amber-100">
                {selectedStrategyConfig?.name ?? "This strategy"} is not available for direct
                deposit from this execution flow yet.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Review</p>
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm text-gray-400">Expected APY</p>
                <p className="text-lg font-semibold text-emerald-300">
                  {getStrategyApyLabel(selectedStrategy)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Yield routing</p>
                <p className="text-lg font-semibold text-white">
                  {yieldToTickets}% tickets / {yieldToCauses}% causes
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Withdrawal terms</p>
                <p className="text-lg font-semibold text-white">
                  {getStrategyLockupLabel(selectedStrategy)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm font-semibold text-white">What changed in the UX</p>
            <p className="mt-2 text-sm leading-6 text-gray-400">
              The page now holds one primary decision per step. Users choose the vault,
              then the split, then the money movement.
            </p>
          </div>
        </div>
      </div>
    </CompactCard>
  );

  const renderLifiDepositPanel = () => (
    <CompactStack spacing="lg">
      <CompactCard variant="premium" padding="lg">
        <div className="mb-6 max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">
            <Globe className="h-3.5 w-3.5" />
            Cross-chain deposit
          </div>
          <h2 className="text-2xl font-bold text-white">Deposit from any supported chain</h2>
          <p className="mt-2 text-sm leading-6 text-gray-300">
            LI.FI Earn already has its own vault explorer, so this step should only introduce
            the cross-chain promise and then hand off to the selector.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <label className="mb-2 block text-sm font-semibold text-gray-300">
            Deposit amount (USDC)
          </label>
          <input
            type="number"
            min={0}
            step={100}
            value={depositAmount || ""}
            onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
            placeholder="Enter amount to bridge and deposit"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-lg text-white outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </CompactCard>

      <LifiEarnVaultSelector
        onVaultSelect={(vault) => console.log("Selected vault:", vault)}
        depositAmount={depositAmount.toString()}
        userAddress={address || undefined}
      />
    </CompactStack>
  );

  if (!hasExecutionIntent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
          <p className="text-sm text-gray-300">Redirecting to vaults...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.22),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.18),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_52%,_#111827_100%)] p-4">
      <CompactContainer maxWidth="2xl">
        <CompactSection spacing="lg">
          <div className="mb-2">
            <Link href={VAULTS_ROUTE}>
              <Button variant="ghost" className="text-gray-400 hover:text-white">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to vaults
              </Button>
            </Link>
          </div>

          <CompactCard variant="premium" padding="lg">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                  <Heart className="h-3.5 w-3.5" />
                  Vault setup
                </div>
                <h1 className="mt-4 text-4xl font-black tracking-tight text-white md:text-5xl">
                  Set up the vault in three clear steps
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-gray-300">
                  The old page behaved like a dense control panel. This version keeps the
                  discovery work on <span className="font-semibold text-white">/vaults</span> and
                  turns the execution page into a guided sequence: choose the vault, set the
                  yield split, then complete the deposit.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="mb-3 text-xs uppercase tracking-[0.16em] text-gray-500">
                  Wallet status
                </p>
                <WalletConnectionManager />
              </div>
            </div>

            {isBridgeEntry ? (
              <div className="mt-6 rounded-2xl border border-blue-500/30 bg-blue-500/10 px-5 py-4">
                <p className="text-sm font-semibold text-blue-200">
                  Bridge flow detected from {sourceChainParam || "another chain"}
                </p>
                <p className="mt-1 text-sm leading-6 text-blue-100/85">
                  The funding leg has already happened. This page now focuses on the remaining
                  decisions so the user can finish the vault setup without extra page hopping.
                  {amountParam ? ` ${amountParam} USDC is prefilled for the final step.` : ""}
                  {selectedStrategyConfig ? ` ${selectedStrategyConfig.name} is already selected.` : ""}
                </p>
              </div>
            ) : null}
          </CompactCard>

          <div className="grid gap-3 md:grid-cols-3">{FLOW_STEPS.map(renderStepButton)}</div>

          <div className="w-full">
            {flowStep === 1 && renderStrategyStep()}
            {flowStep === 2 && selectedStrategy && renderAllocationStep()}
            {flowStep === 3 && selectedStrategy && (
              <CompactStack spacing="lg">
                {renderSelectedStrategySummary()}
                {selectedStrategy === "lifiearn"
                  ? renderLifiDepositPanel()
                  : renderDirectDepositPanel()}
                <div className="flex justify-start">
                  <Button variant="outline" className="border-white/15" onClick={() => setFlowStep(2)}>
                    Back to allocation
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
