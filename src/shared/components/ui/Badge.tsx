"use client";

/**
 * PREMIUM BADGE COMPONENT
 *
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Premium badge with design.ts tokens
 * - MODULAR: Composable with variant + size + dot
 * - PERFORMANT: CSS-only transitions
 * - CLEAN: Clear prop interface
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 font-medium whitespace-nowrap transition-all duration-200 select-none",
  {
    variants: {
      variant: {
        /** Neutral / default */
        default:
          "bg-slate-700/60 text-slate-300 border border-slate-600/50",
        /** Primary brand */
        primary:
          "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30",
        /** Success / green */
        success:
          "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
        /** Warning / amber */
        warning:
          "bg-amber-500/20 text-amber-300 border border-amber-500/30",
        /** Error / red */
        error:
          "bg-red-500/20 text-red-300 border border-red-500/30",
        /** Info / blue */
        info:
          "bg-blue-500/20 text-blue-300 border border-blue-500/30",
        /** Premium gradient */
        premium:
          "bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 text-purple-300 border border-purple-500/30 shadow-sm shadow-purple-500/10",
        /** Glass */
        glass:
          "bg-white/10 backdrop-blur-sm text-white/80 border border-white/20",
        /** Outline only */
        outline:
          "bg-transparent text-slate-400 border border-slate-600",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px] rounded-md",
        md: "px-2.5 py-1 text-xs rounded-lg",
        lg: "px-3 py-1.5 text-sm rounded-xl",
      },
      /** Whether to show a colored status dot */
      dot: {
        true: "before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:flex-shrink-0",
        false: "",
      },
    },
    compoundVariants: [
      {
        variant: "default",
        dot: true,
        className: "before:bg-slate-400",
      },
      {
        variant: "primary",
        dot: true,
        className: "before:bg-indigo-400",
      },
      {
        variant: "success",
        dot: true,
        className: "before:bg-emerald-400",
      },
      {
        variant: "warning",
        dot: true,
        className: "before:bg-amber-400",
      },
      {
        variant: "error",
        dot: true,
        className: "before:bg-red-400",
      },
      {
        variant: "info",
        dot: true,
        className: "before:bg-blue-400",
      },
      {
        variant: "premium",
        dot: true,
        className: "before:bg-purple-400",
      },
      {
        variant: "glass",
        dot: true,
        className: "before:bg-white/60",
      },
      {
        variant: "outline",
        dot: true,
        className: "before:bg-slate-500",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "md",
      dot: false,
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Removable badge — shows an X button */
  removable?: boolean;
  /** Called when remove button is clicked */
  onRemove?: () => void;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, dot, removable, onRemove, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ variant, size, dot, className }))}
        {...props}
      >
        {children}
        {removable && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove?.();
            }}
            className="ml-0.5 hover:text-white transition-colors focus:outline-none"
            aria-label="Remove"
          >
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </span>
    );
  }
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
