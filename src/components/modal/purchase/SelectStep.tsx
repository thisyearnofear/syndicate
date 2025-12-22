"use client";

import { useState, useEffect } from "react";
import { Button } from "@/shared/components/ui/Button";
import { CompactStack, CompactFlex } from "@/shared/components/premium/CompactLayout";
import { AlertCircle, Zap } from "lucide-react";
import type { SyndicateInfo } from "@/domains/lottery/types";
import { WalletTypes, STACKS_WALLETS } from "@/domains/wallet/types";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { BalanceDisplay } from "@/components/modal/BalanceDisplay";

interface SelectStepProps {
  setStep: (step: "mode") => void;
  selectedSyndicate: SyndicateInfo | null;
  prizeAmount: number | undefined;
  jackpotLoading: boolean;
  jackpotError: string | null;
  ticketPrice: string;
  ticketCount: number;
  setTicketCount: (count: number) => void;
  quickAmounts: number[];
  totalCost: string;
  oddsInfo: { oddsFormatted: (tickets: number) => string; } | null;
  hasInsufficientBalance: boolean | null | undefined;
  refreshBalance: () => void;
  isConnected: boolean;
  handlePurchase: () => void;
  isPurchasing: boolean;
  isInitializing: boolean;
  purchaseMode: "individual" | "syndicate" | "yield";
  walletType?: string | null;
  solanaBalance?: string | null;
  userBalance?: { usdc: string; eth: string; hasEnoughUsdc: boolean; hasEnoughEth: boolean } | null;
  isCheckingBalance?: boolean;
  onStartBridge?: () => void;
  isBridging?: boolean;
  showBridgeGuidance?: boolean;
  nearQuote?: { solverName?: string; estimatedFee: string; estimatedFeePercent: number; destinationAmount: string; timeLimit?: number; } | null;
  onGetNearQuote?: () => void;
  isGettingQuote?: boolean;
  onConfirmIntent?: () => void;
  // New props for Stacks flow
  buyTicketsWithStacks?: (params: { sourceChain: 'stacks'; ticketCount: number; recipientBase: string; stacksTokenPrincipal?: string; }) => void;
  evmAddress?: string;
  stacksBalances?: Record<string, string>;
  selectedStacksToken?: string;
  mirrorAddress?: string | null;
}

export function SelectStep({
  setStep, selectedSyndicate, prizeAmount, jackpotLoading, jackpotError, ticketPrice,
  ticketCount, setTicketCount, quickAmounts, totalCost, oddsInfo, hasInsufficientBalance,
  refreshBalance, isConnected, handlePurchase, isPurchasing, isInitializing, purchaseMode,
  walletType, solanaBalance, userBalance, isCheckingBalance, onStartBridge, isBridging, showBridgeGuidance, nearQuote,
  onGetNearQuote, isGettingQuote, onConfirmIntent, buyTicketsWithStacks, evmAddress,
  stacksBalances, selectedStacksToken, mirrorAddress,
}: SelectStepProps) {

  const [localSelectedStacksToken, setLocalSelectedStacksToken] = useState<string | undefined>(selectedStacksToken);

  useEffect(() => {
    if (selectedStacksToken && !localSelectedStacksToken) {
      setLocalSelectedStacksToken(selectedStacksToken);
    }
  }, [selectedStacksToken]);

  const canBridgeAndBuy = Boolean(isConnected && walletType === WalletTypes.SOLANA && hasInsufficientBalance && parseFloat(solanaBalance || "0") >= parseFloat(totalCost || "0"));
  const isStacksWallet = STACKS_WALLETS.includes(walletType as any);

  // Stacks has a 0.1 USDC bridge fee per ticket
  const stacksFeePerTicket = 0.1;
  const displayTotalCost = isStacksWallet
    ? (parseFloat(totalCost) + (ticketCount * stacksFeePerTicket)).toFixed(2)
    : totalCost;

  const STACKS_TOKENS = {
    'SP3Y2ZSH8P7D50B0VB0PVXAD455SCSY5A2JSTX9C9.usdc-token': { name: 'USDC', icon: '🔵' },
    'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc': { name: 'aeUSDC', icon: '🌀' },
    'SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK.token-susdt': { name: 'sUSDT', icon: '🟢' },
    'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA2WBX.token-susdt': { name: 'sUSDT', icon: '🟢' }
  };

  if (showBridgeGuidance || isBridging) {
    return (
      <CompactStack spacing="lg"><div className="text-center py-4"><p className="text-white/70 text-sm">Complete the bridge to continue with ticket purchase</p></div></CompactStack>
    );
  }

  return (
    <CompactStack spacing="lg">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setStep("mode")} className="text-gray-400 hover:text-white">← Back to Options</Button>
        {selectedSyndicate && <div className="text-xs text-gray-400">Pool Mode</div>}
      </div>

      <div className="text-center mb-4">
        <p className="text-white/70">Current Jackpot: <span className="text-yellow-400 font-bold">${prizeAmount?.toLocaleString() || "0"} USDC</span></p>
        {jackpotLoading && <p className="text-xs text-gray-400">Loading jackpot...</p>}
        {jackpotError && <p className="text-xs text-red-400">Error loading jackpot data</p>}
        {ticketPrice && <p className="text-white/60 text-sm mt-1">Ticket Price: ${ticketPrice} USDC</p>}
      </div>

      <div>
        <p className="mb-3 text-sm font-medium">Quick Select</p>
        <CompactFlex gap="sm" className="flex-wrap">
          {quickAmounts.map((amount) => (
            <Button key={amount} variant={ticketCount === amount ? "default" : "ghost"} size="sm" onClick={() => setTicketCount(amount)} className={ticketCount === amount ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl border border-blue-500/20" : ""}>
              {amount} ticket{amount > 1 ? "s" : ""}
            </Button>
          ))}
        </CompactFlex>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium">Custom Amount</p>
        <CompactFlex align="center" gap="md" justify="center">
          <Button variant="ghost" size="sm" onClick={() => setTicketCount(Math.max(1, ticketCount - 1))} className="w-12 h-12 p-0 rounded-full" disabled={ticketCount <= 1}>-</Button>
          <div className="text-center min-w-[80px]">
            <div className="text-3xl font-black gradient-text-primary">{ticketCount}</div>
            <p className="text-xs text-gray-400 leading-relaxed">ticket{ticketCount > 1 ? "s" : ""}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setTicketCount(ticketCount + 1)} className="w-12 h-12 p-0 rounded-full">+</Button>
        </CompactFlex>
      </div>

      {/* UNIFIED BALANCE DISPLAY */}
      {isConnected && (
        <BalanceDisplay
          walletType={walletType}
          balance={
            walletType === WalletTypes.SOLANA
              ? solanaBalance
              : walletType === WalletTypes.NEAR
                ? userBalance?.usdc
                : isStacksWallet
                  ? userBalance?.usdc // Stacks USDC fetched in hook
                  : null
          }
          isCheckingBalance={isCheckingBalance && (walletType === WalletTypes.SOLANA || walletType === WalletTypes.NEAR || isStacksWallet)}
          requiredAmount={totalCost}
          onRefresh={refreshBalance}
          onBridge={canBridgeAndBuy ? onStartBridge : undefined}
        />
      )}

      <div className="glass p-6 rounded-2xl">
        <CompactFlex align="center" justify="between" className="mb-4">
          <p className="font-medium text-gray-300 leading-relaxed">Total Cost:</p>
          <div className="text-3xl font-black text-green-400">${displayTotalCost} USDC</div>
        </CompactFlex>

        {oddsInfo && (
          <div className="mb-4 p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-xl border border-yellow-500/20">
            <div className="flex items-center justify-between mb-2"><p className="text-yellow-400 font-semibold text-sm">Your Winning Odds:</p><span className="text-2xl font-black text-yellow-400">{oddsInfo.oddsFormatted(ticketCount)}</span></div>
            {ticketCount > 1 && <p className="text-yellow-300 text-xs">🎯 {ticketCount} tickets = {oddsInfo.oddsFormatted(ticketCount)}{" "} chance to win!</p>}
          </div>
        )}

        <CompactFlex align="center" justify="between" gap="sm" className="text-sm">
          <p className="text-sm text-gray-400 leading-relaxed">{ticketCount} ticket{ticketCount !== 1 ? "s" : ""}</p>
          {selectedSyndicate ? <span className="inline-flex items-center font-semibold rounded-full shadow-lg backdrop-blur-sm transform hover:scale-105 transition-transform duration-200 bg-gradient-to-r from-purple-500 to-blue-600 text-white px-2 py-1 text-xs">{selectedSyndicate.cause.name === "Ocean Cleanup" ? "🌊" : selectedSyndicate.cause.name === "Education Access" ? "📚" : selectedSyndicate.cause.name === "Climate Action" ? "🌍" : selectedSyndicate.cause.name === "Food Security" ? "🌾" : "✨"}{" "}{selectedSyndicate.cause.name}</span> : <span className="inline-flex items-center font-semibold rounded-full shadow-lg backdrop-blur-sm transform hover:scale-105 transition-transform duration-200 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-2 py-1 text-xs">🎫 Individual Purchase</span>}
        </CompactFlex>

        {selectedSyndicate && <div className="mt-4 pt-4 border-t border-white/10"><div className="flex items-center justify-between text-xs"><span className="text-gray-400">Pool Impact:</span><span className="text-purple-400 font-semibold">Joining {selectedSyndicate.membersCount.toLocaleString()}{" "}members</span></div><div className="flex items-center justify-between text-xs mt-1"><span className="text-gray-400">Cause Support:</span><span className="text-green-400 font-semibold">20% of winnings → {selectedSyndicate.cause.name}</span></div></div>}
        {walletType === WalletTypes.NEAR && <div className="mt-4 pt-4 border-t border-white/10"><p className="text-white/80 text-sm mb-2">NEAR Intents Quote</p>{!nearQuote ? <div className="flex items-center justify-between"><p className="text-gray-400 text-xs">Get a solver quote for executing purchase via NEAR Intents</p><Button size="sm" variant="outline" onClick={onGetNearQuote} disabled={isGettingQuote}>{isGettingQuote ? <><span className="animate-spin mr-2">⏳</span>Quoting...</> : "Get Quote"}</Button></div> : <div className="space-y-2 text-xs text-white/70"><div className="flex items-center justify-between"><span>Solver</span><span className="font-mono">{nearQuote.solverName || "default"}</span></div><div className="flex items-center justify-between"><span>Estimated Fee</span><span className="font-mono">{nearQuote.estimatedFee} ({nearQuote.estimatedFeePercent}%)</span></div><div className="flex items-center justify-between"><span>Destination Amount</span><span className="font-mono">{nearQuote.destinationAmount} USDC</span></div>{nearQuote.timeLimit && <div className="flex items-center justify-between"><span>Time Limit</span><span className="font-mono">{Math.ceil(nearQuote.timeLimit / 60)} min</span></div>}<div className="pt-2"><Button size="sm" className="w-full bg-gradient-to-r from-blue-600 to-purple-600" onClick={onConfirmIntent}>Confirm Intent & Execute</Button></div></div>}</div>}
      </div>

      {isStacksWallet && stacksBalances && Object.values(stacksBalances).filter(b => parseFloat(b) > 0).length > 1 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Select Payment Token</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {Object.entries(STACKS_TOKENS).map(([principal, details]) => {
              const balance = stacksBalances[principal] || "0";
              if (parseFloat(balance) === 0 && principal !== localSelectedStacksToken) return null;

              return (
                <button
                  key={principal}
                  onClick={() => setLocalSelectedStacksToken(principal)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 ${localSelectedStacksToken === principal
                    ? "border-orange-500 bg-orange-500/10 shadow-[0_0_15px_rgba(249,115,22,0.2)]"
                    : "border-white/10 bg-white/5 hover:border-white/30"
                    }`}
                >
                  <span className="text-xl mb-1">{details.icon}</span>
                  <span className="text-xs font-bold text-white">{details.name}</span>
                  <span className="text-[10px] text-gray-400">${parseFloat(balance).toFixed(2)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isStacksWallet && !evmAddress && !mirrorAddress && (
        <div className="glass-premium border border-blue-500/30 rounded-xl p-4 text-center space-y-3">
          <div className="flex items-center gap-2 text-blue-400 justify-center"><AlertCircle className="w-5 h-5" /><span className="font-semibold">🔗 Connect EVM Wallet for Ticket Receipt</span></div>
          <p className="text-blue-300 text-sm">
            Connect an EVM wallet below to receive your tickets on Base.
          </p>
          <div className="mt-2 flex justify-center">
            <ConnectButton showBalance={false} chainStatus="none" />
          </div>
        </div>
      )}

      {isStacksWallet && !evmAddress && mirrorAddress && (
        <div className="glass-premium border border-orange-500/30 rounded-xl p-4 text-center space-y-2">
          <div className="flex items-center gap-2 text-orange-400 justify-center">
            <Zap className="w-4 h-4" />
            <span className="font-semibold text-sm">Deterministic Base Identity Active</span>
          </div>
          <p className="text-gray-400 text-xs">
            Using your Stacks key to secure tickets on Base.<br />
            <span className="font-mono text-[10px] text-orange-200">{mirrorAddress.slice(0, 6)}...{mirrorAddress.slice(-4)}</span>
          </p>
        </div>
      )}

      {isConnected && !isStacksWallet && (canBridgeAndBuy ? <Button variant="default" size="lg" className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 hover:from-blue-700 hover:via-purple-700 hover:to-indigo-700 text-white shadow-2xl hover:shadow-blue-500/30 border border-blue-400/30 disabled:opacity-50 disabled:cursor-not-allowed" onClick={onStartBridge}>{`🔁 Bridge & Buy - $${totalCost}`}</Button> : <Button variant="default" size="lg" className="w-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 hover:from-yellow-500 hover:via-orange-600 hover:to-red-600 text-white shadow-2xl hover:shadow-yellow-500/30 border border-yellow-400/30 disabled:opacity-50 disabled:cursor-not-allowed" onClick={handlePurchase} disabled={isPurchasing || isInitializing || !!hasInsufficientBalance}>{isInitializing ? <>⏳ Initializing...</> : isPurchasing ? <>⚡ Processing...</> : hasInsufficientBalance ? "Insufficient Balance" : selectedSyndicate ? `🌊 Join ${selectedSyndicate.name} - $${totalCost}` : `⚡ Purchase ${ticketCount} Ticket${ticketCount > 1 ? "s" : ""} - $${totalCost}`}</Button>)}

      {isConnected && isStacksWallet && (
        <Button
          variant="default"
          size="lg"
          className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-2xl hover:shadow-orange-500/30 border border-orange-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => {
            if (buyTicketsWithStacks) {
              const recipient = evmAddress || mirrorAddress;
              if (recipient) {
                buyTicketsWithStacks({
                  sourceChain: 'stacks',
                  ticketCount,
                  recipientBase: recipient,
                  stacksTokenPrincipal: localSelectedStacksToken,
                });
              }
            }
          }}
          disabled={(!evmAddress && !mirrorAddress) || isPurchasing}
        >
          {isPurchasing ? <><span className="animate-spin mr-2">⏳</span> Processing Stacks Purchase...</> : <><span className="mr-2">⚡</span> Purchase {ticketCount} Ticket{ticketCount > 1 ? 's' : ''} - ${displayTotalCost} {localSelectedStacksToken && STACKS_TOKENS[localSelectedStacksToken as keyof typeof STACKS_TOKENS] ? STACKS_TOKENS[localSelectedStacksToken as keyof typeof STACKS_TOKENS].name : 'USDC'}</>}
        </Button>
      )}

      <p className="text-xs text-gray-500 text-center leading-relaxed">By purchasing, you agree to our terms{purchaseMode === "syndicate" ? " and support the selected cause" : ""}</p>
    </CompactStack>
  );
}
