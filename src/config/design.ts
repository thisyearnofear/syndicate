/**
 * PREMIUM DESIGN SYSTEM
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced design tokens for premium feel
 * - CLEAN: Systematic design language
 * - MODULAR: Composable design elements
 * - PERFORMANT: Optimized animations and effects
 */

// =============================================================================
// PREMIUM TYPOGRAPHY
// =============================================================================

export const typography = {
  fonts: {
    display: '"SF Pro Display", "Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    body: '"SF Pro Text", "Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    mono: '"SF Mono", "Fira Code", "JetBrains Mono", monospace',
  },
  weights: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    black: 900,
  },
  sizes: {
    xs: '0.75rem',     // 12px
    sm: '0.875rem',    // 14px
    base: '1rem',      // 16px
    lg: '1.125rem',    // 18px
    xl: '1.25rem',     // 20px
    '2xl': '1.5rem',   // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
    '5xl': '3rem',     // 48px
    '6xl': '3.75rem',  // 60px
    '7xl': '4.5rem',   // 72px
  },
  lineHeights: {
    tight: 1.1,
    snug: 1.2,
    normal: 1.5,
    relaxed: 1.6,
    loose: 1.8,
  },
} as const;

// =============================================================================
// PREMIUM COLOR PALETTE
// =============================================================================

export const colors = {
  // Primary brand colors
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
    950: '#082f49',
  },
  
  // Secondary accent colors
  secondary: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
    950: '#052e16',
  },
  
  // Premium gradients
  gradients: {
    primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    secondary: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    success: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    warning: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    premium: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
    jackpot: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  },
  
  // Neutral grays
  gray: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },
  
  // Status colors
  status: {
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
} as const;

// =============================================================================
// PREMIUM SPACING & LAYOUT
// =============================================================================

export const spacing = {
  px: '1px',
  0: '0',
  0.5: '0.125rem',  // 2px
  1: '0.25rem',     // 4px
  1.5: '0.375rem',  // 6px
  2: '0.5rem',      // 8px
  2.5: '0.625rem',  // 10px
  3: '0.75rem',     // 12px
  3.5: '0.875rem',  // 14px
  4: '1rem',        // 16px
  5: '1.25rem',     // 20px
  6: '1.5rem',      // 24px
  7: '1.75rem',     // 28px
  8: '2rem',        // 32px
  9: '2.25rem',     // 36px
  10: '2.5rem',     // 40px
  11: '2.75rem',    // 44px
  12: '3rem',       // 48px
  14: '3.5rem',     // 56px
  16: '4rem',       // 64px
  20: '5rem',       // 80px
  24: '6rem',       // 96px
  28: '7rem',       // 112px
  32: '8rem',       // 128px
} as const;

// =============================================================================
// PREMIUM SHADOWS & EFFECTS
// =============================================================================

export const shadows = {
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  
  // Premium glows
  glow: {
    sm: '0 0 10px rgb(59 130 246 / 0.5)',
    md: '0 0 20px rgb(59 130 246 / 0.5)',
    lg: '0 0 30px rgb(59 130 246 / 0.5)',
    primary: '0 0 20px rgb(102 126 234 / 0.6)',
    secondary: '0 0 20px rgb(34 197 94 / 0.6)',
    jackpot: '0 0 30px rgb(251 191 36 / 0.8)',
  },
} as const;

// =============================================================================
// PREMIUM BORDER RADIUS
// =============================================================================

export const borderRadius = {
  none: '0',
  sm: '0.125rem',   // 2px
  md: '0.375rem',   // 6px
  lg: '0.5rem',     // 8px
  xl: '0.75rem',    // 12px
  '2xl': '1rem',    // 16px
  '3xl': '1.5rem',  // 24px
  full: '9999px',
  
  // Premium shapes
  premium: '1.25rem', // 20px
  card: '1rem',       // 16px
  button: '0.75rem',  // 12px
} as const;

// =============================================================================
// PREMIUM ANIMATIONS
// =============================================================================

export const animations = {
  durations: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
    slower: '750ms',
  },
  
  easings: {
    linear: 'linear',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    
    // Premium easings
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    elastic: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    premium: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  },
  
  keyframes: {
    fadeIn: {
      '0%': { opacity: '0', transform: 'translateY(10px)' },
      '100%': { opacity: '1', transform: 'translateY(0)' },
    },
    slideIn: {
      '0%': { transform: 'translateX(-100%)' },
      '100%': { transform: 'translateX(0)' },
    },
    scaleIn: {
      '0%': { transform: 'scale(0.9)', opacity: '0' },
      '100%': { transform: 'scale(1)', opacity: '1' },
    },
    pulse: {
      '0%, 100%': { opacity: '1' },
      '50%': { opacity: '0.5' },
    },
    glow: {
      '0%, 100%': { boxShadow: '0 0 20px rgb(59 130 246 / 0.5)' },
      '50%': { boxShadow: '0 0 30px rgb(59 130 246 / 0.8)' },
    },
  },
} as const;

// =============================================================================
// PREMIUM BREAKPOINTS
// =============================================================================

export const breakpoints = {
  xs: '475px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// =============================================================================
// COMPONENT VARIANTS
// =============================================================================

export const variants = {
  button: {
    primary: {
      background: colors.gradients.primary,
      color: 'white',
      shadow: shadows.lg,
      hover: {
        transform: 'translateY(-2px)',
        shadow: shadows.xl,
      },
    },
    secondary: {
      background: colors.gradients.secondary,
      color: 'white',
      shadow: shadows.md,
    },
    premium: {
      background: colors.gradients.premium,
      color: 'white',
      shadow: shadows.glow.primary,
    },
  },
  
  card: {
    default: {
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: borderRadius.card,
      backdropFilter: 'blur(10px)',
    },
    premium: {
      background: colors.gradients.premium,
      border: 'none',
      borderRadius: borderRadius.premium,
      shadow: shadows.glow.primary,
    },
  },
} as const;

// =============================================================================
// LAYOUT CONSTANTS
// =============================================================================

export const layout = {
  maxWidth: {
    xs: '20rem',     // 320px
    sm: '24rem',     // 384px
    md: '28rem',     // 448px
    lg: '32rem',     // 512px
    xl: '36rem',     // 576px
    '2xl': '42rem',  // 672px
    '3xl': '48rem',  // 768px
    '4xl': '56rem',  // 896px
    '5xl': '64rem',  // 1024px
    '6xl': '72rem',  // 1152px
    '7xl': '80rem',  // 1280px
    full: '100%',
    screen: '100vw',
  },
  
  container: {
    center: true,
    padding: {
      default: '1rem',
      sm: '2rem',
      lg: '4rem',
      xl: '5rem',
      '2xl': '6rem',
    },
  },
} as const;

// =============================================================================
// EXPORT CONSOLIDATED DESIGN SYSTEM
// =============================================================================

export const premiumDesign = {
  typography,
  colors,
  spacing,
  shadows,
  borderRadius,
  animations,
  breakpoints,
  variants,
  layout,
} as const;

export default premiumDesign;