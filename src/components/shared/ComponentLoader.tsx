/**
 * @deprecated Use UnifiedLoader from '@/components/shared/UnifiedLoader' instead
 * This file is kept for backward compatibility and will be removed in a future version.
 */

import { ComponentLoader as UnifiedComponentLoader } from './UnifiedLoader';

// Re-export the unified component for backward compatibility
export { UnifiedComponentLoader as ComponentLoader };
export default UnifiedComponentLoader;
