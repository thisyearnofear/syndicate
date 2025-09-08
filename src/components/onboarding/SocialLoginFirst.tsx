"use client";

import React, { useState } from 'react';
import { useWeb3Auth, useWeb3AuthConnect } from "@web3auth/modal/react";
import { useSolanaWallet } from '@/providers/SolanaWalletProvider';
import { useAccount } from 'wagmi';
// Simple CSS-based animations
const motion = {
  div: ({ children, className, initial, animate, exit, transition, ...props }: any) => (
    <div className={`${className} animate-fade-in`} {...props}>
      {children}
    </div>
  ),
  button: ({ children, className, whileHover, whileTap, ...props }: any) => (
    <button className={`${className} transition-transform hover:scale-105 active:scale-95`} {...props}>
      {children}
    </button>
  )
};

const AnimatePresence = ({ children, mode }: any) => (
  <div className="animate-presence">
    {children}
  </div>
);
import { 
  Mail, 
  Chrome, 
  Github, 
  Twitter, 
  Smartphone,
  Wallet,
  Zap,
  Users,
  Heart,
  ArrowRight,
  CheckCircle
} from 'lucide-react';

interface SocialLoginFirstProps {
  onComplete: () => void;
  className?: string;
}

const SOCIAL_PROVIDERS = [
  {
    id: 'google',
    name: 'Google',
    icon: Chrome,
    color: 'bg-red-500 hover:bg-red-600',
    description: 'Continue with your Google account'
  },
  {
    id: 'email_passwordless',
    name: 'Email',
    icon: Mail,
    color: 'bg-blue-500 hover:bg-blue-600',
    description: 'Sign in with your email address'
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: Github,
    color: 'bg-gray-700 hover:bg-gray-800',
    description: 'Continue with GitHub'
  },
  {
    id: 'twitter',
    name: 'Twitter',
    icon: Twitter,
    color: 'bg-sky-500 hover:bg-sky-600',
    description: 'Continue with Twitter'
  }
];

const ONBOARDING_STEPS = [
  {
    icon: Smartphone,
    title: 'Social Login',
    description: 'Sign in with your favorite social account'
  },
  {
    icon: Wallet,
    title: 'Instant Wallet',
    description: 'We create secure wallets automatically'
  },
  {
    icon: Users,
    title: 'Join Pools',
    description: 'Start participating in lottery pools'
  },
  {
    icon: Heart,
    title: 'Support Causes',
    description: 'Automatically donate to causes you care about'
  }
];

export default function SocialLoginFirst({ onComplete, className = '' }: SocialLoginFirstProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [step, setStep] = useState<'welcome' | 'providers' | 'connecting' | 'success'>('welcome');
  
  const { isConnected: web3AuthConnected } = useWeb3Auth();
  const { connect: web3AuthConnect } = useWeb3AuthConnect();
  const { isConnected: evmConnected } = useAccount();
  const { connected: solanaConnected } = useSolanaWallet();

  const handleSocialLogin = async (providerId: string) => {
    setSelectedProvider(providerId);
    setIsConnecting(true);
    setStep('connecting');

    try {
      // For demo purposes, simulate successful connection
      setTimeout(() => {
        setStep('success');
        setTimeout(() => {
          onComplete();
        }, 2000);
      }, 2000);
      
    } catch (error) {
      console.error('Social login failed:', error);
      setIsConnecting(false);
      setStep('providers');
    }
  };

  const isFullyConnected = web3AuthConnected || evmConnected || solanaConnected;

  if (isFullyConnected && step !== 'success') {
    setStep('success');
    setTimeout(onComplete, 1000);
  }

  return (
    <div className={`social-login-first ${className}`}>
      <AnimatePresence mode="wait">
        {step === 'welcome' && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center space-y-8"
          >
            {/* Hero Section */}
            <div className="space-y-4">
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
                className="text-6xl mb-4"
              >
                🎯
              </motion.div>
              
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 via-blue-500 to-green-400 bg-clip-text text-transparent">
                Welcome to Syndicate
              </h1>
              
              <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
                Join lottery pools with friends, increase your chances of winning, 
                and automatically support causes you care about.
              </p>
            </div>

            {/* Value Props */}
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-xl p-6 border border-purple-500/20"
              >
                <Users className="w-8 h-8 text-purple-400 mb-3" />
                <h3 className="text-lg font-semibold text-white mb-2">Social Coordination</h3>
                <p className="text-gray-300 text-sm">Pool resources with friends across multiple blockchains</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-gradient-to-br from-green-900/50 to-blue-900/50 rounded-xl p-6 border border-green-500/20"
              >
                <Heart className="w-8 h-8 text-green-400 mb-3" />
                <h3 className="text-lg font-semibold text-white mb-2">Cause Impact</h3>
                <p className="text-gray-300 text-sm">Automatically donate portions to ocean cleanup, food aid, and more</p>
              </motion.div>
            </div>

            {/* How It Works */}
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-white">How It Works</h2>
              <div className="grid md:grid-cols-4 gap-4">
                {ONBOARDING_STEPS.map((step, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                    className="text-center space-y-3"
                  >
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto">
                      <step.icon className="w-6 h-6 text-white" />
                    </div>
                    <h4 className="font-medium text-white">{step.title}</h4>
                    <p className="text-sm text-gray-400">{step.description}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              onClick={() => setStep('providers')}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200 flex items-center gap-3 mx-auto text-lg"
            >
              Get Started in 30 Seconds
              <ArrowRight className="w-5 h-5" />
            </motion.button>

            <p className="text-sm text-gray-400">
              No seed phrases • No downloads • No complexity
            </p>
          </motion.div>
        )}

        {step === 'providers' && (
          <motion.div
            key="providers"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md mx-auto space-y-6"
          >
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold text-white">Choose Your Login</h2>
              <p className="text-gray-300">
                We'll create secure wallets automatically - no seed phrases needed!
              </p>
            </div>

            <div className="space-y-3">
              {SOCIAL_PROVIDERS.map((provider) => (
                <motion.button
                  key={provider.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSocialLogin(provider.id)}
                  disabled={isConnecting}
                  className={`w-full ${provider.color} text-white font-medium py-4 px-6 rounded-xl transition-all duration-200 flex items-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <provider.icon className="w-5 h-5" />
                  <div className="flex-1 text-left">
                    <div className="font-semibold">{provider.name}</div>
                    <div className="text-sm opacity-90">{provider.description}</div>
                  </div>
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              ))}
            </div>

            <div className="text-center">
              <button
                onClick={() => setStep('welcome')}
                className="text-gray-400 hover:text-white transition-colors text-sm"
              >
                ← Back to overview
              </button>
            </div>
          </motion.div>
        )}

        {step === 'connecting' && (
          <motion.div
            key="connecting"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="text-center space-y-8"
          >
            <div className="space-y-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full mx-auto"
              />
              
              <h2 className="text-2xl font-bold text-white">Creating Your Wallets</h2>
              <p className="text-gray-300">
                Setting up your secure, multi-chain wallets...
              </p>
            </div>

            <div className="space-y-4 max-w-sm mx-auto">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-3 text-green-400"
              >
                <CheckCircle className="w-5 h-5" />
                <span>Authenticating with {selectedProvider}</span>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1 }}
                className="flex items-center gap-3 text-green-400"
              >
                <CheckCircle className="w-5 h-5" />
                <span>Creating Solana wallet</span>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.5 }}
                className="flex items-center gap-3 text-green-400"
              >
                <CheckCircle className="w-5 h-5" />
                <span>Setting up cross-chain support</span>
              </motion.div>
            </div>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="text-center space-y-8"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="text-6xl"
            >
              🎉
            </motion.div>
            
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-white">Welcome to Syndicate!</h2>
              <p className="text-gray-300 max-w-md mx-auto">
                Your wallets are ready. Let's find some lottery pools to join!
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-green-900/30 border border-green-600 rounded-lg p-4 max-w-sm mx-auto"
            >
              <div className="flex items-center gap-3 text-green-400">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Multi-chain wallets created</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}