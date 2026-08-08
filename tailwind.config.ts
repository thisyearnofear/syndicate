import type { Config } from "tailwindcss"

const config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Brand identity scale — the single source of truth for primary accents.
        // Anchored on a sky→blue "ocean" gradient (see .gradient-cta in globals.css).
        brand: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
          950: "#082f49",
        },
        // Semantic surface tokens for consistent dark theme
        surface: {
          DEFAULT: "#0f172a",  // slate-900 — primary background
          raised: "#1e293b",   // slate-800 — cards, modals, popovers
          overlay: "#1e293b",  // slate-800 — modal overlays
          muted: "#334155",    // slate-700 — secondary surfaces
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "scale-in": "scale-in 0.5s ease-out",
        "fade-in": "fade-in 0.6s ease-out 0.2s both",
        "fade-in-delay": "fade-in 0.6s ease-out 0.4s both",
        // Motion system utilities
        "enter": "fadeInUp var(--duration-moderate) var(--ease-out) both",
        "enter-scale": "scaleIn var(--duration-normal) var(--ease-out) both",
        "disclosure": "disclosureExpand var(--duration-normal) var(--ease-out) forwards",
      },
      transitionTimingFunction: {
        'out-strong': 'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out-strong': 'cubic-bezier(0.77, 0, 0.175, 1)',
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'drawer': 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      transitionDuration: {
        'instant': '100ms',
        'fast': '150ms',
        'normal': '200ms',
        'moderate': '280ms',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "scale-in": {
          from: { transform: "scale(0.8)", opacity: "0" },
          to: { transform: "scale(1)", opacity: "1" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("tailwindcss-animate")],
} satisfies Config

export default config 