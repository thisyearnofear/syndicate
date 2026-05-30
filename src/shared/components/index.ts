/**
 * ENHANCED SHARED COMPONENTS
 *
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced existing components with premium versions
 * - MODULAR: Composable, reusable components
 * - PERFORMANT: Optimized for performance
 * - CLEAN: Clear component interfaces
 */

// UI Primitives (5-component library)
export * from './ui';

// Legacy components
export { LoadingSpinner, LoadingOverlay } from './LoadingSpinner';
export { ErrorBoundary } from './ErrorBoundary';

// Premium layout components
export {
  CompactContainer,
  CompactGrid,
  CompactStack,
  CompactHero,
  CompactCard,
  CompactSection,
  CompactFlex,
} from './premium/CompactLayout';

// Premium puzzle piece components
export {
  PuzzlePiece,
  PuzzleGrid,
  OverlappingPieces,
  MagneticPiece,
} from './premium/PuzzlePiece';
