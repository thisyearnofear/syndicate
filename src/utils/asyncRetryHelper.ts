/**
 * ASYNC RETRY HELPER
 * 
 * Single source of truth for timeout, retry, and exponential backoff logic
 * Used across bridging, wallet connections, and RPC calls
 * 
 * Core Principles:
 * - DRY: Consolidates retry logic used in multiple places
 * - PERFORMANT: Exponential backoff to prevent thundering herd
 * - CLEAN: Clear error messages with actionable context
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  timeoutMs?: number;
  onAttempt?: (attempt: number, error?: Error) => void;
  onTimeout?: (context: string) => void;
}

export interface TimeoutOptions {
  timeoutMs: number;
  context?: string;
}

/**
 * Wrap a promise with a timeout
 * ENHANCEMENT: Replaces ad-hoc timeout logic scattered throughout codebase
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  options: TimeoutOptions
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => {
          const context = options.context ? ` (${options.context})` : '';
          reject(
            new Error(
              `Operation timeout after ${options.timeoutMs}ms${context}`
            )
          );
        },
        options.timeoutMs
      )
    ),
  ]);
}

/**
 * Retry a function with exponential backoff
 * ENHANCEMENT: Consolidates retry logic from solanaBridgeService, bridgeService, etc.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 1.5,
    timeoutMs,
    onAttempt,
    onTimeout,
  } = options;

  let lastError: Error | null = null;
  let delayMs = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const promise = fn();
      const result = timeoutMs
        ? await withTimeout(promise, {
            timeoutMs,
            context: `attempt ${attempt}/${maxAttempts}`,
          })
        : await promise;

      if (attempt > 1) {
        console.log(`✅ Succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts) {
        onAttempt?.(attempt, lastError);
        console.warn(
          `Attempt ${attempt} failed: ${lastError.message}. Retrying in ${delayMs}ms...`
        );
        await new Promise((r) => setTimeout(r, delayMs));
        delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
      } else {
        onAttempt?.(attempt, lastError);
        onTimeout?.(lastError.message);
      }
    }
  }

  throw (
    lastError ||
    new Error(`Failed after ${maxAttempts} attempts`)
  );
}

/**
 * Poll a condition with exponential backoff
 * ENHANCEMENT: Used for attestation polling, balance checking, etc.
 */
export async function pollWithBackoff<T>(
  fn: () => Promise<T | null>,
  options: {
    maxWaitMs: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    context?: string;
  }
): Promise<T | null> {
  const {
    maxWaitMs,
    initialDelayMs = 2000,
    maxDelayMs = 10000,
    backoffMultiplier = 1.5,
    context = 'polling',
  } = options;

  const startTime = Date.now();
  let delayMs = initialDelayMs;

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const result = await fn();
      if (result !== null) {
        const elapsedMs = Date.now() - startTime;
        console.log(`✅ ${context} succeeded after ${elapsedMs}ms`);
        return result;
      }
    } catch (error) {
      console.warn(`${context} error: ${error instanceof Error ? error.message : String(error)}`);
    }

    await new Promise((r) => setTimeout(r, delayMs));
    delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
  }

  const elapsedMs = Date.now() - startTime;
  console.warn(`${context} timeout after ${elapsedMs}ms`);
  return null;
}

/**
 * Validate connection with automatic retry
 * ENHANCEMENT: Used for wallet connections that might be stale or timing out
 */
export async function validateConnection<T>(
  validator: () => Promise<T>,
  options: {
    context: string;
    maxAttempts?: number;
    timeoutMs?: number;
  }
): Promise<T> {
  const { context, maxAttempts = 3, timeoutMs = 5000 } = options;

  let lastError: Error | null = null;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      console.log(`Validating ${context}... (attempt ${i + 1}/${maxAttempts})`);
      const result = await withTimeout(validator(), {
        timeoutMs,
        context,
      });
      console.log(`✅ ${context} validated`);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`${context} validation failed: ${lastError.message}`);

      if (i < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
    }
  }

  throw (
    lastError ||
    new Error(`Failed to validate ${context}`)
  );
}

/**
 * Circuit breaker for repeated failures
 * ENHANCEMENT: Prevents hammering dead endpoints (RPC, attestation API, etc.)
 */
export class CircuitBreaker {
  private failures: Map<string, { count: number; lastFailureTime: number }> =
    new Map();
  private readonly failureThreshold: number;
  private readonly resetTimeMs: number;

  constructor(failureThreshold = 3, resetTimeMs = 60000) {
    this.failureThreshold = failureThreshold;
    this.resetTimeMs = resetTimeMs;
  }

  isOpen(key: string): boolean {
    const state = this.failures.get(key);
    if (!state) return false;

    const timeSinceFailure = Date.now() - state.lastFailureTime;
    if (timeSinceFailure > this.resetTimeMs) {
      this.failures.delete(key);
      return false;
    }

    return state.count >= this.failureThreshold;
  }

  recordSuccess(key: string): void {
    this.failures.delete(key);
  }

  recordFailure(key: string): void {
    const state = this.failures.get(key) || { count: 0, lastFailureTime: 0 };
    state.count++;
    state.lastFailureTime = Date.now();
    this.failures.set(key, state);

    if (state.count === this.failureThreshold) {
      console.warn(
        `⚠️ Circuit breaker opened for: ${key} (${this.failureThreshold} failures)`
      );
    }
  }

  async execute<T>(
    key: string,
    fn: () => Promise<T>
  ): Promise<T> {
    if (this.isOpen(key)) {
      throw new Error(
        `Circuit breaker open for: ${key}. Too many recent failures.`
      );
    }

    try {
      const result = await fn();
      this.recordSuccess(key);
      return result;
    } catch (error) {
      this.recordFailure(key);
      throw error;
    }
  }
}
