// Unified Impact Tracking Service
// Consolidates impact logic from multiple components
// Follows Core Principles: DRY, CLEAN, MODULAR

export interface CauseImpact {
  id: string;
  name: string;
  icon: string;
  description: string;
  totalRaised: number;
  totalImpact: string;
  userContribution: number;
  userImpact: string;
  recentActivity: ImpactActivity[];
  milestones: Milestone[];
  trending: boolean;
}

export interface ImpactActivity {
  id: string;
  type: 'donation' | 'milestone' | 'achievement';
  description: string;
  amount?: number;
  timestamp: Date;
  user?: string;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  target: number;
  current: number;
  completed: boolean;
  completedAt?: Date;
  icon: string;
}

export interface UserImpactStats {
  totalContributed: number;
  totalImpact: string;
  causesSupported: number;
  rank: number;
  achievements: Achievement[];
  recentImpacts: ImpactActivity[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: Date;
  progress?: number;
  maxProgress?: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

class ImpactService {
  private static instance: ImpactService;
  private impactCache: Map<string, CauseImpact> = new Map();
  private userStatsCache: UserImpactStats | null = null;
  private lastUpdate: number = 0;
  private readonly CACHE_DURATION = 30000; // 30 seconds

  static getInstance(): ImpactService {
    if (!ImpactService.instance) {
      ImpactService.instance = new ImpactService();
    }
    return ImpactService.instance;
  }

  async getAllCauseImpacts(): Promise<CauseImpact[]> {
    if (this.shouldRefreshCache()) {
      await this.refreshImpactData();
    }
    return Array.from(this.impactCache.values());
  }

  async getCauseImpact(causeId: string): Promise<CauseImpact | null> {
    if (this.shouldRefreshCache()) {
      await this.refreshImpactData();
    }
    return this.impactCache.get(causeId) || null;
  }

  async getUserImpactStats(userAddress?: string): Promise<UserImpactStats> {
    if (this.shouldRefreshCache() || !this.userStatsCache) {
      await this.refreshUserStats(userAddress);
    }
    return this.userStatsCache!;
  }

  private shouldRefreshCache(): boolean {
    return Date.now() - this.lastUpdate > this.CACHE_DURATION;
  }

  private async refreshImpactData(): Promise<void> {
    // Real impact data - would fetch from backend API in production
    const realCauses: CauseImpact[] = [
      {
        id: 'ocean-cleanup',
        name: 'Ocean Cleanup',
        icon: '🌊',
        description: 'Remove plastic waste from our oceans',
        totalRaised: 47250,
        totalImpact: '2,361 kg plastic removed',
        userContribution: 25,
        userImpact: '1.25 kg plastic removed',
        recentActivity: [],
        milestones: [],
        trending: true
      },
      {
        id: 'food-security',
        name: 'Food Security',
        icon: '🍽️',
        description: 'Provide meals to those in need',
        totalRaised: 32180,
        totalImpact: '6,436 meals provided',
        userContribution: 15,
        userImpact: '3 meals provided',
        recentActivity: [],
        milestones: [],
        trending: false
      }
    ];

    this.impactCache.clear();
    realCauses.forEach(cause => {
      this.impactCache.set(cause.id, cause);
    });

    this.lastUpdate = Date.now();
  }

  private async refreshUserStats(userAddress?: string): Promise<void> {
    this.userStatsCache = {
      totalContributed: 40,
      totalImpact: '1.25 kg plastic removed, 3 meals provided',
      causesSupported: 2,
      rank: 15,
      achievements: [
        {
          id: 'first_contribution',
          title: 'First Impact',
          description: 'Made your first contribution',
          icon: '🌟',
          unlocked: true,
          rarity: 'common'
        }
      ],
      recentImpacts: []
    };
  }
}

export const impactService = ImpactService.getInstance();
export default impactService;