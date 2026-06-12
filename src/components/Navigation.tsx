"use client";

/**
 * NAVIGATION COMPONENT
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Built on existing UI patterns
 * - MODULAR: Reusable navigation component
 * - CLEAN: Clear navigation structure
 * - PERFORMANT: Minimal re-renders
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/shared/components/ui/Button';
import { CompactFlex } from '@/shared/components/premium/CompactLayout';
import { useUnifiedWallet } from '@/hooks';
import { WalletType } from '@/domains/wallet/types';
import WalletInfo from './wallet/WalletInfo';
import UnifiedModal from './modal/UnifiedModal';
import WalletConnectionOptions from './wallet/WalletConnectionOptions';
import { Home, Users, TrendingUp, Menu, X, ArrowLeftRight, LayoutDashboard, Settings } from 'lucide-react';

interface NavigationProps {
    className?: string;
}

export default function Navigation({ className = '' }: NavigationProps) {
    const pathname = usePathname();
    const { isConnected, walletType, chain, connect } = useUnifiedWallet();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showWalletDetails, setShowWalletDetails] = useState(false);
    const [showWalletModal, setShowWalletModal] = useState(false);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
    const walletPillRef = useRef<HTMLDivElement>(null);
    const walletDetailsRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMounted(true);
    }, []);

    // Recalculate dropdown position when toggling
    const handleWalletStatusClick = useCallback(() => {
        if (!showWalletDetails && walletPillRef.current) {
            const rect = walletPillRef.current.getBoundingClientRect();
            setDropdownPos({
                top: rect.bottom + 8,
                right: window.innerWidth - rect.right,
            });
        }
        setShowWalletDetails(!showWalletDetails);
    }, [showWalletDetails]);

    const handleWalletConnect = useCallback(async (walletType: WalletType) => {
        try {
            await connect(walletType);
            setShowWalletModal(false);
        } catch (error) {
            console.error("Connection failed:", error);
        }
    }, [connect]);

    // Determine if Bridge should be emphasized in nav
    const shouldShowBridge = pathname !== '/bridge';

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

    const navigationItems = [
        {
            href: '/',
            label: 'Home',
            icon: Home,
            active: pathname === '/',
        },
        {
            href: '/portfolio',
            label: 'Portfolio',
            icon: LayoutDashboard,
            active: pathname === '/portfolio',
            requiresWallet: true,
        },
        {
            href: '/discover',
            label: 'Syndicates',
            icon: Users,
            active: pathname === '/discover',
        },
        {
            href: '/vaults',
            label: 'Vaults',
            icon: TrendingUp,
            active: pathname === '/vaults' || pathname === '/yield-strategies',
        },
        // Bridge (secondary journey): discoverable, minimal logic here
        // Clean + DRY: single place to define nav items
        ...(shouldShowBridge
            ? [{
                href: '/bridge',
                label: 'Bridge',
                icon: ArrowLeftRight,
                active: pathname === '/bridge',
            }]
            : []),
        {
            href: '/settings',
            label: 'Settings',
            icon: Settings,
            active: pathname === '/settings',
        },
    ];

    const visibleItems = navigationItems.filter(item =>
        !item.requiresWallet || (item.requiresWallet && isConnected)
    );

    // Handle click outside to close wallet details
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (walletDetailsRef.current && !walletDetailsRef.current.contains(event.target as Node)) {
                setShowWalletDetails(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <>
            {/* Desktop Navigation */}
            <nav className={`hidden md:block ${className}`}>
                <div className="glass-premium rounded-2xl p-4 border border-white/20">
                    <CompactFlex align="center" gap="md">
                        {/* Logo */}
                        <Link href="/" className="flex items-center gap-2 mr-6">
                            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">S</span>
                            </div>
                            <span className="font-bold text-white text-lg">Syndicate</span>
                        </Link>

                        {/* Navigation Items */}
                        <CompactFlex align="center" gap="sm" className="flex-1">
                            {visibleItems.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <Link key={item.href} href={item.href}>
                                        <button
                                            title={item.label === 'Bridge' ? 'Fund Base-native vaults and strategies from external chains' : item.label}
                                            className={`
                            flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium
                            ${item.active
                                                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                                                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                                                }
                            `}
                                        >
                                            <Icon className="w-4 h-4" />
                                            <span className="hidden lg:inline">{item.label}</span>
                                        </button>
                                    </Link>
                                );
                            })}
                        </CompactFlex>

                        {/* Wallet Status */}
                        <CompactFlex align="center" gap="md">
                            {isConnected ? (
                                <div className="relative flex items-center">
                                    <div
                                        ref={walletPillRef}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-full cursor-pointer hover:bg-green-500/30 transition-colors"
                                        onClick={handleWalletStatusClick}
                                    >
                                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                                        <span className="text-green-400 text-sm font-semibold">
                                            {getWalletIcon()} {getChainLabel()}
                                        </span>
                                    </div>
                                    {mounted && showWalletDetails && createPortal(
                                        <div
                                            ref={walletDetailsRef}
                                            className="fixed wallet-dropdown z-[100001]"
                                            style={{ top: dropdownPos.top, right: dropdownPos.right }}
                                        >
                                            <WalletInfo
                                                showFullAddress={false}
                                                showNetworkIndicator={true}
                                                className="w-80 shadow-2xl border border-white/20 bg-slate-900/95 backdrop-blur-xl"
                                            />
                                        </div>,
                                        document.body
                                    )}
                                </div>
                            ) : (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowWalletModal(true)}
                                    className="text-gray-400 hover:text-white text-sm"
                                >
                                    Connect Wallet
                                </Button>
                            )}
                        </CompactFlex>
                    </CompactFlex>
                </div>
            </nav>

            {/* Mobile Navigation */}
            <nav className={`md:hidden ${className}`}>
                <div className="glass-premium rounded-2xl p-4 border border-white/20">
                    <CompactFlex align="center" justify="between">
                        {/* Logo */}
                        <Link href="/" className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">S</span>
                            </div>
                            <span className="font-bold text-white text-lg">Syndicate</span>
                        </Link>

                        {/* Mobile Menu Button */}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="text-gray-300 hover:text-white"
                        >
                            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </Button>
                    </CompactFlex>

                    {/* Mobile Menu */}
                    {isMobileMenuOpen && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                            <div className="space-y-2">
                                {visibleItems.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                        >
                                            <button
                                                aria-label={item.label === 'Bridge' ? 'Bridge USDC to Base-native vaults and strategies' : undefined}
                                                className={`
                                w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-left
                                ${item.active
                                                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                                                        : 'text-gray-300 hover:text-white hover:bg-white/10'
                                                    }
                                `}
                                            >
                                                <Icon className="w-4 h-4" />
                                                {item.label}
                                            </button>
                                        </Link>
                                    );
                                })}

                                {/* Wallet Status */}
                                <div className="space-y-3 mt-4 pt-4 border-t border-white/10">
                                    {isConnected ? (
                                        <div className="flex items-center gap-2 px-3 py-2 bg-green-500/20 border border-green-500/30 rounded-lg">
                                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                                            <span className="text-green-400 text-sm font-semibold">Wallet Connected</span>
                                        </div>
                                    ) : (
                                        <Button
                                            variant="default"
                                            size="sm"
                                            onClick={() => setShowWalletModal(true)}
                                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                                        >
                                            🔗 Connect Wallet
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </nav>

            {/* Enhanced Wallet Modal */}
            <UnifiedModal
                isOpen={showWalletModal}
                onClose={() => setShowWalletModal(false)}
                title="Connect Wallet"
                maxWidth="lg"
            >
                <WalletConnectionOptions
                    onWalletConnect={handleWalletConnect}
                />
            </UnifiedModal>
        </>
    );
}
