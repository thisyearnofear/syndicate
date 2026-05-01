/**
 * SHARED API RESPONSE UTILITIES
 *
 * Core Principles Applied:
 * - DRY: Single source of truth for CORS, errors, and rate limiting
 * - CLEAN: Explicit, composable helpers
 * - SECURE: No internal error leakage in production
 */

import { NextResponse } from 'next/server';

// =============================================================================
// CORS
// =============================================================================

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [
      'https://syndicate.app',
      'https://www.syndicate.app',
      'https://megapot.io',
      'https://www.megapot.io',
    ];

// In development, allow localhost
if (process.env.NODE_ENV === 'development') {
  ALLOWED_ORIGINS.push('http://localhost:3000', 'http://localhost:3001');
}

export function getCorsHeaders(origin?: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0] ?? '*';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

// =============================================================================
// STANDARD ERROR RESPONSES
// =============================================================================

export function apiError(
  message: string,
  status: number = 500,
  details?: string
): NextResponse {
  const body: Record<string, string> = { error: message };

  // Only include details in development
  if (details && process.env.NODE_ENV === 'development') {
    body.details = details;
  }

  return NextResponse.json(body, { status });
}

export function apiSuccess<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function apiValidationError(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function apiNotFound(message: string = 'Resource not found'): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

// =============================================================================
// RATE LIMITING (in-memory, per-IP)
// =============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60_000, // 1 minute
  maxRequests: 60,
};

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const key = identifier;
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + config.windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt };
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
}

export function rateLimitError(resetAt: number): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
      },
    }
  );
}

// =============================================================================
// INPUT VALIDATION HELPERS
// =============================================================================

export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function isValidSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

export function isValidNearAddress(address: string): boolean {
  return address.endsWith('.near') || /^[0-9a-f]{64}$/.test(address);
}

export function isValidStarknetAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{50,66}$/.test(address);
}

export function isValidStacksAddress(address: string): boolean {
  return /^(SP|ST)[0-9A-Z]{25,45}$/.test(address);
}

export function isValidTxHash(hash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

export function isValidChainId(chainId: unknown): chainId is number {
  return typeof chainId === 'number' && Number.isInteger(chainId) && chainId > 0;
}

export function parsePositiveNumber(value: unknown): number | null {
  if (typeof value === 'number' && value > 0 && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(value);
    if (n > 0 && Number.isFinite(n)) return n;
  }
  return null;
}

// =============================================================================
// SAFE ERROR EXTRACTION (no internal leakage)
// =============================================================================

export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred';
}

export function getErrorDetails(error: unknown): string {
  // Only for development logging - never send to client
  if (error instanceof Error) return error.stack ?? error.message;
  return String(error);
}
