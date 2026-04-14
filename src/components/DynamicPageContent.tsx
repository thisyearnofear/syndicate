'use client';

import { type ReactNode } from 'react';

/**
 * Wrapper for page content that is loaded with next/dynamic({ ssr: false }).
 * 
 * This prevents Next.js from trying to server-render page components during
 * "Generating static pages", which would fail because wallet/web3 context
 * providers (wagmi, RainbowKit, Solana, etc.) are not available during SSR.
 * 
 * The layout.tsx loads this component via:
 *   const DynamicPageContent = nextDynamic(
 *     () => import("@/components/DynamicPageContent"),
 *     { ssr: false }
 *   );
 */
export default function DynamicPageContent({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
