/**
 * SHARING SERVICE
 *
 * Handles social media sharing integrations with Neynar (Farcaster) and direct platform URLs
 * Note: Memory Protocol API is read-only and not used for content sharing
 *
 * Core Principles Applied:
 * - MODULAR: Independent service for sharing functionality
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

class SharingService {
  private readonly neynarApiUrl = 'https://api.neynar.com/v2';
  private readonly neynarApiKey = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

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
export const sharingService = new SharingService();

// Export class for testing
export { SharingService };
