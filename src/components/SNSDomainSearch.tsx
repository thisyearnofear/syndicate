"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useSolanaWallet } from '@/providers/SolanaWalletProvider';
import { useSNS, useDomainValidation } from '@/hooks/useSNS';
import { Search, CheckCircle, XCircle, ExternalLink, Copy } from 'lucide-react';

interface SNSDomainSearchProps {
  className?: string;
  onDomainSelect?: (domain: string, publicKey: PublicKey) => void;
}

export default function SNSDomainSearch({ className = '', onDomainSelect }: SNSDomainSearchProps) {
  const { connection } = useSolanaWallet();
  const {
    resolveDomain,
    reverseLookupDomain,
    isDomainAvailable,
    isResolving,
    clearCache
  } = useSNS(connection);
  const { isValid, errorMessage, validateDomain } = useDomainValidation();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<{
    domain: string;
    publicKey: PublicKey | null;
    available: boolean;
    error?: string;
  } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Handle search input change
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    validateDomain(value);
    
    // Clear previous results when typing
    if (searchResult) {
      setSearchResult(null);
    }
  }, [validateDomain, searchResult]);

  // Perform domain search
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !isValid) return;
    
    const domain = searchQuery.trim().toLowerCase();
    const fullDomain = domain.endsWith('.sol') ? domain : `${domain}.sol`;
    
    setIsSearching(true);
    try {
      const publicKey = await resolveDomain(fullDomain);
      const available = publicKey === null;
      
      setSearchResult({
        domain: fullDomain,
        publicKey,
        available
      });
      
      // Add to recent searches
      setRecentSearches(prev => {
        const updated = [fullDomain, ...prev.filter(d => d !== fullDomain)];
        return updated.slice(0, 5); // Keep only 5 recent searches
      });
      
      // Call callback if domain is resolved
      if (publicKey && onDomainSelect) {
        onDomainSelect(fullDomain, publicKey);
      }
    } catch (error) {
      setSearchResult({
        domain: fullDomain,
        publicKey: null,
        available: false,
        error: 'Failed to resolve domain'
      });
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, isValid, resolveDomain, onDomainSelect]);

  // Handle Enter key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  // Copy address to clipboard
  const copyAddress = useCallback(async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy address:', error);
    }
  }, []);

  // Clear all data
  const handleClear = useCallback(() => {
    setSearchQuery('');
    setSearchResult(null);
    setRecentSearches([]);
    clearCache();
  }, [clearCache]);

  return (
    <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
          <Search className="w-5 h-5" />
          <span>SNS Domain Search</span>
        </h3>
        <button
          onClick={handleClear}
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          Clear All
        </button>
      </div>

      {/* Search Input */}
      <div className="space-y-3">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Search for .sol domains (e.g., alice.sol)"
            className={`w-full bg-gray-700 border rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors ${
              !isValid ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-purple-500'
            }`}
          />
          <button
            onClick={handleSearch}
            disabled={!searchQuery.trim() || !isValid || isSearching}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-4 py-1.5 rounded text-sm transition-colors"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
        
        {/* Validation Error */}
        {!isValid && errorMessage && (
          <p className="text-red-400 text-sm flex items-center space-x-1">
            <XCircle className="w-4 h-4" />
            <span>{errorMessage}</span>
          </p>
        )}
      </div>

      {/* Search Result */}
      {searchResult && (
        <div className="mt-6 p-4 bg-gray-700 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <h4 className="font-medium text-white">{searchResult.domain}</h4>
                {searchResult.available ? (
                  <span className="flex items-center space-x-1 text-green-400 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    <span>Available</span>
                  </span>
                ) : searchResult.publicKey ? (
                  <span className="flex items-center space-x-1 text-blue-400 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    <span>Registered</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-1 text-red-400 text-sm">
                    <XCircle className="w-4 h-4" />
                    <span>Error</span>
                  </span>
                )}
              </div>
              
              {searchResult.publicKey && (
                <div className="space-y-2">
                  <p className="text-gray-300 text-sm">
                    <span className="font-medium">Owner:</span>
                  </p>
                  <div className="flex items-center space-x-2 bg-gray-800 p-2 rounded">
                    <code className="text-green-400 text-sm font-mono flex-1">
                      {searchResult.publicKey.toString()}
                    </code>
                    <button
                      onClick={() => copyAddress(searchResult.publicKey!.toString())}
                      className="text-gray-400 hover:text-white transition-colors"
                      title="Copy address"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <a
                      href={`https://solscan.io/account/${searchResult.publicKey.toString()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-white transition-colors"
                      title="View on Solscan"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              )}
              
              {searchResult.available && (
                <div className="mt-3">
                  <p className="text-green-400 text-sm mb-2">This domain is available for registration!</p>
                  <a
                    href={`https://naming.bonfida.org/#/auctions/${searchResult.domain.replace('.sol', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm transition-colors"
                  >
                    <span>Register on Bonfida</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
              
              {searchResult.error && (
                <p className="text-red-400 text-sm mt-2">{searchResult.error}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Recent Searches</h4>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((domain) => (
              <button
                key={domain}
                onClick={() => {
                  setSearchQuery(domain);
                  handleSearchChange(domain);
                }}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded transition-colors"
              >
                {domain}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SNS Info */}
      <div className="mt-6 p-3 bg-purple-900/30 border border-purple-700 rounded-lg">
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-purple-400 font-medium text-sm">Powered by Solana Name Service</span>
        </div>
        <p className="text-purple-300 text-xs">
          SNS domains provide human-readable names for Solana addresses, making transactions easier and more secure.
        </p>
      </div>
    </div>
  );
}