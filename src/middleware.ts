/**
 * NEXT.JS MIDDLEWARE
 * 
 * Initializes Vercel Postgres Gelato repository on app startup
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

let initialized = false;

export async function middleware(request: NextRequest) {
  // Initialize repository once on first request
  if (!initialized && process.env.POSTGRES_URLCONNECTION_STRING) {
    try {
      const { initializeProductionRepository } = await import('./lib/db/schema/gelatoTasks');
      await initializeProductionRepository();
      initialized = true;
    } catch (error) {
      console.error('Failed to initialize Gelato repository:', error);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
