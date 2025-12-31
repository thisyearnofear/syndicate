import dynamic from 'next/dynamic';

// Dynamically import NavigationHeader with SSR enabled but with loading state
const NavigationHeader = dynamic(
  () => import('@/components/NavigationHeader'),
  {
    ssr: true,
    loading: () => <div className="h-16 bg-transparent"></div>
  }
);

export default function DynamicNavigationHeader() {
  // No need for isMounted state since we're using SSR
  return <NavigationHeader />;
}
