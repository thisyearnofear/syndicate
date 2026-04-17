'use client';

import { type ReactNode } from 'react';
import ClientProviders from '@/components/ClientProviders';

/** Wraps ClientProviders for use in Server Component layout. */
export default function ClientProvidersWrapper({ children }: { children?: ReactNode }) {
  return (
    <ClientProviders>
      {children}
    </ClientProviders>
  );
}
