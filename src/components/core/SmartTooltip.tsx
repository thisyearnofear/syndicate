"use client";

import { useState, useEffect, useRef } from 'react';
import { useSmartOnboarding } from '@/hooks/useSmartOnboarding';

/**
 * SmartTooltip - ENHANCEMENT FIRST
 * 
 * Contextual guidance tooltip that appears at the right moment
 * Non-intrusive, dismissible, and adapts to user behavior
 * 
 * Core Principles:
 * - ENHANCEMENT FIRST: Enhances existing UI without disruption
 * - CLEAN: Single component for all contextual guidance
 * - PERFORMANT: Minimal DOM impact, efficient positioning
 * - MODULAR: Reusable across different onboarding steps
 */

interface SmartTooltipProps {
  className?: string;
}

export function SmartTooltip({ className = "" }: SmartTooltipProps) {
  const { currentStep, completeStep, dismissStep, hasActiveStep } = useSmartOnboarding();
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // PERFORMANT: Calculate tooltip position based on target element
  useEffect(() => {
    if (!currentStep?.target || !hasActiveStep) {
      setIsVisible(false);
      return;
    }

    const targetElement = document.querySelector(currentStep.target);
    if (!targetElement) {
      setIsVisible(false);
      return;
    }

    const rect = targetElement.getBoundingClientRect();
    const tooltipRect = tooltipRef.current?.getBoundingClientRect();
    
    if (!tooltipRect) {
      setIsVisible(false);
      return;
    }

    let top = 0;
    let left = 0;

    // CLEAN: Position based on step configuration
    switch (currentStep.position) {
      case 'top':
        top = rect.top - tooltipRect.height - 12;
        left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'bottom':
        top = rect.bottom + 12;
        left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'left':
        top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
        left = rect.left - tooltipRect.width - 12;
        break;
      case 'right':
        top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
        left = rect.right + 12;
        break;
      default:
        // Center on screen for steps without targets
        top = window.innerHeight / 2 - tooltipRect.height / 2;
        left = window.innerWidth / 2 - tooltipRect.width / 2;
    }

    // PERFORMANT: Ensure tooltip stays within viewport
    const padding = 16;
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipRect.height - padding));
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipRect.width - padding));

    setPosition({ top, left });
    setIsVisible(true);
  }, [currentStep, hasActiveStep]);

  // ENHANCEMENT FIRST: Add highlight overlay for target elements
  useEffect(() => {
    if (!currentStep?.target || !hasActiveStep) return;

    const targetElement = document.querySelector(currentStep.target);
    if (!targetElement) return;

    // DELIGHT: Add subtle highlight
    const originalStyle = {
      boxShadow: (targetElement as HTMLElement).style.boxShadow,
      zIndex: (targetElement as HTMLElement).style.zIndex,
    };

    (targetElement as HTMLElement).style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.3)';
    (targetElement as HTMLElement).style.zIndex = '40';

    return () => {
      (targetElement as HTMLElement).style.boxShadow = originalStyle.boxShadow;
      (targetElement as HTMLElement).style.zIndex = originalStyle.zIndex;
    };
  }, [currentStep, hasActiveStep]);

  if (!hasActiveStep || !currentStep) return null;

  return (
    <>
      {/* CLEAN: Backdrop overlay for focus */}
      {currentStep.target && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 transition-opacity duration-300"
          onClick={() => dismissStep()}
        />
      )}

      {/* MODULAR: Tooltip content */}
      <div
        ref={tooltipRef}
        className={`fixed z-50 max-w-sm bg-gray-900 border border-blue-500/30 rounded-xl p-4 shadow-2xl transition-all duration-300 ${
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        } ${className}`}
        style={{
          top: position.top,
          left: position.left,
        }}
      >
        {/* DELIGHT: Step indicator */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            <span className="text-xs text-blue-400 font-medium">Quick Tip</span>
          </div>
          <button
            onClick={() => dismissStep()}
            className="text-gray-400 hover:text-white text-sm"
          >
            ✕
          </button>
        </div>

        {/* CLEAN: Step content */}
        <div className="space-y-3">
          <h3 className="text-white font-semibold text-sm">
            {currentStep.title}
          </h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            {currentStep.description}
          </p>

          {/* MODULAR: Action buttons */}
          <div className="flex gap-2 pt-2">
            {currentStep.action && (
              <button
                onClick={() => {
                  currentStep.action?.onClick();
                  completeStep();
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-2 rounded-lg transition-colors"
              >
                {currentStep.action.text}
              </button>
            )}
            <button
              onClick={() => completeStep()}
              className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs px-3 py-2 rounded-lg transition-colors"
            >
              Got it
            </button>
          </div>
        </div>

        {/* DELIGHT: Arrow pointer for targeted tooltips */}
        {currentStep.target && (
          <div
            className={`absolute w-3 h-3 bg-gray-900 border-blue-500/30 transform rotate-45 ${
              currentStep.position === 'top' ? 'bottom-[-6px] border-b border-r' :
              currentStep.position === 'bottom' ? 'top-[-6px] border-t border-l' :
              currentStep.position === 'left' ? 'right-[-6px] border-r border-b' :
              'left-[-6px] border-l border-t'
            }`}
            style={{
              left: currentStep.position === 'top' || currentStep.position === 'bottom' ? '50%' : undefined,
              top: currentStep.position === 'left' || currentStep.position === 'right' ? '50%' : undefined,
              transform: currentStep.position === 'top' || currentStep.position === 'bottom' ? 
                'translateX(-50%) rotate(45deg)' : 'translateY(-50%) rotate(45deg)',
            }}
          />
        )}
      </div>
    </>
  );
}