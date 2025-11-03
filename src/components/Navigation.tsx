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

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/shared/components/ui/Button';
import { CompactFlex } from '@/shared/components/premium/CompactLayout';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { useWalletContext } from '@/context/WalletContext';
import WalletInfo from './wallet/WalletInfo';
import { Home, Ticket, Users, Menu, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface NavigationProps {
    className?: string;
}

export default function Navigation({ className = '' }: NavigationProps) {
    const pathname = usePathname();
    const { isConnected } = useWalletConnection();
    const { state: walletState } = useWalletContext();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showWalletDetails, setShowWalletDetails] = useState(false);
    const walletDetailsRef = useRef<HTMLDivElement>(null);

    const navigationItems = [
        {
            href: '/',
            label: 'Home',
            icon: Home,
            active: pathname === '/',
        },
        {
            href: '/my-tickets',
            label: 'My Tickets',
            icon: Ticket,
            active: pathname === '/my-tickets',
            requiresWallet: true,
        },
        {
            href: '/syndicates',
            label: 'Syndicates',
            icon: Users,
            active: pathname === '/syndicates',
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

    const handleWalletStatusClick = () => {
        setShowWalletDetails(!showWalletDetails);
    };

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
                                        <Button
                                            variant={item.active ? "default" : "ghost"}
                                            size="sm"
                                            className={`
                        flex items-center gap-2 transition-all duration-200
                        ${item.active
                                                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                                                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                                                }
                      `}
                                        >
                                            <Icon size={16} />
                                            {item.label}
                                        </Button>
                                    </Link>
                                );
                            })}
                        </CompactFlex>

                        {/* Wallet Status & Terms */}
                        <CompactFlex align="center" gap="md">
                        {/* Terms Link */}
                        <Button
                        variant="ghost"
                            size="sm"
                                onClick={() => window.open('https://docs.megapot.io/terms-of-service', '_blank')}
                                className="text-gray-400 hover:text-white text-xs"
                            >
                                Terms
                            </Button>

                            {/* Wallet Status Indicator */}
                            {isConnected ? (
                                <div className="relative">
                                <div
                                   className="flex items-center gap-2 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full cursor-pointer hover:bg-green-500/30 transition-colors"
                                       onClick={handleWalletStatusClick}
                                    >
                                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                                        <span className="text-green-400 text-sm font-semibold">Connected</span>
                                    </div>
                            {showWalletDetails && (
                            <div
                            ref={walletDetailsRef}
                            className="absolute top-full right-0 mt-2 z-50"
                            >
                            <WalletInfo
                            showFullAddress={false}
                            showNetworkIndicator={true}
                            className="w-80"
                            />
                            </div>
                            )}
                            </div>
                            ) : (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => window.location.href = '/wallet-test'}
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
                            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
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
                                            <Button
                                                variant={item.active ? "default" : "ghost"}
                                                size="sm"
                                                className={`
                          w-full justify-start gap-3 transition-all duration-200
                          ${item.active
                                                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                                                        : 'text-gray-300 hover:text-white hover:bg-white/10'
                                                    }
                        `}
                                            >
                                                <Icon size={16} />
                                                {item.label}
                                            </Button>
                                        </Link>
                                    );
                                })}

                                {/* Terms & Wallet Status */}
                                <div className="space-y-3 mt-4 pt-4 border-t border-white/10">
                                    {/* Terms Link */}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => window.open('https://docs.megapot.io/terms-of-service', '_blank')}
                                        className="w-full justify-center text-gray-400 hover:text-white text-xs"
                                    >
                                        📋 Terms of Service
                                    </Button>

                                    {/* Wallet Status */}
                                    {isConnected ? (
                                        <div className="flex items-center gap-2 px-3 py-2 bg-green-500/20 border border-green-500/30 rounded-lg">
                                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                                            <span className="text-green-400 text-sm font-semibold">Wallet Connected</span>
                                        </div>
                                    ) : (
                                        <Button
                                            variant="default"
                                            size="sm"
                                            onClick={() => window.location.href = '/wallet-test'}
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
        </>
    );
}