/**
 * NETWORK RESILIENCE UTILITIES
 * 
 * Provides retry logic, timeout handling, and error recovery for network operations.
 * Used across the application to handle network failures gracefully.
 */

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number; // ms
  maxDelay: number; // ms
  retryableErrors?: string[];
}

export interface TimeoutOptions {
  timeout: number; // ms
  abortSignal?: AbortSignal;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  retryableErrors: [
    'NETWORK_ERROR',
    'TIMEOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENETUNREACH',
    'EAI_AGAIN',
  ],
};

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number
): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 30% jitter
  const delay = exponentialDelay + jitter;
  return Math.min(delay, maxDelay);
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown, retryableErrors: string[]): boolean {
  if (error instanceof Error) {
    const message = error.message.toUpperCase();
    const name = error.name.toUpperCase();
    
    // Check for retryable error messages
    for (const retryable of retryableErrors) {
      if (message.includes(retryable) || name.includes(retryable)) {
        return true;
      }
    }
    
    // Check for fetch-specific errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return true;
    }
  }
  
  return false;
}

/**
 * Execute an async function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // If this was the last attempt, throw
      if (attempt > config.maxRetries) {
        break;
      }
      
      // Check if error is retryable
      if (!isRetryableError(error, config.retryableErrors || DEFAULT_RETRY_OPTIONS.retryableErrors!)) {
        throw error;
      }
      
      // Calculate and wait for backoff
      const delay = calculateBackoffDelay(attempt, config.baseDelay, config.maxDelay);
      console.log(`[withRetry] Attempt ${attempt}/${config.maxRetries + 1} failed, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * Execute an async function with timeout
 */
export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  options: TimeoutOptions
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout);
  
  // Combine with external abort signal if provided
  if (options.abortSignal) {
    options.abortSignal.addEventListener('abort', () => controller.abort());
  }
  
  try {
    return await fn(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Operation timed out after ${options.timeout}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Execute an async function with both retry and timeout
 */
export async function withResilience<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  retryOptions: Partial<RetryOptions> = {},
  timeoutMs: number = 30000
): Promise<T> {
  return withRetry(
    () => withTimeout(
      (signal) => fn(signal),
      { timeout: timeoutMs }
    ),
    retryOptions
  );
}

/**
 * Wrap a fetch call with retry and timeout
 */
export async function resilientFetch(
  url: string,
  options: RequestInit = {},
  retryOptions: Partial<RetryOptions> = {},
  timeoutMs: number = 30000
): Promise<Response> {
  return withResilience(
    async (signal) => {
      const response = await fetch(url, {
        ...options,
        signal,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    },
    retryOptions,
    timeoutMs
  );
}

/**
 * Safe JSON parse with error handling
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Safe async operation with error logging
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  errorMessage: string,
  defaultValue: T
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[safeAsync] ${errorMessage}:`, error);
    return defaultValue;
  }
}

/**
 * Create a debounced version of an async function
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingPromise: Promise<ReturnType<T>> | null = null;
  
  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    if (!pendingPromise) {
      pendingPromise = new Promise((resolve, reject) => {
        timeoutId = setTimeout(async () => {
          try {
            const result = await fn(...args);
            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            timeoutId = null;
            pendingPromise = null;
          }
        }, delay);
      });
    }
    
    return pendingPromise;
  };
}

/**
 * Rate limiter for API calls
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  
  constructor(
    private maxTokens: number,
    private refillRate: number // tokens per second
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }
  
  async acquire(): Promise<void> {
    this.refill();
    
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    
    // Wait for next token
    const waitTime = (1 / this.refillRate) * 1000;
    await sleep(waitTime);
    this.tokens -= 1;
  }
  
  private refill(): Promise<void> {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const newTokens = elapsed * this.refillRate;
    
    this.tokens = Math.min(this.tokens + newTokens, this.maxTokens);
    this.lastRefill = now;
    
    return Promise.resolve();
  }
}

/**
 * Circuit breaker for failing services
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private failureThreshold: number = 5,
    private resetTimeout: number = 60000 // 1 minute
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }
  
  getState(): string {
    return this.state;
  }
}
