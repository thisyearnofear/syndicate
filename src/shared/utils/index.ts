/**
 * SHARED UTILITIES
 * 
 * Core Principles Applied:
 * - DRY: Single source of truth for common utilities
 * - MODULAR: Composable utility functions
 * - PERFORMANT: Optimized implementations
 * - CLEAN: Pure functions with clear interfaces
 */

// =============================================================================
// FORMATTING UTILITIES
// =============================================================================

/**
 * PERFORMANT: Format currency with locale support
 */
export function formatCurrency(
  amount: number | string,
  options: {
    currency?: string;
    locale?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  } = {}
): string {
  const {
    currency = 'USD',
    locale = 'en-US',
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
  } = options;

  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numericAmount)) return '$0';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(numericAmount);
}

/**
 * PERFORMANT: Format large numbers with abbreviations
 */
export function formatNumber(num: number | string): string {
  const numericValue = typeof num === 'string' ? parseFloat(num) : num;

  if (isNaN(numericValue)) return '0';

  if (numericValue >= 1e9) {
    return (numericValue / 1e9).toFixed(1) + 'B';
  }
  if (numericValue >= 1e6) {
    return (numericValue / 1e6).toFixed(1) + 'M';
  }
  if (numericValue >= 1e3) {
    return (numericValue / 1e3).toFixed(1) + 'K';
  }

  return numericValue.toLocaleString();
}

/**
 * PERFORMANT: Format time remaining
 */
export function formatTimeRemaining(endTimestamp: string | number): string {
  const end = typeof endTimestamp === 'string' ? parseInt(endTimestamp) * 1000 : endTimestamp;
  const now = Date.now();
  const diff = end - now;

  if (diff <= 0) return 'Ended';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

/**
 * CLEAN: Validate Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * CLEAN: Validate transaction hash
 */
export function isValidTxHash(hash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

/**
 * CLEAN: Validate positive number
 */
export function isPositiveNumber(value: string | number): boolean {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return !isNaN(num) && num > 0;
}

// =============================================================================
// ASYNC UTILITIES
// =============================================================================

/**
 * PERFORMANT: Debounce function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * PERFORMANT: Throttle function calls
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * PERFORMANT: Retry async operations with exponential backoff
 */
export async function retry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts) {
        throw lastError;
      }

      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// =============================================================================
// OBJECT UTILITIES
// =============================================================================

/**
 * CLEAN: Deep clone object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T;
  if (typeof obj === 'object') {
    const clonedObj = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
  return obj;
}

/**
 * CLEAN: Pick specific properties from object
 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach(key => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
}

/**
 * CLEAN: Omit specific properties from object
 */
export function omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  keys.forEach(key => {
    delete result[key];
  });
  return result;
}

// =============================================================================
// ARRAY UTILITIES
// =============================================================================

/**
 * PERFORMANT: Remove duplicates from array
 */
export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

/**
 * PERFORMANT: Chunk array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// =============================================================================
// ERROR UTILITIES
// =============================================================================

/**
 * CLEAN: Create standardized error
 */
export function createError(
  code: string,
  message: string,
  details?: any
): Error & { code: string; details?: any } {
  const error = new Error(message) as Error & { code: string; details?: any };
  error.code = code;
  if (details) error.details = details;
  return error;
}

/**
 * CLEAN: Safe error message extraction
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unknown error occurred';
}