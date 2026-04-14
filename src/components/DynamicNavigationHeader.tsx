import dynamic from 'next/dynamic';

// Dynamically import NavigationHeader with SSR disabled to avoid hydration/hook mismatches
const NavigationHeader = dynamic(
  () => import('@/components/NavigationHeader'),
  {
    ssr: false,
    loading: () => <div className="h-16 bg-transparent"></div>
  }
);

export default function DynamicNavigationHeader() {
  // SSR is disabled to prevent React hook mismatches (Error #321)
  return <NavigationHeader />;
}
