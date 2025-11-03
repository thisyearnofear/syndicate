/**
 * SHARING SERVICE
 *
 * Handles social media sharing integrations with Memory Protocol and Neynar
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

export interface MemoryProtocolContent {
  title: string;
  description: string;
  url: string;
  image?: string;
  tags?: string[];
}

export interface NeynarCast {
  text: string;
  embeds?: string[];
  channelId?: string;
}

class SharingService {
  private readonly memoryApiUrl = 'https://api.memoryproto.co';
  private readonly neynarApiUrl = 'https://api.neynar.com/v2';
  private readonly neynarApiKey = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

  /**
   * Share content using Memory Protocol
   */
  async shareToMemory(content: MemoryProtocolContent): Promise<ShareResult> {
    try {
      const response = await fetch(`${this.memoryApiUrl}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: content.title,
          description: content.description,
          url: content.url,
          image: content.image,
          tags: content.tags || ['lottery', 'megapot', 'blockchain'],
        }),
      });

      if (!response.ok) {
        throw new Error(`Memory API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        url: data.shareUrl,
      };
    } catch (error) {
      console.error('Memory Protocol sharing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to share to Memory Protocol',
      };
    }
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
    memoryContent: MemoryProtocolContent;
    neynarCast: NeynarCast;
  } {
    const { ticketCount, jackpotAmount, odds, platformUrl } = data;
    const ticketText = ticketCount === 1 ? '1 lottery ticket' : `${ticketCount} lottery tickets`;
    const baseText = `Just bought ${ticketText} for the $${jackpotAmount} jackpot! 🎫✨ Odds: ${odds}`;

    const twitterText = `${baseText} #Megapot #Lottery`;
    const farcasterText = `${baseText} Join the lottery revolution!`;

    const memoryContent: MemoryProtocolContent = {
      title: `Bought ${ticketText} - $${jackpotAmount} Jackpot!`,
      description: `Just purchased lottery tickets with ${odds} odds to win $${jackpotAmount}. Join the blockchain lottery revolution!`,
      url: platformUrl,
      tags: ['lottery', 'megapot', 'blockchain', 'web3', 'jackpot'],
    };

    const neynarCast: NeynarCast = {
      text: farcasterText,
      embeds: [platformUrl],
      channelId: 'megapot',
    };

    return {
      twitterText,
      farcasterText,
      memoryContent,
      neynarCast,
    };
  }
}

// Export singleton instance
export const sharingService = new SharingService();

// Export class for testing
export { SharingService };
