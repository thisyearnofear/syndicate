// Solana Name Service (SNS) Integration
// Provides domain resolution and reverse lookup functionality

import { Connection, PublicKey } from '@solana/web3.js';
import { resolve, reverseLookup, getFavoriteDomain } from '@bonfida/spl-name-service';

export interface SNSDomain {
  domain: string;
  owner: PublicKey;
  isVerified: boolean;
}

export class SNSService {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Resolve a .sol domain to a public key
   */
  async resolveDomain(domain: string): Promise<PublicKey | null> {
    try {
      // Remove .sol if present
      const cleanDomain = domain.replace('.sol', '');
      const publicKey = await resolve(this.connection, cleanDomain);
      return publicKey;
    } catch (error) {
      console.error('Failed to resolve domain:', error);
      return null;
    }
  }

  /**
   * Reverse lookup - get domain from public key
   */
  async reverseLookupDomain(publicKey: PublicKey): Promise<string | null> {
    try {
      const domain = await reverseLookup(this.connection, publicKey);
      return domain ? `${domain}.sol` : null;
    } catch (error) {
      console.error('Failed to reverse lookup domain:', error);
      return null;
    }
  }

  /**
   * Get favorite domain for a public key
   */
  async getFavoriteDomain(publicKey: PublicKey): Promise<string | null> {
    try {
      const domain = await getFavoriteDomain(this.connection, publicKey);
      return domain ? `${domain}.sol` : null;
    } catch (error) {
      console.error('Failed to get favorite domain:', error);
      return null;
    }
  }

  /**
   * Check if a domain is available
   */
  async isDomainAvailable(domain: string): Promise<boolean> {
    try {
      const cleanDomain = domain.replace('.sol', '');
      const publicKey = await resolve(this.connection, cleanDomain);
      return publicKey === null;
    } catch (error) {
      // If resolution fails, domain might be available
      return true;
    }
  }

  /**
   * Get domain info including owner and verification status
   */
  async getDomainInfo(domain: string): Promise<SNSDomain | null> {
    try {
      const cleanDomain = domain.replace('.sol', '');
      const owner = await resolve(this.connection, cleanDomain);
      
      if (!owner) return null;

      return {
        domain: `${cleanDomain}.sol`,
        owner,
        isVerified: true // For now, assume resolved domains are verified
      };
    } catch (error) {
      console.error('Failed to get domain info:', error);
      return null;
    }
  }

  /**
   * Format address display with SNS domain if available
   */
  async formatAddressWithDomain(publicKey: PublicKey): Promise<string> {
    try {
      const domain = await this.getFavoriteDomain(publicKey);
      if (domain) {
        return domain;
      }
      
      // Fallback to shortened address
      const address = publicKey.toString();
      return `${address.slice(0, 4)}...${address.slice(-4)}`;
    } catch (error) {
      // Fallback to shortened address
      const address = publicKey.toString();
      return `${address.slice(0, 4)}...${address.slice(-4)}`;
    }
  }

  /**
   * Validate domain format
   */
  static isValidDomain(domain: string): boolean {
    const cleanDomain = domain.replace('.sol', '');
    // Basic validation: alphanumeric and hyphens, 1-63 characters
    const domainRegex = /^[a-zA-Z0-9-]{1,63}$/;
    return domainRegex.test(cleanDomain);
  }

  /**
   * Search for domains by partial match (mock implementation)
   */
  async searchDomains(query: string): Promise<string[]> {
    // This would typically query an indexer or API
    // For now, return empty array as this requires additional infrastructure
    return [];
  }
}

// Create a singleton instance
let snsServiceInstance: SNSService | null = null;

export function getSNSService(connection?: Connection): SNSService {
  if (!snsServiceInstance && connection) {
    snsServiceInstance = new SNSService(connection);
  }
  
  if (!snsServiceInstance) {
    throw new Error('SNS Service not initialized. Please provide a connection.');
  }
  
  return snsServiceInstance;
}

// Hook for React components
export function useSNS(connection: Connection) {
  const snsService = getSNSService(connection);
  
  return {
    resolveDomain: snsService.resolveDomain.bind(snsService),
    reverseLookupDomain: snsService.reverseLookupDomain.bind(snsService),
    getFavoriteDomain: snsService.getFavoriteDomain.bind(snsService),
    isDomainAvailable: snsService.isDomainAvailable.bind(snsService),
    getDomainInfo: snsService.getDomainInfo.bind(snsService),
    formatAddressWithDomain: snsService.formatAddressWithDomain.bind(snsService),
  };
}