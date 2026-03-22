"use client";

/**
 * TON PAY HOOK
 *
 * Handles USDT/TON payments via TON Connect inside Telegram Mini Apps.
 * Builds proper TON cell payloads matching the SyndicateLotteryTON contract.
 *
 * Contract expects:
 *   - OP_PURCHASE_TICKETS (0x50555243): opcode(32) + query_id(64) + base_address + ticket_count(16)
 *   - Simple TON send (no body): treated as 1 ticket purchase
 */

import { useState, useCallback } from "react";
import { useTonConnectUI } from "@tonconnect/ui-react";
import { useTelegram } from "@/components/telegram/TelegramProvider";
import { beginCell } from "@ton/core";

const OP_PURCHASE_TICKETS = 0x50555243;

export interface TonPaymentParams {
  /** Amount in nanoTON or nanoUSDT */
  amount: string;
  /** Token type */
  token: "TON" | "USDT";
  /** Recipient TON address (lottery contract) */
  toAddress: string;
  /** User's Base/EVM address for ticket delivery */
  baseAddress: string;
  /** Number of tickets to purchase */
  ticketCount: number;
}

export interface TonPaymentResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

/**
 * Build OP_PURCHASE_TICKETS payload as base64 BOC.
 * Contract FunC: body~load_uint(32) op, body~load_uint(64) query_id,
 *                body~load_msg_addr() base_address, body~load_uint(16) ticket_count
 *
 * For the msg_addr we store the EVM address as a raw external address slice.
 */
function buildPurchasePayload(baseAddress: string, ticketCount: number): string {
  const addrHex = baseAddress.replace("0x", "").padStart(40, "0");
  const addrBuf = Buffer.from(addrHex, "hex");

  const cell = beginCell()
    .storeUint(OP_PURCHASE_TICKETS, 32)
    .storeUint(Date.now(), 64)
    .storeUint(2, 2)           // addr_extern: type = 2
    .storeUint(160, 9)         // addr_extern: len = 160 bits (20 bytes EVM)
    .storeBuffer(addrBuf, 20)  // addr_extern: 20 bytes
    .storeUint(ticketCount, 16)
    .endCell();

  return cell.toBoc().toString("base64");
}

export function useTonPay() {
  const [tonConnectUI] = useTonConnectUI();
  const { haptic } = useTelegram();
  const [isPending, setIsPending] = useState(false);

  const pay = useCallback(
    async (params: TonPaymentParams): Promise<TonPaymentResult> => {
      setIsPending(true);
      try {
        haptic?.impactOccurred("light");

        const payload = buildPurchasePayload(params.baseAddress, params.ticketCount);

        const tx = {
          validUntil: Math.floor(Date.now() / 1000) + 600,
          messages: [
            {
              address: params.toAddress,
              amount: params.amount,
              payload,
            },
          ],
        };

        const result = await tonConnectUI.sendTransaction(tx);

        haptic?.notificationOccurred("success");

        return {
          success: true,
          txHash: result.boc,
        };
      } catch (error) {
        haptic?.notificationOccurred("error");
        return {
          success: false,
          error: error instanceof Error ? error.message : "Payment failed",
        };
      } finally {
        setIsPending(false);
      }
    },
    [tonConnectUI, haptic],
  );

  return { pay, isPending };
}
