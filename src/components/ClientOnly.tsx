'use client';

import type { ReactNode } from 'react';
import { useIsMounted } from '@/hooks/useIsMounted';

/**
 * Prevents children from rendering during SSR.
 * 
 * Next.js 14 tries to statically generate all pages, but our app
 * depends on wallet/web3 context providers that only exist on the client.
 * This wrapper ensures children are only rendered after hydration,
 * avoiding "Cannot read properties of null (reading 'useContext')" errors.
 */
export default function ClientOnly({ children }: { children: ReactNode }) {
  const mounted = useIsMounted();

  if (!mounted) {
    return null;
  }

  return <>{children}</>;
}
