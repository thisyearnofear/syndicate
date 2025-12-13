/**
 * Type declarations for Stacks ecosystem wallets
 * These provide TypeScript support for Stacks wallet providers
 */

// Leather Wallet
declare global {
    interface Window {
        LeatherProvider?: {
            request: (method: string, params?: unknown) => Promise<unknown>;
            disconnect?: () => Promise<void>;
            signTransaction?: (transaction: string) => Promise<{ signature: string }>;
        };
    }
}

// Xverse Wallet (uses Sats Connect standard .request() API)
declare global {
    interface Window {
        XverseProviders?: {
            request: (method: string, params?: unknown) => Promise<unknown>;
            StacksProvider?: unknown;
        };
    }
}

// Asigna Wallet (uses Sats Connect standard .request() API)
declare global {
    interface Window {
        AsignaProvider?: {
            request: (method: string, params?: unknown) => Promise<unknown>;
        };
    }
}

// Fordefi Wallet (uses Sats Connect standard .request() API)
declare global {
    interface Window {
        FordefiProvider?: {
            request: (method: string, params?: unknown) => Promise<unknown>;
        };
    }
}

export { };