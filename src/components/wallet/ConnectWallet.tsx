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
import { PremiumButton } from '@/shared/components/premium/PremiumButton';
import { CompactStack, CompactFlex } from '@/shared/components/premium/CompactLayout';
import { BodyText } from '@/shared/components/premium/Typography';

interface ConnectWalletProps {
  onConnect?: (walletType: string) => void;
}

export default function ConnectWallet({ onConnect }: ConnectWalletProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);

  const handleConnect = async (walletType: string) => {
    setIsConnecting(true);
    setConnectingWallet(walletType);
    
    try {
      // Simulate connection delay with realistic timing
      await new Promise(resolve => setTimeout(resolve, 1500));
      
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
          <PremiumButton
            key={wallet.name}
            variant={wallet.variant}
            size="md"
            onClick={() => handleConnect(wallet.name)}
            disabled={isConnecting}
            isLoading={isConnecting && connectingWallet === wallet.name}
            leftIcon={wallet.icon}
            className="w-full justify-start"
          >
            <div className="flex-1 text-left">
              <div className="font-semibold">{wallet.name}</div>
              <div className="text-xs opacity-80">{wallet.description}</div>
            </div>
          </PremiumButton>
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
      
      <PremiumButton
        variant="ghost"
        size="sm"
        onClick={() => handleConnect('Social')}
        disabled={isConnecting}
        isLoading={isConnecting && connectingWallet === 'Social'}
        leftIcon="🔐"
        className="w-full"
      >
        Connect with Social Login
      </PremiumButton>
      
      {/* Help text */}
      <BodyText size="xs" color="gray-500" className="text-center">
        New to crypto? Social login creates a wallet for you automatically.
      </BodyText>
    </CompactStack>
  );
}