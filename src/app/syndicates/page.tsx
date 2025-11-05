"use client";

/**
 * SYNDICATES PAGE
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Built on existing components and patterns
 * - MODULAR: Reuses existing UI components
 * - CLEAN: Clear syndicate display
 */

import { useState, useEffect, Suspense, lazy } from "react";
import { Button } from "@/shared/components/ui/Button";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import {
    CompactContainer,
    CompactStack,
    CompactSection,
} from "@/shared/components/premium/CompactLayout";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";


// Lazy load the SyndicateCard component
const SyndicateCard = lazy(() => import("@/components/SyndicateCard"));

export default function SyndicatesPage() {
    const [syndicates, setSyndicates] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchSyndicates = async () => {
            try {
                setIsLoading(true);
                const response = await fetch('/api/syndicates');
                if (!response.ok) throw new Error('Failed to fetch syndicates');
                const data = await response.json();
                setSyndicates(data);
            } catch (err) {
                console.error('Error fetching syndicates:', err);
                setError('Failed to load syndicates');
            } finally {
                setIsLoading(false);
            }
        };

        fetchSyndicates();
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
            <CompactContainer maxWidth="2xl" padding="lg">
                <CompactStack spacing="lg">
                    {/* Header */}
                    <div className="pt-8 text-center">
                        <h1 className="font-black text-4xl md:text-6xl bg-gradient-to-r from-purple-400 via-blue-500 to-green-400 bg-clip-text text-transparent">
                            Active Syndicates
                        </h1>
                        <p className="text-xl text-gray-300 mt-2 mb-6">
                            Join forces with others to support causes and increase your chances
                        </p>
                        <div className="flex flex-col sm:flex-row justify-center gap-3">
                            <Link href="/create-syndicate">
                                <Button 
                                    variant="default"
                                    className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                                >
                                    ✨ Create Syndicate
                                </Button>
                            </Link>
                            <Link href="/yield-strategies">
                                <Button 
                                    variant="outline"
                                    className="border-green-500/50 text-green-300 hover:bg-green-500/10"
                                >
                                    💰 Use Yield Strategy
                                </Button>
                            </Link>
                        </div>
                    </div>

                    {/* Syndicates Grid */}
                    <CompactSection spacing="lg">
                        {isLoading ? (
                            <div className="flex justify-center py-12">
                                <LoadingSpinner size="lg" color="white" />
                            </div>
                        ) : error ? (
                            <div className="text-center py-12">
                                <div className="text-6xl mb-4">⚠️</div>
                                <h3 className="font-semibold text-xl text-white mb-2">Error Loading Syndicates</h3>
                                <p className="text-gray-400 mb-6">{error}</p>
                                <Button
                                    variant="default"
                                    size="lg"
                                    onClick={() => window.location.reload()}
                                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                                >
                                    Try Again
                                </Button>
                            </div>
                        ) : syndicates.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="text-6xl mb-4">🌊</div>
                                <h3 className="font-semibold text-xl text-white mb-2">No Active Syndicates</h3>
                                <p className="text-gray-400 mb-6">
                                    Check back later for new syndicate opportunities
                                </p>
                                <Link href="/">
                                    <Button
                                        variant="default"
                                        size="lg"
                                        className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 hover:from-yellow-500 hover:via-orange-600 hover:to-red-600 text-white"
                                    >
                                        Back to Home
                                    </Button>
                                </Link>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {syndicates.map((syndicate) => (
                                    <Suspense
                                        key={syndicate.id}
                                        fallback={
                                            <div className="glass-premium p-6 rounded-xl h-64 animate-pulse bg-gray-700/50" />
                                        }
                                    >
                                        <SyndicateCard
                                            syndicate={syndicate}
                                            onJoin={(id) => console.log('Join syndicate:', id)}
                                            onView={(id) => console.log('View syndicate:', id)}
                                        />
                                    </Suspense>
                                ))}
                            </div>
                        )}
                    </CompactSection>
                </CompactStack>
            </CompactContainer>
        </div>
    );
}