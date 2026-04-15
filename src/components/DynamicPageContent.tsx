'use client';

import { useState, useEffect, type ReactNode } from 'react';

/**
 * Wrapper for page content that is loaded with next/dynamic({ ssr: false }).
 * 
 * ENHANCEMENT: This component now implements the ClientOnly pattern to ensure
 * children are ONLY rendered after hydration. This is critical for Next.js 14
 * because even when a component is loaded with { ssr: false }, the children
 * passed to it from a layout.tsx (Server Component) are evaluated on the server.
 * 
 * By using a 'mounted' state, we definitively prevent the server from
 * evaluating the page tree during "Generating static pages", avoiding:
 * - TypeError: Cannot read properties of null (reading 'useContext')
 * - TypeError: n.default.preload is not a function
 */
export default function DynamicPageContent({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return a minimal placeholder or loading state that is SSR-safe
    return <div className="flex-1 min-h-[50vh]" />;
  }

  return <>{children}</>;
}
