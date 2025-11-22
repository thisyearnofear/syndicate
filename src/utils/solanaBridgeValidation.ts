/**
 * SOLANA BRIDGE VALIDATION UTILITIES
 * 
 * Helper functions to validate bridge setup and provide user guidance
 */

import { PublicKey } from '@solana/web3.js';

export interface BridgeValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
}

/**
 * Validate that user has proper wallet setup for Solana → Base bridge
 */
export function validateBridgeSetup(
    solanaAddress: string | null,
    evmAddress: string | null,
    amount: string,
    solanaBalance: string,
    solBalance: string
): BridgeValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check Solana wallet
    if (!solanaAddress) {
        errors.push('Solana wallet not connected. Please connect Phantom wallet.');
    } else {
        try {
            new PublicKey(solanaAddress);
        } catch {
            errors.push('Invalid Solana wallet address format.');
        }
    }

    // Check EVM recipient address
    if (!evmAddress) {
        errors.push('Base wallet address required as recipient.');
        suggestions.push('Connect your MetaMask or Base wallet to get your EVM address.');
    } else if (!isValidEvmAddress(evmAddress)) {
        errors.push('Invalid recipient address. Must be a valid EVM address (0x... format, 42 characters).');
        suggestions.push('Example: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb');
    } else if (evmAddress.toLowerCase() === solanaAddress?.toLowerCase()) {
        errors.push('Recipient address appears to be a Solana address, not an EVM address.');
        suggestions.push('You need TWO different wallets: Phantom (Solana) as source, MetaMask/Base wallet as destination.');
    }

    // Check amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
        errors.push('Invalid bridge amount. Must be greater than 0.');
    } else if (amountNum < 1) {
        warnings.push('Bridging less than 1 USDC. Consider bridging at least 1 USDC to make gas fees worthwhile.');
    }

    // Check Solana USDC balance
    const solanaBalanceNum = parseFloat(solanaBalance);
    if (isNaN(solanaBalanceNum)) {
        warnings.push('Unable to verify Solana USDC balance.');
    } else if (solanaBalanceNum < amountNum) {
        errors.push(`Insufficient USDC on Solana. Have: ${solanaBalanceNum} USDC, Need: ${amountNum} USDC`);
    } else if (solanaBalanceNum < amountNum + 0.1) {
        warnings.push('USDC balance is very close to bridge amount. Consider leaving a small buffer.');
    }

    // Check SOL balance for gas
    const solBalanceNum = parseFloat(solBalance);
    if (isNaN(solBalanceNum)) {
        warnings.push('Unable to verify SOL balance for gas fees.');
    } else if (solBalanceNum < 0.001) {
        errors.push('Insufficient SOL for gas fees. Need at least 0.001 SOL.');
        suggestions.push('Get SOL from an exchange or faucet to pay for transaction fees.');
    } else if (solBalanceNum < 0.01) {
        warnings.push('Low SOL balance. Recommended to have at least 0.01 SOL for gas fees.');
    }

    // Add general suggestions
    if (errors.length === 0) {
        suggestions.push('✅ All validations passed! You can proceed with the bridge.');
        suggestions.push('⏱️ CCTP bridge takes 15-20 minutes. Please be patient.');
        suggestions.push('💡 You can close the modal during bridging - we\'ll notify you when complete.');
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions
    };
}

/**
 * Check if address is a valid EVM address
 */
export function isValidEvmAddress(address: string): boolean {
    if (!address) return false;
    if (!address.startsWith('0x')) return false;
    if (address.length !== 42) return false;
    // Check if it's valid hex
    return /^0x[0-9a-fA-F]{40}$/.test(address);
}

/**
 * Check if address looks like a Solana address (base58)
 */
export function isSolanaAddress(address: string): boolean {
    if (!address) return false;
    // Solana addresses are base58 encoded, typically 32-44 characters
    if (address.length < 32 || address.length > 44) return false;
    // Check for base58 characters only (no 0, O, I, l)
    return /^[1-9A-HJ-NP-Za-km-z]+$/.test(address);
}

/**
 * Get user-friendly error message for common bridge errors
 */
export function getBridgeErrorMessage(error: string): {
    title: string;
    message: string;
    action?: string;
    actionLink?: string;
} {
    const errorLower = error.toLowerCase();

    if (errorLower.includes('phantom wallet not found')) {
        return {
            title: 'Phantom Wallet Not Found',
            message: 'Please install the Phantom browser extension to bridge from Solana.',
            action: 'Install Phantom',
            actionLink: 'https://phantom.app/'
        };
    }

    if (errorLower.includes('insufficient usdc balance')) {
        return {
            title: 'Insufficient USDC',
            message: 'You don\'t have enough USDC on Solana to complete this bridge.',
            action: 'Get USDC',
            actionLink: 'https://phantom.app/learn/guides/how-to-get-usdc'
        };
    }

    if (errorLower.includes('insufficient sol')) {
        return {
            title: 'Insufficient SOL for Gas',
            message: 'You need SOL to pay for transaction fees on Solana.',
            action: 'Get SOL',
            actionLink: 'https://phantom.app/learn/guides/how-to-get-sol'
        };
    }

    if (errorLower.includes('user rejected') || errorLower.includes('user denied')) {
        return {
            title: 'Transaction Rejected',
            message: 'You rejected the transaction in Phantom wallet. Please try again and approve the transaction.',
            action: 'Retry Bridge'
        };
    }

    if (errorLower.includes('failed to fetch attestation')) {
        return {
            title: 'Attestation Timeout',
            message: 'Circle\'s attestation service is taking longer than expected. Your funds are safe - the transaction may still complete.',
            action: 'Check Transaction',
            actionLink: 'https://explorer.solana.com/'
        };
    }

    if (errorLower.includes('recipient must be')) {
        return {
            title: 'Invalid Recipient Address',
            message: 'The recipient must be a valid Base/EVM wallet address (0x...), not a Solana address.',
            action: 'Learn More'
        };
    }

    if (errorLower.includes('transaction failed')) {
        return {
            title: 'Transaction Failed',
            message: 'The transaction failed on Solana. This could be due to network issues or incorrect parameters.',
            action: 'View on Explorer',
            actionLink: 'https://explorer.solana.com/'
        };
    }

    if (errorLower.includes('confirmation timeout')) {
        return {
            title: 'Confirmation Timeout',
            message: 'Transaction is taking longer than expected to confirm. Check Solana Explorer for status.',
            action: 'Check Status',
            actionLink: 'https://explorer.solana.com/'
        };
    }

    // Default error
    return {
        title: 'Bridge Error',
        message: error || 'An unexpected error occurred during bridging.',
        action: 'Try Again'
    };
}

/**
 * Format Solana transaction link
 */
export function getSolanaExplorerLink(signature: string, cluster: 'mainnet-beta' | 'devnet' | 'testnet' = 'mainnet-beta'): string {
    return `https://explorer.solana.com/tx/${signature}${cluster !== 'mainnet-beta' ? `?cluster=${cluster}` : ''}`;
}

/**
 * Format Base transaction link
 */
export function getBaseExplorerLink(txHash: string): string {
    return `https://basescan.org/tx/${txHash}`;
}

/**
 * Estimate bridge time based on protocol
 */
export function estimateBridgeTime(protocol: 'cctp' | 'wormhole'): {
    min: number; // minutes
    max: number; // minutes
    description: string;
} {
    if (protocol === 'cctp') {
        return {
            min: 15,
            max: 20,
            description: 'Circle CCTP provides native USDC on Base but takes longer due to attestation requirements.'
        };
    } else {
        return {
            min: 5,
            max: 10,
            description: 'Wormhole is faster but may require an additional swap to native USDC on Base.'
        };
    }
}
