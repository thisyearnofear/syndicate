/**
 * SOLANA STUBS
 * 
 * Lightweight type stubs for @solana/* packages.
 * These allow the codebase to compile without the heavy Solana dependencies.
 * 
 * TO RE-ENABLE SOLANA:
 * 1. Add back to package.json:
 *    "@solana/web3.js": "^1.98.4",
 *    "@solana/spl-token": "^0.4.14",
 *    "@solana/wallet-adapter-base": "^0.9.27",
 *    "@solana/wallet-adapter-react": "^0.15.39",
 *    "@solana/wallet-adapter-react-ui": "^0.9.35",
 *    "@solana/wallet-adapter-wallets": "^0.19.32",
 *    "@bonfida/spl-name-service": "^3.0.16"
 * 2. Replace imports from '@/stubs/solana' back to '@solana/*'
 * 3. Run npm install
 */

// PublicKey stub
export class PublicKey {
  private _key: string;
  
  constructor(value: string | Uint8Array | number[]) {
    this._key = typeof value === 'string' ? value : '';
  }
  
  toString(): string {
    return this._key;
  }
  
  toBase58(): string {
    return this._key;
  }
  
  toBytes(): Uint8Array {
    return new Uint8Array(32);
  }
  
  equals(other: PublicKey): boolean {
    return this._key === other._key;
  }
  
  static isOnCurve(_: Uint8Array): boolean {
    return true;
  }
}

// Connection stub
export class Connection {
  private _endpoint: string;
  
  constructor(endpoint: string, _commitment?: string) {
    this._endpoint = endpoint;
  }
  
  get rpcEndpoint(): string {
    return this._endpoint;
  }
  
  async getBalance(_publicKey: PublicKey): Promise<number> {
    console.warn('[STUB] Solana Connection.getBalance called - Solana is disabled');
    return 0;
  }
  
  async getTokenAccountBalance(_tokenAccount: PublicKey): Promise<{ value: { uiAmount: number | null } }> {
    console.warn('[STUB] Solana Connection.getTokenAccountBalance called - Solana is disabled');
    return { value: { uiAmount: null } };
  }
  
  async getAccountInfo(_publicKey: PublicKey): Promise<null> {
    console.warn('[STUB] Solana Connection.getAccountInfo called - Solana is disabled');
    return null;
  }
  
  async sendTransaction(_transaction: Transaction): Promise<string> {
    throw new Error('[STUB] Solana is disabled - re-enable Solana packages to use this feature');
  }
}

// Transaction stubs
export class Transaction {
  instructions: TransactionInstruction[] = [];
  recentBlockhash?: string;
  feePayer?: PublicKey;
  
  add(...instructions: TransactionInstruction[]): Transaction {
    this.instructions.push(...instructions);
    return this;
  }
  
  serialize(): Uint8Array {
    return new Uint8Array(0);
  }
}

export class VersionedTransaction {
  message: unknown;
  signatures: Uint8Array[] = [];
  
  constructor(_message: unknown) {
    this.message = _message;
  }
  
  serialize(): Uint8Array {
    return new Uint8Array(0);
  }
}

export interface TransactionInstruction {
  keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[];
  programId: PublicKey;
  data: Buffer;
}

// SPL Token stubs
export async function getAssociatedTokenAddress(
  _mint: PublicKey,
  _owner: PublicKey
): Promise<PublicKey> {
  console.warn('[STUB] getAssociatedTokenAddress called - Solana is disabled');
  return new PublicKey('stub-token-address');
}

export async function getAccount(
  _connection: Connection,
  _address: PublicKey
): Promise<{ amount: bigint }> {
  console.warn('[STUB] getAccount called - Solana is disabled');
  return { amount: BigInt(0) };
}

// Wallet adapter types
export interface WalletAdapter {
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  signTransaction?(transaction: Transaction): Promise<Transaction>;
  signAllTransactions?(transactions: Transaction[]): Promise<Transaction[]>;
}

// Export a disabled flag for runtime checks
export const SOLANA_ENABLED = false;
