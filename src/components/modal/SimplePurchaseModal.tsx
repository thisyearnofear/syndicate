/**
 * SIMPLIFIED PURCHASE MODAL
 *
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Replaces 418-line PurchaseModal with streamlined version
 * - CLEAN: Single responsibility - purchase UX flow
 * - MODULAR: Uses useSimplePurchase hook + orchestrator
 *
 * Replaces: PurchaseModal.tsx (418 lines)
 * Consolidates: ModeStep, SelectStep, ProcessingStep, SuccessStep
 *
 * Flow: Connect → Select Chain/Amount → Execute → Success
 * No yield/syndicate features in MVP
 */

import { useState, Suspense, lazy, useEffect } from "react";
import type { ReactNode } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Loader, AlertCircle, Check, Zap, Link2, ChevronDown, TrendingUp, ArrowRight, Wallet, Shield, DollarSign, Bitcoin } from "lucide-react";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { useSimplePurchase } from "@/hooks/useSimplePurchase";
import { useERC7715 } from "@/hooks/useERC7715";
import WalletConnectionManager from "@/components/wallet/WalletConnectionManager";
import {
  CompactStack,
  CompactCard,
} from "@/shared/components/premium/CompactLayout";
import { BalanceDisplay } from "@/components/modal/BalanceDisplay";
import { AutoPurchaseModal } from "./AutoPurchaseModal";
import {
  CrossChainTracker,
  type SourceChainType,
  type TrackerStatus,
} from "@/components/bridge/CrossChainTracker";
import { CostBreakdown } from "@/components/bridge/CostBreakdown";
import { TimeEstimate } from "@/components/bridge/TimeEstimate";
import { CONTRACTS } from "@/services/bridges/protocols/stacks";
import { STRK_ADDRESSES } from "@/services/bridges/types";

// Lazy load celebration modal
const CelebrationModal = lazy(() => import("./CelebrationModal"));

type PurchaseStep = "connect" | "select" | "approve" | "processing" | "success";

// Helper function to get explorer URLs
const getExplorerUrl = (chain: SourceChainType, txHash: string): string => {
  switch (chain) {
    case "solana":
      return `https://solscan.io/tx/${txHash}`;
    case "near":
      return `https://explorer.near.org/transactions/${txHash}`;
    case "stacks":
      return `https://explorer.stacks.co/txid/${txHash}?chain=mainnet`;
    case "base":
      return `https://basescan.org/tx/${txHash}`;
    case "ethereum":
      return `https://etherscan.io/tx/${txHash}`;
    default:
      return "#";
  }
};

// P1.1: DRY helper for CrossChainTracker section
const renderTrackerSection = ({
  chain,
  sourceTxHash,
  destinationTxHash,
  status,
  error,
  ticketCount,
  walletInfo,
  showActions = true,
  statusLinkCopied = false,
  onCopyLink,
  customLink,
  customButtons,
}: {
  chain: SourceChainType;
  sourceTxHash?: string | null;
  destinationTxHash?: string | null;
  status: TrackerStatus;
  error?: string | null;
  ticketCount: number;
  walletInfo?: { sourceAddress?: string; baseAddress?: string; isLinked?: boolean };
  showActions?: boolean;
  statusLinkCopied?: boolean;
  onCopyLink?: () => void;
  customLink?: React.ReactNode;
  customButtons?: React.ReactNode;
}) => {
  // Convert null to undefined for CrossChainTracker props
  const txId = sourceTxHash ?? undefined;
  const destTxId = destinationTxHash ?? undefined;
  const txError = error ?? undefined;
  const explorerUrl = txId ? getExplorerUrl(chain, txId) : undefined;
  
  return (
    <div>
      <CrossChainTracker
        status={status}
        sourceChain={chain}
        sourceTxId={txId}
        baseTxId={destTxId}
        error={txError}
        ticketCount={ticketCount}
        walletInfo={walletInfo}
        receipt={{
          sourceExplorer: explorerUrl,
          baseExplorer: destTxId
            ? `https://basescan.org/tx/${destTxId}`
            : undefined,
          megapotApp: `/my-tickets`,
        }}
      />
      {showActions && (
        <div className="mt-4">
          {customLink || (sourceTxHash && (
            <div className="flex items-center gap-3">
              <a
                href={`/purchase-status/${sourceTxHash}/track`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                Open Live Tracker →
              </a>
              {onCopyLink && (
                <button
                  type="button"
                  onClick={onCopyLink}
                  className="text-xs text-gray-300 hover:text-white inline-flex items-center gap-1"
                >
                  <Link2 className="w-3 h-3" />
                  {statusLinkCopied ? "Copied" : "Copy Link"}
                </button>
              )}
            </div>
          ))}
          {customButtons}
        </div>
      )}
    </div>
  );
};

export interface SimplePurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SimplePurchaseModal({
  isOpen,
  onClose,
}: SimplePurchaseModalProps) {
  const { isConnected, address, walletType, mirrorAddress } = useWalletConnection();
  const {
    purchase,
    isPurchasing,
    error,
    txHash,
    clearError,
    reset,
    status,
    sourceChain,
    sourceTxHash,
    destinationTxHash,
    walletInfo,
  } = useSimplePurchase();
  const { permissions, isSupported } = useERC7715();

  const [step, setStep] = useState<PurchaseStep>("connect");
  const [ticketCount, setTicketCount] = useState(1);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [statusLinkCopied, setStatusLinkCopied] = useState(false);
  const [stacksToken, setStacksToken] = useState<'usdcx' | 'sbtc'>('usdcx');
  const [showAdvancedToken, setShowAdvancedToken] = useState(false);
  const [btcUsdPrice, setBtcUsdPrice] = useState<number | null>(null);
  const [starknetToken, setStarknetToken] = useState<'usdc' | 'strk'>('usdc');
  // Task 3: Load saved Base address from localStorage (user preference)
  const [baseAddress, setBaseAddress] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('syndicate_base_address') || '' : ''
  );
  const [baseAddressError, setBaseAddressError] = useState('');
  const [baseAddressSource, setBaseAddressSource] = useState<'manual' | 'auto'>('manual');
  const [stacksBalance, setStacksBalance] = useState<string | null>(null);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const hasActivePermission = permissions.length > 0 && isSupported;

  // Persist Base address to localStorage
  useEffect(() => {
    if (/^0x[a-fA-F0-9]{40}$/.test(baseAddress)) {
      localStorage.setItem('syndicate_base_address', baseAddress);
    }
  }, [baseAddress]);

  // P0.1 FIX: Derive selectedChain from walletType BEFORE purchase
  // This fixes the bug where sourceChain is only set during/after purchase
  // but is needed for token selectors, estimates, and request params
  const selectedChain = (() => {
    if (sourceChain) return sourceChain; // Use result after purchase
    if (walletType === 'evm') return 'base';
    if (walletType === 'stacks') return 'stacks';
    if (walletType === 'solana') return 'solana';
    if (walletType === 'near') return 'near';
    if (walletType === 'starknet') return 'starknet';
    return undefined;
  })();

  // Show token selectors for relevant chains
  const showStacksTokenSelector = selectedChain === 'stacks';
  const showStarknetTokenSelector = selectedChain === 'starknet';
  const showCrossChainUI = selectedChain && selectedChain !== 'base' && selectedChain !== 'ethereum';

  // Validate Base address for cross-chain purchases
  const isValidBaseAddress = /^0x[a-fA-F0-9]{40}$/.test(baseAddress);
  const needsBaseAddress = showCrossChainUI;

  // Auto-populate Base address from mirror address (derived from Stacks public key)
  useEffect(() => {
    if (needsBaseAddress && !baseAddress && mirrorAddress && /^0x[a-fA-F0-9]{40}$/.test(mirrorAddress)) {
      setBaseAddress(mirrorAddress);
      setBaseAddressSource('auto');
    }
  }, [needsBaseAddress, mirrorAddress, baseAddress]);

  // Task 3: Persist Base address to localStorage when user manually enters it
  const handleBaseAddressChange = (val: string) => {
    setBaseAddress(val);
    setBaseAddressSource('manual');
    if (/^0x[a-fA-F0-9]{40}$/.test(val)) {
      try { localStorage.setItem('syndicate_base_address', val); } catch {}
    }
  };

  // Fetch Stacks token balance
  useEffect(() => {
    if (selectedChain !== 'stacks' || !address) return;
    setIsCheckingBalance(true);
    const tokenPrincipal = stacksToken === 'sbtc'
      ? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token'
      : 'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx';
    fetch(`/api/stacks-lottery?endpoint=/extended/v1/address/${address}/balances`)
      .then((res) => {
        if (!res.ok) return '0';
        return res.json().then((data: Record<string, unknown>) => {
          const fungibleTokens = (data.fungible_tokens || {}) as Record<string, { balance?: string }>;
          const matchingKey = Object.keys(fungibleTokens).find((key) => key.startsWith(tokenPrincipal));
          const tokenBalance = matchingKey ? fungibleTokens[matchingKey]?.balance || '0' : '0';
          const decimals = tokenPrincipal.toLowerCase().includes('sbtc') ? 8 : 6;
          return (parseFloat(tokenBalance) / Math.pow(10, decimals)).toString();
        });
      })
      .then((bal) => setStacksBalance(bal))
      .catch(() => setStacksBalance(null))
      .finally(() => setIsCheckingBalance(false));
  }, [selectedChain, address, stacksToken, refreshKey]);

  // Show tracker when purchase is in progress
  const showTracker =
    isPurchasing ||
    [
      "confirmed_source",
      "bridging",
      "purchasing",
      "complete",
      "error",
    ].includes(status);

  // Auto-advance to select step when wallet is connected and modal is open
  useEffect(() => {
    if (isOpen && isConnected && address && step === "connect") {
      setStep("select");
    }
  }, [isOpen, isConnected, address, step]);

  // Auto-advance to success when status is complete
  useEffect(() => {
    if (status === "complete" && step === "processing") {
      setStep("success");
    }
  }, [status, step]);

  if (!isOpen) return null;

  const handleClose = () => {
    reset();
    setStep("connect");
    onClose();
  };

  const handlePurchaseClick = async () => {
    if (!isConnected || !address) {
      setStep("connect");
      return;
    }

    setStep("processing");
    
    // P0.1 FIX: Pass selectedChain explicitly to purchase() 
    // This ensures token selectors, estimates, and request params work correctly
    // Validate Base address for cross-chain
    if (needsBaseAddress && !isValidBaseAddress) {
      setBaseAddressError('Please enter a valid Base (EVM) address to receive your tickets');
      setStep('select');
      return;
    }
    setBaseAddressError('');

    const result = await purchase({
      ticketCount,
      userAddress: address,
      chain: selectedChain,
      // Cross-chain: deliver tickets to the user's Base address
      recipientAddress: needsBaseAddress && isValidBaseAddress ? baseAddress : undefined,
      // Pass token principal for Stacks - determines USDCx vs sBTC
      stacksTokenPrincipal: selectedChain === 'stacks' 
        ? (stacksToken === 'sbtc' ? CONTRACTS.sBTC : CONTRACTS.USDCx)
        : undefined,
      // Pass token address for Starknet - determines USDC vs STRK
      starknetTokenAddress: selectedChain === 'starknet'
        ? (starknetToken === 'strk' ? STRK_ADDRESSES.starknet : undefined)
        : undefined,
    });

    if (result.success) {
      // P0.1 FIX: Use result.sourceTxHash + selectedChain to determine cross-chain
      // instead of sourceChain which may not be set yet
      const isCrossChain =
        result.sourceTxHash && selectedChain && selectedChain !== "base" && selectedChain !== "ethereum";
      if (!isCrossChain) {
        setShowCelebration(true);
      }
      setStep("success");
    } else {
      setStep("select");
    }
  };

  const handleCopyStatusLink = async () => {
    if (!sourceTxHash || !sourceChain) return;
    const url = `${window.location.origin}/purchase-status/${sourceTxHash}/track`;
    try {
      await navigator.clipboard.writeText(url);
      setStatusLinkCopied(true);
      setTimeout(() => setStatusLinkCopied(false), 2000);
    } catch {}
  };

  // Render step content
  const renderStep = () => {
    switch (step) {
      case "connect":
        return (
          <CompactStack spacing="md" align="center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Let's Play</h2>
              <p className="text-gray-400">
                Connect your wallet to purchase lottery tickets
              </p>
            </div>
            <WalletConnectionManager />
            <Button variant="outline" className="w-full" onClick={handleClose}>
              Close
            </Button>
          </CompactStack>
        );

      case "select":
      case "approve":
        return (
          <CompactStack spacing="md">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">
                Buy Tickets
              </h2>
              <p className="text-gray-400 text-sm">
                Connected:{" "}
                <span className="text-green-400">
                  {walletType?.toUpperCase()}
                </span>
              </p>
            </div>

            {/* ENHANCEMENT: Show permission status with details */}
            {hasActivePermission && (
              <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <div>
                    <p className="text-green-300 font-medium text-sm">
                      ✓ Auto-Purchase Enabled
                    </p>
                    <p className="text-xs text-green-200 mt-1">
                      Tickets will be automatically purchased on your scheduled
                      frequency without requiring signatures.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-400 font-medium text-sm">{error}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-300 hover:text-red-200 mt-2 px-0"
                    onClick={clearError}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            )}


            {/* ENHANCEMENT: Auto-purchase setup (expanded by default, Base/EVM only, chain-aware) */}
            {!hasActivePermission && isSupported && walletType === "evm" && (
              <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-indigo-300 mb-1">
                      Enable Auto-Purchase
                    </p>
                    <p className="text-xs text-gray-300">
                      Set up automatic weekly or monthly ticket purchases using
                      MetaMask Advanced Permissions. No signing required after
                      setup.
                    </p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setShowPermissionModal(true)}
                >
                  <Zap className="w-3 h-3 mr-1" />
                  Set Up Auto-Purchase
                </Button>
              </div>
            )}

            {walletType === "stacks" && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-purple-300 mb-1">
                      Enable x402 Auto-Purchase
                    </p>
                    <p className="text-xs text-gray-300">
                      Set up automatic weekly or monthly ticket purchases on Stacks.
                      Sign once with SIP-018 — no manual signing after setup.
                    </p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setShowPermissionModal(true)}
                >
                  <Zap className="w-3 h-3 mr-1" />
                  Set Up x402 Auto-Purchase
                </Button>
              </div>
            )}

            {/* Cross-Chain Flow Indicator */}
            {showCrossChainUI && selectedChain && (
              <div className="bg-gradient-to-r from-gray-800/80 to-gray-700/50 border border-gray-600/50 rounded-lg p-3">
                <div className="flex items-center justify-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
                      {selectedChain === 'stacks' ? (
                        <span className="text-xs font-bold text-indigo-300">STX</span>
                      ) : selectedChain === 'solana' ? (
                        <span className="text-xs font-bold text-purple-300">SOL</span>
                      ) : selectedChain === 'near' ? (
                        <span className="text-xs font-bold text-green-300">NEAR</span>
                      ) : (
                        <span className="text-xs font-bold text-blue-300">STRK</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 font-medium">{selectedChain === 'stacks' ? 'Stacks' : selectedChain === 'solana' ? 'Solana' : selectedChain === 'near' ? 'NEAR' : 'Starknet'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-6 h-px bg-gray-500"></div>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                    <div className="w-6 h-px bg-gray-500"></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
                      <span className="text-xs font-bold text-blue-300">B</span>
                    </div>
                    <span className="text-xs text-gray-400 font-medium">Base</span>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 text-center mt-2">Your payment is bridged to Base where lottery tickets are minted</p>
              </div>
            )}

            {/* Base Address Input for Cross-Chain Purchases */}
            {needsBaseAddress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-sm font-medium text-gray-300">
                    <Wallet className="w-3.5 h-3.5 text-blue-400" />
                    Delivery Address (Base)
                  </label>
                  {baseAddressSource === 'auto' && isValidBaseAddress && (
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
                      Auto-detected
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Tickets are minted on Base. {mirrorAddress ? 'We detected your linked EVM address — you can change it below.' : 'Paste your MetaMask or other EVM wallet address.'}
                </p>
                <div className="relative">
                  <input
                    type="text"
                    value={baseAddress}
                    onChange={(e) => {
                      handleBaseAddressChange(e.target.value.trim());
                      setBaseAddressError('');
                    }}
                    placeholder="0x... (your Base/EVM wallet address)"
                    disabled={isPurchasing}
                    className={`w-full px-4 py-3 rounded-lg bg-gray-700/50 border text-white text-sm font-mono placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
                      baseAddressError
                        ? 'border-red-500 focus:ring-red-500/50'
                        : baseAddress && isValidBaseAddress
                        ? 'border-green-500/60 focus:ring-green-500/50'
                        : 'border-gray-600 focus:ring-indigo-500/50'
                    }`}
                  />
                  {baseAddress && isValidBaseAddress && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Check className="w-4 h-4 text-green-400" />
                    </div>
                  )}
                </div>
                {baseAddressError && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {baseAddressError}
                  </p>
                )}
                {baseAddress && isValidBaseAddress && !baseAddressError && (
                  <div className="flex items-center gap-1.5 text-xs text-green-400/80">
                    <Shield className="w-3 h-3" />
                    <span>Verified address — tickets will be delivered here</span>
                  </div>
                )}
                {baseAddress && !isValidBaseAddress && !baseAddressError && (
                  <p className="text-xs text-yellow-400">
                    Enter a valid 0x... address (42 characters)
                  </p>
                )}
              </div>
            )}

            {/* Stacks Token Selector - USDCx default, sBTC behind Advanced toggle */}
            {showStacksTokenSelector && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-sm font-medium text-gray-300">
                    <DollarSign className="w-3.5 h-3.5 text-green-400" />
                    Payment Token
                  </label>
                  <button
                    onClick={() => {
                      const next = !showAdvancedToken;
                      setShowAdvancedToken(next);
                      if (!next) setStacksToken('usdcx');
                      // Fetch BTC price once when Advanced is first opened
                      if (next && btcUsdPrice === null) {
                        fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd')
                          .then(r => r.json())
                          .then(d => setBtcUsdPrice(d?.bitcoin?.usd ?? null))
                          .catch(() => {/* price fetch is best-effort */});
                      }
                    }}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
                  >
                    <ChevronDown className={`w-3 h-3 transition-transform ${showAdvancedToken ? 'rotate-180' : ''}`} />
                    {showAdvancedToken ? 'Hide advanced' : 'Advanced'}
                  </button>
                </div>
                {/* Default: USDCx pill */}
                {!showAdvancedToken && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-indigo-500/50 bg-indigo-500/10">
                    <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                      <DollarSign className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-white text-sm">USDCx <span className="text-[10px] text-indigo-400/80 font-normal ml-1">⚡ Faster via CCTP</span></div>
                      <div className="text-xs text-gray-400">Circle-native USDC on Stacks</div>
                    </div>
                    <Check className="w-4 h-4 text-indigo-400 ml-auto" />
                  </div>
                )}
                {/* Advanced: show both cards */}
                {showAdvancedToken && (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setStacksToken('usdcx')}
                      disabled={isPurchasing}
                      className={`p-4 rounded-lg border-2 transition-all text-left relative overflow-hidden ${
                        stacksToken === 'usdcx'
                          ? 'border-indigo-500 bg-indigo-500/20 shadow-lg shadow-indigo-500/10'
                          : 'border-gray-600 hover:border-gray-500 bg-gray-700/30'
                      }`}
                    >
                      {stacksToken === 'usdcx' && (
                        <div className="absolute top-2 right-2">
                          <Check className="w-3.5 h-3.5 text-indigo-400" />
                        </div>
                      )}
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mb-2">
                        <DollarSign className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="font-semibold text-white text-sm">USDCx</div>
                      <div className="text-xs text-gray-400 mt-1">Circle-native USDC</div>
                      <div className="text-[10px] text-indigo-400/70 mt-1.5 font-medium">⚡ Faster via CCTP</div>
                    </button>
                    <button
                      onClick={() => setStacksToken('sbtc')}
                      disabled={isPurchasing}
                      className={`p-4 rounded-lg border-2 transition-all text-left relative overflow-hidden ${
                        stacksToken === 'sbtc'
                          ? 'border-orange-500 bg-orange-500/20 shadow-lg shadow-orange-500/10'
                          : 'border-gray-600 hover:border-gray-500 bg-gray-700/30'
                      }`}
                    >
                      {stacksToken === 'sbtc' && (
                        <div className="absolute top-2 right-2">
                          <Check className="w-3.5 h-3.5 text-orange-400" />
                        </div>
                      )}
                      <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mb-2">
                        <Bitcoin className="w-4 h-4 text-orange-400" />
                      </div>
                      <div className="font-semibold text-white text-sm">sBTC</div>
                      <div className="text-xs text-gray-400 mt-1">Bitcoin-backed</div>
                      {btcUsdPrice !== null && (
                        <div className="text-[10px] text-gray-400 mt-1">
                          ≈ {(ticketCount / btcUsdPrice).toFixed(8)} BTC
                          <span className="text-gray-500 ml-1">(${ticketCount} USD)</span>
                        </div>
                      )}
                      <div className="text-[10px] text-orange-400/70 mt-1 font-medium">₿ Secured by Bitcoin</div>
                    </button>
                  </div>
                )}
              </div>
            )}

            {showStacksTokenSelector && (
              <BalanceDisplay
                walletType="stacks"
                balance={stacksBalance}
                isCheckingBalance={isCheckingBalance}
                requiredAmount={String(ticketCount)}
                onRefresh={() => setRefreshKey((k) => k + 1)}
              />
            )}

            {/* Starknet Token Selector - USDC vs STRK */}
            {showStarknetTokenSelector && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">
                  Payment Token
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setStarknetToken('usdc')}
                    disabled={isPurchasing}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      starknetToken === 'usdc'
                        ? 'border-indigo-500 bg-indigo-500/20'
                        : 'border-gray-600 hover:border-gray-500 bg-gray-700/30'
                    }`}
                  >
                    <div className="font-semibold text-white text-sm">USDC</div>
                    <div className="text-xs text-gray-400 mt-1">ERC-20 USDC</div>
                  </button>
                  <button
                    onClick={() => setStarknetToken('strk')}
                    disabled={isPurchasing}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      starknetToken === 'strk'
                        ? 'border-purple-500 bg-purple-500/20'
                        : 'border-gray-600 hover:border-gray-500 bg-gray-700/30'
                    }`}
                  >
                    <div className="font-semibold text-white text-sm">STRK</div>
                    <div className="text-xs text-gray-400 mt-1">Native Gas Token</div>
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  {starknetToken === 'strk' 
                    ? 'STRK - Starknet native token. Lower fees, faster bridging.'
                    : 'USDC on Starknet via Orbiter cross-rollup bridge.'}
                </p>
              </div>
            )}

            {/* Ticket count selector */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-300">
                Number of Tickets
              </label>
              <div className="flex items-center gap-4 bg-gray-700/50 rounded-lg p-4">
                <button
                  onClick={() => setTicketCount(Math.max(1, ticketCount - 1))}
                  className="w-10 h-10 rounded-lg bg-gray-600 hover:bg-gray-500 flex items-center justify-center text-white font-bold transition-colors"
                  disabled={isPurchasing}
                >
                  −
                </button>
                <input
                  type="number"
                  value={ticketCount}
                  onChange={(e) =>
                    setTicketCount(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  className="flex-1 text-center text-2xl font-bold text-white bg-transparent focus:outline-none"
                  min="1"
                  disabled={isPurchasing}
                />
                <button
                  onClick={() => setTicketCount(ticketCount + 1)}
                  className="w-10 h-10 rounded-lg bg-gray-600 hover:bg-gray-500 flex items-center justify-center text-white font-bold transition-colors"
                  disabled={isPurchasing}
                >
                  +
                </button>
              </div>
            </div>

            {/* ENHANCEMENT: Reusable Gamified Yield Upsell (Drift Vault) */}
            {ticketCount >= 1 && (
              <div className="bg-gradient-to-r from-indigo-500/20 to-purple-500/10 border border-indigo-500/30 rounded-lg p-4 space-y-3 relative overflow-hidden mt-4">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                <div className="flex items-start gap-3 relative z-10">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0 border border-indigo-500/40">
                    <TrendingUp className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1 tracking-tight">
                      Play for free forever? ♾️
                    </h4>
                    <p className="text-xs text-indigo-200 leading-relaxed">
                      Instead of spending capital, deposit into the <span className="text-indigo-300 font-semibold">Drift Lossless Vault</span>. You keep your principal and get auto-routed tickets from ~22.5% APY yield.
                    </p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full text-xs bg-indigo-500/20 hover:bg-indigo-500/30 border-indigo-500/30 text-indigo-100 transition-colors"
                  onClick={() => {
                    handleClose();
                    window.location.href = '/yield-strategies';
                  }}
                >
                  Try Yield-to-Tickets
                </Button>
              </div>
            )}

            {/* Cost Breakdown */}
            {/* P0.4 FIX: Now includes starknet since execution path is wired */}
            {selectedChain && selectedChain !== "ethereum" && (
              <CostBreakdown
                ticketCount={ticketCount}
                sourceChain={selectedChain as 'stacks' | 'near' | 'solana' | 'base' | 'starknet'}
              />
            )}

            {/* Time Estimate */}
            {/* P0.4 FIX: Now includes starknet since execution path is wired */}
            {selectedChain &&
              selectedChain !== "base" &&
              selectedChain !== "ethereum" && (
                <TimeEstimate
                  sourceChain={selectedChain as 'stacks' | 'near' | 'solana' | 'starknet'}
                />
              )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleClose}
                disabled={isPurchasing}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                className={`flex-1 transition-all ${
                  needsBaseAddress && !isValidBaseAddress
                    ? 'bg-gray-600 hover:bg-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 shadow-lg shadow-green-500/20'
                }`}
                onClick={handlePurchaseClick}
                disabled={isPurchasing || (needsBaseAddress && !isValidBaseAddress)}
              >
                {isPurchasing ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : needsBaseAddress && !isValidBaseAddress ? (
                  <>
                    <Wallet className="w-4 h-4 mr-2" />
                    Enter Base Address to Continue
                  </>
                ) : (
                  `Buy ${ticketCount} Ticket${ticketCount > 1 ? 's' : ''} — $${ticketCount}`
                )}
              </Button>
            </div>
          </CompactStack>
        );

      case "processing":
        // Show enhanced tracker during processing
        // P0.1 FIX: Use selectedChain for display when sourceChain not yet available
        const processingChain = sourceChain || selectedChain;
        if (showTracker && processingChain) {
          return renderTrackerSection({
            chain: processingChain,
            sourceTxHash,
            destinationTxHash,
            status,
            error,
            ticketCount,
            walletInfo,
            showActions: true,
            statusLinkCopied,
            onCopyLink: handleCopyStatusLink,
          });
        }

        // Enhanced loading with step indicators
        return (
          <div className="text-center py-8">
            <div className="inline-block mb-6">
              <Loader className="w-12 h-12 text-blue-400 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Processing Purchase
            </h2>
            <p className="text-gray-400 mb-6">
              {walletType === "stacks" ||
              walletType === "near" ||
              walletType === "solana"
                ? "Bridging across chains — this takes 2-3 minutes"
                : "Executing transaction..."}
            </p>
            {(walletType === "stacks" || walletType === "near" || walletType === "solana") && (
              <div className="text-left space-y-3 max-w-xs mx-auto">
                {[
                  { label: "Signing transaction", done: !!sourceTxHash },
                  { label: "Waiting for confirmation", done: status === "bridging" || status === "purchasing" || status === "complete" },
                  { label: "Bridging to Base", done: status === "purchasing" || status === "complete" },
                  { label: "Purchasing tickets", done: status === "complete" },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {s.done ? (
                      <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-gray-600 flex-shrink-0" />
                    )}
                    <span className={`text-sm ${s.done ? "text-green-300" : "text-gray-500"}`}>
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {txHash && (
              <p className="text-xs text-gray-500 font-mono break-all mt-4">
                {txHash}
              </p>
            )}
          </div>
        );

      case "success":
        // P0.1 FIX: Use selectedChain for cross-chain determination when sourceChain not yet set
        // Once purchase completes, sourceChain will be available and used
        const effectiveChain = sourceChain || selectedChain;
        const isCrossChain = effectiveChain && effectiveChain !== "base" && effectiveChain !== "ethereum";
        
        if (showTracker && effectiveChain && isCrossChain) {
          return renderTrackerSection({
            chain: effectiveChain,
            sourceTxHash,
            destinationTxHash,
            status,
            error,
            ticketCount,
            walletInfo,
            showActions: true,
            customLink: sourceTxHash && isCrossChain ? (
              <a
                href={`/purchase-status/${sourceTxHash}?chain=${effectiveChain}`}
                className="inline-block text-sm text-blue-400 hover:text-blue-300"
              >
                Open Status Page
              </a>
            ) : undefined,
            customButtons: (
              <div className="flex gap-3 mt-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setTicketCount(1);
                    setStep("select");
                    clearError();
                    reset();
                  }}
                >
                  Buy More
                </Button>
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={handleClose}
                >
                  Done
                </Button>
              </div>
            ),
          });
        }

        // Standard success view for direct purchases
        return (
          <CompactStack spacing="md" align="center">
            <div className="text-center">
              <div className="inline-block mb-4">
                <div className="w-16 h-16 rounded-full bg-green-400/20 flex items-center justify-center">
                  <Check className="w-8 h-8 text-green-400" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Purchase Successful!
              </h2>
              <p className="text-gray-400 mb-4">
                You purchased {ticketCount} ticket{ticketCount !== 1 ? "s" : ""}
              </p>
              {txHash && (
                <a
                  href={`https://basescan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  View Transaction
                </a>
              )}
            </div>

            {/* ENHANCEMENT: Auto-purchase upsell (Base/EVM only, chain-aware, success momentum) */}
            {!hasActivePermission && isSupported && walletType === "evm" && (
              <div className="w-full bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-blue-300 mb-1">
                    Never sign again
                  </p>
                  <p className="text-xs text-gray-300">
                    Enable auto-purchase to buy tickets daily without signing.
                    Powered by MetaMask Advanced Permissions.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setShowPermissionModal(true)}
                >
                  <Zap className="w-3 h-3 mr-1" />
                  Enable Auto-Purchase
                </Button>
              </div>
            )}

            {walletType === "stacks" && (
              <div className="w-full bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-purple-300 mb-1">
                    Automate your purchases
                  </p>
                  <p className="text-xs text-gray-300">
                    Set up recurring ticket purchases with x402. Sign once,
                    buy tickets automatically every week or month.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setShowPermissionModal(true)}
                >
                  <Zap className="w-3 h-3 mr-1" />
                  Enable x402 Auto-Purchase
                </Button>
              </div>
            )}

            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setTicketCount(1);
                  setStep("select");
                  clearError();
                  reset();
                }}
              >
                Buy More
              </Button>
              <Button
                variant="default"
                className="flex-1"
                onClick={handleClose}
              >
                Done
              </Button>
            </div>
          </CompactStack>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* Modal overlay */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={handleClose} />

      {/* Modal content */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <CompactCard
          variant="premium"
          padding="lg"
          className="w-full max-w-md max-h-[90vh] overflow-y-auto"
        >
          {renderStep()}
        </CompactCard>
      </div>

      {/* Celebration for success */}
      <Suspense fallback={null}>
        <CelebrationModal
          isOpen={showCelebration}
          onClose={() => setShowCelebration(false)}
          achievement={{
            title: "Purchase Successful!",
            message: `You've purchased ${ticketCount} lottery ticket${ticketCount !== 1 ? "s" : ""}. Good luck!`,
            icon: "🎉",
            tickets: ticketCount,
          }}
        />
      </Suspense>

      {/* Auto-purchase permission modal */}
      <AutoPurchaseModal
        isOpen={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        onSuccess={() => {
          setShowPermissionModal(false);
          // Optional: show success message
        }}
      />
    </>
  );
}
