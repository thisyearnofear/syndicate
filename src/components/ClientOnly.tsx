'use client';

import { useState, useEffect, type ReactNode } from 'react';

/**
 * Prevents children from rendering during SSR.
 * 
 * Next.js 14 tries to statically generate all pages, but our app
 * depends on wallet/web3 context providers that only exist on the client.
 * This wrapper ensures children are only rendered after hydration,
 * avoiding "Cannot read properties of null (reading 'useContext')" errors.
 */
export default function ClientOnly({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return <>{children}</>;
}
