/**
 * TON WEBHOOK HANDLER
 *
 * Handles incoming webhook events from the Telegram Bot API.
 * Routes bot commands (e.g., /buy, /balance, /winnings) to the appropriate handlers.
 *
 * Setup:
 * 1. Register webhook via https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://yourdomain.com/api/ton-webhook
 * 2. Verify webhook secret via TON_WEBHOOK_SECRET env var
 */

import { NextRequest, NextResponse } from "next/server";

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    date: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const webhookSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    const expectedSecret = process.env.TON_WEBHOOK_SECRET;

    if (expectedSecret && webhookSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const update = (await request.json()) as TelegramUpdate;

    if (!update.message?.text) {
      return NextResponse.json({ ok: true });
    }

    const { text, from, chat } = update.message;
    const botToken = process.env.TON_BOT_TOKEN;

    if (!botToken) {
      console.error("[TON Webhook] TON_BOT_TOKEN not configured");
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    // Route bot commands
    if (text.startsWith("/start")) {
      const miniAppUrl = process.env.NEXT_PUBLIC_APP_URL || "https://syndicate.app";
      await sendTelegramMessage(botToken, chat.id,
        `Welcome to Syndicate Lottery! 🎫\n\n` +
        `Buy Megapot tickets with USDT/TON directly in Telegram.\n` +
        `No MetaMask required — payments via TON Connect.`
      );
      // Send inline keyboard with Mini App button
      await sendTelegramKeyboard(botToken, chat.id, "Open App", `${miniAppUrl}?tgWebAppStartParam=welcome`);
    } else if (text.startsWith("/buy")) {
      const miniAppUrl = process.env.NEXT_PUBLIC_APP_URL || "https://syndicate.app";
      await sendTelegramKeyboard(botToken, chat.id, "Buy Tickets", `${miniAppUrl}/buy?tgWebAppStartParam=buy`);
    } else if (text.startsWith("/balance")) {
      await sendTelegramMessage(botToken, chat.id,
        `Connect your TON wallet in the Mini App to check your balance.`
      );
    } else if (text.startsWith("/help")) {
      await sendTelegramMessage(botToken, chat.id,
        `Syndicate Lottery Commands:\n\n` +
        `/start - Welcome message\n` +
        `/buy - Open ticket purchase\n` +
        `/balance - Check wallet balance\n` +
        `/winnings - Check your winnings\n` +
        `/help - Show this message`
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[TON Webhook] Error:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

async function sendTelegramMessage(botToken: string, chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}

async function sendTelegramKeyboard(botToken: string, chatId: number, buttonText: string, url: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "Open the Syndicate Mini App:",
      reply_markup: {
        inline_keyboard: [[{ text: buttonText, web_app: { url } }]],
      },
    }),
  });
}
