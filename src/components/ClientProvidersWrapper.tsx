'use client';

import { type ReactNode } from 'react';
import ClientProviders from '@/components/ClientProviders';

/**
 * ClientProvidersWrapper
 *
 * Simply renders ClientProviders with children.  Previously used
 * next/dynamic({ ssr: false }) which DROPPED children during SSR,
 * causing React Error #321 because the client tried to evaluate
 * Server Components from scratch without the server-side Flight
 * payload.
 */
export default function ClientProvidersWrapper({ children }: { children?: ReactNode }) {
  return (
    <ClientProviders>
      {children}
    </ClientProviders>
  );
}
