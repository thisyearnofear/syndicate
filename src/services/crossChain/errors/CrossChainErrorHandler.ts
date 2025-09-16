/**
 * Cross-Chain Error Handler
 * 
 * Provides comprehensive error handling, recovery mechanisms, and user-friendly
 * error messages for cross-chain operations with clear separation of concerns.
 */

import { 
  type CrossChainIntent,
  type IntentStatus,
  SUPPORTED_CHAINS,
} from '../types';

// Error categories for better handling
export enum ErrorCategory {
  NETWORK = 'network',
  VALIDATION = 'validation',
  SIGNATURE = 'signature',
  TRANSACTION = 'transaction',
  RELAYER = 'relayer',
  TIMEOUT = 'timeout',
  INSUFFICIENT_FUNDS = 'insufficient_funds',
  CONTRACT = 'contract',
  UNKNOWN = 'unknown',
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',       // Warnings, non-blocking issues
  MEDIUM = 'medium', // Recoverable errors
  HIGH = 'high',     // Critical errors requiring user action
  CRITICAL = 'critical', // System failures
}

// Recovery strategies
export enum RecoveryStrategy {
  RETRY = 'retry',
  FALLBACK = 'fallback',
  USER_ACTION = 'user_action',
  ABORT = 'abort',
  IGNORE = 'ignore',
}

export interface CrossChainError {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  code: string;
  details?: Record<string, any>;
  timestamp: number;
  intentId?: string;
  chainId?: string;
  txHash?: string;
  recoveryStrategy: RecoveryStrategy;
  retryCount: number;
  maxRetries: number;
  originalError?: Error;
}

export interface ErrorRecoveryResult {
  success: boolean;
  newError?: CrossChainError;
  shouldRetry: boolean;
  userAction?: string;
}

/**
 * Cross-Chain Error Handler
 */
export class CrossChainErrorHandler {
  private errorHistory = new Map<string, CrossChainError[]>();
  private recoveryHandlers = new Map<ErrorCategory, (error: CrossChainError) => Promise<ErrorRecoveryResult>>();
  private errorMetrics = {
    totalErrors: 0,
    errorsByCategory: new Map<ErrorCategory, number>(),
    errorsBySeverity: new Map<ErrorSeverity, number>(),
    recoverySuccessRate: 0,
  };

  constructor() {
    this.initializeRecoveryHandlers();
  }

  /**
   * Handle and categorize error
   */
  async handleError(
    error: Error | string,
    context: {
      intentId?: string;
      chainId?: string;
      txHash?: string;
      operation?: string;
    } = {}
  ): Promise<CrossChainError> {
    const crossChainError = this.categorizeError(error, context);
    
    // Store error in history
    this.addToHistory(crossChainError);
    
    // Update metrics
    this.updateMetrics(crossChainError);
    
    // Attempt recovery if strategy allows
    if (crossChainError.recoveryStrategy !== RecoveryStrategy.ABORT) {
      const recoveryResult = await this.attemptRecovery(crossChainError);
      
      if (recoveryResult.success) {
        crossChainError.message += ' (Recovered)';
        crossChainError.severity = ErrorSeverity.LOW;
      } else if (recoveryResult.newError) {
        return recoveryResult.newError;
      }
    }
    
    return crossChainError;
  }

  /**
   * Categorize error based on type and context
   */
  private categorizeError(
    error: Error | string,
    context: {
      intentId?: string;
      chainId?: string;
      txHash?: string;
      operation?: string;
    }
  ): CrossChainError {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorId = this.generateErrorId();
    
    // Analyze error message for categorization
    const category = this.determineErrorCategory(errorMessage, context);
    const severity = this.determineErrorSeverity(category, errorMessage);
    const recoveryStrategy = this.determineRecoveryStrategy(category, severity);
    
    return {
      id: errorId,
      category,
      severity,
      message: errorMessage,
      userMessage: this.generateUserMessage(category, errorMessage),
      code: this.generateErrorCode(category, errorMessage),
      details: this.extractErrorDetails(errorMessage, context),
      timestamp: Date.now(),
      intentId: context.intentId,
      chainId: context.chainId,
      txHash: context.txHash,
      recoveryStrategy,
      retryCount: 0,
      maxRetries: this.getMaxRetries(category),
      originalError: typeof error === 'object' ? error : undefined,
    };
  }

  /**
   * Determine error category from message and context
   */
  private determineErrorCategory(message: string, context: any): ErrorCategory {
    const lowerMessage = message.toLowerCase();
    
    // Network-related errors
    if (lowerMessage.includes('network') || 
        lowerMessage.includes('connection') ||
        lowerMessage.includes('timeout') ||
        lowerMessage.includes('fetch')) {
      return ErrorCategory.NETWORK;
    }
    
    // Validation errors
    if (lowerMessage.includes('invalid') ||
        lowerMessage.includes('validation') ||
        lowerMessage.includes('required') ||
        lowerMessage.includes('format')) {
      return ErrorCategory.VALIDATION;
    }
    
    // Signature errors
    if (lowerMessage.includes('signature') ||
        lowerMessage.includes('sign') ||
        lowerMessage.includes('mpc') ||
        lowerMessage.includes('derivation')) {
      return ErrorCategory.SIGNATURE;
    }
    
    // Transaction errors
    if (lowerMessage.includes('transaction') ||
        lowerMessage.includes('gas') ||
        lowerMessage.includes('nonce') ||
        lowerMessage.includes('revert')) {
      return ErrorCategory.TRANSACTION;
    }
    
    // Relayer errors
    if (lowerMessage.includes('relayer') ||
        lowerMessage.includes('relay')) {
      return ErrorCategory.RELAYER;
    }
    
    // Insufficient funds
    if (lowerMessage.includes('insufficient') ||
        lowerMessage.includes('balance') ||
        lowerMessage.includes('funds')) {
      return ErrorCategory.INSUFFICIENT_FUNDS;
    }
    
    // Contract errors
    if (lowerMessage.includes('contract') ||
        lowerMessage.includes('abi') ||
        lowerMessage.includes('function')) {
      return ErrorCategory.CONTRACT;
    }
    
    // Timeout errors
    if (lowerMessage.includes('timeout') ||
        lowerMessage.includes('expired')) {
      return ErrorCategory.TIMEOUT;
    }
    
    return ErrorCategory.UNKNOWN;
  }

  /**
   * Determine error severity
   */
  private determineErrorSeverity(category: ErrorCategory, message: string): ErrorSeverity {
    switch (category) {
      case ErrorCategory.VALIDATION:
        return ErrorSeverity.MEDIUM;
      
      case ErrorCategory.NETWORK:
      case ErrorCategory.TIMEOUT:
        return ErrorSeverity.MEDIUM;
      
      case ErrorCategory.INSUFFICIENT_FUNDS:
        return ErrorSeverity.HIGH;
      
      case ErrorCategory.SIGNATURE:
      case ErrorCategory.CONTRACT:
        return ErrorSeverity.HIGH;
      
      case ErrorCategory.TRANSACTION:
        return message.toLowerCase().includes('revert') ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM;
      
      case ErrorCategory.RELAYER:
        return ErrorSeverity.MEDIUM;
      
      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  /**
   * Determine recovery strategy
   */
  private determineRecoveryStrategy(category: ErrorCategory, severity: ErrorSeverity): RecoveryStrategy {
    switch (category) {
      case ErrorCategory.NETWORK:
      case ErrorCategory.TIMEOUT:
        return RecoveryStrategy.RETRY;
      
      case ErrorCategory.RELAYER:
        return RecoveryStrategy.FALLBACK;
      
      case ErrorCategory.VALIDATION:
        return RecoveryStrategy.USER_ACTION;
      
      case ErrorCategory.INSUFFICIENT_FUNDS:
        return RecoveryStrategy.USER_ACTION;
      
      case ErrorCategory.SIGNATURE:
        return severity === ErrorSeverity.HIGH ? RecoveryStrategy.ABORT : RecoveryStrategy.RETRY;
      
      case ErrorCategory.TRANSACTION:
        return RecoveryStrategy.RETRY;
      
      default:
        return RecoveryStrategy.RETRY;
    }
  }

  /**
   * Generate user-friendly error message
   */
  private generateUserMessage(category: ErrorCategory, message: string): string {
    switch (category) {
      case ErrorCategory.NETWORK:
        return 'Network connection issue. Please check your internet connection and try again.';
      
      case ErrorCategory.VALIDATION:
        return 'Invalid input detected. Please check your transaction details and try again.';
      
      case ErrorCategory.SIGNATURE:
        return 'Signature process failed. Please try signing the transaction again.';
      
      case ErrorCategory.TRANSACTION:
        return 'Transaction failed on the blockchain. This may be due to network congestion or insufficient gas.';
      
      case ErrorCategory.RELAYER:
        return 'Gas relayer service is temporarily unavailable. Trying alternative methods.';
      
      case ErrorCategory.INSUFFICIENT_FUNDS:
        return 'Insufficient funds to complete the transaction. Please add more funds to your wallet.';
      
      case ErrorCategory.CONTRACT:
        return 'Smart contract interaction failed. The contract may be temporarily unavailable.';
      
      case ErrorCategory.TIMEOUT:
        return 'Operation timed out. Please try again.';
      
      default:
        return 'An unexpected error occurred. Please try again or contact support if the issue persists.';
    }
  }

  /**
   * Generate error code
   */
  private generateErrorCode(category: ErrorCategory, message: string): string {
    const categoryCode = category.toUpperCase().substring(0, 3);
    const hash = this.simpleHash(message);
    return `CC_${categoryCode}_${hash}`;
  }

  /**
   * Extract error details
   */
  private extractErrorDetails(message: string, context: any): Record<string, any> {
    const details: Record<string, any> = { ...context };
    
    // Extract common patterns
    const gasMatch = message.match(/gas (\w+)/i);
    if (gasMatch) {
      details.gasIssue = gasMatch[1];
    }
    
    const nonceMatch = message.match(/nonce (\d+)/i);
    if (nonceMatch) {
      details.nonce = nonceMatch[1];
    }
    
    const addressMatch = message.match(/(0x[a-fA-F0-9]{40})/);
    if (addressMatch) {
      details.address = addressMatch[1];
    }
    
    return details;
  }

  /**
   * Get max retries for error category
   */
  private getMaxRetries(category: ErrorCategory): number {
    switch (category) {
      case ErrorCategory.NETWORK:
      case ErrorCategory.TIMEOUT:
        return 3;
      
      case ErrorCategory.TRANSACTION:
      case ErrorCategory.RELAYER:
        return 2;
      
      case ErrorCategory.SIGNATURE:
        return 1;
      
      default:
        return 1;
    }
  }

  /**
   * Initialize recovery handlers
   */
  private initializeRecoveryHandlers(): void {
    this.recoveryHandlers.set(ErrorCategory.NETWORK, this.handleNetworkError.bind(this));
    this.recoveryHandlers.set(ErrorCategory.TIMEOUT, this.handleTimeoutError.bind(this));
    this.recoveryHandlers.set(ErrorCategory.RELAYER, this.handleRelayerError.bind(this));
    this.recoveryHandlers.set(ErrorCategory.TRANSACTION, this.handleTransactionError.bind(this));
    this.recoveryHandlers.set(ErrorCategory.SIGNATURE, this.handleSignatureError.bind(this));
  }

  /**
   * Attempt error recovery
   */
  private async attemptRecovery(error: CrossChainError): Promise<ErrorRecoveryResult> {
    const handler = this.recoveryHandlers.get(error.category);
    
    if (!handler || error.retryCount >= error.maxRetries) {
      return {
        success: false,
        shouldRetry: false,
      };
    }
    
    error.retryCount++;
    
    try {
      return await handler(error);
    } catch (recoveryError) {
      return {
        success: false,
        shouldRetry: false,
        newError: await this.handleError(recoveryError as Error, {
          intentId: error.intentId,
          chainId: error.chainId,
        }),
      };
    }
  }

  /**
   * Handle network errors
   */
  private async handleNetworkError(error: CrossChainError): Promise<ErrorRecoveryResult> {
    // Wait with exponential backoff
    const delay = Math.min(1000 * Math.pow(2, error.retryCount - 1), 10000);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return {
      success: true,
      shouldRetry: true,
    };
  }

  /**
   * Handle timeout errors
   */
  private async handleTimeoutError(error: CrossChainError): Promise<ErrorRecoveryResult> {
    // Increase timeout for next attempt
    return {
      success: false,
      shouldRetry: true,
      userAction: 'Increasing timeout and retrying...',
    };
  }

  /**
   * Handle relayer errors
   */
  private async handleRelayerError(error: CrossChainError): Promise<ErrorRecoveryResult> {
    // Try direct transaction without relayer
    return {
      success: false,
      shouldRetry: true,
      userAction: 'Trying direct transaction without gas relayer...',
    };
  }

  /**
   * Handle transaction errors
   */
  private async handleTransactionError(error: CrossChainError): Promise<ErrorRecoveryResult> {
    // Suggest gas price adjustment
    if (error.message.toLowerCase().includes('gas')) {
      return {
        success: false,
        shouldRetry: true,
        userAction: 'Adjusting gas price and retrying...',
      };
    }
    
    return {
      success: false,
      shouldRetry: false,
    };
  }

  /**
   * Handle signature errors
   */
  private async handleSignatureError(error: CrossChainError): Promise<ErrorRecoveryResult> {
    // Signature errors usually require user intervention
    return {
      success: false,
      shouldRetry: false,
      userAction: 'Please try signing the transaction again.',
    };
  }

  /**
   * Add error to history
   */
  private addToHistory(error: CrossChainError): void {
    const key = error.intentId || 'global';
    
    if (!this.errorHistory.has(key)) {
      this.errorHistory.set(key, []);
    }
    
    const history = this.errorHistory.get(key)!;
    history.push(error);
    
    // Keep only last 10 errors per intent
    if (history.length > 10) {
      history.shift();
    }
  }

  /**
   * Update error metrics
   */
  private updateMetrics(error: CrossChainError): void {
    this.errorMetrics.totalErrors++;
    
    const categoryCount = this.errorMetrics.errorsByCategory.get(error.category) || 0;
    this.errorMetrics.errorsByCategory.set(error.category, categoryCount + 1);
    
    const severityCount = this.errorMetrics.errorsBySeverity.get(error.severity) || 0;
    this.errorMetrics.errorsBySeverity.set(error.severity, severityCount + 1);
  }

  /**
   * Get error history for intent
   */
  getErrorHistory(intentId?: string): CrossChainError[] {
    const key = intentId || 'global';
    return this.errorHistory.get(key) || [];
  }

  /**
   * Get error metrics
   */
  getErrorMetrics(): typeof this.errorMetrics {
    return { ...this.errorMetrics };
  }

  /**
   * Clear error history
   */
  clearHistory(intentId?: string): void {
    if (intentId) {
      this.errorHistory.delete(intentId);
    } else {
      this.errorHistory.clear();
    }
  }

  /**
   * Check if error is recoverable
   */
  isRecoverable(error: CrossChainError): boolean {
    return error.recoveryStrategy !== RecoveryStrategy.ABORT &&
           error.retryCount < error.maxRetries;
  }

  /**
   * Generate simple hash for error codes
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 4).toUpperCase();
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `err_${timestamp}_${random}`;
  }
}

// Singleton instance
let errorHandlerInstance: CrossChainErrorHandler | null = null;

/**
 * Get singleton error handler instance
 */
export function getCrossChainErrorHandler(): CrossChainErrorHandler {
  if (!errorHandlerInstance) {
    errorHandlerInstance = new CrossChainErrorHandler();
  }
  return errorHandlerInstance;
}

/**
 * Utility function to handle errors with context
 */
export async function handleCrossChainError(
  error: Error | string,
  context: {
    intentId?: string;
    chainId?: string;
    txHash?: string;
    operation?: string;
  } = {}
): Promise<CrossChainError> {
  const handler = getCrossChainErrorHandler();
  return handler.handleError(error, context);
}