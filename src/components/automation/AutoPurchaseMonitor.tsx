"use client";

/**
 * AUTO-PURCHASE MONITOR
 *
 * Lightweight background component that runs the auto-execution polling loop.
 * Renders nothing — exists only to keep useAutoExecutionMonitor active while
 * the user has an enabled auto-purchase config.
 *
 * Mounted once in ClientProviders so it survives page navigations.
 */

import { useAutoExecutionMonitor } from "@/hooks";

export function AutoPurchaseMonitor() {
  useAutoExecutionMonitor();
  return null;
}
