"use client";

import {
  Implementation,
  MetaMaskSmartAccount,
  toMetaMaskSmartAccount,
} from "@metamask/delegation-toolkit";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { PublicClient, WalletClient, Address } from "viem";

export interface SmartAccountConfig {
  client: PublicClient;
  implementation?: Implementation;
  deployParams?: any[];
  deploySalt?: string;
}

export interface SessionAccountConfig extends SmartAccountConfig {
  privateKey?: `0x${string}`;
  saveToStorage?: boolean;
}

export interface WalletAccountConfig extends SmartAccountConfig {
  walletClient: WalletClient;
  ownerAddress: Address;
}

/**
 * Unified service for creating and managing MetaMask smart accounts
 * Follows DRY principles by centralizing all smart account creation logic
 */
export class SmartAccountService {
  private static instance: SmartAccountService;
  private readonly PRIVATE_KEY_STORAGE_KEY = "syndicate_session_private_key";

  static getInstance(): SmartAccountService {
    if (!SmartAccountService.instance) {
      SmartAccountService.instance = new SmartAccountService();
    }
    return SmartAccountService.instance;
  }

  /**
   * Create a session-based smart account with generated or provided private key
   */
  async createSessionAccount(config: SessionAccountConfig): Promise<MetaMaskSmartAccount<Implementation>> {
    const {
      client,
      implementation = Implementation.Hybrid,
      deployParams,
      deploySalt = "0x",
      privateKey,
      saveToStorage = true,
    } = config;

    const key = privateKey || generatePrivateKey();
    const account = privateKeyToAccount(key);

    const smartAccount = await toMetaMaskSmartAccount({
      client,
      implementation,
      deployParams: deployParams || [account.address, [], [], []],
      deploySalt,
      signatory: { account },
    });

    // Save private key to storage if requested and not provided
    if (saveToStorage && !privateKey && typeof window !== 'undefined') {
      sessionStorage.setItem(this.PRIVATE_KEY_STORAGE_KEY, key);
    }

    return smartAccount;
  }

  /**
   * Create a wallet-connected smart account
   */
  async createWalletAccount(config: WalletAccountConfig): Promise<MetaMaskSmartAccount<Implementation>> {
    const {
      client,
      implementation = Implementation.Hybrid,
      deployParams,
      deploySalt = "0x",
      walletClient,
      ownerAddress,
    } = config;

    return await toMetaMaskSmartAccount({
      client,
      implementation,
      deployParams: deployParams || [ownerAddress, [], [], []],
      deploySalt,
      signatory: { walletClient },
    });
  }

  /**
   * Restore session account from stored private key
   */
  async restoreSessionAccount(client: PublicClient): Promise<MetaMaskSmartAccount<Implementation> | null> {
    if (typeof window === 'undefined') return null;

    const storedKey = sessionStorage.getItem(this.PRIVATE_KEY_STORAGE_KEY);
    if (!storedKey) return null;

    try {
      return await this.createSessionAccount({
        client,
        privateKey: storedKey as `0x${string}`,
        saveToStorage: false,
      });
    } catch (error) {
      console.error('Failed to restore session account:', error);
      this.clearSessionAccount();
      return null;
    }
  }

  /**
   * Clear stored session account data
   */
  clearSessionAccount(): void {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(this.PRIVATE_KEY_STORAGE_KEY);
    }
  }

  /**
   * Check if smart account is deployed on chain
   */
  async isAccountDeployed(smartAccount: MetaMaskSmartAccount<Implementation>): Promise<boolean> {
    try {
      const code = await smartAccount.client.getBytecode({
        address: smartAccount.address,
      });
      return code !== undefined && code !== '0x';
    } catch (error) {
      console.error('Failed to check account deployment:', error);
      return false;
    }
  }

  /**
   * Deploy smart account if not already deployed
   */
  async deployAccount(smartAccount: MetaMaskSmartAccount<Implementation>): Promise<string> {
    const isDeployed = await this.isAccountDeployed(smartAccount);
    if (isDeployed) {
      throw new Error('Account is already deployed');
    }

    // Deploy the account by sending a transaction
    const hash = await smartAccount.deployContract();
    return hash;
  }

  /**
   * Get default smart account configuration
   */
  getDefaultConfig(client: PublicClient): Omit<SmartAccountConfig, 'client'> {
    return {
      implementation: Implementation.Hybrid,
      deployParams: [],
      deploySalt: "0x",
    };
  }
}

// Export singleton instance
export const smartAccountService = SmartAccountService.getInstance();
