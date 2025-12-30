/**
 * INFO TOOLTIP COMPONENT
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Reusable tooltip for all info needs
 * - CLEAN: Single responsibility - display contextual help
 * - MODULAR: Works with any content
 * - ORGANIZED: Part of common components
 * 
 * Subtle, non-intrusive educational component aligned with design system.
 * Uses hover + click for maximum accessibility.
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { AlertCircle as HelpCircle, X } from 'lucide-react';
import { colors, animations, shadows, spacing, borderRadius } from '@/config/design';

interface InfoTooltipProps {
  /** Tooltip content (can be text or React node) */
  content: React.ReactNode;
  
  /** Optional title for tooltip header */
  title?: string;
  
  /** Position relative to icon */
  position?: 'top' | 'bottom' | 'left' | 'right';
  
  /** Icon size in pixels */
  size?: 'sm' | 'md' | 'lg';
  
  /** Custom className for icon */
  iconClassName?: string;
  
  /** Whether to show on hover (mobile: tap to open) */
  showOnHover?: boolean;
  
  /** Auto-close after delay (ms), or null to not auto-close */
  autoCloseDelay?: number | null;
}

const ICON_SIZES = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
} as const;

const POSITION_CLASSES = {
  top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
  bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
  left: 'right-full mr-2 top-1/2 -translate-y-1/2',
  right: 'left-full ml-2 top-1/2 -translate-y-1/2',
} as const;

export function InfoTooltip({
  content,
  title,
  position = 'top',
  size = 'md',
  iconClassName,
  showOnHover = true,
  autoCloseDelay = null,
}: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
   const tooltipRef = useRef<HTMLDivElement>(null);
   const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Handle auto-close
  useEffect(() => {
    if (!isOpen || autoCloseDelay === null) return;

    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, autoCloseDelay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isOpen, autoCloseDelay]);

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative inline-block" ref={tooltipRef}>
      {/* Icon Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={showOnHover ? () => setIsOpen(true) : undefined}
        onMouseLeave={showOnHover ? () => setIsOpen(false) : undefined}
        className={`
          inline-flex items-center justify-center
          text-gray-400 hover:text-gray-600
          transition-colors duration-200
          ${iconClassName || ''}`}
        aria-label="Show information"
      >
        <HelpCircle className={ICON_SIZES[size]} strokeWidth={1.5} />
      </button>

      {/* Tooltip Popup */}
      {isOpen && (
        <div
          className={`
            absolute z-50 ${POSITION_CLASSES[position]}
            bg-gray-900 text-gray-50
            rounded-lg shadow-lg
            border border-gray-700
            p-3 max-w-xs
            animate-in fade-in slide-in-from-bottom-2 duration-200
          `}
          style={{
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(8px)',
            boxShadow: shadows.lg,
          }}
        >
          {/* Title + Close Button */}
          {title && (
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-50">{title}</h3>
              <button
                 type="button"
                 onClick={() => setIsOpen(false)}
                 className="p-0.5 hover:bg-gray-700 rounded transition-colors"
               >
                 <X className="w-4 h-4" />
               </button>
            </div>
          )}

          {/* Content */}
          <div className="text-xs text-gray-300 leading-relaxed">
            {content}
          </div>

          {/* Pointer Arrow */}
          <div
            className="absolute w-2 h-2 bg-gray-900 border border-gray-700 rotate-45"
            style={{
              ...(position === 'top' && { bottom: '-5px', left: '50%', transform: 'translateX(-50%)' }),
              ...(position === 'bottom' && { top: '-5px', left: '50%', transform: 'translateX(-50%)' }),
              ...(position === 'left' && { right: '-5px', top: '50%', transform: 'translateY(-50%)' }),
              ...(position === 'right' && { left: '-5px', top: '50%', transform: 'translateY(-50%)' }),
            }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Pre-built tooltip for Advanced Permissions education
 */
export function AdvancedPermissionsTooltip() {
  return (
    <InfoTooltip
      title="What are Advanced Permissions?"
      position="bottom"
      size="sm"
      content={
        <div className="space-y-2">
          <p>
            Grant Syndicate permission to automatically buy lottery tickets on your behalf. You set the limit ($50/week or $200/month) and MetaMask enforces it.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            ✓ You control the limit  
            ✓ Revoke anytime  
            ✓ Only on Base mainnet
          </p>
        </div>
      }
    />
  );
}

/**
 * Tooltip for chain requirements
 */
export function ChainRequirementTooltip() {
  return (
    <InfoTooltip
      title="Chain Support"
      position="bottom"
      size="sm"
      content={
        <div className="space-y-1">
          <p>Advanced Permissions require MetaMask on:</p>
          <ul className="text-xs space-y-1 mt-2">
            <li>✓ Base (mainnet)</li>
            <li>✓ Ethereum (mainnet)</li>
            <li>✓ Avalanche (mainnet)</li>
          </ul>
          <p className="text-xs text-gray-400 mt-2">
            Other chains support standard ticket purchases without permissions.
          </p>
        </div>
      }
    />
  );
}
