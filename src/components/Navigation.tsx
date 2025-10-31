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
import { Home, Ticket, Users, Menu, X } from 'lucide-react';
import { useState } from 'react';

interface NavigationProps {
    className?: string;
}

export default function Navigation({ className = '' }: NavigationProps) {
    const pathname = usePathname();
    const { isConnected } = useWalletConnection();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

                        {/* Wallet Status Indicator */}
                        {isConnected && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full">
                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                                <span className="text-green-400 text-sm font-semibold">Connected</span>
                            </div>
                        )}
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

                                {/* Wallet Status */}
                                {isConnected && (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-green-500/20 border border-green-500/30 rounded-lg mt-4">
                                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                                        <span className="text-green-400 text-sm font-semibold">Wallet Connected</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </nav>
        </>
    );
}