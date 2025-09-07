// React hook for Solana Name Service integration

import { useState, useEffect, useCallback } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { SNSService } from '@/services/snsService';

export interface UseSNSReturn {
  // Domain resolution
  resolveDomain: (domain: string) => Promise<PublicKey | null>;
  reverseLookupDomain: (publicKey: PublicKey) => Promise<string | null>;
  getFavoriteDomain: (publicKey: PublicKey) => Promise<string | null>;
  
  // Domain info
  isDomainAvailable: (domain: string) => Promise<boolean>;
  formatAddressWithDomain: (publicKey: PublicKey) => Promise<string>;
  
  // Loading states
  isResolving: boolean;
  isLookingUp: boolean;
  
  // Cached results
  domainCache: Map<string, PublicKey | null>;
  addressCache: Map<string, string | null>;
  
  // Clear cache
  clearCache: () => void;
}

export function useSNS(connection: Connection): UseSNSReturn {
  const [snsService] = useState(() => new SNSService(connection));
  const [isResolving, setIsResolving] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [domainCache, setDomainCache] = useState(new Map<string, PublicKey | null>());
  const [addressCache, setAddressCache] = useState(new Map<string, string | null>());

  const clearCache = useCallback(() => {
    setDomainCache(new Map());
    setAddressCache(new Map());
  }, []);

  const resolveDomain = useCallback(async (domain: string): Promise<PublicKey | null> => {
    const cacheKey = domain.toLowerCase();
    
    // Check cache first
    if (domainCache.has(cacheKey)) {
      return domainCache.get(cacheKey) || null;
    }

    setIsResolving(true);
    try {
      const result = await snsService.resolveDomain(domain);
      
      // Update cache
      setDomainCache(prev => new Map(prev.set(cacheKey, result)));
      
      return result;
    } finally {
      setIsResolving(false);
    }
  }, [snsService, domainCache]);

  const reverseLookupDomain = useCallback(async (publicKey: PublicKey): Promise<string | null> => {
    const cacheKey = publicKey.toString();
    
    // Check cache first
    if (addressCache.has(cacheKey)) {
      return addressCache.get(cacheKey) || null;
    }

    setIsLookingUp(true);
    try {
      const result = await snsService.reverseLookupDomain(publicKey);
      
      // Update cache
      setAddressCache(prev => new Map(prev.set(cacheKey, result)));
      
      return result;
    } finally {
      setIsLookingUp(false);
    }
  }, [snsService, addressCache]);

  const getFavoriteDomain = useCallback(async (publicKey: PublicKey): Promise<string | null> => {
    const cacheKey = `fav_${publicKey.toString()}`;
    
    // Check cache first
    if (addressCache.has(cacheKey)) {
      return addressCache.get(cacheKey) || null;
    }

    try {
      const result = await snsService.getFavoriteDomain(publicKey);
      
      // Update cache
      setAddressCache(prev => new Map(prev.set(cacheKey, result)));
      
      return result;
    } catch (error) {
      return null;
    }
  }, [snsService, addressCache]);

  const isDomainAvailable = useCallback(async (domain: string): Promise<boolean> => {
    try {
      return await snsService.isDomainAvailable(domain);
    } catch (error) {
      return false;
    }
  }, [snsService]);

  const formatAddressWithDomain = useCallback(async (publicKey: PublicKey): Promise<string> => {
    const cacheKey = `format_${publicKey.toString()}`;
    
    // Check cache first
    if (addressCache.has(cacheKey)) {
      return addressCache.get(cacheKey) || publicKey.toString().slice(0, 8) + '...' + publicKey.toString().slice(-8);
    }

    try {
      const result = await snsService.formatAddressWithDomain(publicKey);
      
      // Update cache
      setAddressCache(prev => new Map(prev.set(cacheKey, result)));
      
      return result;
    } catch (error) {
      const fallback = publicKey.toString().slice(0, 8) + '...' + publicKey.toString().slice(-8);
      setAddressCache(prev => new Map(prev.set(cacheKey, fallback)));
      return fallback;
    }
  }, [snsService, addressCache]);

  return {
    resolveDomain,
    reverseLookupDomain,
    getFavoriteDomain,
    isDomainAvailable,
    formatAddressWithDomain,
    isResolving,
    isLookingUp,
    domainCache,
    addressCache,
    clearCache,
  };
}

// Hook for displaying addresses with SNS domains
export function useAddressDisplay(publicKey: PublicKey | null, connection: Connection) {
  const [displayName, setDisplayName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { formatAddressWithDomain } = useSNS(connection);

  useEffect(() => {
    if (!publicKey) {
      setDisplayName('');
      return;
    }

    setIsLoading(true);
    formatAddressWithDomain(publicKey)
      .then(setDisplayName)
      .finally(() => setIsLoading(false));
  }, [publicKey, formatAddressWithDomain]);

  return { displayName, isLoading };
}

// Hook for domain input validation
export function useDomainValidation() {
  const [isValid, setIsValid] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const validateDomain = useCallback((domain: string) => {
    if (!domain) {
      setIsValid(true);
      setErrorMessage('');
      return true;
    }

    const cleanDomain = domain.replace('.sol', '');
    
    if (cleanDomain.length < 1 || cleanDomain.length > 63) {
      setIsValid(false);
      setErrorMessage('Domain must be 1-63 characters long');
      return false;
    }

    if (!/^[a-zA-Z0-9-]+$/.test(cleanDomain)) {
      setIsValid(false);
      setErrorMessage('Domain can only contain letters, numbers, and hyphens');
      return false;
    }

    if (cleanDomain.startsWith('-') || cleanDomain.endsWith('-')) {
      setIsValid(false);
      setErrorMessage('Domain cannot start or end with a hyphen');
      return false;
    }

    setIsValid(true);
    setErrorMessage('');
    return true;
  }, []);

  return { isValid, errorMessage, validateDomain };
}