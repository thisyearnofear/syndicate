import { Address, Hash } from 'viem';

export interface VirtualsAgentInfo {
  agentId: string;
  name: string;
  walletAddress: Address;
  solWalletAddress: string;
  email: string;
  builderCode: string;
  isTokenized: boolean;
}

export class VirtualsService {
  private static instance: VirtualsService;

  private readonly agentId = process.env.NEXT_PUBLIC_VIRTUALS_AGENT_ID ?? '';
  private readonly agentWallet = (process.env.NEXT_PUBLIC_VIRTUALS_AGENT_WALLET ?? '') as Address;
  private readonly agentEmail = process.env.NEXT_PUBLIC_VIRTUALS_AGENT_EMAIL ?? '';
  private readonly veniceApiKey = process.env.VIRTUALS_VENICE_API_KEY ?? '';

  private constructor() {}

  public static getInstance(): VirtualsService {
    if (!VirtualsService.instance) {
      VirtualsService.instance = new VirtualsService();
    }
    return VirtualsService.instance;
  }

  async getActiveAgent(): Promise<VirtualsAgentInfo | null> {
    if (!this.agentId || !this.agentWallet) return null;
    return {
      agentId: this.agentId,
      name: 'Syndicate Strategist',
      walletAddress: this.agentWallet,
      solWalletAddress: process.env.NEXT_PUBLIC_VIRTUALS_AGENT_SOL_WALLET ?? '',
      email: this.agentEmail,
      builderCode: process.env.NEXT_PUBLIC_VIRTUALS_BUILDER_CODE ?? '',
      isTokenized: false,
    };
  }

  async sendEmailReport(params: {
    to: string;
    subject: string;
    body: string;
  }): Promise<boolean> {
    try {
      // Calls the ACP email compose endpoint server-side
      const res = await fetch('/api/virtuals/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      return res.ok;
    } catch (error) {
      console.error('[Virtuals] Failed to send agent email:', error);
      return false;
    }
  }

  async executeAgentTransaction(params: {
    to: Address;
    value: bigint;
    data?: `0x${string}`;
    chainId: number;
  }): Promise<{ success: boolean; txHash?: Hash; error?: string }> {
    try {
      const res = await fetch('/api/virtuals/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: params.to,
          value: params.value.toString(),
          data: params.data,
          chainId: params.chainId,
        }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };
      return { success: true, txHash: data.txHash as Hash };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getVeniceReasoning(prompt: string): Promise<string> {
    if (!this.veniceApiKey) {
      return 'Venice AI not configured — using default strategy.';
    }
    try {
      const res = await fetch('https://api.venice.ai/api/generate/text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.veniceApiKey}`,
        },
        body: JSON.stringify({
          model: 'venice-uncensored',
          prompt,
          system_prompt: 'You are the Syndicate Strategist — an autonomous yield optimizer for private FHE vaults on Base. Respond concisely with actionable strategy recommendations.',
        }),
      });
      if (!res.ok) return `Venice API error: ${res.status}`;
      const data = await res.json();
      return data.response ?? 'No reasoning returned.';
    } catch (error) {
      console.error('[Virtuals] Venice reasoning failed:', error);
      return 'Default strategy: maintain current positions.';
    }
  }
}

export const virtualsService = VirtualsService.getInstance();
