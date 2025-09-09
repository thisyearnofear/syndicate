"use client";

import React from 'react';
import { useEffect, useState } from 'react';
import DynamicBackdrop from './DynamicBackdrop';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export default function ResponsiveLayout({ children, className = '' }: ResponsiveLayoutProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
      setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  return (
    <div className={`responsive-layout ${className}`}>
      {/* Mobile Layout */}
      {isMobile && (
        <DynamicBackdrop className="mobile-layout min-h-screen">
          <div className="px-4 py-6 pb-20">
            {children}
          </div>
        </DynamicBackdrop>
      )}

      {/* Tablet Layout */}
      {isTablet && (
        <DynamicBackdrop className="tablet-layout min-h-screen">
          <div className="px-6 py-8">
            <div className="max-w-4xl mx-auto">
              {children}
            </div>
          </div>
        </DynamicBackdrop>
      )}

      {/* Desktop Layout */}
      {!isMobile && !isTablet && (
        <DynamicBackdrop className="desktop-layout min-h-screen">
          <div className="px-8 py-12">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </div>
        </DynamicBackdrop>
      )}

      {/* Global Responsive Styles */}
      <style jsx global>{`
        .responsive-layout {
          --mobile-padding: 1rem;
          --tablet-padding: 1.5rem;
          --desktop-padding: 2rem;
        }

        @media (max-width: 767px) {
          .responsive-layout .grid {
            grid-template-columns: 1fr !important;
            gap: 1rem !important;
          }
          
          .responsive-layout .text-6xl {
            font-size: 2.5rem !important;
          }
          
          .responsive-layout .text-5xl {
            font-size: 2rem !important;
          }
          
          .responsive-layout .text-4xl {
            font-size: 1.75rem !important;
          }
          
          .responsive-layout .p-8 {
            padding: 1rem !important;
          }
          
          .responsive-layout .p-6 {
            padding: 0.75rem !important;
          }
          
          .responsive-layout .space-y-8 > * + * {
            margin-top: 1.5rem !important;
          }
          
          .responsive-layout .space-y-6 > * + * {
            margin-top: 1rem !important;
          }
        }

        @media (min-width: 768px) and (max-width: 1023px) {
          .responsive-layout .grid-cols-3 {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          
          .responsive-layout .grid-cols-4 {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }

        @media (min-width: 1024px) {
          .responsive-layout .container {
            max-width: 1200px;
          }
        }
      `}</style>
    </div>
  );
}

// Hook for responsive utilities
export function useResponsive() {
  const [screenSize, setScreenSize] = useState({
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    width: 0,
    height: 0
  });

  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setScreenSize({
        isMobile: width < 768,
        isTablet: width >= 768 && width < 1024,
        isDesktop: width >= 1024,
        width,
        height
      });
    };

    updateScreenSize();
    window.addEventListener('resize', updateScreenSize);
    return () => window.removeEventListener('resize', updateScreenSize);
  }, []);

  return screenSize;
}

// Responsive component wrapper
export function ResponsiveComponent({ 
  mobile, 
  tablet, 
  desktop, 
  fallback 
}: {
  mobile?: React.ReactNode;
  tablet?: React.ReactNode;
  desktop?: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { isMobile, isTablet, isDesktop } = useResponsive();

  if (isMobile && mobile) return <>{mobile}</>;
  if (isTablet && tablet) return <>{tablet}</>;
  if (isDesktop && desktop) return <>{desktop}</>;
  
  return <>{fallback}</>;
}