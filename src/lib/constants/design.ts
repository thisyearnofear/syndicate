/**
 * Design Tokens
 *
 * Centralized design system constants for colors, spacing, typography, etc.
 * This scaffold follows the Core Principles:
 *   - DRY: single source of truth for design values
 *   - MODULAR: can be imported wherever needed
 *   - PERFORMANT: lightweight JSON-like structure
 */

export const colors = {
  primary: "#4F46E5", // indigo-600
  secondary: "#10B981", // emerald-500
  background: "#111827", // gray-900
  surface: "#1F2937", // gray-800
  textPrimary: "#F9FAFB", // gray-50
  textSecondary: "#D1D5DB", // gray-300
  error: "#EF4444", // red-500
};

export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
};

export const borderRadius = {
  sm: "4px",
  md: "8px",
  lg: "12px",
  full: "9999px",
};

export const fontSize = {
  xs: "0.75rem",
  sm: "0.875rem",
  base: "1rem",
  lg: "1.125rem",
  xl: "1.25rem",
  "2xl": "1.5rem",
  "3xl": "1.875rem",
};

export const animation = {
  /** Duration in seconds for micro‑animations */
  duration: 0.3,
};

export type DesignTokens = typeof colors &
  typeof spacing &
  typeof borderRadius &
  typeof fontSize;
