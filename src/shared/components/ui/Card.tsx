"use client";

/**
 * PREMIUM CARD COMPONENT
 *
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Premium card with design.ts tokens
 * - MODULAR: Composable with variant + padding + hover props
 * - PERFORMANT: CSS-only hover effects and transitions
 * - CLEAN: Clear prop interface
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva(
  "relative transition-all duration-300 rounded-2xl",
  {
    variants: {
      variant: {
        /** Glass morphism — translucent with blur backdrop */
        glass:
          "bg-white/5 backdrop-blur-md border border-white/10",
        /** Premium gradient with glow */
        premium:
          "bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-purple-500/20 backdrop-blur-md shadow-lg shadow-purple-500/10",
        /** Solid dark background */
        solid:
          "bg-slate-800 border border-slate-700",
        /** Border only, transparent background */
        outline:
          "bg-transparent border border-slate-700 hover:border-slate-500",
        /** Elevated with shadow */
        elevated:
          "bg-slate-800/80 border border-slate-700/50 shadow-xl shadow-black/20",
        /** Gradient primary fill */
        "gradient-primary":
          "bg-gradient-to-br from-indigo-600 to-purple-700 text-white border-0 shadow-xl shadow-indigo-900/30",
        /** Dark glass (heavier backdrop) */
        "glass-dark":
          "bg-black/20 backdrop-blur-xl border border-white/10",
      },
      padding: {
        none: "p-0",
        sm: "p-4",
        md: "p-6",
        lg: "p-8",
        xl: "p-10",
      },
      hover: {
        none: "",
        lift: "hover:-translate-y-1 hover:shadow-xl hover:shadow-black/30",
        glow: "hover:shadow-lg hover:shadow-indigo-500/10",
        scale: "hover:scale-[1.02]",
        "premium-lift":
          "hover:-translate-y-2 hover:shadow-2xl hover:shadow-purple-500/15",
      },
    },
    defaultVariants: {
      variant: "glass",
      padding: "md",
      hover: "none",
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  /** Whether the card acts as a clickable button */
  interactive?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, hover, interactive = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          cardVariants({ variant, padding, hover, className }),
          interactive && "cursor-pointer group"
        )}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        {...props}
      >
        {/* Animated glow ring for interactive cards */}
        {interactive && (
          <div className="absolute inset-0 rounded-2xl ring-1 ring-transparent group-hover:ring-indigo-500/30 transition-all duration-300 pointer-events-none" />
        )}
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";

/**
 * Card sub-components for structured layouts
 */

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional action element rendered on the right side */
  action?: React.ReactNode;
}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, action, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex items-start justify-between gap-4 mb-4", className)}
        {...props}
      >
        <div className="flex-1 min-w-0">{children}</div>
        {action && (
          <div className="flex-shrink-0">{action}</div>
        )}
      </div>
    );
  }
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => {
  return (
    <h3
      ref={ref}
      className={cn("text-lg font-semibold text-white", className)}
      {...props}
    >
      {children}
    </h3>
  );
});
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  return (
    <p
      ref={ref}
      className={cn("text-sm text-slate-400", className)}
      {...props}
    >
      {children}
    </p>
  );
});
CardDescription.displayName = "CardDescription";

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("", className)} {...props}>
        {children}
      </div>
    );
  }
);
CardContent.displayName = "CardContent";

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-end gap-3 mt-6 pt-4 border-t border-white/10",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  cardVariants,
};
