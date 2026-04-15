'use client';

import { type ReactNode } from 'react';
import nextDynamic from 'next/dynamic';

// Next.js 16: ssr:false is not allowed in Server Components
// This wrapper dynamically imports the component in a Client Component context
const ClientProviders = nextDynamic(
  () => import('@/components/ClientProviders'),
  { ssr: false }
);

const DynamicPageContent = nextDynamic(
  () => import('@/components/DynamicPageContent'),
  {
    ssr: false,
    loading: () => <div className="flex-1" />,
  }
);

/**
 * ClientProvidersWrapper - Next.js 16 compatible wrapper
 * 
 * In Next.js 16, ssr:false with next/dynamic can only be used in Client Components.
 * This wrapper is marked 'use client' so it can use both dynamic imports
 * with ssr:false and also wrap children that need the DynamicPageContent pattern.
 */
export default function ClientProvidersWrapper({ children }: { children?: ReactNode }) {
  return (
    <ClientProviders>
      {children && <DynamicPageContent>{children}</DynamicPageContent>}
    </ClientProviders>
  );
}