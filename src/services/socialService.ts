/**
 * SOCIAL SERVICE
 *
 * Handles social media integrations including sharing (Neynar/Farcaster/Twitter)
 * and identity/social graph data (Memory Protocol)
 *
 * Core Principles Applied:
 * - MODULAR: Independent service for social functionality
 * - CLEAN: Clear API interfaces
 * - PERFORMANT: Async operations with proper error handling
 */

export interface ShareResult {
  success: boolean;
  url?: string;
  error?: string;
}

// Note: Memory Protocol API is read-only for identity/social graph data
// Content sharing is handled via direct platform URLs

export interface NeynarCast {
  text: string;
  embeds?: string[];
  channelId?: string;
}

export interface MemoryIdentity {
  wallet: string;
  farcaster?: {
    username: string;
    displayName: string;
    followerCount: number;
    followingCount: number;
    verified: boolean;
  };
  twitter?: {
    username: string;
    displayName: string;
    followerCount: number;
    followingCount: number;
    verified: boolean;
  };
  lens?: {
    username: string;
    displayName: string;
  };
  zora?: {
    username: string;
    displayName: string;
  };
}

export interface SocialDiscoveryResult {
  platform: 'farcaster' | 'twitter';
  username: string;
  displayName: string;
  followerCount: number;
  followingCount: number;
  verified: boolean;
  relevance: 'high' | 'medium' | 'low'; // Based on lottery/web3 activity
}

type TwitterUser = {
  username: string;
  displayName?: string;
  description?: string;
  followerCount?: number;
  followingCount?: number;
  verified?: boolean;
};

type TwitterFollowingResponse = {
  following?: TwitterUser[];
};

type FarcasterUser = {
  username: string;
  profile?: { displayName?: string; bio?: { text?: string } };
  followerCount?: number;
  followingCount?: number;
  verified?: boolean;
};

type FarcasterFollowingResponse = {
  following?: FarcasterUser[];
};

class SocialService {
  private readonly neynarApiUrl = 'https://api.neynar.com/v2';
  private readonly neynarApiKey = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;
  private readonly memoryApiUrl = 'https://api.memoryproto.co';
  private readonly memoryApiKey = process.env.NEXT_PUBLIC_MEMORY_API_KEY;
  private memoryWarningShown = false;

  /**
   * Get user identity graph from Memory Protocol
   */
  async getUserIdentity(walletAddress: string): Promise<MemoryIdentity | null> {
    if (!this.memoryApiKey) {
      if (!this.memoryWarningShown) {
        this.memoryWarningShown = true;
        console.info('[Social] Memory API key not configured - social features disabled');
      }
      return null;
    }

    try {
      const response = await fetch(`${this.memoryApiUrl}/identity-graph/wallet/${walletAddress}`, {
        headers: {
          'Authorization': `Bearer ${this.memoryApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          // User not found in identity graph
          return { wallet: walletAddress };
        }
        throw new Error(`Memory API error: ${response.status}`);
      }

      const data = await response.json();

      const identity: MemoryIdentity = {
        wallet: walletAddress,
      };

      // Extract identities from the response
      if (data.farcaster) {
        identity.farcaster = {
          username: data.farcaster.username,
          displayName: data.farcaster.displayName || data.farcaster.username,
          followerCount: data.farcaster.followerCount || 0,
          followingCount: data.farcaster.followingCount || 0,
          verified: data.farcaster.verified || false,
        };
      }

      if (data.twitter) {
        identity.twitter = {
          username: data.twitter.username,
          displayName: data.twitter.displayName || data.twitter.username,
          followerCount: data.twitter.followerCount || 0,
          followingCount: data.twitter.followingCount || 0,
          verified: data.twitter.verified || false,
        };
      }

      if (data.lens) {
        identity.lens = {
          username: data.lens.username,
          displayName: data.lens.displayName || data.lens.username,
        };
      }

      if (data.zora) {
        identity.zora = {
          username: data.zora.username,
          displayName: data.zora.displayName || data.zora.username,
        };
      }

      return identity;
    } catch (error) {
      console.error('Failed to get user identity:', error);
      return null;
    }
  }

  /**
   * Discover potential syndicate members through social graphs
   */
  async discoverPotentialMembers(walletAddress: string): Promise<SocialDiscoveryResult[]> {
    const identity = await this.getUserIdentity(walletAddress);
    if (!identity) return [];

    const results: SocialDiscoveryResult[] = [];

    // Get Twitter connections if user has Twitter
    if (identity.twitter && this.memoryApiKey) {
      try {
        const response = await fetch(`${this.memoryApiUrl}/social-graph/twitter/following/${identity.twitter.username}`, {
          headers: {
            'Authorization': `Bearer ${this.memoryApiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data: TwitterFollowingResponse = await response.json();
          // Filter for web3/lottery related accounts (simplified logic)
          const relevantConnections = (data.following || []).filter((user) => {
            const bio = user.description?.toLowerCase() || '';
            const hasWeb3Keywords = bio.includes('web3') || bio.includes('crypto') || bio.includes('blockchain') || bio.includes('nft');
            const hasLotteryKeywords = bio.includes('lottery') || bio.includes('lotto') || bio.includes('jackpot');
            return hasWeb3Keywords || hasLotteryKeywords;
          });

          relevantConnections.slice(0, 5).forEach((user) => {
            results.push({
              platform: 'twitter',
              username: user.username,
              displayName: user.displayName || user.username,
              followerCount: user.followerCount || 0,
              followingCount: user.followingCount || 0,
              verified: user.verified || false,
              relevance: (user.followerCount ?? 0) > 1000 ? 'high' : (user.followerCount ?? 0) > 100 ? 'medium' : 'low',
            });
          });
        }
      } catch (error) {
        console.error('Failed to get Twitter connections:', error);
      }
    }

    // Get Farcaster connections if user has Farcaster
    if (identity.farcaster && this.memoryApiKey) {
      try {
        const response = await fetch(`${this.memoryApiUrl}/social-graph/farcaster/following/${identity.farcaster.username}`, {
          headers: {
            'Authorization': `Bearer ${this.memoryApiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data: FarcasterFollowingResponse = await response.json();
          // Filter for web3/lottery related accounts
          const relevantConnections = (data.following || []).filter((user) => {
            const bio = user.profile?.bio?.text?.toLowerCase() || '';
            const hasWeb3Keywords = bio.includes('web3') || bio.includes('crypto') || bio.includes('blockchain') || bio.includes('nft');
            const hasLotteryKeywords = bio.includes('lottery') || bio.includes('lotto') || bio.includes('jackpot');
            return hasWeb3Keywords || hasLotteryKeywords;
          });

          relevantConnections.slice(0, 5).forEach((user) => {
            results.push({
              platform: 'farcaster',
              username: user.username,
              displayName: user.profile?.displayName || user.username,
              followerCount: user.followerCount || 0,
              followingCount: user.followingCount || 0,
              verified: user.verified || false,
              relevance: (user.followerCount ?? 0) > 500 ? 'high' : (user.followerCount ?? 0) > 50 ? 'medium' : 'low',
            });
          });
        }
      } catch (error) {
        console.error('Failed to get Farcaster connections:', error);
      }
    }

    // Remove duplicates and sort by relevance
    const uniqueResults = results.filter((result, index, self) =>
      index === self.findIndex(r => r.username === result.username && r.platform === result.platform)
    );

    return uniqueResults.sort((a, b) => {
      const relevanceOrder = { high: 3, medium: 2, low: 1 };
      return relevanceOrder[b.relevance] - relevanceOrder[a.relevance];
    });
  }

  /**
   * Share cast to Farcaster using Neynar
   */
  async shareToFarcaster(cast: NeynarCast): Promise<ShareResult> {
    if (!this.neynarApiKey) {
      console.warn('Neynar API key not configured');
      return {
        success: false,
        error: 'Farcaster sharing not configured',
      };
    }

    try {
      const response = await fetch(`${this.neynarApiUrl}/cast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api_key': this.neynarApiKey,
        },
        body: JSON.stringify({
          text: cast.text,
          embeds: cast.embeds || [],
          channel_id: cast.channelId || 'megapot',
        }),
      });

      if (!response.ok) {
        throw new Error(`Neynar API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        url: `https://warpcast.com/${data.cast.author.username}/${data.cast.hash}`,
      };
    } catch (error) {
      console.error('Farcaster sharing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to share to Farcaster',
      };
    }
  }

  /**
   * Generate Twitter share URL
   */
  generateTwitterUrl(text: string, url?: string): string {
    const params = new URLSearchParams({
      text,
    });

    if (url) {
      params.set('url', url);
    }

    return `https://twitter.com/intent/tweet?${params.toString()}`;
  }

  /**
   * Generate Farcaster share URL (Warpcast compose)
   */
  generateFarcasterUrl(text: string, embeds?: string[]): string {
    const params = new URLSearchParams({
      text,
    });

    if (embeds) {
      embeds.forEach(embed => {
        params.append('embeds[]', embed);
      });
    }

    return `https://warpcast.com/~/compose?${params.toString()}`;
  }

  /**
   * Create lottery-specific share content
   */
  createLotteryShareContent(data: {
    ticketCount: number;
    jackpotAmount: string;
    odds: string;
    platformUrl: string;
  }): {
    twitterText: string;
    farcasterText: string;
    neynarCast: NeynarCast;
  } {
    const { ticketCount, jackpotAmount, odds, platformUrl } = data;
    const ticketText = ticketCount === 1 ? '1 lottery ticket' : `${ticketCount} lottery tickets`;
    const baseText = `Just bought ${ticketText} for the $${jackpotAmount} jackpot! 🎫✨ Odds: ${odds}`;

    const twitterText = `${baseText} #Megapot #Lottery`;
    const farcasterText = `${baseText} Join the lottery revolution!`;

    const neynarCast: NeynarCast = {
      text: farcasterText,
      embeds: [platformUrl],
      channelId: 'megapot',
    };

    return {
      twitterText,
      farcasterText,
      neynarCast,
    };
  }
}

// Export singleton instance
export const socialService = new SocialService();

// Export class for testing
export { SocialService };
