/**
 * SIMPLIFIED PURCHASE MODAL
 *
 * Orchestrator for 3 protocol flows:
 * - Megapot (direct lottery tickets) — inline, cross-chain concerns
 * - PoolTogether (no-loss savings) — PoolTogetherFlow
 *
 * Flow: Connect → Select Protocol → Execute → Success
 */

import { useState, Suspense, lazy, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/components/ui/Button";
import { Loader, AlertCircle, Check, Zap, Link2, ChevronDown, ArrowRight, Wallet, Shield, DollarSign, Bitcoin, Trophy, Coins, ExternalLink, Info } from "lucide-react";
import { useUnifiedWallet, useUnifiedPurchase } from "@/hooks";
import { useERC7715 } from "@/hooks/useERC7715";
import { usePoolTogetherDeposit } from "@/hooks/usePoolTogetherDeposit";
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
import { PoolTogetherFlow } from "./flows/PoolTogetherFlow";

// Lazy load celebration modal
const CelebrationModal = lazy(() => import("./CelebrationModal"));

type PurchaseStep = "connect" | "select" | "approve" | "processing" | "success";
type PurchaseProtocol = "megapot" | "pooltogether";

// Helper function to get explorer URLs
const getExplorerUrl = (chain: SourceChainType, txHash: string): string => {
  switch (chain) {
    case "solana": return `https://solscan.io/tx/${txHash}`;
    case "near": return `https://explorer.near.org/transactions/${txHash}`;
    case "stacks": return `https://explorer.stacks.co/txid/${txHash}?chain=mainnet`;
    case "base": return `https://basescan.org/tx/${txHash}`;
    case "ethereum": return `https://etherscan.io/tx/${txHash}`;
    default: return "#";
  }
};

// DRY helper for CrossChainTracker section
const renderTrackerSection = ({
  chain, sourceTxHash, destinationTxHash, status, error, ticketCount, walletInfo,
  showActions = true, statusLinkCopied = false, onCopyLink, customLink, customButtons,
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
          baseExplorer: destTxId ? `https://basescan.org/tx/${destTxId}` : undefined,
          megapotApp: `/my-tickets`,
        }}
      />
      {showActions && (
        <div className="mt-4">
          {customLink || (sourceTxHash && (
            <div className="flex items-center gap-3">
              <a href={`/purchase-status/track?txId=${sourceTxHash}`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
                Open Live Tracker →
              </a>
              {onCopyLink && (
                <button type="button" onClick={onCopyLink} className="text-xs text-gray-300 hover:text-white inline-flex items-center gap-1">
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
  initialProtocol?: PurchaseProtocol;
}

export default function SimplePurchaseModal({ isOpen, onClose, initialProtocol }: SimplePurchaseModalProps) {
  const router = useRouter();
  const { isConnected, address, walletType, mirrorAddress } = useUnifiedWallet();
  const { purchase, isPurchasing, error, txHash, clearError, reset, status, sourceChain, sourceTxHash, destinationTxHash, walletInfo } = useUnifiedPurchase();
  const { permissions, isSupported } = useERC7715();
  const ptDeposit = usePoolTogetherDeposit();

  const [step, setStep] = useState<PurchaseStep>("connect");
  const [selectedProtocol, setSelectedProtocol] = useState<PurchaseProtocol>(initialProtocol ?? "megapot");
  const [ticketCount, setTicketCount] = useState(1);
  const [ptDepositAmount, setPtDepositAmount] = useState(10);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [statusLinkCopied, setStatusLinkCopied] = useState(false);
  const [stacksToken, setStacksToken] = useState<'usdcx' | 'sbtc'>('usdcx');
  const [showAdvancedToken, setShowAdvancedToken] = useState(false);
  const [btcUsdPrice, setBtcUsdPrice] = useState<number | null>(null);
  const [starknetToken, setStarknetToken] = useState<'usdc' | 'strk'>('usdc');
  const [baseAddress, setBaseAddress] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('syndicate_base_address') || '' : ''
  );
  const [baseAddressError, setBaseAddressError] = useState('');
  const [baseAddressSource, setBaseAddressSource] = useState<'manual' | 'auto'>('manual');
  const [stacksBalance, setStacksBalance] = useState<string | null>(null);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [hasExistingAllowance, setHasExistingAllowance] = useState<boolean | null>(null);
  const hasActivePermission = permissions.length > 0 && isSupported;

  // Check if user already has sufficient USDC allowance (skip approval warning if so)
  useEffect(() => {
    if (!isConnected || !address || walletType !== 'evm' || selectedProtocol !== 'megapot') {
      setHasExistingAllowance(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { web3Service } = await import('@/services/web3Service');
        await web3Service.initialize();
        const has = await web3Service.checkUsdcAllowance(ticketCount);
        if (!cancelled) setHasExistingAllowance(has);
      } catch {
        if (!cancelled) setHasExistingAllowance(null);
      }
    })();
    return () => { cancelled = true; };
  }, [isConnected, address, walletType, selectedProtocol, ticketCount]);

  useEffect(() => {
    if (/^0x[a-fA-F0-9]{40}$/.test(baseAddress)) {
      localStorage.setItem('syndicate_base_address', baseAddress);
    }
  }, [baseAddress]);

  const selectedChain = (() => {
    if (sourceChain) return sourceChain;
    if (walletType === 'evm') return 'base';
    if (walletType === 'stacks') return 'stacks';
    if (walletType === 'solana') return 'solana';
    if (walletType === 'near') return 'near';
    if (walletType === 'starknet') return 'starknet';
    return undefined;
  })();

  const showStacksTokenSelector = selectedChain === 'stacks';
  const showStarknetTokenSelector = selectedChain === 'starknet';
  const showCrossChainUI = selectedChain && selectedChain !== 'base' && selectedChain !== 'ethereum';
  const isValidBaseAddress = /^0x[a-fA-F0-9]{40}$/.test(baseAddress);
  const needsBaseAddress = showCrossChainUI;

  useEffect(() => {
    if (needsBaseAddress && !baseAddress && mirrorAddress && /^0x[a-fA-F0-9]{40}$/.test(mirrorAddress)) {
      setBaseAddress(mirrorAddress);
      setBaseAddressSource('auto');
    }
  }, [needsBaseAddress, mirrorAddress, baseAddress]);

  const handleBaseAddressChange = (val: string) => {
    setBaseAddress(val);
    setBaseAddressSource('manual');
    if (/^0x[a-fA-F0-9]{40}$/.test(val)) {
      try { localStorage.setItem('syndicate_base_address', val); } catch {}
    }
  };

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

  const showTracker = isPurchasing || ["confirmed_source", "bridging", "purchasing", "complete", "error"].includes(status);

  useEffect(() => {
    if (isOpen && isConnected && address && step === "connect") setStep("select");
  }, [isOpen, isConnected, address, step]);

  useEffect(() => {
    if (status === "complete" && step === "processing" && selectedProtocol === 'megapot') setStep("success");
  }, [status, step, selectedProtocol]);

  useEffect(() => {
    if (ptDeposit.status === 'complete' && step === "processing") setStep("success");
  }, [ptDeposit.status, step]);

  if (!isOpen) return null;

  const handleClose = () => {
    reset();
    ptDeposit.reset();
    setStep("connect");
    onClose();
  };

  const handlePurchaseClick = async () => {
    if (!isConnected || !address) { setStep("connect"); return; }
    setStep("processing");

    if (needsBaseAddress && !isValidBaseAddress) {
      setBaseAddressError('Please enter a valid Base (EVM) address to receive your tickets');
      setStep('select');
      return;
    }
    setBaseAddressError('');

    if (selectedProtocol === 'pooltogether') {
      if (walletType !== 'evm') {
        setStep('select');
        return;
      }
      await ptDeposit.deposit({ amountUsdc: ptDepositAmount, userAddress: address as `0x${string}` });
      return;
    }

    const result = await purchase({
      ticketCount, userAddress: address, chain: selectedChain,
      recipientAddress: needsBaseAddress && isValidBaseAddress ? baseAddress : undefined,
      stacksTokenPrincipal: selectedChain === 'stacks' ? (stacksToken === 'sbtc' ? CONTRACTS.sBTC : CONTRACTS.USDCx) : undefined,
      starknetTokenAddress: selectedChain === 'starknet' ? (starknetToken === 'strk' ? STRK_ADDRESSES.starknet : undefined) : undefined,
    });

    if (result.success) {
      const isCrossChain = result.sourceTxHash && selectedChain && selectedChain !== "base" && selectedChain !== "ethereum";
      if (!isCrossChain) setShowCelebration(true);
      setStep("success");
    } else {
      setStep("select");
    }
  };

  const handleCopyStatusLink = async () => {
    if (!sourceTxHash || !sourceChain) return;
    const url = `${window.location.origin}/purchase-status/track?txId=${sourceTxHash}`;
    try { await navigator.clipboard.writeText(url); setStatusLinkCopied(true); setTimeout(() => setStatusLinkCopied(false), 2000); } catch {}
  };

  const renderStep = () => {
    switch (step) {
      case "connect":
        return (
          <CompactStack spacing="md" align="center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Let&apos;s Play</h2>
              <p className="text-gray-400">Connect your wallet to purchase lottery tickets</p>
            </div>
            <WalletConnectionManager />
            <Button variant="outline" className="w-full" onClick={handleClose}>Close</Button>
          </CompactStack>
        );

      case "select":
      case "approve":
        return (
          <CompactStack spacing="md">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">
                {selectedProtocol === 'pooltogether' ? 'Deposit to PoolTogether' : 'Buy Tickets'}
              </h2>
              <p className="text-gray-400 text-sm">
                Connected: <span className="text-green-400">{walletType?.toUpperCase()}</span>
              </p>
            </div>

            {/* Auto-purchase permission status */}
            {hasActivePermission && (
              <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <div>
                    <p className="text-green-300 font-medium text-sm">✓ Auto-Purchase Enabled</p>
                    <p className="text-xs text-green-200 mt-1">Tickets will be automatically purchased on your scheduled frequency without requiring signatures.</p>
                  </div>
                </div>
              </div>
            )}

            {/* PROTOCOL SELECTOR */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-300">Choose Your Lottery</label>
              <div className="grid grid-cols-1 gap-3">
                {/* MEGAPOT */}
                <button onClick={() => setSelectedProtocol("megapot")} disabled={isPurchasing} className={`relative p-4 rounded-lg border-2 transition-all text-left ${selectedProtocol === "megapot" ? "border-yellow-500 bg-yellow-500/20" : "border-gray-600 hover:border-gray-500 bg-gray-700/30"}`}>
                  {selectedProtocol === "megapot" && <div className="absolute top-2 right-2"><Check className="w-3.5 h-3.5 text-yellow-400" /></div>}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center flex-shrink-0"><Trophy className="w-5 h-5 text-yellow-400" /></div>
                    <div>
                      <h4 className="font-semibold text-white text-sm">Megapot</h4>
                      <p className="text-xs text-gray-400 mt-1">Direct lottery tickets • $1 per ticket</p>
                    </div>
                  </div>
                </button>
                {/* POOLTOGETHER */}
                <button onClick={() => setSelectedProtocol("pooltogether")} disabled={isPurchasing} className={`relative p-4 rounded-lg border-2 transition-all text-left ${selectedProtocol === "pooltogether" ? "border-emerald-500 bg-emerald-500/20" : "border-gray-600 hover:border-gray-500 bg-gray-700/30"}`}>
                  {selectedProtocol === "pooltogether" && <div className="absolute top-2 right-2"><Check className="w-3.5 h-3.5 text-emerald-400" /></div>}
                  <div className="absolute top-2 left-2"><span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">No Loss</span></div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0"><Shield className="w-5 h-5 text-emerald-400" /></div>
                    <div>
                      <h4 className="font-semibold text-white text-sm">PoolTogether v5</h4>
                      <p className="text-xs text-gray-400 mt-1">No-loss prize savings • Keep your principal</p>
                    </div>
                  </div>
                </button>
                {/* DRIFT - Hidden due to security incident (April 2026) */}
              </div>
            </div>

            {/* Error display */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-400 font-medium text-sm">{error}</p>
                  <Button variant="ghost" size="sm" className="text-red-300 hover:text-red-200 mt-2 px-0" onClick={clearError}>Dismiss</Button>
                </div>
              </div>
            )}

            {/* ===== EXTRACTED FLOW COMPONENTS ===== */}
            {selectedProtocol === 'pooltogether' && walletType && walletType !== 'evm' ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-300">EVM wallet required</p>
                    <p className="text-xs text-gray-300 mt-1">
                      PoolTogether deposits require a Base (EVM) wallet. Connect an EVM wallet or explore other yield strategies.
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => router.push('/vaults')}>
                  Explore Yield Vaults →
                </Button>
              </div>
            ) : selectedProtocol === 'pooltogether' ? (
              <PoolTogetherFlow step="select" depositAmount={ptDepositAmount} setDepositAmount={setPtDepositAmount} ptDeposit={ptDeposit} onDeposit={handlePurchaseClick} onBack={handleClose} onClose={handleClose} walletType={walletType} />
            ) : null}

            {/* ===== MEGAPOT-ONLY SECTIONS (kept inline due to cross-chain complexity) ===== */}
            {selectedProtocol === 'megapot' && (<>
              {/* Auto-purchase setup */}
              {!hasActivePermission && isSupported && walletType === "evm" && (
                <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-indigo-300 mb-1">Enable Auto-Purchase</p>
                      <p className="text-xs text-gray-300">Set up automatic weekly or monthly ticket purchases using MetaMask Advanced Permissions. No signing required after setup.</p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" className="w-full text-xs" onClick={() => setShowPermissionModal(true)}>
                    <Zap className="w-3 h-3 mr-1" /> Set Up Auto-Purchase
                  </Button>
                </div>
              )}
              {walletType === "stacks" && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-purple-300 mb-1">Enable x402 Auto-Purchase</p>
                      <p className="text-xs text-gray-300">Set up automatic weekly or monthly ticket purchases on Stacks. Sign once with SIP-018 — no manual signing after setup.</p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" className="w-full text-xs" onClick={() => setShowPermissionModal(true)}>
                    <Zap className="w-3 h-3 mr-1" /> Set Up x402 Auto-Purchase
                  </Button>
                </div>
              )}

              {/* Cross-Chain Flow Indicator */}
              {showCrossChainUI && selectedChain && (
                <div className="bg-gradient-to-r from-gray-800/80 to-gray-700/50 border border-gray-600/50 rounded-lg p-3">
                  <div className="flex items-center justify-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
                        {selectedChain === 'stacks' ? <span className="text-xs font-bold text-indigo-300">STX</span> : selectedChain === 'solana' ? <span className="text-xs font-bold text-purple-300">SOL</span> : selectedChain === 'near' ? <span className="text-xs font-bold text-green-300">NEAR</span> : <span className="text-xs font-bold text-blue-300">STRK</span>}
                      </div>
                      <span className="text-xs text-gray-400 font-medium">{selectedChain === 'stacks' ? 'Stacks' : selectedChain === 'solana' ? 'Solana' : selectedChain === 'near' ? 'NEAR' : 'Starknet'}</span>
                    </div>
                    <div className="flex items-center gap-1"><div className="w-6 h-px bg-gray-500"></div><ArrowRight className="w-3.5 h-3.5 text-gray-400" /><div className="w-6 h-px bg-gray-500"></div></div>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center"><span className="text-xs font-bold text-blue-300">B</span></div>
                      <span className="text-xs text-gray-400 font-medium">Base</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 text-center mt-2">Your payment is bridged to Base where lottery tickets are minted</p>
                </div>
              )}

              {/* Base Address Input */}
              {needsBaseAddress && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-300"><Wallet className="w-3.5 h-3.5 text-blue-400" /> Delivery Address (Base)</label>
                    {baseAddressSource === 'auto' && isValidBaseAddress && <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">Auto-detected</span>}
                  </div>
                  <p className="text-xs text-gray-500">Tickets are minted on Base. {mirrorAddress ? 'We detected your linked EVM address — you can change it below.' : 'Paste your MetaMask or other EVM wallet address.'}</p>
                  <div className="relative">
                    <input type="text" value={baseAddress} onChange={(e) => { handleBaseAddressChange(e.target.value.trim()); setBaseAddressError(''); }} placeholder="0x... (your Base/EVM wallet address)" disabled={isPurchasing} className={`w-full px-4 py-3 rounded-lg bg-gray-700/50 border text-white text-sm font-mono placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${baseAddressError ? 'border-red-500 focus:ring-red-500/50' : baseAddress && isValidBaseAddress ? 'border-green-500/60 focus:ring-green-500/50' : 'border-gray-600 focus:ring-indigo-500/50'}`} />
                    {baseAddress && isValidBaseAddress && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Check className="w-4 h-4 text-green-400" /></div>}
                  </div>
                  {baseAddressError && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{baseAddressError}</p>}
                  {baseAddress && isValidBaseAddress && !baseAddressError && <div className="flex items-center gap-1.5 text-xs text-green-400/80"><Shield className="w-3 h-3" /><span>Verified address — tickets will be delivered here</span></div>}
                  {baseAddress && !isValidBaseAddress && !baseAddressError && <p className="text-xs text-yellow-400">Enter a valid 0x... address (42 characters)</p>}
                </div>
              )}

              {/* Stacks Token Selector */}
              {showStacksTokenSelector && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-300"><DollarSign className="w-3.5 h-3.5 text-green-400" /> Payment Token</label>
                    <button onClick={() => { const next = !showAdvancedToken; setShowAdvancedToken(next); if (!next) setStacksToken('usdcx'); if (next && btcUsdPrice === null) { fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd').then(r => r.json()).then(d => setBtcUsdPrice(d?.bitcoin?.usd ?? null)).catch(() => {}); } }} className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1">
                      <ChevronDown className={`w-3 h-3 transition-transform ${showAdvancedToken ? 'rotate-180' : ''}`} />{showAdvancedToken ? 'Hide advanced' : 'Advanced'}
                    </button>
                  </div>
                  {!showAdvancedToken && (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-indigo-500/50 bg-indigo-500/10">
                      <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center"><DollarSign className="w-3.5 h-3.5 text-blue-400" /></div>
                      <div><div className="font-semibold text-white text-sm">USDCx <span className="text-[10px] text-indigo-400/80 font-normal ml-1">⚡ Faster via CCTP</span></div><div className="text-xs text-gray-400">Circle-native USDC on Stacks</div></div>
                      <Check className="w-4 h-4 text-indigo-400 ml-auto" />
                    </div>
                  )}
                  {showAdvancedToken && (
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setStacksToken('usdcx')} disabled={isPurchasing} className={`p-4 rounded-lg border-2 transition-all text-left relative overflow-hidden ${stacksToken === 'usdcx' ? 'border-indigo-500 bg-indigo-500/20' : 'border-gray-600 hover:border-gray-500 bg-gray-700/30'}`}>
                        {stacksToken === 'usdcx' && <div className="absolute top-2 right-2"><Check className="w-3.5 h-3.5 text-indigo-400" /></div>}
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mb-2"><DollarSign className="w-4 h-4 text-blue-400" /></div>
                        <div className="font-semibold text-white text-sm">USDCx</div><div className="text-xs text-gray-400 mt-1">Circle-native USDC</div><div className="text-[10px] text-indigo-400/70 mt-1.5 font-medium">⚡ Faster via CCTP</div>
                      </button>
                      <button onClick={() => setStacksToken('sbtc')} disabled={isPurchasing} className={`p-4 rounded-lg border-2 transition-all text-left relative overflow-hidden ${stacksToken === 'sbtc' ? 'border-orange-500 bg-orange-500/20' : 'border-gray-600 hover:border-gray-500 bg-gray-700/30'}`}>
                        {stacksToken === 'sbtc' && <div className="absolute top-2 right-2"><Check className="w-3.5 h-3.5 text-orange-400" /></div>}
                        <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mb-2"><Bitcoin className="w-4 h-4 text-orange-400" /></div>
                        <div className="font-semibold text-white text-sm">sBTC</div><div className="text-xs text-gray-400 mt-1">Bitcoin-backed</div>
                        {btcUsdPrice !== null && <div className="text-[10px] text-gray-400 mt-1">≈ {(ticketCount / btcUsdPrice).toFixed(8)} BTC<span className="text-gray-500 ml-1">(${ticketCount} USD)</span></div>}
                        <div className="text-[10px] text-orange-400/70 mt-1 font-medium">₿ Secured by Bitcoin</div>
                      </button>
                    </div>
                  )}
                </div>
              )}
              {showStacksTokenSelector && <BalanceDisplay walletType="stacks" balance={stacksBalance} isCheckingBalance={isCheckingBalance} requiredAmount={String(ticketCount)} onRefresh={() => setRefreshKey((k) => k + 1)} />}

              {/* Starknet Token Selector */}
              {showStarknetTokenSelector && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300">Payment Token</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setStarknetToken('usdc')} disabled={isPurchasing} className={`p-4 rounded-lg border-2 transition-all text-left ${starknetToken === 'usdc' ? 'border-indigo-500 bg-indigo-500/20' : 'border-gray-600 hover:border-gray-500 bg-gray-700/30'}`}>
                      <div className="font-semibold text-white text-sm">USDC</div><div className="text-xs text-gray-400 mt-1">ERC-20 USDC</div>
                    </button>
                    <button onClick={() => setStarknetToken('strk')} disabled={isPurchasing} className={`p-4 rounded-lg border-2 transition-all text-left ${starknetToken === 'strk' ? 'border-purple-500 bg-purple-500/20' : 'border-gray-600 hover:border-gray-500 bg-gray-700/30'}`}>
                      <div className="font-semibold text-white text-sm">STRK</div><div className="text-xs text-gray-400 mt-1">Native Gas Token</div>
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">{starknetToken === 'strk' ? 'STRK - Starknet native token. Lower fees, faster bridging.' : 'USDC on Starknet via Orbiter cross-rollup bridge.'}</p>
                </div>
              )}

              {/* Ticket count selector */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">Number of Tickets</label>
                <div className="flex items-center gap-4 bg-gray-700/50 rounded-lg p-4">
                  <button onClick={() => setTicketCount(Math.max(1, ticketCount - 1))} className="w-10 h-10 rounded-lg bg-gray-600 hover:bg-gray-500 flex items-center justify-center text-white font-bold transition-colors" disabled={isPurchasing}>−</button>
                  <input type="number" value={ticketCount} onChange={(e) => setTicketCount(Math.max(1, parseInt(e.target.value) || 1))} className="flex-1 text-center text-2xl font-bold text-white bg-transparent focus:outline-none" min="1" disabled={isPurchasing} />
                  <button onClick={() => setTicketCount(ticketCount + 1)} className="w-10 h-10 rounded-lg bg-gray-600 hover:bg-gray-500 flex items-center justify-center text-white font-bold transition-colors" disabled={isPurchasing}>+</button>
                </div>
              </div>



              {/* Batch purchase note */}
              {ticketCount > 10 && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-2.5 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-200/80 leading-relaxed">
                    Large orders are <span className="font-semibold text-blue-200">auto-batched on-chain</span> for reliability. This may take a moment longer than single-ticket purchases.
                  </p>
                </div>
              )}

              {/* Cost Breakdown */}
              {selectedChain && selectedChain !== "ethereum" && <CostBreakdown ticketCount={ticketCount} sourceChain={selectedChain as 'stacks' | 'near' | 'solana' | 'base' | 'starknet'} />}
              {/* Time Estimate */}
              {selectedChain && selectedChain !== "base" && selectedChain !== "ethereum" && <TimeEstimate sourceChain={selectedChain as 'stacks' | 'near' | 'solana' | 'starknet'} />}

              {/* USDC Approval Notice — only shown when user hasn't already approved */}
              {hasExistingAllowance === false && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-200/80 leading-relaxed">
                    Your wallet will ask you to <span className="font-semibold text-amber-200">approve USDC spending</span> before the purchase. This is a standard on-chain approval — you stay in control of your funds.
                  </p>
                </div>
              )}

              {/* How It Works — collapsible */}
              <div className="border border-white/10 rounded-lg overflow-hidden">
                <button type="button" onClick={() => setShowHowItWorks(!showHowItWorks)} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors">
                  <span className="text-sm font-medium text-gray-300 flex items-center gap-2"><Trophy className="w-4 h-4 text-yellow-400" />How prizes work</span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showHowItWorks ? 'rotate-180' : ''}`} />
                </button>
                {showHowItWorks && (
                  <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                    <div className="space-y-1.5">
                      <p className="text-xs text-gray-300 font-medium">Each $1 ticket picks 5 numbers + 1 bonusball. Match more to win more across <span className="text-white font-semibold">10 prize tiers</span>:</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-gray-400">🏆 5 + bonus</span>
                          <span className="text-[11px] font-bold text-yellow-400">Jackpot</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-gray-400">⭐ 5 match</span>
                          <span className="text-[11px] font-bold text-gray-200">2nd Prize</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-gray-400">4 + bonus</span>
                          <span className="text-[11px] font-bold text-gray-300">3rd</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-gray-400">4 match</span>
                          <span className="text-[11px] font-bold text-gray-300">4th</span>
                        </div>
                        <div className="col-span-2 flex items-center justify-between">
                          <span className="text-[11px] text-gray-500">+ 6 more tiers down to 1 match</span>
                          <span className="text-[11px] text-gray-500">~70% of sales → prizes</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      Draws daily at 17:00 UTC using Pyth Network randomness. All winners are paid instantly to their wallet — no claiming needed. Every ticket is also entered to win 31 extra guaranteed daily prizes. 100% of ticket sales go back to the community — Megapot takes 0%.
                    </p>
                    <a href="https://docs.megapot.io/overview/prizes" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                      Full rules & prize details <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              {/* Megapot action buttons */}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={handleClose} disabled={isPurchasing}>Cancel</Button>
                <Button variant="default" className={`flex-1 transition-all ${needsBaseAddress && !isValidBaseAddress ? 'bg-gray-600 hover:bg-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 shadow-lg shadow-green-500/20'}`} onClick={handlePurchaseClick} disabled={isPurchasing || (needsBaseAddress && !isValidBaseAddress)}>
                  {isPurchasing ? <><Loader className="w-4 h-4 mr-2 animate-spin" />Processing...</> : needsBaseAddress && !isValidBaseAddress ? <><Wallet className="w-4 h-4 mr-2" />Enter Base Address to Continue</> : `Buy ${ticketCount} Ticket${ticketCount > 1 ? 's' : ''} — $${ticketCount}`}
                </Button>
              </div>
            </>)}
          </CompactStack>
        );

      case "processing":
        // PoolTogether processing → extracted component
        if (selectedProtocol === 'pooltogether') {
          return <PoolTogetherFlow step="processing" depositAmount={ptDepositAmount} setDepositAmount={setPtDepositAmount} ptDeposit={ptDeposit} onDeposit={handlePurchaseClick} onBack={() => { ptDeposit.reset(); setStep('select'); }} onClose={handleClose} walletType={walletType} />;
        }
        // Megapot processing → cross-chain tracker
        const processingChain = sourceChain || selectedChain;
        if (showTracker && processingChain) {
          return renderTrackerSection({ chain: processingChain, sourceTxHash, destinationTxHash, status, error, ticketCount, walletInfo, showActions: true, statusLinkCopied, onCopyLink: handleCopyStatusLink });
        }
        // Megapot fallback loading
        return (
          <div className="text-center py-8">
            <div className="inline-block mb-6"><Loader className="w-12 h-12 text-blue-400 animate-spin" /></div>
            <h2 className="text-2xl font-bold text-white mb-2">Processing Purchase</h2>
            <p className="text-gray-400 mb-6">{walletType === "stacks" || walletType === "near" || walletType === "solana" ? "Bridging across chains — this takes 2-3 minutes" : "Executing transaction..."}</p>
            {(walletType === "stacks" || walletType === "near" || walletType === "solana") && (
              <div className="text-left space-y-3 max-w-xs mx-auto">
                {[{ label: "Signing transaction", done: !!sourceTxHash }, { label: "Waiting for confirmation", done: status === "bridging" || status === "purchasing" || status === "complete" }, { label: "Bridging to Base", done: status === "purchasing" || status === "complete" }, { label: "Purchasing tickets", done: status === "complete" }].map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {s.done ? <Check className="w-4 h-4 text-green-400 flex-shrink-0" /> : <div className="w-4 h-4 rounded-full border-2 border-gray-600 flex-shrink-0" />}
                    <span className={`text-sm ${s.done ? "text-green-300" : "text-gray-500"}`}>{s.label}</span>
                  </div>
                ))}
              </div>
            )}
            {txHash && <p className="text-xs text-gray-500 font-mono break-all mt-4">{txHash}</p>}
          </div>
        );

      case "success":
        // PoolTogether success → extracted component
        if (selectedProtocol === 'pooltogether') {
          return <PoolTogetherFlow step="success" depositAmount={ptDepositAmount} setDepositAmount={setPtDepositAmount} ptDeposit={ptDeposit} onDeposit={handlePurchaseClick} onBack={() => { ptDeposit.reset(); setStep("select"); }} onClose={handleClose} walletType={walletType} />;
        }
        // Megapot cross-chain success
        const effectiveChain = sourceChain || selectedChain;
        const isCrossChain = effectiveChain && effectiveChain !== "base" && effectiveChain !== "ethereum";
        if (showTracker && effectiveChain && isCrossChain) {
          return renderTrackerSection({
            chain: effectiveChain, sourceTxHash, destinationTxHash, status, error, ticketCount, walletInfo, showActions: true,
            customLink: sourceTxHash && isCrossChain ? <a href={`/purchase-status?txId=${sourceTxHash}&chain=${effectiveChain}`} className="inline-block text-sm text-blue-400 hover:text-blue-300">Open Status Page</a> : undefined,
            customButtons: (
              <div className="flex gap-3 mt-3">
                <Button variant="outline" className="flex-1" onClick={() => { setTicketCount(1); setStep("select"); clearError(); reset(); }}>Buy More</Button>
                <Button variant="default" className="flex-1" onClick={handleClose}>Done</Button>
              </div>
            ),
          });
        }
        // Megapot direct success
        return (
          <CompactStack spacing="md" align="center">
            <div className="text-center">
              <div className="inline-block mb-4"><div className="w-16 h-16 rounded-full bg-green-400/20 flex items-center justify-center"><Check className="w-8 h-8 text-green-400" /></div></div>
              <h2 className="text-2xl font-bold text-white mb-2">Purchase Successful!</h2>
              <p className="text-gray-400 mb-2">You purchased {ticketCount} ticket{ticketCount !== 1 ? "s" : ""}</p>
              <div className="flex flex-wrap items-center justify-center gap-3 mb-2">
                {txHash && <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:text-blue-300 inline-flex items-center gap-1">View Transaction <ExternalLink className="w-3 h-3" /></a>}
                <a href="https://docs.megapot.io/overview/prizes" target="_blank" rel="noopener noreferrer" className="text-sm text-yellow-400 hover:text-yellow-300 inline-flex items-center gap-1">Prize Info <ExternalLink className="w-3 h-3" /></a>
              </div>
              <p className="text-xs text-gray-500">Winners are drawn on-chain. Prizes are paid instantly to your wallet — no claiming needed.</p>
            </div>
            {/* Auto-purchase upsell */}
            {!hasActivePermission && isSupported && walletType === "evm" && (
              <div className="w-full bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-3">
                <div><p className="text-sm font-medium text-blue-300 mb-1">Never sign again</p><p className="text-xs text-gray-300">Enable auto-purchase to buy tickets daily without signing. Powered by MetaMask Advanced Permissions.</p></div>
                <Button variant="secondary" size="sm" className="w-full text-xs" onClick={() => setShowPermissionModal(true)}><Zap className="w-3 h-3 mr-1" /> Enable Auto-Purchase</Button>
              </div>
            )}
            {walletType === "stacks" && (
              <div className="w-full bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 space-y-3">
                <div><p className="text-sm font-medium text-purple-300 mb-1">Automate your purchases</p><p className="text-xs text-gray-300">Set up recurring ticket purchases with x402. Sign once, buy tickets automatically every week or month.</p></div>
                <Button variant="secondary" size="sm" className="w-full text-xs" onClick={() => setShowPermissionModal(true)}><Zap className="w-3 h-3 mr-1" /> Enable x402 Auto-Purchase</Button>
              </div>
            )}
            <div className="flex gap-3 w-full">
              <Button variant="outline" className="flex-1" onClick={() => { setTicketCount(1); setStep("select"); clearError(); reset(); }}>Buy More</Button>
              <Button variant="default" className="flex-1" onClick={handleClose}>Done</Button>
            </div>
          </CompactStack>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={handleClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <CompactCard variant="premium" padding="lg" className="w-full max-w-md max-h-[90vh] overflow-y-auto">
          {renderStep()}
        </CompactCard>
      </div>
      <Suspense fallback={null}>
        <CelebrationModal isOpen={showCelebration} onClose={() => setShowCelebration(false)} achievement={{ title: "Purchase Successful!", message: `You've purchased ${ticketCount} lottery ticket${ticketCount !== 1 ? "s" : ""}. Good luck!`, icon: "🎉", tickets: ticketCount }} />
      </Suspense>
      <AutoPurchaseModal isOpen={showPermissionModal} onClose={() => setShowPermissionModal(false)} onSuccess={() => setShowPermissionModal(false)} />
    </>
  );
}
