// NavigationHeader is already a client component ('use client')
// In Next.js 16, we can just import it directly instead of using dynamic with ssr:false
import NavigationHeader from './NavigationHeader';

export default function DynamicNavigationHeader() {
  return <NavigationHeader />;
}
