"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/shared/components/ui/Button';
import { useUnifiedWallet, useIsMounted } from '@/hooks';
import { WalletType } from '@/domains/wallet/types';
import WalletInfo from './wallet/WalletInfo';
import UnifiedModal from './modal/UnifiedModal';
import WalletConnectionOptions from './wallet/WalletConnectionOptions';
import {
  Ticket, Users, TrendingUp, Menu, X,
  ArrowLeftRight, LayoutDashboard, Settings, ChevronDown, Bot,
} from 'lucide-react';

// ─── Config ─────────────────────────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Small status chip (e.g. "Testnet") rendered next to the label. */
  flag?: string;
  requiresWallet?: boolean;
}

const PRIMARY_NAV: NavItem[] = [
  { href: '/', label: 'Play', icon: Ticket },
  { href: '/vaults', label: 'Grow', icon: TrendingUp },
  { href: '/coordinate', label: 'Coordinate', icon: Users },
  // Experimental engine, framed by what it does (AI-run prize pool), not by
  // chain jargon. Always flagged as testnet (honesty contract).
  { href: '/xlayer', label: 'Agent Pool', icon: Bot, flag: 'Testnet' },
];

const SECONDARY_NAV: NavItem[] = [
  { href: '/portfolio', label: 'Portfolio', icon: LayoutDashboard, requiresWallet: true },
  { href: '/bridge', label: 'Fund', icon: ArrowLeftRight },
  { href: '/settings', label: 'Settings', icon: Settings },
];

// ─── Component ──────────────────────────────────────────────────────────────

interface NavigationProps {
  className?: string;
}

export default function Navigation({ className = '' }: NavigationProps) {
  const pathname = usePathname();
  const { isConnected, walletType, chain, connect } = useUnifiedWallet();
  const mounted = useIsMounted();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletDetailsOpen, setWalletDetailsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });

  const walletPillRef = useRef<HTMLButtonElement>(null);
  const walletDetailsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleWalletConnect = useCallback(async (wt: WalletType) => {
    try {
      await connect(wt);
      setShowWalletModal(false);
    } catch (error) {
      console.error("Connection failed:", error);
    }
  }, [connect]);

  const handleWalletPillClick = useCallback(() => {
    if (!walletDetailsOpen && walletPillRef.current) {
      const rect = walletPillRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    setWalletDetailsOpen((v) => !v);
  }, [walletDetailsOpen]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (walletDetailsRef.current && !walletDetailsRef.current.contains(e.target as Node)) {
        setWalletDetailsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ─── Helpers ────────────────────────────────────────────────────────────

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname?.startsWith(href) ?? false;
  };

  const getWalletIcon = () => {
    switch (walletType) {
      case 'evm': return '🔗';
      case 'solana': return '👻';
      case 'near': return '🌌';
      case 'stacks': return '₿';
      case 'starknet': return '⚡';
      default: return '💼';
    }
  };

  const getChainLabel = () => {
    switch (chain) {
      case 'stacks': return 'Stacks';
      case 'solana': return 'Solana';
      case 'near': return 'NEAR';
      case 'ton': return 'TON';
      case 'starknet': return 'Starknet';
      case 'evm': return 'EVM';
      default: return '';
    }
  };

  const secondaryItems = SECONDARY_NAV.filter(
    (item) => !('requiresWallet' in item && item.requiresWallet) || isConnected
  );

  // ─── Desktop ────────────────────────────────────────────────────────────

  return (
    <>
      {/* Desktop */}
      <nav className={`hidden md:block ${className}`} aria-label="Main navigation">
        <div className="flex items-center justify-between py-3 px-1">
          {/* Left: Logo + primary links */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2" aria-label="Syndicate home">
              <div className="w-7 h-7 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">S</span>
              </div>
              <span className="font-bold text-white text-lg">Syndicate</span>
            </Link>

            <div className="flex items-center gap-1">
              {PRIMARY_NAV.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 ${
                      active
                        ? 'bg-white/10 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                    {'flag' in item && (
                      <span className="rounded-full border border-amber-400/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300/80">
                        {item.flag}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right: Wallet + user menu */}
          <div className="flex items-center gap-3">
            {isConnected ? (
              <>
                <button
                  type="button"
                  ref={walletPillRef}
                  className="flex items-center gap-2 px-3 py-1.5 bg-green-500/15 border border-green-500/25 rounded-full hover:bg-green-500/25 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80"
                  onClick={handleWalletPillClick}
                  aria-expanded={walletDetailsOpen}
                  aria-label="Wallet details"
                >
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-green-400 text-sm font-medium">
                    {getWalletIcon()} {getChainLabel()}
                  </span>
                </button>

                {/* User menu (secondary nav) */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80"
                    onClick={() => setUserMenuOpen((v) => !v)}
                    aria-expanded={userMenuOpen}
                    aria-label="More navigation"
                  >
                    <Menu className="w-4 h-4" />
                    <ChevronDown className={`w-3 h-3 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900/95 border border-white/10 rounded-xl shadow-2xl backdrop-blur-xl py-1 z-50">
                      {secondaryItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setUserMenuOpen(false)}
                            className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                              isActive(item.href)
                                ? 'text-white bg-white/5'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            {item.label}
                            {'flag' in item && (
                              <span className="ml-auto rounded-full border border-amber-400/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300/80">
                                {item.flag}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowWalletModal(true)}
                className="text-gray-400 hover:text-white border border-white/10 hover:border-white/20 text-sm"
              >
                Connect Wallet
              </Button>
            )}
          </div>
        </div>

        {/* Wallet details portal */}
        {mounted && walletDetailsOpen && createPortal(
          <div
            ref={walletDetailsRef}
            className="fixed z-[100001]"
            style={{ top: dropdownPos.top, right: dropdownPos.right }}
          >
            <WalletInfo
              showFullAddress={false}
              showNetworkIndicator={true}
              className="w-80 shadow-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl rounded-xl"
            />
          </div>,
          document.body
        )}
      </nav>

      {/* ─── Mobile ──────────────────────────────────────────────────────── */}
      <nav className={`md:hidden ${className}`} aria-label="Main navigation">
        <div className="flex items-center justify-between py-3 px-1">
          <Link href="/" className="flex items-center gap-2" aria-label="Syndicate home">
            <div className="w-7 h-7 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">S</span>
            </div>
            <span className="font-bold text-white text-lg">Syndicate</span>
          </Link>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            className="min-h-11 min-w-11 touch-manipulation text-gray-300 hover:text-white"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {mobileOpen && (
          <div className="pb-4 pt-2 border-t border-white/10 space-y-1">
            {/* Primary */}
            {PRIMARY_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors touch-manipulation ${
                    isActive(item.href)
                      ? 'bg-white/10 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                  {'flag' in item && (
                    <span className="ml-auto rounded-full border border-amber-400/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300/80">
                      {item.flag}
                    </span>
                  )}
                </Link>
              );
            })}

            {/* Divider */}
            <div className="border-t border-white/5 my-2" />

            {/* Secondary */}
            {secondaryItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors touch-manipulation ${
                    isActive(item.href)
                      ? 'bg-white/5 text-white'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                  {'flag' in item && (
                    <span className="ml-auto rounded-full border border-amber-400/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300/80">
                      {item.flag}
                    </span>
                  )}
                </Link>
              );
            })}

            {/* Wallet */}
            <div className="pt-3 border-t border-white/5">
              {isConnected ? (
                <div className="flex items-center gap-2 px-4 py-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-green-400 text-sm font-medium">
                    {getWalletIcon()} {getChainLabel()} connected
                  </span>
                </div>
              ) : (
                <Button
                  variant="premium"
                  size="sm"
                  onClick={() => setShowWalletModal(true)}
                  className="w-full min-h-12 touch-manipulation"
                >
                  Connect Wallet
                </Button>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Wallet connect modal */}
      <UnifiedModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        title="Connect Wallet"
        maxWidth="lg"
      >
        <WalletConnectionOptions onWalletConnect={handleWalletConnect} />
      </UnifiedModal>
    </>
  );
}
