// Core Components - Organized exports
export { default as DelightfulButton } from './DelightfulButton';
export { ErrorBoundary } from './ErrorBoundary';
export { default as PerformanceMonitor } from './PerformanceMonitor';
export { default as ResponsiveLayout } from './ResponsiveLayout';
export { default as OptimisticJackpot } from './OptimisticJackpot';
export { default as LiveSocialProof } from './LiveSocialProof';
export { SmartTooltip } from './SmartTooltip';
export { OnboardingProgress } from './OnboardingProgress';

// AGGRESSIVE CONSOLIDATION: Deprecated - use UnifiedLoader instead
// export { default as Loader } from './Loader';

// ENHANCEMENT FIRST: Re-export unified components for convenience
export { 
  default as UnifiedLoader,
  ComponentLoader,
  ProviderLoader,
  ModalLoader,
  InlineLoader,
  PageLoader
} from '../shared/UnifiedLoader';

export {
  default as UnifiedModal,
  ConfirmationModal,
  LoadingModal,
  SuccessModal
} from '../shared/UnifiedModal';