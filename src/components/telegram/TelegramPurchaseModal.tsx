"use client";

/**
 * TELEGRAM PURCHASE MODAL
 *
 * Telegram-optimized purchase UI for Mini App context.
 * Simplified flow: select token (USDT/TON) → confirm → pay via TON Connect.
 * No MetaMask, no cross-chain UX, no App Store approval.
 */

import { useState, useCallback } from "react";
import { useTelegram, useHapticFeedback } from "./TelegramProvider";
import { SyndicateTonConnectButton } from "./TonConnectButton";
import { useTonConnect } from "@/hooks/useTonConnect";
import { useTonPay } from "@/hooks/useTonPay";

interface TelegramPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketCount: number;
  onSuccess?: (txHash: string) => void;
}

export function TelegramPurchaseModal({
  isOpen,
  onClose,
  ticketCount,
  onSuccess,
}: TelegramPurchaseModalProps) {
  const { isTelegram, colorScheme, user } = useTelegram();
  const { impact, notification } = useHapticFeedback();
  const { isConnected, address } = useTonConnect();
  const { pay, isPending } = useTonPay();

  const [selectedToken, setSelectedToken] = useState<"USDT" | "TON">("USDT");
  const [error, setError] = useState<string | null>(null);

  const ticketPrice = 1; // $1 per ticket
  const totalCost = ticketCount * ticketPrice;

  const handlePurchase = useCallback(async () => {
    if (!isConnected || !address) {
      setError("Please connect your TON wallet first");
      return;
    }

    setError(null);
    impact("medium");

    const lottoContract = process.env.NEXT_PUBLIC_TON_LOTTERY_CONTRACT;
    if (!lottoContract) {
      setError("TON lottery contract not configured");
      return;
    }

    const result = await pay({
      amount: selectedToken === "TON"
        ? (totalCost * 1e9).toString() // Convert to nanoTON
        : (totalCost * 1e6).toString(), // USDT has 6 decimals
      token: selectedToken,
      toAddress: lottoContract,
      baseAddress: address,
      ticketCount,
    });

    if (result.success) {
      notification("success");
      onSuccess?.(result.txHash ?? "");
      onClose();
    } else {
      notification("error");
      setError(result.error ?? "Payment failed");
    }
  }, [isConnected, address, selectedToken, totalCost, ticketCount, pay, impact, notification, onSuccess, onClose]);

  if (!isOpen) return null;

  const isDark = colorScheme === "dark";

  return (
    <div className={`fixed inset-0 z-50 flex items-end justify-center ${isDark ? "bg-black/60" : "bg-black/40"}`}>
      <div className={`w-full max-w-md rounded-t-2xl p-6 ${isDark ? "bg-gray-900 text-white" : "bg-white text-gray-900"}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Buy Lottery Tickets</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        {user && (
          <p className="mb-4 text-sm text-gray-500">
            Welcome, {user.first_name}
          </p>
        )}

        <div className="mb-4 rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
          <div className="flex justify-between text-sm">
            <span>Tickets</span>
            <span className="font-medium">{ticketCount}x</span>
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span>Total</span>
            <span className="font-bold">{totalCost} {selectedToken}</span>
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium">Pay with</label>
          <div className="flex gap-2">
            {(["USDT", "TON"] as const).map((token) => (
              <button
                key={token}
                onClick={() => {
                  setSelectedToken(token);
                  impact("light");
                }}
                className={`flex-1 rounded-lg border-2 py-2 text-center text-sm font-medium transition-colors ${
                  selectedToken === token
                    ? "border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/30"
                    : "border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700"
                }`}
              >
                {token}
              </button>
            ))}
          </div>
        </div>

        {!isConnected && (
          <div className="mb-4">
            <p className="mb-2 text-sm text-gray-500">Connect your TON wallet to continue</p>
            <SyndicateTonConnectButton />
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20">
            {error}
          </div>
        )}

        {isConnected && (
          <button
            onClick={handlePurchase}
            disabled={isPending}
            className="w-full rounded-xl bg-blue-500 py-3 text-center font-semibold text-white transition-colors hover:bg-blue-600 disabled:bg-gray-300 disabled:text-gray-500"
          >
            {isPending ? "Processing..." : `Pay ${totalCost} ${selectedToken}`}
          </button>
        )}

        <p className="mt-4 text-center text-xs text-gray-400">
          Payments secured by TON Connect • Fees &lt; $0.01
        </p>
      </div>
    </div>
  );
}
