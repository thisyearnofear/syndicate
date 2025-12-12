/**
 * Type declarations for Stacks ecosystem wallets
 * These provide TypeScript support for Stacks wallet providers
 */

// Leather Wallet
declare global {
    interface Window {
        LeatherProvider?: {
            connect: () => Promise<{ address: string; publicKey: string }>;
            disconnect: () => Promise<void>;
            signTransaction: (transaction: string) => Promise<{ signature: string }>;
            getAddresses: () => Promise<{ address: string; publicKey: string }[]>;
        };
    }
}

// Xverse Wallet
declare global {
    interface Window {
        XverseProviders?: {
            StacksProvider?: {
                connect: () => Promise<{ address: string; publicKey: string }>;
                disconnect: () => Promise<void>;
                signTransaction: (transaction: string) => Promise<{ signature: string }>;
                getAddresses: () => Promise<{ address: string; publicKey: string }[]>;
            };
        };
    }
}

// Asigna Wallet
declare global {
    interface Window {
        AsignaProvider?: {
            connect: () => Promise<{ address: string; publicKey: string }>;
            disconnect: () => Promise<void>;
            signTransaction: (transaction: string) => Promise<{ signature: string }>;
            getAddresses: () => Promise<{ address: string; publicKey: string }[]>;
        };
    }
}

// Fordefi Wallet
declare global {
    interface Window {
        FordefiProvider?: {
            connect: () => Promise<{ address: string; publicKey: string }>;
            disconnect: () => Promise<void>;
            signTransaction: (transaction: string) => Promise<{ signature: string }>;
            getAddresses: () => Promise<{ address: string; publicKey: string }[]>;
        };
    }
}

export { };