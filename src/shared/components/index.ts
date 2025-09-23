/**
 * ENHANCED SHARED COMPONENTS
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced existing components with premium versions
 * - MODULAR: Composable, reusable components
 * - PERFORMANT: Optimized for performance
 * - CLEAN: Clear component interfaces
 */

// Legacy components (enhanced)
export * from './ErrorBoundary';
export * from './LoadingSpinner';
export * from './Button';
export * from './Modal';
export * from './Toast';

// Premium components (new)
export * from './premium/PremiumButton';
export * from './premium/PuzzlePiece';
export * from './premium/Typography';
export * from './premium/CompactLayout';

// Convenience exports for most commonly used premium components
export {
  PremiumButton,
  JackpotButton,
  PremiumActionButton,
  GhostButton,
} from './premium/PremiumButton';

export {
  PuzzlePiece,
  PuzzleGrid,
  OverlappingPieces,
  MagneticPiece,
} from './premium/PuzzlePiece';

export {
  DisplayText,
  HeadlineText,
  BodyText,
  GlowText,
  CountUpText,
  TypewriterText,
  PremiumBadge,
} from './premium/Typography';

export {
  CompactContainer,
  CompactGrid,
  CompactStack,
  CompactHero,
  CompactCard,
  CompactSection,
  CompactFlex,
} from './premium/CompactLayout';