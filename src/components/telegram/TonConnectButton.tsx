"use client";

/**
 * TON CONNECT BUTTON
 *
 * Wallet connection component for Telegram Mini App context.
 * Wraps @tonconnect/ui-react TonConnectButton with Syndicate styling.
 *
 * Supports: @Wallet, Tonkeeper, MyTonWallet
 */

import { TonConnectButton } from "@tonconnect/ui-react";
import { useTelegram } from "./TelegramProvider";

export function SyndicateTonConnectButton() {
  const { isTelegram } = useTelegram();

  if (!isTelegram) {
    return null;
  }

  return (
    <div className="flex items-center justify-center">
      <TonConnectButton />
    </div>
  );
}
