"use client";

/**
 * TELEGRAM PROVIDER
 *
 * Wraps the Telegram WebApp SDK context for Mini App integration.
 * Detects if running inside Telegram Mini App and exposes
 * window.Telegram.WebApp API to React components.
 *
 * Architecture:
 * - Auto-detects Telegram Mini App context
 * - Provides WebApp instance via React context
 * - Handles safe area insets, back button, haptic feedback
 * - Graceful fallback when running outside Telegram
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";

// ============================================================================
// TYPES
// ============================================================================

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    start_param?: string;
  };
  version: string;
  platform: string;
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  isClosingConfirmationEnabled: boolean;
  ready: () => void;
  expand: () => void;
  close: () => void;
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    setText: (text: string) => void;
    setParams: (params: { text?: string; color?: string; text_color?: string }) => void;
  };
  BackButton: {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
    selectionChanged: () => void;
  };
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  openLink: (url: string) => void;
}

interface TelegramContextType {
  isTelegram: boolean;
  webApp: TelegramWebApp | null;
  user: TelegramWebApp["initDataUnsafe"]["user"] | null;
  colorScheme: "light" | "dark";
  haptic: TelegramWebApp["HapticFeedback"] | null;
}

// ============================================================================
// CONTEXT
// ============================================================================

const TelegramContext = createContext<TelegramContextType>({
  isTelegram: false,
  webApp: null,
  user: null,
  colorScheme: "light",
  haptic: null,
});

// ============================================================================
// PROVIDER
// ============================================================================

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [isTelegram, setIsTelegram] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;

    if (tg) {
      tg.ready();
      tg.expand();
      setWebApp(tg);
      setIsTelegram(true);
    }
  }, []);

  const value: TelegramContextType = {
    isTelegram,
    webApp,
    user: webApp?.initDataUnsafe?.user ?? null,
    colorScheme: webApp?.colorScheme ?? "light",
    haptic: webApp?.HapticFeedback ?? null,
  };

  return (
    <TelegramContext.Provider value={value}>
      {children}
    </TelegramContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useTelegram() {
  return useContext(TelegramContext);
}

/**
 * Hook to trigger haptic feedback (safe no-op outside Telegram)
 */
export function useHapticFeedback() {
  const { haptic } = useTelegram();

  const impact = useCallback(
    (style: "light" | "medium" | "heavy" = "medium") => {
      haptic?.impactOccurred(style);
    },
    [haptic],
  );

  const notification = useCallback(
    (type: "error" | "success" | "warning") => {
      haptic?.notificationOccurred(type);
    },
    [haptic],
  );

  const selectionChanged = useCallback(() => {
    haptic?.selectionChanged();
  }, [haptic]);

  return { impact, notification, selectionChanged };
}
