export type TrackerStatus =
  | 'idle'
  | 'connecting_wallet'
  | 'linking_wallets'
  | 'checking_balance'
  | 'signing'
  | 'broadcasting'
  | 'confirmed_stacks'
  | 'confirmed_source'
  | 'bridging'
  | 'purchasing'
  | 'complete'
  | 'error';

export type SourceChainType =
  | 'base'
  | 'solana'
  | 'near'
  | 'stacks'
  | 'ethereum'
  | 'starknet';

export interface PurchaseReceiptLinks {
  stacksExplorer?: string;
  sourceExplorer?: string;
  baseExplorer?: string | null;
  megapotApp?: string | null;
}

export interface PurchaseStatusResponse {
  status: string;
  sourceChain?: SourceChainType;
  sourceTxId?: string;
  stacksTxId?: string;
  baseTxId?: string;
  error?: string;
  updatedAt?: string | null;
  receipt?: PurchaseReceiptLinks;
}

