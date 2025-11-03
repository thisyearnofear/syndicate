"use client";

import { useState, useEffect } from 'react';
import { PuzzlePiece } from '@/shared/components/premium/PuzzlePiece';
import { CompactStack } from '@/shared/components/premium/CompactLayout';

/**
 * MODULAR: Community Insights Puzzle Piece
 */
export function CommunityInsightsPiece({ userIdentity }: { userIdentity: any }) {
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadCommunityInsights = async () => {
      if (!userIdentity) return;

      setLoading(true);
      try {
        // Generate insights based on user's social profile
        const userInsights = [];

        // Add insights based on follower counts
        const totalFollowers = (userIdentity.farcaster?.followerCount || 0) + (userIdentity.twitter?.followerCount || 0);
        if (totalFollowers > 1000) {
          userInsights.push({
            icon: "🌟",
            title: "High Influence",
            description: `${totalFollowers.toLocaleString()}+ followers across platforms`,
            color: "text-yellow-400"
          });
        } else if (totalFollowers > 100) {
          userInsights.push({
            icon: "👥",
            title: "Growing Network",
            description: `${totalFollowers.toLocaleString()}+ community connections`,
            color: "text-blue-400"
          });
        }

        // Add insights based on verification status
        const verifiedPlatforms = [userIdentity.farcaster?.verified, userIdentity.twitter?.verified].filter(Boolean).length;
        if (verifiedPlatforms > 0) {
          userInsights.push({
            icon: "✅",
            title: "Verified Identity",
            description: `Verified on ${verifiedPlatforms} platform${verifiedPlatforms > 1 ? 's' : ''}`,
            color: "text-green-400"
          });
        }

        // Add insights based on platform activity
        if (userIdentity.farcaster) {
          userInsights.push({
            icon: "💜",
            title: "Web3 Native",
            description: "Active in the decentralized social space",
            color: "text-purple-400"
          });
        }

        if (userIdentity.twitter) {
          userInsights.push({
            icon: "🐦",
            title: "Traditional Social",
            description: "Connected to broader social networks",
            color: "text-blue-400"
          });
        }

        // Add lottery/web3 relevance insight
        userInsights.push({
          icon: "🎫",
          title: "Lottery Enthusiast",
          description: "Part of the growing lottery community",
          color: "text-orange-400"
        });

        setInsights(userInsights);
      } catch (error) {
        console.error('Failed to load community insights:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCommunityInsights();
  }, [userIdentity]);

  if (loading || insights.length === 0) {
    return null;
  }

  return (
  <PuzzlePiece variant="secondary" size="md" shape="rounded" glow>
  <CompactStack spacing="md">
  <div className="flex items-center gap-2">
  <span className="text-lg">📊</span>
  <h3 className="font-semibold text-white">Community Insights</h3>
  </div>

  <div className="grid grid-cols-1 gap-3">
  {insights.slice(0, 3).map((insight, index) => (
  <div key={index} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
  <span className={`text-xl ${insight.color}`}>{insight.icon}</span>
  <div className="flex-1">
  <p className={`font-medium ${insight.color}`}>{insight.title}</p>
  <p className="text-xs text-gray-400">{insight.description}</p>
  </div>
  </div>
  ))}
  </div>

  <p className="text-xs text-gray-400 text-center">
  Your social profile enhances trust and discovery
  </p>
  </CompactStack>
  </PuzzlePiece>
  );
}
