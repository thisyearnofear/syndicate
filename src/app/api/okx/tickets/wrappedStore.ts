/**
 * Test seam for /api/okx/tickets: route files may only export HTTP verbs and
 * segment config, so the injectable wrapped-handler slot lives here. Tests
 * set a stub; production leaves it null and the route builds the real
 * withX402 wrapper lazily.
 */

import type { NextRequest, NextResponse } from 'next/server';

export type WrappedHandler = (request: NextRequest) => Promise<NextResponse>;

let injected: WrappedHandler | null = null;

export function setWrappedHandlerForTests(handler: WrappedHandler | null): void {
  injected = handler;
}

export function getInjectedWrappedHandler(): WrappedHandler | null {
  return injected;
}
