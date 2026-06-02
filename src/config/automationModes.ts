export type AutomationStrategyId = 'scheduled' | 'autonomous' | 'no-loss' | 'yield-autopilot';

export interface AutomationModeMeta {
  id: AutomationStrategyId;
  title: string;
  shortDescription: string;
  configureTitle: string;
  configureDescription: string;
  reviewTitle: string;
  approvalDescriptionEvm: string;
  approvalDescriptionStacks: string;
  successTitle: string;
  successDescriptionEvm: string;
  successDescriptionStacks: string;
  failureDescription: string;
  hubLabel: string;
}

export const AUTOMATION_MODE_META: Record<AutomationStrategyId, AutomationModeMeta> = {
  scheduled: {
    id: 'scheduled',
    title: 'Scheduled Public Play',
    shortDescription: 'Set a fixed amount and frequency for recurring public-play participation on Base.',
    configureTitle: 'Automate Public Play',
    configureDescription: 'Set a recurring schedule for public-play participation on Base.',
    reviewTitle: 'Review Your Public-Play Automation',
    approvalDescriptionEvm: 'This permission lets Syndicate enter public play on your schedule using Base USDC. You can revoke it anytime from settings.',
    approvalDescriptionStacks: 'This authorization lets Syndicate enter public play on your schedule using your Stacks wallet without signing each recurring action.',
    successTitle: 'Public Play Automation Enabled',
    successDescriptionEvm: 'Recurring public-play participation is now active on your schedule. You can manage or revoke it from settings.',
    successDescriptionStacks: 'Your selected token is now authorized for recurring public-play participation without manual signing each time.',
    failureDescription: 'Unable to enable public-play automation',
    hubLabel: 'Public play',
  },
  autonomous: {
    id: 'autonomous',
    title: 'Autonomous Yield Agent',
    shortDescription: 'Let an AI agent time participation using yield-aware or opportunistic logic.',
    configureTitle: 'Configure Autonomous Participation',
    configureDescription: 'Fund an AI-driven participation agent that decides when to enter based on better timing.',
    reviewTitle: 'Review Your Autonomous Setup',
    approvalDescriptionEvm: 'This setup funds an autonomous participation agent. You stay in control and can disable it from settings.',
    approvalDescriptionStacks: 'This setup authorizes recurring participation logic from your Stacks wallet without manual signing for each run.',
    successTitle: 'Autonomous Agent Activated',
    successDescriptionEvm: 'Your autonomous participation agent is active and ready to execute according to its strategy.',
    successDescriptionStacks: 'Your wallet authorization is active and ready to support autonomous participation flows.',
    failureDescription: 'Unable to activate the autonomous participation agent',
    hubLabel: 'AI agent',
  },
  'no-loss': {
    id: 'no-loss',
    title: 'Prize Savings Agent',
    shortDescription: 'Automate principal-preserving prize savings through PoolTogether v5.',
    configureTitle: 'Configure Prize Savings Automation',
    configureDescription: 'Set up recurring deposits into prize savings instead of buying public-play tickets directly.',
    reviewTitle: 'Review Your Prize Savings Setup',
    approvalDescriptionEvm: 'This permission lets Syndicate automate recurring prize-savings deposits. You can revoke it anytime from settings.',
    approvalDescriptionStacks: 'This authorization lets Syndicate automate recurring prize-savings deposits from your Stacks wallet without signing each time.',
    successTitle: 'Prize Savings Automation Enabled',
    successDescriptionEvm: 'Recurring prize-savings deposits are now active. You can manage them from settings at any time.',
    successDescriptionStacks: 'Your selected token is now authorized for recurring prize-savings deposits without manual signing for each run.',
    failureDescription: 'Unable to enable prize-savings automation',
    hubLabel: 'Prize savings',
  },
  'yield-autopilot': {
    id: 'yield-autopilot',
    title: 'Yield Autopilot',
    shortDescription: 'Use vault yield, not principal, for capped public-play participation.',
    configureTitle: 'Configure Yield Autopilot',
    configureDescription: 'Set a capped MetaMask permission for yield-funded ticket purchases.',
    reviewTitle: 'Review Your Yield Autopilot',
    approvalDescriptionEvm: 'This permission lets Syndicate buy tickets only within your cap, target, and cadence. Principal remains in the selected vault.',
    approvalDescriptionStacks: 'Yield Autopilot is currently optimized for EVM vaults and MetaMask permissions.',
    successTitle: 'Yield Autopilot Enabled',
    successDescriptionEvm: 'Your policy is active. Syndicate will check vault yield and only buy tickets within the permission you approved.',
    successDescriptionStacks: 'Your authorization is active for yield-aware participation.',
    failureDescription: 'Unable to enable Yield Autopilot',
    hubLabel: 'Yield autopilot',
  },
};
