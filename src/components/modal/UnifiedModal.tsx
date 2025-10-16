"use client";

import { ReactNode } from "react";

interface UnifiedModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "6xl";
  showCloseButton?: boolean;
  className?: string;
}

/**
 * Unified modal component following DRY principle
 * Single source of truth for all modal implementations
 */
export default function UnifiedModal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "md",
  showCloseButton = true,
  className = "",
}: UnifiedModalProps) {
  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "6xl": "max-w-6xl",
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`bg-gray-900 rounded-2xl p-6 w-full ${maxWidthClasses[maxWidth]} max-h-[90vh] overflow-y-auto border border-gray-700 modal-content relative z-[10000] ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showCloseButton) && (
          <div className="flex justify-between items-center mb-4">
            {title && <h3 className="text-xl font-bold text-white">{title}</h3>}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white text-2xl ml-auto"
              >
                ×
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
