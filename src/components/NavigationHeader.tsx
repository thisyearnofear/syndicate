"use client";

/**
 * NAVIGATION HEADER COMPONENT
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Built on existing Navigation component
 * - AGGRESSIVE CONSOLIDATION: Single navigation component
 * - DRY: Reuses existing Navigation component
 * - CLEAN: Clear separation of concerns
 */

import { usePathname } from 'next/navigation';
import Navigation from './Navigation';

export default function NavigationHeader() {
  const pathname = usePathname();

  // Only show navigation on main pages, not on modal-heavy pages
  const showNavigation = !pathname.includes('/auth') && !pathname.includes('/onboarding');

  if (!showNavigation) return null;

  return (
    <div className="pt-4 px-4">
      <Navigation />
    </div>
  );
}