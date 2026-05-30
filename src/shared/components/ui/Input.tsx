"use client";

/**
 * PREMIUM INPUT COMPONENT
 *
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Premium input with design.ts tokens
 * - MODULAR: Composable with variant + size + error state
 * - PERFORMANT: CSS-only transitions and focus effects
 * - CLEAN: Clear prop interface
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const inputVariants = cva(
  "w-full rounded-xl border transition-all duration-200 text-white placeholder:text-slate-500 bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-800/50",
  {
    variants: {
      variant: {
        /** Glass morphism — translucent with backdrop blur */
        glass:
          "bg-white/5 backdrop-blur-sm border-white/10 hover:border-white/20 focus-visible:border-indigo-500/50 focus-visible:ring-indigo-500/30",
        /** Solid dark background */
        solid:
          "bg-slate-800/80 border-slate-700 hover:border-slate-600 focus-visible:border-indigo-500/50 focus-visible:ring-indigo-500/30",
        /** Premium with glow on focus */
        premium:
          "bg-white/5 backdrop-blur-sm border-purple-500/20 hover:border-purple-500/40 focus-visible:border-purple-500 focus-visible:ring-purple-500/30 focus-visible:shadow-lg focus-visible:shadow-purple-500/10",
        /** Minimal — no background, thin border */
        outline:
          "border-slate-700/50 hover:border-slate-600 focus-visible:border-indigo-500/50 focus-visible:ring-indigo-500/30",
        /** Clear — no border until focus */
        ghost:
          "border-transparent hover:border-white/10 focus-visible:border-indigo-500/50 focus-visible:ring-indigo-500/30",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-5 text-base",
        xl: "h-14 px-6 text-lg",
      },
      error: {
        true:
          "border-red-500/60 hover:border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/30 shadow-sm shadow-red-500/10",
      },
    },
    defaultVariants: {
      variant: "glass",
      size: "md",
    },
    compoundVariants: [
      {
        variant: "glass",
        error: true,
        className:
          "border-red-500/60 hover:border-red-500 focus-visible:border-red-500",
      },
      {
        variant: "solid",
        error: true,
        className:
          "border-red-500/60 hover:border-red-500 focus-visible:border-red-500",
      },
    ],
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  /** Error message shown below the input */
  errorMessage?: string;
  /** Label text shown above the input */
  label?: string;
  /** Helper text shown below the input */
  helperText?: string;
  /** Left icon/component */
  leftIcon?: React.ReactNode;
  /** Right icon/component */
  rightIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      variant,
      size,
      error,
      errorMessage,
      label,
      helperText,
      leftIcon,
      rightIcon,
      type,
      ...props
    },
    ref
  ) => {
    const inputId = React.useId();

    return (
      <div className="w-full">
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-slate-300 mb-1.5"
          >
            {label}
          </label>
        )}

        {/* Input wrapper */}
        <div className="relative">
          {/* Left icon */}
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
              {leftIcon}
            </div>
          )}

          <input
            id={inputId}
            ref={ref}
            type={type}
            className={cn(
              inputVariants({ variant, size, error, className }),
              leftIcon && "pl-10",
              rightIcon && "pr-10"
            )}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={
              errorMessage || helperText ? `${inputId}-description` : undefined
            }
            {...props}
          />

          {/* Right icon */}
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400">
              {rightIcon}
            </div>
          )}
        </div>

        {/* Error message */}
        {errorMessage && (
          <p
            id={`${inputId}-description`}
            className="mt-1.5 text-xs text-red-400 flex items-center gap-1"
            role="alert"
          >
            <svg
              className="w-3.5 h-3.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            {errorMessage}
          </p>
        )}

        {/* Helper text */}
        {helperText && !errorMessage && (
          <p
            id={`${inputId}-description`}
            className="mt-1.5 text-xs text-slate-500"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input, inputVariants };
