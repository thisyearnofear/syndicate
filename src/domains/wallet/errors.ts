/**
 * WALLET ERROR HANDLING
 * 
 * DRY: Centralized error definitions and recovery strategies
 * CLEAN: Clear error codes and user-friendly messages
 * MODULAR: Composable error handling across wallet services
 */

// =============================================================================
// ERROR CODES & MESSAGES
// =============================================================================

/**
 * Standardized error codes for wallet operations
 * Use these in error handling and recovery logic
 */
export const WalletErrorCodes = {
  // Connection errors
  WALLET_NOT_FOUND: 'WALLET_NOT_FOUND',
  WALLET_NOT_INSTALLED: 'WALLET_NOT_INSTALLED',
  WALLET_NOT_CONNECTED: 'WALLET_NOT_CONNECTED',
  CONNECTION_REJECTED: 'CONNECTION_REJECTED',
  CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
  CONNECTION_FAILED: 'CONNECTION_FAILED',

  // Wallet state errors
  WALLET_ALREADY_CONNECTED: 'WALLET_ALREADY_CONNECTED',
  WALLET_INITIALIZATION_FAILED: 'WALLET_INITIALIZATION_FAILED',

  // Chain/Network errors
  INVALID_CHAIN_ID: 'INVALID_CHAIN_ID',
  BRIDGE_REQUIRED: 'BRIDGE_REQUIRED',
  CHAIN_SWITCHING_NOT_SUPPORTED: 'CHAIN_SWITCHING_NOT_SUPPORTED',

  // Environment errors
  ENV_ERROR: 'ENV_ERROR',
  NOT_IN_BROWSER: 'NOT_IN_BROWSER',

  // User action errors
  ACTION_CANCELLED: 'ACTION_CANCELLED',
  ACTION_REJECTED: 'ACTION_REJECTED',

  // Generic errors
  UNSUPPORTED_WALLET: 'UNSUPPORTED_WALLET',
  UNSUPPORTED_OPERATION: 'UNSUPPORTED_OPERATION',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type WalletErrorCode = typeof WalletErrorCodes[keyof typeof WalletErrorCodes];

/**
 * User-friendly error messages
 */
export const ErrorMessages: Record<WalletErrorCode, string> = {
  WALLET_NOT_FOUND: 'Wallet not found. Please make sure it is installed.',
  WALLET_NOT_INSTALLED: 'This wallet is not installed. Please install it first.',
  WALLET_NOT_CONNECTED: 'No wallet is currently connected.',
  CONNECTION_REJECTED: 'Connection was rejected. Please try again.',
  CONNECTION_TIMEOUT: 'Connection timed out. Please try again.',
  CONNECTION_FAILED: 'Failed to connect wallet. Please try again.',
  WALLET_ALREADY_CONNECTED: 'A wallet is already connected.',
  WALLET_INITIALIZATION_FAILED: 'Failed to initialize wallet. Please refresh and try again.',
  INVALID_CHAIN_ID: 'Invalid chain ID provided.',
  BRIDGE_REQUIRED: 'This wallet requires using the cross-chain bridge.',
  CHAIN_SWITCHING_NOT_SUPPORTED: 'Chain switching is not supported for this wallet.',
  ENV_ERROR: 'This operation is only available in a browser environment.',
  NOT_IN_BROWSER: 'Wallet operations require a browser environment.',
  ACTION_CANCELLED: 'Action was cancelled.',
  ACTION_REJECTED: 'Action was rejected.',
  UNSUPPORTED_WALLET: 'This wallet type is not supported.',
  UNSUPPORTED_OPERATION: 'This operation is not supported for this wallet.',
  UNKNOWN_ERROR: 'An unknown error occurred. Please try again.',
};

// =============================================================================
// WALLET ERROR CLASS
// =============================================================================

/**
 * CLEAN: Typed wallet error with recovery suggestions
 */
export class WalletError extends Error {
  readonly code: WalletErrorCode;
  readonly downloadUrl?: string;
  readonly troubleshooting?: string;
  readonly recoveryAction?: () => void;

  constructor(
    code: WalletErrorCode,
    message?: string,
    details?: {
      downloadUrl?: string;
      troubleshooting?: string;
      recoveryAction?: () => void;
    }
  ) {
    super(message || ErrorMessages[code]);
    this.code = code;
    this.downloadUrl = details?.downloadUrl;
    this.troubleshooting = details?.troubleshooting;
    this.recoveryAction = details?.recoveryAction;
    Object.setPrototypeOf(this, WalletError.prototype);
  }
}

// =============================================================================
// ERROR DETECTION UTILITIES
// =============================================================================

/**
 * Detect if an error represents user rejection
 */
export function isUserRejection(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('rejected') ||
    message.includes('cancelled') ||
    message.includes('Rejected') ||
    message.includes('Cancelled') ||
    message.includes('4001') // MetaMask user rejection code
  );
}

/**
 * Detect if an error is a timeout
 */
export function isTimeoutError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('Timeout')
  );
}

/**
 * Detect if an error indicates wallet not installed
 */
export function isNotInstalledError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('not installed') ||
    message.includes('not found') ||
    message.includes('No matching provider') ||
    message.includes('window.ethereum is undefined')
  );
}

// =============================================================================
// ERROR RECOVERY STRATEGIES
// =============================================================================

/**
 * Suggest recovery action based on error code
 */
export function getSuggestedRecovery(code: WalletErrorCode): string {
  switch (code) {
    case 'WALLET_NOT_INSTALLED':
      return 'Please install the wallet extension and refresh this page.';
    case 'WALLET_NOT_FOUND':
      return 'Please make sure the wallet is installed and the page is refreshed.';
    case 'CONNECTION_REJECTED':
      return 'Please approve the connection request in your wallet.';
    case 'CONNECTION_TIMEOUT':
      return 'Please try connecting again. If the problem persists, restart your wallet.';
    case 'WALLET_INITIALIZATION_FAILED':
      return 'Please refresh this page and try again.';
    case 'BRIDGE_REQUIRED':
      return 'Use the cross-chain bridge to transfer funds to Base before purchasing.';
    default:
      return 'Please try again.';
  }
}

/**
 * Normalize error to WalletError
 */
export function normalizeWalletError(error: unknown): WalletError {
  // Already a WalletError
  if (error instanceof WalletError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);

  // Detect specific error types
  if (isUserRejection(error)) {
    return new WalletError('CONNECTION_REJECTED', message);
  }

  if (isTimeoutError(error)) {
    return new WalletError('CONNECTION_TIMEOUT', message);
  }

  if (isNotInstalledError(error)) {
    return new WalletError('WALLET_NOT_INSTALLED', message);
  }

  // Generic error
  return new WalletError('UNKNOWN_ERROR', message);
}
