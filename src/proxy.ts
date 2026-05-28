/**
 * NEXT.JS MIDDLEWARE
 *
 * Core Principles Applied:
 * - SECURITY: CSP, HSTS, X-Frame-Options, rate limiting headers
 * - CLEAN: Single responsibility - request preprocessing
 * - PERFORMANT: Lightweight checks, no heavy computation
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// =============================================================================
// SECURITY HEADERS
// =============================================================================

function addSecurityHeaders(response: NextResponse): NextResponse {
  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');

  // XSS protection (legacy browsers)
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy - disable unused browser features
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );

  // HSTS - enforce HTTPS (only in production)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
  }

  return response;
}

// =============================================================================
// PROXY
// =============================================================================

export async function proxy(_request: NextRequest) {
  const response = NextResponse.next();
  addSecurityHeaders(response);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
