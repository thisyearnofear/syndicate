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
* MODULAR: Activity Feed Puzzle Piece with Social Personalization
*/
export function ActivityFeedPiece() {
    const [hoveredActivity, setHoveredActivity] = useState<number | null>(null);
    const [personalizedActivities, setPersonalizedActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(false);
    const { address, isConnected } = useWalletConnection();

    useEffect(() => {
        const defaultActivities = [
            { text: "Sarah joined Ocean Warriors", icon: "🌊", time: "2m ago" },
            { text: "Climate Network won $500", icon: "🌍", time: "5m ago" },
            { text: "Education Alliance milestone", icon: "📚", time: "8m ago" },
            { text: "Food Security raised $1.2K", icon: "🌾", time: "12m ago" },
        ];

        const loadPersonalizedActivities = async () => {
            if (!isConnected || !address) {
                setPersonalizedActivities(defaultActivities);
                return;
            }

            setLoading(true);
            try {
                // Get user's identity to personalize activities
                const identity = await socialService.getUserIdentity(address);

                // Generate personalized activities based on user's social context
                const activities = [...defaultActivities];

                if (identity?.farcaster) {
                    // Add personalized activities for Farcaster users
                    activities.unshift({
                        text: `${identity.farcaster.displayName} connected their Farcaster`,
                        icon: "💜",
                        time: "just now"
                    });
                }

                if (identity?.twitter) {
                    // Add personalized activities for Twitter users
                    activities.splice(1, 0, {
                        text: `${identity.twitter.displayName} joined the lottery community`,
                        icon: "🐦",
                        time: "1m ago"
                    });
                }

                // Add social proof based on follower counts
                const totalFollowers = (identity?.farcaster?.followerCount || 0) + (identity?.twitter?.followerCount || 0);
                if (totalFollowers > 100) {
                    activities.splice(2, 0, {
                        text: `${totalFollowers.toLocaleString()}+ community members active`,
                        icon: "👥",
                        time: "3m ago"
                    });
                }

                setPersonalizedActivities(activities);
            } catch (error) {
                console.error('Failed to load personalized activities:', error);
                setPersonalizedActivities(defaultActivities);
            } finally {
                setLoading(false);
            }
        };

        loadPersonalizedActivities();
    }, [address, isConnected]);

    const activities = loading ? [] : personalizedActivities;

    return (
        <PuzzlePiece
            variant="accent"
            size="lg"
            shape="organic"
            className="hover-glow"
        >
            <CompactStack spacing="md">
                <div className="flex flex-col space-y-4 items-stretch">
                    <h2 className="font-bold text-lg md:text-4xl lg:text-5xl leading-tight tracking-tight text-white">
                        Live Activity
                    </h2>
                    <CompactFlex align="center" gap="sm">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    </CompactFlex>
                </div>

                <div className="flex flex-col space-y-2 items-stretch">
                    {activities.map((activity, index) => (
                        <div
                            key={index}
                            className={`glass p-3 rounded-lg hover-scale animate-fade-in-up stagger-${index + 1
                                } transition-all duration-300 ${hoveredActivity === index
                                    ? "ring-1 ring-white/30 bg-white/5"
                                    : ""
                                }`}
                            onMouseEnter={() => setHoveredActivity(index)}
                            onMouseLeave={() => setHoveredActivity(null)}
                        >
                            <CompactFlex align="center" gap="sm">
                                <span className="text-xl transition-transform duration-300 hover:scale-125">
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
            </CompactStack>
        </PuzzlePiece>
    );
}
