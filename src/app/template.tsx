// Root template — forces all pages to be dynamically rendered.
// Unlike layout.tsx, route segment config from template.tsx properly
// prevents static page generation in Next.js 14.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Template({ children }: { children: React.ReactNode }) {
  return children;
}
