"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";
import { Button } from "@/shared/components/ui/Button";
import {
  AlertCircle,
  CircleCheck,
  Clock,
  Loader,
  Zap,
  DollarSign,
  Calendar,
  RotateCcw,
  TrendingUp,
  Bot,
  Brain,
  Terminal,
  Coins,
} from "lucide-react";
import { useERC7715 } from "@/hooks/useERC7715";
import { AdvancedPermissionsTooltip } from "@/components/common/InfoTooltip";
import { CONTRACTS } from "@/services/bridges/protocols/stacks";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { getPermissionPresets } from "@/domains/wallet/services/advancedPermissionsService";
import { stacksX402Service } from "@/domains/wallet/services/stacksX402Service";
import type { AutoPurchaseConfig } from "@/domains/wallet/types";

type Step = "select-type" | "configure" | "review" | "approving" | "success" | "error";
type AgentStrategy = "scheduled" | "autonomous";

interface PurchaseConfig {
  strategy: AgentStrategy;
  amount: number;
  frequency: "weekly" | "monthly" | "opportunistic";
  ticketCount: number;
  totalAmount: number;
  paymentToken: 'usdc' | 'usdt' | 'usdcx' | 'sbtc';
  // Extended fields for internal use (persisted to localStorage)
  permission?: {
    permissionId: string;
    auth: string;
    signature: string;
  };
  enabled?: boolean;
  tokenAddress?: string;
}

interface AutoPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (config: PurchaseConfig | AutoPurchaseConfig) => void;
}

export function AutoPurchaseModal({
  isOpen,
  onClose,
  onSuccess,
}: AutoPurchaseModalProps) {
  const [step, setStep] = useState<Step>("select-type");
  const [config, setConfig] = useState<PurchaseConfig>({
    strategy: "scheduled",
    amount: 10,
    frequency: "weekly",
    ticketCount: 10,
    totalAmount: 50,
    paymentToken: 'usdc',
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { address, chainId, walletType } = useWalletConnection();
  const {
    isRequesting,
    error,
    permissions,
    clearError,
    isLoading,
    requestAdvancedPermission,
    createAutoPurchaseSession,
  } = useERC7715();

  // Check for Stacks wallet and x402 eligibility
  const isStacksWallet = walletType === 'stacks';
  const isEvmWallet = walletType === 'evm';
  
  // For Stacks wallets, we don't need ERC7715 - use x402 instead
  const effectiveLoading = isStacksWallet ? false : isLoading;
  const effectivePermissions = isStacksWallet ? [] : permissions;

  const permission = effectivePermissions[0] || null;

  const requestPresetPermission = async (preset: 'weekly' | 'monthly'): Promise<boolean> => {
    if (!chainId) return false;
    const numericChainId = typeof chainId === 'string' ? parseInt(chainId, 16) : chainId;
    const presets = getPermissionPresets(numericChainId);
    const presetConfig = presets[preset];
    if (!presetConfig) return false;

    const result = await requestAdvancedPermission(
      presetConfig.scope,
      presetConfig.tokenAddress,
      presetConfig.limit,
      presetConfig.period
    );
    return !!result;
  };

  useEffect(() => {
    const ticketCount = Math.floor(config.amount);
    setConfig((prev) => ({
      ...prev,
      ticketCount,
      totalAmount:
        config.frequency === "weekly" ? config.amount * 5 : config.amount * 20,
    }));
  }, [config.amount, config.frequency]);

  if (isOpen && isLoading) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md bg-gradient-to-br from-slate-900 to-indigo-900 text-white">
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader className="w-12 h-12 text-indigo-400 animate-spin" />
            <p className="text-lg font-semibold">Loading permissions...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const amount = parseFloat(e.target.value) || 0;
    setConfig((prev) => ({ ...prev, amount }));
  };

  const handleFrequencyChange = (frequency: "weekly" | "monthly") => {
    setConfig((prev) => ({ ...prev, frequency }));
  };

  const handleApprove = async () => {
    setStep("approving");
    setErrorMessage(null);

    // Handle Autonomous WDK or No-Loss Flow
    if (config.strategy === 'autonomous' || config.strategy === 'no-loss' as any) {
      try {
        console.log(`[Automation] Activating ${config.strategy} strategy...`);
        // Simulate activation
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const storageKey = config.strategy === 'autonomous' ? 'syndicate_wdk_enabled' : 'syndicate_noloss_enabled';
        const configKey = config.strategy === 'autonomous' ? 'syndicate_wdk_config' : 'syndicate_noloss_config';

        localStorage.setItem(storageKey, 'true');
        localStorage.setItem(configKey, JSON.stringify({
          amount: config.amount,
          strategy: config.strategy === 'autonomous' ? 'opportunistic' : 'weekly',
          activatedAt: Date.now()
        }));

        setStep("success");
        if (onSuccess) {
          setTimeout(() => onSuccess(config as any), 2000);
        }
      } catch (err) {
        setErrorMessage(`Failed to deploy ${config.strategy} agent. Please try again.`);
        setStep("error");
      }
      return;
    }

    // Handle Stacks x402 flow
    if (isStacksWallet) {
      try {
        const paymentToken = config.paymentToken || 'usdcx'; // P0.2 FIX: Use typed config
        const tokenAddress = paymentToken === 'sbtc' 
          ? CONTRACTS.sBTC 
          : CONTRACTS.USDCx;

        // Create x402 authorization via SIP-018 signature
        const result = await stacksX402Service.authorizeRecurringPayment({
          beneficiary: CONTRACTS.LOTTERY,
          token: tokenAddress,
          maxAmount: BigInt(config.amount * (config.frequency === 'weekly' ? 7 : 30) * 10 ** 6),
          frequency: config.frequency === 'opportunistic' ? 'weekly' : config.frequency,
        });

        if (result.success) {
          // Store the authorization for future auto-purchases
          // Note: Extended type with auth info for localStorage, but onSuccess uses PurchaseConfig
          const executorConfig = {
            authorizationId: result.authorizationId,
            signature: result.signature,
            paymentToken,
            frequency: config.frequency,
            ticketCount: config.ticketCount,
            amount: config.amount,
            totalAmount: config.totalAmount,
            nextExecutionTime: Date.now() + (config.frequency === 'weekly' ? 7 : 30) * 24 * 60 * 60 * 1000,
          };
          localStorage.setItem(
            'syndicate_stacks_autopurchase',
            JSON.stringify(executorConfig),
          );

          setStep("success");
          if (onSuccess) {
            // Pass PurchaseConfig without auth fields (onSuccess callback expects PurchaseConfig)
            const successConfig: PurchaseConfig = {
              strategy: config.strategy,
              amount: config.amount,
              frequency: config.frequency,
              ticketCount: config.ticketCount,
              totalAmount: config.totalAmount,
              paymentToken: config.paymentToken,
            };
            setTimeout(() => onSuccess(successConfig), 2000);
          }
        } else {
          throw new Error(result.error || 'Failed to authorize recurring payment');
        }
      } catch (err) {
        let friendlyMessage = "Unable to set up auto-purchase on Stacks.";
        if (err instanceof Error) {
          const errMsg = err.message.toLowerCase();
          if (errMsg.includes('user rejected') || errMsg.includes('cancelled')) {
            friendlyMessage = "You cancelled the signature request. No problem - you can enable auto-purchase anytime!";
          } else if (errMsg.includes('not supported')) {
            friendlyMessage = "Your wallet doesn't support SIP-018 signatures. Please use a compatible Stacks wallet.";
          }
        }
        setErrorMessage(friendlyMessage);
        setStep("error");
      }
      return;
    }

    // Handle EVM ERC-7715 flow (original logic)
    try {
      let limit;
      switch (config.frequency) {
        case "weekly":
          limit = BigInt(config.amount * 7 * 10 ** 6);
          break;
        case "monthly":
          limit = BigInt(config.amount * 30 * 10 ** 6);
          break;
        default:
          limit = BigInt(config.amount * 7 * 10 ** 6);
      }

      const erc20Request = {
        scope: "erc20-token-periodic",
        tokenAddress: CONTRACTS.USDC,
        limit,
        period: config.frequency === 'opportunistic' ? 'weekly' : config.frequency,
      };

      const result = await requestPresetPermission(
        config.frequency === 'opportunistic' ? 'weekly' : config.frequency
      );

      if (result && permission) {
        const frequency = config.frequency;
        const amountPerPeriod = BigInt(config.amount * 10 ** 6);
        const ticketCount = config.ticketCount;

        const autoConfig: any = {
          enabled: true,
          permission,
          frequency,
          amountPerPeriod,
          tokenAddress: CONTRACTS.USDC,
          lastExecuted: undefined,
          nextExecution:
            Date.now() +
            (frequency === "weekly"
              ? 7 * 24 * 60 * 60 * 1000
              : 30 * 24 * 60 * 60 * 1000),
        };

        try {
          const executorConfig = {
            permissionId: permission.id,
            frequency,
            ticketCount,
            nextExecutionTime: autoConfig.nextExecution,
          };
          localStorage.setItem(
            "syndicate_autopurchase_config",
            JSON.stringify(executorConfig),
          );
        } catch {}

        try {
          await createAutoPurchaseSession(permission.id, 4);
        } catch {}

        setStep("success");
        if (onSuccess) {
          setTimeout(() => onSuccess(autoConfig), 2000);
        }
      } else {
        const errorStr =
          typeof error === "string" ? error : "Permission request failed";
        const friendlyError = error
          ? errorStr.includes("User rejected") ||
            errorStr.includes("user denied") ||
            errorStr.includes("User denied")
            ? "You cancelled the permission request. No worries - you can try again anytime!"
            : errorStr.includes("not supported") ||
                errorStr.includes("not available")
              ? "Auto-purchase requires MetaMask Flask. Please install Flask from flask.metamask.io"
              : errorStr
          : "Failed to set up auto-purchase. Please try again.";
        setErrorMessage(friendlyError);
        setStep("error");
      }
    } catch (err) {
      let friendlyMessage = "Unable to set up auto-purchase.";
      if (err instanceof Error) {
        const errMsg = err.message.toLowerCase();
        if (
          errMsg.includes("user rejected") ||
          errMsg.includes("user denied") ||
          errMsg.includes("denied")
        ) {
          friendlyMessage =
            "You cancelled the permission request. No problem - you can enable auto-purchase anytime from settings!";
        } else if (
          errMsg.includes("not supported") ||
          errMsg.includes("not available") ||
          errMsg.includes("not a function")
        ) {
          friendlyMessage =
            "Auto-purchase requires MetaMask Flask with Advanced Permissions. Please install Flask from flask.metamask.io to use this feature.";
        } else if (
          errMsg.includes("network") ||
          errMsg.includes("connection")
        ) {
          friendlyMessage =
            "Network connection issue. Please check your internet and try again.";
        } else {
          friendlyMessage = `Unable to set up auto-purchase: ${err.message}`;
        }
      }
      setErrorMessage(friendlyMessage);
      setStep("error");
    }
  };

  const handleRetry = () => {
    setErrorMessage(null);
    clearError();
    setStep("configure");
  };

  const handleClose = () => {
    setStep("configure");
    setConfig({
      strategy: 'scheduled',
      amount: 10,
      frequency: "weekly",
      ticketCount: 10,
      totalAmount: 50,
      paymentToken: 'usdcx',
    });
    setErrorMessage(null);
    clearError();
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white border border-blue-500/30 shadow-2xl shadow-blue-500/20">
        {step === "select-type" && (
          <div className="space-y-6">
            <DialogHeader className="text-center">
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-white" />
                </div>
              </div>
              <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                Choose Your Strategy
              </DialogTitle>
              <DialogDescription className="text-gray-300">
                How would you like to automate your syndicate participation?
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-4">
              {/* SCHEDULED OPTION (EVM Native or Cross-Chain) */}
              <button
                onClick={() => {
                  setConfig(prev => ({ ...prev, strategy: 'scheduled', paymentToken: 'usdc', frequency: 'weekly' }));
                  setStep('configure');
                }}
                className={`group relative p-4 rounded-xl border-2 transition-all text-left ${
                  (walletType === 'evm' || !walletType) ? 'border-blue-500 bg-slate-800' : 'border-slate-700 bg-slate-800/50 hover:border-blue-500 hover:bg-slate-800'
                }`}
              >
                {(walletType === 'evm' || !walletType) && (
                  <div className="absolute -top-2 -right-2 bg-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter">
                    Native
                  </div>
                )}
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white">Scheduled Automation</h4>
                    <p className="text-xs text-gray-400 mt-1">
                      Set a fixed amount and frequency. Uses <strong>USDC</strong> on Base.
                    </p>
                  </div>
                </div>
              </button>

              {/* AUTONOMOUS OPTION (WDK - AI) */}
              <button
                onClick={() => {
                  setConfig(prev => ({ ...prev, strategy: 'autonomous', paymentToken: 'usdt', frequency: 'opportunistic' }));
                  setStep('configure');
                }}
                className={`group relative p-4 rounded-xl border-2 transition-all text-left ${
                  walletType === 'solana' ? 'border-indigo-500 bg-slate-800' : 'border-slate-700 bg-slate-800/50 hover:border-indigo-500 hover:bg-slate-800'
                }`}
              >
                <div className="absolute -top-2 -right-2 bg-indigo-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter">
                  Recommended
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Brain className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white">Autonomous AI Agent</h4>
                    <p className="text-xs text-gray-400 mt-1">
                      AI decides when to buy based on yield. Uses <strong>USD₮</strong> and Tether WDK.
                    </p>
                  </div>
                </div>
              </button>

              {/* NO-LOSS OPTION (PoolTogether) */}
              <button
                onClick={() => {
                  setConfig(prev => ({ ...prev, strategy: 'no-loss' as any, paymentToken: 'usdc', frequency: 'weekly' }));
                  setStep('configure');
                }}
                className="group relative p-4 rounded-xl border-2 border-slate-700 bg-slate-800/50 hover:border-emerald-500 hover:bg-slate-800 transition-all text-left"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Coins className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white">No-Loss Savings Agent</h4>
                    <p className="text-xs text-gray-400 mt-1">
                      100% principal protection via <strong>PoolTogether v5</strong>. Keep your funds, win prizes.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <Button
              onClick={handleClose}
              variant="ghost"
              className="w-full text-gray-400 hover:text-white"
            >
              Maybe Later
            </Button>
          </div>
        )}

        {step === "configure" && (
          <div className="space-y-6">
            <DialogHeader className="text-center">
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
              </div>
              <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Enable Auto-Purchase
              </DialogTitle>
              <DialogDescription className="text-gray-300">
                {isStacksWallet 
                  ? 'Set up automatic purchases using SIP-018 signatures on Stacks'
                  : 'Set up automatic lottery ticket purchases with custom amounts'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">
                  {config.strategy === 'autonomous' ? 'Initial Agent Wallet Funding' : 'Amount per period'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={config.amount}
                    onChange={handleAmountChange}
                    className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter amount"
                  />
                </div>
                <p className="text-xs text-gray-400">
                  {config.strategy === 'autonomous' 
                    ? `How much ${config.paymentToken.toUpperCase()} to transfer to your AI agent wallet`
                    : `How much ${config.paymentToken.toUpperCase()} to spend per ${config.frequency}`}
                </p>
              </div>

              {config.strategy !== 'autonomous' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300">
                    Purchase frequency
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["weekly", "monthly"] as const).map((freq) => (
                      <button
                        key={freq}
                        onClick={() => handleFrequencyChange(freq)}
                        className={`py-3 px-2 rounded-lg border text-sm font-medium transition-all ${
                          config.frequency === freq
                            ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/30"
                            : "bg-slate-800/50 border-slate-600 text-gray-300 hover:bg-slate-700/50"
                        }`}
                      >
                        <div className="flex flex-col items-center">
                          <Calendar className="w-4 h-4 mb-1" />
                          <span className="capitalize">{freq}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {config.strategy === 'autonomous' && (
                <div className="bg-indigo-900/30 border border-indigo-700/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-indigo-400" />
                    <h4 className="text-sm font-bold text-indigo-200 uppercase tracking-wider">Voyager Intelligence</h4>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] text-indigo-100/70 leading-relaxed">
                      Your agent will use these funds to purchase tickets when yield or market conditions are most favorable.
                    </p>
                    <div className="flex items-center gap-2 px-2 py-1.5 bg-indigo-950/50 rounded border border-indigo-500/20">
                      <Terminal className="w-3 h-3 text-indigo-400" />
                      <span className="text-[10px] font-mono text-indigo-300">Strategy: Yield-Optimized Opportunistic</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-slate-800/50 border border-slate-600 rounded-xl p-4">
                <h4 className="font-semibold text-gray-300 mb-3">Your Setup</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">
                      Amount per {config.frequency}:
                    </span>
                    <span className="font-semibold text-white">
                      ${config.amount} USDC
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">
                      Tickets per {config.frequency}:
                    </span>
                    <span className="font-semibold text-white">
                      {config.ticketCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">
                      Total monthly estimate:
                    </span>
                    <span className="font-semibold text-white">
                      ${config.totalAmount} USDC
                    </span>
                  </div>
                </div>
              </div>

              {/* ENHANCEMENT: Reusable Gamified Yield Upsell (Drift Vault) */}
              {config.totalAmount > 0 && (
                <div className="bg-gradient-to-r from-indigo-500/20 to-purple-500/10 border border-indigo-500/30 rounded-lg p-4 space-y-3 relative overflow-hidden mt-4">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                  <div className="flex items-start gap-3 relative z-10">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0 border border-indigo-500/40">
                      <TrendingUp className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white mb-1 tracking-tight">
                        Why drain your wallet? ♾️
                      </h4>
                      <p className="text-xs text-indigo-200 leading-relaxed">
                        Instead of spending ${config.totalAmount} a {config.frequency}, deposit ${Math.round((config.totalAmount * 12) / 0.225)} into the <span className="text-indigo-300 font-semibold">Drift Lossless Vault</span>. Let the ~22.5% APY yield fund these tickets forever while you keep your principal.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full text-xs bg-indigo-500/20 hover:bg-indigo-500/30 border-indigo-500/30 text-indigo-100 transition-colors"
                    onClick={() => {
                      onClose();
                      window.location.href = '/yield-strategies';
                    }}
                  >
                    Try Yield-to-Tickets
                  </Button>
                </div>
              )}

              {/* Stacks-specific: Token and x402 info */}
              {isStacksWallet && (
                <div className="bg-purple-900/30 border border-purple-700/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <Zap className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-purple-300 mb-1">
                        x402 Auto-Purchase on Stacks
                      </p>
                      <ul className="text-xs text-purple-200 space-y-1">
                        <li>• Authorize recurring purchases with SIP-018 signature</li>
                        <li>• No manual signing required after setup</li>
                        <li>• Works with USDCx or sBTC</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="space-y-2 pt-2 border-t border-purple-700/30">
                    <label className="block text-xs font-medium text-purple-300">
                      Payment Token
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['usdcx', 'sbtc'] as const).map((token) => (
                        <button
                          key={token}
                          onClick={() => setConfig(prev => ({ ...prev, paymentToken: token }))}
                          className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                            config.paymentToken === token
                              ? "bg-purple-600 border-purple-500 text-white"
                              : "bg-purple-900/30 border-purple-700/50 text-purple-200 hover:bg-purple-800/30"
                          }`}
                        >
                          {token.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* EVM-specific info */}
              {!isStacksWallet && (
              <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-300 mb-1">
                      How Auto-Purchase Works
                    </p>
                    <ul className="text-xs text-blue-200 space-y-1">
                      <li>
                        • You approve spending up to ${config.amount} per{" "}
                        {config.frequency}
                      </li>
                      <li>• Syndicate purchases tickets automatically</li>
                      <li>• You can revoke permission anytime from settings</li>
                      <li>
                        • Only works with MetaMask Flask Advanced Permissions
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              )}
            </div>

            <Button
              onClick={() => setStep("review")}
              disabled={config.amount <= 0}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 py-3 font-semibold text-lg"
            >
              Review & Approve
            </Button>
            <Button
              onClick={handleClose}
              variant="ghost"
              className="w-full text-gray-400 hover:text-white"
            >
              Cancel
            </Button>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-6">
            <DialogHeader className="text-center">
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                  <CircleCheck className="w-6 h-6 text-white" />
                </div>
              </div>
              <DialogTitle className="text-2xl font-bold">
                Review Your Setup
              </DialogTitle>
              <DialogDescription className="text-gray-300">
                {isStacksWallet 
                  ? 'Confirm the auto-purchase details before signing'
                  : 'Confirm the auto-purchase details before approving'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="bg-slate-800/50 border border-slate-600 rounded-xl p-5 space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                  <h3 className="font-semibold text-lg">
                    {isStacksWallet ? 'x402 Authorization Details' : 'Permission Details'}
                  </h3>
                  <div className="px-3 py-1 bg-green-900/30 text-green-400 rounded-full text-xs font-medium">
                    Active
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Frequency:</span>
                    <span className="font-semibold capitalize text-white">
                      {config.frequency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Amount:</span>
                    <span className="font-semibold text-white">
                      ${config.amount} USDC
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Tickets:</span>
                    <span className="font-semibold text-white">
                      {config.ticketCount} per {config.frequency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Token:</span>
                    <span className="font-mono text-sm text-white">
                      {isStacksWallet 
                        ? config.paymentToken.toUpperCase() + ' (Stacks)'
                        : 'USDC (Base)'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total monthly:</span>
                    <span className="font-semibold text-white">
                      ~${config.totalAmount} USDC
                    </span>
                  </div>
                </div>
              </div>

              {/* Different warning/info for Stacks vs EVM */}
              {isStacksWallet ? (
              <div className="bg-purple-900/30 border border-purple-700/50 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Zap className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-purple-200">
                      You will sign this authorization with your Stacks wallet. 
                      Your x402 permission enables automatic ticket purchases without 
                      signing each transaction.
                    </p>
                  </div>
                </div>
              </div>
              ) : (
              <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-200">
                      You will approve this permission in MetaMask. You can
                      revoke it anytime from settings.
                    </p>
                  </div>
                </div>
              </div>
              )}
            </div>

            <div className="flex gap-3 mt-4">
              <Button
                onClick={() => setStep("configure")}
                variant="outline"
                className="flex-1 border-slate-600 text-white hover:bg-slate-700/50"
              >
                Back
              </Button>
              <Button
                onClick={handleApprove}
                disabled={isRequesting}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {isRequesting ? (
                  <span className="flex items-center">
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    {isStacksWallet ? 'Signing...' : 'Approving...'}
                  </span>
                ) : (
                  isStacksWallet ? 'Sign with Stacks Wallet' : 'Approve in MetaMask'
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "approving" && (
          <div className="space-y-6">
            <DialogHeader className="text-center">
              <DialogTitle className="text-2xl font-bold">
                Waiting for Approval
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center py-8 space-y-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center animate-pulse">
                <Loader className="w-10 h-10 text-white animate-spin" />
              </div>
              <div className="text-center space-y-3">
                <p className="text-xl font-semibold text-white">
                  {/* P0.3 FIX: Wallet-aware copy for Stacks vs EVM */}
                  {isStacksWallet ? 'Sign SIP-018 Authorization' : 'Confirm in MetaMask'}
                </p>
                <p className="text-gray-300 max-w-md">
                  {isStacksWallet
                    ? 'Please sign the SIP-018 authorization in your Stacks wallet. This enables recurring ticket purchases.'
                    : 'Please approve the permission request in your MetaMask wallet. This allows Syndicate to purchase tickets automatically.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="space-y-6">
            <DialogHeader className="text-center">
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center animate-pulse">
                  <CircleCheck className="w-8 h-8 text-white" />
                </div>
              </div>
              <DialogTitle className="text-2xl font-bold">Success!</DialogTitle>
              <DialogDescription className="text-gray-300">
                {isStacksWallet 
                  ? 'x402 authorization is now active'
                  : 'Auto-purchase is now enabled'}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center py-4 space-y-4">
              <div className="text-center space-y-3">
                <p className="text-lg font-semibold text-white">
                  {isStacksWallet 
                    ? 'x402 Authorization Granted'
                    : 'Permission granted successfully'}
                </p>
                <p className="text-gray-300 max-w-sm">
                  {isStacksWallet 
                    ? `Your ${(config.paymentToken || 'usdcx').toUpperCase()} is now authorized for automatic ticket purchases. No manual signing required for recurring buys.`
                    : 'Your auto-purchase is now active. Tickets will be purchased automatically according to your schedule. You can manage this in Settings.'}
                </p>
              </div>
            </div>
            <Button
              onClick={handleClose}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 py-3 font-semibold"
            >
              Got it
            </Button>
          </div>
        )}

        {step === "error" && (
          <div className="space-y-6">
            <DialogHeader className="text-center">
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-red-500 to orange-600 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
              </div>
              <DialogTitle className="text-2xl font-bold">
                Setup Failed
              </DialogTitle>
              <DialogDescription className="text-gray-300">
                Unable to enable automatic ticket purchases
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center py-4 space-y-6">
              <div className="text-center space-y-4 max-w-sm">
                {errorMessage && (
                  <p className="text-gray-300 leading-relaxed">
                    {errorMessage}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <Button
                onClick={handleClose}
                variant="outline"
                className="flex-1 border-slate-600 text-white hover:bg-slate-700/50"
              >
                Close
              </Button>
              <Button
                onClick={handleRetry}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Try Again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
