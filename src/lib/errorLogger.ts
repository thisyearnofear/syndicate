/**
 * Basic Error Logger
 * Temporary error logging solution until proper monitoring is set up
 */

interface ErrorContext {
  [key: string]: any;
  walletType?: string;
  network?: string;
  transactionHash?: string;
  amount?: string;
  protocol?: string;
  userAddress?: string;
  pageUrl?: string;
  component?: string;
}

export class ErrorLogger {
  private static instance: ErrorLogger;
  private errorQueue: Array<{ error: Error; context: ErrorContext }> = [];
  private isSending = false;

  private constructor() {
    // Private constructor for singleton pattern
    this.setupErrorHandling();
  }

  public static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  private setupErrorHandling(): void {
    // Capture uncaught exceptions
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.logError(new Error(event.message), {
          component: 'Global',
          pageUrl: window.location.href,
        });
      });

      // Capture unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        this.logError(new Error(String(event.reason)), {
          component: 'Promise',
          pageUrl: window.location.href,
        });
      });
    }
  }

  /**
   * Log an error with context
   * @param error The error to log
   * @param context Additional context about the error
   */
  public logError(error: Error, context: ErrorContext = {}): void {
    try {
      // Add basic context if not provided
      const enhancedContext = this.enhanceContext(context);

      // Log to console
      this.logToConsole(error, enhancedContext);

      // Add to queue for potential backend logging
      this.errorQueue.push({ error, context: enhancedContext });

      // Send to backend if available
      this.sendToBackendIfAvailable();

    } catch (loggingError) {
      // Fallback to basic console error if logging fails
      console.error('Failed to log error:', loggingError);
      console.error('Original error:', error);
    }
  }

  private enhanceContext(context: ErrorContext): ErrorContext {
    const timestamp = new Date().toISOString();
    const userAgent = typeof window !== 'undefined' ? navigator.userAgent : 'server';
    const currentUrl = typeof window !== 'undefined' ? window.location.href : 'unknown';

    return {
      timestamp,
      userAgent,
      pageUrl: context.pageUrl || currentUrl,
      ...context,
    };
  }

  private logToConsole(error: Error, context: ErrorContext): void {
    console.groupCollapsed('🚨 ERROR:', error.message);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.log('Context:', context);
    console.groupEnd();

    // Also log to error channel if available
    if (typeof window !== 'undefined' && window.console.error) {
      window.console.error(`[ERROR] ${error.message}`, {
        stack: error.stack,
        context,
      });
    }
  }

  private async sendToBackendIfAvailable(): Promise<void> {
    if (this.isSending) return;

    // Only send if we have errors and we're in production
    if (this.errorQueue.length === 0 || process.env.NODE_ENV !== 'production') {
      return;
    }

    try {
      this.isSending = true;

      // Get the oldest error first
      const errorToSend = this.errorQueue.shift();
      
      if (!errorToSend) return;

      const response = await fetch('/api/log-error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: {
            message: errorToSend.error.message,
            stack: errorToSend.error.stack,
          },
          context: errorToSend.context,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        console.warn('Failed to send error to backend:', response.status);
      }

    } catch (sendError) {
      console.error('Failed to send error to backend:', sendError);
    } finally {
      this.isSending = false;
      
      // Try to send remaining errors if any
      if (this.errorQueue.length > 0) {
        setTimeout(() => this.sendToBackendIfAvailable(), 1000);
      }
    }
  }

  /**
   * Get all logged errors (for debugging)
   */
  public getErrorQueue(): Array<{ error: Error; context: ErrorContext }> {
    return [...this.errorQueue];
  }

  /**
   * Clear the error queue
   */
  public clearErrorQueue(): void {
    this.errorQueue = [];
  }

  /**
   * Create a scoped error logger for a specific component/module
   * @param componentName The name of the component/module
   */
  public createScopedLogger(componentName: string): ErrorLogger {
    // In this basic implementation, we just add the component name to context
    // A more advanced version could create separate instances
    const scopedLogger = new ErrorLogger();
    
    // Override the logError method to automatically add component context
    const originalLogError = scopedLogger.logError.bind(scopedLogger);
    scopedLogger.logError = (error: Error, context: ErrorContext = {}) => {
      originalLogError(error, { ...context, component: componentName });
    };

    return scopedLogger;
  }
}

// Export singleton instance
export const errorLogger = ErrorLogger.getInstance();

// Convenience function for direct imports
export function logError(error: Error, context: ErrorContext = {}): void {
  errorLogger.logError(error, context);
}