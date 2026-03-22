"use client";

import { useState, useEffect } from 'react';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { socialService } from '@/services/socialService';
import { PuzzlePiece } from '@/shared/components/premium/PuzzlePiece';
import { CompactStack, CompactFlex } from '@/shared/components/premium/CompactLayout';

interface Activity {
  text: string;
  icon: string;
  time: string;
}

/**
 * MODULAR: Activity Feed Puzzle Piece — only shows real data
 */
export function ActivityFeedPiece() {
    const [hoveredActivity, setHoveredActivity] = useState<number | null>(null);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(false);
    const { address, isConnected } = useWalletConnection();

    useEffect(() => {
        const loadActivities = async () => {
            if (!isConnected || !address) {
                setActivities([]);
                return;
            }

            setLoading(true);
            try {
                const identity = await socialService.getUserIdentity(address);
                const realActivities: Activity[] = [];

                if (identity?.farcaster) {
                    realActivities.push({
                        text: `Connected as @${identity.farcaster.username}`,
                        icon: "💜",
                        time: "now"
                    });
                }

                if (identity?.twitter) {
                    realActivities.push({
                        text: `Connected as @${identity.twitter.username}`,
                        icon: "🐦",
                        time: "now"
                    });
                }

                setActivities(realActivities);
            } catch (error) {
                console.error('Failed to load activities:', error);
                setActivities([]);
            } finally {
                setLoading(false);
            }
        };

        loadActivities();
    }, [address, isConnected]);

    // Don't render if no connected user or no real activities
    if (!isConnected || (!loading && activities.length === 0)) {
        return null;
    }

    return (
        <PuzzlePiece
            variant="accent"
            size="lg"
            shape="organic"
            className="hover-glow"
        >
            <CompactStack spacing="md">
                <CompactFlex align="center" gap="sm">
                    <h2 className="font-bold text-lg text-white">
                        Your Activity
                    </h2>
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                </CompactFlex>

                {loading ? (
                    <div className="text-sm text-gray-400">Loading...</div>
                ) : (
                    <div className="flex flex-col space-y-2 items-stretch">
                        {activities.map((activity, index) => (
                            <div
                                key={index}
                                className={`glass p-3 rounded-lg hover-scale transition-all duration-300 ${
                                    hoveredActivity === index
                                        ? "ring-1 ring-white/30 bg-white/5"
                                        : ""
                                }`}
                                onMouseEnter={() => setHoveredActivity(index)}
                                onMouseLeave={() => setHoveredActivity(null)}
                            >
                                <CompactFlex align="center" gap="sm">
                                    <span className="text-xl">
                                        {activity.icon}
                                    </span>
                                    <div className="flex-1">
                                        <p className="text-sm text-white leading-relaxed">
                                            {activity.text}
                                        </p>
                                        <p className="text-xs text-gray-500 leading-relaxed">
                                            {activity.time}
                                        </p>
                                    </div>
                                </CompactFlex>
                            </div>
                        ))}
                    </div>
                )}
            </CompactStack>
        </PuzzlePiece>
    );
}
