"use client";

/**
 * ENHANCED WALLET CONNECT COMPONENT
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced with premium UI components
 * - MODULAR: Uses premium button components
 * - CLEAN: Clear wallet connection interface
 * - PERFORMANT: Optimized interactions
 */

import { useState } from 'react';
import { Button } from "@/shared/components/ui/Button";
import { CompactStack, CompactFlex } from '@/shared/components/premium/CompactLayout';
import { WalletType } from '@/domains/wallet/services/unifiedWalletService';

interface ConnectWalletProps {
  onConnect?: (walletType: WalletType) => void;
}

export default function ConnectWallet({ onConnect }: ConnectWalletProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);

  const handleConnect = async (walletType: WalletType) => {
    if (isConnecting) return;
    
    setIsConnecting(true);
    setConnectingWallet(walletType);
    
    try {
      onConnect?.(walletType);
      console.log(`Connected to ${walletType}`);
    } catch (error) {
      console.error(`Failed to connect to ${walletType}:`, error);
    } finally {
      setIsConnecting(false);
      setConnectingWallet(null);
    }
  };

  const wallets = [
    { 
      name: 'MetaMask', 
      icon: '🦊', 
      variant: 'primary' as const,
      description: 'Most popular Ethereum wallet'
    },
    { 
      name: 'Phantom', 
      icon: '👻', 
      variant: 'secondary' as const,
      description: 'Solana & multi-chain wallet'
    },
    { 
      name: 'WalletConnect', 
      icon: '🔗', 
      variant: 'premium' as const,
      description: 'Connect any wallet'
    },
  ];

  return (
    <CompactStack spacing="md">
      {/* Main wallet options */}
      <CompactStack spacing="sm">
        {wallets.map((wallet) => (
          <Button
            key={wallet.name}
            variant="default"
            size="lg"
            onClick={() => handleConnect(wallet.name as WalletType)}
            disabled={isConnecting}
            className={`w-full justify-start ${wallet.variant === 'primary' ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl border border-blue-500/20' : wallet.variant === 'secondary' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg hover:shadow-xl border border-emerald-400/20' : 'bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 text-white shadow-2xl hover:shadow-purple-500/25 border border-purple-400/30'}`}
          >
            <div className="flex-1 text-left">
              <div className="font-semibold">{wallet.icon} {wallet.name}</div>
              <div className="text-xs opacity-80">{wallet.description}</div>
            </div>
          </Button>
        ))}
      </CompactStack>
      
      {/* Social login option */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/20" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-gray-900 px-2 text-gray-400">or</span>
        </div>
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleConnect('social' as WalletType)}
        disabled={isConnecting}
        className="w-full"
      >
        {isConnecting && connectingWallet === 'Social' ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" /> : "🔐"} Connect with Social Login
      </Button>
      
      {/* Help text */}
      <p className="text-xs text-gray-500 text-center leading-relaxed">
        New to crypto? Social login creates a wallet for you automatically.
      </p>
    </CompactStack>
  );
}