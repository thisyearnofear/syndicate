"use client";

/**
 * ENHANCED PURCHASE MODAL
 *
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced with premium UI components
 * - MODULAR: Uses premium design system
 * - CLEAN: Clear purchase flow
 * - PERFORMANT: Optimized animations
 */

import React, { useState, useEffect, useMemo, Suspense, lazy } from "react";
import { Loader, AlertCircle } from "lucide-react";
import { useTicketPurchase } from "@/hooks/useTicketPurchase";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { useLottery } from "@/domains/lottery/hooks/useLottery";
import { Button } from "@/shared/components/ui/Button";
import { CompactFlex } from "@/shared/components/premium/CompactLayout";
import { WalletConnectionCard } from "@/components/wallet/WalletConnectionCard";
import { useSuccessToast, useErrorToast } from "@/shared/components/ui/Toast";
import type { SyndicateInfo } from "@/domains/lottery/types";
import { WalletTypes } from "@/domains/wallet/types";
import { BridgeGuidanceCard } from "@/components/bridge/BridgeGuidanceCard";
import { FocusedBridgeFlow } from "@/components/bridge/FocusedBridgeFlow";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ethers, Contract } from "ethers";
import { cctp as CCTP } from "@/config";
import { nearWalletSelectorService } from "@/domains/wallet/services/nearWalletSelectorService";
import { nearIntentsService } from "@/services/nearIntentsService";
import type { IntentQuote } from "@/services/nearIntentsService";

// Lazy load modal steps for better performance (restored with animations)
const ModeStep = lazy(() =>
  import("./purchase/ModeStep").then((mod) => ({ default: mod.ModeStep }))
);
const SelectStep = lazy(() =>
  import("./purchase/SelectStep").then((mod) => ({ default: mod.SelectStep }))
);
const ProcessingStep = lazy(() =>
  import("./purchase/ProcessingStep").then((mod) => ({
    default: mod.ProcessingStep,
  }))
);
const SuccessStep = lazy(() =>
  import("./purchase/SuccessStep").then((mod) => ({ default: mod.SuccessStep }))
);
const YieldStrategyStep = lazy(() =>
  import("./purchase/YieldStrategyStep").then((mod) => ({
    default: mod.YieldStrategyStep,
  }))
);
import { ShareModal } from "./ShareModal";

export interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (ticketCount: number) => void;
}

export default function PurchaseModal({
  isOpen,
  onClose,
  onSuccess,
}: PurchaseModalProps) {
  const { isConnected, connect, address, walletType } = useWalletConnection();
  const successToast = useSuccessToast();
  const errorToast = useErrorToast();
  const {
    jackpotStats,
    prizeAmount,
    isLoading: jackpotLoading,
    error: jackpotError,
    refresh: refreshLottery,
  } = useLottery();
  const {
    // State
    isInitializing,
    isPurchasing,
    isApproving,
    isCheckingBalance,
    userBalance,
    solanaBalance,
    ticketPrice,
    lastTxHash,
    error,
    purchaseSuccess,
    purchasedTicketCount,
    // NEAR status
    nearStages,
    nearRecipient,
    nearRequestId,
    nearEthBalance,
    nearEstimatedFeeEth,
    nearIntentTxHash,
    nearDestinationTxHash,
    // Actions
    purchaseTickets,
    refreshBalance,
    retryAfterFunding,
    clearError,
    reset,
    needsBridgeGuidance,
  } = useTicketPurchase();

  const [ticketCount, setTicketCount] = useState(1);
  const [step, setStep] = useState<
    "mode" | "yield" | "select" | "confirm" | "processing" | "success" | "share"
  >("mode");
  const [purchaseMode, setPurchaseMode] = useState<
    "individual" | "syndicate" | "yield"
  >("individual");
  const [selectedSyndicate, setSelectedSyndicate] =
    useState<SyndicateInfo | null>(null);
  const [selectedVaultStrategy, setSelectedVaultStrategy] = useState<
    SyndicateInfo["vaultStrategy"] | null
  >(null);
  const [yieldToTicketsPercentage, setYieldToTicketsPercentage] =
    useState<number>(85);
  const [yieldToCausesPercentage, setYieldToCausesPercentage] =
    useState<number>(15);
  const [syndicates, setSyndicates] = useState<SyndicateInfo[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showBridgeGuidance, setShowBridgeGuidance] = useState(false);
  const [isBridging, setIsBridging] = useState(false);
  const [selectedBridgeProtocol, setSelectedBridgeProtocol] = useState<
    "cctp" | "wormhole" | null
  >(null);
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const [bridgeMetadata, setBridgeMetadata] = useState<{
    protocol?: string;
    bridgeId?: string;
    burnSignature?: string;
    message?: string;
    attestation?: string;
    mintTxHash?: string;
  } | null>(null);
  const [bridgeAmount, setBridgeAmount] = useState<string | null>(null);
  const [nearQuote, setNearQuote] = useState<IntentQuote | null>(null);

  // Handle modal close with proper cleanup
  const handleClose = () => {
    onClose();
    // Only reset if we're in success state to avoid clearing state during navigation
    if (purchaseSuccess) {
      reset();
    }
  };

  // Bridge handler functions
  const handleStartBridge = (amt?: string, protocol?: "cctp" | "wormhole") => {
    if (!evmConnected || !evmAddress) {
      errorToast(
        "EVM Wallet Required",
        "Connect an EVM wallet to receive USDC on Base"
      );
      return;
    }
    if (amt && parseFloat(amt) > 0) {
      setBridgeAmount(amt);
    } else {
      setBridgeAmount(null);
    }
    if (protocol) {
      setSelectedBridgeProtocol(protocol);
    }
    setShowBridgeGuidance(false);
    setIsBridging(true);
  };

  const handleBridgeComplete = async (result: unknown) => {
    setIsBridging(false);
    try {
      if (
        typeof result === 'object' &&
        result !== null &&
        'protocol' in result &&
        result.protocol === "cctp" &&
        'details' in result &&
        typeof result.details === 'object' &&
        result.details !== null &&
        'message' in result.details &&
        'attestation' in result.details
      ) {
        const resultAny = result as {
          protocol: string;
          details: {
            message: string;
            attestation: string;
            burnSignature?: string;
          };
          bridgeId?: string;
        };

        if (!evmConnected || !evmAddress || !window.ethereum) {
          errorToast(
            "EVM Wallet Required",
            "Connect an EVM wallet to mint bridged USDC on Base"
          );
          return;
        }
        const provider = new ethers.BrowserProvider(window.ethereum);
        const network = await provider.getNetwork();
        if (network.chainId !== BigInt(8453)) {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x2105" }],
          });
        }
        const signer = await provider.getSigner();
        const transmitter = new Contract(
          CCTP.base.messageTransmitter,
          [
            "function receiveMessage(bytes calldata message, bytes calldata attestation) external returns (bool)",
          ],
          signer
        );
        const tx = await transmitter.receiveMessage(
          resultAny.details.message,
          resultAny.details.attestation
        );
        const rc = await tx.wait();
        setBridgeMetadata({
          protocol: "cctp",
          bridgeId: resultAny.bridgeId,
          burnSignature: resultAny.details.burnSignature,
          message: resultAny.details.message,
          attestation: resultAny.details.attestation,
          mintTxHash: rc.hash,
        });
        successToast(
          "Bridge Minted",
          "USDC minted on Base. Proceeding to purchase..."
        );
        await refreshBalance();
        setStep("select");
        await handlePurchase();
        return;
      }
      pollBalanceUntilBridged();
    } catch (e: unknown) {
      const error = e as { message?: string };
      errorToast(
        "Mint Failed",
        error?.message || "Failed to mint bridged USDC on Base"
      );
      setShowBridgeGuidance(true);
    }
  };

  const pollBalanceUntilBridged = async () => {
    const requiredAmount = parseFloat(totalCost || "0");
    let attempts = 0;
    const maxAttempts = 12; // 1 minute max (5 second intervals, but less aggressive)

    const pollInterval = setInterval(async () => {
      attempts++;

      // Refresh balance (debounced in refreshBalance)
      await refreshBalance();

      const currentBaseBalance = parseFloat(userBalance?.usdc || "0");

      if (currentBaseBalance >= requiredAmount || attempts >= maxAttempts) {
        clearInterval(pollInterval);

        if (currentBaseBalance >= requiredAmount) {
          // Show confirmation before auto-purchasing
          setStep("select");
          successToast(
            "Bridge Complete!",
            "Your USDC is now on Base. Ready to buy your tickets?"
          );
        } else {
          errorToast(
            "Bridge Timeout",
            "The bridge took longer than expected. Please verify your balance and try again."
          );
        }
      }
    }, 5000); // Check every 5 seconds (max 12 checks = 1 minute)
  };

  const handleBridgeError = (error: string) => {
    setIsBridging(false);
    setShowBridgeGuidance(true);
    errorToast("Bridge Failed", error);
  };

  const handleGetNearQuote = async () => {
    try {
      if (walletType !== WalletTypes.NEAR) return;
      const ok = await nearWalletSelectorService.init();
      if (!ok) return;
      const selector = nearWalletSelectorService.getSelector();
      let accountId = nearWalletSelectorService.getAccountId();
      if (!accountId) {
        accountId = await nearWalletSelectorService.connect();
      }
      if (!selector || !accountId) return;
      const ready = await nearIntentsService.init(selector, accountId);
      if (!ready) return;
      const destinationAddress = await nearIntentsService.deriveEvmAddress(
        accountId
      );
      if (!destinationAddress) return;
      const amountUnits = BigInt(
        Math.floor(parseFloat(totalCost) * 1_000_000)
      ).toString();
      const quote = await nearIntentsService.getQuote({
        sourceAsset:
          "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
        sourceAmount: amountUnits,
        destinationAddress,
        destinationChain: "base",
      });
      if (quote) setNearQuote(quote);
    } catch (err) {
      console.error("Error getting NEAR quote:", err);
    }
  };

  // Compute odds using authoritative API data (no estimates)
  // Only show odds when we have real jackpot data
  const oddsInfo = useMemo(() => {
    if (jackpotLoading || !jackpotStats) {
      return null;
    }

    // Prefer API-provided oddsPerTicket; fallback to ticketsSoldCount if available
    const baseOddsRaw =
      jackpotStats.oddsPerTicket && Number(jackpotStats.oddsPerTicket) > 0
        ? Number(jackpotStats.oddsPerTicket)
        : typeof jackpotStats.ticketsSoldCount === "number" &&
          jackpotStats.ticketsSoldCount > 0
          ? Number(jackpotStats.ticketsSoldCount)
          : null;

    if (!baseOddsRaw || baseOddsRaw <= 0) {
      return null;
    }

    const formatOdds = (tickets: number) => {
      const divisor = Math.max(1, tickets);
      const x = Math.ceil(baseOddsRaw / divisor);
      return x <= 1
        ? "Better than 1:1"
        : `1 in ${x.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    };

    return {
      oddsPerTicket: baseOddsRaw,
      oddsForTickets: (tickets: number) =>
        Math.max(1, baseOddsRaw / Math.max(1, tickets)),
      oddsFormatted: formatOdds,
      potentialWinnings: jackpotStats.prizeUsd,
    };
  }, [jackpotLoading, jackpotStats]);

  // Reset modal state when opened
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setTicketCount(1);
      setStep("mode");
      setPurchaseMode("individual");
      setSelectedSyndicate(null);
      clearError();

      // Refresh lottery data if we don't have it or it's stale
      if (!jackpotStats || jackpotError) {
        refreshLottery();
      }

      // Fetch syndicates data
      fetchSyndicates();
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, clearError, jackpotStats, jackpotError, refreshLottery]);

  // Fetch syndicates data
  const fetchSyndicates = async () => {
    try {
      const response = await fetch("/api/syndicates");
      if (response.ok) {
        const data = await response.json();
        setSyndicates(data);
      }
    } catch (error) {
      console.error("Failed to fetch syndicates:", error);
    }
  };

  // Handle purchase success
  useEffect(() => {
    if (purchaseSuccess) {
      setStep("success");
      onSuccess?.(purchasedTicketCount);

      // Show success toast
      successToast(
        "Tickets Purchased!",
        `${purchasedTicketCount} ticket${purchasedTicketCount > 1 ? "s" : ""
        } successfully purchased`,
        {
          label: "View My Tickets",
          onClick: () => (window.location.href = "/my-tickets"),
        }
      );

      try {
        const sourceChain =
          walletType === WalletTypes.PHANTOM ? "solana" : "ethereum";
        const body = {
          sourceChain,
          sourceWallet:
            walletType === WalletTypes.PHANTOM ? address : undefined,
          baseWallet: evmAddress || address || undefined,
          bridgeTxHash: bridgeMetadata?.burnSignature,
          mintTxHash: bridgeMetadata?.mintTxHash,
          ticketPurchaseTx: lastTxHash,
          ticketCount: purchasedTicketCount,
        };
        fetch("/api/cross-chain-purchases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (err) {
        console.error("Error tracking cross-chain purchase:", err);
      }

      // Don't auto-close - let user control when to close
      // Users can click "Continue Playing" or navigate via other buttons
    }
  }, [
    purchaseSuccess,
    purchasedTicketCount,
    onSuccess,
    successToast,
    walletType,
    address,
    evmAddress,
    bridgeMetadata,
    lastTxHash,
  ]);

  const handlePurchase = async () => {
    if (!isConnected) {
      return;
    }

    setStep("processing");

    try {
      // Use the enhanced purchaseTickets function with syndicate and yield strategy support
      const result = await purchaseTickets(
        ticketCount,
        purchaseMode === "syndicate" ? selectedSyndicate?.id : undefined,
        purchaseMode === "yield"
          ? selectedVaultStrategy || undefined
          : undefined,
        purchaseMode === "yield" ? yieldToTicketsPercentage : undefined,
        purchaseMode === "yield" ? yieldToCausesPercentage : undefined
      );

      if (result.success) {
        setStep("success");
      } else {
        setStep("select");
        // Show error toast
        const errorMessage =
          result.error ||
          "Unable to complete ticket purchase. Please try again.";
        errorToast("Purchase Failed", errorMessage, {
          label: "Retry",
          onClick: () => handlePurchase(),
        });
      }
    } catch (error) {
      console.error("Purchase failed:", error);
      setStep("select");
      // Show error toast for unexpected errors
      errorToast(
        "Purchase Error",
        "An unexpected error occurred. Please check your connection and try again."
      );
    }
  };

  const quickAmounts = [1, 5, 10, 25];
  const totalCost = (parseFloat(ticketPrice) * ticketCount).toFixed(2);
  const hasInsufficientBalance =
    userBalance && parseFloat(userBalance.usdc) < parseFloat(totalCost);

  // Smart bridge flow detection - runs after totalCost is computed
  useEffect(() => {
    if (!isConnected || walletType !== WalletTypes.PHANTOM) return;

    const baseUSDC = parseFloat(userBalance?.usdc || "0");
    const requiredAmount = parseFloat(totalCost || "0");
    const hasSufficientBaseBalance = baseUSDC >= requiredAmount;

    // Skip bridge entirely if they already have sufficient Base balance
    if (hasSufficientBaseBalance) {
      setShowBridgeGuidance(false);
      return;
    }

    // Show bridge guidance only if they need it
    if (needsBridgeGuidance(totalCost)) {
      setShowBridgeGuidance(true);
    }
  }, [
    isConnected,
    walletType,
    userBalance?.usdc,
    totalCost,
    needsBridgeGuidance,
  ]);

  const renderStep = () => {
    switch (step) {
      case "mode":
        return (
          <ModeStep
            purchaseMode={purchaseMode}
            setPurchaseMode={setPurchaseMode}
            selectedSyndicate={selectedSyndicate}
            setSelectedSyndicate={setSelectedSyndicate}
            syndicates={syndicates}
            setStep={(step: "select" | "yield") => setStep(step)}
          />
        );
      case "yield":
        return (
          <YieldStrategyStep
            selectedStrategy={selectedVaultStrategy}
            onStrategySelect={setSelectedVaultStrategy}
            ticketsAllocation={yieldToTicketsPercentage}
            causesAllocation={yieldToCausesPercentage}
            onAllocationChange={(tickets, causes) => {
              setYieldToTicketsPercentage(tickets);
              setYieldToCausesPercentage(causes);
            }}
            onNext={() => setStep("select")}
            onBack={() => setStep("mode")}
            userAddress={isConnected ? address || undefined : undefined}
          />
        );
      case "select":
        return (
          <SelectStep
            setStep={setStep as (step: "mode") => void}
            selectedSyndicate={selectedSyndicate}
            prizeAmount={prizeAmount}
            jackpotLoading={jackpotLoading}
            jackpotError={jackpotError}
            ticketPrice={ticketPrice}
            ticketCount={ticketCount}
            setTicketCount={setTicketCount}
            quickAmounts={quickAmounts}
            totalCost={totalCost}
            oddsInfo={oddsInfo}
            hasInsufficientBalance={hasInsufficientBalance}
            refreshBalance={refreshBalance}
            isConnected={isConnected}
            handlePurchase={handlePurchase}
            isPurchasing={isPurchasing}
            isInitializing={isInitializing}
            purchaseMode={purchaseMode}
            walletType={walletType}
            solanaBalance={solanaBalance}
            onStartBridge={handleStartBridge}
            isBridging={isBridging}
            showBridgeGuidance={showBridgeGuidance}
            nearQuote={nearQuote}
            onGetNearQuote={handleGetNearQuote}
            onConfirmIntent={handlePurchase}
          />
        );
      case "processing":
        return (
          <ProcessingStep
            isApproving={isApproving}
            nearStages={nearStages}
            nearRecipient={nearRecipient}
            nearRequestId={nearRequestId}
            nearEthBalance={nearEthBalance}
            nearEstimatedFeeEth={nearEstimatedFeeEth}
            nearIntentTxHash={nearIntentTxHash}
            nearDestinationTxHash={nearDestinationTxHash}
            onRetryAfterFunding={retryAfterFunding}
          />
        );
      case "success":
        return (
          <SuccessStep
            purchaseMode={purchaseMode}
            purchasedTicketCount={purchasedTicketCount}
            selectedSyndicate={selectedSyndicate}
            lastTxHash={lastTxHash}
            onClose={handleClose}
            setShowShareModal={setShowShareModal}
          />
        );
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Premium backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={handleClose}
      />

      {/* Premium modal */}
      <div className="relative glass-premium rounded-3xl p-6 w-full max-w-lg border border-white/20 animate-scale-in max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <CompactFlex align="center" justify="between" className="mb-6">
          <div className="flex-1">
            <h2 className="font-bold text-2xl md:text-4xl lg:text-5xl leading-tight tracking-tight text-white">
              {step === "success"
                ? "🎉 Success!"
                : step === "mode"
                  ? "🎫 Buy Tickets"
                  : step === "yield"
                    ? "💰 Yield Strategy"
                    : selectedSyndicate
                      ? `🌊 ${selectedSyndicate.name}`
                      : "🎫 Buy Tickets"}
            </h2>
            {selectedSyndicate && step !== "mode" && step !== "yield" && (
              <p className="text-sm text-gray-400 mt-1">
                Supporting {selectedSyndicate.cause.name} •{" "}
                {selectedSyndicate.membersCount.toLocaleString()} members
              </p>
            )}
            {step === "yield" && (
              <p className="text-sm text-gray-400 mt-1">
                Choose how your capital generates yield to support causes and
                amplify participation
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="w-8 h-8 p-0 rounded-full"
          >
            ✕
          </Button>
        </CompactFlex>

        {/* Wallet Connection */}
        {!isConnected && (
          <div className="mb-6">
            <WalletConnectionCard
              onConnect={connect}
              title="Connect Wallet to Purchase"
              subtitle="Connect your wallet to purchase lottery tickets and join syndicates"
              compact={true}
            />
          </div>
        )}

        {/* Balance Display - show after mode selection for compact first view */}
        {isConnected && userBalance && step === "select" && (
          <div className="space-y-3 mb-6">
            {/* Info message for Phantom users */}
            {walletType === WalletTypes.PHANTOM && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-blue-300 text-sm">
                  💡 USDC lives on Solana and Base.
                </p>
                <div className="text-blue-200 text-xs mt-1">
                  {(() => {
                    const baseUSDC = parseFloat(userBalance?.usdc || "0");
                    const requiredAmount = parseFloat(totalCost || "0");
                    const deficit = Math.max(0, requiredAmount - baseUSDC);
                    const solUSDC = parseFloat(solanaBalance || "0");
                    return `Need $${requiredAmount.toFixed(
                      2
                    )} • Have $${baseUSDC.toFixed(
                      2
                    )} on Base (deficit $${deficit.toFixed(
                      2
                    )}) • $${solUSDC.toFixed(2)} on Solana`;
                  })()}
                </div>
              </div>
            )}

            {/* Solana Balance (Phantom only) */}
            {walletType === WalletTypes.PHANTOM && (
              <div className="bg-white/5 rounded-lg p-4 border border-purple-500/20">
                <div className="flex justify-between items-center">
                  <span className="text-white/70">🟣 Your USDC on Solana:</span>
                  <span className="text-white font-semibold">
                    ${solanaBalance || "0"}
                  </span>
                </div>
              </div>
            )}

            {walletType === WalletTypes.PHANTOM && !evmConnected && (
              <div className="bg-white/5 rounded-lg p-4 border border-blue-500/20">
                <div className="flex items-center justify-between">
                  <div className="text-white/70">
                    Connect an EVM wallet to receive bridged USDC on Base
                  </div>
                  <ConnectButton showBalance={false} chainStatus="none" />
                </div>
              </div>
            )}

            {/* Base Balance */}
            <div
              className={`rounded-lg p-4 ${walletType === WalletTypes.PHANTOM
                ? "bg-white/5 border border-blue-500/20"
                : "bg-white/5"
                }`}
            >
              <div className="flex justify-between items-center">
                <span className="text-white/70">🔵 Your USDC on Base:</span>
                <span className="text-white font-semibold">
                  ${userBalance.usdc}
                </span>
              </div>
            </div>

            {isCheckingBalance && (
              <div className="flex items-center gap-2 text-white/60">
                <Loader className="w-4 h-4 animate-spin" />
                <span className="text-sm">Updating balance...</span>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
            <button
              onClick={clearError}
              className="text-red-300 hover:text-red-200 text-sm mt-2 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Bridge Guidance Card */}
        {showBridgeGuidance && !isBridging && step === "select" && (
          <div className="mb-6 space-y-4">
            {/* EVM Wallet Connection Prompt */}
            {!evmConnected && (
              <div className="glass-premium rounded-xl p-5 border border-yellow-500/30 bg-yellow-500/5">
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-2xl flex-shrink-0">🔗</span>
                  <div>
                    <h4 className="text-white font-semibold mb-1">
                      Connect EVM Wallet
                    </h4>
                    <p className="text-gray-300 text-sm">
                      To bridge from Solana to Base, you need both wallets
                      connected:
                    </p>
                    <ul className="text-gray-400 text-sm mt-2 space-y-1 ml-4">
                      <li>✅ Solana wallet (Phantom) - Connected</li>
                      <li>
                        ⚠️ EVM wallet (MetaMask/Rainbow/Phantom EVM) - Not
                        connected
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="flex justify-center">
                  <ConnectButton />
                </div>
              </div>
            )}

            <BridgeGuidanceCard
              sourceChain="solana"
              sourceBalance={solanaBalance || "0"}
              targetBalance={userBalance?.usdc || "0"}
              requiredAmount={totalCost}
              onBridge={(amt, protocol) => handleStartBridge(amt, protocol)}
              onDismiss={() => setShowBridgeGuidance(false)}
              skipProtocolSelection={selectedBridgeProtocol !== null}
              preselectedProtocol={selectedBridgeProtocol || "wormhole"}
              evmConnected={evmConnected}
              evmAddress={evmAddress}
            />
          </div>
        )}

        {/* Inline Bridge Flow */}
        {isBridging && (
          <div className="mb-6">
            <FocusedBridgeFlow
              sourceChain="solana"
              destinationChain="base"
              amount={bridgeAmount || totalCost}
              recipient={evmAddress || ""}
              onComplete={handleBridgeComplete}
              onError={handleBridgeError}
              onCancel={() => {
                setIsBridging(false);
                setShowBridgeGuidance(true);
              }}
              preselectedProtocol={selectedBridgeProtocol || undefined}
            />
          </div>
        )}

        {/* Content based on step */}
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-white" />
            </div>
          }
        >
          {renderStep()}
        </Suspense>

        {/* Share Modal - Restored for user delight */}
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          ticketCount={purchasedTicketCount}
          prizeAmount={prizeAmount}
          syndicateName={selectedSyndicate?.name}
        />
      </div>
    </div>
  );
}