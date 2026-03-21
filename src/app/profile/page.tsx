"use client";

/**
 * USER DASHBOARD PAGE
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Building on existing components and patterns
 * - MODULAR: Composable dashboard sections
 * - PERFORMANT: Optimized data loading and caching
 * - CLEAN: Clear separation of concerns
 */

import { useState, useEffect } from "react";
import { useWalletContext } from "@/context/WalletContext";
import { megapotService } from "@/domains/lottery/services/megapotService";
import type { TicketPurchase } from "@/domains/lottery/types";
import { socialService, type MemoryIdentity } from "@/services/socialService";
import { performance } from "@/config";
import { Button } from "@/shared/components/ui/Button";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import TransactionHistory from "@/components/TransactionHistory";
import {
CompactContainer,
CompactStack,
  CompactSection,
} from "@/shared/components/premium/CompactLayout";
import {
  PuzzlePiece,
} from "@/shared/components/premium/PuzzlePiece";

// Icons
import { Ticket, History, Trophy, Wallet, TrendingUp, Twitter, MessageCircle, User, CircleCheck, Settings, ExternalLink } from "lucide-react";

export default function ProfilePage() {
  const { state: walletState } = useWalletContext();
  const [ticketPurchases, setTicketPurchases] = useState<TicketPurchase[]>([]);
  const [userIdentity, setUserIdentity] = useState<MemoryIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [identityLoading, setIdentityLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baseAddress, setBaseAddress] = useState<string>('');
  const [baseAddressSaved, setBaseAddressSaved] = useState(false);
  const [baseAddressInput, setBaseAddressInput] = useState<string>('');

  // Load saved Base address from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('syndicate_base_address') ?? '';
    setBaseAddress(saved);
    setBaseAddressInput(saved);
  }, []);

  const isValidEvmAddress = (addr: string) => /^0x[0-9a-fA-F]{40}$/.test(addr);

  const handleSaveBaseAddress = () => {
    if (!isValidEvmAddress(baseAddressInput)) return;
    localStorage.setItem('syndicate_base_address', baseAddressInput);
    setBaseAddress(baseAddressInput);
    setBaseAddressSaved(true);
    setTimeout(() => setBaseAddressSaved(false), 2000);
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!walletState.address) return;

      try {
        setLoading(true);
        setIdentityLoading(true);

        // Load ticket history
        const purchases = await megapotService.getTicketPurchases(walletState.address, performance.pagination.transactions);
        setTicketPurchases(purchases);

        // Load user identity from Memory Protocol
        const identity = await socialService.getUserIdentity(walletState.address);
        setUserIdentity(identity);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError('Failed to load profile data');
      } finally {
        setLoading(false);
        setIdentityLoading(false);
      }
    };

    fetchData();
  }, [walletState.address]);

  const handleViewTransaction = (txHash: string) => {
    window.open(`https://basescan.org/tx/${txHash}`, '_blank');
  };

  if (!walletState.isConnected || !walletState.address) {
    return (
      <CompactContainer className="min-h-screen py-8">
        <CompactStack spacing="lg">
          <h1 className="text-3xl font-bold text-white">My Dashboard</h1>
          <PuzzlePiece variant="accent" size="md" shape="rounded">
            <CompactStack spacing="md" align="center">
              <Wallet className="w-12 h-12 text-gray-400" />
              <p className="text-gray-400">Please connect your wallet to view your dashboard</p>
              <Button variant="default">Connect Wallet</Button>
            </CompactStack>
          </PuzzlePiece>
        </CompactStack>
      </CompactContainer>
    );
  }

  return (
    <CompactContainer className="min-h-screen py-8">
      <CompactStack spacing="lg">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">My Dashboard</h1>
          <div className="text-sm text-gray-400">
            Connected: {walletState.address.slice(0, 6)}...{walletState.address.slice(-4)}
          </div>
        </div>

        {/* Identity Verification */}
        {identityLoading ? (
          <div className="flex justify-center py-4">
            <LoadingSpinner size="sm" color="white" />
          </div>
        ) : userIdentity && (
          <PuzzlePiece variant="secondary" size="md" shape="rounded" glow>
            <CompactStack spacing="md">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-white">Verified Identities</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {userIdentity.farcaster && (
                  <div className="flex items-center gap-3 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                    <MessageCircle className="w-5 h-5 text-purple-400" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{userIdentity.farcaster.displayName}</span>
                        {userIdentity.farcaster.verified && <CircleCheck className="w-4 h-4 text-green-400" />}
                      </div>
                      <span className="text-sm text-gray-400">@{userIdentity.farcaster.username}</span>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                        <span>{userIdentity.farcaster.followerCount.toLocaleString()} followers</span>
                        <span>{userIdentity.farcaster.followingCount.toLocaleString()} following</span>
                      </div>
                    </div>
                  </div>
                )}

                {userIdentity.twitter && (
                  <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <Twitter className="w-5 h-5 text-blue-400" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{userIdentity.twitter.displayName}</span>
                        {userIdentity.twitter.verified && <CircleCheck className="w-4 h-4 text-green-400" />}
                      </div>
                      <span className="text-sm text-gray-400">@{userIdentity.twitter.username}</span>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                        <span>{userIdentity.twitter.followerCount.toLocaleString()} followers</span>
                        <span>{userIdentity.twitter.followingCount.toLocaleString()} following</span>
                      </div>
                    </div>
                  </div>
                )}

                {!userIdentity.farcaster && !userIdentity.twitter && (
                  <div className="col-span-full text-center py-4">
                    <p className="text-gray-400 text-sm">No verified social identities found</p>
                    <p className="text-gray-500 text-xs mt-1">Connect your Farcaster or Twitter to build trust</p>
                  </div>
                )}
              </div>
            </CompactStack>
          </PuzzlePiece>
        )}

        {/* Base Address Settings */}
        <PuzzlePiece variant="secondary" size="md" shape="rounded">
          <CompactStack spacing="md">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-gray-400" />
              <h3 className="font-semibold text-white">Base Address</h3>
              <span className="text-xs text-gray-500 ml-auto">Where tickets &amp; prizes are delivered</span>
            </div>
            <p className="text-xs text-gray-400">
              Cross-chain purchases (Stacks, Solana, NEAR) deliver lottery tickets to this Base address.
              Set a permanent address — e.g. a hardware wallet — instead of relying on auto-detection.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={baseAddressInput}
                onChange={(e) => { setBaseAddressInput(e.target.value); setBaseAddressSaved(false); }}
                placeholder="0x..."
                className={`flex-1 bg-gray-800 border rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-gray-500 outline-none transition-colors ${
                  baseAddressInput && !isValidEvmAddress(baseAddressInput)
                    ? 'border-red-500/60 focus:border-red-400'
                    : baseAddressInput && isValidEvmAddress(baseAddressInput)
                    ? 'border-green-500/60 focus:border-green-400'
                    : 'border-gray-600 focus:border-blue-500'
                }`}
              />
              <button
                onClick={handleSaveBaseAddress}
                disabled={!isValidEvmAddress(baseAddressInput) || baseAddressInput === baseAddress}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-500 text-white"
              >
                {baseAddressSaved ? '✓ Saved' : 'Save'}
              </button>
            </div>
            {baseAddress && isValidEvmAddress(baseAddress) && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <CircleCheck className="w-3.5 h-3.5 text-green-400" />
                <span>Active: <span className="font-mono text-gray-300">{baseAddress.slice(0, 10)}...{baseAddress.slice(-6)}</span></span>
                <a
                  href={`https://basescan.org/address/${baseAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1 text-blue-400 hover:text-blue-300"
                >
                  View on Basescan <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </CompactStack>
        </PuzzlePiece>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PuzzlePiece variant="primary" size="md" shape="rounded">
            <CompactStack spacing="sm">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-blue-400" />
                <span className="text-gray-400">Total Tickets</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {ticketPurchases.reduce((sum, purchase) => sum + purchase.ticketsPurchased, 0)}
              </p>
            </CompactStack>
          </PuzzlePiece>

          <PuzzlePiece variant="accent" size="md" shape="rounded">
            <CompactStack spacing="sm">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <span className="text-gray-400">Wins</span>
              </div>
              <p className="text-2xl font-bold text-white">0</p>
            </CompactStack>
          </PuzzlePiece>

          <PuzzlePiece variant="secondary" size="md" shape="rounded">
            <CompactStack spacing="sm">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                <span className="text-gray-400">Syndicates</span>
              </div>
              <p className="text-2xl font-bold text-white">0</p>
            </CompactStack>
          </PuzzlePiece>
        </div>

        {/* Transaction History */}
        <CompactSection spacing="lg">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-white" />
            <h2 className="text-xl font-bold text-white">Transaction History</h2>
          </div>
          <TransactionHistory
            transactions={ticketPurchases}
            loading={loading}
            error={error}
            onRetry={() => window.location.reload()}
            onViewTransaction={handleViewTransaction}
          />
        </CompactSection>
      </CompactStack>
    </CompactContainer>
  );
}