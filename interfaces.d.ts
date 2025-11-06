import type {
  EIP6963AnnounceProviderEvent,
  EIP6963RequestProviderEvent,
  MetaMaskInpageProvider,
} from '@metamask/providers';

interface Purchase {
  startTicket?: number;
  endTicket?: number;
  ticketsPurchased?: number;
  transactionHashes?: string[];
  txHash?: string;
  timestamp?: string | number;
  createdAt?: string | number;
  updatedAt?: string | number;
  jackpotRoundId: number;
  recipient: string;
  referrer?: string;
  buyer: string;
}

interface UserIdentity {
  farcaster?: {
    username: string;
    followerCount?: number;
  };
  twitter?: {
    username: string;
    followerCount?: number;
  };
}

/*
 * Window type extension to support ethereum and phantom
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Window {
    ethereum: MetaMaskInpageProvider & {
      setProvider?: (provider: MetaMaskInpageProvider) => void;
      detected?: MetaMaskInpageProvider[];
      providers?: MetaMaskInpageProvider[];
    };
    phantom?: {
      ethereum?: MetaMaskInpageProvider;
    };
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface WindowEventMap {
    'eip6963:requestProvider': EIP6963RequestProviderEvent;
    'eip6963:announceProvider': EIP6963AnnounceProviderEvent;
  }
}
